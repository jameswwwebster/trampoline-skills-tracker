/**
 * Parent booking flows:
 *  - POST /bookings (credit-covered → CONFIRMED, Stripe charge → PENDING)
 *  - POST /bookings (full session, gymnast not owned, validation errors)
 *  - GET /bookings/my
 *  - POST /bookings/:id/cancel (with/without credit, already-cancelled, wrong user)
 */

const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createSession,
  createConfirmedBooking,
  createCredit,
  tokenFor,
} = require('../helpers/seed');

// Mock Stripe — paymentIntents.create returns a fake intent
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_fake',
        client_secret: 'pi_test_fake_secret',
      }),
    },
  }));
});

const app = createTestApp();

let club, parent, otherParent, gymnast, otherGymnast, futureSession;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  otherParent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  otherGymnast = await createGymnast(club, otherParent);

  // Session 7 days in the future (used across most tests)
  futureSession = await createSession(club);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ─── Create booking ───────────────────────────────────────────────────────────

describe('POST /api/booking/bookings', () => {
  it('creates a CONFIRMED booking when credits cover the full amount', async () => {
    await createCredit(parent, 600); // exactly one session worth

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: futureSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
    expect(res.body.clientSecret).toBeNull();
  });

  it('creates a PENDING booking and returns clientSecret when no credits remain', async () => {
    // Create a fresh session so the previous CONFIRMED booking doesn't interfere
    const session2 = await createSession(club);

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: session2.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('PENDING');
    expect(res.body.clientSecret).toBe('pi_test_fake_secret');
  });

  it('rejects when session is full', async () => {
    // Session with capacity 1, already filled
    const fullSession = await createSession(club);
    await prisma.sessionInstance.update({
      where: { id: fullSession.instance.id },
      data: { openSlotsOverride: 1 },
    });
    await createConfirmedBooking(otherParent, otherGymnast, fullSession.instance);

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: fullSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough slots/i);
  });

  it('rejects when parent does not own the gymnast', async () => {
    const session3 = await createSession(club);

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: session3.instance.id, gymnastIds: [otherGymnast.id] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('returns 400 when gymnastIds is missing', async () => {
    const session4 = await createSession(club);

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: session4.instance.id });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/booking/bookings')
      .send({ sessionInstanceId: futureSession.instance.id, gymnastIds: [gymnast.id] });
    expect(res.status).toBe(401);
  });
});

// ─── GET /my ─────────────────────────────────────────────────────────────────

describe('GET /api/booking/bookings/my', () => {
  it('returns upcoming non-cancelled bookings for the parent', async () => {
    const res = await request(app)
      .get('/api/booking/bookings/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All returned bookings belong to this parent
    for (const b of res.body) {
      expect(b.userId).toBe(parent.id);
      expect(b.status).not.toBe('CANCELLED');
    }
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/booking/bookings/my');
    expect(res.status).toBe(401);
  });
});

// ─── Cancel booking ───────────────────────────────────────────────────────────

describe('POST /api/booking/bookings/:id/cancel', () => {
  let confirmedBooking;

  beforeEach(async () => {
    const s = await createSession(club);
    confirmedBooking = await createConfirmedBooking(parent, gymnast, s.instance);
  });

  it('cancels a confirmed booking and issues a credit', async () => {
    const creditsBefore = await prisma.credit.count({
      where: { userId: parent.id, usedAt: null },
    });

    const res = await request(app)
      .post(`/api/booking/bookings/${confirmedBooking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(res.body.creditsIssued).toBe(true);

    const creditsAfter = await prisma.credit.count({
      where: { userId: parent.id, usedAt: null },
    });
    expect(creditsAfter).toBe(creditsBefore + confirmedBooking.lines.length);
  });

  it('rejects cancelling an already-cancelled booking', async () => {
    // Cancel it first
    await request(app)
      .post(`/api/booking/bookings/${confirmedBooking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    // Try again
    const res = await request(app)
      .post(`/api/booking/bookings/${confirmedBooking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already cancelled/i);
  });

  it('rejects cancelling another parent\'s booking', async () => {
    const res = await request(app)
      .post(`/api/booking/bookings/${confirmedBooking.id}/cancel`)
      .set('Authorization', `Bearer ${tokenFor(otherParent)}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown booking id', async () => {
    const res = await request(app)
      .post('/api/booking/bookings/nonexistent-id/cancel')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post(`/api/booking/bookings/${confirmedBooking.id}/cancel`);
    expect(res.status).toBe(401);
  });
});
