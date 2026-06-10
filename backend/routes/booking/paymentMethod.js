const express = require('express');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = require('../../prisma');

const STAFF_ROLES = ['CLUB_ADMIN', 'COACH'];
const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);

function stripeDashboardBase() {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_')
    ? 'https://dashboard.stripe.com/test'
    : 'https://dashboard.stripe.com';
}
function stripePaymentUrl(piId) { return piId ? `${stripeDashboardBase()}/payments/${piId}` : null; }
function stripeInvoiceLinkUrl(invId) { return invId ? `${stripeDashboardBase()}/invoices/${invId}` : null; }

// Shape the Stripe PaymentMethod into the small projection the UI cares about.
function paymentMethodView(pm) {
  if (!pm || pm.type !== 'card' || !pm.card) return null;
  return {
    id: pm.id,
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
    funding: pm.card.funding,
  };
}

async function fetchDefaultPaymentMethod(stripe, customerId) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) return null;
    let pmId = customer.invoice_settings?.default_payment_method;
    if (pmId && typeof pmId === 'object') pmId = pmId.id;
    if (pmId) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      return paymentMethodView(pm);
    }
    // Fall back to any attached card if no invoice default.
    const list = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
    return list.data.length ? paymentMethodView(list.data[0]) : null;
  } catch (err) {
    console.warn('Stripe payment-method lookup failed:', err.message);
    return null;
  }
}

async function fetchInvoiceHistory(stripe, customerId) {
  if (!customerId) return [];
  const oneYearAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
  try {
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
      created: { gte: oneYearAgo },
    });
    return list.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      created: new Date((inv.created || 0) * 1000),
      total: inv.total,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status, // draft | open | paid | uncollectible | void
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdfUrl: inv.invoice_pdf,
      lines: (inv.lines?.data || []).slice(0, 5).map(line => ({
        description: line.description,
        amount: line.amount,
      })),
    }));
  } catch (err) {
    console.warn('Stripe invoice list failed:', err.message);
    return [];
  }
}

// ── Member-self endpoints ────────────────────────────────────────────────

// GET /api/booking/payment-method
router.get('/payment-method', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      return res.json({ paymentMethod: null, customerId: null });
    }
    const stripe = getStripe();
    const paymentMethod = await fetchDefaultPaymentMethod(stripe, user.stripeCustomerId);
    res.json({ paymentMethod, customerId: user.stripeCustomerId });
  } catch (err) {
    console.error('Get payment-method error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/payment-method/setup-intent
router.post('/payment-method/setup-intent', auth, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, firstName: true, lastName: true, stripeCustomerId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId } });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: { userId: user.id, purpose: 'payment-method-update' },
    });
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    console.error('Create setup-intent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/payment-method/confirm
router.post('/payment-method/confirm', auth, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer on file' });
    }

    const stripe = getStripe();

    // Attach (idempotent — Stripe Elements may have already attached).
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: user.stripeCustomerId });
    } catch (e) {
      // Already attached or invalid — proceed to default-set anyway, Stripe will reject if PM unknown
      if (!/already been attached/i.test(e.message)) {
        console.warn('Attach PM warning:', e.message);
      }
    }

    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Update default_payment_method on every live subscription owned by this
    // customer so the new card is used for the next billing cycle.
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 50,
    });
    const liveStatuses = new Set(['active', 'past_due', 'trialing', 'incomplete', 'unpaid']);
    let subsUpdated = 0;
    for (const sub of subs.data) {
      if (!liveStatuses.has(sub.status)) continue;
      try {
        await stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
        subsUpdated++;
      } catch (e) {
        console.warn(`Sub ${sub.id} update failed:`, e.message);
      }
    }

    // Clear the needsPaymentMethod flag on memberships we know about.
    await prisma.membership.updateMany({
      where: { gymnast: { guardians: { some: { id: user.id } } }, needsPaymentMethod: true },
      data: { needsPaymentMethod: false },
    });

    await audit({
      userId: user.id, clubId: req.user.clubId,
      action: 'paymentMethod.update',
      entityType: 'User', entityId: user.id,
      metadata: { paymentMethodId, subsUpdated },
    });

    res.json({ ok: true, subsUpdated });
  } catch (err) {
    console.error('Confirm payment-method error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/invoices
router.get('/invoices', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) return res.json({ invoices: [] });
    const stripe = getStripe();
    const invoices = await fetchInvoiceHistory(stripe, user.stripeCustomerId);
    res.json({ invoices });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin read-only endpoints ────────────────────────────────────────────

async function loadMemberForAdmin(req, res) {
  const target = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, clubId: true, stripeCustomerId: true },
  });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  if (target.clubId !== req.user.clubId) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return target;
}

