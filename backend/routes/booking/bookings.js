const express = require('express');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);
const { processWaitlist } = require('../../services/waitlistService');
const { audit } = require('../../services/auditLogService');
const emailService = require('../../services/emailService');
const { SHOP_PRODUCTS } = require('../../data/shopProducts');

const router = express.Router();
const prisma = require('../../prisma');

/**
 * Returns gymnasts blocked from booking due to BG number requirements.
 * Blocked if: no number + 2+ past/pending sessions or active membership,
 * status=INVALID, or PENDING with expired grace.
 * @param {string[]} gymnastIds
 * @param {Date} now
 * @param {Object} pendingCounts - optional map of { [gId]: countInThisBatch }
 */
async function checkBgNumbers(gymnastIds, now, pendingCounts = {}) {
  return (await Promise.all(
    gymnastIds.map(async (gId) => {
      const g = await prisma.gymnast.findUnique({
        where: { id: gId },
        select: {
          firstName: true, bgNumber: true, bgNumberStatus: true,
          bgNumberEnteredAt: true, bgNumberGraceDays: true,
        },
      });
      if (!g) return null;

      if (g.bgNumberStatus === 'INVALID') return g; // explicitly rejected
      if (g.bgNumberStatus === 'PENDING' && g.bgNumberEnteredAt && g.bgNumberGraceDays) {
        const graceMs = g.bgNumberGraceDays * 24 * 60 * 60 * 1000;
        if (now - new Date(g.bgNumberEnteredAt) > graceMs) return g; // grace expired
      }

      if (!g.bgNumber) {
        const pastCount = await prisma.bookingLine.count({
          where: {
            gymnastId: gId,
            booking: { status: 'CONFIRMED', sessionInstance: { date: { lte: now } } },
          },
        });
        const pending = pendingCounts[gId] || 0;
        const hasMembership = await prisma.membership.count({
          where: { gymnastId: gId, status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED'] } },
        }) > 0;
        if (pastCount + pending >= 2 || hasMembership) return g;
      }

      return null;
    })
  )).filter(Boolean);
}


const createBookingSchema = Joi.object({
  sessionInstanceId: Joi.string().required(),
  gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
});

const batchBookingSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    sessionInstanceId: Joi.string().required(),
    gymnastIds: Joi.array().items(Joi.string()).min(1).required(),
  })).min(1).unique('sessionInstanceId').required(),
});

