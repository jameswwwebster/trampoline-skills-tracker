const { prisma, cleanDatabase } = require('./helpers/db');
const { createTestClub, createParent, createGymnast } = require('./helpers/seed');
const emailService = require('../services/emailService');
const { notifyCoachesLapsing, notifyCoachesLapsed } = require('../routes/booking/webhook');

describe('Coach membership-lapse alerts', () => {
  let club, otherClub, admin, coach, optedOut, otherClubCoach, parent, gymnast, membership;
  let lapsingSpy, lapsedSpy;

  beforeEach(async () => {
    await cleanDatabase();
    club = await createTestClub();
    // createTestClub defaults to emailEnabled=false; flip it on so the helper actually sends.
    club = await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: true } });

    otherClub = await createTestClub();
    otherClub = await prisma.club.update({ where: { id: otherClub.id }, data: { emailEnabled: true } });

    admin = await createParent(club, { role: 'CLUB_ADMIN', email: `lapse-admin-${Date.now()}@test.tl` });
    coach = await createParent(club, { role: 'COACH', email: `lapse-coach-${Date.now()}@test.tl` });
    optedOut = await createParent(club, { role: 'COACH', email: `lapse-quiet-${Date.now()}@test.tl` });
    await prisma.user.update({ where: { id: optedOut.id }, data: { coachLapseAlerts: false } });
    otherClubCoach = await createParent(otherClub, { role: 'COACH', email: `lapse-other-${Date.now()}@test.tl` });

    parent = await createParent(club, { email: `lapse-parent-${Date.now()}@test.tl` });
    gymnast = await createGymnast(club, parent);

    membership = await prisma.membership.create({
      data: {
        gymnastId: gymnast.id, clubId: club.id, monthlyAmount: 4500,
        status: 'ACTIVE', startDate: new Date(),
        stripeSubscriptionId: `sub_lapsetest_${Date.now()}`,
      },
      include: { gymnast: true, club: true },
    });

    lapsingSpy = jest.spyOn(emailService, 'sendMembershipLapsingEmail').mockResolvedValue();
    lapsedSpy = jest.spyOn(emailService, 'sendMembershipLapsedEmail').mockResolvedValue();
  });

  afterEach(() => {
    lapsingSpy.mockRestore();
    lapsedSpy.mockRestore();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  test('lapsing: emails admin + coach in same club, skips opted-out + other club', async () => {
    await notifyCoachesLapsing({
      membership,
      invoice: { amount_due: 4500, attempt_count: 1, next_payment_attempt: Math.floor(Date.now() / 1000) + 86400 },
    });
    const recipients = lapsingSpy.mock.calls.map(c => c[0].coachEmail).sort();
    expect(recipients).toEqual([admin.email, coach.email].sort());
  });

  test('lapsing: two consecutive calls fire two emails per recipient (no dedupe)', async () => {
    const invoice = { amount_due: 4500, attempt_count: 1 };
    await notifyCoachesLapsing({ membership, invoice });
    await notifyCoachesLapsing({ membership, invoice: { ...invoice, attempt_count: 2 } });
    // 2 recipients × 2 calls = 4 total
    expect(lapsingSpy).toHaveBeenCalledTimes(4);
  });

  test('lapsed (stripe-initiated): trigger=stripe in payload', async () => {
    await notifyCoachesLapsed({
      membership,
      trigger: 'stripe',
      cancelledByName: null,
      cancelledAt: new Date(),
    });
    expect(lapsedSpy).toHaveBeenCalled();
    expect(lapsedSpy.mock.calls[0][0].cancellationTrigger).toBe('stripe');
  });

  test('lapsed (admin-initiated): trigger=admin with cancelledByName', async () => {
    await notifyCoachesLapsed({
      membership,
      trigger: 'admin',
      cancelledByName: 'Jane Webster',
      cancelledAt: new Date(),
    });
    const payload = lapsedSpy.mock.calls[0][0];
    expect(payload.cancellationTrigger).toBe('admin');
    expect(payload.cancelledByName).toBe('Jane Webster');
  });

  test('skips entirely when club.emailEnabled = false', async () => {
    await prisma.club.update({ where: { id: club.id }, data: { emailEnabled: false } });
    const refreshed = await prisma.membership.findUnique({ where: { id: membership.id }, include: { gymnast: true, club: true } });
    await notifyCoachesLapsing({ membership: refreshed, invoice: { amount_due: 4500, attempt_count: 1 } });
    expect(lapsingSpy).not.toHaveBeenCalled();
  });
});
