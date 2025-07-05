const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireGymnastAccess, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const skillProgressSchema = Joi.object({
  gymnastId: Joi.string().required(),
  skillId: Joi.string().required(),
  status: Joi.string().valid('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').required(),
  notes: Joi.string().optional().allow(''),
  completedAt: Joi.date().optional()
});

const levelProgressSchema = Joi.object({
  gymnastId: Joi.string().required(),
  levelId: Joi.string().required(),
  routineId: Joi.string().optional(),
  status: Joi.string().valid('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED').required(),
  notes: Joi.string().optional().allow(''),
  completedAt: Joi.date().optional()
});

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

// Mark or update skill progress (coaches only)
router.post('/skill', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = skillProgressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { gymnastId, skillId, status, notes, completedAt } = value;

    // Verify gymnast belongs to coach's club
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify skill exists
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      include: {
        level: true
      }
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check if progress record already exists
    const existingProgress = await prisma.skillProgress.findUnique({
      where: {
        gymnastId_skillId: {
          gymnastId,
          skillId
        }
      }
    });

    let progressRecord;

    if (existingProgress) {
      // Update existing progress
      progressRecord = await prisma.skillProgress.update({
        where: {
          gymnastId_skillId: {
            gymnastId,
            skillId
          }
        },
        data: {
          status,
          notes: notes || null,
          completedAt: status === 'COMPLETED' ? (completedAt ? new Date(completedAt) : new Date()) : null,
          userId: req.user.id
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
      });
    } else {
      // Create new progress record
      progressRecord = await prisma.skillProgress.create({
        data: {
          gymnastId,
          skillId,
          status,
          notes: notes || null,
          completedAt: status === 'COMPLETED' ? (completedAt ? new Date(completedAt) : new Date()) : null,
          userId: req.user.id
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
      });
    }

    res.json(progressRecord);
  } catch (error) {
    console.error('Mark skill progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark or update level progress (coaches only)
router.post('/level', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = levelProgressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { gymnastId, levelId, routineId, status, notes, completedAt } = value;

    // Verify gymnast belongs to coach's club
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify level exists
    const level = await prisma.level.findUnique({
      where: { id: levelId }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    // Verify routine if provided
    if (routineId) {
      const routine = await prisma.routine.findUnique({
        where: { id: routineId }
      });

      if (!routine || routine.levelId !== levelId) {
        return res.status(400).json({ error: 'Invalid routine for this level' });
      }
    }

    // Check if progress record already exists
    const existingProgress = await prisma.levelProgress.findUnique({
      where: {
        gymnastId_levelId: {
          gymnastId,
          levelId
        }
      }
    });

    let progressRecord;

    if (existingProgress) {
      // Update existing progress
      progressRecord = await prisma.levelProgress.update({
        where: {
          gymnastId_levelId: {
            gymnastId,
            levelId
          }
        },
        data: {
          status,
          routineId: routineId || null,
          notes: notes || null,
          completedAt: status === 'COMPLETED' ? (completedAt ? new Date(completedAt) : new Date()) : null,
          userId: req.user.id
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
      });
    } else {
      // Create new progress record
      progressRecord = await prisma.levelProgress.create({
        data: {
          gymnastId,
          levelId,
          routineId: routineId || null,
          status,
          notes: notes || null,
          completedAt: status === 'COMPLETED' ? (completedAt ? new Date(completedAt) : new Date()) : null,
          userId: req.user.id
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
      });
    }

    res.json(progressRecord);
  } catch (error) {
    console.error('Mark level progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all skills for a level (for coaches to mark progress)
router.get('/level/:levelId/skills', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { levelId } = req.params;

    const level = await prisma.level.findUnique({
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
          }
        }
      }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    res.json(level);
  } catch (error) {
    console.error('Get level skills error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get progress history for a specific skill and gymnast
router.get('/skill/:skillId/gymnast/:gymnastId/history', auth, async (req, res) => {
  try {
    const { skillId, gymnastId } = req.params;

    // Check access permissions
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        guardians: true
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check if user has permission to view this gymnast's progress
    if (req.user.role === 'PARENT' && !gymnast.guardians.some(g => g.id === req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'GYMNAST' && gymnast.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (['CLUB_ADMIN', 'COACH'].includes(req.user.role) && gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const progress = await prisma.skillProgress.findUnique({
      where: {
        gymnastId_skillId: {
          gymnastId,
          skillId
        }
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
    });

    res.json(progress);
  } catch (error) {
    console.error('Get skill progress history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get complete progress history for a gymnast (new endpoint)
router.get('/gymnast/:gymnastId/history', auth, async (req, res) => {
  try {
    const { gymnastId } = req.params;

    // Check access permissions
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        guardians: true
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check if user has permission to view this gymnast's progress
    if (req.user.role === 'PARENT' && !gymnast.guardians.some(g => g.id === req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'GYMNAST' && gymnast.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (['CLUB_ADMIN', 'COACH'].includes(req.user.role) && gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all skill progress history
    const skillProgressHistory = await prisma.skillProgress.findMany({
      where: {
        gymnastId,
        status: 'COMPLETED' // Only show completed items in history
      },
      include: {
        skill: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
                number: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    // Get all level progress history
    const levelProgressHistory = await prisma.levelProgress.findMany({
      where: {
        gymnastId,
        status: 'COMPLETED' // Only show completed items in history
      },
      include: {
        level: {
          select: {
            id: true,
            name: true,
            number: true
          }
        },
        routine: {
          select: {
            id: true,
            name: true,
            order: true,
            isAlternative: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    // Combine and sort all progress items by completion date
    const combinedHistory = [
      ...skillProgressHistory.map(item => ({
        ...item,
        type: 'skill',
        itemName: item.skill.name,
        levelInfo: item.skill.level
      })),
      ...levelProgressHistory.map(item => ({
        ...item,
        type: 'level',
        itemName: item.level.name,
        levelInfo: item.level,
        routineInfo: item.routine
      }))
    ].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    // Get summary statistics
    const totalSkillsCompleted = skillProgressHistory.length;
    const totalLevelsCompleted = levelProgressHistory.length;
    const firstCompletion = combinedHistory.length > 0 ? 
      combinedHistory[combinedHistory.length - 1].completedAt : null;
    const latestCompletion = combinedHistory.length > 0 ? 
      combinedHistory[0].completedAt : null;

    // Group by month for timeline visualization
    const monthlyProgress = {};
    combinedHistory.forEach(item => {
      const month = new Date(item.completedAt).toISOString().substring(0, 7); // YYYY-MM format
      if (!monthlyProgress[month]) {
        monthlyProgress[month] = {
          month,
          skills: [],
          levels: []
        };
      }
      if (item.type === 'skill') {
        monthlyProgress[month].skills.push(item);
      } else {
        monthlyProgress[month].levels.push(item);
      }
    });

    const timelineData = Object.values(monthlyProgress).sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      history: combinedHistory,
      timeline: timelineData,
      summary: {
        totalSkillsCompleted,
        totalLevelsCompleted,
        firstCompletion,
        latestCompletion,
        totalDaysActive: firstCompletion && latestCompletion ? 
          Math.ceil((new Date(latestCompletion) - new Date(firstCompletion)) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (error) {
    console.error('Get progress history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 