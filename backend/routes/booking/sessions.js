const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

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
        template: { is: { clubId } },
      },
      include: {
        template: true,
        bookings: {
          where: { status: 'CONFIRMED' },
          select: { userId: true, lines: { select: { id: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { template: { startTime: 'asc' } }],
    });

    const result = instances.map(instance => {
      const confirmedBookings = instance.bookings;
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
        isBooked: confirmedBookings.some(b => b.userId === req.user.id),
        pricePerGymnast: instance.template.pricePerGymnast,
        type: instance.template.type,
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
                    userId: true,
                    emergencyContactName: true, emergencyContactPhone: true, emergencyContactRelationship: true,
                    consents: true,
                  },
                },
              },
            },
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
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
      information: instance.template.information || null,
      capacity,
      bookedCount,
      availableSlots: Math.max(0, capacity - bookedCount),
      cancelledAt: instance.cancelledAt,
      type: instance.template.type,
      bookings: instance.bookings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:instanceId/cancel — cancel a session instance (staff only)
router.patch('/:instanceId/cancel', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.instanceId },
      include: { template: true },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.sessionInstance.update({
      where: { id: instance.id },
      data: { cancelledAt: new Date() },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'session.cancel', entityType: 'SessionInstance', entityId: instance.id,
      metadata: { date: instance.date, templateId: instance.templateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel session error:', err);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

module.exports = router;
