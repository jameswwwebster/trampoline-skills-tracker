const express = require('express');
const { PrismaClient } = require('@prisma/client');

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
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const paymentIntent = event.data.object;
    const booking = await prisma.booking.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id, status: 'PENDING' },
    });
    if (booking) {
      await prisma.credit.updateMany({
        where: { usedOnBookingId: booking.id },
        data: { usedAt: null, usedOnBookingId: null },
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
      console.log(`Booking cancelled and credits released for payment intent ${paymentIntent.id} (${event.type})`);
    }
  }

  res.json({ received: true });
});

module.exports = router;
