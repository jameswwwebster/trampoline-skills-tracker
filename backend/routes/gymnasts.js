const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createGymnastSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  dateOfBirth: Joi.date().optional(),
  guardianEmails: Joi.array().items(Joi.string().email()).optional()
});

const updateGymnastSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  dateOfBirth: Joi.date().optional(),
  coachNotes: Joi.string().allow('').optional()
});

// Get children for current parent/guardian
router.get('/my-children', auth, requireRole(['PARENT']), async (req, res) => {
  try {
    const myChildren = await prisma.gymnast.findMany({
      where: {
        isArchived: false, // Don't show archived children to parents
        guardians: {
          some: {
            id: req.user.id
          }
        }
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        skillProgress: {
          where: {
            status: 'COMPLETED'
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
            }
          }
        },
        levelProgress: {
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
        _count: {
          select: {
            skillProgress: {
              where: {
                status: 'COMPLETED'
              }
            }
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Calculate current level for each gymnast
    const childrenWithProgress = myChildren.map(gymnast => {
      // Get highest completed level
      const completedLevels = gymnast.levelProgress
        .filter(lp => lp.status === 'COMPLETED')
        .map(lp => {
          const level = lp.level;
          return {
            ...level,
            competitionLevel: level.competitions ? level.competitions.map(lc => lc.competition.code) : []
          };
        })
        .sort((a, b) => {
          // Sort by number, handling side paths (e.g., 3a, 3b)
          const aNum = parseFloat(a.number);
          const bNum = parseFloat(b.number);
          return aNum - bNum;
        });

      // Get current working level (highest incomplete level with progress)
      const workingLevels = gymnast.levelProgress
        .filter(lp => lp.status !== 'COMPLETED')
        .map(lp => {
          const level = lp.level;
          return {
            ...level,
            competitionLevel: level.competitions ? level.competitions.map(lc => lc.competition.code) : []
          };
        })
        .sort((a, b) => {
          const aNum = parseFloat(a.number);
          const bNum = parseFloat(b.number);
          return aNum - bNum;
        });

      const currentLevel = completedLevels.length > 0 ? completedLevels[completedLevels.length - 1] : null;
      const workingLevel = workingLevels.length > 0 ? workingLevels[0] : null;

      return {
        ...gymnast,
        currentLevel,
        workingLevel,
        completedLevelsCount: completedLevels.length,
        completedSkillsCount: gymnast._count.skillProgress
      };
    });

    res.json(childrenWithProgress);
  } catch (error) {
    console.error('Get my children error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all gymnasts in current user's club
router.get('/', auth, async (req, res) => {
  try {
    const { includeArchived } = req.query;
    
    // Build where clause
    const whereClause = {
      clubId: req.user.clubId
    };
    
    // Only include archived gymnasts if explicitly requested
    if (includeArchived !== 'true') {
      whereClause.isArchived = false;
    }
    
    const gymnasts = await prisma.gymnast.findMany({
      where: whereClause,
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        skillProgress: {
          where: {
            status: 'COMPLETED'
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
            }
          }
        },
        levelProgress: {
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
        _count: {
          select: {
            skillProgress: {
              where: {
                status: 'COMPLETED'
              }
            }
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Calculate current level for each gymnast
    const gymnastsWithProgress = gymnasts.map(gymnast => {
      // Get highest completed level
      const completedLevels = gymnast.levelProgress
        .filter(lp => lp.status === 'COMPLETED')
        .map(lp => {
          const level = lp.level;
          return {
            ...level,
            competitionLevel: level.competitions ? level.competitions.map(lc => lc.competition.code) : []
          };
        })
        .sort((a, b) => {
          // Sort by number, handling side paths (e.g., 3a, 3b)
          const aNum = parseFloat(a.number);
          const bNum = parseFloat(b.number);
          return aNum - bNum;
        });

      // Get current working level (highest incomplete level with progress)
      const workingLevels = gymnast.levelProgress
        .filter(lp => lp.status !== 'COMPLETED')
        .map(lp => {
          const level = lp.level;
          return {
            ...level,
            competitionLevel: level.competitions ? level.competitions.map(lc => lc.competition.code) : []
          };
        })
        .sort((a, b) => {
          const aNum = parseFloat(a.number);
          const bNum = parseFloat(b.number);
          return aNum - bNum;
        });

      const currentLevel = completedLevels.length > 0 ? completedLevels[completedLevels.length - 1] : null;
      const workingLevel = workingLevels.length > 0 ? workingLevels[0] : null;

      return {
        ...gymnast,
        currentLevel,
        workingLevel,
        completedLevelsCount: completedLevels.length,
        completedSkillsCount: gymnast._count.skillProgress
      };
    });

    res.json(gymnastsWithProgress);
  } catch (error) {
    console.error('Get gymnasts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new gymnast
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = createGymnastSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName, dateOfBirth, guardianEmails } = value;

    // Check if guardians exist in the system
    let guardians = [];
    if (guardianEmails && guardianEmails.length > 0) {
      guardians = await prisma.user.findMany({
        where: {
          email: { in: guardianEmails },
          role: 'PARENT'
        }
      });

      // Check if all guardian emails exist
      const foundEmails = guardians.map(g => g.email);
      const missingEmails = guardianEmails.filter(email => !foundEmails.includes(email));
      
      if (missingEmails.length > 0) {
        return res.status(400).json({ 
          error: `Guardian accounts not found for emails: ${missingEmails.join(', ')}` 
        });
      }
    }

    // Create gymnast
    const gymnast = await prisma.gymnast.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        clubId: req.user.clubId,
        guardians: {
          connect: guardians.map(g => ({ id: g.id }))
        }
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            skillProgress: true,
            levelProgress: true
          }
        }
      }
    });

    res.status(201).json(gymnast);
  } catch (error) {
    console.error('Create gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific gymnast with detailed progress
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const gymnast = await prisma.gymnast.findUnique({
      where: { id },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        skillProgress: {
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
            }
          }
        },
        levelProgress: {
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
        routineProgress: {
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
            }
          }
        }
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check if user has permission to view this gymnast
    if (req.user.role === 'PARENT' && !gymnast.guardians.some(g => g.id === req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'GYMNAST' && gymnast.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (['CLUB_ADMIN', 'COACH'].includes(req.user.role) && gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Transform competition data for backward compatibility
    const transformedGymnast = {
      ...gymnast,
      skillProgress: gymnast.skillProgress.map(sp => ({
        ...sp,
        skill: {
          ...sp.skill,
          level: {
            ...sp.skill.level,
            competitionLevel: sp.skill.level.competitions ? sp.skill.level.competitions.map(lc => lc.competition.code) : []
          }
        }
      })),
      levelProgress: gymnast.levelProgress.map(lp => ({
        ...lp,
        level: {
          ...lp.level,
          competitionLevel: lp.level.competitions ? lp.level.competitions.map(lc => lc.competition.code) : []
        }
      }))
    };

    res.json(transformedGymnast);
  } catch (error) {
    console.error('Get gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update gymnast
router.put('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateGymnastSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName, dateOfBirth, coachNotes } = value;

    // Check if gymnast exists and belongs to user's club
    const existingGymnast = await prisma.gymnast.findUnique({
      where: { id }
    });

    if (!existingGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (existingGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const gymnast = await prisma.gymnast.update({
      where: { id },
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        coachNotes: coachNotes !== undefined ? coachNotes : undefined
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: {
            skillProgress: true,
            levelProgress: true
          }
        }
      }
    });

    res.json(gymnast);
  } catch (error) {
    console.error('Update gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update coach notes for a gymnast (coaches only)
router.patch('/:id/coach-notes', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { id } = req.params;
    const { coachNotes } = req.body;

    // Validate coach notes
    const schema = Joi.object({
      coachNotes: Joi.string().allow('').required()
    });

    const { error } = schema.validate({ coachNotes });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if gymnast exists and belongs to user's club
    const existingGymnast = await prisma.gymnast.findUnique({
      where: { id }
    });

    if (!existingGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (existingGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update coach notes
    const gymnast = await prisma.gymnast.update({
      where: { id },
      data: {
        coachNotes: coachNotes || null
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json(gymnast);
  } catch (error) {
    console.error('Update coach notes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Archive gymnast (soft delete)
router.patch('/:id/archive', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate reason
    const schema = Joi.object({
      reason: Joi.string().max(500).optional()
    });

    const { error } = schema.validate({ reason });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if gymnast exists and belongs to user's club
    const existingGymnast = await prisma.gymnast.findUnique({
      where: { id }
    });

    if (!existingGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (existingGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (existingGymnast.isArchived) {
      return res.status(400).json({ error: 'Gymnast is already archived' });
    }

    // Archive the gymnast
    const gymnast = await prisma.gymnast.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: req.user.id,
        archivedReason: reason || null
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        archivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Gymnast archived successfully',
      gymnast
    });
  } catch (error) {
    console.error('Archive gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore gymnast from archive
router.patch('/:id/restore', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if gymnast exists and belongs to user's club
    const existingGymnast = await prisma.gymnast.findUnique({
      where: { id }
    });

    if (!existingGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (existingGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!existingGymnast.isArchived) {
      return res.status(400).json({ error: 'Gymnast is not archived' });
    }

    // Restore the gymnast
    const gymnast = await prisma.gymnast.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        archivedReason: null
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Gymnast restored successfully',
      gymnast
    });
  } catch (error) {
    console.error('Restore gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Permanently delete gymnast (hard delete - use with caution)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmDelete } = req.body;

    if (!confirmDelete) {
      return res.status(400).json({ 
        error: 'Delete confirmation required. Set confirmDelete to true to proceed.' 
      });
    }

    // Check if gymnast exists and belongs to user's club
    const existingGymnast = await prisma.gymnast.findUnique({
      where: { id },
      include: {
        skillProgress: true,
        levelProgress: true,
        routineProgress: true,
        certificates: true
      }
    });

    if (!existingGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    if (existingGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if gymnast has progress data
    const hasProgressData = 
      existingGymnast.skillProgress.length > 0 ||
      existingGymnast.levelProgress.length > 0 ||
      existingGymnast.routineProgress.length > 0 ||
      existingGymnast.certificates.length > 0;

    if (hasProgressData) {
      return res.status(400).json({ 
        error: 'Cannot delete gymnast with progress data. Consider archiving instead.',
        suggestion: 'Use the archive endpoint to preserve historical data while hiding the gymnast.'
      });
    }

    // Delete the gymnast (this will cascade to related records)
    await prisma.gymnast.delete({
      where: { id }
    });

    res.json({
      message: 'Gymnast deleted permanently',
      gymnastId: id
    });
  } catch (error) {
    console.error('Delete gymnast error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;