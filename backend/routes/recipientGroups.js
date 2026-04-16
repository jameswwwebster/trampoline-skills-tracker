const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const Joi = require('joi');

const prisma = require('../prisma');
const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

const groupSchema = Joi.object({
  name: Joi.string().max(100).required(),
  recipientFilter: Joi.object().required(),
});

// GET /api/recipient-groups
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const groups = await prisma.recipientGroup.findMany({
      where: { clubId: req.user.clubId },
      orderBy: { name: 'asc' },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/recipient-groups
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { error, value } = groupSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const group = await prisma.recipientGroup.create({
      data: {
        clubId: req.user.clubId,
        createdById: req.user.id,
        name: value.name,
        recipientFilter: value.recipientFilter,
      },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/recipient-groups/:id
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const group = await prisma.recipientGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const { error, value } = groupSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updated = await prisma.recipientGroup.update({
      where: { id: req.params.id },
      data: { name: value.name, recipientFilter: value.recipientFilter },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/recipient-groups/:id
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const group = await prisma.recipientGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    await prisma.recipientGroup.delete({ where: { id: req.params.id } });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
