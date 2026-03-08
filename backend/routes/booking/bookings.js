const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);
const { processWaitlist } = require('../../services/waitlistService');

const router = express.Router();
const prisma = new PrismaClient();

const PRICE_PER_GYMNAST_PENCE = 600; // £6.00

const createBookingSchema = Joi.object({
  sessionInstanceId: Joi.string().required(),
  gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
  creditIds: Joi.array().items(Joi.string()).default([]),
});

// POST /api/booking/bookings
// Create a booking + Stripe Payment Intent
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = createBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { sessionInstanceId, gymnastIds, creditIds } = value;

    // Load session instance
    const instance = await prisma.sessionInstance.findUnique({
      where: { id: sessionInstanceId },
      include: {
        template: true,
        bookings: {
          where: { status: 'CONFIRMED' },
          include: { lines: true },
        },
      },
    });

    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.cancelledAt) return res.status(400).json({ error: 'Session is cancelled' });
    if (instance.template.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check availability
    const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
    const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
    if (bookedCount + gymnastIds.length > capacity) {
      return res.status(400).json({ error: 'Not enough slots available' });
    }

    // Check BG insurance requirement (after 2 past sessions)
    const now = new Date();
    const insuranceChecks = await Promise.all(
      gymnastIds.map(async (gId) => {
        const g = await prisma.gymnast.findUnique({
          where: { id: gId },
          select: { firstName: true, bgInsuranceConfirmed: true },
        });
        const pastCount = await prisma.bookingLine.count({
          where: {
            gymnastId: gId,
            booking: { status: 'CONFIRMED', sessionInstance: { date: { lte: now } } },
          },
        });
        return { ...g, pastCount };
      })
    );
    const needsInsurance = insuranceChecks.filter(g => g.pastCount >= 2 && !g.bgInsuranceConfirmed);
    if (needsInsurance.length > 0) {
      const names = needsInsurance.map(g => g.firstName).join(', ');
      return res.status(400).json({
        error: `British Gymnastics insurance confirmation required for: ${names}. Please confirm in My Account before booking.`,
        code: 'INSURANCE_REQUIRED',
      });
    }

    // Check age restriction
    if (instance.template.minAge) {
      const gymnasts = await prisma.gymnast.findMany({
        where: { id: { in: gymnastIds } },
      });
      const instanceDate = new Date(instance.date);
      for (const g of gymnasts) {
        if (g.dateOfBirth) {
          const ageMs = instanceDate - new Date(g.dateOfBirth);
          const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
          if (age < instance.template.minAge) {
            return res.status(400).json({
              error: `${g.firstName} does not meet the minimum age requirement for this session`,
            });
          }
        }
      }
    }

    // Verify parent owns these gymnasts
    if (req.user.role === 'PARENT') {
      const myGymnasts = await prisma.gymnast.findMany({
        where: {
          id: { in: gymnastIds },
          guardians: { some: { id: req.user.id } },
        },
      });
      if (myGymnasts.length !== gymnastIds.length) {
        return res.status(403).json({ error: 'Access denied to one or more gymnasts' });
      }
    }

    // Apply credits (oldest non-expired first)
    let creditsApplied = 0;
    let creditsUsed = [];
    if (creditIds.length > 0) {
      const credits = await prisma.credit.findMany({
        where: {
          id: { in: creditIds },
          userId: req.user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
      });
      creditsApplied = credits.reduce((sum, c) => sum + c.amount, 0);
      creditsUsed = credits;
    }

    const totalAmount = PRICE_PER_GYMNAST_PENCE * gymnastIds.length;
    const chargeAmount = Math.max(0, totalAmount - creditsApplied);

    // Create Stripe Payment Intent if there's a balance to charge
    let paymentIntentId = null;
    let clientSecret = null;

    if (chargeAmount > 0) {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: chargeAmount,
        currency: 'gbp',
        metadata: {
          sessionInstanceId,
          userId: req.user.id,
          gymnastIds: gymnastIds.join(','),
        },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    // Create booking (PENDING until webhook confirms, or CONFIRMED if no charge)
    const booking = await prisma.booking.create({
      data: {
        userId: req.user.id,
        sessionInstanceId,
        stripePaymentIntentId: paymentIntentId,
        status: chargeAmount === 0 ? 'CONFIRMED' : 'PENDING',
        totalAmount,
        lines: {
          create: gymnastIds.map(id => ({
            gymnastId: id,
            amount: PRICE_PER_GYMNAST_PENCE,
          })),
        },
      },
      include: { lines: true },
    });

    // Mark credits as used
    if (creditsUsed.length > 0) {
      await prisma.credit.updateMany({
        where: { id: { in: creditsUsed.map(c => c.id) } },
        data: { usedAt: new Date(), usedOnBookingId: booking.id },
      });
    }

    res.json({ booking, clientSecret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/bookings/my
// Returns the current user's upcoming bookings
router.get('/my', auth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user.id,
        status: { not: 'CANCELLED' },
        sessionInstance: { date: { gte: new Date() } },
      },
      include: {
        lines: { include: { gymnast: true } },
        sessionInstance: { include: { template: true } },
      },
      orderBy: { sessionInstance: { date: 'asc' } },
    });
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/bookings/admin-add
// Manually add gymnasts to a session, bypassing payment (coach/admin only)
router.post('/admin-add', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      sessionInstanceId: Joi.string().required(),
      gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
      userId: Joi.string().required(), // the account holder to attach booking to
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const instance = await prisma.sessionInstance.findUnique({
      where: { id: value.sessionInstanceId },
      include: {
        template: true,
        bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
      },
    });
    if (!instance) return res.status(404).json({ error: 'Session not found' });
    if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
    const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
    if (bookedCount + value.gymnastIds.length > capacity) {
      return res.status(400).json({ error: 'Not enough slots available' });
    }

    const booking = await prisma.booking.create({
      data: {
        userId: value.userId,
        sessionInstanceId: value.sessionInstanceId,
        status: 'CONFIRMED',
        totalAmount: 0,
        lines: { create: value.gymnastIds.map(id => ({ gymnastId: id, amount: 0 })) },
      },
      include: { lines: true },
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/bookings/:bookingId/cancel
// Cancel a booking and issue credits
router.post('/:bookingId/cancel', auth, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { lines: true, sessionInstance: { include: { template: true } } },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && !['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // Admins/coaches can explicitly override credit behaviour via `issueCredit`
    const isAdminAction = ['CLUB_ADMIN', 'COACH'].includes(req.user.role);
    const sessionDate = new Date(booking.sessionInstance.date);
    const today = new Date();
    const isToday =
      sessionDate.getFullYear() === today.getFullYear() &&
      sessionDate.getMonth() === today.getMonth() &&
      sessionDate.getDate() === today.getDate();

    // Determine whether to issue credits
    let issueCredit;
    if (isAdminAction && req.body.issueCredit !== undefined) {
      issueCredit = !!req.body.issueCredit;
    } else {
      issueCredit = !isToday;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (!issueCredit) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
    } else {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED' },
        }),
        ...booking.lines.map(() =>
          prisma.credit.create({
            data: {
              userId: booking.userId,
              amount: 600,
              expiresAt,
              sourceBookingId: booking.id,
            },
          })
        ),
      ]);
    }

    // Free slot — offer to next person on waitlist
    await processWaitlist(booking.sessionInstanceId);

    const creditMsg = issueCredit
      ? `Booking cancelled. ${booking.lines.length} credit(s) issued.`
      : 'Booking cancelled. No credit issued.';

    res.json({ message: creditMsg, creditsIssued: issueCredit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /bookings/:bookingId/refund — issue a Stripe refund (staff only)
router.post('/:bookingId/refund', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { audit } = require('../../services/auditLogService');
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { user: true },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });
    if (!booking.stripePaymentIntentId) return res.status(400).json({ error: 'No payment to refund' });

    const refund = await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'refund.issue', entityType: 'Booking', entityId: booking.id,
      metadata: { memberId: booking.userId, stripeRefundId: refund.id, amount: refund.amount },
    });

    res.json({ success: true, refundId: refund.id });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ error: err.message || 'Failed to issue refund' });
  }
});

module.exports = router;
