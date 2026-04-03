const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Delete all test data in dependency order.
 * Only removes rows whose email ends with @test.tl to avoid touching real data.
 */
async function cleanDatabase() {
  // Find test user IDs first
  const testUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@test.tl' } },
    select: { id: true },
  });
  const testUserIds = testUsers.map(u => u.id);

  if (testUserIds.length === 0) return;

  // Delete leaf records first, then parents
  await prisma.waitlistEntry.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.bookingLine.deleteMany({
    where: { booking: { userId: { in: testUserIds } } },
  });
  // Credits must be deleted before bookings (credits.sourceBookingId and
  // credits.usedOnBookingId reference the Booking table)
  await prisma.credit.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.booking.deleteMany({ where: { userId: { in: testUserIds } } });
  // Shop orders
  await prisma.shopOrderItem.deleteMany({
    where: { order: { userId: { in: testUserIds } } },
  });
  await prisma.shopOrder.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.charge.deleteMany({ where: { userId: { in: testUserIds } } });

  // Find gymnasts belonging to test users (via guardians or via userId for adult participants)
  const testGymnasts = await prisma.gymnast.findMany({
    where: {
      OR: [
        { guardians: { some: { id: { in: testUserIds } } } },
        { userId: { in: testUserIds } },
      ],
    },
    select: { id: true },
  });
  const testGymnastIds = testGymnasts.map(g => g.id);

  await prisma.membership.deleteMany({ where: { gymnastId: { in: testGymnastIds } } });
  await prisma.commitment.deleteMany({ where: { gymnastId: { in: testGymnastIds } } });
  await prisma.competitionEntry.deleteMany({ where: { gymnastId: { in: testGymnastIds } } });
  await prisma.gymnast.deleteMany({ where: { id: { in: testGymnastIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });

  // Delete test session instances and templates
  await prisma.sessionInstance.deleteMany({
    where: { template: { club: { name: 'Test Club TL' } } },
  });
  await prisma.commitment.deleteMany({ where: { template: { club: { name: 'Test Club TL' } } } });
  await prisma.sessionTemplate.deleteMany({
    where: { club: { name: 'Test Club TL' } },
  });
  // Fallback: delete any remaining gymnasts in the test club (covers stale data from crashed runs)
  await prisma.membership.deleteMany({ where: { gymnast: { club: { name: 'Test Club TL' } } } });
  await prisma.gymnast.deleteMany({ where: { club: { name: 'Test Club TL' } } });
  await prisma.club.deleteMany({ where: { name: 'Test Club TL' } });
  // Also clean up any "Trampoline Life" club left over from auth tests
  // (only if there are no non-test users attached)
}

module.exports = { prisma, cleanDatabase };
