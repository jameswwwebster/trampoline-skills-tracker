const express = require('express');
const Joi = require('joi');
const { auth } = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../prisma');

const skillPatchSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  difficulty: Joi.number().min(0).max(99).allow(null).optional(),
  figNotation: Joi.string().max(20).allow('', null).optional(),
  quarterSoms: Joi.number().integer().min(0).max(16).allow(null).optional(),
  halfTwistsPerSom: Joi.string().max(20).allow('', null).optional(),
  shape: Joi.string().valid('tuck', 'pike', 'straight', 'straddle').allow('', null).optional(),
  landing: Joi.string().valid('feet', 'seat', 'front', 'back', 'hands').allow('', null).optional(),
  direction: Joi.string().valid('forward', 'backward').allow('', null).optional(),
}).min(1);

// Get all skills (with their levels and a routine count). Used by the
// "All Skills" admin page and the cross-level lookup modal.
router.get('/', auth, async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      include: {
        levelSkills: {
          include: { level: { select: { id: true, number: true, identifier: true, name: true, clubId: true } } },
          orderBy: { level: { number: 'asc' } },
        },
        _count: { select: { routineSkills: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    // Scope: keep skills attached only to levels in the user's club, plus library
    // skills (no level attachments) and skills attached to system-wide levels.
    const scoped = skills.filter(s => {
      if (s.levelSkills.length === 0) return true; // library
      return s.levelSkills.every(ls => !ls.level.clubId || ls.level.clubId === req.user.clubId);
    });

    res.json(scoped.map(s => {
      const levels = s.levelSkills.map(ls => ({
        id: ls.level.id,
        identifier: ls.level.identifier,
        name: ls.level.name,
        number: ls.level.number,
        order: ls.order,
      }));
      // Backward-compat: surface the first level as `level` for callers that
      // haven't been updated for the many-to-many shape yet.
      const level = levels[0] || { id: null, identifier: '—', name: 'Library', number: 999 };
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        levelId: level.id,
        level,
        levels,
        order: level.order ?? null,
        difficulty: s.difficulty,
        figNotation: s.figNotation,
        quarterSoms: s.quarterSoms,
        halfTwistsPerSom: s.halfTwistsPerSom,
        shape: s.shape,
        landing: s.landing,
        direction: s.direction,
        routineCount: s._count.routineSkills,
      };
    }));
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update any subset of skill fields (club admins only). Used by the inline-edit
// affordance on the All Skills page; works regardless of level attachments.
router.put('/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { skillId } = req.params;
    const { error, value } = skillPatchSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const updated = await prisma.skill.update({ where: { id: skillId }, data: value });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Skill not found' });
    console.error('Update skill error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fully delete a skill from the library (club admins only). Will fail if the
// skill is still in any routine or has gymnast progress records — those need
// to be cleared first.
router.delete('/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { skillId } = req.params;
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const [routineCount, progressCount] = await Promise.all([
      prisma.routineSkill.count({ where: { skillId } }),
      prisma.skillProgress.count({ where: { skillId } }),
    ]);

    if (routineCount > 0) {
      return res.status(400).json({ error: 'Cannot delete: skill is used in routines. Remove it from routines first.' });
    }
    if (progressCount > 0) {
      return res.status(400).json({ error: 'Cannot delete: skill has gymnast progress records.' });
    }

    // LevelSkill rows cascade automatically
    await prisma.skill.delete({ where: { id: skillId } });
    res.json({ message: 'Skill deleted' });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
