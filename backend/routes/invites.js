const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createInviteSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('COACH', 'PARENT').optional().default('COACH')
});

// Create new invite (only club admins)
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error } = createInviteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, role } = req.body;

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // Check if user is already in this club
      if (existingUser.clubId === req.user.clubId) {
        return res.status(400).json({ error: 'User is already a member of this club' });
      }
      
      // Check if user is in another club
      if (existingUser.clubId) {
        return res.status(400).json({ error: 'User is already a member of another club' });
      }
    }

    // Check if there's already a pending invite for this email to this club
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        clubId: req.user.clubId,
        status: 'PENDING'
      }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'An invite has already been sent to this email address' });
    }

    // Create invite with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
      data: {
        email,
        clubId: req.user.clubId,
        invitedById: req.user.id,
        role,
        expiresAt
      },
      include: {
        club: true,
        invitedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Invite sent successfully',
      invite
    });
  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all invites for current user's club (club admins only)
router.get('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const invites = await prisma.invite.findMany({
      where: {
        clubId: req.user.clubId
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        acceptedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(invites);
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get invite by token (for acceptance)
router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        club: true,
        invitedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if invite is expired
    if (new Date() > invite.expiresAt) {
      // Mark as expired
      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Check if invite is still pending
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invite is no longer valid' });
    }

    res.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        club: invite.club,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    console.error('Get invite by token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept invite
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { id },
      include: {
        club: true
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if invite is for the current user's email
    if (invite.email !== req.user.email) {
      return res.status(403).json({ error: 'This invite is not for your email address' });
    }

    // Check if invite is expired
    if (new Date() > invite.expiresAt) {
      await prisma.invite.update({
        where: { id },
        data: { status: 'EXPIRED' }
      });
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Check if invite is still pending
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invite is no longer valid' });
    }

    // Check if user is already in a club
    if (req.user.clubId) {
      return res.status(400).json({ error: 'You are already a member of a club' });
    }

    // Accept the invite and update user
    const [updatedInvite, updatedUser] = await prisma.$transaction([
      prisma.invite.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedById: req.user.id
        }
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          clubId: invite.clubId,
          role: invite.role
        },
        include: {
          club: true
        }
      })
    ]);

    res.json({
      message: 'Invite accepted successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject invite
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if invite is for the current user's email
    if (invite.email !== req.user.email) {
      return res.status(403).json({ error: 'This invite is not for your email address' });
    }

    // Check if invite is still pending
    if (invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invite is no longer valid' });
    }

    await prisma.invite.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    res.json({ message: 'Invite rejected' });
  } catch (error) {
    console.error('Reject invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel invite (club admins only)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { id }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    // Check if invite belongs to current user's club
    if (invite.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.invite.delete({
      where: { id }
    });

    res.json({ message: 'Invite cancelled' });
  } catch (error) {
    console.error('Cancel invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 