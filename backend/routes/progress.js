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
  completedAt: Joi.date().optional()
});

// Get progress for a specific gymnast
router.get('/gymnast/:gymnastId', auth, requireGymnastAccess, async (req, res) => {
  try {
    const { gymnastId } = req.params;

    const [skillProgress, levelProgress, routineProgress] = await Promise.all([
      prisma.skillProgress.findMany({
        where: {
          gymnastId
        },
        include: {
          skill: {
            include: {
              level: {
                include: {
                  competitions: {
                    include: {
                      competition: true
                    }
                  }
                }
              }
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
          level: {
            include: {
              competitions: {
                include: {
                  competition: true
                }
              }
            }
          },
          routine: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.routineProgress.findMany({
        where: {
          gymnastId
        },
        include: {
          routine: {
            include: {
              level: {
                include: {
                  competitions: {
                    include: {
                      competition: true
                    }
                  }
                }
              },
              routineSkills: {
                include: {
                  skill: true
                },
                orderBy: {
                  order: 'asc'
                }
              }
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      })
    ]);

    // Transform competition data for backward compatibility
    const transformedSkillProgress = skillProgress.map(item => ({
      ...item,
      skill: {
        ...item.skill,
        level: {
          ...item.skill.level,
          competitionLevel: item.skill.level.competitions ? item.skill.level.competitions.map(lc => lc.competition.code) : []
        }
      }
    }));

    const transformedLevelProgress = levelProgress.map(item => ({
      ...item,
      level: {
        ...item.level,
        competitionLevel: item.level.competitions ? item.level.competitions.map(lc => lc.competition.code) : []
      }
    }));

    const transformedRoutineProgress = routineProgress.map(item => ({
      ...item,
      routine: {
        ...item.routine,
        level: {
          ...item.routine.level,
          competitionLevel: item.routine.level.competitions ? item.routine.level.competitions.map(lc => lc.competition.code) : []
        }
      }
    }));

    res.json({
      skillProgress: transformedSkillProgress,
      levelProgress: transformedLevelProgress,
      routineProgress: transformedRoutineProgress
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

    // Check if level should be automatically completed when skill is completed
    if (status === 'COMPLETED') {
      await checkAndCompleteLevel(gymnastId, skill.level.id, req.user.id);
    } else if (existingProgress && existingProgress.status === 'COMPLETED' && status !== 'COMPLETED') {
      // If skill was completed but now marked as incomplete, invalidate level completion
      await checkAndInvalidateLevel(gymnastId, skill.level.id, req.user.id);
    }

    res.json(progressRecord);
  } catch (error) {
    console.error('Mark skill progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete all skills in a level (coaches only)
router.post('/level/:levelId/complete', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { levelId } = req.params;
    const { gymnastId } = req.body;

    if (!gymnastId) {
      return res.status(400).json({ error: 'Gymnast ID is required' });
    }

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

    // Verify level exists and get all skills
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      include: {
        skills: true
      }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    if (level.skills.length === 0) {
      return res.status(400).json({ error: 'No skills found in this level' });
    }

    // Mark all skills as completed
    const completedSkills = [];
    
    for (const skill of level.skills) {
      const existingProgress = await prisma.skillProgress.findUnique({
        where: {
          gymnastId_skillId: {
            gymnastId,
            skillId: skill.id
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
              skillId: skill.id
            }
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
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
            skillId: skill.id,
            status: 'COMPLETED',
            completedAt: new Date(),
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

      completedSkills.push(progressRecord);
    }

    // Trigger automatic level completion check
    await checkAndCompleteLevel(gymnastId, levelId, req.user.id);

    res.json({
      message: `All ${level.skills.length} skills in ${level.name} have been marked as completed`,
      completedSkills,
      levelName: level.name,
      levelId: level.id
    });
  } catch (error) {
    console.error('Complete level error:', error);
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

    const { gymnastId, levelId, routineId, status, completedAt } = value;

    // Prevent manual completion - levels should only be completed automatically
    if (status === 'COMPLETED') {
      return res.status(400).json({ 
        error: 'Levels cannot be manually completed. They are automatically completed when all skills and routines are finished.' 
      });
    }

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

    if (req.user.role === 'GYMNAST' && gymnast.userId !== req.user.id) {
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
            level: {
              include: {
                competitions: {
                  include: {
                    competition: true
                  }
                }
              }
            }
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

    // Transform competition data for backward compatibility
    if (progress) {
      progress.skill.level.competitionLevel = progress.skill.level.competitions ? 
        progress.skill.level.competitions.map(lc => lc.competition.code) : [];
    }

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

    if (req.user.role === 'GYMNAST' && gymnast.userId !== req.user.id) {
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
              include: {
                competitions: {
                  include: {
                    competition: true
                  }
                }
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
          include: {
            competitions: {
              include: {
                competition: true
              }
            }
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
        levelInfo: {
          ...item.skill.level,
          competitionLevel: item.skill.level.competitions ? item.skill.level.competitions.map(lc => lc.competition.code) : []
        }
      })),
      ...levelProgressHistory.map(item => ({
        ...item,
        type: 'level',
        itemName: item.level.name,
        levelInfo: {
          ...item.level,
          competitionLevel: item.level.competitions ? item.level.competitions.map(lc => lc.competition.code) : []
        },
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

// Update or create routine progress
router.put('/routine', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { gymnastId, routineId, status, notes } = req.body;

    // Validation
    if (!gymnastId || !routineId || !status) {
      return res.status(400).json({ 
        error: 'gymnastId, routineId, and status are required' 
      });
    }

    if (!['NOT_STARTED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be NOT_STARTED or COMPLETED' 
      });
    }

    // Verify gymnast exists and user has access
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: { club: true }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (req.user.role !== 'CLUB_ADMIN' && gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify routine exists
    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      include: { level: true }
    });

    if (!routine) {
      return res.status(404).json({ error: 'Routine not found' });
    }

    // Check if routine was previously completed (before we update it)
    const existingRoutineProgress = await prisma.routineProgress.findUnique({
      where: {
        gymnastId_routineId: {
          gymnastId,
          routineId
        }
      }
    });

    // Update or create routine progress
    const routineProgress = await prisma.routineProgress.upsert({
      where: {
        gymnastId_routineId: {
          gymnastId,
          routineId
        }
      },
      update: {
        status,
        notes: notes || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        userId: req.user.id
      },
      create: {
        gymnastId,
        routineId,
        status,
        notes: notes || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        userId: req.user.id
      },
      include: {
        routine: {
          include: {
            level: true
          }
        },
        gymnast: true,
        user: true
      }
    });

    // Check if level should be automatically completed
    if (status === 'COMPLETED') {
      await checkAndCompleteLevel(gymnastId, routine.levelId, req.user.id);
    } else if (existingRoutineProgress && existingRoutineProgress.status === 'COMPLETED' && status !== 'COMPLETED') {
      // If routine was completed but now marked as incomplete, invalidate level completion
      await checkAndInvalidateLevel(gymnastId, routine.levelId, req.user.id);
    }

    res.json(routineProgress);
  } catch (error) {
    console.error('Update routine progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to check and complete level automatically
async function checkAndCompleteLevel(gymnastId, levelId, userId) {
  try {
    // Get level with skills and all routines (including alternatives)
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      include: {
        skills: true,
        routines: true // Include ALL routines (both primary and alternative)
      }
    });

    if (!level) return;

    // Check if all level skills are completed
    const completedSkills = await prisma.skillProgress.findMany({
      where: {
        gymnastId,
        skill: {
          levelId
        },
        status: 'COMPLETED'
      }
    });

    const allSkillsCompleted = completedSkills.length === level.skills.length;

    // Check if level has routines (side tracks typically don't have routines)
    const hasRoutines = level.routines.length > 0;
    let routineCompleted = true; // Default to true for levels without routines

    if (hasRoutines) {
      // Check if ANY routine is completed (alternative routines count!)
      const completedRoutines = await prisma.routineProgress.findMany({
        where: {
          gymnastId,
          routineId: {
            in: level.routines.map(r => r.id)
          },
          status: 'COMPLETED'
        }
      });

      routineCompleted = completedRoutines.length > 0;
    }

    // Complete level if all skills are done AND (no routines OR routines are completed)
    if (allSkillsCompleted && routineCompleted) {
      const routineId = hasRoutines && level.routines.length > 0 ? 
        (await prisma.routineProgress.findFirst({
          where: {
            gymnastId,
            routineId: {
              in: level.routines.map(r => r.id)
            },
            status: 'COMPLETED'
          }
        }))?.routineId : null;

      await prisma.levelProgress.upsert({
        where: {
          gymnastId_levelId: {
            gymnastId,
            levelId
          }
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
          userId,
          routineId: routineId
        },
        create: {
          gymnastId,
          levelId,
          status: 'COMPLETED',
          completedAt: new Date(),
          userId,
          routineId: routineId
        }
      });

      console.log(`✅ Level ${level.identifier} automatically completed for gymnast ${gymnastId}${hasRoutines ? ' (with routine)' : ' (side track)'}`);
      
      // Automatically award certificate for level completion
      await awardCertificateForLevel(gymnastId, levelId, userId);
    }
  } catch (error) {
    console.error('Error checking level completion:', error);
  }
}

// Helper function to check and invalidate level completion when skills/routines are marked incomplete
async function checkAndInvalidateLevel(gymnastId, levelId, userId) {
  try {
    // Check if level is currently completed
    const levelProgress = await prisma.levelProgress.findUnique({
      where: {
        gymnastId_levelId: {
          gymnastId,
          levelId
        }
      }
    });

    // If level is not completed, nothing to invalidate
    if (!levelProgress || levelProgress.status !== 'COMPLETED') {
      return;
    }

    // Get level with skills and all routines (including alternatives)
    const level = await prisma.level.findUnique({
      where: { id: levelId },
      include: {
        skills: true,
        routines: true // Include ALL routines (both primary and alternative)
      }
    });

    if (!level) return;

    // Check if all level skills are still completed
    const completedSkills = await prisma.skillProgress.findMany({
      where: {
        gymnastId,
        skill: {
          levelId
        },
        status: 'COMPLETED'
      }
    });

    const allSkillsCompleted = completedSkills.length === level.skills.length;

    // Check if level has routines (side tracks typically don't have routines)
    const hasRoutines = level.routines.length > 0;
    let routineCompleted = true; // Default to true for levels without routines

    if (hasRoutines) {
      // Check if ANY routine is still completed (alternative routines count!)
      const completedRoutines = await prisma.routineProgress.findMany({
        where: {
          gymnastId,
          routineId: {
            in: level.routines.map(r => r.id)
          },
          status: 'COMPLETED'
        }
      });

      routineCompleted = completedRoutines.length > 0;
    }

    // If conditions are no longer met, mark level as incomplete
    if (!allSkillsCompleted || !routineCompleted) {
      await prisma.levelProgress.update({
        where: {
          gymnastId_levelId: {
            gymnastId,
            levelId
          }
        },
        data: {
          status: 'IN_PROGRESS',
          completedAt: null,
          userId
        }
      });

      console.log(`❌ Level ${level.identifier} invalidated for gymnast ${gymnastId}${hasRoutines ? ' - skill or routine marked incomplete' : ' - skill marked incomplete (side track)'}`);
    }
  } catch (error) {
    console.error('Error checking level invalidation:', error);
  }
}

// Get routine progress for a gymnast
router.get('/gymnast/:gymnastId/routines', auth, async (req, res) => {
  try {
    const { gymnastId } = req.params;

    // Verify gymnast exists and user has access
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: { club: true }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (req.user.role !== 'CLUB_ADMIN' && gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get routine progress
    const routineProgress = await prisma.routineProgress.findMany({
      where: { gymnastId },
      include: {
        routine: {
          include: {
            level: true,
            routineSkills: {
              include: {
                skill: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        },
        user: true
      }
    });

    res.json(routineProgress);
  } catch (error) {
    console.error('Get routine progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to automatically award certificate for level completion
async function awardCertificateForLevel(gymnastId, levelId, userId) {
  try {
    // Check if certificate already exists for this gymnast and level
    const existingCertificate = await prisma.certificate.findUnique({
      where: {
        gymnastId_levelId_type: {
          gymnastId,
          levelId,
          type: 'LEVEL_COMPLETION'
        }
      }
    });

    // If certificate doesn't exist, create it
    if (!existingCertificate) {
      // Get gymnast and level info with relations for email
      const [gymnast, level, awardedBy] = await Promise.all([
        prisma.gymnast.findUnique({
          where: { id: gymnastId },
          include: {
            guardians: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            },
            club: {
              select: {
                id: true,
                name: true,
                emailEnabled: true
              }
            }
          }
        }),
        prisma.level.findUnique({
          where: { id: levelId },
          select: { id: true, identifier: true, name: true }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firstName: true, lastName: true }
        })
      ]);

      // Create the certificate
      const certificate = await prisma.certificate.create({
        data: {
          gymnastId,
          levelId,
          clubId: gymnast.clubId,
          type: 'LEVEL_COMPLETION',
          awardedById: userId,
          notes: 'Automatically awarded upon level completion'
        },
        include: {
          awardedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      console.log(`🏆 Certificate automatically awarded for ${level?.identifier} completion to gymnast ${gymnastId}`);

      // Send email notifications to all parents/guardians only if club has email enabled
      if (gymnast && gymnast.guardians && gymnast.guardians.length > 0 && gymnast.club.emailEnabled) {
        const emailService = require('../services/emailService');
        
        // Send notification to each guardian who is a parent
        for (const guardian of gymnast.guardians) {
          if (guardian.role === 'PARENT' && guardian.email) {
            try {
              await emailService.sendCertificateAwardNotification(
                guardian.email,
                guardian.firstName,
                gymnast,
                certificate,
                level
              );
              console.log(`📧 Certificate notification sent to parent: ${guardian.email}`);
            } catch (emailError) {
              console.error(`❌ Failed to send certificate notification to ${guardian.email}:`, emailError);
            }
          }
        }
      } else if (gymnast && gymnast.guardians && gymnast.guardians.length > 0 && !gymnast.club.emailEnabled) {
        console.log('📧 Certificate notification emails skipped - club has email disabled');
      }
    }
  } catch (error) {
    console.error('Error awarding certificate for level completion:', error);
  }
}

module.exports = router; 