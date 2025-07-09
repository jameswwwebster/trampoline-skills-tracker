const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const { createDefaultDataForClub } = require('../services/defaultDataService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `club-logo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const createClubSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  address: Joi.string().max(200).optional(),
  phone: Joi.string().max(20).optional(),
  email: Joi.string().email().optional()
});

const updateClubSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  address: Joi.string().max(200).optional(),
  phone: Joi.string().max(20).optional(),
  email: Joi.string().email().optional()
});

const clubSettingsSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  address: Joi.string().allow(''),
  phone: Joi.string().allow(''),
  email: Joi.string().email().allow(''),
  website: Joi.string().uri().allow(''),
  description: Joi.string().allow(''),
  primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  accentColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
  fontFamily: Joi.string().max(100),
  customCss: Joi.string().allow('')
});

// Create new club (anyone can create a club and become its admin)
router.post('/', auth, async (req, res) => {
  try {
    const { error } = createClubSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, address, phone, email } = req.body;

    // Create club
    const club = await prisma.club.create({
      data: {
        name,
        address,
        phone,
        email
      }
    });

    // Create default data for the new club
    try {
      await createDefaultDataForClub(club.id);
      console.log(`✅ Default data created for club: ${club.name}`);
    } catch (defaultDataError) {
      console.error(`❌ Failed to create default data for club ${club.id}:`, defaultDataError);
      // We don't want to fail the club creation if default data creation fails
      // The club admin can manually create levels/skills later
    }

    // Update user to be club admin
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        clubId: club.id,
        role: 'CLUB_ADMIN'
      },
      include: {
        club: true
      }
    });

    res.status(201).json({
      message: 'Club created successfully',
      club,
      user: updatedUser
    });
  } catch (error) {
    console.error('Create club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all clubs (for selection during registration)
router.get('/', async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(clubs);
  } catch (error) {
    console.error('Get clubs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get specific club
router.get('/:id', auth, async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true
          }
        },
        gymnasts: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Check if user has access to this club
    if (req.user.clubId !== club.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(club);
  } catch (error) {
    console.error('Get club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update club (only club admins)
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { error } = updateClubSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clubId = req.params.id;

    // Check if user has access to this club
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const club = await prisma.club.update({
      where: { id: clubId },
      data: req.body
    });

    res.json({
      message: 'Club updated successfully',
      club
    });
  } catch (error) {
    console.error('Update club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete club (only club admins)
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const clubId = req.params.id;

    // Check if user has access to this club
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if club has users or gymnasts
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        _count: {
          select: {
            users: true,
            gymnasts: true
          }
        }
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (club._count.users > 1 || club._count.gymnasts > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete club with existing users or gymnasts' 
      });
    }

    await prisma.club.delete({
      where: { id: clubId }
    });

    res.json({ message: 'Club deleted successfully' });
  } catch (error) {
    console.error('Delete club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/clubs/:clubId - Get club details and settings
router.get('/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Check if user has access to this club
    if (req.user.clubId !== clubId && req.user.role !== 'CLUB_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        description: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        customCss: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json(club);
  } catch (error) {
    console.error('Error fetching club:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clubs/:clubId - Update club settings
router.put('/:clubId', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Only club admins can update club settings
    if (req.user.role !== 'CLUB_ADMIN' || req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Only club administrators can update club settings' });
    }

    // Validate request body
    const { error, value } = clubSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Update club
    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: value,
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        description: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        customCss: true,
        updatedAt: true
      }
    });

    res.json(updatedClub);
  } catch (error) {
    console.error('Error updating club:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clubs/:clubId/logo - Upload club logo
router.post('/:clubId/logo', upload.single('logo'), async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Only club admins can upload logos
    if (req.user.role !== 'CLUB_ADMIN' || req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Only club administrators can upload logos' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    // Get current club to check for existing logo
    const currentClub = await prisma.club.findUnique({
      where: { id: clubId },
      select: { logoUrl: true }
    });

    if (!currentClub) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Delete old logo file if it exists
    if (currentClub.logoUrl) {
      try {
        const oldLogoPath = path.join(__dirname, '..', currentClub.logoUrl);
        await fs.unlink(oldLogoPath);
      } catch (error) {
        console.warn('Could not delete old logo file:', error.message);
      }
    }

    // Update club with new logo URL
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: { logoUrl },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Logo uploaded successfully',
      club: updatedClub
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    
    // Clean up uploaded file if database update failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Could not clean up uploaded file:', unlinkError.message);
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/clubs/:clubId/logo - Remove club logo
router.delete('/:clubId/logo', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Only club admins can remove logos
    if (req.user.role !== 'CLUB_ADMIN' || req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Only club administrators can remove logos' });
    }

    // Get current club to check for existing logo
    const currentClub = await prisma.club.findUnique({
      where: { id: clubId },
      select: { logoUrl: true }
    });

    if (!currentClub) {
      return res.status(404).json({ error: 'Club not found' });
    }

    if (!currentClub.logoUrl) {
      return res.status(400).json({ error: 'No logo to remove' });
    }

    // Delete logo file
    try {
      const logoPath = path.join(__dirname, '..', currentClub.logoUrl);
      await fs.unlink(logoPath);
    } catch (error) {
      console.warn('Could not delete logo file:', error.message);
    }

    // Update club to remove logo URL
    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: { logoUrl: null },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Logo removed successfully',
      club: updatedClub
    });
  } catch (error) {
    console.error('Error removing logo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clubs/:clubId/theme - Get club theme settings (public endpoint for theming)
router.get('/:clubId/theme', async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        customCss: true
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json(club);
  } catch (error) {
    console.error('Error fetching club theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clubs/:clubId/theme - Update only theme settings
router.put('/:clubId/theme', async (req, res) => {
  try {
    const { clubId } = req.params;
    
    // Only club admins can update theme
    if (req.user.role !== 'CLUB_ADMIN' || req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'Only club administrators can update theme settings' });
    }

    // Validate theme-specific fields
    const themeSchema = Joi.object({
      primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      accentColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
      fontFamily: Joi.string().max(100),
      customCss: Joi.string().allow('')
    });

    const { error, value } = themeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Update only theme fields
    const updatedClub = await prisma.club.update({
      where: { id: clubId },
      data: value,
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        customCss: true,
        updatedAt: true
      }
    });

    res.json(updatedClub);
  } catch (error) {
    console.error('Error updating club theme:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 