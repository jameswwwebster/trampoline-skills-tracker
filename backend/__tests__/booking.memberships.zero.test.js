const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, gymnast;

const today = new Date().toISOString().split('T')[0];
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `zero-mem-admin-${Date.now()}@test.tl` });
  const parent = await createParent(club, { email: `zero-mem-parent-${Date.now()}@test.tl` });
  gymnast = await createGymnast(club, parent);
  adminToken = tokenFor(admin);
});

afterEach(async () => {
  await prisma.membership.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Zero-amount memberships', () => {
  it('POST with monthlyAmount: 0 and today creates ACTIVE membership with no Stripe data', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 0, startDate: today });

    expect(res.status).toBe(201);
    expect(res.body.membership.status).toBe('ACTIVE');
    expect(res.body.membership.stripeSubscriptionId).toBeNull();
    expect(res.body.membership.needsPaymentMethod).toBe(false);
  });

  it('POST with monthlyAmount: 0 and future date creates SCHEDULED membership', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 0, startDate: futureDate });

    expect(res.status).toBe(201);
    expect(res.body.membership.status).toBe('SCHEDULED');
  });

  it('POST with monthlyAmount: -1 returns 400', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: -1, startDate: futureDate });

    expect(res.status).toBe(400);
  });

  it('PATCH /:id with monthlyAmount: 0 returns 400', async () => {
    const createRes = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gymnastId: gymnast.id, monthlyAmount: 3000, startDate: futureDate });
    expect(createRes.status).toBe(201);
    const membershipId = createRes.body.membership.id;

    const res = await request(app)
      .patch(`/api/booking/memberships/${membershipId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 0 });

    expect(res.status).toBe(400);
  });
});
