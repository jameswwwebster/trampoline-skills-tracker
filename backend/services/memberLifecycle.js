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

  // Delete in FK dependency order, handling all non-cascade relations first.

  // Messages authored by this user: delete them (MessageRecipient has onDelete: Cascade
  // for the messageId FK, so recipients are removed automatically; the userId FK on
  // MessageRecipient is onDelete: SetNull so any recipient rows referencing this user
  // will be nulled out before we reach prisma.user.delete).
  await prisma.message.deleteMany({ where: { authorId: userId } });

  // Invites sent by this user (invitedById is non-nullable, no cascade).
  // Nullify acceptedById first for invites accepted by this user (nullable FK).
  await prisma.invite.updateMany({ where: { acceptedById: userId }, data: { acceptedById: null } });
  await prisma.invite.deleteMany({ where: { invitedById: userId } });

  // GuardianRequests: requestedBy is non-nullable (no cascade); guardianId and
  // processedBy are nullable and should be cleared rather than deleting the record.
  await prisma.guardianRequest.updateMany({ where: { guardianId: userId }, data: { guardianId: null } });
  await prisma.guardianRequest.updateMany({ where: { processedBy: userId }, data: { processedBy: null } });
  await prisma.guardianRequest.deleteMany({ where: { requestedBy: userId } });

  // Certificates: awardedById is non-nullable (no cascade) — delete the certificate.
  // printedById and physicallyAwardedById are nullable — null them out to preserve records.
  await prisma.certificate.updateMany({ where: { printedById: userId }, data: { printedById: null } });
  await prisma.certificate.updateMany({ where: { physicallyAwardedById: userId }, data: { physicallyAwardedById: null } });
  await prisma.certificate.deleteMany({ where: { awardedById: userId } });

  // Progress records: userId is non-nullable on all three tables (no cascade).
  await prisma.levelProgress.deleteMany({ where: { userId } });
  await prisma.routineProgress.deleteMany({ where: { userId } });
  await prisma.skillProgress.deleteMany({ where: { userId } });

  // Original steps (waitlist, booking lines, credits, bookings, audit logs).
  await prisma.waitlistEntry.deleteMany({ where: { userId } });
  await prisma.bookingLine.deleteMany({ where: { booking: { userId } } });
  await prisma.credit.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });

  return { hadHistory: hasHistory };
}

module.exports = { deleteMember };
