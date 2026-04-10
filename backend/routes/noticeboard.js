const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const Joi = require('joi');
const { resolveRecipients } = require('../services/recipientResolver');
const { sendMessage } = require('../services/messageSender');
const emailService = require('../services/emailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const ADMIN_ROLES = ['CLUB_ADMIN', 'COACH'];

const noticeboardStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '..', 'uploads', 'noticeboard', req.user.clubId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const uploadImage = multer({
  storage: noticeboardStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const postSchema = Joi.object({
  title: Joi.string().max(200).required(),
  body: Joi.string().required(),
  archiveAt: Joi.string().isoDate().required(),
  priority: Joi.string().valid('INFO', 'IMPORTANT', 'URGENT').optional(),
  recipientFilter: Joi.object().allow(null).optional(),
  videoEmbeds: Joi.array().items(
    Joi.string().uri().pattern(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com\/\d+)/)
  ).max(5).optional(),
});

// GET /api/noticeboard — active posts annotated with isRead
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const posts = await prisma.noticeboardPost.findMany({
      where: { clubId: req.user.clubId, archiveAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { firstName: true, lastName: true } },
        reads: { where: { userId: req.user.id }, select: { id: true } },
      },
    });

    res.json(posts.map(p => ({
      ...p,
      isRead: p.reads.length > 0,
      reads: undefined,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/noticeboard — create post (coaches + admins)
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { error, value } = postSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const post = await prisma.noticeboardPost.create({
      data: {
        clubId: req.user.clubId,
        authorId: req.user.id,
        title: value.title,
        body: value.body,
        archiveAt: new Date(value.archiveAt),
        priority: value.priority ?? 'INFO',
        videoEmbeds: value.videoEmbeds ?? [],
        ...(value.recipientFilter && { recipientFilter: value.recipientFilter }),
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({ ...post, isRead: false });

    // Send email notifications (non-fatal)
    if (value.recipientFilter) {
      try {
        const club = await prisma.club.findUnique({ where: { id: req.user.clubId } });
        if (club && club.emailEnabled) {
          const recipients = await resolveRecipients(value.recipientFilter, req.user.clubId);
          for (const u of recipients) {
            try {
              await emailService.sendEmail({
                to: u.email,
                subject: value.title,
                html: value.body,
              });
            } catch (sendErr) {
              console.error('Failed to send noticeboard email to', u.email, sendErr);
            }
          }
        }
      } catch (emailErr) {
        console.error('Noticeboard email send error:', emailErr);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/noticeboard/upload-image
// IMPORTANT: This route MUST be before /:id to avoid 'upload-image' being treated as an id
router.post('/upload-image', auth, requireRole(ADMIN_ROLES), uploadImage.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/noticeboard/${req.user.clubId}/${req.file.filename}`;
  res.json({ url });
});

// POST /api/noticeboard/preview-recipients — resolve filter without saving
// IMPORTANT: This route MUST be before /:id to avoid 'preview-recipients' being treated as an id
router.post('/preview-recipients', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { recipientFilter } = req.body;
    if (!recipientFilter) return res.status(400).json({ error: 'recipientFilter required' });
    const recipients = await resolveRecipients(recipientFilter, req.user.clubId);
    res.json({
      count: recipients.length,
      preview: recipients.slice(0, 5).map(r => ({ name: `${r.firstName} ${r.lastName}`, email: r.email })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/noticeboard/:id — update post
router.patch('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const post = await prisma.noticeboardPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });
    if (post.authorId !== req.user.id && req.user.role !== 'CLUB_ADMIN') {
      return res.status(403).json({ error: 'Only the author or a club admin can edit this post' });
    }

    const { error, value } = postSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updated = await prisma.noticeboardPost.update({
      where: { id: req.params.id },
      data: { title: value.title, body: value.body, archiveAt: new Date(value.archiveAt), priority: value.priority ?? 'INFO', videoEmbeds: value.videoEmbeds ?? [] },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/noticeboard/:id
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const post = await prisma.noticeboardPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });
    if (post.authorId !== req.user.id && req.user.role !== 'CLUB_ADMIN') {
      return res.status(403).json({ error: 'Only the author or a club admin can delete this post' });
    }

    await prisma.noticeboardPost.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/noticeboard/:id/read — mark as read (upsert)
router.post('/:id/read', auth, async (req, res) => {
  try {
    await prisma.noticeboardRead.upsert({
      where: { postId_userId: { postId: req.params.id, userId: req.user.id } },
      create: { postId: req.params.id, userId: req.user.id },
      update: {},
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
