const express = require('express');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = require('../../prisma');

async function handleInvoicePaid(invoice, prisma, emailService) {
  const membership = await prisma.membership.findFirst({
    where: { stripeSubscriptionId: invoice.subscription },
    include: { gymnast: true, club: true },
  });
  if (!membership) return;
  let wasUpdated = false;
  if (membership.status !== 'ACTIVE') {
    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'ACTIVE', needsPaymentMethod: false } });
    wasUpdated = true;
  }
  if (wasUpdated && membership.club.emailEnabled && invoice.amount_paid > 0) {
    const guardian = await prisma.user.findFirst({
      where: { guardedGymnasts: { some: { id: membership.gymnastId } } },
      select: { email: true, firstName: true, lastName: true },
      orderBy: { createdAt: 'asc' },
    });
    if (guardian?.email) {
      try {
        const nextBillingDate = new Date(invoice.period_end * 1000);
        await emailService.sendMembershipPaymentSuccessEmail(
          guardian.email,
          `${guardian.firstName} ${guardian.lastName}`,
          membership.gymnast,
          invoice.amount_paid,
          nextBillingDate,
        );
      } catch (emailErr) {
        console.error('Failed to send membership payment success email:', emailErr.message);
      }
    }
  }
  console.log(`Membership ${membership.id} activated via invoice paid`);
}

// Handles standalone (non-subscription) invoice payments — used when a manual invoice is
// issued for a membership charge (e.g. via the April 2026 cleanup script).
// Activates PENDING_PAYMENT memberships for the Stripe customer if the invoice
// has membership-related line items.
async function handleStandaloneInvoicePaid(invoice, prisma) {
  if (!invoice.customer || invoice.amount_paid <= 0) return;

  // Only act on invoices that look like membership charges
  const lines = invoice.lines?.data || [];
  const isMembershipInvoice =
    (invoice.description && invoice.description.toLowerCase().includes('membership')) ||
    lines.some(l => l.description && l.description.toLowerCase().includes('membership'));
  if (!isMembershipInvoice) return;

  // Find the guardian by Stripe customer ID
  const guardian = await prisma.user.findFirst({
    where: { stripeCustomerId: invoice.customer },
    select: { id: true },
  });
  if (!guardian) return;

  // Activate all PENDING_PAYMENT memberships for this guardian's gymnasts
  const gymnasts = await prisma.gymnast.findMany({
    where: { guardians: { some: { id: guardian.id } } },
    select: { id: true },
  });
  const gymnastIds = gymnasts.map(g => g.id);
  if (gymnastIds.length === 0) return;

  const result = await prisma.membership.updateMany({
    where: { gymnastId: { in: gymnastIds }, status: 'PENDING_PAYMENT' },
    data: { status: 'ACTIVE', needsPaymentMethod: false },
  });
  if (result.count > 0) {
    console.log(`Activated ${result.count} PENDING_PAYMENT membership(s) via standalone invoice ${invoice.id}`);
  }
}

