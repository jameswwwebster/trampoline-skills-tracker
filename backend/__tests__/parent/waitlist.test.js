/**
 * Parent waitlist flows:
 *  - POST /waitlist/:instanceId (join full session)
 *  - POST /waitlist/:instanceId (reject available session)
 *  - DELETE /waitlist/:instanceId (leave)
 *  - GET /waitlist/my
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
  tokenFor,
} = require('../helpers/seed');

const app = createTestApp();

let club, parent, otherParent, otherGymnast, fullSession, availableSession;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  otherParent = await createParent(club);
  otherGymnast = await createGymnast(club, otherParent);

  // Full session: capacity 1, already booked
  fullSession = await createSession(club);
  await prisma.sessionInstance.update({
    where: { id: fullSession.instance.id },
    data: { openSlotsOverride: 1 },
  });
  await createConfirmedBooking(otherParent, otherGymnast, fullSession.instance);

  // Session with available slots
  availableSession = await createSession(club);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/waitlist/:instanceId', () => {
  it('joins the waitlist for a full session', async () => {
    const res = await request(app)
      .post(`/api/booking/waitlist/${fullSession.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('WAITING');
    expect(res.body.userId).toBe(parent.id);
  });

  it('rejects joining the waitlist when session has available slots', async () => {
    const res = await request(app)
      .post(`/api/booking/waitlist/${availableSession.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/available slots/i);
  });

  it('returns 404 for unknown session', async () => {
    const res = await request(app)
      .post('/api/booking/waitlist/nonexistent-id')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post(`/api/booking/waitlist/${fullSession.instance.id}`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/booking/waitlist/:instanceId', () => {
  it('removes the parent from the waitlist', async () => {
    // Ensure on the waitlist first
    await request(app)
      .post(`/api/booking/waitlist/${fullSession.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    const res = await request(app)
      .delete(`/api/booking/waitlist/${fullSession.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/removed/i);

    // Verify the entry is gone
    const entry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: fullSession.instance.id, userId: parent.id },
    });
    expect(entry).toBeNull();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).delete(`/api/booking/waitlist/${fullSession.instance.id}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/booking/waitlist/my', () => {
  it('returns active waitlist entries for the current user', async () => {
    // Put parent on waitlist again
    await request(app)
      .post(`/api/booking/waitlist/${fullSession.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    const res = await request(app)
      .get('/api/booking/waitlist/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const entry = res.body.find(e => e.sessionInstanceId === fullSession.instance.id);
    expect(entry).toBeDefined();
    expect(entry.status).toBe('WAITING');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/booking/waitlist/my');
    expect(res.status).toBe(401);
  });
});
