const express = require('express');
const Joi = require('joi');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../prisma');

// Flatten Prisma's `levelSkills` join include back to the legacy `level.skills`
// shape the frontend expects: an array of skill objects, each carrying the join's
// `order` so the level renders skills in coach-defined order.
function flattenLevelSkills(levelSkills) {
  return (levelSkills || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(ls => ({ ...ls.skill, order: ls.order }));
}

// Batch-fetch difficulty/figNotation for implicit skill names, returns name→skill map
async function lookupImplicitSkillDDs(names) {
  if (!names || names.length === 0) return {};
  const skills = await prisma.skill.findMany({
    where: { name: { in: names } },
    select: { name: true, difficulty: true, figNotation: true }
  });
  return Object.fromEntries(skills.map(s => [s.name, s]));
}

// Transform routineSkills into the frontend skill shape, with DD info for implicit skills
function transformRoutineSkills(routineSkills, levelId, ddMap = {}) {
  return routineSkills.map(rs => {
    if (rs.customSkillName) {
      // Per-routine overrides (rs.difficulty / rs.figNotation) take precedence;
      // fall back to the name-matching ddMap so legacy implicit skills that pre-
      // date the override columns still inherit from a like-named tracked skill.
      const dd = ddMap[rs.customSkillName] || {};
      return {
        id: rs.id,                       // RoutineSkill row id — unique per row
        skillId: null,
        name: rs.customSkillName,
        description: null,
        levelId,
        order: rs.order,
        isImplicit: true,
        difficulty: rs.difficulty ?? dd.difficulty ?? null,
        figNotation: rs.figNotation ?? dd.figNotation ?? null,
      };
    }
    // Tracked skill — expose RoutineSkill row id as `id` so duplicates render
    // and act on the specific row; underlying tracked skill id stays as
    // `skillId` for difficulty deduping and library cross-references.
    return {
      ...rs.skill,
      id: rs.id,
      skillId: rs.skill.id,
      order: rs.order,
      isImplicit: false,
    };
  });
}

// Validation schemas
const levelCreateSchema = Joi.object({
  identifier: Joi.string().min(1).max(20).required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  type: Joi.string().valid('SEQUENTIAL', 'SIDE_PATH').default('SEQUENTIAL'),
  competitionIds: Joi.array().items(Joi.string()).optional()
});

const levelUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  competitionIds: Joi.array().items(Joi.string()).optional()
});

const skillStructuredFields = {
  difficulty: Joi.number().min(0).max(99).allow(null).optional(),
  figNotation: Joi.string().max(20).allow('', null).optional(),
  quarterSoms: Joi.number().integer().min(0).max(16).allow(null).optional(),
  halfTwistsPerSom: Joi.string().max(20).allow('', null).optional(),
  shape: Joi.string().valid('tuck', 'pike', 'straight', 'straddle').allow('', null).optional(),
  landing: Joi.string().valid('feet', 'seat', 'front', 'back').allow('', null).optional(),
  direction: Joi.string().valid('forward', 'backward').allow('', null).optional(),
};

const skillCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  order: Joi.number().integer().min(1).optional(),
  ...skillStructuredFields,
});

const skillUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  order: Joi.number().integer().min(1).optional(),
  ...skillStructuredFields,
});

const routineCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).allow('', null),
  description: Joi.string().max(500).allow('', null),
  isAlternative: Joi.boolean().default(false),
  order: Joi.number().integer().min(1).optional()
});

const routineUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).allow('', null).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  isAlternative: Joi.boolean().optional(),
  order: Joi.number().integer().min(1).optional()
});

const routineSkillSchema = Joi.object({
  skillId: Joi.string().allow(null).optional(),
  customSkillName: Joi.string().min(1).max(100).allow(null).optional(),
  // Optional overrides for implicit skills. Ignored when skillId is set.
  difficulty: Joi.number().min(0).max(99).allow(null).optional(),
  figNotation: Joi.string().max(20).allow('', null).optional(),
  order: Joi.number().integer().min(1).optional()
}).custom((value, helpers) => {
  // Custom validation to ensure either skillId or customSkillName is provided, but not both
  if (!value.skillId && !value.customSkillName) {
    return helpers.error('custom.missingBoth');
  }
  if (value.skillId && value.customSkillName) {
    return helpers.error('custom.bothProvided');
  }
  return value;
}).messages({
  'custom.missingBoth': 'Either skillId or customSkillName must be provided',
  'custom.bothProvided': 'Cannot provide both skillId and customSkillName'
});

