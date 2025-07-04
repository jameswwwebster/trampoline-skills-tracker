const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all gymnasts in current user's club
router.get('/', auth, async (req, res) => {
  try {
    const gymnasts = await prisma.gymnast.findMany({
      where: {
        clubId: req.user.clubId
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            skillProgress: true,
            levelProgress: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    res.json(gymnasts);
  } catch (error) {
    console.error('Get gymnasts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 