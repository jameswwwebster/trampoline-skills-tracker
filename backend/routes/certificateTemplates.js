const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for PDF upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'certificate-templates');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG image files are allowed'), false);
    }
  }
});

// Get all certificate templates for the user's club
router.get('/', auth, async (req, res) => {
  try {
    const templates = await prisma.certificateTemplate.findMany({
      where: {
        clubId: req.user.clubId,
        isActive: true
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching certificate templates:', error);
    res.status(500).json({ error: 'Failed to fetch certificate templates' });
  }
});

// Get the default template for the user's club
router.get('/default', auth, async (req, res) => {
  try {
    const defaultTemplate = await prisma.certificateTemplate.findFirst({
      where: {
        clubId: req.user.clubId,
        isDefault: true,
        isActive: true
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!defaultTemplate) {
      return res.status(404).json({ error: 'No default template found' });
    }

    res.json(defaultTemplate);
  } catch (error) {
    console.error('Error fetching default certificate template:', error);
    res.status(500).json({ error: 'Failed to fetch default certificate template' });
  }
});

// Get a specific certificate template with fields
router.get('/:id', auth, async (req, res) => {
  try {
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.id,
        clubId: req.user.clubId
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching certificate template:', error);
    res.status(500).json({ error: 'Failed to fetch certificate template' });
  }
});

// Upload a new certificate template
router.post('/upload', auth, requireRole(['CLUB_ADMIN']), upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, isDefault } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // If this is being set as default, unset any existing default
    if (isDefault === 'true') {
      await prisma.certificateTemplate.updateMany({
        where: {
          clubId: req.user.clubId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        clubId: req.user.clubId,
        name: name.trim(),
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        isDefault: isDefault === 'true'
      }
    });

    res.json(template);
  } catch (error) {
    console.error('Error uploading certificate template:', error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload certificate template' });
  }
});

// Update template metadata
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { name, isDefault } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Template name is required' });
    }

    // Check if template exists and belongs to the user's club
    const existingTemplate = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.id,
        clubId: req.user.clubId
      }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    // If this is being set as default, unset any existing default
    if (isDefault === true) {
      await prisma.certificateTemplate.updateMany({
        where: {
          clubId: req.user.clubId,
          isDefault: true,
          id: { not: req.params.id }
        },
        data: {
          isDefault: false
        }
      });
    }

    const template = await prisma.certificateTemplate.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        isDefault: isDefault === true
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      }
    });

    // Invalidate cache for certificates using this template
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: req.params.id },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates using updated template ${req.params.id}`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the update if cache invalidation fails
    }

    res.json(template);
  } catch (error) {
    console.error('Error updating certificate template:', error);
    res.status(500).json({ error: 'Failed to update certificate template' });
  }
});

// Delete a certificate template
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.id,
        clubId: req.user.clubId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    // Check if template is being used by any certificates
    const certificateCount = await prisma.certificate.count({
      where: {
        templateId: req.params.id
      }
    });

    if (certificateCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete template that is being used by certificates. Archive it instead.',
        certificateCount
      });
    }

    // Invalidate cache for certificates using this template before deletion
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: req.params.id },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates using deleted template ${req.params.id}`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    // Delete the template (this will cascade delete fields)
    await prisma.certificateTemplate.delete({
      where: { id: req.params.id }
    });

    // Clean up the physical file
    try {
      await fs.unlink(template.filePath);
    } catch (fileError) {
      console.warn('Could not delete template file:', fileError);
    }

    res.json({ message: 'Certificate template deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate template:', error);
    res.status(500).json({ error: 'Failed to delete certificate template' });
  }
});

// Archive a certificate template
router.post('/:id/archive', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.id,
        clubId: req.user.clubId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    const updatedTemplate = await prisma.certificateTemplate.update({
      where: { id: req.params.id },
      data: {
        isActive: false,
        isDefault: false // Remove default status when archiving
      }
    });

    // Invalidate cache for certificates using this template
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: req.params.id },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates using archived template ${req.params.id}`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the archive if cache invalidation fails
    }

    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error archiving certificate template:', error);
    res.status(500).json({ error: 'Failed to archive certificate template' });
  }
});

// Get the PDF file for a template
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.id,
        clubId: req.user.clubId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    // Check if file exists
    try {
      await fs.access(template.filePath);
    } catch (fileError) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${template.fileName}"`);
    res.sendFile(path.resolve(template.filePath));
  } catch (error) {
    console.error('Error serving template PDF:', error);
    res.status(500).json({ error: 'Failed to serve template PDF' });
  }
});

module.exports = router; 