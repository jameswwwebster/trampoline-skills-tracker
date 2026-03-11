/**
 * Parent credit flows:
 *  - GET /credits/my (available, excludes expired and used)
 */

const request = require('supertest');
const { createTestApp } = require('../helpers/create-test-app');
const { prisma, cleanDatabase } = require('../helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createCredit,
  tokenFor,
} = require('../helpers/seed');

const app = createTestApp();

let club, parent;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/booking/credits/my', () => {
  it('returns available credits for the current user', async () => {
    const credit = await createCredit(parent, 600, 30);

    const res = await request(app)
      .get('/api/booking/credits/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(c => c.id === credit.id);
    expect(found).toBeDefined();
    expect(found.amount).toBe(600);
  });

  it('excludes expired credits', async () => {
    // Create an already-expired credit
    const expiredAt = new Date(Date.now() - 1000);
    const expired = await prisma.credit.create({
      data: { userId: parent.id, amount: 600, expiresAt: expiredAt },
    });

    const res = await request(app)
      .get('/api/booking/credits/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    const found = res.body.find(c => c.id === expired.id);
    expect(found).toBeUndefined();
  });

  it('excludes used credits', async () => {
    // Create a credit and immediately mark it used
    const used = await prisma.credit.create({
      data: {
        userId: parent.id,
        amount: 600,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    const res = await request(app)
      .get('/api/booking/credits/my')
      .set('Authorization', `Bearer ${tokenFor(parent)}`);

    expect(res.status).toBe(200);
    const found = res.body.find(c => c.id === used.id);
    expect(found).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/booking/credits/my');
    expect(res.status).toBe(401);
  });
});
