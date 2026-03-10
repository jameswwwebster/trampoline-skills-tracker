// backend/services/recipientResolver.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Resolve a recipientFilter JSON into an array of { id, email, firstName } objects.
 * Only returns users with a non-null email.
 *
 * Filter shapes:
 *   { type: 'all' }
 *   { type: 'role', role: 'PARENT' | 'COACH' }
 *   { type: 'session', instanceId: string }
 *   { type: 'active_membership' }
 *   { type: 'expiring_credits', withinDays: number }
 *   { type: 'no_upcoming_bookings', withinDays: number }
 *   { type: 'adhoc', userIds: string[] }
 *   { operator: 'AND' | 'OR', filters: Filter[] }
 */
async function resolveRecipients(filter, clubId) {
  const users = await _resolve(filter, clubId);
  // Deduplicate by id, ensure email present
  const seen = new Set();
  return users.filter(u => {
    if (!u.email || seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

async function _resolve(filter, clubId) {
  const now = new Date();

  if (filter.operator === 'AND' || filter.operator === 'OR') {
    const sets = await Promise.all(filter.filters.map(f => _resolve(f, clubId)));
    if (filter.operator === 'AND') {
      if (sets.length === 0) return [];
      // Intersection: users present in all sets
      const idSets = sets.map(s => new Set(s.map(u => u.id)));
      return sets[0].filter(u => idSets.every(s => s.has(u.id)));
    } else {
      // Union
      const all = sets.flat();
      const seen = new Set();
      return all.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    }
  }

  const baseWhere = { clubId, isArchived: false, email: { not: null } };

  switch (filter.type) {
    case 'all':
      return prisma.user.findMany({ where: baseWhere, select: { id: true, email: true, firstName: true } });

    case 'role':
      return prisma.user.findMany({
        where: { ...baseWhere, role: filter.role },
        select: { id: true, email: true, firstName: true },
      });

    case 'session': {
      const bookings = await prisma.booking.findMany({
        where: { sessionInstanceId: filter.instanceId, status: 'CONFIRMED' },
        select: { user: { select: { id: true, email: true, firstName: true, clubId: true, isArchived: true } } },
      });
      return bookings
        .map(b => b.user)
        .filter(u => u.clubId === clubId && !u.isArchived && u.email);
    }

    case 'active_membership': {
      const memberships = await prisma.membership.findMany({
        where: { clubId, status: { in: ['ACTIVE', 'SCHEDULED'] } },
        include: { gymnast: { include: { guardians: { where: { isArchived: false }, select: { id: true, email: true, firstName: true } } } } },
      });
      const users = memberships.flatMap(m => m.gymnast.guardians);
      const seen = new Set();
      return users.filter(u => { if (!u.email || seen.has(u.id)) return false; seen.add(u.id); return true; });
    }

    case 'expiring_credits': {
      const cutoff = new Date(now.getTime() + (filter.withinDays || 30) * 24 * 60 * 60 * 1000);
      const credits = await prisma.credit.findMany({
        where: {
          usedAt: null,
          expiresAt: { lte: cutoff, gt: now },
          user: { clubId, isArchived: false },
        },
        select: { user: { select: { id: true, email: true, firstName: true } } },
      });
      const users = credits.map(c => c.user).filter(u => u.email);
      const seen = new Set();
      return users.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
    }

    case 'no_upcoming_bookings': {
      const cutoff = new Date(now.getTime() + (filter.withinDays || 30) * 24 * 60 * 60 * 1000);
      const usersWithBookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          sessionInstance: { date: { gte: now, lte: cutoff } },
          user: { clubId, isArchived: false },
        },
        select: { userId: true },
      });
      const bookedIds = new Set(usersWithBookings.map(b => b.userId));
      const allUsers = await prisma.user.findMany({
        where: baseWhere,
        select: { id: true, email: true, firstName: true },
      });
      return allUsers.filter(u => !bookedIds.has(u.id));
    }

    case 'adhoc':
      return prisma.user.findMany({
        where: { id: { in: filter.userIds || [] }, clubId, isArchived: false, email: { not: null } },
        select: { id: true, email: true, firstName: true },
      });

    default:
      return [];
  }
}

module.exports = { resolveRecipients };
