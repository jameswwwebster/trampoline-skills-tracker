const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, parent, gymnast, token;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  token = tokenFor(parent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/gymnasts/bookable-for-me', () => {
  it('includes dmtApproved field (default false)', async () => {
    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const g = res.body.find(g => g.id === gymnast.id);
    expect(g).toBeDefined();
    expect(g.dmtApproved).toBe(false);
  });

  it('returns dmtApproved=true after approval', async () => {
    await prisma.gymnast.update({
      where: { id: gymnast.id },
      data: { dmtApproved: true, dmtApprovedAt: new Date() },
    });

    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    const g = res.body.find(g => g.id === gymnast.id);
    expect(g.dmtApproved).toBe(true);
  });

  it('includes dmtApproved for linked child gymnasts (the children select path)', async () => {
    const childGymnast = await createGymnast(club, parent, { dmtApproved: true, dmtApprovedAt: new Date() });

    const res = await request(app)
      .get('/api/gymnasts/bookable-for-me')
      .set('Authorization', `Bearer ${token}`);

    const g = res.body.find(g => g.id === childGymnast.id);
    expect(g).toBeDefined();
    expect(g.dmtApproved).toBe(true);
  });
});
