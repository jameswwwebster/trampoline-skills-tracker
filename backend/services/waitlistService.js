const { PrismaClient } = require('@prisma/client');
const emailService = require('./emailService');
const prisma = new PrismaClient();

const OFFER_WINDOW_HOURS = 2;
const OPEN_OFFER_THRESHOLD_HOURS = 6;

/**
 * After a cancellation frees a slot, offer it to the next person(s) on the waitlist.
 * >6hrs out: exclusive offer to the next person in queue.
 * ≤6hrs out: open offer to all waiting — first to book gets it.
 */
async function processWaitlist(sessionInstanceId) {
  const instance = await prisma.sessionInstance.findUnique({
    where: { id: sessionInstanceId },
    include: {
      template: { include: { club: true } },
      bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      waitlistEntries: {
        where: { status: 'WAITING' },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!instance || instance.cancelledAt) return;

  const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
  const capacity = instance.openSlotsOverride ?? instance.template.openSlots;

  if (bookedCount >= capacity) return; // still full
  if (instance.waitlistEntries.length === 0) return; // nobody waiting

  // Determine offer type based on session proximity
  const [sh, sm] = instance.template.startTime.split(':').map(Number);
  const sessionStart = new Date(instance.date);
  sessionStart.setHours(sh, sm, 0, 0);
  const hoursUntilSession = (sessionStart - Date.now()) / (1000 * 60 * 60);

  const { startTime, endTime } = instance.template;
  const emailEnabled = instance.template.club?.emailEnabled;

  if (hoursUntilSession > OPEN_OFFER_THRESHOLD_HOURS) {
    // Exclusive offer — next person in queue only
    const next = instance.waitlistEntries[0];
    const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 60 * 60 * 1000);

    await prisma.waitlistEntry.update({
      where: { id: next.id },
      data: { status: 'OFFERED', offerType: 'EXCLUSIVE', offerExpiresAt },
    });

    if (emailEnabled) {
      emailService.trySendWaitlistOffer(
        next.userId, instance.date, startTime, endTime, 'EXCLUSIVE', offerExpiresAt, prisma
      );
    }
  } else {
    // Open offer — all waiting entries simultaneously
    const ids = instance.waitlistEntries.map(e => e.id);

    await prisma.waitlistEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: 'OFFERED', offerType: 'OPEN' },
    });

    if (emailEnabled) {
      for (const entry of instance.waitlistEntries) {
        emailService.trySendWaitlistOffer(
          entry.userId, instance.date, startTime, endTime, 'OPEN', null, prisma
        );
      }
    }
  }
}

/**
 * Expire stale exclusive offers and cascade to next in line.
 * Called by cron job every 15 minutes.
 * Open offers (offerExpiresAt = null) are never expired here.
 */
async function expireStaleOffers() {
  const stale = await prisma.waitlistEntry.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lt: new Date() } },
  });

  for (const entry of stale) {
    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: 'EXPIRED' },
    });
    await processWaitlist(entry.sessionInstanceId);
  }
}

module.exports = { processWaitlist, expireStaleOffers };
