const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_ROLES = ['CLUB_ADMIN'];
const STAFF_ROLES = ['CLUB_ADMIN', 'COACH', 'WELFARE'];

// Helper: check if user is a current guardian of gymnast, or is club admin for that club
async function canManageInvitesFor(userId, userRole, clubId, gymnastId) {
  if (ADMIN_ROLES.includes(userRole)) {
    // Admin can manage any gymnast in their club
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: gymnastId, clubId },
    });
    return !!gymnast;
  }
  // Guardian can manage their own gymnasts
  const gymnast = await prisma.gymnast.findFirst({
    where: {
      id: gymnastId,
      guardians: { some: { id: userId } },
    },
  });
  return !!gymnast;
}

// GET /api/guardian-invites/gymnast/:gymnastId
// Returns guardians, pending invites, and named contacts for a gymnast
router.get('/gymnast/:gymnastId', auth, async (req, res) => {
  try {
    const { gymnastId } = req.params;
    const allowed = await canManageInvitesFor(req.user.id, req.user.role, req.user.clubId, gymnastId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        guardians: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        guardianInvites: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          include: {
            invitedBy: { select: { firstName: true, lastName: true } },
          },
        },
        namedContacts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    res.json({
      guardians: gymnast.guardians,
      pendingInvites: gymnast.guardianInvites,
      namedContacts: gymnast.namedContacts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/guardian-invites/token/:token  (public — for the accept page)
router.get('/token/:token', async (req, res) => {
  try {
    const invite = await prisma.guardianInvite.findUnique({
      where: { token: req.params.token },
      include: {
        gymnast: { select: { id: true, firstName: true, lastName: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
        acceptedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json(invite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/guardian-invites  — create invite
router.post('/', auth, async (req, res) => {
  const schema = Joi.object({
    gymnastId: Joi.string().required(),
    email: Joi.string().email().required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const allowed = await canManageInvitesFor(req.user.id, req.user.role, req.user.clubId, value.gymnastId);
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const gymnast = await prisma.gymnast.findUnique({
      where: { id: value.gymnastId },
      include: { guardians: { select: { email: true } } },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    // Can't invite someone who's already a guardian
    const alreadyGuardian = gymnast.guardians.some(
      g => g.email?.toLowerCase() === value.email.toLowerCase()
    );
    if (alreadyGuardian) {
      return res.status(400).json({ error: 'That person is already a guardian for this gymnast.' });
    }

    // Cancel any existing pending invite for same email+gymnast
    await prisma.guardianInvite.deleteMany({
      where: { gymnastId: value.gymnastId, email: value.email, acceptedAt: null },
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const invite = await prisma.guardianInvite.create({
      data: {
        gymnastId: value.gymnastId,
        invitedById: req.user.id,
        email: value.email,
        expiresAt,
      },
      include: {
        gymnast: { select: { firstName: true, lastName: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Send email (non-blocking)
    emailService.sendGuardianInvite(
      value.email,
      invite.gymnast,
      invite.invitedBy,
      invite.token
    ).catch(err => console.error('Guardian invite email failed:', err));

    res.status(201).json(invite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/guardian-invites/token/:token/accept  — accept invite (must be logged in)
router.post('/token/:token/accept', auth, async (req, res) => {
  try {
    const invite = await prisma.guardianInvite.findUnique({
      where: { token: req.params.token },
      include: {
        gymnast: { select: { id: true, firstName: true, lastName: true, clubId: true } },
      },
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.acceptedAt) return res.status(400).json({ error: 'Invite already accepted' });
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Invite has expired' });

    // Accepting user should match the invited email (soft check — warn but allow)
    // Hard block if completely different club
    if (req.user.clubId && req.user.clubId !== invite.gymnast.clubId) {
      return res.status(400).json({ error: 'This invite is for a different club.' });
    }

    // Link user as guardian + mark invite accepted
    await prisma.$transaction([
      prisma.gymnast.update({
        where: { id: invite.gymnastId },
        data: { guardians: { connect: { id: req.user.id } } },
      }),
      prisma.guardianInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: req.user.id },
      }),
    ]);

    res.json({ success: true, gymnast: invite.gymnast });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/guardian-invites/:id  — cancel pending invite
router.delete('/:id', auth, async (req, res) => {
  try {
    const invite = await prisma.guardianInvite.findUnique({
      where: { id: req.params.id },
      include: { gymnast: { select: { clubId: true } } },
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    const isAdmin = req.user.role === 'CLUB_ADMIN' && req.user.clubId === invite.gymnast.clubId;
    const isOwn = invite.invitedById === req.user.id;
    if (!isAdmin && !isOwn) return res.status(403).json({ error: 'Access denied' });

    await prisma.guardianInvite.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/guardian-invites/gymnast/:gymnastId/guardian/:userId  — admin removes guardian link
router.delete('/gymnast/:gymnastId/guardian/:userId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { gymnastId, userId } = req.params;
    const gymnast = await prisma.gymnast.findFirst({
      where: { id: gymnastId, clubId: req.user.clubId },
    });
    if (!gymnast) return res.status(404).json({ error: 'Gymnast not found' });

    await prisma.gymnast.update({
      where: { id: gymnastId },
      data: { guardians: { disconnect: { id: userId } } },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
