const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all fields for a specific template
router.get('/template/:templateId', auth, async (req, res) => {
  try {
    // Verify template belongs to user's club
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.templateId,
        clubId: req.user.clubId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    const fields = await prisma.certificateField.findMany({
      where: {
        templateId: req.params.templateId
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    res.json(fields);
  } catch (error) {
    console.error('Error fetching certificate fields:', error);
    res.status(500).json({ error: 'Failed to fetch certificate fields' });
  }
});

// Create a new field for a template
router.post('/template/:templateId', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    // Verify template belongs to user's club
    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: req.params.templateId,
        clubId: req.user.clubId
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Certificate template not found' });
    }

    const {
      fieldType,
      label,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily,
      fontColor,
      fontWeight,
      textAlign,
      rotation,
      isVisible,
      customText,
      order
    } = req.body;

    // Validate required fields
    if (!fieldType || !label || x === undefined || y === undefined) {
      return res.status(400).json({ 
        error: 'fieldType, label, x, and y are required' 
      });
    }

    // Validate field type
    const validFieldTypes = ['GYMNAST_NAME', 'COACH_NAME', 'DATE', 'LEVEL_NAME', 'LEVEL_NUMBER', 'CLUB_NAME', 'CUSTOM_TEXT'];
    if (!validFieldTypes.includes(fieldType)) {
      return res.status(400).json({ 
        error: 'Invalid field type' 
      });
    }

    // For CUSTOM_TEXT fields, customText is required
    if (fieldType === 'CUSTOM_TEXT' && (!customText || customText.trim() === '')) {
      return res.status(400).json({ 
        error: 'customText is required for CUSTOM_TEXT field type' 
      });
    }

    // Get the next order number if not provided
    let fieldOrder = order;
    if (fieldOrder === undefined) {
      const maxOrder = await prisma.certificateField.findFirst({
        where: {
          templateId: req.params.templateId
        },
        orderBy: {
          order: 'desc'
        }
      });
      fieldOrder = maxOrder ? maxOrder.order + 1 : 0;
    }

    const field = await prisma.certificateField.create({
      data: {
        templateId: req.params.templateId,
        fieldType,
        label,
        x: parseFloat(x),
        y: parseFloat(y),
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        fontSize: fontSize ? parseInt(fontSize) : 18,
        fontFamily: fontFamily || 'Arial',
        fontColor: fontColor || '#000000',
        fontWeight: fontWeight || 'normal',
        textAlign: textAlign || 'center',
        rotation: rotation ? parseFloat(rotation) : 0,
        isVisible: isVisible !== false,
        customText: fieldType === 'CUSTOM_TEXT' ? customText : null,
        order: fieldOrder
      }
    });

    // Invalidate cache for certificates using this template
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: req.params.templateId },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates due to field creation`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the creation if cache invalidation fails
    }

    res.json(field);
  } catch (error) {
    console.error('Error creating certificate field:', error);
    res.status(500).json({ error: 'Failed to create certificate field' });
  }
});

// Update a field
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    // Verify field exists and belongs to user's club
    const field = await prisma.certificateField.findFirst({
      where: {
        id: req.params.id
      },
      include: {
        template: true
      }
    });

    if (!field || field.template.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Certificate field not found' });
    }

    const {
      label,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily,
      fontColor,
      fontWeight,
      textAlign,
      rotation,
      isVisible,
      customText,
      order
    } = req.body;

    // For CUSTOM_TEXT fields, customText is required
    if (field.fieldType === 'CUSTOM_TEXT' && customText !== undefined && customText.trim() === '') {
      return res.status(400).json({ 
        error: 'customText cannot be empty for CUSTOM_TEXT field type' 
      });
    }

    const updatedField = await prisma.certificateField.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined && { label }),
        ...(x !== undefined && { x: parseFloat(x) }),
        ...(y !== undefined && { y: parseFloat(y) }),
        ...(width !== undefined && { width: width ? parseFloat(width) : null }),
        ...(height !== undefined && { height: height ? parseFloat(height) : null }),
        ...(fontSize !== undefined && { fontSize: parseInt(fontSize) }),
        ...(fontFamily !== undefined && { fontFamily }),
        ...(fontColor !== undefined && { fontColor }),
        ...(fontWeight !== undefined && { fontWeight }),
        ...(textAlign !== undefined && { textAlign }),
        ...(rotation !== undefined && { rotation: parseFloat(rotation) }),
        ...(isVisible !== undefined && { isVisible }),
        ...(customText !== undefined && { customText }),
        ...(order !== undefined && { order: parseInt(order) })
      }
    });

    // Invalidate cache for certificates using this template
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: field.templateId },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates due to field update`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the update if cache invalidation fails
    }

    res.json(updatedField);
  } catch (error) {
    console.error('Error updating certificate field:', error);
    res.status(500).json({ error: 'Failed to update certificate field' });
  }
});

