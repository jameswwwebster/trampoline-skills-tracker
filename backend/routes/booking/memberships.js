const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

const createMembershipSchema = Joi.object({
  gymnastId: Joi.string().required(),
  monthlyAmount: Joi.number().integer().min(1).required(), // in pence
  startDate: Joi.date().required(),
  stripeCustomerId: Joi.string().optional(),
});

// GET /api/booking/memberships — admin: all, parent: their gymnasts' memberships
router.get('/', auth, async (req, res) => {
  try {
    let where = { clubId: req.user.clubId };
    if (req.user.role === 'PARENT') {
      const myGymnasts = await prisma.gymnast.findMany({
        where: { guardians: { some: { id: req.user.id } } },
        select: { id: true },
      });
      where.gymnastId = { in: myGymnasts.map(g => g.id) };
    }
    const memberships = await prisma.membership.findMany({
      where,
      include: { gymnast: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships — admin only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = createMembershipSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    let stripeSubscriptionId = null;
    if (process.env.STRIPE_SECRET_KEY && value.stripeCustomerId) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const price = await stripe.prices.create({
        unit_amount: value.monthlyAmount,
        currency: 'gbp',
        recurring: { interval: 'month' },
        product_data: { name: `Trampoline Club Membership` },
      });
      const subscription = await stripe.subscriptions.create({
        customer: value.stripeCustomerId,
        items: [{ price: price.id }],
        billing_cycle_anchor: 'now',
      });
      stripeSubscriptionId = subscription.id;
    }

    const membership = await prisma.membership.create({
      data: {
        gymnastId: value.gymnastId,
        clubId: req.user.clubId,
        monthlyAmount: value.monthlyAmount,
        stripeSubscriptionId,
        status: 'ACTIVE',
        startDate: new Date(value.startDate),
      },
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.create', entityType: 'Membership', entityId: membership.id,
      metadata: { memberId: req.body.userId, type: membership.membershipType },
    });

    res.status(201).json(membership);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/memberships/:id — admin only (cancel/pause/update amount)
router.patch('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const allowed = ['status', 'monthlyAmount'];
    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const updated = await prisma.membership.update({
      where: { id: req.params.id },
      data,
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.update', entityType: 'Membership', entityId: req.params.id,
      metadata: req.body,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /memberships/:id — cancel a membership (soft delete via status update)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'CANCELLED' } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.delete', entityType: 'Membership', entityId: membership.id,
      metadata: { memberId: membership.userId, type: membership.membershipType },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel membership error:', err);
    res.status(500).json({ error: 'Failed to cancel membership' });
  }
});

module.exports = router;
