/**
 * Sends a sample of every email template to a test address.
 * Usage: node scripts/send-test-emails.js [recipient]
 * Default recipient: contact@trampoline.life
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const emailService = require('../services/emailService');

const TO = process.argv[2] || 'contact@trampoline.life';

const gymnast = { id: 'g1', firstName: 'Alex', lastName: 'Smith' };
const guardian = { firstName: 'Jane', lastName: 'Smith' };
const now = new Date();
const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const nextMonth = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);

async function run() {
  const emails = [
    ['Password reset',             () => emailService.sendPasswordResetEmail(TO, 'abc123token', 'Jane Smith')],
    ['Account created',            () => emailService.sendAccountCreatedEmail(TO, 'abc123token', 'Jane Smith')],
    ['Welcome (temp password)',    () => emailService.sendWelcomeEmail(TO, 'Jane Smith', 'Temp#1234')],
    ['Invite (coach)',             () => emailService.sendInviteEmail(TO, 'Coach', 'Trampoline Life', 'James Webster', 'invite123token')],
    ['Certificate awarded',        () => emailService.sendCertificateAwardNotification(TO, 'Jane Smith', gymnast, { type: 'LEVEL_COMPLETION', awardedAt: now, notes: 'Excellent form throughout.', awardedBy: { firstName: 'James', lastName: 'Webster' } }, { identifier: 'L3', name: 'Level 3' })],
    ['Guardian invitation',        () => emailService.sendGuardianInvitationEmail(TO, 'Jane', 'Smith', 'Alex Smith', 'Trampoline Life', 'Parent', 'req123')],
    ['Guardian connected',         () => emailService.sendGuardianConnectionNotification(TO, 'Jane Smith', 'Alex Smith', 'Trampoline Life', 'Parent')],
    ['Membership scheduled',       () => emailService.sendMembershipScheduledEmail(TO, 'Jane', gymnast, 3500, future)],
    ['Membership created',         () => emailService.sendMembershipCreatedEmail(TO, 'Jane', gymnast, 3500)],
    ['Payment success',            () => emailService.sendMembershipPaymentSuccessEmail(TO, 'Jane Smith', gymnast, 3500, nextMonth)],
    ['Payment failed',             () => emailService.sendMembershipPaymentFailedEmail(TO, 'Jane Smith', gymnast, 3500)],
    ['Payment reminder',           () => emailService.sendMembershipPaymentReminderEmail(TO, 'Jane', gymnast, 3500, nextMonth)],
    ['Charge created',             () => emailService.sendChargeCreatedEmail(TO, 'Jane', 'Competition entry fee', 1500, future)],
    ['Charge paid with credit',    () => emailService.sendChargePaidWithCreditEmail(TO, 'Jane', 'Competition entry fee', 1500)],
    ['Charge cancelled',           () => emailService.sendChargeDeletedEmail(TO, 'Jane', 'Competition entry fee', 1500)],
    ['Credit added',               () => emailService.sendCreditAssignedEmail(TO, 'Jane', 2000, future)],
    ['Credit removed',             () => emailService.sendCreditDeletedEmail(TO, 'Jane', 2000)],
    ['Booking receipt',            () => emailService.sendBookingReceiptEmail(TO, 'Jane', [{ date: now, startTime: '10:00', endTime: '11:00', gymnasts: [gymnast] }, { date: future, startTime: '10:00', endTime: '11:00', gymnasts: [gymnast] }], 3000)],
    ['BG number invalid',          () => emailService.sendBgNumberInvalidEmail(TO, 'Jane', 'Alex')],
    ['Inactivity warning',         () => emailService.sendInactivityWarningEmail(TO, 'Jane')],
    ['New member digest (admin)',   () => emailService.sendNewMemberDigestEmail(TO, 'James', [{ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', createdAt: now }, { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', createdAt: now }])],
    ['BG pending digest (admin)',   () => emailService.sendBgNumberPendingDigestEmail(TO, 'James', [{ firstName: 'Alex', lastName: 'Smith', guardianName: 'Jane Smith', bgNumber: '1234567', bgNumberEnteredAt: new Date(now - 2 * 24 * 60 * 60 * 1000) }], `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/admin/members`)],
    ['Weekly session reminder',    () => emailService.sendWeeklySessionReminderEmail(TO, 'Jane', [{ date: now, startTime: '10:00', endTime: '11:00', availableSlots: 4 }, { date: future, startTime: '14:00', endTime: '15:00', availableSlots: 2 }])],
  ];

  console.log(`Sending ${emails.length} test emails to ${TO}...\n`);

  for (const [name, fn] of emails) {
    try {
      const result = await fn();
      console.log(`✅  ${name}${result.dev ? ' (dev mode — logged only)' : ''}`);
    } catch (err) {
      console.error(`❌  ${name}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300)); // small delay to avoid SMTP rate limits
  }

  console.log('\nDone.');
}

run();
