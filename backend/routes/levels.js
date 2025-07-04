const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all levels
router.get('/', auth, async (req, res) => {
  try {
    const levels = await prisma.level.findMany({
      include: {
        skills: {
          orderBy: {
            order: 'asc'
          }
        },
        routines: {
          include: {
            routineSkills: {
              include: {
                skill: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            skills: true,
            routines: true
          }
        }
      },
      orderBy: [
        {
          type: 'asc' // SEQUENTIAL first, then SIDE_PATH
        },
        {
          number: 'asc'
        },
        {
          identifier: 'asc'
        }
      ]
    });

    // Transform the data to match the expected frontend structure
    const transformedLevels = levels.map(level => ({
      ...level,
      routines: level.routines.map(routine => ({
        ...routine,
        skills: routine.routineSkills.map(rs => rs.skill)
      }))
    }));

    res.json(transformedLevels);
  } catch (error) {
    console.error('Get levels error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 