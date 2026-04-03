/**
 * One-off script: resolve paid invoice_payment events and activate memberships.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... DATABASE_URL=postgresql://... node scripts/fix-invoice-payments.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAID_INVOICE_IDS = [
  'in_1THD8pK8b6wPdCEOVEVk8ia6',
  'in_1THD8wK8b6wPdCEOQnA2M2qI',
  'in_1THD9SK8b6wPdCEOHDuPFtHU',
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not set'); process.exit(1);
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  for (const invoiceId of PAID_INVOICE_IDS) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoice.subscription) {
      console.log(`${invoiceId} — no subscription, skipping`);
      continue;
    }

    const membership = await prisma.membership.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
      include: { gymnast: true },
    });

    if (!membership) {
      console.log(`${invoiceId} — sub ${invoice.subscription} not found in DB`);
      continue;
    }

    console.log(`${invoiceId} → ${membership.gymnast.firstName} ${membership.gymnast.lastName} (${membership.status})`);

    if (membership.status !== 'ACTIVE') {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', needsPaymentMethod: false },
      });
      console.log(`  → updated to ACTIVE`);
    } else {
      console.log(`  → already ACTIVE, no change`);
    }
  }

  console.log('\nDone.');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
