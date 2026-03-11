/**
 * Parent session flows:
 *  - GET /sessions?year=&month= (list, isBooked flag)
 *  - GET /sessions/:id (detail)
 *  - auth enforcement
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

let club, parent, gymnast, session;
const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth() + 1; // 1-based

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);

  // Create a session in the current month
  const sessionDate = new Date(YEAR, MONTH - 1, 15); // 15th of this month
  session = await createSession(club, sessionDate);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ─── List sessions ────────────────────────────────────────────────────────────

describe('GET /api/booking/sessions', () => {
  it('returns sessions for the requested month', async () => {
    const res = await request(app)
      .get(`/api/booking/sessions?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const s = res.body.find(x => x.id === session.instance.id);
    expect(s).toBeDefined();
    expect(s.capacity).toBe(10);
    expect(s.bookedCount).toBe(0);
    expect(s.isBooked).toBe(false);
  });

  it('sets isBooked = true when parent has a confirmed booking', async () => {
    await createConfirmedBooking(parent, gymnast, session.instance);

    const res = await request(app)
      .get(`/api/booking/sessions?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    const s = res.body.find(x => x.id === session.instance.id);
    expect(s.isBooked).toBe(true);
    expect(s.bookedCount).toBe(1);
  });

  it('returns 400 when year or month is missing', async () => {
    const res = await request(app)
      .get('/api/booking/sessions')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/booking/sessions?year=${YEAR}&month=${MONTH}`);
    expect(res.status).toBe(401);
  });
});

// ─── Session detail ───────────────────────────────────────────────────────────

describe('GET /api/booking/sessions/:id', () => {
  it('returns session detail with bookings', async () => {
    const res = await request(app)
      .get(`/api/booking/sessions/${session.instance.id}`)
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(session.instance.id);
    expect(res.body.capacity).toBe(10);
    expect(typeof res.body.bookedCount).toBe('number');
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  it('returns 404 for unknown session id', async () => {
    const res = await request(app)
      .get('/api/booking/sessions/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get(`/api/booking/sessions/${session.instance.id}`);
    expect(res.status).toBe(401);
  });
});
