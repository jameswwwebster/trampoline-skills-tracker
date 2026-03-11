/**
 * Parent membership flows:
 *  - GET /memberships/my (returns active/scheduled, excludes cancelled)
 */

const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createMembership,
  tokenFor,
} = require('../helpers/seed');

const app = createTestApp();

let club, parent, gymnast;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/booking/memberships/my', () => {
  it('returns active memberships for gymnasts the parent guards', async () => {
    const membership = await createMembership(gymnast, club, { status: 'ACTIVE' });

    const res = await request(app)
      .get('/api/booking/memberships/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(m => m.id === membership.id);
    expect(found).toBeDefined();
    expect(found.gymnast.id).toBe(gymnast.id);
  });

  it('excludes cancelled memberships', async () => {
    const cancelled = await createMembership(gymnast, club, { status: 'CANCELLED' });

    const res = await request(app)
      .get('/api/booking/memberships/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    const found = res.body.find(m => m.id === cancelled.id);
    expect(found).toBeUndefined();
  });

  it('includes SCHEDULED memberships (future start date)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const scheduled = await createMembership(gymnast, club, {
      status: 'SCHEDULED',
      startDate: futureDate,
    });

    const res = await request(app)
      .get('/api/booking/memberships/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    const found = res.body.find(m => m.id === scheduled.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('SCHEDULED');
  });

  it('returns empty array when parent has no gymnasts with memberships', async () => {
    const otherParent = await createParent(club);

    const res = await request(app)
      .get('/api/booking/memberships/my')
      .set('Authorization', `Bearer ${tokenFor(otherParent)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/booking/memberships/my');
    expect(res.status).toBe(401);
  });
});
