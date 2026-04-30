const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../prisma');

// Get all skills (with level info, routine count, and structured params).
// Used by the "All Skills" admin page.
router.get('/', auth, async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      include: {
        level: { select: { id: true, number: true, identifier: true, name: true, clubId: true } },
        _count: { select: { routineSkills: true } },
      },
      orderBy: [
        { level: { number: 'asc' } },
        { order: 'asc' },
      ],
    });

    // Scope to skills in the requesting user's club (or system-wide skills with no club)
    const scoped = skills.filter(s => !s.level.clubId || s.level.clubId === req.user.clubId);

    res.json(scoped.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      levelId: s.levelId,
      level: s.level,
      order: s.order,
      difficulty: s.difficulty,
      figNotation: s.figNotation,
      quarterSoms: s.quarterSoms,
      halfTwistsPerSom: s.halfTwistsPerSom,
      shape: s.shape,
      landing: s.landing,
      direction: s.direction,
      routineCount: s._count.routineSkills,
    })));
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
