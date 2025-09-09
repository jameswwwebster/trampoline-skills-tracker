const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Regular authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle child sessions
    if (decoded.isChild) {
      const gymnast = await prisma.gymnast.findUnique({
        where: { id: decoded.gymnastId },
        include: {
          club: true,
          guardians: true
        }
      });

      if (!gymnast) {
        return res.status(401).json({ error: 'Child session is not valid' });
      }

      // Create a child session object that mimics a user
      req.child = {
        id: gymnast.id,
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        role: 'CHILD',
        club: gymnast.club,
        clubId: gymnast.clubId,
        gymnastsId: gymnast.id, // For easy access to own gymnast record
        isChild: true
      };
      req.user = req.child; // For backward compatibility
      next();
      return;
    }

    // Regular user session
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        club: true,
        gymnasts: true,
        guardedGymnasts: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    req.user = user;
    
    // For super admins, check if they're switching clubs
    if (user.role === 'SUPER_ADMIN') {
      const switchClubId = req.header('X-Switch-Club-Id');
      if (switchClubId) {
        const switchClub = await prisma.club.findUnique({
          where: { id: switchClubId },
          include: {
            users: { take: 1 },
            gymnasts: { take: 1 }
          }
        });
        
        if (switchClub) {
          req.switchedClub = switchClub;
          req.effectiveClubId = switchClub.id;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// System admin only middleware
const requireSystemAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super administrator access required.' });
  }

  next();
};

// Check if user has access to a specific club
const requireClubAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super admins can access any club
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const clubId = req.params.clubId || req.body.clubId;
  
  if (req.user.role === 'CLUB_ADMIN' || req.user.role === 'COACH') {
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Access denied to this club' });
    }
  }

  next();
};

// Check if user has access to a specific gymnast
const requireGymnastAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admins can access any gymnast
    if (req.user.role === 'SUPER_ADMIN') {
      const gymnastId = req.params.gymnastId || req.body.gymnastId;
      if (gymnastId) {
        const gymnast = await prisma.gymnast.findUnique({
          where: { id: gymnastId },
          include: {
            guardians: true,
            club: true
          }
        });
        req.gymnast = gymnast;
      }
      return next();
    }

    const gymnastId = req.params.gymnastId || req.body.gymnastId;
    
    if (!gymnastId) {
      return res.status(400).json({ error: 'Gymnast ID required' });
    }

    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        guardians: true,
        club: true
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Club admins and coaches can access gymnasts in their club
    if (req.user.role === 'CLUB_ADMIN' || req.user.role === 'COACH') {
      if (req.user.clubId !== gymnast.clubId) {
        return res.status(403).json({ error: 'Access denied to this gymnast' });
      }
    }
    // Gymnasts can only access their own data
    else if (req.user.role === 'GYMNAST') {
      if (req.user.id !== gymnast.userId) {
        return res.status(403).json({ error: 'Access denied to this gymnast' });
      }
    }
    // Parents can only access their guarded gymnasts
    else if (req.user.role === 'PARENT') {
      const hasAccess = gymnast.guardians.some(guardian => guardian.id === req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this gymnast' });
      }
    }

    req.gymnast = gymnast;
    next();
  } catch (error) {
    console.error('Gymnast access error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get effective club ID (handles club switching for super admins)
const getEffectiveClubId = (req) => {
  if (req.user.role === 'SUPER_ADMIN' && req.effectiveClubId) {
    return req.effectiveClubId;
  }
  return req.user.clubId;
};

module.exports = {
  auth,
  requireRole,
  requireSystemAdmin,
  requireClubAccess,
  requireGymnastAccess,
  getEffectiveClubId
}; 