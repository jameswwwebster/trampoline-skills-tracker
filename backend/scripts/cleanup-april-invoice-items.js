/**
 * Deletes floating pending invoice items for the 13 memberships reset on 2026-04-03.
 * These items were created for the fixed April charge but never attached to an invoice
 * because Stripe skipped the initial invoice (proration_behavior:'none' + allow_incomplete).
 * Without cleanup they would stack on top of the May 1 billing causing a double charge.
 *
 * Run with:
 *   STRIPE_SECRET_KEY=sk_live_... node backend/scripts/cleanup-april-invoice-items.js
 * or from the backend directory:
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
      console.log(`${name}: subscription not found (${err.message}), skipping`);
      continue;
    }

    const items = await stripe.invoiceItems.list({ customer: subscription.customer, pending: true });
    const aprilItems = items.data.filter(i =>
      i.description && i.description.toLowerCase().includes('first month membership')
    );

    if (aprilItems.length === 0) {
      console.log(`${name}: no pending April items found`);
      continue;
    }

    for (const item of aprilItems) {
      await stripe.invoiceItems.del(item.id);
      console.log(`${name}: deleted pending item £${(item.amount / 100).toFixed(2)} (${item.id})`);
    }
  }

  console.log('\nDone. These subscriptions will now bill normally on May 1 without a double charge.');
  console.log('Note: April was not collected for these members. If you wish to charge for April,');
  console.log('create a one-off invoice manually in the Stripe dashboard for each customer.');
}

main().catch(err => { console.error(err); process.exit(1); });
