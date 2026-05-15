const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { auth, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLogService');

const router = express.Router();
const prisma = require('../prisma');

// Only CLUB_ADMIN and WELFARE can access welfare reports
const WELFARE_ROLES = ['CLUB_ADMIN', 'WELFARE'];

const WELFARE_INCLUDE = {
  gymnast: { select: { id: true, firstName: true, lastName: true } },
  reportedBy: { select: { id: true, firstName: true, lastName: true } },
  attachments: {
    select: {
      id: true, fileName: true, mimeType: true, fileSize: true, createdAt: true,
      uploadedById: true,
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
};

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, '..');
const WELFARE_UPLOAD_ROOT = path.join(STORAGE_ROOT, 'uploads', 'welfare');
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
]);
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const dir = path.join(WELFARE_UPLOAD_ROOT, req.params.id);
      try {
        await fsp.mkdir(dir, { recursive: true });
        cb(null, dir);
      } catch (e) { cb(e); }
    },
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-80);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${safe}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 6 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

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

    // Best-effort cleanup of on-disk folder. DB cascade already removed rows.
    const dir = path.join(WELFARE_UPLOAD_ROOT, req.params.id);
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});

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

// POST /api/welfare/:id/attachments — upload up to 6 files
router.post('/:id/attachments', auth, requireRole(WELFARE_ROLES),
  (req, res, next) => {
    upload.array('files', 6)(req, res, (err) => {
      if (!err) return next();
      const code = err.code === 'LIMIT_FILE_SIZE' ? 400 : 400;
      return res.status(code).json({ error: err.message });
    });
  },
  async (req, res) => {
    try {
      const report = await prisma.welfareReport.findUnique({ where: { id: req.params.id } });
      if (!report || report.clubId !== req.user.clubId) {
        // Roll back any files multer already wrote to disk.
        if (req.files) await Promise.all(req.files.map(f => fsp.unlink(f.path).catch(() => {})));
        return res.status(404).json({ error: 'Welfare report not found' });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const created = [];
      for (const f of req.files) {
        const relPath = path.relative(STORAGE_ROOT, f.path);
        const row = await prisma.welfareAttachment.create({
          data: {
            welfareReportId: report.id,
            fileName: f.originalname,
            storedPath: relPath,
            mimeType: f.mimetype,
            fileSize: f.size,
            uploadedById: req.user.id,
          },
          select: {
            id: true, fileName: true, mimeType: true, fileSize: true, createdAt: true,
            uploadedById: true,
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        });
        created.push(row);
      }

      await audit({
        userId: req.user.id, clubId: req.user.clubId,
        action: 'welfare.attachment.upload', entityType: 'WelfareReport', entityId: report.id,
        metadata: { count: created.length },
      });

      res.status(201).json(created);
    } catch (err) {
      console.error(err);
      if (req.files) await Promise.all(req.files.map(f => fsp.unlink(f.path).catch(() => {})));
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/welfare/:id/attachments/:attachmentId/file — stream the file
router.get('/:id/attachments/:attachmentId/file', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const att = await prisma.welfareAttachment.findUnique({
      where: { id: req.params.attachmentId },
      include: { welfareReport: { select: { clubId: true, id: true } } },
    });
    if (!att || att.welfareReportId !== req.params.id || att.welfareReport.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    const abs = path.join(STORAGE_ROOT, att.storedPath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.fileName.replace(/"/g, '')}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/welfare/:id/attachments/:attachmentId — remove row + on-disk file
router.delete('/:id/attachments/:attachmentId', auth, requireRole(WELFARE_ROLES), async (req, res) => {
  try {
    const att = await prisma.welfareAttachment.findUnique({
      where: { id: req.params.attachmentId },
      include: { welfareReport: { select: { clubId: true } } },
    });
    if (!att || att.welfareReportId !== req.params.id || att.welfareReport.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    await prisma.welfareAttachment.delete({ where: { id: att.id } });
    await fsp.unlink(path.join(STORAGE_ROOT, att.storedPath)).catch(() => {});

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'welfare.attachment.delete', entityType: 'WelfareReport', entityId: req.params.id,
      metadata: { attachmentId: att.id, fileName: att.fileName },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
