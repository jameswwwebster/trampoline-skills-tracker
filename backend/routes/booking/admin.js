const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// DELETE /api/booking/admin/gymnasts/:id
// Remove a gymnast (child) — cleans up all booking data
router.delete('/gymnasts/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: req.params.id },
      include: { guardians: { select: { id: true } } },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });
    if (gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    if (await hasActiveMembership(gymnast.id)) {
      return res.status(400).json({ error: 'This gymnast has an active membership. Cancel it in Stripe before removing them.' });
    }

    await deleteGymnast(gymnast.id);

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'member.delete', entityType: 'Gymnast', entityId: gymnast.id,
      metadata: { name: `${gymnast.firstName} ${gymnast.lastName}` },
    });

    res.json({ message: 'Gymnast removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/admin/members/:userId
// Remove a member and all their gymnasts — cleans up all booking data
router.delete('/members/:userId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { deleteMember } = require('../../services/memberLifecycle');
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user || user.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (['CLUB_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return res.status(400).json({ error: 'Cannot delete admin accounts' });
    }
    await deleteMember(user.id, 'MANUAL', req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/audit-log/staff — list staff for filter dropdown (CLUB_ADMIN only)
router.get('/audit-log/staff', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        clubId: req.user.clubId,
        role: { in: ['CLUB_ADMIN', 'COACH'] },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    res.json(staff);
  } catch (err) {
    console.error('Fetch audit staff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// GET /admin/audit-log — paginated, filtered audit log (CLUB_ADMIN only)
router.get('/audit-log', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { page = '1', staffId, action, from, to } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = 25;
    const skip = (pageNum - 1) * pageSize;

    const where = {
      clubId: req.user.clubId,
      ...(staffId && { userId: staffId }),
      ...(action && { action }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      pageSize,
      hasMore: skip + logs.length < total,
    });
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

async function hasActiveMembership(gymnastId) {
  const m = await prisma.membership.findFirst({
    where: { gymnastId, status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED'] } },
  });
  return !!m;
}

async function deleteGymnast(gymnastId) {
  // Cancel active bookings and remove lines
  const bookings = await prisma.booking.findMany({
    where: { lines: { some: { gymnastId } } },
    include: { lines: { where: { gymnastId } } },
  });

  for (const b of bookings) {
    await prisma.bookingLine.deleteMany({ where: { bookingId: b.id, gymnastId } });
    // If booking has no more lines, delete it too
    const remaining = await prisma.bookingLine.count({ where: { bookingId: b.id } });
    if (remaining === 0) {
      await prisma.booking.delete({ where: { id: b.id } });
    }
  }

  await prisma.consent.deleteMany({ where: { gymnastId } });
  await prisma.membership.deleteMany({ where: { gymnastId } });
  await prisma.gymnast.delete({ where: { id: gymnastId } });
}

module.exports = router;
