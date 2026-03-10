// backend/services/memberLifecycle.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Delete a member, saving an ArchivedMemberSummary if they have booking/membership history.
 *
 * @param {string} userId
 * @param {'INACTIVITY'|'MANUAL'} reason
 * @param {string|null} deletedBy  userId of acting admin, or null for cron
 */
async function deleteMember(userId, reason, deletedBy = null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      bookings: {
        where: { status: 'CONFIRMED' },
        include: { sessionInstance: true },
      },
      guardedGymnasts: {
        include: { memberships: true },
      },
    },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const confirmedBookings = user.bookings;
  const hasHistory =
    confirmedBookings.length > 0 ||
    user.guardedGymnasts.some(g => g.memberships.length > 0);

  if (hasHistory) {
    const now = new Date();
    const sessionsAttended = confirmedBookings.filter(
      b => new Date(b.sessionInstance.date) <= now
    ).length;
    const totalAmountPaid = confirmedBookings.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );
    const membershipCount = user.guardedGymnasts.reduce(
      (sum, g) => sum + g.memberships.length,
      0
    );

    await prisma.archivedMemberSummary.create({
      data: {
        clubId: user.clubId,
        firstName: user.firstName,
        lastName: user.lastName,
        totalAmountPaid,
        sessionsAttended,
        membershipCount,
        deletionReason: reason,
        deletedBy,
      },
    });
  }

  // Delete in FK dependency order
  await prisma.waitlistEntry.deleteMany({ where: { userId } });
  await prisma.bookingLine.deleteMany({ where: { booking: { userId } } });
  await prisma.credit.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  return { hadHistory: hasHistory };
}

module.exports = { deleteMember };
