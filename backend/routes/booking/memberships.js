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
      include: {
        gymnast: {
          include: {
            commitments: {
              where: { status: { not: 'WAITLISTED' } },
              include: {
                template: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true, type: true } },
              },
              orderBy: [{ template: { dayOfWeek: 'asc' } }, { template: { startTime: 'asc' } }],
            },
          },
        },
      },
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

// POST /api/booking/memberships/notify-scheduled — send "scheduled" email to all not-yet-notified SCHEDULED memberships
router.post('/notify-scheduled', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const memberships = await prisma.membership.findMany({
      where: { clubId: req.user.clubId, status: 'SCHEDULED', scheduledNotifiedAt: null },
      include: {
        gymnast: {
          include: { guardians: { select: { email: true, firstName: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    for (const m of memberships) {
      const guardian = m.gymnast.guardians[0];
      if (!guardian?.email) { skipped++; continue; }
      try {
        await emailService.sendMembershipScheduledEmail(
          guardian.email,
          guardian.firstName,
          m.gymnast,
          m.monthlyAmount,
          m.startDate,
        );
        await prisma.membership.update({
          where: { id: m.id },
          data: { scheduledNotifiedAt: new Date() },
        });
        sent++;
      } catch {
        skipped++;
      }
    }

    res.json({ sent, skipped });
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

    // Subscription was cancelled on Stripe (e.g. payment window expired)
    if (subscription.status === 'canceled') {
      if (membership.status !== 'CANCELLED') {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: 'CANCELLED' },
        });
      }
      return res.json({ subscriptionCancelled: true });
    }

    const invoice = subscription.latest_invoice;

    // If the invoice has already been paid (e.g. Stripe auto-charged when a sibling's
    // payment saved a default card to the customer), update our DB and tell the
    // frontend so it can refresh rather than redirect to a stale hosted URL.
    if (invoice?.status === 'paid') {
      if (membership.status !== 'ACTIVE') {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: 'ACTIVE', needsPaymentMethod: false },
        });
      }
      return res.json({ alreadyPaid: true });
    }

    // Stripe API 2026-02-25.clover: invoices no longer have payment_intent directly.
    // List invoice_payments to find the open PaymentIntent client secret.
    const invoicePayments = await stripe.invoicePayments.list({ invoice: invoice.id });
    const openPayment = invoicePayments.data.find(ip => ip.status === 'open');
    const piId = openPayment?.payment?.type === 'payment_intent'
      ? (typeof openPayment.payment.payment_intent === 'string'
          ? openPayment.payment.payment_intent
          : openPayment.payment.payment_intent?.id)
      : null;
    if (!piId) return res.status(400).json({ error: 'No pending payment found for this membership' });
    const pi = await stripe.paymentIntents.retrieve(piId);
    res.json({ clientSecret: pi.client_secret });
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
    if (!guardian) {
      return res.status(400).json({ error: 'No guardian found for this membership' });
    }

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

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'on_session',
      automatic_payment_methods: { enabled: true },
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
      monthlyAmount: Joi.number().integer().min(0).required(),
      startDate: Joi.date().required(),
      templateIds: Joi.array().items(Joi.string()).optional().default([]),
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

    if (!gymnast.guardians[0]) {
      return res.status(400).json({ error: 'Gymnast has no guardian account to bill' });
    }

    // Check no active/pending/scheduled membership already exists
    const existing = await prisma.membership.findFirst({
      where: { gymnastId: value.gymnastId, status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'PAUSED', 'SCHEDULED'] } },
    });
    if (existing) return res.status(400).json({ error: 'Gymnast already has an active membership' });

    const startDate = new Date(value.startDate);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const isFuture = startDate > todayMidnight;

    // Validate templateIds belong to this club and have no existing commitments
    if (value.templateIds.length > 0) {
      const templates = await prisma.sessionTemplate.findMany({
        where: { id: { in: value.templateIds }, clubId: req.user.clubId },
      });
      if (templates.length !== value.templateIds.length) {
        return res.status(400).json({ error: 'One or more session templates not found' });
      }

      const existingCommitments = await prisma.commitment.findMany({
        where: { gymnastId: value.gymnastId, templateId: { in: value.templateIds } },
      });
      if (existingCommitments.length > 0) {
        return res.status(409).json({ error: 'Gymnast already has a commitment to one or more of these templates' });
      }
    }

    // Create the membership record atomically with any commitments
    const membership = await prisma.$transaction(async (tx) => {
      const created = await tx.membership.create({
        data: {
          gymnastId: value.gymnastId,
          clubId: req.user.clubId,
          monthlyAmount: value.monthlyAmount,
          status: 'SCHEDULED',
          startDate,
        },
        include: { gymnast: true },
      });

      for (const templateId of value.templateIds) {
        await tx.commitment.create({
          data: {
            gymnastId: value.gymnastId,
            templateId,
            createdById: req.user.id,
            startDate: new Date(value.startDate),
          },
        });
      }

      return created;
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'membership.create', entityType: 'Membership', entityId: membership.id,
      metadata: { gymnastId: value.gymnastId, monthlyAmount: value.monthlyAmount, startDate: startDate.toISOString() },
    });

    if (!isFuture) {
      // Start date is today or in the past — activate immediately (creates Stripe sub, sends email)
      const { activateMembership } = require('../../services/membershipActivationService');
      await activateMembership(membership.id, prisma);
    } else {
      // Future start date — notify guardian now so they know it's been scheduled
      const guardian = await prisma.user.findFirst({
        where: { guardedGymnasts: { some: { id: membership.gymnast.id } } },
        select: { email: true, firstName: true },
        orderBy: { createdAt: 'asc' },
      });
      if (guardian?.email) {
        try {
          await emailService.sendMembershipScheduledEmail(
            guardian.email,
            guardian.firstName,
            membership.gymnast,
            value.monthlyAmount,
            startDate,
          );
          await prisma.membership.update({
            where: { id: membership.id },
            data: { scheduledNotifiedAt: new Date() },
          });
        } catch (emailErr) {
          console.error('Failed to send membership scheduled email:', emailErr);
        }
      }
    }

    // Re-fetch to return up-to-date status
    const updated = await prisma.membership.findUnique({
      where: { id: membership.id },
      include: { gymnast: true },
    });

    res.status(201).json({ membership: updated });
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

    const { status, monthlyAmount, prorationBehavior } = req.body;
    const data = {};

    if (monthlyAmount !== undefined) {
      const { error: amtErr, value: amtVal } = Joi.number().integer().min(1).validate(monthlyAmount);
      if (amtErr) return res.status(400).json({ error: 'monthlyAmount must be a positive integer (pence)' });
      data.monthlyAmount = amtVal;

      // prorationBehavior: 'create_prorations' (apply now, pro-rata) or 'none' (from next month)
      const stripeProration = prorationBehavior === 'none' ? 'none' : 'create_prorations';

      // Update Stripe subscription price if one exists and is in an updatable state
      const updatableStatuses = ['ACTIVE', 'PAUSED', 'SCHEDULED'];
      if (membership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY && updatableStatuses.includes(membership.status)) {
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
            proration_behavior: stripeProration,
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
      try {
        await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
      } catch (stripeErr) {
        // Subscription may already be cancelled/expired in Stripe — proceed with local cancellation
        console.warn('Stripe cancel skipped:', stripeErr.message);
      }
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
