const express = require('express');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');
const emailService = require('../../services/emailService');

const router = express.Router();
const prisma = require('../../prisma');

const createChargeSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().integer().min(1).required(), // pence
  description: Joi.string().required(),
  dueDate: Joi.string().isoDate().required(),
});

// GET /api/booking/charges/my — auth user's own unpaid charges
// MUST be declared before DELETE /:id to avoid Express matching "my" as an :id param
router.get('/my', auth, async (req, res) => {
  try {
    const charges = await prisma.charge.findMany({
      where: { userId: req.user.id, clubId: req.user.clubId, paidAt: null },
      orderBy: { dueDate: 'asc' },
    });
    res.json(charges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/charges — admin/coach: all club charges
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { userId } = req.query;
    const charges = await prisma.charge.findMany({
      where: { clubId: req.user.clubId, ...(userId ? { userId } : {}) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(charges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/charges — admin/coach only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = createChargeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const targetUser = await prisma.user.findFirst({
      where: { id: value.userId, clubId: req.user.clubId },
      include: { club: { select: { emailEnabled: true } } },
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const charge = await prisma.charge.create({
      data: {
        userId: value.userId,
        clubId: req.user.clubId,
        amount: value.amount,
        description: value.description,
        dueDate: new Date(value.dueDate),
      },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'charge.create', entityType: 'Charge', entityId: charge.id,
      metadata: { userId: value.userId, amount: value.amount, description: value.description },
    });

    // Auto-pay with credit if the user has enough
    const now = new Date();
    const availableCredits = await prisma.credit.findMany({
      where: { userId: value.userId, usedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    });
    const totalCredit = availableCredits.reduce((s, c) => s + c.amount, 0);

    let paidWithCredit = false;
    if (totalCredit >= value.amount) {
      let remaining = value.amount;
      for (const credit of availableCredits) {
        if (remaining <= 0) break;
        if (credit.amount <= remaining) {
          // Consume whole credit
          await prisma.credit.update({
            where: { id: credit.id },
            data: { usedAt: now, usedOnChargeId: charge.id },
          });
          remaining -= credit.amount;
        } else {
          // Credit overshoots — consume it and return change as a new credit
          await prisma.credit.update({
            where: { id: credit.id },
            data: { usedAt: now, usedOnChargeId: charge.id },
          });
          await prisma.credit.create({
            data: {
              userId: value.userId,
              amount: credit.amount - remaining,
              expiresAt: credit.expiresAt,
            },
          });
          remaining = 0;
        }
      }
      await prisma.charge.update({
        where: { id: charge.id },
        data: { paidAt: now, paidWithCredit: true },
      });
      paidWithCredit = true;

      await audit({
        userId: req.user.id, clubId: req.user.clubId,
        action: 'charge.paidWithCredit', entityType: 'Charge', entityId: charge.id,
        metadata: { userId: value.userId, amount: value.amount },
      });
    }

    if (targetUser.club.emailEnabled) {
      if (paidWithCredit) {
        emailService.sendChargePaidWithCreditEmail(
          targetUser.email, targetUser.firstName, value.description, value.amount,
        ).catch(err => console.error('sendChargePaidWithCreditEmail failed:', err));
      } else {
        emailService.sendChargeCreatedEmail(
          targetUser.email, targetUser.firstName, value.description, value.amount, value.dueDate,
        ).catch(err => console.error('sendChargeCreatedEmail failed:', err));
      }
    }

    const finalCharge = paidWithCredit
      ? await prisma.charge.findUnique({ where: { id: charge.id } })
      : charge;
    res.status(201).json(finalCharge);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/booking/charges/:id — admin/coach only, unpaid only
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const charge = await prisma.charge.findFirst({
      where: { id: req.params.id, clubId: req.user.clubId },
      include: {
        user: {
          select: { clubId: true, email: true, firstName: true, club: { select: { emailEnabled: true } } },
        },
      },
    });
    if (!charge) return res.status(404).json({ error: 'Charge not found' });
    if (charge.paidAt) return res.status(400).json({ error: 'Cannot delete a paid charge' });

    await prisma.charge.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'charge.delete', entityType: 'Charge', entityId: req.params.id,
      metadata: { userId: charge.userId, amount: charge.amount },
    });

    if (charge.user.club.emailEnabled) {
      emailService.sendChargeDeletedEmail(
        charge.user.email,
        charge.user.firstName,
        charge.description,
        charge.amount,
      ).catch(err => console.error('sendChargeDeletedEmail failed:', err));
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
