const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

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
    const charges = await prisma.charge.findMany({
      where: { clubId: req.user.clubId },
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

    res.status(201).json(charge);
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
    });
    if (!charge) return res.status(404).json({ error: 'Charge not found' });
    if (charge.paidAt) return res.status(400).json({ error: 'Cannot delete a paid charge' });

    await prisma.charge.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'charge.delete', entityType: 'Charge', entityId: req.params.id,
      metadata: { userId: charge.userId, amount: charge.amount },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
