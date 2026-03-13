const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { auth, requireRole } = require('../../middleware/auth');
const { generateRollingInstances } = require('../../services/sessionGenerator');

const router = express.Router();
const prisma = new PrismaClient();

const templateSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  openSlots: Joi.number().integer().min(1).required(),
  pricePerGymnast: Joi.number().integer().min(1).optional().default(600),
  minAge: Joi.number().integer().min(0).allow(null).optional(),
  information: Joi.string().allow('', null).optional(),
});

// GET /api/booking/templates — list all templates for the club
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const templates = await prisma.sessionTemplate.findMany({
      where: { clubId: req.user.clubId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(templates);
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/booking/templates — create a new template
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const template = await prisma.sessionTemplate.create({
      data: { ...value, clubId: req.user.clubId },
    });
    await generateRollingInstances(req.user.clubId);
    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/booking/templates/:id — update a template
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { applyToFutureInstances, ...rest } = req.body;
  const { error, value } = templateSchema.validate(rest);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.sessionTemplate.update({
      where: { id: template.id },
      data: value,
    });

    if (applyToFutureInstances && value.openSlots !== template.openSlots) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const futureInstances = await prisma.sessionInstance.findMany({
        where: { templateId: template.id, date: { gt: today }, cancelledAt: null },
        include: { bookings: { where: { status: 'CONFIRMED' } } },
      });
      for (const inst of futureInstances) {
        if (inst.bookings.length === 0) {
          await prisma.sessionInstance.update({
            where: { id: inst.id },
            data: { openSlotsOverride: value.openSlots },
          });
        }
      }
    }

    await generateRollingInstances(req.user.clubId);
    res.json(updated);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// PATCH /api/booking/templates/:id/toggle — activate or deactivate
router.patch('/:id/toggle', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { applyToFutureInstances } = req.body;

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.sessionTemplate.update({
      where: { id: template.id },
      data: { isActive: !template.isActive },
    });

    if (!updated.isActive && applyToFutureInstances) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const futureInstances = await prisma.sessionInstance.findMany({
        where: { templateId: template.id, date: { gt: today }, cancelledAt: null },
        include: { bookings: { where: { status: 'CONFIRMED' } } },
      });
      for (const inst of futureInstances) {
        if (inst.bookings.length === 0) {
          await prisma.sessionInstance.update({
            where: { id: inst.id },
            data: { cancelledAt: new Date() },
          });
        }
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Toggle template error:', err);
    res.status(500).json({ error: 'Failed to toggle template' });
  }
});

// DELETE /api/booking/templates/:id — delete a template
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { applyToFutureInstances } = req.body;

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const bookedFuture = await prisma.sessionInstance.findMany({
      where: { templateId: template.id, date: { gt: today } },
      include: { bookings: { where: { status: 'CONFIRMED' } } },
    });
    const hasConfirmedBookings = bookedFuture.some(inst => inst.bookings.length > 0);
    if (hasConfirmedBookings) {
      return res.status(400).json({ error: 'Cannot delete: future sessions have confirmed bookings. Cancel those bookings first.' });
    }

    if (applyToFutureInstances) {
      const futureIds = bookedFuture.map(i => i.id);
      if (futureIds.length > 0) {
        await prisma.sessionInstance.deleteMany({ where: { id: { in: futureIds } } });
      }
    }

    await prisma.sessionTemplate.delete({ where: { id: template.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
