// backend/routes/messages.js
const express = require('express');
const Joi = require('joi');
const { auth, requireRole } = require('../middleware/auth');
const { resolveRecipients } = require('../services/recipientResolver');
const { sendMessage } = require('../services/messageSender');

const router = express.Router();
const prisma = require('../prisma');

const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

// GET /api/messages — list all campaigns for the club
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { clubId: req.user.clubId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = messages.map(m => ({
      id: m.id,
      subject: m.subject,
      status: m.status,
      scheduledAt: m.scheduledAt,
      sentAt: m.sentAt,
      author: m.author,
      recipientCount: m._count.recipients,
      createdAt: m.createdAt,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/archived-members — view ArchivedMemberSummary records
// IMPORTANT: This route MUST be before /:id to avoid 'archived-members' being treated as an id
router.get('/archived-members', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const summaries = await prisma.archivedMemberSummary.findMany({
      where: { clubId: req.user.clubId },
      orderBy: { deletedAt: 'desc' },
    });
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/preview-recipients — resolve filter without saving
// IMPORTANT: This route MUST be before /:id
router.post('/preview-recipients', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { recipientFilter } = req.body;
    if (!recipientFilter) return res.status(400).json({ error: 'recipientFilter required' });
    const users = await resolveRecipients(recipientFilter, req.user.clubId);
    res.json({ count: users.length, users: users.map(u => ({ id: u.id, firstName: u.firstName, email: u.email })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/:id — get campaign detail with recipient stats
router.get('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { firstName: true, lastName: true } },
        recipients: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const messageSchema = Joi.object({
  subject: Joi.string().min(1).max(200).required(),
  htmlBody: Joi.string().min(1).required(),
  recipientFilter: Joi.object().required(),
  scheduledAt: Joi.date().iso().optional().allow(null),
});

// POST /api/messages — create draft or schedule
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const status = value.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    const message = await prisma.message.create({
      data: {
        clubId: req.user.clubId,
        authorId: req.user.id,
        subject: value.subject,
        htmlBody: value.htmlBody,
        recipientFilter: value.recipientFilter,
        status,
        scheduledAt: value.scheduledAt || null,
      },
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/messages/:id — update draft or reschedule
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Cannot edit a message that has been sent' });
    }

    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const status = value.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: { ...value, status },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages/:id/send — send immediately
router.post('/:id/send', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Message has already been sent' });
    }

    const result = await sendMessage(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/messages/:id — delete draft only
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (!['DRAFT', 'SCHEDULED'].includes(message.status)) {
      return res.status(400).json({ error: 'Cannot delete a sent message' });
    }
    await prisma.message.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
