const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schema for branding updates
const brandingUpdateSchema = Joi.object({
  primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).allow(null),
  secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).allow(null),
  accentColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).allow(null),
  backgroundColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).allow(null),
  textColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).allow(null),
  logoUrl: Joi.alternatives().try(
    Joi.string().uri(),
    Joi.string().allow(''),
    Joi.allow(null)
  ).optional(),
  fontFamily: Joi.string().max(100).allow(null, '').optional(),
  website: Joi.alternatives().try(
    Joi.string().uri(),
    Joi.string().allow(''),
    Joi.allow(null)
  ).optional(),
  description: Joi.string().max(500).allow(null, '').optional()
});

// Get club branding settings
router.get('/', auth, async (req, res) => {
  try {
    const club = await prisma.club.findUnique({
      where: { id: req.user.clubId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        website: true,
        description: true
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json(club);
  } catch (error) {
    console.error('Get branding error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update club branding settings (club admins only)
router.put('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    console.log('Branding update request body:', req.body);
    
    const { error, value } = brandingUpdateSchema.validate(req.body);
    
    if (error) {
      console.error('Validation error:', error.details[0].message);
      console.error('Failed validation for:', req.body);
      return res.status(400).json({ error: error.details[0].message });
    }

    console.log('Validated branding data:', value);

    const updatedClub = await prisma.club.update({
      where: { id: req.user.clubId },
      data: value,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        backgroundColor: true,
        textColor: true,
        fontFamily: true,
        website: true,
        description: true
      }
    });

    console.log('Updated club branding successfully');
    res.json(updatedClub);
  } catch (error) {
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get default color schemes
router.get('/presets', auth, (req, res) => {
  const presets = [
    {
      name: 'Classic Blue',
      primaryColor: '#2c3e50',
      secondaryColor: '#3498db',
      accentColor: '#d4af37',
      backgroundColor: '#f8f9fa',
      textColor: '#212529'
    },
    {
      name: 'Vibrant Purple',
      primaryColor: '#8e44ad',
      secondaryColor: '#9b59b6',
      accentColor: '#f39c12',
      backgroundColor: '#f8f9fa',
      textColor: '#2c3e50'
    },
    {
      name: 'Forest Green',
      primaryColor: '#27ae60',
      secondaryColor: '#2ecc71',
      accentColor: '#e74c3c',
      backgroundColor: '#f8f9fa',
      textColor: '#2c3e50'
    },
    {
      name: 'Sunset Orange',
      primaryColor: '#e67e22',
      secondaryColor: '#f39c12',
      accentColor: '#3498db',
      backgroundColor: '#f8f9fa',
      textColor: '#2c3e50'
    },
    {
      name: 'Ocean Teal',
      primaryColor: '#16a085',
      secondaryColor: '#1abc9c',
      accentColor: '#e74c3c',
      backgroundColor: '#f8f9fa',
      textColor: '#2c3e50'
    }
  ];

  res.json(presets);
});

module.exports = router; 