// backend/__tests__/booking.recurringCredits.test.js
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, tokenFor } = require('./helpers/seed');
const { processRecurringCredits } = require('../routes/booking/recurringCredits');

const app = createTestApp();

let club, otherClub, admin, adminToken, parent, parentToken, otherAdmin, otherAdminToken;

beforeAll(async () => {
  await cleanDatabase();
  club = await createTestClub();
  otherClub = await createTestClub();
  admin = await createParent(club, { role: 'CLUB_ADMIN', email: `rc-admin-${Date.now()}@test.tl` });
  parent = await createParent(club, { email: `rc-parent-${Date.now()}@test.tl` });
  otherAdmin = await createParent(otherClub, { role: 'CLUB_ADMIN', email: `rc-other-${Date.now()}@test.tl` });
  adminToken = tokenFor(admin);
  parentToken = tokenFor(parent);
  otherAdminToken = tokenFor(otherAdmin);
});

afterEach(async () => {
  await prisma.credit.deleteMany({});
  await prisma.recurringCredit.deleteMany({});
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/booking/recurring-credits', () => {
  it('creates rule and issues a Credit expiring end of current month', async () => {
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parent.id, amountPence: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(parent.id);
    expect(res.body.amountPence).toBe(1000);
    expect(res.body.lastIssuedAt).not.toBeNull();

    // Credit record should exist
    const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBe(1000);

    // expiresAt should be last second of current month
    const exp = new Date(credits[0].expiresAt);
    const now = new Date();
    expect(exp.getUTCMonth()).toBe(now.getUTCMonth());
    expect(exp.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(exp.getUTCHours()).toBe(23);
    expect(exp.getUTCMinutes()).toBe(59);
  });

  it('returns 400 for past endDate', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: parent.id, amountPence: 1000, endDate: pastDate.toISOString().split('T')[0] });
    expect(res.status).toBe(400);
  });

  it('returns 404 for archived user', async () => {
    const archived = await createParent(club, {
      email: `rc-archived-${Date.now()}@test.tl`,
      isArchived: true,
    });
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: archived.id, amountPence: 1000 });
    expect(res.status).toBe(404);
  });

  it('returns 404 for user in different club', async () => {
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: otherAdmin.id, amountPence: 1000 });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .send({ userId: parent.id, amountPence: 1000 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for parent role', async () => {
    const res = await request(app)
      .post('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ userId: parent.id, amountPence: 1000 });
    expect(res.status).toBe(403);
  });
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/booking/recurring-credits', () => {
  it('returns active rules for the club with userName', async () => {
    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 500,
        createdById: admin.id,
        isActive: true,
      },
    });

    const res = await request(app)
      .get('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userName).toBe(`${parent.firstName} ${parent.lastName}`);
    expect(res.body[0].amountPence).toBe(500);
  });

  it('excludes cancelled (isActive: false) rules', async () => {
    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 500,
        createdById: admin.id,
        isActive: false,
      },
    });

    const res = await request(app)
      .get('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('admin from different club sees empty array (club scoping)', async () => {
    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 500,
        createdById: admin.id,
        isActive: true,
      },
    });

    const res = await request(app)
      .get('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/booking/recurring-credits');
    expect(res.status).toBe(401);
  });

  it('returns 403 for parent role', async () => {
    const res = await request(app)
      .get('/api/booking/recurring-credits')
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe('DELETE /api/booking/recurring-credits/:id', () => {
  it('sets isActive = false; associated Credit is unchanged', async () => {
    const rule = await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 800,
        createdById: admin.id,
        isActive: true,
      },
    });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const credit = await prisma.credit.create({
      data: { userId: parent.id, amount: 800, expiresAt },
    });

    const res = await request(app)
      .delete(`/api/booking/recurring-credits/${rule.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const updated = await prisma.recurringCredit.findUnique({ where: { id: rule.id } });
    expect(updated.isActive).toBe(false);

    // Credit record untouched
    const stillThere = await prisma.credit.findUnique({ where: { id: credit.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere.amount).toBe(800);
  });

  it('returns 404 for rule in different club', async () => {
    const rule = await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 800,
        createdById: admin.id,
        isActive: true,
      },
    });

    const res = await request(app)
      .delete(`/api/booking/recurring-credits/${rule.id}`)
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/booking/recurring-credits/fakeid');
    expect(res.status).toBe(401);
  });

  it('returns 403 for parent role', async () => {
    const rule = await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 800,
        createdById: admin.id,
        isActive: true,
      },
    });
    const res = await request(app)
      .delete(`/api/booking/recurring-credits/${rule.id}`)
      .set('Authorization', `Bearer ${parentToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Cron helper ───────────────────────────────────────────────────────────────

describe('processRecurringCredits', () => {
  it('issues credit for active rule where lastIssuedAt is in previous month', async () => {
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 1200,
        createdById: admin.id,
        isActive: true,
        lastIssuedAt: lastMonth,
      },
    });

    const issued = await processRecurringCredits(prisma);
    expect(issued).toBe(1);

    const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBe(1200);
  });

  it('skips rule where endDate is in the past', async () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 1200,
        createdById: admin.id,
        isActive: true,
        endDate: yesterday,
      },
    });

    const issued = await processRecurringCredits(prisma);
    expect(issued).toBe(0);

    const credits = await prisma.credit.findMany({ where: { userId: parent.id } });
    expect(credits).toHaveLength(0);
  });

  it('skips rule where lastIssuedAt is already in the current month (idempotent)', async () => {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: parent.id,
        amountPence: 1200,
        createdById: admin.id,
        isActive: true,
        lastIssuedAt: startOfMonth,
      },
    });

    const issued = await processRecurringCredits(prisma);
    expect(issued).toBe(0);
  });

  it('skips rule where user is archived', async () => {
    const archivedUser = await createParent(club, {
      email: `rc-arch2-${Date.now()}@test.tl`,
      isArchived: true,
    });

    await prisma.recurringCredit.create({
      data: {
        clubId: club.id,
        userId: archivedUser.id,
        amountPence: 1200,
        createdById: admin.id,
        isActive: true,
      },
    });

    const issued = await processRecurringCredits(prisma);
    expect(issued).toBe(0);
  });
});
