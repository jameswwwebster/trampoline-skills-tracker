const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');

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

// PATCH /api/booking/competition-entries/:id
router.patch('/:id', auth, async (req, res) => {
  const isAdmin = ADMIN_ROLES.includes(req.user.role);

  const adminSchema = Joi.object({
    coachConfirmed: Joi.boolean(),
    status: Joi.string().valid('INVITED', 'DECLINED'),
    categoryIds: Joi.array().items(Joi.string()),
  });
  const guardianSchema = Joi.object({
    categoryIds: Joi.array().items(Joi.string()).required(),
  });

  const { error, value } = (isAdmin ? adminSchema : guardianSchema).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: { competitionEvent: true },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });

    if (isAdmin) {
      if (entry.competitionEvent.clubId !== req.user.clubId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      const gymnast = await prisma.gymnast.findFirst({
        where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
      });
      if (!gymnast) return res.status(403).json({ error: 'Forbidden' });
      if (!['INVITED', 'PAYMENT_PENDING'].includes(entry.status)) {
        return res.status(400).json({ error: 'Entry cannot be modified after payment' });
      }
    }

    const updateData = {};
    if ('coachConfirmed' in value) updateData.coachConfirmed = value.coachConfirmed;
    if ('status' in value) updateData.status = value.status;

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
        competitionEvent: {
          include: { priceTiers: { orderBy: { entryNumber: 'asc' } } },
        },
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
router.post('/:id/checkout', auth, async (req, res) => {
  const { error, value } = Joi.object({
    categoryIds: Joi.array().items(Joi.string()).min(1).required(),
  }).validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const entry = await prisma.competitionEntry.findUnique({
      where: { id: req.params.id },
      include: {
        gymnast: true,
        competitionEvent: {
          include: {
            priceTiers: { orderBy: { entryNumber: 'asc' } },
            categories: true,
          },
        },
      },
    });
    if (!entry) return res.status(404).json({ error: 'Not found' });

    const gymnast = await prisma.gymnast.findFirst({
      where: { id: entry.gymnastId, guardians: { some: { id: req.user.id } } },
    });
    if (!gymnast) return res.status(403).json({ error: 'Forbidden' });

    if (!['INVITED', 'PAYMENT_PENDING'].includes(entry.status)) {
      return res.status(400).json({ error: 'Entry already paid or declined' });
    }

    const now = new Date();
    const isLate = now > new Date(entry.competitionEvent.entryDeadline);
    if (isLate && entry.competitionEvent.lateEntryFee === null) {
      return res.status(400).json({ error: 'Entry deadline has passed' });
    }

    const validCatIds = new Set(entry.competitionEvent.categories.map(c => c.id));
    for (const cid of value.categoryIds) {
      if (!validCatIds.has(cid)) {
        return res.status(400).json({ error: `Invalid category ${cid}` });
      }
    }

    const total = calculateEntryTotal(
      value.categoryIds.length,
      entry.competitionEvent.priceTiers,
      entry.competitionEvent.lateEntryFee,
      isLate
    );

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

    await prisma.competitionEntryCategory.deleteMany({ where: { entryId: entry.id } });
    await prisma.competitionEntryCategory.createMany({
      data: value.categoryIds.map(cid => ({ entryId: entry.id, categoryId: cid })),
    });
    await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: {
        status: 'PAYMENT_PENDING',
        totalAmount: total,
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.calculateEntryTotal = calculateEntryTotal;
