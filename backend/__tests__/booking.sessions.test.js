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

describe('PATCH /api/booking/sessions/:instanceId/cancel', () => {
  let club, admin, parent, parentToken, adminToken, gymnast, template, instance;

  beforeEach(async () => {
    await cleanDatabase();
    club = await createTestClub();
    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `cs-admin-${Date.now()}@test.tl` });
    parent = await createParent(club, { email: `cs-parent-${Date.now()}@test.tl` });
    parentToken = tokenFor(parent);
    adminToken = tokenFor(admin);
    gymnast = await createGymnast(club, parent);
    ({ template, instance } = await createSession(club, undefined, { pricePerGymnast: 750 }));
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('cancels instance, marks bookings CANCELLED, issues per-line credits, drops attendance + waitlist', async () => {
    const booking = await prisma.booking.create({
      data: {
        userId: parent.id, sessionInstanceId: instance.id, status: 'CONFIRMED',
        totalAmount: 750, lines: { create: [{ gymnastId: gymnast.id, amount: 750 }] },
      },
      include: { lines: true },
    });
    await prisma.attendance.create({
      data: { sessionInstanceId: instance.id, gymnastId: gymnast.id, status: 'PRESENT', markedById: admin.id },
    });
    const otherParent = await createParent(club, { email: `cs-other-${Date.now()}@test.tl` });
    await prisma.waitlistEntry.create({
      data: { userId: otherParent.id, sessionInstanceId: instance.id, status: 'OFFERED' },
    });

    const res = await request(app)
      .patch(`/api/booking/sessions/${instance.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Coach unwell' });

    expect(res.status).toBe(200);
    expect(res.body.affectedBookings).toBe(1);
    expect(res.body.creditCount).toBe(1);
    expect(res.body.totalCredited).toBe(750);
    expect(res.body.waitlistAffected).toBe(1);

    const reloaded = await prisma.sessionInstance.findUnique({ where: { id: instance.id } });
    expect(reloaded.cancelledAt).toBeTruthy();
    expect(reloaded.cancellationReason).toBe('Coach unwell');

    const reloadedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { lines: true },
    });
    expect(reloadedBooking.status).toBe('CANCELLED');
    expect(reloadedBooking.lines[0].cancelledAt).toBeTruthy();

    const credits = await prisma.credit.findMany({ where: { userId: parent.id, sourceBookingId: booking.id } });
    expect(credits.length).toBe(1);
    expect(credits[0].amount).toBe(750);

    const attendance = await prisma.attendance.findMany({ where: { sessionInstanceId: instance.id } });
    expect(attendance.length).toBe(0);

    const waitlist = await prisma.waitlistEntry.findMany({ where: { sessionInstanceId: instance.id } });
    expect(waitlist.every(w => w.status === 'EXPIRED')).toBe(true);
  });

  it('rejects when reason missing', async () => {
    const res = await request(app)
      .patch(`/api/booking/sessions/${instance.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-admin/coach', async () => {
    const res = await request(app)
      .patch(`/api/booking/sessions/${instance.id}/cancel`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when already cancelled', async () => {
    await prisma.sessionInstance.update({ where: { id: instance.id }, data: { cancelledAt: new Date() } });
    const res = await request(app)
      .patch(`/api/booking/sessions/${instance.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown instance', async () => {
    const res = await request(app)
      .patch('/api/booking/sessions/nope/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(404);
  });
});
