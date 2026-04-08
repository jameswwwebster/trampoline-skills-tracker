const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLogService');
const emailService = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

const STAFF_ROLES = ['CLUB_ADMIN', 'COACH', 'WELFARE'];

const INCIDENT_INCLUDE = {
  gymnast: { select: { id: true, firstName: true, lastName: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  forwards: {
    include: { forwardedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { sentAt: 'asc' },
  },
};

// GET /api/incidents — list all for club (staff only)
router.get('/', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const incidents = await prisma.incidentReport.findMany({
      where: { clubId: req.user.clubId },
      include: INCIDENT_INCLUDE,
      orderBy: { incidentDate: 'desc' },
    });
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/incidents/mine — incidents for the requesting adult's gymnasts
router.get('/mine', auth, async (req, res) => {
  try {
    // Find all gymnasts this user is guardian of or is themselves
    const myGymnasts = await prisma.gymnast.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { guardians: { some: { id: req.user.id } } },
        ],
        clubId: req.user.clubId,
      },
      select: { id: true },
    });
    const ids = myGymnasts.map(g => g.id);

    const incidents = await prisma.incidentReport.findMany({
      where: { clubId: req.user.clubId, gymnastId: { in: ids } },
      include: INCIDENT_INCLUDE,
      orderBy: { incidentDate: 'desc' },
    });
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/incidents/:id — single report (staff or adult guardian of gymnast)
router.get('/:id', auth, async (req, res) => {
  try {
    const incident = await prisma.incidentReport.findUnique({
      where: { id: req.params.id },
      include: INCIDENT_INCLUDE,
    });
    if (!incident || incident.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Incident report not found' });
    }

    const isStaff = STAFF_ROLES.includes(req.user.role);
    if (!isStaff) {
      // Adults/gymnasts can only view reports for their own gymnasts
      const myGymnasts = await prisma.gymnast.findMany({
        where: {
          OR: [
            { userId: req.user.id },
            { guardians: { some: { id: req.user.id } } },
          ],
          clubId: req.user.clubId,
        },
        select: { id: true },
      });
      const ids = myGymnasts.map(g => g.id);
      if (!incident.gymnastId || !ids.includes(incident.gymnastId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(incident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/incidents — create (staff only)
router.post('/', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const {
      gymnastId, incidentDate, location, incidentType, severity,
      description, injuryDetails, firstAidGiven, outcome,
      witnessName, witnessContact, witnessStatement,
    } = req.body;

    if (!incidentDate || !incidentType || !severity || !description) {
      return res.status(400).json({ error: 'incidentDate, incidentType, severity, and description are required' });
    }
    if (!['MINOR', 'MODERATE', 'SEVERE'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be MINOR, MODERATE, or SEVERE' });
    }
    if (!['INJURY', 'NEAR_MISS', 'ILLNESS', 'OTHER'].includes(incidentType)) {
      return res.status(400).json({ error: 'incidentType must be INJURY, NEAR_MISS, ILLNESS, or OTHER' });
    }

    // Validate gymnast belongs to club (if provided)
    if (gymnastId) {
      const gymnast = await prisma.gymnast.findFirst({
        where: { id: gymnastId, clubId: req.user.clubId },
      });
      if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        clubId: req.user.clubId,
        reportedById: req.user.id,
        incidentDate: new Date(incidentDate),
        location: location || null,
        incidentType,
        severity,
        description,
        injuryDetails: injuryDetails || null,
        firstAidGiven: firstAidGiven || null,
        outcome: outcome || null,
        witnessName: witnessName || null,
        witnessContact: witnessContact || null,
        witnessStatement: witnessStatement || null,
        ...(gymnastId ? { gymnastId } : {}),
      },
      include: INCIDENT_INCLUDE,
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'incident.create', entityType: 'IncidentReport', entityId: incident.id,
      metadata: { incidentType, severity, gymnastId: gymnastId || null },
    });

    res.status(201).json(incident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/incidents/:id — edit (staff only)
router.patch('/:id', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const incident = await prisma.incidentReport.findUnique({
      where: { id: req.params.id },
    });
    if (!incident || incident.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Incident report not found' });
    }

    const {
      incidentDate, location, incidentType, severity,
      description, injuryDetails, firstAidGiven, outcome,
      witnessName, witnessContact, witnessStatement,
    } = req.body;

    if (severity && !['MINOR', 'MODERATE', 'SEVERE'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be MINOR, MODERATE, or SEVERE' });
    }
    if (incidentType && !['INJURY', 'NEAR_MISS', 'ILLNESS', 'OTHER'].includes(incidentType)) {
      return res.status(400).json({ error: 'incidentType must be INJURY, NEAR_MISS, ILLNESS, or OTHER' });
    }

    const updated = await prisma.incidentReport.update({
      where: { id: req.params.id },
      data: {
        ...(incidentDate !== undefined ? { incidentDate: new Date(incidentDate) } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(incidentType !== undefined ? { incidentType } : {}),
        ...(severity !== undefined ? { severity } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(injuryDetails !== undefined ? { injuryDetails: injuryDetails || null } : {}),
        ...(firstAidGiven !== undefined ? { firstAidGiven: firstAidGiven || null } : {}),
        ...(outcome !== undefined ? { outcome: outcome || null } : {}),
        ...(witnessName !== undefined ? { witnessName: witnessName || null } : {}),
        ...(witnessContact !== undefined ? { witnessContact: witnessContact || null } : {}),
        ...(witnessStatement !== undefined ? { witnessStatement: witnessStatement || null } : {}),
      },
      include: INCIDENT_INCLUDE,
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'incident.update', entityType: 'IncidentReport', entityId: req.params.id,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/incidents/:id — delete (staff only)
router.delete('/:id', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const incident = await prisma.incidentReport.findUnique({
      where: { id: req.params.id },
    });
    if (!incident || incident.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Incident report not found' });
    }

    await prisma.incidentReport.delete({ where: { id: req.params.id } });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'incident.delete', entityType: 'IncidentReport', entityId: req.params.id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/incidents/:id/forward — forward report to external email
router.post('/:id/forward', auth, requireRole(STAFF_ROLES), async (req, res) => {
  try {
    const incident = await prisma.incidentReport.findUnique({
      where: { id: req.params.id },
      include: {
        gymnast: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!incident || incident.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Incident report not found' });
    }

    const { toEmail, toName, note } = req.body;
    if (!toEmail) return res.status(400).json({ error: 'toEmail is required' });

    const forward = await prisma.incidentForward.create({
      data: {
        incidentReportId: incident.id,
        forwardedById: req.user.id,
        toEmail,
        toName: toName || null,
        note: note || null,
      },
      include: { forwardedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    const reportUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/booking/admin/incidents/${incident.id}`;
    const forwarderName = `${req.user.firstName} ${req.user.lastName}`;
    await emailService.sendIncidentForwardEmail(
      toEmail, toName || null, incident.gymnast, incident, forwarderName, note || null, reportUrl,
    ).catch(err => console.error('Forward email failed:', err));

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'incident.forward', entityType: 'IncidentReport', entityId: incident.id,
      metadata: { toEmail },
    });

    res.status(201).json(forward);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
