const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast, createSession, tokenFor } = require('./helpers/seed');

const app = createTestApp();

// These tests require a test DB — they test route shape and auth guards only
describe('GET /api/booking/sessions', () => {
  test('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/booking/sessions?year=2026&month=3');
    expect(res.status).toBe(401);
  });
});

describe('standing slot capacity decrement', () => {
  let club, admin, parent, parentToken, gymnast, template, instance;

  beforeAll(async () => {
    await cleanDatabase();
    club = await createTestClub();
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `future-commit-admin-${Date.now()}@test.tl` });
    parent = await createParent(club, { email: `future-commit-parent-${Date.now()}@test.tl` });
    parentToken = tokenFor(parent);
    gymnast = await createGymnast(club, parent);
    ({ template, instance } = await createSession(club));
    // instance.date is 7 days from now
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: template.id } });
  });

  // ── GET / (calendar list) ──────────────────────────────────────────────────

  it('GET / does not count ACTIVE commitment whose startDate is after the session date', async () => {
    // startDate is 8 days from now; session is 7 days from now → should not count
    const afterSession = new Date(instance.date);
    afterSession.setDate(afterSession.getDate() + 1);
    afterSession.setHours(0, 0, 0, 0);

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: afterSession,
      },
    });

    const d = instance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.templateId === template.id);
    expect(sess).toBeDefined();
    expect(sess.availableSlots).toBe(sess.capacity);
    expect(sess.activeCommitments).toBe(0);
  });

  it('GET / counts ACTIVE commitment with startDate = today against capacity', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: today,
      },
    });

    const d = instance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.templateId === template.id);
    expect(sess).toBeDefined();
    expect(sess.activeCommitments).toBe(1);
    expect(sess.availableSlots).toBe(sess.capacity - 1);
  });

  it('GET / counts ACTIVE commitment with null startDate against capacity', async () => {
    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        // startDate omitted (null)
      },
    });

    const d = instance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.templateId === template.id);
    expect(sess).toBeDefined();
    expect(sess.activeCommitments).toBe(1);
    expect(sess.availableSlots).toBe(sess.capacity - 1);
  });

  it('GET / counts ACTIVE commitment whose startDate is after today but before the session date', async () => {
    // This is the real-world case: a standing slot added this week for a session
    // several weeks away — it must already reduce the available slot count.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    // session is 7 days from now, so tomorrow is before the session date

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: tomorrow,
      },
    });

    const d = instance.date;
    const res = await request(app)
      .get(`/api/booking/sessions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    const sess = res.body.find(s => s.templateId === template.id);
    expect(sess).toBeDefined();
    expect(sess.activeCommitments).toBe(1);
    expect(sess.availableSlots).toBe(sess.capacity - 1);
  });

  // ── GET /:instanceId (session detail) ─────────────────────────────────────

  it('GET /:instanceId does not count ACTIVE commitment whose startDate is after the session date', async () => {
    const afterSession = new Date(instance.date);
    afterSession.setDate(afterSession.getDate() + 1);
    afterSession.setHours(0, 0, 0, 0);

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: afterSession,
      },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toBe(res.body.capacity);
    expect(res.body.activeCommitments).toBe(0);
  });

  it('GET /:instanceId counts ACTIVE commitment with startDate = today against capacity', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: today,
      },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activeCommitments).toBe(1);
    expect(res.body.availableSlots).toBe(res.body.capacity - 1);
  });

  it('GET /:instanceId counts ACTIVE commitment with null startDate against capacity', async () => {
    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        // startDate omitted (null)
      },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activeCommitments).toBe(1);
    expect(res.body.availableSlots).toBe(res.body.capacity - 1);
  });

  it('GET /:instanceId counts ACTIVE commitment whose startDate is after today but before the session date', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    await prisma.commitment.create({
      data: {
        gymnastId: gymnast.id,
        templateId: template.id,
        createdById: admin.id,
        startDate: tomorrow,
      },
    });

    const res = await request(app)
      .get(`/api/booking/sessions/${instance.id}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.activeCommitments).toBe(1);
    expect(res.body.availableSlots).toBe(res.body.capacity - 1);
  });
});