// Delete a field
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    // Verify field exists and belongs to user's club
    const field = await prisma.certificateField.findFirst({
      where: {
        id: req.params.id
      },
      include: {
        template: true
      }
    });

    if (!field || field.template.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Certificate field not found' });
    }

    await prisma.certificateField.delete({
      where: { id: req.params.id }
    });

    // Invalidate cache for certificates using this template
    try {
      const certificateService = require('../services/certificateService');
      
      // Find all certificates using this template
      const certificates = await prisma.certificate.findMany({
        where: { templateId: field.templateId },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates due to field deletion`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the deletion if cache invalidation fails
    }

    res.json({ message: 'Certificate field deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate field:', error);
    res.status(500).json({ error: 'Failed to delete certificate field' });
  }
});

// Bulk update field positions (for drag-and-drop)
router.post('/bulk-update', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    const { fields } = req.body;
    
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'fields must be an array' });
    }

    // Verify all fields belong to user's club
    const fieldIds = fields.map(f => f.id);
    const existingFields = await prisma.certificateField.findMany({
      where: {
        id: { in: fieldIds }
      },
      include: {
        template: true
      }
    });

    const invalidFields = existingFields.filter(field => field.template.clubId !== req.user.clubId);
    if (invalidFields.length > 0) {
      return res.status(403).json({ error: 'Unauthorized to update some fields' });
    }

    if (existingFields.length !== fields.length) {
      return res.status(404).json({ error: 'Some fields not found' });
    }

    // Update all fields
    const updates = fields.map(field => 
      prisma.certificateField.update({
        where: { id: field.id },
        data: {
          x: parseFloat(field.x),
          y: parseFloat(field.y),
          ...(field.order !== undefined && { order: parseInt(field.order) })
        }
      })
    );

    await Promise.all(updates);

    // Return updated fields
    const updatedFields = await prisma.certificateField.findMany({
      where: {
        id: { in: fieldIds }
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Invalidate cache for certificates using templates of these fields
    try {
      const certificateService = require('../services/certificateService');
      
      // Get unique template IDs from the updated fields
      const templateIds = [...new Set(existingFields.map(f => f.templateId))];
      
      // Find all certificates using these templates
      const certificates = await prisma.certificate.findMany({
        where: { templateId: { in: templateIds } },
        select: { id: true }
      });
      
      // Invalidate cache for each certificate
      for (const cert of certificates) {
        await certificateService.invalidateCache(cert.id);
      }
      
      console.log(`🗑️ Invalidated cache for ${certificates.length} certificates due to bulk field update`);
    } catch (cacheError) {
      console.error('Cache invalidation error:', cacheError);
      // Don't fail the bulk update if cache invalidation fails
    }

    res.json(updatedFields);
  } catch (error) {
    console.error('Error bulk updating certificate fields:', error);
    res.status(500).json({ error: 'Failed to update certificate fields' });
  }
});

// Duplicate a field
router.post('/:id/duplicate', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    // Verify field exists and belongs to user's club
    const field = await prisma.certificateField.findFirst({
      where: {
        id: req.params.id
      },
      include: {
        template: true
      }
    });

    if (!field || field.template.clubId !== req.user.clubId) {
      return res.status(404).json({ error: 'Certificate field not found' });
    }

    // Get the next order number for the template
    const maxOrder = await prisma.certificateField.findFirst({
      where: {
        templateId: field.templateId
      },
      orderBy: {
        order: 'desc'
      }
    });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 0;

    // Create duplicate field with slight offset to avoid exact overlap
    const duplicatedField = await prisma.certificateField.create({
      data: {
        templateId: field.templateId,
        fieldType: field.fieldType,
        label: `${field.label} (Copy)`,
        x: Math.min(1.0, field.x + 0.05), // Offset by 5% to the right, max 100%
        y: Math.min(1.0, field.y + 0.05), // Offset by 5% down, max 100%
        width: field.width,
        height: field.height,
        fontSize: field.fontSize,
        fontFamily: field.fontFamily,
        fontColor: field.fontColor,
        fontWeight: field.fontWeight,
        textAlign: field.textAlign,
        rotation: field.rotation,
        isVisible: field.isVisible,
        customText: field.customText,
        order: nextOrder
      }
    });

    res.json(duplicatedField);
  } catch (error) {
    console.error('Error duplicating certificate field:', error);
    res.status(500).json({ error: 'Failed to duplicate certificate field' });
  }
});

// Get available field types
router.get('/types', auth, (req, res) => {
  const fieldTypes = [
    { value: 'GYMNAST_NAME', label: 'Gymnast Name', description: 'The name of the gymnast receiving the certificate' },
    { value: 'COACH_NAME', label: 'Coach Name', description: 'The name of the coach awarding the certificate' },
    { value: 'DATE', label: 'Date', description: 'The date the certificate was awarded' },
    { value: 'LEVEL_NAME', label: 'Level Name', description: 'The name of the level completed' },
    { value: 'LEVEL_NUMBER', label: 'Level Number', description: 'The number of the level completed' },
    { value: 'CLUB_NAME', label: 'Club Name', description: 'The name of the club' },
    { value: 'CUSTOM_TEXT', label: 'Custom Text', description: 'Static text that you can customize' }
  ];

  res.json(fieldTypes);
});

module.exports = router; 