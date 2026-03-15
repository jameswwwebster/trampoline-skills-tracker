const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, tokenFor } = require('./helpers/seed');
const emailService = require('../services/emailService');

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

  it('sends charge created email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendChargeCreatedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 1500, description: 'Test charge', dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
      await prisma.charge.deleteMany({ where: { clubId: club.id } });
    }
  });

  it('does not send email when emailEnabled is false', async () => {
    const spy = jest.spyOn(emailService, 'sendChargeCreatedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 1500, description: 'Test charge', dueDate: new Date(Date.now() + 7 * 86400000).toISOString() });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      await prisma.charge.deleteMany({ where: { clubId: club.id } });
    }
  });
});

describe('GET /api/booking/charges/my', () => {
  let charge;
  beforeAll(async () => { charge = await seedCharge(); });
  afterAll(() => prisma.charge.deleteMany({}));

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/booking/charges/my');
    expect(res.status).toBe(401);
  });

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

  it('filters by userId when query param provided', async () => {
    const res = await request(app)
      .get(`/api/booking/charges?userId=${parent.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(c => c.userId === parent.id)).toBe(true);
  });

  it('returns empty array for userId with no charges', async () => {
    const res = await request(app)
      .get(`/api/booking/charges?userId=${parent2.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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

  it('sends charge deleted email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const charge = await seedCharge();
    const spy = jest.spyOn(emailService, 'sendChargeDeletedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .delete(`/api/booking/charges/${charge.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });
});

describe('POST /api/booking/bookings/combined — charge settlement', () => {
  const { createSession, createGymnast, createMembership, createCredit } = require('./helpers/seed');
  let gymnast, instance;

  beforeAll(async () => {
    gymnast = await createGymnast(club, parent, { bgNumber: 'BG123456' });
    await createMembership(gymnast, club);
    const sess = await createSession(club);
    instance = sess.instance;
  });

  afterEach(() => prisma.charge.deleteMany({}));

  it('empty sessions+shop cart with an outstanding charge is not rejected (charge-only checkout allowed)', async () => {
    await seedCharge(); // £15 outstanding
    const res = await request(app)
      .post('/api/booking/bookings/combined')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ sessions: [], shopItems: [] });
    // Should NOT be 400 "Cart is empty"
    expect(res.status).not.toBe(400);
  });

  it('charge-only free checkout (credits cover charge) marks charges paid immediately', async () => {
    const credit = await createCredit(parent, 1500); // 1500p = £15
    const charge = await seedCharge(); // 1500p

    const res = await request(app)
      .post('/api/booking/bookings/combined')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ sessions: [], shopItems: [] });

    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBeFalsy(); // free checkout — no PaymentIntent

    const updated = await prisma.charge.findUnique({ where: { id: charge.id } });
    expect(updated.paidAt).not.toBeNull();

    // cleanup credit
    await prisma.credit.deleteMany({ where: { userId: parent.id } });
  });
});

describe('Overdue charge blocks POST /api/booking/bookings', () => {
  const { createSession, createGymnast, createMembership } = require('./helpers/seed');
  let gymnast, instance;

  beforeAll(async () => {
    gymnast = await createGymnast(club, parent, { bgNumber: 'BG123456' });
    await createMembership(gymnast, club);
    const sess = await createSession(club);
    instance = sess.instance;
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 1);
    await prisma.charge.create({
      data: { userId: parent.id, clubId: club.id, amount: 1000, description: 'Overdue', dueDate: pastDue },
    });
  });

  afterAll(async () => {
    await prisma.charge.deleteMany({});
  });

  it('returns 400 when parent has an overdue charge', async () => {
    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/overdue charge/);
  });
});

describe('POST /api/booking/credits/assign — email', () => {
  afterEach(() => prisma.credit.deleteMany({}));

  it('sends credit assigned email when emailEnabled is true', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendCreditAssignedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/credits/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 500, expiresInDays: 30 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });

  it('does not send email when emailEnabled is false', async () => {
    const spy = jest.spyOn(emailService, 'sendCreditAssignedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .post('/api/booking/credits/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: parent.id, amount: 500, expiresInDays: 30 });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('DELETE /api/booking/credits/:id — email', () => {
  it('sends credit deleted email when emailEnabled is true', async () => {
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const credit = await prisma.credit.create({
      data: { userId: parent.id, amount: 500, expiresAt },
    });
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });
    const spy = jest.spyOn(emailService, 'sendCreditDeletedEmail').mockResolvedValue({ success: true });
    try {
      await request(app)
        .delete(`/api/booking/credits/${credit.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(parent.email);
    } finally {
      spy.mockRestore();
      await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    }
  });
});
