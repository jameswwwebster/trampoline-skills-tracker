/**
 * Collects the floating April invoice items for the 13 memberships reset on 2026-04-03.
 *
 * The previous cleanup script created £0 invoices because Stripe (API 2026-02-25.clover)
 * didn't auto-collect pending items on draft invoice creation. This script instead:
 *   1. Creates a draft invoice
 *   2. Deletes the floating pending items
 *   3. Recreates them explicitly attached to the draft invoice
 *   4. Finalizes and attempts to pay
 *
 * Run from the backend directory:
 *   node -r dotenv/config scripts/collect-april-charges.js
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Deduped by customer — Daisy and Poppy Graves share one
const SUBSCRIPTIONS = [
  { sub: 'sub_1TI4EsK8b6wPdCEO4DunkJPy', name: 'Isla Neasham' },
  { sub: 'sub_1TI4VtK8b6wPdCEOPn2Efk6J', name: 'Danny Stuart' },
  { sub: 'sub_1TI4VwK8b6wPdCEO6lGLGSdt', name: 'Jake Westgarth' },
  { sub: 'sub_1TI4VzK8b6wPdCEOlWetfNVZ', name: 'Ryan Campbell' },
  { sub: 'sub_1TI4W2K8b6wPdCEOq3fx1hsq', name: 'Millie Rooney' },
  { sub: 'sub_1TI4W4K8b6wPdCEOQFbOJG1K', name: 'Hector Shipley' },
  { sub: 'sub_1TI4W6K8b6wPdCEONd4MSyuf', name: 'Jaxson Gibbs' },
  { sub: 'sub_1TI4W8K8b6wPdCEOqCURsDFy', name: 'Chloe Nicol' },
  { sub: 'sub_1TI4WAK8b6wPdCEO1KCP6VlZ', name: 'Tristan Scott' },
  { sub: 'sub_1TI4WCK8b6wPdCEORqzj1TLa', name: 'Daisy & Poppy Graves' },
  { sub: 'sub_1TI4WGK8b6wPdCEOADdArtRX', name: 'Alex Ford-Mirfin' },
  { sub: 'sub_1TI4WIK8b6wPdCEO8xmTXuJ8', name: 'Emily Swinton' },
];

async function main() {
  const seenCustomers = new Set();

  for (const { sub, name } of SUBSCRIPTIONS) {
    const subscription = await stripe.subscriptions.retrieve(sub);
    const customerId = subscription.customer;

    if (seenCustomers.has(customerId)) continue;
    seenCustomers.add(customerId);

    // Get all pending items for this customer
    const { data: pendingItems } = await stripe.invoiceItems.list({ customer: customerId, pending: true });

    // Only process "first month membership" items — ignore proration pairs that cancel out
    const aprilItems = pendingItems.filter(i =>
      i.description && i.description.toLowerCase().startsWith('first month membership')
    );

    if (aprilItems.length === 0) {
      console.log(`${name}: no April items to collect`);
      continue;
    }

    const total = aprilItems.reduce((s, i) => s + i.amount, 0);

    // Create a draft invoice
    const draft = await stripe.invoices.create({ customer: customerId, auto_advance: false });

    // Delete each floating item and recreate it attached to the draft invoice
    for (const item of aprilItems) {
      await stripe.invoiceItems.del(item.id);
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: draft.id,
        amount: item.amount,
        currency: item.currency,
        description: item.description,
      });
    }

    // Finalize the invoice
    const finalized = await stripe.invoices.finalizeInvoice(draft.id);

    // Attempt to auto-charge
    let paid = false;
    try {
      const result = await stripe.invoices.pay(finalized.id);
      paid = result.status === 'paid';
    } catch {
      // No saved PM or charge failed — invoice stays open
    }

    // Update DB if not paid
    if (!paid) {
      const membership = await prisma.membership.findFirst({
        where: { stripeSubscriptionId: sub },
      });
      if (membership && membership.status === 'ACTIVE') {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: 'PENDING_PAYMENT' },
        });
      }
    }

    console.log(`${name}: £${(total / 100).toFixed(2)} — ${paid ? 'PAID (auto-charged)' : 'OPEN — invoice ' + finalized.id}`);
  }

  // Also delete any residual proration pairs (they cancel out, not needed)
  console.log('\nChecking for residual proration pairs...');
  const seenCustomers2 = new Set();
  for (const { sub, name } of SUBSCRIPTIONS) {
    const subscription = await stripe.subscriptions.retrieve(sub);
    const customerId = subscription.customer;
    if (seenCustomers2.has(customerId)) continue;
    seenCustomers2.add(customerId);
    const { data: remaining } = await stripe.invoiceItems.list({ customer: customerId, pending: true });
    if (remaining.length > 0) {
      console.log(`${name}: ${remaining.length} remaining item(s):`);
      remaining.forEach(i => console.log(`  - "${i.description}" £${(i.amount/100).toFixed(2)} [${i.id}]`));
    }
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
