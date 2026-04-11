const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

/**
 * Calculates total entry cost based on price tiers.
 * @param {number} numCategories - how many categories selected
 * @param {Array<{entryNumber: number, price: number}>} tiers - price tiers
 * @param {number|null} lateEntryFee - in pence, or null
 * @param {boolean} isLate - whether current time is past the deadline
 * @returns {number} total in pence
 */
function calculateEntryTotal(numCategories, tiers, lateEntryFee, isLate) {
  const sorted = [...tiers].sort((a, b) => a.entryNumber - b.entryNumber);
  let total = 0;
  for (let i = 0; i < numCategories; i++) {
    const tierIndex = Math.min(i, sorted.length - 1);
    total += sorted[tierIndex].price;
  }
  if (isLate && lateEntryFee) total += lateEntryFee;
  return total;
}

async function getEntryWithEvent(id) {
  return prisma.competitionEntry.findUnique({
    where: { id },
    include: {
      competitionEvent: {
        include: {
          priceTiers: { orderBy: { entryNumber: 'asc' } },
          categories: true,
        },
      },
      gymnast: true,
      categories: { include: { category: true } },
    },
  });
}

// GET /api/booking/competition-entries/admin-summary (admin/coach only)
// Returns entries needing action across all club competitions
router.get('/admin-summary', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const entries = await prisma.competitionEntry.findMany({
      where: {
        status: { in: ['ACCEPTED', 'PAYMENT_PENDING'] },
        competitionEvent: { clubId: req.user.clubId },
      },
      include: {
        competitionEvent: { select: { id: true, name: true, startDate: true } },
        gymnast: { select: { firstName: true, lastName: true } },
      },
      orderBy: { competitionEvent: { startDate: 'asc' } },
      take: 20,
    });
    res.json({
      accepted: entries.filter(e => e.status === 'ACCEPTED'),
      paymentPending: entries.filter(e => e.status === 'PAYMENT_PENDING'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/competition-entries/mine
router.get('/mine', auth, async (req, res) => {
  try {
    const myGymnasts = await prisma.gymnast.findMany({
      where: { guardians: { some: { id: req.user.id } } },
      select: { id: true },
    });
    const gymnastIds = myGymnasts.map(g => g.id);

    const entries = await prisma.competitionEntry.findMany({
      where: { gymnastId: { in: gymnastIds } },
      include: {
        competitionEvent: {
          include: {
            categories: true,
            priceTiers: { orderBy: { entryNumber: 'asc' } },
          },
        },
        gymnast: true,
        categories: { include: { category: true } },
      },
      orderBy: { competitionEvent: { startDate: 'asc' } },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/competition-entries/:id (admin only — category/status edits)
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    coachConfirmed: Joi.boolean(),
    status: Joi.string().valid('INVITED', 'DECLINED'),
    categoryIds: Joi.array().items(Joi.string()),
    submittedToOrganiser: Joi.boolean(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = {};
    if ('coachConfirmed' in value) updateData.coachConfirmed = value.coachConfirmed;
    if ('status' in value) updateData.status = value.status;
    if ('submittedToOrganiser' in value) updateData.submittedToOrganiser = value.submittedToOrganiser;

    if (value.categoryIds !== undefined) {
      await prisma.competitionEntryCategory.deleteMany({ where: { entryId: entry.id } });
      if (value.categoryIds.length > 0) {
        await prisma.competitionEntryCategory.createMany({
          data: value.categoryIds.map(cid => ({ entryId: entry.id, categoryId: cid })),
        });
      }
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: updateData,
      include: {
        gymnast: true,
        categories: { include: { category: true } },
        competitionEvent: { include: { priceTiers: { orderBy: { entryNumber: 'asc' } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/accept (guardian)
router.post('/:id/accept', auth, async (req, res) => {
  const { error, value } = Joi.object({
    categoryIds: Joi.array().items(Joi.string()).min(1).required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await getEntryWithEvent(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const gymnast = await prisma.gymnast.findFirst({
      where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
    });
    if (!gymnast) return res.status(403).json({ error: 'Forbidden' });
    if (entry.status !== 'INVITED') {
      return res.status(400).json({ error: 'Entry has already been responded to' });
    }

    const validCatIds = new Set(entry.competitionEvent.categories.map(c => c.id));
    for (const cid of value.categoryIds) {
      if (!validCatIds.has(cid)) {
        return res.status(400).json({ error: `Invalid category ${cid}` });
      }
    }

    await prisma.competitionEntryCategory.deleteMany({ where: { entryId: entry.id } });
    await prisma.competitionEntryCategory.createMany({
      data: value.categoryIds.map(cid => ({ entryId: entry.id, categoryId: cid })),
    });
    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: { status: 'ACCEPTED' },
      include: {
        gymnast: true,
        categories: { include: { category: true } },
        competitionEvent: { include: { categories: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/decline (guardian)
router.post('/:id/decline', auth, async (req, res) => {
  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const gymnast = await prisma.gymnast.findFirst({
      where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
    });
    if (!gymnast) return res.status(403).json({ error: 'Forbidden' });
    if (!['INVITED', 'ACCEPTED'].includes(entry.status)) {
      return res.status(400).json({ error: 'Cannot decline at this stage' });
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: { status: 'DECLINED' },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/confirm-invoice (admin/coach)
// Coach reviews the accepted entry and sends the invoice to the guardian(s)
router.post('/:id/confirm-invoice', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    priceOverride: Joi.number().integer().min(0).optional(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await getEntryWithEvent(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (entry.status !== 'ACCEPTED') {
      return res.status(400).json({ error: 'Entry must be in ACCEPTED state to confirm' });
    }
    if (entry.categories.length === 0) {
      return res.status(400).json({ error: 'Entry has no categories selected' });
    }

    const now = new Date();
    const isLate = now > new Date(entry.competitionEvent.entryDeadline);

    let total;
    if (value.priceOverride !== undefined) {
      total = value.priceOverride;
    } else if (entry.adminPriceOverride !== null && entry.adminPriceOverride !== undefined) {
      total = entry.adminPriceOverride;
    } else {
      total = calculateEntryTotal(
        entry.categories.length,
        entry.competitionEvent.priceTiers,
        entry.competitionEvent.lateEntryFee,
        isLate
      );
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: {
        status: 'PAYMENT_PENDING',
        coachConfirmed: true,
        totalAmount: total,
        invoiceSentAt: now,
        adminPriceOverride: value.priceOverride !== undefined ? value.priceOverride : entry.adminPriceOverride,
      },
      include: {
        gymnast: true,
        categories: { include: { category: true } },
        competitionEvent: { include: { categories: true } },
      },
    });

    // Send invoice email to all guardians via the GuardianGymnasts M2M relation
    const gymnastwithGuardians = await prisma.gymnast.findUnique({
      where: { id: entry.gymnastId },
      include: { guardians: { select: { email: true, firstName: true, lastName: true } } },
    });
    const recipients = gymnastwithGuardians?.guardians ?? [];
    for (const guardian of recipients) {
      await emailService.sendCompetitionInvoice(
        guardian.email,
        guardian,
        updated.gymnast,
        updated.competitionEvent,
        updated.categories.map(ec => ec.category.name),
        total,
        updated.id
      );
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/resend-invoice (admin/coach)
router.post('/:id/resend-invoice', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const entry = await getEntryWithEvent(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (entry.status !== 'PAYMENT_PENDING') {
      return res.status(400).json({ error: 'Invoice can only be resent for entries awaiting payment' });
    }

    await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: { invoiceSentAt: new Date() },
    });

    const gWithGuardians = await prisma.gymnast.findUnique({
      where: { id: entry.gymnastId },
      include: { guardians: { select: { email: true, firstName: true, lastName: true } } },
    });
    for (const guardian of gWithGuardians?.guardians ?? []) {
      await emailService.sendCompetitionInvoice(
        guardian.email,
        guardian,
        entry.gymnast,
        entry.competitionEvent,
        entry.categories.map(ec => ec.category.name),
        entry.totalAmount,
        entry.id
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/waive (admin/coach)
router.post('/:id/waive', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    reason: Joi.string().max(500).optional().allow(''),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['PAID', 'DECLINED'].includes(entry.status)) {
      return res.status(400).json({ error: 'Cannot waive a paid or declined entry' });
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: {
        status: 'WAIVED',
        coachConfirmed: true,
        waivedReason: value.reason || null,
        totalAmount: 0,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/mark-paid (admin/coach)
// Records an external/offline payment
router.post('/:id/mark-paid', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { error, value } = Joi.object({
    amount: Joi.number().integer().min(0).optional(),
    note: Joi.string().max(500).optional().allow(''),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['PAID', 'DECLINED'].includes(entry.status)) {
      return res.status(400).json({ error: 'Entry is already paid or declined' });
    }

    const updated = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: {
        status: 'PAID',
        coachConfirmed: true,
        paidExternally: true,
        externalPaymentNote: value.note || null,
        totalAmount: value.amount !== undefined ? value.amount : entry.totalAmount,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/competition-entries/:id (admin only)
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.competitionEvent.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.competitionEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/competition-entries/:id/checkout
// Initiates Stripe payment for entries in PAYMENT_PENDING state
router.post('/:id/checkout', auth, async (req, res) => {
  try {
    const entry = await getEntryWithEvent(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const gymnast = await prisma.gymnast.findFirst({
      where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
    });
    if (!gymnast) return res.status(403).json({ error: 'Forbidden' });

    if (entry.status !== 'PAYMENT_PENDING') {
      return res.status(400).json({ error: 'Payment is not available for this entry' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const total = entry.totalAmount;

    const guardian = await prisma.user.findUnique({ where: { id: req.user.id } });
    let stripeCustomerId = guardian.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: guardian.email,
        name: `${guardian.firstName} ${guardian.lastName}`,
        metadata: { userId: guardian.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: guardian.id }, data: { stripeCustomerId } });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'gbp',
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        competitionEntryId: entry.id,
        competitionEventId: entry.competitionEventId,
        gymnastId: entry.gymnastId,
        clubId: entry.competitionEvent.clubId,
      },
      description: `Competition entry: ${entry.competitionEvent.name} — ${entry.gymnast.firstName} ${entry.gymnast.lastName}`,
    });

    await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    res.json({ clientSecret: paymentIntent.client_secret, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.calculateEntryTotal = calculateEntryTotal;
