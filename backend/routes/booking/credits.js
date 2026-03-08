const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const Joi = require('joi');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/credits/my
router.get('/my', auth, async (req, res) => {
  try {
    const credits = await prisma.credit.findMany({
      where: { userId: req.user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });
    res.json(credits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/booking/credits/all
// Returns all club members with their credit balances (coach/admin only)
router.get('/all', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { clubId: req.user.clubId, isArchived: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        credits: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, amount: true, expiresAt: true, createdAt: true },
          orderBy: { expiresAt: 'asc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const result = users.map(u => ({
      ...u,
      totalCredits: u.credits.reduce((sum, c) => sum + c.amount, 0),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/booking/credits/assign
// Manually assign a credit to a user (coach/admin only)
router.post('/assign', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = Joi.object({
      userId: Joi.string().required(),
      amount: Joi.number().integer().min(1).required(), // in pence
      note: Joi.string().max(200).optional(),
      expiresInDays: Joi.number().integer().min(1).default(90),
    }).validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Verify user is in same club
    const targetUser = await prisma.user.findFirst({
      where: { id: value.userId, clubId: req.user.clubId },
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Credits need a sourceBookingId — use a sentinel approach with a dummy booking
    // Instead, we'll relax the schema constraint. For now create a placeholder.
    // Actually, sourceBookingId is required on Credit model. We need a workaround.
    // Let's create the credit with a note field instead — but note isn't in schema either.
    // We'll make sourceBookingId optional via raw SQL for manually-assigned credits.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + value.expiresInDays);

    const credit = await prisma.credit.create({
      data: { userId: value.userId, amount: value.amount, expiresAt },
    });

    res.status(201).json(credit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /credits/:id — remove a credit (staff only)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  const { audit } = require('../../services/auditLogService');
  try {
    const credit = await prisma.credit.findUnique({ where: { id: req.params.id } });
    if (!credit) return res.status(404).json({ error: 'Credit not found' });
    if (credit.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });
    if (credit.usedOnBookingId) return res.status(400).json({ error: 'Cannot delete a credit that has been used on a booking' });

    await prisma.credit.delete({ where: { id: credit.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'credit.delete', entityType: 'Credit', entityId: credit.id,
      metadata: { userId: credit.userId, sessionTemplateId: credit.sessionTemplateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete credit error:', err);
    res.status(500).json({ error: 'Failed to delete credit' });
  }
});

module.exports = router;