// Get all levels
router.get('/', auth, async (req, res) => {
  try {
    const levels = await prisma.level.findMany({
      include: {
        levelSkills: {
          include: { skill: true },
          orderBy: { order: 'asc' },
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
        competitions: {
          include: {
            competition: true
          }
        },
        _count: {
          select: {
            levelSkills: true,
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

    // Batch-lookup DD info for all implicit skill names across all levels/routines
    const customNames = [...new Set(
      levels.flatMap(l => l.routines.flatMap(r =>
        r.routineSkills.filter(rs => rs.customSkillName).map(rs => rs.customSkillName)
      ))
    )];
    const ddMap = await lookupImplicitSkillDDs(customNames);

    // Transform the data to match the expected frontend structure
    const transformedLevels = levels.map(level => ({
      ...level,
      skills: flattenLevelSkills(level.levelSkills),
      _count: { ...level._count, skills: level._count.levelSkills },
      routines: level.routines.map(routine => ({
        ...routine,
        skills: transformRoutineSkills(routine.routineSkills, level.id, ddMap)
      })),
      competitions: level.competitions.map(lc => lc.competition),
      competitionLevel: level.competitions.map(lc => lc.competition.code) // For backward compatibility
    }));

    res.json(transformedLevels);
  } catch (error) {
    console.error('Get levels error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new level (club admins only)
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error, value } = levelCreateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { identifier, name, description, type, competitionIds } = value;

    // Check if a level with this identifier already exists in this club
    const existingLevel = await prisma.level.findFirst({
      where: { 
        identifier,
        clubId: req.user.clubId
      }
    });

    if (existingLevel) {
      return res.status(400).json({ error: `A level with identifier "${identifier}" already exists` });
    }

    // Calculate level number for ordering purposes
    let levelNumber = 1;
    if (type === 'SEQUENTIAL') {
      // For sequential levels, try to parse the identifier as a number
      const parsed = parseInt(identifier);
      if (!isNaN(parsed)) {
        levelNumber = parsed;
      } else {
        // If not a number, find the next available number
        const highestLevel = await prisma.level.findFirst({
          where: { 
            clubId: req.user.clubId,
            type: 'SEQUENTIAL'
          },
          orderBy: { number: 'desc' }
        });
        levelNumber = highestLevel ? highestLevel.number + 1 : 1;
      }
    } else {
      // For side paths, extract base number (e.g., "3a" -> 3)
      const match = identifier.match(/^(\d+)/);
      if (match) {
        levelNumber = parseInt(match[1]);
      }
    }

    // Start a transaction to create level and competitions
    const result = await prisma.$transaction(async (prisma) => {
      // Create the level
      const level = await prisma.level.create({
        data: {
          identifier,
          name,
          description,
          type,
          number: levelNumber,
          clubId: req.user.clubId
        }
      });

      // Handle competition associations if provided
      if (competitionIds && competitionIds.length > 0) {
        // Verify all competitions exist
        const competitions = await prisma.competition.findMany({
          where: { id: { in: competitionIds } }
        });

        if (competitions.length !== competitionIds.length) {
          throw new Error('Some competitions not found or do not belong to your club');
        }

        // Create competition associations
        await prisma.levelCompetition.createMany({
          data: competitionIds.map(competitionId => ({
            levelId: level.id,
            competitionId
          }))
        });
      }

      // Return the created level with all relationships
      return await prisma.level.findUnique({
        where: { id: level.id },
        include: {
          levelSkills: {
            include: { skill: true },
            orderBy: { order: 'asc' },
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
          competitions: {
            include: {
              competition: true
            }
          }
        }
      });
    });

    // Transform the data to match the expected frontend structure
    const customNames1 = [...new Set(result.routines.flatMap(r => r.routineSkills.filter(rs => rs.customSkillName).map(rs => rs.customSkillName)))];
    const ddMap1 = await lookupImplicitSkillDDs(customNames1);
    const transformedLevel = {
      ...result,
      skills: flattenLevelSkills(result.levelSkills),
      routines: result.routines.map(routine => ({
        ...routine,
        skills: transformRoutineSkills(routine.routineSkills, result.id, ddMap1)
      })),
      competitions: result.competitions.map(lc => lc.competition),
      competitionLevel: result.competitions.map(lc => lc.competition.code) // For backward compatibility
    };

    res.status(201).json(transformedLevel);
  } catch (error) {
    console.error('Create level error:', error);
    if (error.message === 'Some competitions not found or do not belong to your club') {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: `A level with identifier "${req.body.identifier}" already exists` });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a level (club admins only)
router.put('/:levelId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId } = req.params;
    const { error, value } = levelUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, competitionIds } = value;

    // Start a transaction to update level and competitions
    const result = await prisma.$transaction(async (prisma) => {
      // Update the level basic info
      const level = await prisma.level.update({
        where: { id: levelId },
        data: {
          name,
          description
        }
      });

      // Handle competition associations if provided
      if (competitionIds !== undefined) {
        // Remove existing associations
        await prisma.levelCompetition.deleteMany({
          where: { levelId }
        });

        // Add new associations
        if (competitionIds.length > 0) {
          // Verify all competitions exist
          const competitions = await prisma.competition.findMany({
            where: { id: { in: competitionIds } }
          });

          if (competitions.length !== competitionIds.length) {
            throw new Error('Some competitions not found');
          }

          // Create new associations
          await prisma.levelCompetition.createMany({
            data: competitionIds.map(competitionId => ({
              levelId,
              competitionId
            }))
          });
        }
      }

      // Return the updated level with all relationships
      return await prisma.level.findUnique({
        where: { id: levelId },
        include: {
          levelSkills: {
            include: { skill: true },
            orderBy: { order: 'asc' },
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
          competitions: {
            include: {
              competition: true
            }
          }
        }
      });
    });

    // Transform the data to match the expected frontend structure
    const customNames2 = [...new Set(result.routines.flatMap(r => r.routineSkills.filter(rs => rs.customSkillName).map(rs => rs.customSkillName)))];
    const ddMap2 = await lookupImplicitSkillDDs(customNames2);
    const transformedLevel = {
      ...result,
      skills: flattenLevelSkills(result.levelSkills),
      routines: result.routines.map(routine => ({
        ...routine,
        skills: transformRoutineSkills(routine.routineSkills, result.id, ddMap2)
      })),
      competitions: result.competitions.map(lc => lc.competition),
      competitionLevel: result.competitions.map(lc => lc.competition.code) // For backward compatibility
    };

    res.json(transformedLevel);
  } catch (error) {
    console.error('Update level error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Level not found' });
    }
    if (error.message === 'Some competitions not found') {
      return res.status(400).json({ error: 'Some competitions not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a skill within a level (club admins only)
router.post('/:levelId/skills', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId } = req.params;

    const level = await prisma.level.findUnique({ where: { id: levelId } });
    if (!level) return res.status(404).json({ error: 'Level not found' });

    // Two body shapes: { skillId, order? } to attach existing, or full skill data to create+attach.
    if (req.body && typeof req.body.skillId === 'string') {
      const { skillId, order: orderInput } = req.body;
      const skill = await prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill) return res.status(404).json({ error: 'Skill not found' });
      if (skill.archivedAt) return res.status(400).json({ error: 'Skill is archived. Restore it before attaching to a level.' });

      const already = await prisma.levelSkill.findUnique({
        where: { levelId_skillId: { levelId, skillId } },
      });
      if (already) return res.status(400).json({ error: 'Skill already attached to this level' });

      let order = orderInput;
      if (!order) {
        const last = await prisma.levelSkill.findFirst({ where: { levelId }, orderBy: { order: 'desc' } });
        order = last ? last.order + 1 : 1;
      }
      const updated = await prisma.$transaction(async (tx) => {
        await tx.levelSkill.create({ data: { levelId, skillId, order } });
        // If the skill had no primary level (library skill), set it now so legacy
        // queries that read skill.level resolve to something.
        if (!skill.levelId) {
          await tx.skill.update({ where: { id: skillId }, data: { levelId } });
        }
        return await tx.skill.findUnique({ where: { id: skillId } });
      });
      return res.json({ ...updated, order });
    }

    // Otherwise: create a new skill and attach in one transaction.
    const { error, value } = skillCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    let order = value.order;
    if (!order) {
      const last = await prisma.levelSkill.findFirst({ where: { levelId }, orderBy: { order: 'desc' } });
      order = last ? last.order + 1 : 1;
    }
    const { order: _omit, ...skillData } = value;

    const created = await prisma.$transaction(async (tx) => {
      const skill = await tx.skill.create({ data: { ...skillData, levelId } });
      await tx.levelSkill.create({ data: { levelId, skillId: skill.id, order } });
      return { ...skill, order };
    });

    res.json(created);
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a skill (club admins only). The `order` field updates the LevelSkill row;
// all other fields update the Skill row directly.
router.put('/:levelId/skills/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, skillId } = req.params;
    const { error, value } = skillUpdateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify the skill is attached to this level
    const link = await prisma.levelSkill.findUnique({
      where: { levelId_skillId: { levelId, skillId } },
    });
    if (!link) return res.status(404).json({ error: 'Skill not found in this level' });

    const { order, ...skillFields } = value;
    const updated = await prisma.$transaction(async (tx) => {
      const skill = await tx.skill.update({ where: { id: skillId }, data: skillFields });
      let finalOrder = link.order;
      if (order != null && order !== link.order) {
        await tx.levelSkill.update({ where: { id: link.id }, data: { order } });
        finalOrder = order;
      }
      return { ...skill, order: finalOrder };
    });

    res.json(updated);
  } catch (error) {
    console.error('Update skill error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Detach a skill from a level. The Skill row is preserved (it may be attached to
// other levels and may have progress / routine references). Use the dedicated
// DELETE /api/skills/:skillId endpoint to fully remove a skill from the library.
router.delete('/:levelId/skills/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, skillId } = req.params;

    const link = await prisma.levelSkill.findUnique({
      where: { levelId_skillId: { levelId, skillId } },
    });
    if (!link) return res.status(404).json({ error: 'Skill not attached to this level' });

    await prisma.$transaction(async (tx) => {
      await tx.levelSkill.delete({ where: { id: link.id } });
      // If this was the primary level, repoint to another attached level (or
      // null if none remain).
      const skill = await tx.skill.findUnique({ where: { id: skillId } });
      if (skill && skill.levelId === levelId) {
        const next = await tx.levelSkill.findFirst({ where: { skillId }, orderBy: { order: 'asc' } });
        await tx.skill.update({ where: { id: skillId }, data: { levelId: next ? next.levelId : null } });
      }
    });

    res.json({ message: 'Skill removed from level' });
  } catch (error) {
    console.error('Detach skill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a routine within a level (club admins only)
router.post('/:levelId/routines', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId } = req.params;
    const { error, value } = routineCreateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, isAlternative, order } = value;

    // Check if level exists
    const level = await prisma.level.findUnique({
      where: { id: levelId }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    // If no order specified, add to the end
    let routineOrder = order;
    if (!routineOrder) {
      const lastRoutine = await prisma.routine.findFirst({
        where: { levelId },
        orderBy: { order: 'desc' }
      });
      routineOrder = lastRoutine ? lastRoutine.order + 1 : 1;
    }

    const routine = await prisma.routine.create({
      data: {
        name,
        description,
        levelId,
        order: routineOrder,
        isAlternative
      },
      include: {
        routineSkills: {
          include: {
            skill: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    // Transform the data to match the expected frontend structure
    const customNames3 = routine.routineSkills.filter(rs => rs.customSkillName).map(rs => rs.customSkillName);
    const ddMap3 = await lookupImplicitSkillDDs(customNames3);
    const transformedRoutine = {
      ...routine,
      skills: transformRoutineSkills(routine.routineSkills, routine.levelId, ddMap3)
    };

    res.json(transformedRoutine);
  } catch (error) {
    console.error('Create routine error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a routine (club admins only)
router.put('/:levelId/routines/:routineId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId } = req.params;
    const { error, value } = routineUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify routine belongs to the level
    const existingRoutine = await prisma.routine.findUnique({
      where: { id: routineId }
    });

    if (!existingRoutine || existingRoutine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    const routine = await prisma.routine.update({
      where: { id: routineId },
      data: value,
      include: {
        routineSkills: {
          include: {
            skill: true
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    // Transform the data to match the expected frontend structure
    const customNames4 = routine.routineSkills.filter(rs => rs.customSkillName).map(rs => rs.customSkillName);
    const ddMap4 = await lookupImplicitSkillDDs(customNames4);
    const transformedRoutine = {
      ...routine,
      skills: transformRoutineSkills(routine.routineSkills, routine.levelId, ddMap4)
    };

    res.json(transformedRoutine);
  } catch (error) {
    console.error('Update routine error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Routine not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a routine (club admins only)
router.delete('/:levelId/routines/:routineId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId } = req.params;

    // Verify routine belongs to the level
    const existingRoutine = await prisma.routine.findUnique({
      where: { id: routineId }
    });

    if (!existingRoutine || existingRoutine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    // Check if routine has any progress records
    const progressRecords = await prisma.routineProgress.findMany({
      where: { routineId }
    });

    if (progressRecords.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete routine that has progress records. This would affect gymnast progress tracking.' 
      });
    }

    // Check if routine is referenced in level progress
    const levelProgressRecords = await prisma.levelProgress.findMany({
      where: { routineId }
    });

    if (levelProgressRecords.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete routine that is referenced in level progress records.' 
      });
    }

    // Delete routine skills first (cascading should handle this but being explicit)
    await prisma.routineSkill.deleteMany({
      where: { routineId }
    });

    // Delete the routine
    await prisma.routine.delete({
      where: { id: routineId }
    });

    res.json({ message: 'Routine deleted successfully' });
  } catch (error) {
    console.error('Delete routine error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a skill to a routine (club admins only)
router.post('/:levelId/routines/:routineId/skills', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId } = req.params;
    const { error, value } = routineSkillSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { skillId, customSkillName, order, difficulty: ddOverride, figNotation: figOverride } = value;

    // Verify routine belongs to the level
    const existingRoutine = await prisma.routine.findUnique({
      where: { id: routineId }
    });

    if (!existingRoutine || existingRoutine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    let skill;
    
    if (customSkillName) {
      // Handle custom skill - create a temporary skill object for the response
      skill = {
        id: `custom_${Date.now()}`, // Temporary ID for custom skills
        name: customSkillName,
        description: null,
        levelId: levelId,
        order: 999,
        isImplicit: true // Flag to indicate this is a custom skill
      };
    } else {
      // Handle existing skill
      skill = await prisma.skill.findUnique({
        where: { id: skillId }
      });

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      // Duplicates allowed — same skill can appear multiple times in a routine
      // (transitions, repeat moves). The frontend dedupes by skillId for total DD.
    }

    // If no order specified, add to the end
    let skillOrder = order;
    if (!skillOrder) {
      const lastRoutineSkill = await prisma.routineSkill.findFirst({
        where: { routineId },
        orderBy: { order: 'desc' }
      });
      skillOrder = lastRoutineSkill ? lastRoutineSkill.order + 1 : 1;
    }

    if (customSkillName) {
      // For custom skills, create a RoutineSkill record with customSkillName.
      // Per-routine difficulty / fig overrides are stored on the row itself.
      const routineSkill = await prisma.routineSkill.create({
        data: {
          routineId,
          skillId: null,
          customSkillName,
          difficulty: ddOverride ?? null,
          figNotation: figOverride || null,
          order: skillOrder,
        }
      });

      const ddMap5 = await lookupImplicitSkillDDs([customSkillName]);
      const dd = ddMap5[customSkillName] || {};
      res.json({
        skill: {
          id: routineSkill.id,
          name: customSkillName,
          description: null,
          order: skillOrder,
          isImplicit: true,
          difficulty: routineSkill.difficulty ?? dd.difficulty ?? null,
          figNotation: routineSkill.figNotation ?? dd.figNotation ?? null,
        },
        routineSkill,
      });
      return;
    } else {
      // For existing skills, create the routine-skill connection
      const routineSkill = await prisma.routineSkill.create({
        data: {
          routineId,
          skillId,
          order: skillOrder
        },
        include: {
          skill: true
        }
      });

      res.json(routineSkill);
    }
  } catch (error) {
    console.error('Add skill to routine error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a skill from a routine (club admins only)
router.delete('/:levelId/routines/:routineId/skills/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId, skillId } = req.params;

    // Verify routine belongs to the level
    const existingRoutine = await prisma.routine.findUnique({
      where: { id: routineId }
    });

    if (!existingRoutine || existingRoutine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    // Find the routine skill — custom skills store rs.id as the skill id (no FK),
    // regular skills store the actual skill FK. Try both.
    let routineSkill = await prisma.routineSkill.findFirst({
      where: { id: skillId, routineId }
    });

    if (!routineSkill) {
      // Multiple rows may share the same skillId now that duplicates are allowed —
      // findFirst grabs the lowest-order match.
      routineSkill = await prisma.routineSkill.findFirst({
        where: { routineId, skillId },
        orderBy: { order: 'asc' },
      });
    }

    if (!routineSkill) {
      return res.status(404).json({ error: 'Skill not found in this routine' });
    }

    await prisma.routineSkill.delete({
      where: { id: routineSkill.id }
    });

    res.json({ message: 'Skill removed from routine successfully' });
  } catch (error) {
    console.error('Remove skill from routine error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reorder skills within a routine. Body: { routineSkillIds: [id, id, ...] }.
// Order in the array becomes the new order column (1-based).
router.put('/:levelId/routines/:routineId/reorder', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId } = req.params;
    const { routineSkillIds } = req.body || {};

    if (!Array.isArray(routineSkillIds) || routineSkillIds.length === 0) {
      return res.status(400).json({ error: 'routineSkillIds array required' });
    }

    const routine = await prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine || routine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    const existing = await prisma.routineSkill.findMany({ where: { routineId }, select: { id: true } });
    const existingIds = new Set(existing.map(rs => rs.id));
    if (routineSkillIds.length !== existingIds.size || routineSkillIds.some(id => !existingIds.has(id))) {
      return res.status(400).json({ error: 'routineSkillIds must contain every routine skill id exactly once' });
    }

    await prisma.$transaction(
      routineSkillIds.map((id, idx) =>
        prisma.routineSkill.update({ where: { id }, data: { order: idx + 1 } })
      )
    );

    res.json({ message: 'Order updated' });
  } catch (error) {
    console.error('Reorder routine skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Replace a routine skill with a different (tracked or implicit) skill, keeping its order.
// Body: { skillId } (tracked) OR { customSkillName } (implicit).
// The :routineSkillId param accepts either a RoutineSkill.id (used for implicit
// skills in the frontend) or the underlying Skill.id (used for tracked skills) —
// matches the existing DELETE behaviour to keep the frontend simple.
router.put('/:levelId/routines/:routineId/skills/:routineSkillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, routineId, routineSkillId } = req.params;
    const { skillId, customSkillName, difficulty: ddOverride, figNotation: figOverride } = req.body || {};

    if ((!skillId && !customSkillName) || (skillId && customSkillName)) {
      return res.status(400).json({ error: 'Provide exactly one of skillId or customSkillName' });
    }

    const routine = await prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine || routine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    let routineSkill = await prisma.routineSkill.findFirst({ where: { id: routineSkillId, routineId } });
    if (!routineSkill) {
      routineSkill = await prisma.routineSkill.findFirst({
        where: { routineId, skillId: routineSkillId },
        orderBy: { order: 'asc' },
      });
    }
    if (!routineSkill) return res.status(404).json({ error: 'Routine skill not found' });

    if (skillId) {
      const skill = await prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill) return res.status(404).json({ error: 'Replacement skill not found' });

      // Duplicates allowed — replacing with a tracked skill clears any per-row
      // override (difficulty and figNotation come from the linked Skill row).
      const updated = await prisma.routineSkill.update({
        where: { id: routineSkill.id },
        data: { skillId, customSkillName: null, difficulty: null, figNotation: null },
        include: { skill: true },
      });
      return res.json(updated);
    }

    // Implicit / custom name. Apply overrides if provided; otherwise clear.
    const updated = await prisma.routineSkill.update({
      where: { id: routineSkill.id },
      data: {
        customSkillName: customSkillName.trim(),
        skillId: null,
        difficulty: ddOverride ?? null,
        figNotation: figOverride || null,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Replace routine skill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available skills for adding to routines (coaches and club admins only).
// Returns all skills with their levels via the join. The frontend treats the
// first attached level as `level` for backward compatibility.
router.get('/:levelId/available-skills', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const skills = await prisma.skill.findMany({
      where: { archivedAt: null },
      include: {
        levelSkills: {
          include: {
            level: { select: { id: true, name: true, identifier: true, number: true } },
          },
          orderBy: { level: { number: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Shape compatible with the routine search modal: first level surfaces as `level`,
    // full list as `levels`. Library-only skills get a placeholder.
    const shaped = skills.map(s => {
      const levels = s.levelSkills.map(ls => ls.level);
      return {
        ...s,
        levels,
        level: levels[0] ?? { id: null, name: 'Library', identifier: '—' },
      };
    });

    res.json(shaped);
  } catch (error) {
    console.error('Get available skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 