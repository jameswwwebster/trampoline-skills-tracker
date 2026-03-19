/**
 * One-off script: send "Membership scheduled" emails to all guardians whose
 * gymnast has a SCHEDULED membership (i.e. a future start date that has not
 * yet been activated).
 *
 * Safe to run multiple times — it only targets SCHEDULED memberships and logs
 * each send, so you can verify before re-running.
 *
 * Usage:
 *   node scripts/backfill-membership-scheduled-emails.js [--dry-run]
 *
 * --dry-run  Print what would be sent without actually sending any emails.
 */

const { PrismaClient } = require('@prisma/client');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n📧 Backfill membership scheduled emails${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  const memberships = await prisma.membership.findMany({
    where: { status: 'SCHEDULED' },
    include: {
      gymnast: {
        include: {
          guardians: {
            select: { id: true, email: true, firstName: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${memberships.length} SCHEDULED membership(s).\n`);

  let sent = 0;
  let skipped = 0;

  for (const m of memberships) {
    const guardian = m.gymnast.guardians[0];
    const gymnast = m.gymnast;
    const startStr = new Date(m.startDate).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const amount = `£${(m.monthlyAmount / 100).toFixed(2)}`;

    if (!guardian?.email) {
      console.log(`  ⚠️  ${gymnast.firstName} ${gymnast.lastName} — no guardian email, skipping`);
      skipped++;
      continue;
    }

    console.log(
      `  ${DRY_RUN ? '[would send]' : 'sending'} → ${guardian.email}` +
      ` for ${gymnast.firstName} ${gymnast.lastName}` +
      ` (${amount}/mo, starts ${startStr})`
    );

    if (!DRY_RUN) {
      try {
        await emailService.sendMembershipScheduledEmail(
          guardian.email,
          guardian.firstName,
          gymnast,
          m.monthlyAmount,
          m.startDate,
        );
        sent++;
      } catch (err) {
        console.error(`    ❌ Failed: ${err.message}`);
        skipped++;
      }
    } else {
      sent++;
    }
  }

  console.log(`\nDone. ${sent} email(s) ${DRY_RUN ? 'would be' : ''} sent, ${skipped} skipped.\n`);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
