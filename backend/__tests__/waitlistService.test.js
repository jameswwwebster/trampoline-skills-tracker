/**
 * Tests for waitlistService.processWaitlist
 * Verifies exclusive vs open offer branching based on session proximity.
 */
const { prisma, cleanDatabase } = require('./helpers/db');
const {
  ensureTrampolineLifeClub,
  createParent,
  createGymnast,
  createConfirmedBooking,
} = require('./helpers/seed');
const { processWaitlist } = require('../services/waitlistService');

let club, parentA, parentB, parentC, gymnastA, fillerParent, fillerGymnast;

beforeAll(async () => {
  await cleanDatabase();
  club = await ensureTrampolineLifeClub();
  parentA = await createParent(club);
  parentB = await createParent(club);
  parentC = await createParent(club);
  gymnastA = await createGymnast(club, parentA);
  fillerParent = await createParent(club);
  fillerGymnast = await createGymnast(club, fillerParent);
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

/** Create a full session (capacity 1, already booked) with waitlist entries.
 *  hoursFromNow controls when the session is — determines exclusive vs open offer.
 *  Derives both the date and startTime from the target timestamp so processWaitlist
 *  reconstructs the correct wall-clock time regardless of timezone.
 */
async function makeFullSession(hoursFromNow, waitlistUserIds) {
  const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  // SessionInstance.date is @db.Date — Prisma round-trips as UTC midnight of the
  // stored calendar day. Build a UTC-midnight Date matching target's LOCAL day
  // so processWaitlist's `new Date(instance.date); setHours(sh, sm)` lands on
  // the same wall-clock moment as target, regardless of timezone.
  const sessionDate = new Date(Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()));
  const startTime = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;

  const template = await prisma.sessionTemplate.create({
    data: {
      clubId: club.id,
      dayOfWeek: sessionDate.getDay(),
      startTime,
      endTime: '12:00',
      openSlots: 1,
    },
  });

  const instance = await prisma.sessionInstance.create({
    data: { templateId: template.id, date: sessionDate, openSlotsOverride: 1 },
  });

  await createConfirmedBooking(fillerParent, fillerGymnast, instance);

  for (const userId of waitlistUserIds) {
    await prisma.waitlistEntry.create({
      data: { sessionInstanceId: instance.id, userId, status: 'WAITING' },
    });
  }

  return instance;
}

describe('processWaitlist — exclusive offer (>6hrs)', () => {
  it('sets OFFERED on the first WAITING entry only', async () => {
    const instance = await makeFullSession(10, [parentA.id, parentB.id]);

    // Cancel the filler booking to free a slot
    await prisma.booking.updateMany({
      where: { sessionInstanceId: instance.id },
      data: { status: 'CANCELLED' },
    });
    await processWaitlist(instance.id);

    const entries = await prisma.waitlistEntry.findMany({
      where: { sessionInstanceId: instance.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(entries[0].status).toBe('OFFERED');
    expect(entries[0].offerType).toBe('EXCLUSIVE');
    expect(entries[0].offerExpiresAt).not.toBeNull();
    expect(entries[1].status).toBe('WAITING');
    expect(entries[1].offerType).toBeNull();
  });
});

describe('processWaitlist — open offer (≤6hrs)', () => {
  it('sets OFFERED on ALL WAITING entries with no expiry', async () => {
    const instance = await makeFullSession(3, [parentA.id, parentB.id, parentC.id]);

    await prisma.booking.updateMany({
      where: { sessionInstanceId: instance.id },
      data: { status: 'CANCELLED' },
    });
    await processWaitlist(instance.id);

    const entries = await prisma.waitlistEntry.findMany({
      where: { sessionInstanceId: instance.id },
    });

    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.status).toBe('OFFERED');
      expect(entry.offerType).toBe('OPEN');
      expect(entry.offerExpiresAt).toBeNull();
    }
  });
});

describe('processWaitlist — no action cases', () => {
  it('does nothing when session is still full', async () => {
    // Session is full with no cancellation — nobody should be offered
    const instance = await makeFullSession(10, [parentA.id]);

    await processWaitlist(instance.id);

    const entry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId: instance.id, userId: parentA.id },
    });
    expect(entry.status).toBe('WAITING');
  });

  it('does nothing when nobody is waiting', async () => {
    const sessionDate = new Date();
    sessionDate.setUTCHours(0, 0, 0, 0);
    const template = await prisma.sessionTemplate.create({
      data: { clubId: club.id, dayOfWeek: sessionDate.getDay(), startTime: '10:00', endTime: '11:00', openSlots: 10 },
    });
    const instance = await prisma.sessionInstance.create({
      data: { templateId: template.id, date: sessionDate },
    });

    await expect(processWaitlist(instance.id)).resolves.not.toThrow();
  });
});
