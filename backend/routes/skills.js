const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all skills
router.get('/', auth, async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      include: {
        level: true
      },
      orderBy: [
        {
          level: {
            number: 'asc'
          }
        },
        {
          order: 'asc'
        }
      ]
    });

    res.json(skills);
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 