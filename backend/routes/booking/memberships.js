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

// GET /api/booking/memberships/delinquent — admin: memberships awaiting payment setup
router.get('/delinquent', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { clubId: req.user.clubId, status: 'PENDING_PAYMENT' },
      include: {
        gymnast: {
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const now = new Date();
    const result = memberships.map(m => ({
      ...m,
      daysPending: Math.floor((now - new Date(m.createdAt)) / (1000 * 60 * 60 * 24)),
      guardian: m.gymnast.guardians[0] || null,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships/:id/remind — resend payment setup email to guardian
router.post('/:id/remind', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({
      where: { id: req.params.id },
      include: {
        gymnast: {
          include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
        },
      },
    });
    if (!membership || membership.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    if (membership.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ error: 'Membership is not awaiting payment' });
    }
    const guardian = membership.gymnast.guardians[0];
    if (!guardian) return res.status(400).json({ error: 'No guardian found' });

    await emailService.sendMembershipCreatedEmail(
      guardian.email,
      guardian.firstName,
      membership.gymnast,
      membership.monthlyAmount,
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
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
      expand: ['latest_invoice', 'pending_setup_intent'],
    });

    // Stripe API 2026-02-25.clover: invoices no longer have payment_intent.
    // Use the hosted_invoice_url instead to collect payment.
    const hostedUrl = subscription.latest_invoice?.hosted_invoice_url;
    if (!hostedUrl) return res.status(400).json({ error: 'No pending payment found for this membership' });
    res.json({ hostedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships/:id/setup-intent — create a SetupIntent to add a payment method
router.post('/:id/setup-intent', auth, async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({
      where: { id: req.params.id },
      include: { gymnast: { include: { guardians: { where: { id: req.user.id }, take: 1 } } } },
    });
    if (!membership || membership.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
      const isGuardian = await prisma.gymnast.findFirst({
        where: { id: membership.gymnastId, guardians: { some: { id: req.user.id } } },
        select: { id: true },
      });
      if (!isGuardian) return res.status(403).json({ error: 'Access denied' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Get the guardian's Stripe customer ID
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: membership.gymnastId },
      include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    const guardian = gymnast?.guardians[0];
    if (!guardian?.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer for this membership' });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: guardian.stripeCustomerId,
      usage: 'off_session',
      metadata: { membershipId: membership.id, subscriptionId: membership.stripeSubscriptionId || '' },
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/memberships/:id/confirm-payment-method — attach collected payment method to subscription
// Sets the PM as default on the Stripe customer and clears needsPaymentMethod on ALL of this guardian's memberships
router.post('/:id/confirm-payment-method', auth, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });

    const membership = await prisma.membership.findUnique({
      where: { id: req.params.id },
      include: { gymnast: { include: { guardians: { orderBy: { createdAt: 'asc' }, take: 1 } } } },
    });
    if (!membership || membership.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!['CLUB_ADMIN', 'COACH'].includes(req.user.role)) {
      const isGuardian = await prisma.gymnast.findFirst({
        where: { id: membership.gymnastId, guardians: { some: { id: req.user.id } } },
        select: { id: true },
      });
      if (!isGuardian) return res.status(403).json({ error: 'Access denied' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const guardian = membership.gymnast.guardians[0];

    // Set as default on the Stripe customer so it covers all their subscriptions
    if (guardian?.stripeCustomerId) {
      await stripe.customers.update(guardian.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Also set explicitly on this subscription in case it has its own override
    if (membership.stripeSubscriptionId) {
      await stripe.subscriptions.update(membership.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }

    // Clear needsPaymentMethod on ALL of this guardian's memberships
    if (guardian) {
      const guardianGymnasts = await prisma.gymnast.findMany({
        where: { guardians: { some: { id: guardian.id } } },
        select: { id: true },
      });
      await prisma.membership.updateMany({
        where: {
          gymnastId: { in: guardianGymnasts.map(g => g.id) },
          clubId: req.user.clubId,
          needsPaymentMethod: true,
        },
        data: { needsPaymentMethod: false },
      });
    } else {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { needsPaymentMethod: false },
      });
    }

    res.json({ ok: true });
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
    let membershipStatus = 'PENDING_PAYMENT';

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

      // Apply available credits as Stripe customer balance BEFORE creating the subscription.
      // Stripe automatically deducts this balance from the first invoice, avoiding the
      // invoice_not_editable error that occurs when trying to add items after creation.
      const availableCredits = await prisma.credit.findMany({
        where: { userId: guardian.id, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'asc' },
      });
      const totalCreditAmount = availableCredits.reduce((sum, c) => sum + c.amount, 0);

      if (totalCreditAmount > 0) {
        await stripe.customers.createBalanceTransaction(stripeCustomerId, {
          amount: -totalCreditAmount,
          currency: 'gbp',
          description: 'Session credits applied to first membership payment',
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
        expand: ['latest_invoice'],
        metadata: { clubId: req.user.clubId, gymnastId: value.gymnastId },
      });

      stripeSubscriptionId = subscription.id;

      // Calculate how much credit Stripe actually consumed against the first invoice.
      // total = invoice amount before balance; amount_due = what remains after balance applied.
      const firstInvoice = subscription.latest_invoice;
      const invoiceTotal = firstInvoice?.total ?? 0;
      const invoiceAmountDue = firstInvoice?.amount_due ?? 0;
      const creditsConsumed = Math.max(0, invoiceTotal - invoiceAmountDue);

      // Mark the consumed credits as used (oldest first, split if needed)
      if (creditsConsumed > 0) {
        let remaining = creditsConsumed;
        for (const credit of availableCredits) {
          if (remaining <= 0) break;
          if (credit.amount <= remaining) {
            await prisma.credit.update({ where: { id: credit.id }, data: { usedAt: new Date() } });
            remaining -= credit.amount;
          } else {
            // Partial consumption — split the credit record
            await prisma.credit.update({ where: { id: credit.id }, data: { amount: remaining, usedAt: new Date() } });
            await prisma.credit.create({
              data: {
                userId: guardian.id,
                amount: credit.amount - remaining,
                expiresAt: credit.expiresAt,
                sourceBookingId: credit.sourceBookingId,
              },
            });
            remaining = 0;
          }
        }
      }

      // If credits didn't fully cover unused balance we added, restore the remainder
      // by adding back a positive balance transaction so we don't over-credit the customer
      if (totalCreditAmount > creditsConsumed) {
        const unused = totalCreditAmount - creditsConsumed;
        await stripe.customers.createBalanceTransaction(stripeCustomerId, {
          amount: unused,
          currency: 'gbp',
          description: 'Unused session credit balance restored',
        });
      }

      // If the first invoice is fully covered, the subscription can go straight to active
      // but still needs a payment method for future renewals
      membershipStatus = invoiceAmountDue === 0 ? 'ACTIVE' : 'PENDING_PAYMENT';
    }

    const membership = await prisma.membership.create({
      data: {
        gymnastId: value.gymnastId,
        clubId: req.user.clubId,
        monthlyAmount: value.monthlyAmount,
        stripeSubscriptionId,
        status: membershipStatus,
        needsPaymentMethod: membershipStatus === 'ACTIVE',
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

    res.status(201).json({ membership });
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

      // Update Stripe subscription price if one exists
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
        const item = sub.items.data[0];
        if (item) {
          await stripe.subscriptions.update(membership.stripeSubscriptionId, {
            items: [{
              id: item.id,
              price_data: {
                currency: 'gbp',
                product: typeof item.price.product === 'string' ? item.price.product : item.price.product.id,
                unit_amount: amtVal,
                recurring: { interval: 'month' },
              },
            }],
          });
        }
      }
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