// POST /api/booking/bookings
// Create a booking + Stripe Payment Intent
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = createBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { sessionInstanceId, gymnastIds } = value;

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

    // Prevent booking after the session has started
    const [sh0, sm0] = instance.template.startTime.split(':').map(Number);
    const sessionStart0 = new Date(instance.date);
    sessionStart0.setHours(sh0, sm0, 0, 0);
    if (new Date() >= sessionStart0) {
      return res.status(400).json({ error: 'Bookings are not allowed after a session has started' });
    }

    // Prevent duplicate booking for the same gymnast
    const alreadyBooked = await prisma.bookingLine.findMany({
      where: {
        gymnastId: { in: gymnastIds },
        booking: { sessionInstanceId, status: 'CONFIRMED' },
      },
      include: { gymnast: { select: { firstName: true } } },
    });
    if (alreadyBooked.length > 0) {
      const names = alreadyBooked.map(l => l.gymnast.firstName).join(', ');
      return res.status(400).json({ error: `Already booked: ${names}` });
    }

    // Check availability — bypass if user has an active OFFERED waitlist entry
    const offeredEntry = await prisma.waitlistEntry.findFirst({
      where: { sessionInstanceId, userId: req.user.id, status: 'OFFERED' },
    });

    if (!offeredEntry) {
      const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
      const activeCommitments = await prisma.commitment.count({
        where: { templateId: instance.templateId, status: 'ACTIVE' },
      });
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      if (bookedCount + activeCommitments + gymnastIds.length > capacity) {
        return res.status(400).json({ error: 'Not enough slots available' });
      }
    }

    const now = new Date();
    const blockedByBg = await checkBgNumbers(gymnastIds, now);
    if (blockedByBg.length > 0) {
      const names = blockedByBg.map(g => g.firstName).join(', ');
      return res.status(400).json({
        error: `British Gymnastics membership number required for: ${names}. Please add or update it in My Account.`,
        code: 'BG_NUMBER_REQUIRED',
      });
    }

    // Overdue charge guard — block booking if parent has any overdue unpaid charge
    const overdueCharge = await prisma.charge.findFirst({
      where: { userId: req.user.id, paidAt: null, dueDate: { lt: new Date() } },
    });
    if (overdueCharge) {
      return res.status(400).json({ error: 'You have an overdue charge. Please pay it before making new bookings.' });
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

    // DMT approval check
    if (instance.template.type === 'DMT') {
      const gymnastsToCheck = await prisma.gymnast.findMany({
        where: { id: { in: gymnastIds } },
        select: { id: true, firstName: true, dmtApproved: true },
      });
      const blocked = gymnastsToCheck.filter(g => !g.dmtApproved);
      if (blocked.length > 0) {
        return res.status(400).json({
          error: `The following gymnasts are not approved for DMT: ${blocked.map(g => g.firstName).join(', ')}`,
        });
      }
    }

    // Commitment block check — gymnasts with an ACTIVE standing slot cannot book the same session
    const committedGymnasts = await prisma.commitment.findMany({
      where: { gymnastId: { in: gymnastIds }, templateId: instance.templateId, status: 'ACTIVE' },
      include: { gymnast: { select: { firstName: true } } },
    });
    if (committedGymnasts.length > 0) {
      const names = committedGymnasts.map(c => c.gymnast.firstName).join(', ');
      return res.status(400).json({
        error: `The following gymnasts already have a standing slot for this session: ${names}`,
      });
    }

    // Time-overlap conflict check — cannot book two sessions that run at the same time
    const sameDayLines = await prisma.bookingLine.findMany({
      where: {
        gymnastId: { in: gymnastIds },
        booking: {
          status: 'CONFIRMED',
          sessionInstance: { date: instance.date, id: { not: sessionInstanceId } },
        },
      },
      include: {
        gymnast: { select: { firstName: true } },
        booking: { include: { sessionInstance: { include: { template: { select: { startTime: true, endTime: true } } } } } },
      },
    });
    const timeConflicts = sameDayLines.filter(line => {
      const { startTime, endTime } = line.booking.sessionInstance.template;
      return instance.template.startTime < endTime && startTime < instance.template.endTime;
    });
    if (timeConflicts.length > 0) {
      const names = [...new Set(timeConflicts.map(l => l.gymnast.firstName))].join(', ');
      return res.status(400).json({
        error: `The following gymnasts already have a booking that overlaps with this session's time: ${names}`,
      });
    }

    // Verify parent owns these gymnasts
    if (req.user.role === 'ADULT') {
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

    const totalAmount = instance.template.pricePerGymnast * gymnastIds.length;

    // Auto-apply available credits (oldest first), only consuming what's needed
    const availableCredits = await prisma.credit.findMany({
      where: { userId: req.user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    let remaining = totalAmount;
    let creditsToUse = []; // { id, consume, remainder, expiresAt }
    for (const credit of availableCredits) {
      if (remaining <= 0) break;
      const consume = Math.min(credit.amount, remaining);
      remaining -= consume;
      creditsToUse.push({ id: credit.id, consume, remainder: credit.amount - consume, expiresAt: credit.expiresAt });
    }

    const chargeAmount = Math.max(0, remaining);

    // Cancel any stale PENDING bookings from this user for this session
    // (happens when a user abandons checkout and re-initiates)
    const stalePending = await prisma.booking.findMany({
      where: { userId: req.user.id, sessionInstanceId, status: 'PENDING' },
      include: { lines: true },
    });
    for (const stale of stalePending) {
      // Release any credits held against the stale booking
      await prisma.credit.updateMany({
        where: { usedOnBookingId: stale.id },
        data: { usedAt: null, usedOnBookingId: null },
      });
      await prisma.booking.update({ where: { id: stale.id }, data: { status: 'CANCELLED' } });
    }

    // Create Stripe Payment Intent if there's a balance to charge
    let paymentIntentId = null;
    let clientSecret = null;

    if (chargeAmount > 0) {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: chargeAmount,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        metadata: {
          sessionInstanceId,
          userId: req.user.id,
          gymnastIds: gymnastIds.join(','),
        },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    // Create booking + mark credits used atomically to prevent double-spending
    let booking;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Re-verify credits are still unused (guards against concurrent requests)
        if (creditsToUse.length > 0) {
          const stillAvailable = await tx.credit.findMany({
            where: { id: { in: creditsToUse.map(c => c.id) }, usedAt: null },
          });
          if (stillAvailable.length !== creditsToUse.length) {
            const err = new Error('One or more credits were already used by another request.');
            err.status = 409;
            throw err;
          }
        }

        const newBooking = await tx.booking.create({
          data: {
            userId: req.user.id,
            sessionInstanceId,
            stripePaymentIntentId: paymentIntentId,
            status: chargeAmount === 0 ? 'CONFIRMED' : 'PENDING',
            totalAmount,
            lines: {
              create: gymnastIds.map(id => ({
                gymnastId: id,
                amount: instance.template.pricePerGymnast,
              })),
            },
          },
          include: { lines: true },
        });

        // Mark credits as used — set amount to what was consumed, create remainder credit if any
        for (const c of creditsToUse) {
          await tx.credit.update({
            where: { id: c.id },
            data: { amount: c.consume, usedAt: new Date(), usedOnBookingId: newBooking.id },
          });
          if (c.remainder > 0) {
            await tx.credit.create({
              data: { userId: req.user.id, amount: c.remainder, expiresAt: c.expiresAt },
            });
          }
        }

        return newBooking;
      });
    } catch (txErr) {
      // If the Stripe intent was already created, void it so the user isn't charged
      if (paymentIntentId) {
        await getStripe().paymentIntents.cancel(paymentIntentId).catch(() => {});
      }
      const status = txErr.status || 500;
      return res.status(status).json({ error: txErr.message || 'Booking failed.' });
    }

    if (chargeAmount === 0) {
      emailService.trySendBookingReceipt(req.user.id, [booking.id], prisma);
    }

    // If user had an OFFERED waitlist entry, mark it CLAIMED and expire others atomically
    if (offeredEntry) {
      await prisma.$transaction([
        prisma.waitlistEntry.update({
          where: { id: offeredEntry.id },
          data: { status: 'CLAIMED' },
        }),
        prisma.waitlistEntry.updateMany({
          where: { sessionInstanceId, status: 'OFFERED', id: { not: offeredEntry.id } },
          data: { status: 'EXPIRED' },
        }),
      ]);
      // Cascade to next WAITING person if any
      processWaitlist(sessionInstanceId).catch(err => console.error('Waitlist cascade failed:', err));
    }

    res.json({ booking, clientSecret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/bookings/batch
// Create multiple bookings with a single Stripe PaymentIntent
router.post('/batch', auth, async (req, res) => {
  try {
    const { error, value } = batchBookingSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { items } = value;
    const now = new Date();

    // ── BG number check across all items at once ──
    const allBatchGymnastIds = [...new Set(items.flatMap(i => i.gymnastIds))];
    const pendingCounts = {};
    for (const item of items) {
      for (const gId of item.gymnastIds) {
        pendingCounts[gId] = (pendingCounts[gId] || 0) + 1;
      }
    }
    const blockedByBg = await checkBgNumbers(allBatchGymnastIds, now, pendingCounts);
    if (blockedByBg.length > 0) {
      return res.status(400).json({
        error: `British Gymnastics membership number required for: ${blockedByBg.map(g => g.firstName).join(', ')}. Please add or update it in My Account.`,
        code: 'BG_NUMBER_REQUIRED',
      });
    }

    // Overdue charge guard
    const overdueChargeBatch = await prisma.charge.findFirst({
      where: { userId: req.user.id, paidAt: null, dueDate: { lt: new Date() } },
    });
    if (overdueChargeBatch) {
      return res.status(400).json({ error: 'You have an overdue charge. Please pay it before making new bookings.' });
    }

    // ── Validate all items before creating anything ──
    const validatedItems = [];
    for (const item of items) {
      const { sessionInstanceId, gymnastIds } = item;

      const instance = await prisma.sessionInstance.findUnique({
        where: { id: sessionInstanceId },
        include: {
          template: true,
          bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } },
        },
      });
      if (!instance) return res.status(404).json({ error: `Session ${sessionInstanceId} not found` });
      if (instance.cancelledAt) return res.status(400).json({ error: 'A session in your cart is cancelled' });
      if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

      // Prevent booking after the session has started
      const [sh, sm] = instance.template.startTime.split(':').map(Number);
      const sessionStart = new Date(instance.date);
      sessionStart.setHours(sh, sm, 0, 0);
      if (now >= sessionStart) {
        return res.status(400).json({ error: 'Bookings are not allowed after a session has started' });
      }

      // Prevent duplicate booking for the same gymnast
      const alreadyBookedBatch = await prisma.bookingLine.findMany({
        where: {
          gymnastId: { in: gymnastIds },
          booking: { sessionInstanceId, status: 'CONFIRMED' },
        },
        include: { gymnast: { select: { firstName: true } } },
      });
      if (alreadyBookedBatch.length > 0) {
        const names = alreadyBookedBatch.map(l => l.gymnast.firstName).join(', ');
        return res.status(400).json({ error: `Already booked: ${names}` });
      }

      const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
      const activeCommitmentsCount = await prisma.commitment.count({
        where: { templateId: instance.templateId, status: 'ACTIVE' },
      });
      const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
      if (bookedCount + activeCommitmentsCount + gymnastIds.length > capacity) {
        return res.status(400).json({ error: `Not enough slots available for session at ${instance.date} ${instance.template.startTime}` });
      }

      // Age restriction check
      if (instance.template.minAge) {
        const gymnasts = await prisma.gymnast.findMany({ where: { id: { in: gymnastIds } } });
        const instanceDate = new Date(instance.date);
        for (const g of gymnasts) {
          if (g.dateOfBirth) {
            const age = Math.floor((instanceDate - new Date(g.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age < instance.template.minAge) {
              return res.status(400).json({ error: `${g.firstName} does not meet the minimum age requirement for this session` });
            }
          }
        }
      }

      // DMT approval check
      if (instance.template.type === 'DMT') {
        const gymnastsToCheck = await prisma.gymnast.findMany({
          where: { id: { in: gymnastIds } },
          select: { id: true, firstName: true, dmtApproved: true },
        });
        const blocked = gymnastsToCheck.filter(g => !g.dmtApproved);
        if (blocked.length > 0) {
          return res.status(400).json({
            error: `The following gymnasts are not approved for DMT: ${blocked.map(g => g.firstName).join(', ')}`,
          });
        }
      }

      // Commitment block check
      const committedInBatch = await prisma.commitment.findMany({
        where: { gymnastId: { in: gymnastIds }, templateId: instance.templateId, status: 'ACTIVE' },
        include: { gymnast: { select: { firstName: true } } },
      });
      if (committedInBatch.length > 0) {
        const names = committedInBatch.map(c => c.gymnast.firstName).join(', ');
        return res.status(400).json({
          error: `The following gymnasts already have a standing slot for this session: ${names}`,
        });
      }

      // Time-overlap conflict check — check against existing DB bookings
      const sameDayLinesBatch = await prisma.bookingLine.findMany({
        where: {
          gymnastId: { in: gymnastIds },
          booking: {
            status: 'CONFIRMED',
            sessionInstance: { date: instance.date, id: { not: sessionInstanceId } },
          },
        },
        include: {
          gymnast: { select: { firstName: true } },
          booking: { include: { sessionInstance: { include: { template: { select: { startTime: true, endTime: true } } } } } },
        },
      });
      const timeConflictsBatch = sameDayLinesBatch.filter(line => {
        const { startTime, endTime } = line.booking.sessionInstance.template;
        return instance.template.startTime < endTime && startTime < instance.template.endTime;
      });
      if (timeConflictsBatch.length > 0) {
        const names = [...new Set(timeConflictsBatch.map(l => l.gymnast.firstName))].join(', ');
        return res.status(400).json({
          error: `The following gymnasts already have a booking that overlaps with this session's time: ${names}`,
        });
      }

      // Time-overlap conflict check — check against other sessions in this batch
      const withinBatchConflicts = validatedItems.filter(prev => {
        if (prev.date.getTime() !== new Date(instance.date).getTime()) return false;
        const overlaps = prev.startTime < instance.template.endTime && instance.template.startTime < prev.endTime;
        return overlaps && prev.gymnastIds.some(id => gymnastIds.includes(id));
      });
      if (withinBatchConflicts.length > 0) {
        const conflictingIds = new Set(withinBatchConflicts.flatMap(p => p.gymnastIds.filter(id => gymnastIds.includes(id))));
        const gymnasts = await prisma.gymnast.findMany({
          where: { id: { in: [...conflictingIds] } },
          select: { firstName: true },
        });
        return res.status(400).json({
          error: `The following gymnasts have overlapping sessions in your cart: ${gymnasts.map(g => g.firstName).join(', ')}`,
        });
      }

      // Parent ownership check
      if (req.user.role === 'ADULT') {
        const myGymnasts = await prisma.gymnast.findMany({
          where: { id: { in: gymnastIds }, guardians: { some: { id: req.user.id } } },
        });
        if (myGymnasts.length !== gymnastIds.length) {
          return res.status(403).json({ error: 'Access denied to one or more gymnasts' });
        }
      }

      validatedItems.push({
        sessionInstanceId,
        gymnastIds,
        date: new Date(instance.date),
        startTime: instance.template.startTime,
        endTime: instance.template.endTime,
        pricePerGymnast: instance.template.pricePerGymnast,
        itemAmount: instance.template.pricePerGymnast * gymnastIds.length,
      });
    }

    // ── Total and credits ──
    const totalAmount = validatedItems.reduce((sum, item) => sum + item.itemAmount, 0);

    const availableCredits = await prisma.credit.findMany({
      where: { userId: req.user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    let remaining = totalAmount;
    const creditsToUse = [];
    for (const credit of availableCredits) {
      if (remaining <= 0) break;
      const consume = Math.min(credit.amount, remaining);
      remaining -= consume;
      creditsToUse.push({ id: credit.id, consume, remainder: credit.amount - consume, expiresAt: credit.expiresAt });
    }
    const chargeAmount = Math.max(0, remaining);

    // ── Cancel stale PENDING bookings for all sessions ──
    for (const item of validatedItems) {
      const stalePending = await prisma.booking.findMany({
        where: { userId: req.user.id, sessionInstanceId: item.sessionInstanceId, status: 'PENDING' },
      });
      for (const stale of stalePending) {
        await prisma.credit.updateMany({ where: { usedOnBookingId: stale.id }, data: { usedAt: null, usedOnBookingId: null } });
        await prisma.booking.update({ where: { id: stale.id }, data: { status: 'CANCELLED' } });
      }
    }

    // ── Single Stripe PaymentIntent for the combined total ──
    let paymentIntentId = null;
    let clientSecret = null;
    if (chargeAmount > 0) {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: chargeAmount,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        metadata: { userId: req.user.id, batchSize: String(validatedItems.length) },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    // ── Create one booking per item, all sharing the same paymentIntentId ──
    const bookings = [];
    for (const item of validatedItems) {
      const booking = await prisma.booking.create({
        data: {
          userId: req.user.id,
          sessionInstanceId: item.sessionInstanceId,
          stripePaymentIntentId: paymentIntentId,
          status: chargeAmount === 0 ? 'CONFIRMED' : 'PENDING',
          totalAmount: item.itemAmount,
          lines: {
            create: item.gymnastIds.map(id => ({ gymnastId: id, amount: item.pricePerGymnast })),
          },
        },
        include: { lines: true },
      });
      bookings.push(booking);
    }

    // ── Mark credits as used (attached to first booking) ──
    for (const c of creditsToUse) {
      await prisma.credit.update({
        where: { id: c.id },
        data: { amount: c.consume, usedAt: new Date(), usedOnBookingId: bookings[0].id },
      });
      if (c.remainder > 0) {
        await prisma.credit.create({
          data: { userId: req.user.id, amount: c.remainder, expiresAt: c.expiresAt },
        });
      }
    }

    if (chargeAmount === 0) {
      emailService.trySendBookingReceipt(req.user.id, bookings.map(b => b.id), prisma);
    }

    res.json({ bookings, clientSecret });
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

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'booking.create', entityType: 'Booking', entityId: booking.id,
      metadata: { memberId: booking.userId, instanceId: value.sessionInstanceId },
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
        ...booking.lines.map((line) =>
          prisma.credit.create({
            data: {
              userId: booking.userId,
              amount: line.amount,
              expiresAt,
              sourceBookingId: booking.id,
            },
          })
        ),
      ]);
    }

    // Free slot — offer to next person on waitlist (non-critical; don't fail the cancellation)
    processWaitlist(booking.sessionInstanceId).catch(err => console.error('Waitlist processing failed:', err));

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'booking.cancel', entityType: 'Booking', entityId: booking.id,
      metadata: { memberId: booking.userId, issueCredit: req.body.issueCredit || false },
    });

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

// POST /api/booking/bookings/combined
// Single checkout for booking sessions + shop items with one Stripe PaymentIntent
router.post('/combined', auth, async (req, res) => {
  try {
    const { sessions = [], shopItems = [] } = req.body;

    const now = new Date();

    // ── Fetch outstanding charges ──
    const outstandingCharges = await prisma.charge.findMany({
      where: { userId: req.user.id, clubId: req.user.clubId, paidAt: null },
    });
    const chargeTotal = outstandingCharges.reduce((s, c) => s + c.amount, 0);
    const outstandingChargeIds = outstandingCharges.map(c => c.id);

    // Empty cart guard (now includes charges)
    if (sessions.length === 0 && shopItems.length === 0 && chargeTotal === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // ── Validate sessions ──
    const validatedSessions = [];
    if (sessions.length > 0) {
      const allGymnastIds = [...new Set(sessions.flatMap(s => s.gymnastIds))];
      const pendingCounts = {};
      for (const s of sessions) {
        for (const gId of s.gymnastIds) {
          pendingCounts[gId] = (pendingCounts[gId] || 0) + 1;
        }
      }
      const blockedByBg = await checkBgNumbers(allGymnastIds, now, pendingCounts);
      if (blockedByBg.length > 0) {
        return res.status(400).json({
          error: `British Gymnastics membership number required for: ${blockedByBg.map(g => g.firstName).join(', ')}. Please add or update it in My Account.`,
          code: 'BG_NUMBER_REQUIRED',
        });
      }

      for (const item of sessions) {
        const { sessionInstanceId, gymnastIds } = item;
        const instance = await prisma.sessionInstance.findUnique({
          where: { id: sessionInstanceId },
          include: { template: true, bookings: { where: { status: 'CONFIRMED' }, include: { lines: true } } },
        });
        if (!instance) return res.status(404).json({ error: `Session ${sessionInstanceId} not found` });
        if (instance.cancelledAt) return res.status(400).json({ error: 'A session in your cart is cancelled' });
        if (instance.template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

        const [shC, smC] = instance.template.startTime.split(':').map(Number);
        const sessionStartC = new Date(instance.date);
        sessionStartC.setHours(shC, smC, 0, 0);
        if (now >= sessionStartC) {
          return res.status(400).json({ error: 'Bookings are not allowed after a session has started' });
        }

        // Prevent duplicate booking for the same gymnast
        const alreadyBookedCombined = await prisma.bookingLine.findMany({
          where: {
            gymnastId: { in: gymnastIds },
            booking: { sessionInstanceId, status: 'CONFIRMED' },
          },
          include: { gymnast: { select: { firstName: true } } },
        });
        if (alreadyBookedCombined.length > 0) {
          const names = alreadyBookedCombined.map(l => l.gymnast.firstName).join(', ');
          return res.status(400).json({ error: `Already booked: ${names}` });
        }

        const bookedCount = instance.bookings.reduce((sum, b) => sum + b.lines.length, 0);
        const activeCommitmentsCount = await prisma.commitment.count({
          where: { templateId: instance.templateId, status: 'ACTIVE' },
        });
        const capacity = instance.openSlotsOverride ?? instance.template.openSlots;
        if (bookedCount + activeCommitmentsCount + gymnastIds.length > capacity) {
          return res.status(400).json({ error: `Not enough slots for session at ${instance.date} ${instance.template.startTime}` });
        }

        if (instance.template.minAge) {
          const gymnasts = await prisma.gymnast.findMany({ where: { id: { in: gymnastIds } } });
          const instanceDate = new Date(instance.date);
          for (const g of gymnasts) {
            if (g.dateOfBirth) {
              const age = Math.floor((instanceDate - new Date(g.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
              if (age < instance.template.minAge) {
                return res.status(400).json({ error: `${g.firstName} does not meet the minimum age requirement` });
              }
            }
          }
        }

        if (req.user.role === 'ADULT') {
          const myGymnasts = await prisma.gymnast.findMany({
            where: { id: { in: gymnastIds }, guardians: { some: { id: req.user.id } } },
          });
          if (myGymnasts.length !== gymnastIds.length) {
            return res.status(403).json({ error: 'Access denied to one or more gymnasts' });
          }
        }

        // DMT approval check
        if (instance.template.type === 'DMT') {
          const gymnastsToCheck = await prisma.gymnast.findMany({
            where: { id: { in: gymnastIds } },
            select: { id: true, firstName: true, dmtApproved: true },
          });
          const blocked = gymnastsToCheck.filter(g => !g.dmtApproved);
          if (blocked.length > 0) {
            return res.status(400).json({
              error: `The following gymnasts are not approved for DMT: ${blocked.map(g => g.firstName).join(', ')}`,
            });
          }
        }

        // Commitment block check
        const committedInCombined = await prisma.commitment.findMany({
          where: { gymnastId: { in: gymnastIds }, templateId: instance.templateId, status: 'ACTIVE' },
          include: { gymnast: { select: { firstName: true } } },
        });
        if (committedInCombined.length > 0) {
          const names = committedInCombined.map(c => c.gymnast.firstName).join(', ');
          return res.status(400).json({
            error: `The following gymnasts already have a standing slot for this session: ${names}`,
          });
        }

        // Time-overlap conflict check — check against existing DB bookings
        const sameDayLinesCombined = await prisma.bookingLine.findMany({
          where: {
            gymnastId: { in: gymnastIds },
            booking: {
              status: 'CONFIRMED',
              sessionInstance: { date: instance.date, id: { not: sessionInstanceId } },
            },
          },
          include: {
            gymnast: { select: { firstName: true } },
            booking: { include: { sessionInstance: { include: { template: { select: { startTime: true, endTime: true } } } } } },
          },
        });
        const timeConflictsCombined = sameDayLinesCombined.filter(line => {
          const { startTime, endTime } = line.booking.sessionInstance.template;
          return instance.template.startTime < endTime && startTime < instance.template.endTime;
        });
        if (timeConflictsCombined.length > 0) {
          const names = [...new Set(timeConflictsCombined.map(l => l.gymnast.firstName))].join(', ');
          return res.status(400).json({
            error: `The following gymnasts already have a booking that overlaps with this session's time: ${names}`,
          });
        }

        // Time-overlap conflict check — check against other sessions in this cart
        const withinCartConflicts = validatedSessions.filter(prev => {
          if (prev.date.getTime() !== new Date(instance.date).getTime()) return false;
          const overlaps = prev.startTime < instance.template.endTime && instance.template.startTime < prev.endTime;
          return overlaps && prev.gymnastIds.some(id => gymnastIds.includes(id));
        });
        if (withinCartConflicts.length > 0) {
          const conflictingIds = new Set(withinCartConflicts.flatMap(p => p.gymnastIds.filter(id => gymnastIds.includes(id))));
          const gymnasts = await prisma.gymnast.findMany({
            where: { id: { in: [...conflictingIds] } },
            select: { firstName: true },
          });
          return res.status(400).json({
            error: `The following gymnasts have overlapping sessions in your cart: ${gymnasts.map(g => g.firstName).join(', ')}`,
          });
        }

        validatedSessions.push({ sessionInstanceId, gymnastIds, date: new Date(instance.date), startTime: instance.template.startTime, endTime: instance.template.endTime, pricePerGymnast: instance.template.pricePerGymnast, itemAmount: instance.template.pricePerGymnast * gymnastIds.length });
      }
    }

    // ── Validate shop items ──
    const validatedShopItems = [];
    let shopTotal = 0;
    for (const item of shopItems) {
      const product = SHOP_PRODUCTS.find(p => p.id === item.productId);
      if (!product) return res.status(400).json({ error: `Unknown product: ${item.productId}` });
      const variant = product.variants.find(v => v.label === item.size);
      if (!variant) return res.status(400).json({ error: `Unknown size "${item.size}" for "${item.productId}"` });
      const qty = parseInt(item.quantity, 10);
      if (!qty || qty < 1 || qty > 10) return res.status(400).json({ error: 'quantity must be between 1 and 10' });
      if (product.customisation?.required && !item.customisation?.trim()) {
        return res.status(400).json({ error: `customisation is required for ${product.name}` });
      }
      validatedShopItems.push({
        productId: product.id, productName: product.name, size: variant.label,
        quantity: qty, customisation: item.customisation?.trim() || null, price: variant.price,
      });
      shopTotal += variant.price * qty;
    }

    // ── Credits (applied to full grand total: sessions + shop + charges) ──
    const sessionTotal = validatedSessions.reduce((sum, s) => sum + s.itemAmount, 0);
    const grandTotal = sessionTotal + shopTotal + chargeTotal;
    const creditsToUse = [];
    if (grandTotal > 0) {
      const availableCredits = await prisma.credit.findMany({
        where: { userId: req.user.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'asc' },
      });
      let remaining = grandTotal;
      for (const credit of availableCredits) {
        if (remaining <= 0) break;
        const consume = Math.min(credit.amount, remaining);
        remaining -= consume;
        creditsToUse.push({ id: credit.id, consume, remainder: credit.amount - consume, expiresAt: credit.expiresAt });
      }
    }
    const creditAmount = creditsToUse.reduce((sum, c) => sum + c.consume, 0);
    const paymentAmount = Math.max(0, grandTotal - creditAmount);

    // ── Cancel stale PENDING session bookings ──
    for (const item of validatedSessions) {
      const stalePending = await prisma.booking.findMany({
        where: { userId: req.user.id, sessionInstanceId: item.sessionInstanceId, status: 'PENDING' },
      });
      for (const stale of stalePending) {
        await prisma.credit.updateMany({ where: { usedOnBookingId: stale.id }, data: { usedAt: null, usedOnBookingId: null } });
        await prisma.booking.update({ where: { id: stale.id }, data: { status: 'CANCELLED' } });
      }
    }

    // ── Clear stale paidOnPaymentIntentId on prior abandoned checkouts ──
    if (outstandingChargeIds.length > 0) {
      await prisma.charge.updateMany({
        where: { id: { in: outstandingChargeIds }, paidOnPaymentIntentId: { not: null } },
        data: { paidOnPaymentIntentId: null },
      });
    }

    // ── Stripe PaymentIntent ──
    let paymentIntentId = null;
    let clientSecret = null;
    if (paymentAmount > 0) {
      const paymentIntent = await getStripe().paymentIntents.create({
        amount: paymentAmount,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        metadata: { userId: req.user.id },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;

      // Tag outstanding charges with the PaymentIntent id
      if (outstandingChargeIds.length > 0) {
        await prisma.charge.updateMany({
          where: { id: { in: outstandingChargeIds } },
          data: { paidOnPaymentIntentId: paymentIntent.id },
        });
      }
    }

    // ── Create bookings ──
    const bookings = [];
    for (const item of validatedSessions) {
      const booking = await prisma.booking.create({
        data: {
          userId: req.user.id,
          sessionInstanceId: item.sessionInstanceId,
          stripePaymentIntentId: paymentIntentId,
          status: paymentIntentId ? 'PENDING' : 'CONFIRMED',
          totalAmount: item.itemAmount,
          lines: { create: item.gymnastIds.map(id => ({ gymnastId: id, amount: item.pricePerGymnast })) },
        },
        include: { lines: true },
      });
      bookings.push(booking);
    }

    // ── Mark credits ──
    for (const c of creditsToUse) {
      await prisma.credit.update({
        where: { id: c.id },
        data: { amount: c.consume, usedAt: new Date(), usedOnBookingId: bookings[0]?.id ?? null },
      });
      if (c.remainder > 0) {
        await prisma.credit.create({ data: { userId: req.user.id, amount: c.remainder, expiresAt: c.expiresAt } });
      }
    }

    // ── Settle charges immediately if no payment required ──
    if (paymentAmount === 0 && outstandingChargeIds.length > 0) {
      await prisma.charge.updateMany({
        where: { id: { in: outstandingChargeIds } },
        data: { paidAt: new Date() },
      });
    }

    // ── Create shop order ──
    let shopOrder = null;
    if (validatedShopItems.length > 0) {
      const shopStatus = paymentIntentId ? 'PENDING_PAYMENT' : 'ORDERED';
      shopOrder = await prisma.shopOrder.create({
        data: {
          userId: req.user.id,
          stripePaymentIntentId: paymentIntentId,
          total: shopTotal,
          status: shopStatus,
          items: { create: validatedShopItems },
        },
        include: { items: true },
      });

      if (shopStatus === 'ORDERED') {
        try {
          const shopEmailService = require('../../services/shopEmailService');
          const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, firstName: true, lastName: true, email: true },
          });
          await shopEmailService.sendOrderConfirmationEmail(user, shopOrder);
        } catch (emailErr) {
          console.error('Shop confirmation email failed:', emailErr.message);
        }
      }
    }

    res.json({
      clientSecret,
      bookingId: bookings[0]?.id || null,
      shopOrderId: shopOrder?.id || null,
    });
  } catch (err) {
    console.error('Combined checkout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
