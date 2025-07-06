const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const competitionCreateSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  code: Joi.string().min(1).max(50).required(),
  description: Joi.string().max(500).allow('', null),
  category: Joi.string().min(1).max(50).required().pattern(/^[A-Za-z0-9\s\-_]+$/).messages({
    'string.pattern.base': 'Category can only contain letters, numbers, spaces, hyphens, and underscores'
  }),
  order: Joi.number().integer().min(1).required(),
  isActive: Joi.boolean().default(true)
});

const competitionUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  code: Joi.string().min(1).max(50).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
  category: Joi.string().min(1).max(50).optional().pattern(/^[A-Za-z0-9\s\-_]+$/).messages({
    'string.pattern.base': 'Category can only contain letters, numbers, spaces, hyphens, and underscores'
  }),
  order: Joi.number().integer().min(1).optional(),
  isActive: Joi.boolean().optional()
});

// Get all competitions
router.get('/', auth, async (req, res) => {
  try {
    const competitions = await prisma.competition.findMany({
      include: {
        levels: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
                identifier: true,
                number: true
              }
            }
          }
        },
        _count: {
          select: {
            levels: true
          }
        }
      },
      orderBy: [
        {
          category: 'asc'
        },
        {
          order: 'asc'
        }
      ]
    });

    // Transform the data to include level information
    const transformedCompetitions = competitions.map(competition => ({
      ...competition,
      levelsCount: competition._count.levels,
      associatedLevels: competition.levels.map(lc => lc.level)
    }));

    res.json(transformedCompetitions);
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all existing categories (for dropdown options)
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await prisma.competition.findMany({
      select: {
        category: true
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc'
      }
    });

    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update/rename a category (club admins only)
