const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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

const skillCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  order: Joi.number().integer().min(1).optional()
});

const skillUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  order: Joi.number().integer().min(1).optional()
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
  skillId: Joi.string().required(),
  order: Joi.number().integer().min(1).optional()
});

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
        competitions: {
          include: {
            competition: true
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
        // Verify all competitions exist and belong to same club
        const competitions = await prisma.competition.findMany({
          where: { 
            id: { in: competitionIds },
            clubId: req.user.clubId
          }
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
          competitions: {
            include: {
              competition: true
            }
          }
        }
      });
    });

    // Transform the data to match the expected frontend structure
    const transformedLevel = {
      ...result,
      routines: result.routines.map(routine => ({
        ...routine,
        skills: routine.routineSkills.map(rs => rs.skill)
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
          competitions: {
            include: {
              competition: true
            }
          }
        }
      });
    });

    // Transform the data to match the expected frontend structure
    const transformedLevel = {
      ...result,
      routines: result.routines.map(routine => ({
        ...routine,
        skills: routine.routineSkills.map(rs => rs.skill)
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
    const { error, value } = skillCreateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, order } = value;

    // Check if level exists
    const level = await prisma.level.findUnique({
      where: { id: levelId }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    // If no order specified, add to the end
    let skillOrder = order;
    if (!skillOrder) {
      const lastSkill = await prisma.skill.findFirst({
        where: { levelId },
        orderBy: { order: 'desc' }
      });
      skillOrder = lastSkill ? lastSkill.order + 1 : 1;
    }

    const skill = await prisma.skill.create({
      data: {
        name,
        description,
        levelId,
        order: skillOrder
      }
    });

    res.json(skill);
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a skill (club admins only)
router.put('/:levelId/skills/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, skillId } = req.params;
    const { error, value } = skillUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify skill belongs to the level
    const existingSkill = await prisma.skill.findUnique({
      where: { id: skillId }
    });

    if (!existingSkill || existingSkill.levelId !== levelId) {
      return res.status(404).json({ error: 'Skill not found in this level' });
    }

    const skill = await prisma.skill.update({
      where: { id: skillId },
      data: value
    });

    res.json(skill);
  } catch (error) {
    console.error('Update skill error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a skill (club admins only)
router.delete('/:levelId/skills/:skillId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { levelId, skillId } = req.params;

    // Verify skill belongs to the level
    const existingSkill = await prisma.skill.findUnique({
      where: { id: skillId }
    });

    if (!existingSkill || existingSkill.levelId !== levelId) {
      return res.status(404).json({ error: 'Skill not found in this level' });
    }

    // Check if skill is used in any routine skills
    const routineSkillUsage = await prisma.routineSkill.findMany({
      where: { skillId }
    });

    if (routineSkillUsage.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete skill that is used in routines. Remove it from routines first.' 
      });
    }

    // Check if skill has any progress records
    const progressRecords = await prisma.skillProgress.findMany({
      where: { skillId }
    });

    if (progressRecords.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete skill that has progress records. This would affect gymnast progress tracking.' 
      });
    }

    await prisma.skill.delete({
      where: { id: skillId }
    });

    res.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    console.error('Delete skill error:', error);
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
    const transformedRoutine = {
      ...routine,
      skills: routine.routineSkills.map(rs => rs.skill)
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
    const transformedRoutine = {
      ...routine,
      skills: routine.routineSkills.map(rs => rs.skill)
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

    const { skillId, order } = value;

    // Verify routine belongs to the level
    const existingRoutine = await prisma.routine.findUnique({
      where: { id: routineId }
    });

    if (!existingRoutine || existingRoutine.levelId !== levelId) {
      return res.status(404).json({ error: 'Routine not found in this level' });
    }

    // Verify skill exists (can be from any level)
    const skill = await prisma.skill.findUnique({
      where: { id: skillId }
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check if skill is already in this routine
    const existingRoutineSkill = await prisma.routineSkill.findUnique({
      where: {
        routineId_skillId: {
          routineId,
          skillId
        }
      }
    });

    if (existingRoutineSkill) {
      return res.status(400).json({ error: 'Skill is already in this routine' });
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

    // Find and delete the routine skill
    const routineSkill = await prisma.routineSkill.findUnique({
      where: {
        routineId_skillId: {
          routineId,
          skillId
        }
      }
    });

    if (!routineSkill) {
      return res.status(404).json({ error: 'Skill not found in this routine' });
    }

    await prisma.routineSkill.delete({
      where: {
        routineId_skillId: {
          routineId,
          skillId
        }
      }
    });

    res.json({ message: 'Skill removed from routine successfully' });
  } catch (error) {
    console.error('Remove skill from routine error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available skills for adding to routines (coaches and club admins only)
router.get('/:levelId/available-skills', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { levelId } = req.params;

    // Get all skills across all levels for routine building
    const skills = await prisma.skill.findMany({
      include: {
        level: {
          select: {
            id: true,
            name: true,
            identifier: true
          }
        }
      },
      orderBy: [
        {
          level: {
            number: 'asc'
          }
        },
        {
          level: {
            identifier: 'asc'
          }
        },
        {
          order: 'asc'
        }
      ]
    });

    res.json(skills);
  } catch (error) {
    console.error('Get available skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 