const request = require('supertest');
const app = require('../server');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  createTestClub,
  createParent,
  createGymnast,
  createSession,
  createCredit,
  tokenFor,
} = require('./helpers/seed');

describe('POST /api/booking/bookings', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).post('/api/booking/bookings').send({});
    expect(res.status).toBe(401);
  });
});

// ── Template pricing tests ──────────────────────────────────────────────────

const testApp = createTestApp();
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

describe('POST /api/booking/bookings — template pricing', () => {
  it('uses template pricePerGymnast (800) instead of hardcoded 600', async () => {
    const { instance } = await createSession(club, undefined, { pricePerGymnast: 800 });

    // We expect a Stripe call to fail in test env; intercept at the route level
    // by using a session with no-charge path (credits cover it) — but actually
    // we just want to confirm totalAmount on the booking record.
    // Use admin-add to bypass payment, then verify via DB; OR test the 500/mock path.
    // Instead, seed a confirmed booking directly to test the credit calculation path:
    // let's verify the booking creation response when chargeAmount > 0 hits Stripe error.
    // The test confirms the route calculates totalAmount = 800, not 600.
    // We force chargeAmount=0 by giving parent a credit >= 800.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.credit.create({ data: { userId: parent.id, amount: 800, expiresAt } });

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(200);
    expect(res.body.booking).toBeDefined();
    expect(res.body.booking.totalAmount).toBe(800);
    expect(res.body.booking.lines[0].amount).toBe(800);
  });
});

describe('POST /api/booking/bookings/batch — template pricing', () => {
  it('uses template pricePerGymnast (900) for batch booking', async () => {
    const { instance } = await createSession(club, undefined, { pricePerGymnast: 900 });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.credit.create({ data: { userId: parent.id, amount: 900, expiresAt } });

    const res = await request(testApp)
      .post('/api/booking/bookings/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ sessionInstanceId: instance.id, gymnastIds: [gymnast.id] }] });

    expect(res.status).toBe(200);
    expect(res.body.bookings).toBeDefined();
    expect(res.body.bookings[0].totalAmount).toBe(900);
    expect(res.body.bookings[0].lines[0].amount).toBe(900);
  });
});

describe('POST /api/booking/bookings/:id/cancel — credit amount matches line amount', () => {
  it('issues credit equal to line.amount (not hardcoded 600)', async () => {
    const { instance } = await createSession(club, undefined, { pricePerGymnast: 750 });

    // Create booking directly in DB with amount=750
    const booking = await prisma.booking.create({
      data: {
        userId: parent.id,
        sessionInstanceId: instance.id,
        status: 'CONFIRMED',
        totalAmount: 750,
        lines: { create: [{ gymnastId: gymnast.id, amount: 750 }] },
      },
      include: { lines: true },
    });

    // Set the session date to tomorrow so cancellation issues credit (not today's rule)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    await prisma.sessionInstance.update({
      where: { id: instance.id },
      data: { date: tomorrow },
    });

    const res = await request(testApp)
      .post(`/api/booking/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.creditsIssued).toBe(true);

    const credits = await prisma.credit.findMany({
      where: { sourceBookingId: booking.id },
    });
    expect(credits).toHaveLength(1);
    expect(credits[0].amount).toBe(750);
  });
});

describe('DMT booking gate', () => {
  let dmtClub, dmtParent, dmtToken, approvedGymnast, unapprovedGymnast;

  beforeAll(async () => {
    dmtClub = await createTestClub();
    dmtParent = await createParent(dmtClub);
    dmtToken = tokenFor(dmtParent);
    approvedGymnast = await createGymnast(dmtClub, dmtParent, { dmtApproved: true });
    unapprovedGymnast = await createGymnast(dmtClub, dmtParent);
  });

  it('POST / — blocks unapproved gymnast for DMT session', async () => {
    const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
    await createCredit(dmtParent, 1200); // enough to cover, eliminates Stripe

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${dmtToken}`)
      .send({ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not approved for DMT/i);
  });

  it('POST / — allows approved gymnast for DMT session', async () => {
    const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
    await createCredit(dmtParent, 1200);

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${dmtToken}`)
      .send({ sessionInstanceId: instance.id, gymnastIds: [approvedGymnast.id] });

    expect(res.status).toBe(200);
  });

  it('POST / — STANDARD session does not apply DMT gate', async () => {
    const { instance } = await createSession(dmtClub, undefined, { type: 'STANDARD' });
    await createCredit(dmtParent, 1200);

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${dmtToken}`)
      .send({ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] });

    expect(res.status).toBe(200);
  });

  it('POST /batch — blocks unapproved gymnast for DMT session', async () => {
    const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
    await createCredit(dmtParent, 1200);

    const res = await request(testApp)
      .post('/api/booking/bookings/batch')
      .set('Authorization', `Bearer ${dmtToken}`)
      .send({ items: [{ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not approved for DMT/i);
  });

  it('POST /combined — blocks unapproved gymnast for DMT session', async () => {
    const { instance } = await createSession(dmtClub, undefined, { type: 'DMT' });
    await createCredit(dmtParent, 1200);

    const res = await request(testApp)
      .post('/api/booking/bookings/combined')
      .set('Authorization', `Bearer ${dmtToken}`)
      .send({ sessions: [{ sessionInstanceId: instance.id, gymnastIds: [unapprovedGymnast.id] }], shopItems: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not approved for DMT/i);
  });
});

describe('Commitment enforcement in booking', () => {
  let club3, coach3, parent3, gymnast3, template3, instance3, coachToken3, parentToken3;

  beforeAll(async () => {
    club3 = await createTestClub();
    coach3 = await createParent(club3, { role: 'COACH', email: `bk-coach3-${Date.now()}@test.tl` });
    parent3 = await createParent(club3, { email: `bk-parent3-${Date.now()}@test.tl` });
    gymnast3 = await createGymnast(club3, parent3);
    ({ template: template3, instance: instance3 } = await createSession(club3));
    coachToken3 = tokenFor(coach3);
    parentToken3 = tokenFor(parent3);
  });

  afterEach(async () => {
    await prisma.commitment.deleteMany({ where: { templateId: template3.id } });
    await prisma.booking.deleteMany({ where: { sessionInstanceId: instance3.id } });
  });

  it('cannot book when capacity is full due to commitments', async () => {
    const template3WithCapacity = await prisma.sessionTemplate.findUnique({ where: { id: template3.id } });
    for (let i = 0; i < template3WithCapacity.openSlots; i++) {
      const g = await createGymnast(club3, parent3);
      await prisma.commitment.create({ data: { gymnastId: g.id, templateId: template3.id, createdById: coach3.id } });
    }

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough slots/i);
  });

  it('gymnast with ACTIVE commitment cannot book the same template session', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast3.id, templateId: template3.id, createdById: coach3.id },
    });

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/standing slot/i);
  });

  it('gymnast with PAUSED commitment can book', async () => {
    await prisma.commitment.create({
      data: { gymnastId: gymnast3.id, templateId: template3.id, createdById: coach3.id, status: 'PAUSED' },
    });
    // Add credit to cover cost so Stripe is not called in tests
    await createCredit(parent3, 1200);

    const res = await request(testApp)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${parentToken3}`)
      .send({ sessionInstanceId: instance3.id, gymnastIds: [gymnast3.id] });

    expect(res.status).toBe(200);
  });
});
