const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireSystemAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const archiveClubSchema = Joi.object({
  reason: Joi.string().max(500).required()
});

// Global dashboard - get system overview
router.get('/dashboard', auth, requireSystemAdmin, async (req, res) => {
  try {
    const [
      totalClubs,
      archivedClubs,
      totalUsers,
      totalGymnasts,
      recentClubs,
      recentUsers
    ] = await Promise.all([
      prisma.club.count({ where: { isArchived: false } }),
      prisma.club.count({ where: { isArchived: true } }),
      prisma.user.count({ where: { isArchived: false } }),
      prisma.gymnast.count({ where: { isArchived: false } }),
      prisma.club.findMany({
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          _count: {
            select: {
              users: true,
              gymnasts: true
            }
          }
        }
      }),
      prisma.user.findMany({
        where: { isArchived: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          club: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    ]);

    res.json({
      statistics: {
        totalClubs,
        archivedClubs,
        totalUsers,
        totalGymnasts
      },
      recentClubs,
      recentUsers
    });
  } catch (error) {
    console.error('System admin dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all clubs (active and archived)
router.get('/clubs', auth, requireSystemAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status = 'active' } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      isArchived: status === 'archived',
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    const [clubs, totalCount] = await Promise.all([
      prisma.club.findMany({
        where,
        skip: offset,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          archivedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              users: true,
              gymnasts: true,
              levels: true,
              certificates: true
            }
          }
        }
      }),
      prisma.club.count({ where })
    ]);

    res.json({
      clubs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + clubs.length < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get clubs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific club details
router.get('/clubs/:clubId', auth, requireSystemAdmin, async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.clubId },
      include: {
        archivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            createdAt: true,
            isArchived: true
          },
          orderBy: { createdAt: 'desc' }
        },
        gymnasts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            createdAt: true,
            isArchived: true
          },
          orderBy: { createdAt: 'desc' }
        },
        levels: {
          select: {
            id: true,
            number: true,
            name: true,
            type: true,
            _count: {
              select: {
                skills: true
              }
            }
          },
          orderBy: { number: 'asc' }
        },
        _count: {
          select: {
            certificates: true,
            guardianRequests: true,
            invites: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json(club);
  } catch (error) {
    console.error('Get club details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Archive club
router.post('/clubs/:clubId/archive', auth, requireSystemAdmin, async (req, res) => {
  try {
    const { error } = archiveClubSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { reason } = req.body;

    // Check if club exists and is not already archived
    const existingClub = await prisma.club.findUnique({
      where: { id: req.params.clubId }
    });

    if (!existingClub) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (existingClub.isArchived) {
      return res.status(400).json({ error: 'Club is already archived' });
    }

    // Archive the club
    const archivedClub = await prisma.club.update({
      where: { id: req.params.clubId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: req.user.id,
        archivedReason: reason
      },
      include: {
        archivedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Club archived successfully',
      club: archivedClub
    });
  } catch (error) {
    console.error('Archive club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore archived club
router.post('/clubs/:clubId/restore', auth, requireSystemAdmin, async (req, res) => {
  try {
    // Check if club exists and is archived
    const existingClub = await prisma.club.findUnique({
      where: { id: req.params.clubId }
    });

    if (!existingClub) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (!existingClub.isArchived) {
      return res.status(400).json({ error: 'Club is not archived' });
    }

    // Restore the club
    const restoredClub = await prisma.club.update({
      where: { id: req.params.clubId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        archivedReason: null
      }
    });

    res.json({
      message: 'Club restored successfully',
      club: restoredClub
    });
  } catch (error) {
    console.error('Restore club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Permanently delete club (dangerous operation)
router.delete('/clubs/:clubId', auth, requireSystemAdmin, async (req, res) => {
  try {
    const { confirmDelete } = req.body;

    if (confirmDelete !== 'PERMANENTLY_DELETE_CLUB') {
      return res.status(400).json({ 
        error: 'Confirmation required. Send confirmDelete: "PERMANENTLY_DELETE_CLUB"' 
      });
    }

    // Check if club exists
    const existingClub = await prisma.club.findUnique({
      where: { id: req.params.clubId },
      include: {
        _count: {
          select: {
            users: true,
            gymnasts: true,
            certificates: true
          }
        }
      }
    });

    if (!existingClub) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // We recommend archiving instead of deleting if there's any data
    if (existingClub._count.users > 0 || existingClub._count.gymnasts > 0 || existingClub._count.certificates > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete club with existing data. Consider archiving instead.',
        details: {
          users: existingClub._count.users,
          gymnasts: existingClub._count.gymnasts,
          certificates: existingClub._count.certificates
        }
      });
    }

    // Delete the club (this will cascade delete related data)
    await prisma.club.delete({
      where: { id: req.params.clubId }
    });

    res.json({
      message: 'Club permanently deleted',
      clubName: existingClub.name
    });
  } catch (error) {
    console.error('Delete club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users across all clubs
router.get('/users', auth, requireSystemAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, clubId, role } = req.query;
    const offset = (page - 1) * limit;

    const where = {
      isArchived: false,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(clubId && { clubId }),
      ...(role && { role })
    };

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          club: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              gymnasts: true,
              guardedGymnasts: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + users.length < totalCount,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Switch club context (for system admin to view club data)
router.post('/switch-club/:clubId', auth, requireSystemAdmin, async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.clubId },
      include: {
        _count: {
          select: {
            users: true,
            gymnasts: true,
            levels: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json({
      message: 'Club context switched',
      club: {
        id: club.id,
        name: club.name,
        isArchived: club.isArchived,
        counts: club._count
      },
      instructions: {
        header: 'X-Switch-Club-Id',
        value: club.id,
        description: 'Include this header in subsequent requests to act within this club context'
      }
    });
  } catch (error) {
    console.error('Switch club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 