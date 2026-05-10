const express = require('express');
const Joi = require('joi');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = require('../../prisma');

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

    const result = await Promise.all(instances.map(async instance => {
      const confirmedBookings = instance.bookings;
      const bookingCount = confirmedBookings.reduce(
        (sum, b) => sum + b.lines.filter(l => !l.cancelledAt).length,
        0,
      );
      const sessionDate = new Date(instance.date);
      sessionDate.setUTCHours(0, 0, 0, 0);
      const absentGymnastIds = (await prisma.attendance.findMany({
        where: { sessionInstanceId: instance.id, status: 'ABSENT' },
        select: { gymnastId: true },
      })).map(a => a.gymnastId);
      const activeCommitments = await prisma.commitment.count({
        where: {
          templateId: instance.templateId,
          status: 'ACTIVE',
          OR: [{ startDate: null }, { startDate: { lte: sessionDate } }],
          ...(absentGymnastIds.length > 0 ? { gymnastId: { notIn: absentGymnastIds } } : {}),
        },
      });
      const bookedCount = bookingCount + activeCommitments;
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      return {
        id: instance.id,
        date: instance.date,
        startTime: instance.template.startTime,
        endTime: instance.template.endTime,
        minAge: instance.template.minAge,
        capacity,
        bookedCount,
        activeCommitments,
        availableSlots: Math.max(0, capacity - bookedCount),
        cancelledAt: instance.cancelledAt,
        isBooked: confirmedBookings.some(b => b.userId === req.user.id),
        pricePerGymnast: instance.template.pricePerGymnast,
        type: instance.template.type,
        templateId: instance.templateId,
      };
    }));

    // Filter DMT sessions for parents with no approved gymnasts
    let visibleResult = result;
    if (req.user.role === 'ADULT') {
      const myGymnasts = await prisma.gymnast.findMany({
        where: {
          clubId,
          OR: [
            { userId: req.user.id },
            { guardians: { some: { id: req.user.id } } },
          ],
        },
        select: { dmtApproved: true },
      });
      const hasDmtApproval = myGymnasts.some(g => g.dmtApproved);
      if (!hasDmtApproval) {
        visibleResult = result.filter(s => s.type !== 'DMT');
      }
    }

    res.json(visibleResult);
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

    const bookingCount = instance.bookings.reduce(
      (sum, b) => sum + b.lines.filter(l => !l.cancelledAt).length,
      0,
    );
    const sessionDate = new Date(instance.date);
    sessionDate.setUTCHours(0, 0, 0, 0);
    const absentGymnastIds = (await prisma.attendance.findMany({
      where: { sessionInstanceId: instance.id, status: 'ABSENT' },
      select: { gymnastId: true },
    })).map(a => a.gymnastId);
    const activeCommitments = await prisma.commitment.count({
      where: {
        templateId: instance.templateId,
        status: 'ACTIVE',
        OR: [{ startDate: null }, { startDate: { lte: sessionDate } }],
        ...(absentGymnastIds.length > 0 ? { gymnastId: { notIn: absentGymnastIds } } : {}),
      },
    });
    const bookedCount = bookingCount + activeCommitments;
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
      activeCommitments,
      availableSlots: Math.max(0, capacity - bookedCount),
      cancelledAt: instance.cancelledAt,
      pricePerGymnast: instance.template.pricePerGymnast,
      type: instance.template.type,
      templateId: instance.templateId,
      bookings: instance.bookings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:instanceId/cancel — cancel a single session instance.
// Mirrors the closure-period cascade for one instance: cancels bookings,
// issues per-line credits, drops register entries and any waitlist offers,
// and emails everyone affected. Requires a reason (audit + email content).
const cancelSessionSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).required(),
});

router.patch('/:instanceId/cancel', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = cancelSessionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const instance = await prisma.sessionInstance.findUnique({
      where: { id: req.params.instanceId },
      include: {
        template: { include: { club: { select: { emailEnabled: true } } } },
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            lines: { include: { gymnast: { select: { firstName: true, lastName: true } } } },
            user: { select: { id: true, email: true, firstName: true } },
          },
        },
        waitlistEntries: {
          where: { status: { in: ['WAITING', 'OFFERED'] } },
          include: { user: { select: { id: true, email: true, firstName: true } } },
        },
      },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });
    if (instance.cancelledAt) return res.status(400).json({ error: 'Session is already cancelled' });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const now = new Date();

    // Build the cascade in a single transaction.
    const ops = [
      prisma.sessionInstance.update({
        where: { id: instance.id },
        data: { cancelledAt: now, cancellationReason: value.reason },
      }),
    ];

    let creditCount = 0;
    let totalCredited = 0;
    const affectedGymnastIds = new Set();
    for (const booking of instance.bookings) {
      const activeLines = booking.lines.filter(l => !l.cancelledAt);
      if (activeLines.length === 0) continue;
      ops.push(prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      }));
      ops.push(prisma.bookingLine.updateMany({
        where: { id: { in: activeLines.map(l => l.id) } },
        data: { cancelledAt: now },
      }));
      for (const line of activeLines) {
        affectedGymnastIds.add(line.gymnastId);
        ops.push(prisma.credit.create({
          data: {
            userId: booking.userId,
            amount: line.amount,
            expiresAt,
            sourceBookingId: booking.id,
          },
        }));
        creditCount++;
        totalCredited += line.amount;
      }
    }
    if (affectedGymnastIds.size > 0) {
      ops.push(prisma.attendance.deleteMany({
        where: {
          sessionInstanceId: instance.id,
          gymnastId: { in: [...affectedGymnastIds] },
        },
      }));
    }
    if (instance.waitlistEntries.length > 0) {
      ops.push(prisma.waitlistEntry.updateMany({
        where: { id: { in: instance.waitlistEntries.map(w => w.id) } },
        data: { status: 'EXPIRED' },
      }));
    }

    await prisma.$transaction(ops);

    // Emails are non-blocking — log on failure but don't fail the cancellation.
    if (instance.template.club?.emailEnabled) {
      const sessionDate = instance.date;
      const { startTime, endTime } = instance.template;
      for (const booking of instance.bookings) {
        const activeLines = booking.lines.filter(l => !l.cancelledAt);
        if (!booking.user?.email || activeLines.length === 0) continue;
        emailService.trySendSessionCancelled({
          email: booking.user.email,
          firstName: booking.user.firstName,
          sessionDate, startTime, endTime,
          reason: value.reason,
          creditAmount: activeLines.reduce((s, l) => s + l.amount, 0),
          gymnastNames: activeLines.map(l => `${l.gymnast.firstName} ${l.gymnast.lastName}`),
          isWaitlist: false,
        });
      }
      for (const w of instance.waitlistEntries) {
        if (!w.user?.email) continue;
        emailService.trySendSessionCancelled({
          email: w.user.email,
          firstName: w.user.firstName,
          sessionDate, startTime, endTime,
          reason: value.reason,
          creditAmount: 0,
          gymnastNames: [],
          isWaitlist: true,
        });
      }
    }

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'session.cancel', entityType: 'SessionInstance', entityId: instance.id,
      metadata: {
        date: instance.date,
        templateId: instance.templateId,
        reason: value.reason,
        affectedBookings: instance.bookings.length,
        creditCount,
        totalCredited,
        waitlistAffected: instance.waitlistEntries.length,
      },
    });

    res.json({
      success: true,
      affectedBookings: instance.bookings.length,
      creditCount,
      totalCredited,
      waitlistAffected: instance.waitlistEntries.length,
    });
  } catch (err) {
    console.error('Cancel session error:', err);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

module.exports = router;
