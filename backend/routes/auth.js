const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('CLUB_ADMIN', 'COACH', 'GYMNAST', 'PARENT').required(),
  clubId: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, firstName, lastName, role, clubId } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Validate club exists if clubId is provided
    if (clubId) {
      const club = await prisma.club.findUnique({
        where: { id: clubId }
      });

      if (!club) {
        return res.status(400).json({ error: 'Club not found' });
      }
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        clubId
      },
      include: {
        club: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        club: true,
        gymnasts: true,
        guardedGymnasts: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate token
router.get('/validate', auth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Generate or regenerate share access code for parents only
router.post('/generate-share-code', auth, requireRole(['PARENT']), async (req, res) => {
  try {
    // Generate a 6-digit share access code
    const shareCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update the user's share access code
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { shareCode },
      include: {
        club: true,
        guardedGymnasts: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Share access code generated successfully',
      shareCode,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Generate share code error:', error);
    res.status(500).json({ message: 'Failed to generate share code' });
  }
});

// Child login endpoint
router.post('/child-login', async (req, res) => {
  try {
    const { firstName, lastName, accessCode } = req.body;

    // First, try to find a parent/coach with this share code
    const parentOrCoach = await prisma.user.findFirst({
      where: {
        shareCode: accessCode,
        role: { in: ['PARENT', 'COACH'] }
      },
      include: {
        club: true,
        guardedGymnasts: true
      }
    });

    // If parent/coach not found, try the club's code of the day
    let club = null;
    if (!parentOrCoach) {
      club = await prisma.club.findFirst({
        where: {
          codeOfTheDay: accessCode,
          codeOfTheDayExpiresAt: {
            gt: new Date()
          }
        }
      });
    }

    if (!parentOrCoach && !club) {
      return res.status(401).json({ message: 'Invalid access code' });
    }

    // Find gymnasts based on the name
    const whereClause = {
      firstName: { equals: firstName, mode: 'insensitive' },
      lastName: { equals: lastName, mode: 'insensitive' }
    };

    if (parentOrCoach) {
      whereClause.clubId = parentOrCoach.clubId;
    } else if (club) {
      whereClause.clubId = club.id;
    }

    const gymnasts = await prisma.gymnast.findMany({
      where: whereClause,
      include: {
        club: true,
        skillProgress: {
          include: {
            skill: true
          }
        },
        levelProgress: {
          include: {
            level: true
          }
        }
      }
    });

    if (gymnasts.length === 0) {
      return res.status(404).json({ message: 'No gymnast found with that name' });
    }

    // If multiple gymnasts found, ask for disambiguation
    if (gymnasts.length > 1) {
      return res.json({
        needsDisambiguation: true,
        gymnasts: gymnasts.map(g => ({
          id: g.id,
          fullName: `${g.firstName} ${g.lastName}`,
          club: g.club.name
        })),
        message: 'Multiple gymnasts found with that name. Please select one.'
      });
    }

    // Single gymnast found
    const gymnast = gymnasts[0];

    // Generate JWT token for the child
    const token = jwt.sign(
      { 
        userId: gymnast.id, 
        role: 'CHILD', 
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        clubId: gymnast.clubId,
        gymnastId: gymnast.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Child login successful',
      token,
      child: {
        id: gymnast.id,
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        role: 'CHILD',
        club: gymnast.club,
        skillProgress: gymnast.skillProgress,
        levelProgress: gymnast.levelProgress
      }
    });
  } catch (error) {
    console.error('Child login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Child login disambiguation endpoint
router.post('/child-login-disambiguate', async (req, res) => {
  try {
    const { gymnastId, accessCode } = req.body;

    // Verify the access code is still valid
    const parentOrCoach = await prisma.user.findFirst({
      where: {
        shareCode: accessCode,
        role: { in: ['PARENT', 'COACH'] }
      },
      include: {
        club: true
      }
    });

    // If parent/coach not found, try the club's code of the day
    let club = null;
    if (!parentOrCoach) {
      club = await prisma.club.findFirst({
        where: {
          codeOfTheDay: accessCode,
          codeOfTheDayExpiresAt: {
            gt: new Date()
          }
        }
      });
    }

    if (!parentOrCoach && !club) {
      return res.status(401).json({ message: 'Invalid access code' });
    }

    // Find the specific gymnast
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        club: true,
        skillProgress: {
          include: {
            skill: true
          }
        },
        levelProgress: {
          include: {
            level: true
          }
        }
      }
    });

    if (!gymnast) {
      return res.status(404).json({ message: 'Gymnast not found' });
    }

    // Verify the gymnast belongs to the correct club
    const expectedClubId = parentOrCoach?.clubId || club?.id;
    if (gymnast.clubId !== expectedClubId) {
      return res.status(403).json({ message: 'Access denied for this gymnast' });
    }

    // Generate JWT token for the child
    const token = jwt.sign(
      { 
        userId: gymnast.id, 
        role: 'CHILD', 
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        clubId: gymnast.clubId,
        gymnastId: gymnast.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Child login successful',
      token,
      child: {
        id: gymnast.id,
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        role: 'CHILD',
        club: gymnast.club,
        skillProgress: gymnast.skillProgress,
        levelProgress: gymnast.levelProgress
      }
    });
  } catch (error) {
    console.error('Child login disambiguation error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Development-only login endpoint
router.post('/dev-login', async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const { email } = req.body;
    console.log('Dev login request received:', { email, body: req.body });
    
    // Default to dev@test.com if no email provided (backward compatibility)
    const loginEmail = email || 'dev@test.com';
    console.log('Using login email:', loginEmail);

    // Validate that it's a test user
    const allowedTestUsers = [
      'admin@test.com',
      'dev@test.com',
      'coach2@test.com',
      'gymnast@test.com',
      'parent@test.com'
    ];

    if (!allowedTestUsers.includes(loginEmail)) {
      return res.status(400).json({ error: 'Invalid test user email' });
    }

    // Find the development user
    const user = await prisma.user.findUnique({
      where: { email: loginEmail },
      include: {
        club: true,
        gymnasts: true,
        guardedGymnasts: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Development user not found. Please run the database seed script.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Development login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate or regenerate code of the day for the club
router.post('/generate-code-of-day', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { expiresInHours = 24 } = req.body; // Default to 24 hours
    
    // Generate a 6-digit code of the day
    const codeOfTheDay = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    // Update the club's code of the day
    const updatedClub = await prisma.club.update({
      where: { id: req.user.clubId },
      data: { 
        codeOfTheDay,
        codeOfTheDayExpiresAt: expiresAt
      }
    });

    res.json({
      message: 'Code of the day generated successfully',
      codeOfTheDay,
      expiresAt,
      club: {
        id: updatedClub.id,
        name: updatedClub.name
      }
    });
  } catch (error) {
    console.error('Generate code of the day error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current code of the day for the club
router.get('/code-of-day', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.user.clubId },
      select: {
        id: true,
        name: true,
        codeOfTheDay: true,
        codeOfTheDayExpiresAt: true
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Check if code is expired
    const now = new Date();
    const isExpired = club.codeOfTheDayExpiresAt && club.codeOfTheDayExpiresAt < now;

    res.json({
      club: {
        id: club.id,
        name: club.name
      },
      codeOfTheDay: club.codeOfTheDay,
      expiresAt: club.codeOfTheDayExpiresAt,
      isExpired,
      isActive: club.codeOfTheDay && !isExpired
    });
  } catch (error) {
    console.error('Get code of the day error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear/deactivate code of the day
router.delete('/code-of-day', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const updatedClub = await prisma.club.update({
      where: { id: req.user.clubId },
      data: { 
        codeOfTheDay: null,
        codeOfTheDayExpiresAt: null
      }
    });

    res.json({
      message: 'Code of the day cleared successfully',
      club: {
        id: updatedClub.id,
        name: updatedClub.name
      }
    });
  } catch (error) {
    console.error('Clear code of the day error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            emailEnabled: true
          }
        }
      }
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ 
        success: true, 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: resetTokenExpires
      }
    });

    // Send password reset email only if club has email enabled
    let emailResult = { success: true, skipped: true };
    if (user.club && user.club.emailEnabled) {
      const emailService = require('../services/emailService');
      emailResult = await emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        `${user.firstName} ${user.lastName}`
      );
    } else {
      console.log('📧 Password reset email skipped - club has email disabled or no club');
    }

    res.json({ 
      success: true, 
      message: emailResult.skipped ? 'Password reset token generated (email disabled)' : 'Password reset email sent successfully',
      emailSent: !emailResult.skipped
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null
      }
    });

    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 