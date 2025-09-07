const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const certificateService = require('../services/certificateService');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const awardCertificateSchema = Joi.object({
  gymnastId: Joi.string().required(),
  levelId: Joi.string().required(),
  type: Joi.string().valid('LEVEL_COMPLETION', 'SPECIAL_ACHIEVEMENT', 'PARTICIPATION').default('LEVEL_COMPLETION'),
  templateId: Joi.string().optional(),
  notes: Joi.string().max(500).allow('', null)
});

const updateCertificateStatusSchema = Joi.object({
  status: Joi.string().valid('AWARDED', 'PRINTED', 'DELIVERED').required(),
  notes: Joi.string().max(500).allow('', null)
});

// Get all certificates for a club (coaches and admins only)
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { status, gymnastId, levelId, type } = req.query;
    
    // Build filter conditions
    const where = {
      gymnast: {
        clubId: req.user.clubId
      }
    };

    if (status) where.status = status;
    if (gymnastId) where.gymnastId = gymnastId;
    if (levelId) where.levelId = levelId;
    if (type) where.type = type;

    const certificates = await prisma.certificate.findMany({
      where,
      include: {
        gymnast: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        level: {
          select: {
            id: true,
            identifier: true,
            name: true
          }
        },
        awardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        printedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        physicallyAwardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { awardedAt: 'desc' }
      ]
    });

    res.json(certificates);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get certificates for a specific gymnast
