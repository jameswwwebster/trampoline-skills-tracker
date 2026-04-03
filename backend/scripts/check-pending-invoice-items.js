/**
 * Finds any active/pending-payment memberships that have floating invoice items
 * in Stripe which would cause a double charge on the next billing date.
 * Also shows upcoming invoice totals so you can spot inflated May invoices.
 *
 * Run from the backend directory:
 *   node -r dotenv/config scripts/check-pending-invoice-items.js
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.membership.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT'] }, stripeSubscriptionId: { not: null } },
    include: { gymnast: true },
    orderBy: { gymnast: { lastName: 'asc' } },
  });

  let foundAny = false;

  for (const m of memberships) {
    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(m.stripeSubscriptionId);
    } catch {
      continue;
    }

    const [items, upcoming] = await Promise.all([
      stripe.invoiceItems.list({ customer: sub.customer, pending: true }),
      stripe.invoices.retrieveUpcoming({ customer: sub.customer, subscription: m.stripeSubscriptionId }).catch(() => null),
    ]);

    const pendingTotal = items.data.reduce((s, i) => s + i.amount, 0);
    const upcomingTotal = upcoming ? upcoming.total : null;
    const expectedMonthly = m.monthlyAmount;

    const hasPending = items.data.length > 0;
    const inflatedUpcoming = upcomingTotal !== null && upcomingTotal > expectedMonthly;

    if (hasPending || inflatedUpcoming) {
      foundAny = true;
      console.log(`\n${m.gymnast.firstName} ${m.gymnast.lastName} (£${(m.monthlyAmount / 100).toFixed(2)}/mo)`);
      if (hasPending) {
        console.log(`  Pending invoice items (${items.data.length}):`);
        items.data.forEach(i => console.log(`    - "${i.description}" £${(i.amount / 100).toFixed(2)} [${i.id}]`));
        console.log(`  Pending total: £${(pendingTotal / 100).toFixed(2)}`);
      }
      if (inflatedUpcoming) {
        console.log(`  Upcoming invoice: £${(upcomingTotal / 100).toFixed(2)} (expected £${(expectedMonthly / 100).toFixed(2)})`);
      }
    }
  }

  if (!foundAny) {
    console.log('No pending items or inflated upcoming invoices found.');
  }

  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
