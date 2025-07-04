const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireGymnastAccess } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get progress for a specific gymnast
router.get('/gymnast/:gymnastId', auth, requireGymnastAccess, async (req, res) => {
  try {
    const { gymnastId } = req.params;

    const [skillProgress, levelProgress] = await Promise.all([
      prisma.skillProgress.findMany({
        where: {
          gymnastId
        },
        include: {
          skill: {
            include: {
              level: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.levelProgress.findMany({
        where: {
          gymnastId
        },
        include: {
          level: true,
          routine: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      })
    ]);

    res.json({
      skillProgress,
      levelProgress
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 