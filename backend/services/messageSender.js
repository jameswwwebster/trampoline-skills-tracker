// backend/services/messageSender.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const emailService = require('./emailService');
const { resolveRecipients } = require('./recipientResolver');

async function sendMessage(messageId) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { club: true },
  });
  if (!message) throw new Error(`Message ${messageId} not found`);
  if (!message.club.emailEnabled) {
    await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED', sentAt: new Date() } });
    return { sent: 0, failed: 0, skipped: 'email disabled' };
  }

  // Mark as SENDING
  await prisma.message.update({ where: { id: messageId }, data: { status: 'SENDING' } });

  // Resolve recipients
  const users = await resolveRecipients(message.recipientFilter, message.clubId);

  // Create recipient rows
  await prisma.messageRecipient.createMany({
    data: users.map(u => ({ messageId, userId: u.id, email: u.email, status: 'PENDING' })),
    skipDuplicates: true,
  });

  let sent = 0;
  let failed = 0;

  for (const u of users) {
    try {
      await emailService.sendEmail({
        to: u.email,
        subject: message.subject,
        html: message.htmlBody,
      });
      await prisma.messageRecipient.updateMany({
        where: { messageId, userId: u.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      sent++;
    } catch (err) {
      await prisma.messageRecipient.updateMany({
        where: { messageId, userId: u.id },
        data: { status: 'FAILED', error: err.message },
      });
      failed++;
    }
  }

  const finalStatus = sent === 0 && failed > 0 ? 'FAILED' : 'SENT';
  await prisma.message.update({
    where: { id: messageId },
    data: { status: finalStatus, sentAt: new Date() },
  });

  return { sent, failed };
}

module.exports = { sendMessage };
