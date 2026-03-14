const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, parent, gymnast, template;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `mem-commit-admin-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `mem-commit-parent-${Date.now()}@test.tl` });
  gymnast = await createGymnast(club, parent);
  ({ template } = await createSession(club));
  adminToken = tokenFor(admin);
});

afterEach(async () => {
  await prisma.commitment.deleteMany({});
  await prisma.membership.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/memberships with templateIds', () => {
  // Use a future date to avoid activateMembership() being called (which hits Stripe)
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  it('creates commitments atomically with membership', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: futureDate,
        templateIds: [template.id],
      });

    expect(res.status).toBe(201);

    const commitments = await prisma.commitment.findMany({
      where: { gymnastId: gymnast.id, templateId: template.id },
    });
    expect(commitments).toHaveLength(1);
    expect(commitments[0].status).toBe('ACTIVE');
  });

  it('returns 400 if a templateId does not belong to the club', async () => {
    const otherClub = await createTestClub();
    const { template: otherTemplate } = await createSession(otherClub);

    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: futureDate,
        templateIds: [otherTemplate.id],
      });

    expect(res.status).toBe(400);
    // No membership should have been created (atomic failure)
    const mem = await prisma.membership.findFirst({ where: { gymnastId: gymnast.id } });
    expect(mem).toBeNull();
  });

  it('returns 409 if gymnast already has a commitment to one of the templates', async () => {
    // Pre-create a commitment
    await prisma.commitment.create({
      data: { gymnastId: gymnast.id, templateId: template.id, createdById: admin.id },
    });

    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: futureDate,
        templateIds: [template.id],
      });

    expect(res.status).toBe(409);
    // Only 1 commitment (the pre-existing one)
    const count = await prisma.commitment.count({ where: { gymnastId: gymnast.id } });
    expect(count).toBe(1);
  });

  it('creates membership without commitments when templateIds is empty', async () => {
    const res = await request(app)
      .post('/api/booking/memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        gymnastId: gymnast.id,
        monthlyAmount: 3000,
        startDate: futureDate,
        templateIds: [],
      });

    expect(res.status).toBe(201);
    const count = await prisma.commitment.count({ where: { gymnastId: gymnast.id } });
    expect(count).toBe(0);
  });
});