// IMPORTANT: Registered BEFORE express.json() in server.js to receive raw body
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Only confirm if still PENDING — cron may have already cancelled it.
    // Result count is used as an idempotency signal: if 0 rows updated this
    // is a duplicate delivery and we skip side-effects (emails etc).
    const { count: confirmedCount } = await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    console.log(`Booking confirmed for payment intent ${paymentIntent.id} (${confirmedCount} updated)`);

    if (confirmedCount > 0) {
      // Send booking receipt to the parent (non-blocking, swallows errors internally)
      const confirmedBookings = await prisma.booking.findMany({
        where: { stripePaymentIntentId: paymentIntent.id, status: 'CONFIRMED' },
        select: { id: true, userId: true },
      });
      if (confirmedBookings.length > 0) {
        emailService.trySendBookingReceipt(
          confirmedBookings[0].userId,
          confirmedBookings.map(b => b.id),
          prisma,
        );
      }
    }

    // Mark charges paid (idempotent — paidAt already set on duplicate)
    await prisma.charge.updateMany({
      where: { paidOnPaymentIntentId: paymentIntent.id, paidAt: null },
      data: { paidAt: new Date() },
    });

    // Check if this is a shop order
    const shopOrder = await prisma.shopOrder.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
      include: {
        items: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (shopOrder && shopOrder.status === 'PENDING_PAYMENT') {
      await prisma.shopOrder.update({
        where: { id: shopOrder.id },
        data: { status: 'ORDERED' },
      });

      try {
        const shopEmailService = require('../services/shopEmailService');
        await shopEmailService.sendOrderConfirmationEmail(shopOrder.user, shopOrder);
      } catch (emailErr) {
        console.error('Shop order confirmation email failed:', emailErr.message);
      }

      console.log(`[SHOP] Order ${shopOrder.id} confirmed`);
    }

    // Mark competition entry as PAID
    const competitionEntryId = paymentIntent.metadata?.competitionEntryId;
    if (competitionEntryId) {
      await prisma.competitionEntry.updateMany({
        where: { id: competitionEntryId, status: 'PAYMENT_PENDING' },
        data: { status: 'PAID' },
      });
      console.log(`Competition entry ${competitionEntryId} marked PAID`);
    }
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const paymentIntent = event.data.object;
    // Release credits (may be attached to any of the batch bookings)
    const pendingBookings = await prisma.booking.findMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
    });
    for (const booking of pendingBookings) {
      await prisma.credit.updateMany({
        where: { usedOnBookingId: booking.id },
        data: { usedAt: null, usedOnBookingId: null },
      });
    }
    await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    // Release charge PI link so they appear outstanding again
    await prisma.charge.updateMany({
      where: { paidOnPaymentIntentId: paymentIntent.id },
      data: { paidOnPaymentIntentId: null },
    });

    console.log(`Bookings cancelled and credits released for payment intent ${paymentIntent.id} (${event.type})`);
  }

  // invoice_payment.paid: new Stripe API (2026-02-25+) — object is invoice_payment, not invoice
  // Must fetch the invoice to get the subscription ID.
  if (event.type === 'invoice_payment.paid') {
    const invoicePayment = event.data.object;
    if (invoicePayment.invoice && invoicePayment.status === 'paid') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      try {
        const invoice = await stripe.invoices.retrieve(invoicePayment.invoice);
        if (invoice.subscription) {
          await handleInvoicePaid(invoice, prisma, emailService);
        } else {
          await handleStandaloneInvoicePaid(invoice, prisma);
        }
        console.log(`invoice_payment.paid processed (invoice ${invoicePayment.invoice})`);
      } catch (err) {
        console.error('Error handling invoice_payment.paid:', err.message);
      }
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      await handleInvoicePaid(invoice, prisma, emailService);
      console.log(`invoice.paid processed (invoice ${invoice.id})`);
    } else {
      await handleStandaloneInvoicePaid(invoice, prisma);
      console.log(`invoice.paid (standalone) processed (invoice ${invoice.id})`);
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const membership = await prisma.membership.findFirst({
        where: { stripeSubscriptionId: invoice.subscription },
        include: { gymnast: true, club: true },
      });
      if (membership?.club.emailEnabled) {
        const guardian = await prisma.user.findFirst({
          where: { guardedGymnasts: { some: { id: membership.gymnastId } } },
          select: { email: true, firstName: true, lastName: true },
          orderBy: { createdAt: 'asc' },
        });
        if (guardian?.email) {
          try {
            await emailService.sendMembershipPaymentFailedEmail(
              guardian.email,
              `${guardian.firstName} ${guardian.lastName}`,
              membership.gymnast,
              invoice.amount_due,
            );
          } catch (emailErr) {
            console.error('Failed to send membership payment failed email:', emailErr.message);
          }
        }
      }
      console.log(`Membership payment failed for subscription ${invoice.subscription}`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await prisma.membership.updateMany({
      where: { stripeSubscriptionId: subscription.id, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    });
    console.log(`Membership cancelled via subscription deletion ${subscription.id}`);
  }

  res.json({ received: true });
});

module.exports = router;
