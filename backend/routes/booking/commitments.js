const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../../middleware/auth');
const { audit } = require('../../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/commitments/mine?templateId=xxx — auth only, scoped to requesting user's gymnasts
// MUST be declared before GET /:id to avoid Express matching "mine" as an :id param
router.get('/mine', auth, async (req, res) => {
  try {
    const { templateId } = req.query;
    if (!templateId) return res.status(400).json({ error: 'templateId query param required' });

    // Support both PARENT (gymnasts linked via guardians) and GYMNAST (userId field)
    const myGymnasts = await prisma.gymnast.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { guardians: { some: { id: req.user.id } } },
        ],
      },
      select: { id: true },
    });
    const myGymnastIds = myGymnasts.map(g => g.id);

    const commitments = await prisma.commitment.findMany({
      where: { templateId, gymnastId: { in: myGymnastIds } },
      select: { gymnastId: true, status: true },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/commitments/gymnast/:gymnastId — admin/coach only
router.get('/gymnast/:gymnastId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: req.params.gymnastId, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    const commitments = await prisma.commitment.findMany({
      where: { gymnastId: req.params.gymnastId },
      include: { template: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/commitments?templateId=xxx — admin/coach only
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { templateId } = req.query;
    if (!templateId) return res.status(400).json({ error: 'templateId query param required' });

    const commitments = await prisma.commitment.findMany({
      where: { templateId, gymnast: { clubId: req.user.clubId } },
      include: { gymnast: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.json(commitments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/commitments — admin/coach only
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { gymnastId, templateId } = req.body;
    if (!gymnastId || !templateId) {
      return res.status(400).json({ error: 'gymnastId and templateId are required' });
    }

    // Validate gymnast belongs to caller's club
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: gymnastId, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    // Validate template belongs to caller's club
    const template = await prisma.sessionTemplate.findFirst({
      where: { id: templateId, clubId: req.user.clubId },
    });
    if (!template) return res.status(400).json({ error: 'Session template not found' });

    // Check for existing commitment (unique constraint)
    const existing = await prisma.commitment.findUnique({
      where: { gymnastId_templateId: { gymnastId, templateId } },
    });
    if (existing) return res.status(409).json({ error: 'Commitment already exists for this gymnast and template' });

    const commitment = await prisma.commitment.create({
      data: { gymnastId, templateId, createdById: req.user.id },
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.create', entityType: 'Commitment', entityId: commitment.id,
      metadata: { gymnastId, templateId },
    });

    res.status(201).json(commitment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/commitments/:id — admin/coach only
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const commitment = await prisma.commitment.findUnique({
      where: { id: req.params.id },
      include: { gymnast: true },
    });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (commitment.gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    await prisma.commitment.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.delete', entityType: 'Commitment', entityId: req.params.id,
      metadata: { gymnastId: commitment.gymnastId, templateId: commitment.templateId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/commitments/:id/status — admin/coach only
router.patch('/:id/status', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or PAUSED' });
    }

    const commitment = await prisma.commitment.findUnique({
      where: { id: req.params.id },
      include: { gymnast: true },
    });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (commitment.gymnast.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const data = status === 'PAUSED'
      ? { status: 'PAUSED', pausedAt: new Date(), pausedById: req.user.id }
      : { status: 'ACTIVE', pausedAt: null, pausedById: null };

    const updated = await prisma.commitment.update({ where: { id: req.params.id }, data });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'commitment.status', entityType: 'Commitment', entityId: req.params.id,
      metadata: { status, gymnastId: commitment.gymnastId, templateId: commitment.templateId },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
