const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// Only CLUB_ADMIN and WELFARE can access welfare reports
const WELFARE_ROLES = ['CLUB_ADMIN', 'WELFARE'];

const WELFARE_INCLUDE = {
  gymnast: { select: { id: true, firstName: true, lastName: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
};

// GET /api/welfare — list all welfare reports for club
router.get('/', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const reports = await prisma.welfareReport.findMany({
      where: { clubId: req.user.clubId },
      include: WELFARE_INCLUDE,
      orderBy: { incidentDate: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/welfare/:id — single report
router.get('/:id', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const report = await prisma.welfareReport.findUnique({
      where: { id: req.params.id },
      include: WELFARE_INCLUDE,
    });
    if (!report || report.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Welfare report not found' });
    }
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/welfare — create
router.post('/', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const {
      gymnastId, incidentDate, location, concernType, severity,
      description, actionTaken, outcome,
      witnessName, witnessContact, witnessStatement,
      referredExternally, referralDetails,
    } = req.body;

    if (!incidentDate || !concernType || !severity || !description) {
      return res.status(400).json({ error: 'incidentDate, concernType, severity, and description are required' });
    }
    if (!['MINOR', 'MODERATE', 'SEVERE'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be MINOR, MODERATE, or SEVERE' });
    }
    if (!['SAFEGUARDING', 'BULLYING', 'EMOTIONAL', 'PHYSICAL', 'OTHER'].includes(concernType)) {
      return res.status(400).json({ error: 'concernType must be SAFEGUARDING, BULLYING, EMOTIONAL, PHYSICAL, or OTHER' });
    }

    if (gymnastId) {
      const gymnast = await prisma.gymnast.findFirst({
        where: { id: gymnastId, clubId: req.user.clubId },
      });
      if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });
    }

    const report = await prisma.welfareReport.create({
      data: {
        clubId: req.user.clubId,
        reportedById: req.user.id,
        incidentDate: new Date(incidentDate),
        location: location || null,
        concernType,
        severity,
        description,
        actionTaken: actionTaken || null,
        outcome: outcome || null,
        witnessName: witnessName || null,
        witnessContact: witnessContact || null,
        witnessStatement: witnessStatement || null,
        referredExternally: referredExternally ?? false,
        referralDetails: referralDetails || null,
        ...(gymnastId ? { gymnastId } : {}),
      },
      include: WELFARE_INCLUDE,
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'welfare.create', entityType: 'WelfareReport', entityId: report.id,
      metadata: { concernType, severity, gymnastId: gymnastId || null },
    });

    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/welfare/:id — update
router.patch('/:id', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const report = await prisma.welfareReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Welfare report not found' });
    }

    const {
      incidentDate, location, concernType, severity,
      description, actionTaken, outcome,
      witnessName, witnessContact, witnessStatement,
      referredExternally, referralDetails,
    } = req.body;

    if (severity && !['MINOR', 'MODERATE', 'SEVERE'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be MINOR, MODERATE, or SEVERE' });
    }

    const updated = await prisma.welfareReport.update({
      where: { id: req.params.id },
      data: {
        ...(incidentDate !== undefined ? { incidentDate: new Date(incidentDate) } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(concernType !== undefined ? { concernType } : {}),
        ...(severity !== undefined ? { severity } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(actionTaken !== undefined ? { actionTaken: actionTaken || null } : {}),
        ...(outcome !== undefined ? { outcome: outcome || null } : {}),
        ...(witnessName !== undefined ? { witnessName: witnessName || null } : {}),
        ...(witnessContact !== undefined ? { witnessContact: witnessContact || null } : {}),
        ...(witnessStatement !== undefined ? { witnessStatement: witnessStatement || null } : {}),
        ...(referredExternally !== undefined ? { referredExternally } : {}),
        ...(referralDetails !== undefined ? { referralDetails: referralDetails || null } : {}),
      },
      include: WELFARE_INCLUDE,
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'welfare.update', entityType: 'WelfareReport', entityId: req.params.id,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/welfare/:id — delete
router.delete('/:id', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const report = await prisma.welfareReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Welfare report not found' });
    }

    await prisma.welfareReport.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'welfare.delete', entityType: 'WelfareReport', entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
