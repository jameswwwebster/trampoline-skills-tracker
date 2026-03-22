const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/admin/payments?month=YYYY-MM
// Returns all paid charges and used credits for the club, optionally filtered to a month.
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { month } = req.query; // e.g. "2025-03"

    let dateFilter = {};
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const from = new Date(year, mon - 1, 1);
      const to = new Date(year, mon, 1);
      dateFilter = { gte: from, lt: to };
    }

    const [charges, credits] = await Promise.all([
      prisma.charge.findMany({
        where: {
          clubId: req.user.clubId,
          paidAt: { not: null, ...(month ? dateFilter : {}) },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.credit.findMany({
        where: {
          user: { clubId: req.user.clubId },
          usedAt: { not: null, ...(month ? dateFilter : {}) },
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
          usedOnCharge: { select: { description: true } },
          usedOnBooking: { select: { id: true } },
        },
        orderBy: { usedAt: 'desc' },
      }),
    ]);

    res.json({ charges, credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
