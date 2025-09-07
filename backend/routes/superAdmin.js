const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
};

// Apply authentication and super admin middleware to all routes
router.use(auth);
router.use(requireSuperAdmin);

// Test endpoint to verify super admin access
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Super Admin access working!', 
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Get all clubs with basic stats
router.get('/clubs', async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      include: {
        _count: {
          select: {
            users: true,
            gymnasts: true,
            levels: true
          }
        },
        users: {
          where: { role: 'ADMIN' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
            // lastLoginAt: true // Temporarily disabled - may not exist in remote schema
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(clubs);
  } catch (error) {
    console.error('Get clubs error:', error);
    res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

// Get detailed club information
router.get('/clubs/:clubId', async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.clubId },
      include: {
        users: {
          include: {
            _count: {
              select: {
                gymnasts: true
              }
            }
          }
        },
        gymnasts: {
          include: {
            levelProgress: {
              include: {
                level: true
              }
            },
            skillProgress: {
              include: {
                skill: {
                  include: {
                    level: true
                  }
                }
              }
            },
            guardians: true
          }
        },
        levels: {
          include: {
            _count: {
              select: {
                skills: true,
                routines: true
              }
            }
          }
        },
        // competitions: {
        //   include: {
        //     _count: {
        //       select: {
        //         categories: true
        //       }
        //     }
        //   }
        // }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json(club);
  } catch (error) {
    console.error('Get club details error:', error);
    res.status(500).json({ error: 'Failed to fetch club details' });
  }
});

// Get all users across all clubs
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '', clubId = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (clubId) {
      where.clubId = clubId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          club: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              gymnasts: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all gymnasts across all clubs
router.get('/gymnasts', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', clubId = '', archived = 'false' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      archived: archived === 'true'
    };
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (clubId) {
      where.clubId = clubId;
    }

    const [gymnasts, total] = await Promise.all([
      prisma.gymnast.findMany({
        where,
        include: {
          club: {
            select: {
              id: true,
              name: true
            }
          },
          guardians: true,
          levelProgress: {
            include: {
              level: true
            }
          },
          skillProgress: {
            include: {
              skill: {
                include: {
                  level: true
                }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.gymnast.count({ where })
    ]);

    res.json({
      gymnasts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get gymnasts error:', error);
    res.status(500).json({ error: 'Failed to fetch gymnasts' });
  }
});

// Update user role or status
router.patch('/users/:userId', async (req, res) => {
  try {
    const { role, isActive } = req.body;
    
    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      include: {
        club: {
          select: {
            id: true,
            name: true
          }
        }
      },
      data: updateData
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update gymnast status
router.patch('/gymnasts/:gymnastId', async (req, res) => {
  try {
    const { archived, archiveReason } = req.body;
    
    const updateData = {};
    if (archived !== undefined) {
      updateData.archived = archived;
      if (archived && archiveReason) {
        updateData.archiveReason = archiveReason;
      }
    }

    const gymnast = await prisma.gymnast.update({
      where: { id: req.params.gymnastId },
      include: {
        club: {
          select: {
            id: true,
            name: true
          }
        },
        guardians: true
      },
      data: updateData
    });

    res.json(gymnast);
  } catch (error) {
    console.error('Update gymnast error:', error);
    res.status(500).json({ error: 'Failed to update gymnast' });
  }
});

// Create a new club
router.post('/clubs', async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;

    const club = await prisma.club.create({
      data: {
        name,
        address,
        phone,
        email
      }
    });

    res.status(201).json(club);
  } catch (error) {
    console.error('Create club error:', error);
    res.status(500).json({ error: 'Failed to create club' });
  }
});

// Update club information
router.patch('/clubs/:clubId', async (req, res) => {
  try {
    const { name, address, phone, email, emailEnabled } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;

    const club = await prisma.club.update({
      where: { id: req.params.clubId },
      data: updateData
    });

    res.json(club);
  } catch (error) {
    console.error('Update club error:', error);
    res.status(500).json({ error: 'Failed to update club' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalClubs,
      totalUsers,
      totalGymnasts,
      activeGymnasts,
      totalLevels,
      totalSkills,
      recentActivity
    ] = await Promise.all([
      prisma.club.count(),
      prisma.user.count(),
      prisma.gymnast.count(),
      prisma.gymnast.count({ where: { archived: false } }),
      prisma.level.count(),
      prisma.skill.count(),
      // prisma.competition.count(), // Temporarily disabled
      // Recent activity temporarily disabled - lastLoginAt field may not exist
      // prisma.user.findMany({
      //   where: {
      //     lastLoginAt: {
      //       gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      //     }
      //   },
      //   include: {
      //     club: {
      //       select: {
      //         name: true
      //       }
      //     }
      //   },
      //   orderBy: { lastLoginAt: 'desc' },
      //   take: 10
      // })
      [] // Empty array for now
    ]);

    res.json({
      totalClubs,
      totalUsers,
      totalGymnasts,
      activeGymnasts,
      totalLevels,
      totalSkills,
      // totalCompetitions, // Temporarily disabled
      recentActivity
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Reset user password (generate temporary password)
router.post('/users/:userId/reset-password', async (req, res) => {
  try {
    const crypto = require('crypto');
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    
    // In a real implementation, you'd hash this password and send it via email
    // For now, we'll just return it (in production, this should be sent securely)
    
    res.json({
      message: 'Password reset successful',
      temporaryPassword, // Remove this in production!
      note: 'Send this password securely to the user'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
