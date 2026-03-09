const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/memberships — admin: all; member: their gymnasts
router.get('/', auth, async (req, res) => {
  try {
    let where = { clubId: req.user.clubId };
    if (!['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
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

// GET /api/booking/memberships/my — member's own memberships (for My Account)
router.get('/my', auth, async (req, res) => {
  try {
    const myGymnasts = await prisma.gymnast.findMany({
      where: { guardians: { some: { id: req.user.id } } },
      select: { id: true },
    });
    const memberships = await prisma.membership.findMany({
      where: {
        gymnastId: { in: myGymnasts.map(g => g.id) },
        clubId: req.user.clubId,
        status: { not: 'CANCELLED' },
      },
      include: { gymnast: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(memberships);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/memberships/:id/client-secret — get clientSecret to re-show payment form
router.get('/:id/client-secret', auth, async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Not found' });

    // Authorization: must belong to caller's club, and non-admin must be a guardian of the gymnast
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });
    if (!['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
      const isGuardian = await prisma.gymnast.findFirst({
        where: { id: membership.gymnastId, guardians: { some: { id: req.user.id } } },
        select: { id: true },
      });
      if (!isGuardian) return res.status(403).json({ error: 'Access denied' });
    }

    if (!membership.stripeSubscriptionId) return res.status(400).json({ error: 'No subscription' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    });

    // New Stripe API: when no payment method is on file, Stripe creates a pending_setup_intent
    // on the subscription instead of a payment_intent on the invoice.
    const clientSecret =
      subscription.latest_invoice?.payment_intent?.client_secret ||
      subscription.pending_setup_intent?.client_secret;
    const intentType = subscription.pending_setup_intent?.client_secret ? 'setup' : 'payment';

    if (!clientSecret) return res.status(400).json({ error: 'No pending payment found for this membership' });
    res.json({ clientSecret, intentType });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships — admin/coach only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      gymnastId: Joi.string().required(),
      monthlyAmount: Joi.number().integer().min(1).required(),

      startDate: Joi.date().required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify gymnast belongs to this club
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: value.gymnastId },
      include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    if (!gymnast || gymnast.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check no active/pending membership already exists
    const existing = await prisma.membership.findFirst({
      where: { gymnastId: value.gymnastId, status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED'] } },
    });
    if (existing) return res.status(400).json({ error: 'Gymnast already has an active membership' });

    let stripeSubscriptionId = null;
    let clientSecret = null;

    if (process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const guardian = gymnast.guardians[0];

      if (!guardian) return res.status(400).json({ error: 'Gymnast has no guardian account to bill' });

      // Create or retrieve Stripe Customer for the guardian
      let stripeCustomerId = guardian.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: guardian.email,
          name: `${guardian.firstName} ${guardian.lastName}`,
          metadata: { userId: guardian.id },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: guardian.id },
          data: { stripeCustomerId },
        });
      }

      // billing_cycle_anchor = 1st of next calendar month (UTC)
      const now = new Date();
      const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const billingCycleAnchor = Math.floor(firstOfNextMonth.getTime() / 1000);

      const stripeProduct = await stripe.products.create({
        name: `Trampoline Life Membership — ${gymnast.firstName} ${gymnast.lastName}`,
      });

      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{
          price_data: {
            currency: 'gbp',
            product: stripeProduct.id,
            unit_amount: value.monthlyAmount,
            recurring: { interval: 'month' },
          },
        }],
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'create_prorations',
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: { clubId: req.user.clubId, gymnastId: value.gymnastId },
      });

      stripeSubscriptionId = subscription.id;
      clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
    }

    const membership = await prisma.membership.create({
      data: {
        gymnastId: value.gymnastId,
        clubId: req.user.clubId,
        monthlyAmount: value.monthlyAmount,
        stripeSubscriptionId,
        status: 'PENDING_PAYMENT',
        startDate: new Date(value.startDate),
      },
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.create', entityType: 'Membership', entityId: membership.id,
      metadata: { gymnastId: value.gymnastId, monthlyAmount: value.monthlyAmount },
    });

    const guardian = gymnast.guardians[0];
    if (guardian) {
      try {
        await emailService.sendMembershipCreatedEmail(
          guardian.email,
          guardian.firstName,
          gymnast,
          value.monthlyAmount,
        );
      } catch (emailErr) {
        console.error('Failed to send membership created email:', emailErr);
      }
    }

    res.status(201).json({ membership, clientSecret });
  } catch (err) {
    console.error('Create membership error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/booking/memberships/:id — pause, resume, update amount
router.patch('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const { status, monthlyAmount } = req.body;
    const data = {};

    if (monthlyAmount !== undefined) {
      const { error: amtErr, value: amtVal } = Joi.number().integer().min(1).validate(monthlyAmount);
      if (amtErr) return res.status(400).json({ error: 'monthlyAmount must be a positive integer (pence)' });
      data.monthlyAmount = amtVal;
    }

    if (status === 'PAUSED' && membership.status === 'ACTIVE') {
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.update(membership.stripeSubscriptionId, {
          pause_collection: { behavior: 'void' },
        });
      }
      data.status = 'PAUSED';
    } else if (status === 'ACTIVE' && membership.status === 'PAUSED') {
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.update(membership.stripeSubscriptionId, {
          pause_collection: null,
        });
      }
      data.status = 'ACTIVE';
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await prisma.membership.update({
      where: { id: req.params.id },
      data,
      include: { gymnast: true },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.update', entityType: 'Membership', entityId: req.params.id,
      metadata: { status: data.status, monthlyAmount: data.monthlyAmount },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/memberships/:id — cancel
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { id: req.params.id } });
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    if (membership.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
    }

    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'CANCELLED' } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.cancel', entityType: 'Membership', entityId: membership.id,
      metadata: { gymnastId: membership.gymnastId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel membership error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
