// backend/routes/booking/recurringCredits.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

/** Last millisecond of the current calendar month in UTC. */
function endOfMonthUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function formatRule(rule, user) {
  return {
    id: rule.id,
    userId: rule.userId,
    userName: `${user.firstName} ${user.lastName}`,
    amountPence: rule.amountPence,
    endDate: rule.endDate ?? null,
    lastIssuedAt: rule.lastIssuedAt ?? null,
    createdAt: rule.createdAt,
  };
}

// GET /api/booking/recurring-credits
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const rules = await prisma.recurringCredit.findMany({
      where: { clubId: req.user.clubId, isActive: true },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules.map(r => formatRule(r, r.user)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/recurring-credits
const createSchema = Joi.object({
  userId: Joi.string().required(),
  amountPence: Joi.number().integer().min(1).required(),
  endDate: Joi.string().isoDate().optional(),
});

router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Validate endDate is not in the past
    if (value.endDate) {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      if (new Date(value.endDate) < startOfToday) {
        return res.status(400).json({ error: 'endDate must be today or in the future' });
      }
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: value.userId, clubId: req.user.clubId, isArchived: false },
      include: { club: { select: { emailEnabled: true } } },
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const expiresAt = endOfMonthUtc();

    const rule = await prisma.recurringCredit.create({
      data: {
        clubId: req.user.clubId,
        userId: value.userId,
        amountPence: value.amountPence,
        endDate: value.endDate ? new Date(value.endDate) : null,
        createdById: req.user.id,
      },
    });

    await prisma.credit.create({
      data: { userId: value.userId, amount: value.amountPence, expiresAt },
    });

    const updatedRule = await prisma.recurringCredit.update({
      where: { id: rule.id },
      data: { lastIssuedAt: new Date() },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'recurringCredit.create',
      entityType: 'RecurringCredit',
      entityId: rule.id,
      metadata: { targetUserId: value.userId, amountPence: value.amountPence },
    });

    if (targetUser.club.emailEnabled) {
      await emailService.sendCreditAssignedEmail(
        targetUser.email,
        targetUser.firstName,
        value.amountPence,
        expiresAt,
      );
    }

    res.status(201).json(formatRule(updatedRule, targetUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/recurring-credits/:id
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const rule = await prisma.recurringCredit.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
    });
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    await prisma.recurringCredit.update({
      where: { id: rule.id },
      data: { isActive: false },
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'recurringCredit.cancel',
      entityType: 'RecurringCredit',
      entityId: rule.id,
      metadata: { targetUserId: rule.userId },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Issues recurring credits for all eligible active rules.
 * Exported for testing and called by the monthly cron.
 * @param {PrismaClient} [db] - optional Prisma client override (for tests)
 * @returns {Promise<number>} number of credits issued
 */
async function processRecurringCredits(db) {
  const client = db || prisma;
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const rules = await client.recurringCredit.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          isArchived: true,
          club: { select: { emailEnabled: true } },
        },
      },
    },
  });

  let issued = 0;
  for (const rule of rules) {
    try {
      if (rule.user.isArchived) continue;
      if (rule.endDate && rule.endDate < startOfToday) continue;
      if (rule.lastIssuedAt && rule.lastIssuedAt >= startOfMonth) continue;

      const expiresAt = endOfMonthUtc();

      await client.credit.create({
        data: { userId: rule.userId, amount: rule.amountPence, expiresAt },
      });
      await client.recurringCredit.update({
        where: { id: rule.id },
        data: { lastIssuedAt: now },
      });

      if (rule.user.club.emailEnabled) {
        await emailService.sendCreditAssignedEmail(
          rule.user.email,
          rule.user.firstName,
          rule.amountPence,
          expiresAt,
        );
      }

      issued++;
    } catch (err) {
      console.error(`Recurring credit error for rule ${rule.id}:`, err);
    }
  }

  console.log(`Issued ${issued} recurring credit(s)`);
  return issued;
}

module.exports = router;
module.exports.processRecurringCredits = processRecurringCredits;
