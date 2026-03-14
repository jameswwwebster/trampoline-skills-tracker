const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, tokenFor } = require('./helpers/seed');

const app = createTestApp();
let club, admin, adminToken, parent, parentToken, parent2, parent2Token;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `chg-admin-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `chg-parent-${Date.now()}@test.tl` });
  parent2 = await createParent(club, { email: `chg-parent2-${Date.now()}@test.tl` });
  adminToken = tokenFor(admin);
  parentToken = tokenFor(parent);
  parent2Token = tokenFor(parent2);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

async function seedCharge(overrides = {}) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return prisma.charge.create({
    data: {
      userId: parent.id,
      clubId: club.id,
      amount: 1500,
      description: 'Private session 10 March',
      dueDate,
      ...overrides,
    },
  });
}

describe('POST /api/booking/charges', () => {
  afterEach(() => prisma.charge.deleteMany({}));

  it('admin can create a charge', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const res = await request(app)
      .post('/api/booking/charges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parent.id, amount: 1500, description: 'Private session', dueDate: dueDate.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1500);
    expect(res.body.paidAt).toBeNull();
  });

  it('returns 404 for unknown user', async () => {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const res = await request(app)
      .post('/api/booking/charges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'nonexistent', amount: 1500, description: 'test', dueDate: dueDate.toISOString() });
    expect(res.status).toBe(404);
  });

  it('returns 400 if amount is missing', async () => {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const res = await request(app)
      .post('/api/booking/charges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parent.id, description: 'test', dueDate: dueDate.toISOString() });
    expect(res.status).toBe(400);
  });

  it('returns 403 for parent', async () => {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const res = await request(app)
      .post('/api/booking/charges')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ userId: parent.id, amount: 1500, description: 'test', dueDate: dueDate.toISOString() });
    expect(res.status).toBe(403);
  });

  it('creates an audit log entry', async () => {
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    await request(app)
      .post('/api/booking/charges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parent.id, amount: 1500, description: 'Private session', dueDate: dueDate.toISOString() });

    const log = await prisma.auditLog.findFirst({
      where: { action: 'charge.create' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
    expect(log.metadata).toMatchObject({ userId: parent.id });
  });
});

describe('GET /api/booking/charges/my', () => {
  let charge;
  beforeAll(async () => { charge = await seedCharge(); });
  afterAll(() => prisma.charge.deleteMany({}));

  it('parent sees their unpaid charges', async () => {
    const res = await request(app)
      .get('/api/booking/charges/my')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some(c => c.id === charge.id)).toBe(true);
  });

  it('does not return paid charges', async () => {
    const paid = await seedCharge({ paidAt: new Date() });
    const res = await request(app)
      .get('/api/booking/charges/my')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.body.every(c => c.id !== paid.id)).toBe(true);
    await prisma.charge.delete({ where: { id: paid.id } });
  });

  it('other parent sees no charges', async () => {
    const res = await request(app)
      .get('/api/booking/charges/my')
      .set('Authorization', `Bearer ${parent2Token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('GET /api/booking/charges', () => {
  let charge;
  beforeAll(async () => { charge = await seedCharge(); });
  afterAll(() => prisma.charge.deleteMany({}));

  it('admin lists all club charges', async () => {
    const res = await request(app)
      .get('/api/booking/charges')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(c => c.id === charge.id)).toBe(true);
    expect(res.body[0].user).toBeDefined();
  });

  it('returns 403 for parent', async () => {
    const res = await request(app)
      .get('/api/booking/charges')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/booking/charges/:id', () => {
  afterEach(() => prisma.charge.deleteMany({}));

  it('admin can delete an unpaid charge', async () => {
    const charge = await seedCharge();
    const res = await request(app)
      .delete(`/api/booking/charges/${charge.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const found = await prisma.charge.findUnique({ where: { id: charge.id } });
    expect(found).toBeNull();
  });

  it('returns 400 if charge is already paid', async () => {
    const charge = await seedCharge({ paidAt: new Date() });
    const res = await request(app)
      .delete(`/api/booking/charges/${charge.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown charge', async () => {
    const res = await request(app)
      .delete('/api/booking/charges/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('creates an audit log on delete', async () => {
    const charge = await seedCharge();
    await request(app)
      .delete(`/api/booking/charges/${charge.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const log = await prisma.auditLog.findFirst({
      where: { action: 'charge.delete' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeDefined();
  });
});
