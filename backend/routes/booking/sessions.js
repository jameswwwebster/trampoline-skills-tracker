const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/sessions?year=2026&month=3
// Returns all session instances for a calendar month with booking counts
router.get('/', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month query params required' });
    }

    const clubId = req.user.clubId;
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0); // last day of month

    const instances = await prisma.sessionInstance.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        template: { clubId },
      },
      include: {
        template: true,
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { lines: true },
        },
      },
      orderBy: [{ date: 'asc' }, { template: { startTime: 'asc' } }],
    });

    const result = instances.map(instance => {
      const confirmedBookings = instance.bookings.filter(b => b.status === 'CONFIRMED');
      const bookedCount = confirmedBookings.reduce((sum, b) => sum + b.lines.length, 0);
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      return {
        id: instance.id,
        date: instance.date,
        startTime: instance.template.startTime,
        endTime: instance.template.endTime,
        minAge: instance.template.minAge,
        capacity,
        bookedCount,
        availableSlots: Math.max(0, capacity - bookedCount),
        cancelledAt: instance.cancelledAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/sessions/:instanceId
// Returns a single session instance with full booking details
router.get('/:instanceId', auth, async (req, res) => {
  try {
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.instanceId },
      include: {
        template: true,
        bookings: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            lines: {
              include: {
                gymnast: {
                  select: {
                    id: true, firstName: true, lastName: true, dateOfBirth: true,
                    emergencyContactName: true, emergencyContactPhone: true, emergencyContactRelationship: true,
                  },
                },
              },
            },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!instance) return res.status(404).json({ error: 'Session not found' });

    // Ensure user belongs to same club
    if (instance.template.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
    const capacity = instance.openSlotsOverride ?? instance.template.openSlots;

    res.json({
      id: instance.id,
      date: instance.date,
      startTime: instance.template.startTime,
      endTime: instance.template.endTime,
      minAge: instance.template.minAge,
      capacity,
      bookedCount,
      availableSlots: Math.max(0, capacity - bookedCount),
      cancelledAt: instance.cancelledAt,
      bookings: instance.bookings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
