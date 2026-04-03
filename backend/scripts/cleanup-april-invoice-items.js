/**
 * Collects the floating April invoice items for the 13 memberships reset on 2026-04-03.
 * These items were created for the fixed April charge but never attached to an invoice
 * because Stripe skipped the initial invoice (proration_behavior:'none' + allow_incomplete).
 *
 * This script creates a standalone invoice for each customer, finalizes it, and attempts
 * to auto-charge using their saved payment method. Customers without a saved PM will have
 * an open invoice they can pay via the app. Without this, the items would stack on May 1.
 *
 * Run from the backend directory:
 *   node -r dotenv/config scripts/cleanup-april-invoice-items.js
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUBSCRIPTION_IDS = [
  { sub: 'sub_1TI4EsK8b6wPdCEO4DunkJPy', name: 'Isla Neasham' },
  { sub: 'sub_1TI4VtK8b6wPdCEOPn2Efk6J', name: 'Danny Stuart' },
  { sub: 'sub_1TI4VwK8b6wPdCEO6lGLGSdt', name: 'Jake Westgarth' },
  { sub: 'sub_1TI4VzK8b6wPdCEOlWetfNVZ', name: 'Ryan Campbell' },
  { sub: 'sub_1TI4W2K8b6wPdCEOq3fx1hsq', name: 'Millie Rooney' },
  { sub: 'sub_1TI4W4K8b6wPdCEOQFbOJG1K', name: 'Hector Shipley' },
  { sub: 'sub_1TI4W6K8b6wPdCEONd4MSyuf', name: 'Jaxson Gibbs' },
  { sub: 'sub_1TI4W8K8b6wPdCEOqCURsDFy', name: 'Chloe Nicol' },
  { sub: 'sub_1TI4WAK8b6wPdCEO1KCP6VlZ', name: 'Tristan Scott' },
  { sub: 'sub_1TI4WCK8b6wPdCEORqzj1TLa', name: 'Daisy Graves' },
  { sub: 'sub_1TI4WEK8b6wPdCEOJYg3iREN', name: 'Poppy Graves' },
  { sub: 'sub_1TI4WGK8b6wPdCEOADdArtRX', name: 'Alex Ford-Mirfin' },
  { sub: 'sub_1TI4WIK8b6wPdCEO8xmTXuJ8', name: 'Emily Swinton' },
];

async function main() {
  for (const { sub, name } of SUBSCRIPTION_IDS) {
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(sub);
    } catch (err) {
      console.log(`${name}: subscription not found, skipping`);
      continue;
    }

    const customerId = subscription.customer;

    // Find pending "first month" invoice items for this customer
    const items = await stripe.invoiceItems.list({ customer: customerId, pending: true });
    const aprilItems = items.data.filter(i =>
      i.description && i.description.toLowerCase().includes('first month membership')
    );

    if (aprilItems.length === 0) {
      console.log(`${name}: no pending April items — skipping`);
      continue;
    }

    const total = aprilItems.reduce((s, i) => s + i.amount, 0);

    // Create a draft invoice — this pulls in the pending items automatically
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: false,
      description: `April 2026 membership — collected separately`,
    });

    // Finalize the invoice (locks it and makes it payable)
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    // Attempt to charge the customer's saved payment method
    let paid = false;
    try {
      const paid_invoice = await stripe.invoices.pay(finalized.id);
      paid = paid_invoice.status === 'paid';
    } catch (payErr) {
      // No saved PM or card declined — invoice stays open
    }

    console.log(`${name}: £${(total / 100).toFixed(2)} — invoice ${finalized.id} — ${paid ? 'PAID (auto-charged)' : 'OPEN (no saved PM or charge failed)'}`);
  }

  console.log('\nDone.');
  console.log('PAID entries: collected immediately from saved card.');
  console.log('OPEN entries: guardian needs to pay via the app or Stripe dashboard.');
}

main().catch(err => { console.error(err); process.exit(1); });