router.put('/categories/:categoryName', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { newCategoryName } = req.body;

    if (!newCategoryName || newCategoryName.trim() === '') {
      return res.status(400).json({ error: 'New category name is required' });
    }

    // Validate new category name format
    const categoryPattern = /^[A-Za-z0-9\s\-_]+$/;
    if (!categoryPattern.test(newCategoryName)) {
      return res.status(400).json({ error: 'Category name can only contain letters, numbers, spaces, hyphens, and underscores' });
    }

    // Check if the old category exists
    const existingCompetitions = await prisma.competition.findMany({
      where: { category: categoryName }
    });

    if (existingCompetitions.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if new category name already exists (case-insensitive)
    const conflictingCompetitions = await prisma.competition.findMany({
      where: { 
        category: {
          equals: newCategoryName,
          mode: 'insensitive'
        }
      }
    });

    if (conflictingCompetitions.length > 0 && newCategoryName.toLowerCase() !== categoryName.toLowerCase()) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }

    // Update all competitions in this category
    const result = await prisma.competition.updateMany({
      where: { category: categoryName },
      data: { category: newCategoryName }
    });

    res.json({ 
      message: `Category "${categoryName}" renamed to "${newCategoryName}"`,
      updatedCount: result.count
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a category (club admins only)
router.delete('/categories/:categoryName', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { categoryName } = req.params;

    // Check if the category exists and count competitions
    const competitionsInCategory = await prisma.competition.findMany({
      where: { category: categoryName }
    });

    if (competitionsInCategory.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Don't allow deletion of categories that have competitions
    if (competitionsInCategory.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category "${categoryName}" because it contains ${competitionsInCategory.length} competition(s). Please move or delete all competitions in this category first.`,
        competitionsCount: competitionsInCategory.length,
        competitions: competitionsInCategory.map(c => ({ id: c.id, name: c.name }))
      });
    }

    // If we reach here, the category has no competitions (this shouldn't happen given the logic above, but keeping for safety)
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get competition categories and their counts
router.get('/stats/categories', auth, async (req, res) => {
  try {
    const categoryStats = await prisma.competition.groupBy({
      by: ['category'],
      _count: {
        id: true
      },
      orderBy: {
        category: 'asc'
      }
    });

    const totalCompetitions = await prisma.competition.count();
    const activeCompetitions = await prisma.competition.count({
      where: { isActive: true }
    });

    res.json({
      totalCompetitions,
      activeCompetitions,
      categoryBreakdown: categoryStats.map(stat => ({
        category: stat.category,
        count: stat._count.id
      }))
    });
  } catch (error) {
    console.error('Get competition stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get competition by ID
router.get('/:competitionId', auth, async (req, res) => {
  try {
    const { competitionId } = req.params;

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        levels: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
                identifier: true,
                number: true,
                type: true
              }
            }
          },
          orderBy: {
            level: {
              number: 'asc'
            }
          }
        }
      }
    });

    if (!competition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Transform the data to include level information
    const transformedCompetition = {
      ...competition,
      associatedLevels: competition.levels.map(lc => lc.level)
    };

    res.json(transformedCompetition);
  } catch (error) {
    console.error('Get competition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new competition (club admins only)
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error, value } = competitionCreateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, code, description, category, order, isActive } = value;

    // Check if code already exists
    const existingCompetition = await prisma.competition.findUnique({
      where: { code }
    });

    if (existingCompetition) {
      return res.status(400).json({ error: 'Competition code already exists' });
    }

    const competition = await prisma.competition.create({
      data: {
        name,
        code,
        description,
        category,
        order,
        isActive
      },
      include: {
        levels: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
                identifier: true,
                number: true
              }
            }
          }
        },
        _count: {
          select: {
            levels: true
          }
        }
      }
    });

    // Transform the data to include level information
    const transformedCompetition = {
      ...competition,
      levelsCount: competition._count.levels,
      associatedLevels: competition.levels.map(lc => lc.level)
    };

    res.json(transformedCompetition);
  } catch (error) {
    console.error('Create competition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a competition (club admins only)
router.put('/:competitionId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { competitionId } = req.params;
    const { error, value } = competitionUpdateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if competition exists
    const existingCompetition = await prisma.competition.findUnique({
      where: { id: competitionId }
    });

    if (!existingCompetition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // If code is being updated, check for conflicts
    if (value.code && value.code !== existingCompetition.code) {
      const codeConflict = await prisma.competition.findUnique({
        where: { code: value.code }
      });

      if (codeConflict) {
        return res.status(400).json({ error: 'Competition code already exists' });
      }
    }

    const competition = await prisma.competition.update({
      where: { id: competitionId },
      data: value,
      include: {
        levels: {
          include: {
            level: {
              select: {
                id: true,
                name: true,
                identifier: true,
                number: true
              }
            }
          }
        },
        _count: {
          select: {
            levels: true
          }
        }
      }
    });

    // Transform the data to include level information
    const transformedCompetition = {
      ...competition,
      levelsCount: competition._count.levels,
      associatedLevels: competition.levels.map(lc => lc.level)
    };

    res.json(transformedCompetition);
  } catch (error) {
    console.error('Update competition error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a competition (club admins only)
router.delete('/:competitionId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { competitionId } = req.params;

    // Check if competition exists
    const existingCompetition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        _count: {
          select: {
            levels: true
          }
        }
      }
    });

    if (!existingCompetition) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    // Check if competition has associated levels
    if (existingCompetition._count.levels > 0) {
      return res.status(400).json({ 
        error: `Cannot delete competition that is associated with ${existingCompetition._count.levels} level(s). Remove the associations first.` 
      });
    }

    await prisma.competition.delete({
      where: { id: competitionId }
    });

    res.json({ message: 'Competition deleted successfully' });
  } catch (error) {
    console.error('Delete competition error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reorder competitions within a category (club admins only)
router.put('/reorder/:category', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { category } = req.params;
    const { competitionIds } = req.body;

    if (!Array.isArray(competitionIds) || competitionIds.length === 0) {
      return res.status(400).json({ error: 'competitionIds must be a non-empty array' });
    }

    // Validate category format
    const categoryPattern = /^[A-Za-z0-9\s\-_]+$/;
    if (!categoryPattern.test(category)) {
      return res.status(400).json({ error: 'Category can only contain letters, numbers, spaces, hyphens, and underscores' });
    }

    // Verify all competitions exist and belong to the category
    const competitions = await prisma.competition.findMany({
      where: {
        id: { in: competitionIds },
        category: category
      }
    });

    if (competitions.length !== competitionIds.length) {
      return res.status(400).json({ error: 'Some competitions not found or do not belong to this category' });
    }

    // Update the order for each competition
    const updatePromises = competitionIds.map((competitionId, index) =>
      prisma.competition.update({
        where: { id: competitionId },
        data: { order: index + 1 }
      })
    );

    await Promise.all(updatePromises);

    // Return updated competitions
    const updatedCompetitions = await prisma.competition.findMany({
      where: { category },
      include: {
        _count: {
          select: {
            levels: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    res.json(updatedCompetitions);
  } catch (error) {
    console.error('Reorder competitions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 