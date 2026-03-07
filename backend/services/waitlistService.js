const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OFFER_WINDOW_HOURS = 2;

/**
 * After a cancellation frees a slot, offer it to the next person on the waitlist.
 */
async function processWaitlist(sessionInstanceId) {
  const instance = await prisma.sessionInstance.findUnique({
    where: { id: sessionInstanceId },
    include: {
      template: true,
      bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      waitlistEntries: {
        where: { status: 'WAITING' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  if (!instance || instance.cancelledAt) return;

  const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
  const capacity = instance.openSlotsOverride ?? instance.template.openSlots;

  if (bookedCount >= capacity) return; // still full
  if (instance.waitlistEntries.length === 0) return; // nobody waiting

  const next = instance.waitlistEntries[0];
  const offerExpiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 60 * 60 * 1000);

  await prisma.waitlistEntry.update({
    where: { id: next.id },
    data: { status: 'OFFERED', offerExpiresAt },
  });
}

/**
 * Expire stale offers and cascade to next in line.
 * Called by cron job.
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
