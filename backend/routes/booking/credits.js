const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/booking/credits/my
// Returns the current user's unexpired, unused credits
router.get('/my', auth, async (req, res) => {
  try {
    const credits = await prisma.credit.findMany({
      where: {
        userId: req.user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'asc' },
    });
    res.json(credits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
