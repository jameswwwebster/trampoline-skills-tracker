/**
 * Tests for booking route OFFERED waitlist bypass.
 */
const request = require('supertest');
const { createTestApp } = require('./helpers/create-test-app');
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createSession,
  createConfirmedBooking,
  tokenFor,
} = require('./helpers/seed');

const app = createTestApp();

let club, parent, gymnast, otherParent, otherGymnast, fullSession;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parent = await createParent(club);
  gymnast = await createGymnast(club, parent);
  otherParent = await createParent(club);
  otherGymnast = await createGymnast(club, otherParent);

  // Full session: capacity 1, free (pricePerGymnast=0 avoids Stripe in tests)
  fullSession = await createSession(club, null, { pricePerGymnast: 0 });
  await prisma.sessionInstance.update({
    where: { id: fullSession.instance.id },
    data: { openSlotsOverride: 1 },
  });
  await createConfirmedBooking(otherParent, otherGymnast, fullSession.instance);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/booking/bookings — OFFERED waitlist bypass', () => {
  it('blocks booking a full session with no waitlist offer', async () => {
    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: fullSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not enough slots/i);
  });

  it('allows booking when user has an OFFERED waitlist entry', async () => {
    await prisma.waitlistEntry.upsert({
      where: { sessionInstanceId_userId: { sessionInstanceId: fullSession.instance.id, userId: parent.id } },
      create: { sessionInstanceId: fullSession.instance.id, userId: parent.id, status: 'OFFERED', offerType: 'EXCLUSIVE' },
      update: { status: 'OFFERED', offerType: 'EXCLUSIVE' },
    });

    const res = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: fullSession.instance.id, gymnastIds: [gymnast.id] });

    expect(res.status).toBe(200);

    const entry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: fullSession.instance.id, userId: parent.id },
    });
    expect(entry.status).toBe('CLAIMED');
  });

  it('expires other OFFERED entries after a successful booking (open offer case)', async () => {
    const thirdParent = await createParent(club);
    const thirdGymnast = await createGymnast(club, thirdParent);
    // Use a different time to avoid overlap with fullSession (10:00–11:00)
    const session = await createSession(club, null, { pricePerGymnast: 0, startTime: '14:00', endTime: '15:00' });
    await prisma.sessionInstance.update({
      where: { id: session.instance.id },
      data: { openSlotsOverride: 1 },
    });
    await createConfirmedBooking(otherParent, otherGymnast, session.instance);

    await prisma.waitlistEntry.createMany({
      data: [
        { sessionInstanceId: session.instance.id, userId: parent.id, status: 'OFFERED', offerType: 'OPEN' },
        { sessionInstanceId: session.instance.id, userId: thirdParent.id, status: 'OFFERED', offerType: 'OPEN' },
      ],
    });

    const bookRes = await request(app)
      .post('/api/booking/bookings')
      .set('Authorization', `Bearer ${tokenFor(parent)}`)
      .send({ sessionInstanceId: session.instance.id, gymnastIds: [gymnast.id] });

    expect(bookRes.status).toBe(200);

    const thirdEntry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: session.instance.id, userId: thirdParent.id },
    });
    expect(thirdEntry.status).toBe('EXPIRED');
  });
});
