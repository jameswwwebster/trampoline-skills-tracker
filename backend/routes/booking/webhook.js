const express = require('express');
const { PrismaClient } = require('@prisma/client');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

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
    // Only confirm if still PENDING — cron may have already cancelled it
    await prisma.booking.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
    console.log(`Booking confirmed for payment intent ${paymentIntent.id}`);

    // Mark charges paid
    await prisma.charge.updateMany({
      where: { paidOnPaymentIntentId: paymentIntent.id },
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

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (invoice.subscription) {
      const membership = await prisma.membership.findFirst({
        where: { stripeSubscriptionId: invoice.subscription },
        include: { gymnast: true, club: true },
      });
      if (membership) {
        if (membership.status !== 'ACTIVE') {
          await prisma.membership.update({ where: { id: membership.id }, data: { status: 'ACTIVE' } });
        }
        if (membership.club.emailEnabled && invoice.amount_paid > 0) {
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
      }
      console.log(`Membership ${membership?.id} invoice.paid processed (invoice ${invoice.id})`);
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
