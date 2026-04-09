const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const STAFF_ROLES = ['CLUB_ADMIN', 'COACH', 'WELFARE'];

async function canManageContacts(userId, userRole, clubId, gymnastId) {
  if (STAFF_ROLES.includes(userRole)) {
    const gymnast = await prisma.gymnast.findFirst({ where: { id: gymnastId, clubId } });
    return !!gymnast;
  }
  const gymnast = await prisma.gymnast.findFirst({
    where: { id: gymnastId, guardians: { some: { id: userId } } },
  });
  return !!gymnast;
}

// POST /api/named-contacts
router.post('/', auth, async (req, res) => {
  const schema = Joi.object({
    gymnastId: Joi.string().required(),
    name: Joi.string().min(1).max(100).required(),
    phone: Joi.string().allow('', null).max(30).optional(),
    note: Joi.string().allow('', null).max(300).optional(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const allowed = await canManageContacts(req.user.id, req.user.role, req.user.clubId, value.gymnastId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const contact = await prisma.namedContact.create({
      data: {
        gymnastId: value.gymnastId,
        name: value.name,
        phone: value.phone || null,
        note: value.note || null,
        createdById: req.user.id,
      },
    });
    res.status(201).json(contact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/named-contacts/:id
router.patch('/:id', auth, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().allow('', null).max(30).optional(),
    note: Joi.string().allow('', null).max(300).optional(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const contact = await prisma.namedContact.findUnique({
      where: { id: req.params.id },
      include: { gymnast: { select: { clubId: true } } },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const isStaff = STAFF_ROLES.includes(req.user.role) && req.user.clubId === contact.gymnast.clubId;
    const isOwn = contact.createdById === req.user.id;
    if (!isStaff && !isOwn) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.namedContact.update({
      where: { id: req.params.id },
      data: {
        ...(value.name !== undefined && { name: value.name }),
        ...(value.phone !== undefined && { phone: value.phone || null }),
        ...(value.note !== undefined && { note: value.note || null }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/named-contacts/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const contact = await prisma.namedContact.findUnique({
      where: { id: req.params.id },
      include: { gymnast: { select: { clubId: true } } },
    });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const isStaff = STAFF_ROLES.includes(req.user.role) && req.user.clubId === contact.gymnast.clubId;
    const isOwn = contact.createdById === req.user.id;
    if (!isStaff && !isOwn) return res.status(403).json({ error: 'Access denied' });

    await prisma.namedContact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