// GET /api/booking/admin/users/:userId/payment-method
router.get('/admin/users/:userId/payment-method', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const target = await loadMemberForAdmin(req, res);
    if (!target) return;
    if (!target.stripeCustomerId) {
      return res.json({ paymentMethod: null, customerId: null });
    }
    const stripe = getStripe();
    const paymentMethod = await fetchDefaultPaymentMethod(stripe, target.stripeCustomerId);
    res.json({ paymentMethod, customerId: target.stripeCustomerId });
  } catch (err) {
    console.error('Admin get payment-method error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/admin/users/:userId/invoices
router.get('/admin/users/:userId/invoices', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const target = await loadMemberForAdmin(req, res);
    if (!target) return;
    if (!target.stripeCustomerId) return res.json({ invoices: [] });
    const stripe = getStripe();
    const invoices = await fetchInvoiceHistory(stripe, target.stripeCustomerId);
    res.json({ invoices });
  } catch (err) {
    console.error('Admin get invoices error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/admin/users/:userId/payments
// Unified payment history across Stripe invoices, bookings, shop orders and charges.
router.get('/admin/users/:userId/payments', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const target = await loadMemberForAdmin(req, res);
    if (!target) return;

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const rows = [];

    // Stripe invoices (memberships)
    if (target.stripeCustomerId) {
      const stripe = getStripe();
      const invoices = await fetchInvoiceHistory(stripe, target.stripeCustomerId);
      for (const inv of invoices) {
        const desc = inv.lines.map(l => l.description).filter(Boolean).join(' · ') || 'Membership';
        rows.push({
          id: `invoice-${inv.id}`,
          source: 'Membership',
          date: inv.created,
          description: desc,
          amount: inv.total,
          status: inv.status,
          stripeUrl: stripeInvoiceLinkUrl(inv.id),
          hostedInvoiceUrl: inv.hostedInvoiceUrl,
        });
      }
    }

    // Bookings
    const bookings = await prisma.booking.findMany({
      where: {
        userId: target.id,
        createdAt: { gte: oneYearAgo },
        stripePaymentIntentId: { not: null },
      },
      include: {
        sessionInstance: { include: { template: true } },
        lines: { where: { cancelledAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const b of bookings) {
      const sessDate = b.sessionInstance?.date
        ? new Date(b.sessionInstance.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      rows.push({
        id: `booking-${b.id}`,
        source: 'Booking',
        date: b.createdAt,
        description: `Session booking · ${sessDate} · ${b.lines.length} place${b.lines.length === 1 ? '' : 's'}`,
        amount: b.totalAmount,
        status: b.status.toLowerCase(),
        stripeUrl: stripePaymentUrl(b.stripePaymentIntentId),
        hostedInvoiceUrl: null,
      });
    }

    // Shop orders
    const orders = await prisma.shopOrder.findMany({
      where: {
        userId: target.id,
        createdAt: { gte: oneYearAgo },
        stripePaymentIntentId: { not: null },
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const o of orders) {
      const itemCount = o.items.length;
      rows.push({
        id: `shop-${o.id}`,
        source: 'Shop',
        date: o.createdAt,
        description: `Shop order · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
        amount: o.total,
        status: String(o.status || '').toLowerCase(),
        stripeUrl: stripePaymentUrl(o.stripePaymentIntentId),
        hostedInvoiceUrl: null,
      });
    }

    // Charges (admin-issued, paid)
    const charges = await prisma.charge.findMany({
      where: {
        userId: target.id,
        paidAt: { not: null, gte: oneYearAgo },
      },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });
    for (const c of charges) {
      rows.push({
        id: `charge-${c.id}`,
        source: 'Charge',
        date: c.paidAt,
        description: c.description || 'Charge',
        amount: c.amount,
        status: c.paidWithCredit ? 'paid (credit)' : 'paid',
        stripeUrl: stripePaymentUrl(c.paidOnPaymentIntentId),
        hostedInvoiceUrl: null,
      });
    }

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      payments: rows,
      customerId: target.stripeCustomerId,
      customerUrl: target.stripeCustomerId ? `${stripeDashboardBase()}/customers/${target.stripeCustomerId}` : null,
    });
  } catch (err) {
    console.error('Admin get payments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
