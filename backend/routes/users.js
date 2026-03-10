const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const { audit } = require('../services/auditLogService');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().allow('').optional(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('CLUB_ADMIN', 'COACH', 'PARENT', 'GYMNAST').required()
});

const updateOtherUserProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().allow('').optional(),
});

const updateGymnastProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional()
});

const completePasswordResetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

// Get all users and gymnasts in current user's club
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { includeArchived } = req.query;
    
    // Get all users in the club with custom field values
    const users = await prisma.user.findMany({
      where: {
        clubId: req.user.clubId,
        ...(includeArchived !== 'true' && { isArchived: false })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isArchived: true,
        archivedAt: true,
        archivedReason: true,
        createdAt: true,
        lastLoginAt: true,
        bookings: {
          select: { status: true },
          where: { status: { in: ['CONFIRMED', 'CANCELLED'] } },
        },
        customFieldValues: {
          select: {
            id: true,
            fieldId: true,
            value: true,
            field: {
              select: {
                id: true,
                name: true,
                fieldType: true
              }
            }
          }
        }
      }
    });

    // Get all gymnasts in the club
    const gymnasts = await prisma.gymnast.findMany({
      where: {
        clubId: req.user.clubId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        createdAt: true,
        bgNumber: true,
        bgNumberStatus: true,
        guardians: { select: { id: true } },
        user: {
          select: {
            email: true,
            customFieldValues: {
              select: {
                id: true,
                fieldId: true,
                value: true,
                field: {
                  select: {
                    id: true,
                    name: true,
                    fieldType: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Build set of user IDs who have at least one gymnast with PENDING BG status.
    // Covers both child gymnasts (linked via guardians) and adult participants (linked via userId).
    const pendingBgGuardianIds = new Set();
    gymnasts.forEach(g => {
      if (g.bgNumberStatus === 'PENDING') {
        g.guardians.forEach(guardian => pendingBgGuardianIds.add(guardian.id));
        if (g.userId) pendingBgGuardianIds.add(g.userId); // adult participant
      }
    });

    // Transform gymnasts to match user format
    const gymnastsAsUsers = gymnasts.map(gymnast => ({
      id: gymnast.id,
      email: gymnast.user?.email || null,
      firstName: gymnast.firstName,
      lastName: gymnast.lastName,
      role: 'GYMNAST',
      createdAt: gymnast.createdAt,
      userId: gymnast.userId,
      guardianIds: gymnast.guardians.map(g => g.id),
      isGymnast: true,
      customFieldValues: gymnast.user?.customFieldValues || [],
    }));

    // Add custom field values and booking counts to regular users
    const usersWithCustomFields = users.map(user => ({
      ...user,
      confirmedBookings: user.bookings.filter(b => b.status === 'CONFIRMED').length,
      cancelledBookings: user.bookings.filter(b => b.status === 'CANCELLED').length,
      bookings: undefined,
      customFieldValues: user.customFieldValues || [],
      hasPendingBg: pendingBgGuardianIds.has(user.id),
    }));

    // Combine users and gymnasts
    const allMembers = [...usersWithCustomFields, ...gymnastsAsUsers];

    // Sort by firstName
    allMembers.sort((a, b) => a.firstName.localeCompare(b.firstName));

    res.json(allMembers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update current user's profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName, email, phone } = value;

    // If email is being updated, check if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already taken' });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: firstName || req.user.firstName,
        lastName: lastName || req.user.lastName,
        email: email || req.user.email,
        ...(phone !== undefined && { phone: phone || null }),
      },
      include: {
        club: true,
        guardedGymnasts: true
      }
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;

    // Get current user with password
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedNewPassword
      }
    });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add email to user account (club admins only)
// GET /api/users/:userId — full member detail for admins
router.get('/:userId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true, firstName: true, lastName: true, email: true, phone: true,
        role: true, createdAt: true, isArchived: true, clubId: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.clubId !== req.user.clubId) return res.status(403).json({ error: 'Access denied' });

    const now = new Date();

    const gymnasts = await prisma.gymnast.findMany({
      where: { guardians: { some: { id: req.params.userId } }, clubId: req.user.clubId },
      include: { consents: true },
    });

    const gymnastsWithCount = await Promise.all(gymnasts.map(async (g) => {
      const pastSessionCount = await prisma.bookingLine.count({
        where: {
          gymnastId: g.id,
          booking: { status: 'CONFIRMED', sessionInstance: { date: { lte: now } } },
        },
      });
      return { ...g, pastSessionCount };
    }));

    const credits = await prisma.credit.findMany({
      where: { userId: req.params.userId, usedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
    });

    res.json({ ...user, gymnasts: gymnastsWithCount, credits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:userId/email', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Check if user exists and belongs to the same club
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, clubId: true, firstName: true, lastName: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Ensure the user belongs to the same club as the admin
    if (user.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'You can only manage users in your own club' });
    }

    // Check if user already has an email
    if (user.email) {
      return res.status(400).json({ error: 'User already has an email address' });
    }

    // Check if email is already in use by another user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already in use by another user' });
    }

    // Update user with email
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        clubId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Email added successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error adding email to user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role (club admins only)
router.put('/:userId/role', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { error, value } = updateUserRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { role } = value;

    // Prevent self-role changes
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        club: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    await audit({
      userId: req.user.id,
      clubId: req.user.clubId,
      action: 'user.role_change',
      entityType: 'User',
      entityId: userId,
      metadata: { from: targetUser.role, to: role },
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update another user's profile (club admins only)
router.put('/:userId/profile', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { error, value } = updateOtherUserProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName, email, phone } = value;

    // Prevent self-profile changes (should use regular profile endpoint)
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Use the regular profile endpoint to update your own profile' });
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // If email is being updated, check if it's already taken
    if (email && email !== targetUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already taken' });
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName || targetUser.firstName,
        lastName: lastName || targetUser.lastName,
        email: email || targetUser.email,
        ...(phone !== undefined && { phone: phone || null }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    await audit({
      userId: req.user.id, clubId: req.user.clubId,
      action: 'member.edit', entityType: 'User', entityId: req.params.userId,
      metadata: { fields: Object.keys(req.body) },
    });

    res.json({
      message: 'User profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add email to gymnast account (creates user account if needed) - club admins only
router.put('/gymnast/:gymnastId/email', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { gymnastId } = req.params;
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Check if gymnast exists and belongs to the same club
    const gymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Ensure the gymnast belongs to the same club as the admin
    if (gymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'You can only manage gymnasts in your own club' });
    }

    // Check if email is already in use by another user
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already in use by another user' });
    }

    let updatedUser;

    if (gymnast.user) {
      // Gymnast already has a user account
      if (gymnast.user.email) {
        return res.status(400).json({ error: 'Gymnast already has an email address' });
      }

      // Update existing user account with email
      updatedUser = await prisma.user.update({
        where: { id: gymnast.user.id },
        data: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          clubId: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } else {
      // Create new user account for gymnast
      const bcrypt = require('bcryptjs');
      const defaultPassword = 'changeMe123!'; // Default password that must be changed
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      updatedUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: gymnast.firstName,
          lastName: gymnast.lastName,
          role: 'PARENT', // Default role for gymnast accounts
          clubId: gymnast.clubId,
          mustChangePassword: true // Flag to force password change on first login
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          clubId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Link gymnast to the new user account
      await prisma.gymnast.update({
        where: { id: gymnastId },
        data: { userId: updatedUser.id }
      });
    }

    res.json({
      message: gymnast.user ? 'Email added successfully' : 'User account created and email added successfully',
      user: updatedUser,
      defaultPassword: gymnast.user ? undefined : defaultPassword // Only return default password for new accounts
    });
  } catch (error) {
    console.error('Error adding email to gymnast:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update gymnast profile (club admins only)
router.put('/gymnast/:gymnastId/profile', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { gymnastId } = req.params;
    const { error, value } = updateGymnastProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName } = value;

    // Get the target gymnast
    const targetGymnast = await prisma.gymnast.findUnique({
      where: { id: gymnastId }
    });

    if (!targetGymnast) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    // Check if target gymnast is in the same club
    if (targetGymnast.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. Gymnast is not in your club' });
    }

    // Update gymnast profile
    const updatedGymnast = await prisma.gymnast.update({
      where: { id: gymnastId },
      data: {
        firstName: firstName || targetGymnast.firstName,
        lastName: lastName || targetGymnast.lastName
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      }
    });

    // Transform to match the expected response format
    const responseData = {
      id: updatedGymnast.id,
      email: updatedGymnast.user?.email || null,
      firstName: updatedGymnast.firstName,
      lastName: updatedGymnast.lastName,
      role: 'GYMNAST',
      createdAt: updatedGymnast.createdAt,
      userId: updatedGymnast.userId,
      isGymnast: true
    };

    res.json({
      message: 'Gymnast profile updated successfully',
      user: responseData
    });
  } catch (error) {
    console.error('Update gymnast profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new user in the club (club admins only)
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const schema = Joi.object({
      firstName: Joi.string().min(1).max(50).required(),
      lastName: Joi.string().min(1).max(50).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().when('role', {
        is: 'PARENT',
        then: Joi.string().min(1).required(),
        otherwise: Joi.string().allow('').optional(),
      }),
      role: Joi.string().valid('CLUB_ADMIN', 'COACH', 'PARENT', 'GYMNAST').default('PARENT'),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await prisma.user.findUnique({ where: { email: value.email } });
    if (existing) return res.status(400).json({ error: 'An account with this email already exists' });

    const crypto = require('crypto');
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone || null,
        password: hashedPassword,
        role: value.role,
        clubId: req.user.clubId,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true },
    });

    await audit({ userId: req.user.id, clubId: req.user.clubId, action: 'user.created', metadata: { targetUserId: user.id, email: user.email, role: user.role } });

    // Attempt to send password reset email so user can set their own password
    let emailSent = false;
    try {
      const club = await prisma.club.findUnique({ where: { id: req.user.clubId } });
      if (club?.emailEnabled) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordResetToken: resetToken, passwordResetTokenExpiresAt: new Date(Date.now() + 3600000) },
        });
        const emailService = require('../services/emailService');
        const result = await emailService.sendAccountCreatedEmail(user.email, resetToken, `${user.firstName} ${user.lastName}`);
        emailSent = result.success && !result.skipped;
      }
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr);
    }

    res.status(201).json({ user, emailSent });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset another user's password (club admins only)
router.post('/:userId/reset-password', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-password reset (should use regular password endpoint)
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Use the regular password endpoint to change your own password' });
    }

    // Get the target user with club information
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
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

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // Generate a secure reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 3600000); // 1 hour from now

    // Store the reset token in the database
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: resetToken,
        passwordResetTokenExpiresAt: tokenExpiresAt
      }
    });

    // Send password reset email only if club has email enabled
    let emailResult = { success: true, skipped: true };
    if (targetUser.club.emailEnabled) {
      const emailService = require('../services/emailService');
      emailResult = await emailService.sendPasswordResetEmail(
        targetUser.email,
        resetToken,
        `${targetUser.firstName} ${targetUser.lastName}`
      );
    } else {
      console.log('📧 Password reset email skipped - club has email disabled');
    }

    if (emailResult.success) {
      res.json({
        message: emailResult.skipped ? 'Password reset token generated (email disabled)' : 'Password reset email sent successfully',
        email: targetUser.email,
        name: `${targetUser.firstName} ${targetUser.lastName}`,
        emailSent: !emailResult.skipped,
        ...(emailResult.dev && { 
          devInfo: {
            resetUrl: emailResult.resetUrl,
            message: emailResult.message
          }
        })
      });
    } else {
      // If email fails, clean up the token
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null
        }
      });
      
      return res.status(500).json({ 
        error: 'Failed to send password reset email. Please try again.' 
      });
    }
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete password reset with token (public endpoint)
router.post('/reset-password', async (req, res) => {
  try {
    const { error, value } = completePasswordResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { token, newPassword } = value;

    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpiresAt: {
          gt: new Date() // Token must not be expired
        }
      }
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token. Please request a new password reset.' 
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null
      }
    });

    res.json({
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Complete password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Archive user (club admins only)
router.patch('/:userId/archive', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Prevent self-archiving
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot archive yourself' });
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // Check if user is already archived
    if (targetUser.isArchived) {
      return res.status(400).json({ error: 'User is already archived' });
    }

    // Archive the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: req.user.id,
        archivedReason: reason || null
      }
    });

    res.json({ message: 'User archived successfully' });
  } catch (error) {
    console.error('Archive user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore user (club admins only)
router.patch('/:userId/restore', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // Check if user is archived
    if (!targetUser.isArchived) {
      return res.status(400).json({ error: 'User is not archived' });
    }

    // Restore the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
        archivedReason: null
      }
    });

    res.json({ message: 'User restored successfully' });
  } catch (error) {
    console.error('Restore user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a test email (club admins only)
router.post('/test-email', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { email } = req.body;
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  try {
    const emailService = require('../services/emailService');
    if (!emailService.isConfigured) {
      return res.status(503).json({ error: 'Email is not configured on this server. Set EMAIL_USER and EMAIL_PASS environment variables.' });
    }
    const result = await emailService.sendEmail({
      to: email,
      subject: 'Test email from Trampoline Life',
      html: '<p>This is a test email sent from the Trampoline Life admin panel.</p><p>If you received this, email is working correctly.</p>',
      text: 'This is a test email sent from the Trampoline Life admin panel. If you received this, email is working correctly.',
    });
    if (result.success) {
      res.json({ message: `Test email sent to ${email}` });
    } else {
      res.status(500).json({ error: result.error || 'Failed to send email' });
    }
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

// Delete user (club admins only)
router.delete('/:userId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmDelete } = req.body;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete yourself' });
    }

    // Require confirmation
    if (!confirmDelete) {
      return res.status(400).json({ error: 'Delete confirmation required' });
    }

    // Get the target user with related data
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skillProgress: true,
        levelProgress: true,
        routineProgress: true,
        guardianRequests: true,
        sentInvites: true,
        receivedInvites: true,
        awardedCertificates: true,
        guardedGymnasts: true,
        gymnasts: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is in the same club
    if (targetUser.clubId !== req.user.clubId) {
      return res.status(403).json({ error: 'Access denied. User is not in your club' });
    }

    // Check if user has progress data or is linked to gymnasts
    const hasProgressData = targetUser.skillProgress.length > 0 || 
                           targetUser.levelProgress.length > 0 || 
                           targetUser.routineProgress.length > 0 ||
                           targetUser.guardedGymnasts.length > 0 ||
                           targetUser.gymnasts.length > 0;

    if (hasProgressData) {
      return res.status(400).json({ 
        error: 'Cannot delete user with progress data or linked gymnasts. Consider archiving instead.' 
      });
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 