router.get('/gymnast/:gymnastId', auth, async (req, res) => {
  try {
    const { gymnastId } = req.params;
    const { page = 1, limit = 5 } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number' });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({ error: 'Invalid limit (must be between 1 and 50)' });
    }

    // Verify gymnast belongs to user's club or user has access
    const gymnast = await prisma.gymnast.findFirst({
      where: {
        id: gymnastId,
        OR: [
          { clubId: req.user.clubId },
          { guardians: { some: { id: req.user.id } } },
          { userId: req.user.id }
        ]
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found or access denied' });
    }

    // Get total count for pagination
    const totalCertificates = await prisma.certificate.count({
      where: { gymnastId }
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalCertificates / limitNum);
    const skip = (pageNum - 1) * limitNum;

    const certificates = await prisma.certificate.findMany({
      where: { gymnastId },
      include: {
        level: {
          select: {
            id: true,
            identifier: true,
            name: true
          }
        },
        awardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        printedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        physicallyAwardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { awardedAt: 'desc' }
      ],
      skip,
      take: limitNum
    });

    res.json({
      certificates,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCertificates,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get gymnast certificates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Award a certificate (coaches and admins only)
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { error, value } = awardCertificateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { gymnastId, levelId, type, templateId, notes } = value;

    // Verify gymnast belongs to user's club
    const gymnast = await prisma.gymnast.findFirst({
      where: {
        id: gymnastId,
        clubId: req.user.clubId
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found in your club' });
    }

    // Verify level exists
    const level = await prisma.level.findUnique({
      where: { id: levelId }
    });

    if (!level) {
      return res.status(404).json({ error: 'Level not found' });
    }

    // Check if certificate already exists
    const existingCertificate = await prisma.certificate.findUnique({
      where: {
        gymnastId_levelId_type: {
          gymnastId,
          levelId,
          type
        }
      }
    });

    if (existingCertificate) {
      return res.status(400).json({ error: 'Certificate already awarded for this gymnast, level, and type' });
    }

    // Get gymnast to get club ID and guardians for email notifications
    const gymnastForCertificate = await prisma.gymnast.findUnique({
      where: { id: gymnastId },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        club: {
          select: {
            id: true,
            name: true,
            emailEnabled: true
          }
        }
      }
    });

    if (!gymnastForCertificate) {
      return res.status(404).json({ error: 'Gymnast not found' });
    }

    const certificate = await prisma.certificate.create({
      data: {
        gymnastId,
        levelId,
        clubId: gymnastForCertificate.clubId,
        templateId,
        type,
        awardedById: req.user.id,
        notes
      },
      include: {
        gymnast: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        level: {
          select: {
            id: true,
            identifier: true,
            name: true
          }
        },
        awardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Generate PNG certificate
    try {
      const club = await prisma.club.findUnique({
        where: { id: gymnastForCertificate.clubId },
        select: {
          id: true,
          name: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          backgroundColor: true,
          textColor: true
        }
      });

      // Prepare certificate data for PNG generation
      const certificateData = {
        id: certificate.id,
        clubId: gymnastForCertificate.clubId,
        gymnast: {
          firstName: gymnastForCertificate.firstName,
          lastName: gymnastForCertificate.lastName,
          name: `${gymnastForCertificate.firstName} ${gymnastForCertificate.lastName}`
        },
        awardedBy: {
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          name: `${req.user.firstName} ${req.user.lastName}`
        },
        club: club,
        level: {
          identifier: level.identifier,
          name: level.name,
          levelNumber: level.identifier
        },
        awardedAt: certificate.awardedAt,
        templateId: templateId,
        template: null, // Will be loaded by service if needed
        fields: [] // Will be loaded by service if custom template exists
      };

      // Get template and fields if templateId is provided
      let templatePath = null;
      if (templateId) {
        const template = await prisma.certificateTemplate.findUnique({
          where: { id: templateId },
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' }
            }
          }
        });
        if (template) {
          certificateData.template = template;
          certificateData.fields = template.fields;
          templatePath = template.filePath;
        }
      }

      const pngBuffer = await certificateService.getCertificateWithCache(certificateData, templatePath);
      
      // Save the certificate
      await certificateService.saveCertificate(certificateData, pngBuffer);

      console.log(`📄 PNG certificate generated for ${gymnastForCertificate.firstName} ${gymnastForCertificate.lastName} - Level ${level.identifier}`);
    } catch (pngError) {
      console.error('PNG generation error:', pngError);
      // Don't fail the certificate creation if PNG generation fails
    }

    // Send email notifications to all parents/guardians only if club has email enabled
    if (gymnastForCertificate && gymnastForCertificate.guardians && gymnastForCertificate.guardians.length > 0 && gymnastForCertificate.club.emailEnabled) {
      const emailService = require('../services/emailService');
      
      // Send notification to each guardian who is a parent
      for (const guardian of gymnastForCertificate.guardians) {
        if (guardian.role === 'PARENT' && guardian.email) {
          try {
            await emailService.sendCertificateAwardNotification(
              guardian.email,
              guardian.firstName,
              gymnastForCertificate,
              certificate,
              certificate.level
            );
            console.log(`📧 Certificate notification sent to parent: ${guardian.email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send certificate notification to ${guardian.email}:`, emailError);
          }
        }
      }
    } else if (gymnastForCertificate && gymnastForCertificate.guardians && gymnastForCertificate.guardians.length > 0 && !gymnastForCertificate.club.emailEnabled) {
      console.log('📧 Certificate notification emails skipped - club has email disabled');
    }

    res.json(certificate);
  } catch (error) {
    console.error('Award certificate error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update certificate status (mark as printed/delivered)
router.put('/:certificateId/status', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { error, value } = updateCertificateStatusSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { status, notes } = value;

    // Verify certificate belongs to user's club
    const existingCertificate = await prisma.certificate.findFirst({
      where: {
        id: certificateId,
        gymnast: {
          clubId: req.user.clubId
        }
      }
    });

    if (!existingCertificate) {
      return res.status(404).json({ error: 'Certificate not found in your club' });
    }

    // Prepare update data based on status
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === 'PRINTED' && !existingCertificate.printedAt) {
      updateData.printedAt = new Date();
      updateData.printedById = req.user.id;
    }

    if (status === 'DELIVERED' && !existingCertificate.physicallyAwardedAt) {
      updateData.physicallyAwardedAt = new Date();
      updateData.physicallyAwardedById = req.user.id;
      
      // If marking as delivered, also mark as printed if not already
      if (!existingCertificate.printedAt) {
        updateData.printedAt = new Date();
        updateData.printedById = req.user.id;
      }
    }

    const certificate = await prisma.certificate.update({
      where: { id: certificateId },
      data: updateData,
      include: {
        gymnast: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        level: {
          select: {
            id: true,
            identifier: true,
            name: true
          }
        },
        awardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        printedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        physicallyAwardedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json(certificate);
  } catch (error) {
    console.error('Update certificate status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a certificate (club admins only)
router.delete('/:certificateId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { certificateId } = req.params;

    // Verify certificate belongs to user's club
    const existingCertificate = await prisma.certificate.findFirst({
      where: {
        id: certificateId,
        gymnast: {
          clubId: req.user.clubId
        }
      }
    });

    if (!existingCertificate) {
      return res.status(404).json({ error: 'Certificate not found in your club' });
    }

    await prisma.certificate.delete({
      where: { id: certificateId }
    });

    // Clean up certificate files and cache
    try {
      await certificateService.deleteCertificate(certificateId);
      console.log(`🗑️ Certificate files and cache cleaned up for certificate ${certificateId}`);
    } catch (cleanupError) {
      console.error('Certificate cleanup error:', cleanupError);
      // Don't fail the deletion if cleanup fails
    }

    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Delete certificate error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get certificate statistics for dashboard
router.get('/stats', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const totalCertificates = await prisma.certificate.count({
      where: {
        gymnast: {
          clubId: req.user.clubId
        }
      }
    });

    const statusBreakdown = await prisma.certificate.groupBy({
      by: ['status'],
      where: {
        gymnast: {
          clubId: req.user.clubId
        }
      },
      _count: {
        id: true
      }
    });

    const typeBreakdown = await prisma.certificate.groupBy({
      by: ['type'],
      where: {
        gymnast: {
          clubId: req.user.clubId
        }
      },
      _count: {
        id: true
      }
    });

    const recentCertificates = await prisma.certificate.findMany({
      where: {
        gymnast: {
          clubId: req.user.clubId
        }
      },
      include: {
        gymnast: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        level: {
          select: {
            identifier: true,
            name: true
          }
        }
      },
      orderBy: { awardedAt: 'desc' },
      take: 5
    });

    res.json({
      totalCertificates,
      statusBreakdown: statusBreakdown.map(stat => ({
        status: stat.status,
        count: stat._count.id
      })),
      typeBreakdown: typeBreakdown.map(stat => ({
        type: stat.type,
        count: stat._count.id
      })),
      recentCertificates
    });
  } catch (error) {
    console.error('Get certificate stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download certificate
router.get('/:certificateId/download', auth, async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    // Get certificate data
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        gymnast: {
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
        },
        club: true,
        awardedBy: true,
        level: true,
        template: {
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });
    
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    // Check if user has access
    const hasAccess = (
      req.user.role === 'ADMIN' ||
      req.user.clubId === certificate.clubId ||
      // Parents can access their children's certificates
      (req.user.role === 'PARENT' && certificate.gymnast.guardians && 
       certificate.gymnast.guardians.some(guardian => guardian.id === req.user.id)) ||
      // Gymnasts can access their own certificates
      (req.user.role === 'GYMNAST' && certificate.gymnast.userId === req.user.id)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Note: Template check removed - service will fall back to basic certificate if no template found
    
    // Use cached certificate generation
    let templatePath = null;
    if (certificate.template && certificate.template.filePath) {
      templatePath = certificate.template.filePath;
    }
    
    const pngBuffer = await certificateService.getCertificateWithCache(certificate, templatePath);
    
    // Also save to the legacy storage location for backward compatibility
    await certificateService.saveCertificate(certificate, pngBuffer);
    
    // Set response headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.gymnast.firstName}-${certificate.gymnast.lastName}-${certificate.level.name.replace(/\s+/g, '-')}.png"`);
    
    res.send(pngBuffer);
    
  } catch (error) {
    console.error('Certificate download error:', error);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

// Preview certificate
router.get('/:certificateId/preview', auth, async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    // Get certificate data
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        gymnast: {
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
        },
        club: true,
        awardedBy: true,
        level: true,
        template: {
          include: {
            fields: {
              where: { isVisible: true },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });
    
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    // Check if user has access
    const hasAccess = (
      req.user.role === 'ADMIN' ||
      req.user.clubId === certificate.clubId ||
      // Parents can access their children's certificates
      (req.user.role === 'PARENT' && certificate.gymnast.guardians && 
       certificate.gymnast.guardians.some(guardian => guardian.id === req.user.id)) ||
      // Gymnasts can access their own certificates
      (req.user.role === 'GYMNAST' && certificate.gymnast.userId === req.user.id)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Note: Template check removed - service will fall back to basic certificate if no template found
    
    // Generate certificate PNG with caching
    let templatePath = null;
    if (certificate.template && certificate.template.filePath) {
      templatePath = certificate.template.filePath;
    }
    
    const pngBuffer = await certificateService.getCertificateWithCache(certificate, templatePath);
    
    // Set response headers for inline display
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline');
    
    res.send(pngBuffer);
    
  } catch (error) {
    console.error('Certificate preview error:', error);
    res.status(500).json({ error: 'Failed to preview certificate' });
  }
});

// Cache management endpoint (admin only)
router.post('/admin/cache/cleanup', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    await certificateService.cleanupCache();
    res.json({ message: 'Cache cleanup completed successfully' });
  } catch (error) {
    console.error('Cache cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup cache' });
  }
});

// Regenerate certificates endpoint (club admin only)
router.post('/regenerate', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { templateId, forceAll } = req.body;
    
    // Build filter for certificates to regenerate
    const whereClause = {
      gymnast: {
        clubId: req.user.clubId
      }
    };
    
    // If templateId is provided, only regenerate certificates using that template
    if (templateId) {
      whereClause.templateId = templateId;
    }
    
    // If forceAll is false, only regenerate certificates that actually need regeneration
    const certificates = await prisma.certificate.findMany({
      where: whereClause,
      include: {
        template: {
          include: {
            fields: true
          }
        },
        gymnast: true,
        level: true,
        club: true,
        awardedBy: true
      }
    });
    
    let regeneratedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (const certificate of certificates) {
      try {
        // Check if regeneration is needed (unless forcing all)
        if (!forceAll && certificate.template) {
          const needsRegen = await certificateService.needsRegeneration(certificate);
          if (!needsRegen) {
            skippedCount++;
            continue;
          }
        }
        
        // Invalidate cache to force regeneration
        await certificateService.invalidateCache(certificate.id);
        
        // Generate new certificate
        let templatePath = null;
        if (certificate.template && certificate.template.filePath) {
          templatePath = certificate.template.filePath;
        }
        
        const pngBuffer = await certificateService.getCertificateWithCache(certificate, templatePath);
        await certificateService.saveCertificate(certificate, pngBuffer);
        
        regeneratedCount++;
        console.log(`✅ Regenerated certificate ${certificate.id} for ${certificate.gymnast.firstName} ${certificate.gymnast.lastName}`);
        
      } catch (error) {
        console.error(`❌ Failed to regenerate certificate ${certificate.id}:`, error);
        errors.push({
          certificateId: certificate.id,
          gymnastName: `${certificate.gymnast.firstName} ${certificate.gymnast.lastName}`,
          error: error.message
        });
      }
    }
    
    const result = {
      totalCertificates: certificates.length,
      regeneratedCount,
      skippedCount,
      errorCount: errors.length
    };
    
    if (errors.length > 0) {
      result.errors = errors;
    }
    
    console.log(`🔄 Certificate regeneration completed: ${regeneratedCount} regenerated, ${skippedCount} skipped, ${errors.length} errors`);
    
    res.json({
      message: `Certificate regeneration completed: ${regeneratedCount} regenerated, ${skippedCount} skipped`,
      ...result
    });
    
  } catch (error) {
    console.error('Certificate regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate certificates' });
  }
});

// Cache status endpoint (admin only)
router.get('/admin/cache/status', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const cacheDir = path.join(__dirname, '..', 'certificate-cache');
    
    try {
      const files = await fs.readdir(cacheDir);
      const metadataFiles = files.filter(file => file.endsWith('.meta.json'));
      
      let totalSize = 0;
      let totalFiles = 0;
      let oldestFile = null;
      let newestFile = null;
      
      for (const metaFile of metadataFiles) {
        try {
          const metadataPath = path.join(cacheDir, metaFile);
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          
          const cacheFilePath = path.join(cacheDir, `${metadata.cacheKey}.png`);
          const stats = await fs.stat(cacheFilePath);
          
          totalSize += stats.size;
          totalFiles++;
          
          if (!oldestFile || metadata.createdAt < oldestFile.createdAt) {
            oldestFile = metadata;
          }
          
          if (!newestFile || metadata.createdAt > newestFile.createdAt) {
            newestFile = metadata;
          }
        } catch (error) {
          // Skip corrupted metadata files
        }
      }
      
      res.json({
        totalFiles,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        oldestFile: oldestFile ? {
          cacheKey: oldestFile.cacheKey,
          createdAt: new Date(oldestFile.createdAt).toISOString(),
          lastAccessedAt: new Date(oldestFile.lastAccessedAt).toISOString(),
          accessCount: oldestFile.accessCount
        } : null,
        newestFile: newestFile ? {
          cacheKey: newestFile.cacheKey,
          createdAt: new Date(newestFile.createdAt).toISOString(),
          lastAccessedAt: new Date(newestFile.lastAccessedAt).toISOString(),
          accessCount: newestFile.accessCount
        } : null
      });
    } catch (error) {
      res.json({
        totalFiles: 0,
        totalSize: 0,
        totalSizeMB: '0.00',
        oldestFile: null,
        newestFile: null,
        error: 'Cache directory not found or empty'
      });
    }
  } catch (error) {
    console.error('Cache status error:', error);
    res.status(500).json({ error: 'Failed to get cache status' });
  }
});

module.exports = router; 