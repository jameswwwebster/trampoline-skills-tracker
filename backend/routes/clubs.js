const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createClubSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  address: Joi.string().max(200).optional(),
  phone: Joi.string().max(20).optional(),
  email: Joi.string().email().optional()
});

const updateClubSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  address: Joi.string().max(200).optional(),
  phone: Joi.string().max(20).optional(),
  email: Joi.string().email().optional()
});

// Create new club (anyone can create a club and become its admin)
router.post('/', auth, async (req, res) => {
  try {
    const { error } = createClubSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, address, phone, email } = req.body;

    // Create club
    const club = await prisma.club.create({
      data: {
        name,
        address,
        phone,
        email
      }
    });

    // Update user to be club admin
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        clubId: club.id,
        role: 'CLUB_ADMIN'
      },
      include: {
        club: true
      }
    });

    res.status(201).json({
      message: 'Club created successfully',
      club,
      user: updatedUser
    });
  } catch (error) {
    console.error('Create club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all clubs (for selection during registration)
router.get('/', async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(clubs);
  } catch (error) {
    console.error('Get clubs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific club
router.get('/:id', auth, async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true
          }
        },
        gymnasts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Check if user has access to this club
    if (req.user.clubId !== club.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(club);
  } catch (error) {
    console.error('Get club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update club (only club admins)
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error } = updateClubSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clubId = req.params.id;

    // Check if user has access to this club
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const club = await prisma.club.update({
      where: { id: clubId },
      data: req.body
    });

    res.json({
      message: 'Club updated successfully',
      club
    });
  } catch (error) {
    console.error('Update club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete club (only club admins)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const clubId = req.params.id;

    // Check if user has access to this club
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if club has users or gymnasts
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (club._count.users > 1 || club._count.gymnasts > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete club with existing users or gymnasts' 
      });
    }

    await prisma.club.delete({
      where: { id: clubId }
    });

    res.json({ message: 'Club deleted successfully' });
  } catch (error) {
    console.error('Delete club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 