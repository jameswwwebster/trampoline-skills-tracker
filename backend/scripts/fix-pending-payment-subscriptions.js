/**
 * One-off script: cancel and recreate Stripe subscriptions for PENDING_PAYMENT
 * memberships so they use the corrected billing logic (trial_end aligned to
 * startDate midnight, billing anchor derived from startDate).
 *
 * Safe to run with --dry-run first — nothing is changed without --fix.
 *
 * Usage:
 *   node scripts/fix-pending-payment-subscriptions.js [--dry-run] [--fix]
 *
 * --dry-run  (default) Show what would happen, make no changes.
 * --fix      Cancel existing Stripe subscriptions and re-activate.
 */

const { PrismaClient } = require('@prisma/client');
const { activateMembership } = require('../services/membershipActivationService');

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--fix');

async function main() {
  console.log(`\nfix-pending-payment-subscriptions${DRY_RUN ? ' [DRY RUN — pass --fix to apply]' : ' [LIVE]'}\n`);

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not set — aborting.');
    process.exit(1);
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  const memberships = await prisma.membership.findMany({
    where: { status: 'PENDING_PAYMENT' },
    include: {
      gymnast: {
        select: {
          firstName: true,
          lastName: true,
          guardians: { select: { firstName: true, lastName: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
    },
    orderBy: { startDate: 'asc' },
  });

  if (memberships.length === 0) {
    console.log('No PENDING_PAYMENT memberships found. Nothing to do.\n');
    return;
  }

  console.log(`Found ${memberships.length} PENDING_PAYMENT membership(s):\n`);

  const now = new Date();

  for (const m of memberships) {
    const gymnast = m.gymnast;
    const guardian = gymnast.guardians[0];
    const startDate = new Date(m.startDate);
    const startDateMidnightUTC = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const isFirstOfMonth = startDate.getUTCDate() === 1;
    const trialEndInFuture = startDateMidnightUTC > now;

    const amount = `£${(m.monthlyAmount / 100).toFixed(2)}/mo`;
    const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    console.log(`  ${gymnast.firstName} ${gymnast.lastName} (guardian: ${guardian?.firstName ?? '?'} ${guardian?.lastName ?? '?'})`);
    console.log(`    startDate: ${startStr} | amount: ${amount} | 1st of month: ${isFirstOfMonth ? 'yes' : 'no'}`);
    console.log(`    Stripe sub: ${m.stripeSubscriptionId ?? 'none'}`);
    console.log(`    trial_end will be: ${trialEndInFuture ? startDateMidnightUTC.toISOString() + ' (future ✓)' : 'n/a — startDate midnight already passed'}`);

    if (!m.stripeSubscriptionId) {
      console.log(`    SKIP — no Stripe subscription ID on record\n`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`    [dry-run] would cancel sub ${m.stripeSubscriptionId} and re-activate\n`);
      continue;
    }

    // Cancel the existing Stripe subscription (voids the pending first invoice)
    try {
      await stripe.subscriptions.cancel(m.stripeSubscriptionId);
      console.log(`    cancelled sub ${m.stripeSubscriptionId}`);
    } catch (err) {
      console.warn(`    could not cancel sub ${m.stripeSubscriptionId}: ${err.message} — continuing`);
    }

    // Reset membership back to SCHEDULED so activateMembership will process it
    await prisma.membership.update({
      where: { id: m.id },
      data: { status: 'SCHEDULED', stripeSubscriptionId: null, needsPaymentMethod: false },
    });

    // Re-activate with the fixed logic
    try {
      await activateMembership(m.id, prisma);
      const updated = await prisma.membership.findUnique({ where: { id: m.id }, select: { status: true, stripeSubscriptionId: true } });
      console.log(`    re-activated → status: ${updated.status}, new sub: ${updated.stripeSubscriptionId}\n`);
    } catch (err) {
      console.error(`    ERROR re-activating: ${err.message}\n`);
    }
  }

  console.log('Done.\n');
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
