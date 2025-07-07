const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all custom fields for a club
router.get('/', auth, async (req, res) => {
  try {
    const fields = await prisma.userCustomField.findMany({
      where: {
        clubId: req.user.clubId,
        isActive: true
      },
      orderBy: {
        order: 'asc'
      }
    });

    res.json(fields);
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Create a new custom field
router.post('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { name, key, fieldType, isRequired, options } = req.body;

    // Validate required fields
    if (!name || !key || !fieldType) {
      return res.status(400).json({ error: 'Name, key, and fieldType are required' });
    }

    // Validate field type
    const validTypes = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'DROPDOWN', 'MULTI_SELECT', 'TEXTAREA'];
    if (!validTypes.includes(fieldType)) {
      return res.status(400).json({ error: 'Invalid field type' });
    }

    // For dropdown/multi-select, validate options
    if ((fieldType === 'DROPDOWN' || fieldType === 'MULTI_SELECT') && !options) {
      return res.status(400).json({ error: 'Options are required for dropdown and multi-select fields' });
    }

    // Get the next order number
    const lastField = await prisma.userCustomField.findFirst({
      where: { clubId: req.user.clubId },
      orderBy: { order: 'desc' }
    });
    const nextOrder = lastField ? lastField.order + 1 : 0;

    const field = await prisma.userCustomField.create({
      data: {
        clubId: req.user.clubId,
        name,
        key: key.toLowerCase().replace(/[^a-z0-9]/g, '_'), // Sanitize key
        fieldType,
        isRequired: isRequired || false,
        options: options ? JSON.stringify(options) : null,
        order: nextOrder
      }
    });

    res.status(201).json(field);
  } catch (error) {
    console.error('Error creating custom field:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'A field with this key already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create custom field' });
    }
  }
});

// Update a custom field
router.put('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fieldType, isRequired, options, isActive } = req.body;

    // Verify the field belongs to the user's club
    const existingField = await prisma.userCustomField.findFirst({
      where: {
        id,
        clubId: req.user.clubId
      }
    });

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (fieldType !== undefined) updateData.fieldType = fieldType;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (options !== undefined) updateData.options = options ? JSON.stringify(options) : null;

    const field = await prisma.userCustomField.update({
      where: { id },
      data: updateData
    });

    res.json(field);
  } catch (error) {
    console.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// Delete a custom field
router.delete('/:id', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the field belongs to the user's club
    const existingField = await prisma.userCustomField.findFirst({
      where: {
        id,
        clubId: req.user.clubId
      }
    });

    if (!existingField) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    // Soft delete by setting isActive to false
    await prisma.userCustomField.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// Reorder custom fields
router.put('/reorder', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { fieldIds } = req.body;

    if (!Array.isArray(fieldIds)) {
      return res.status(400).json({ error: 'fieldIds must be an array' });
    }

    // Update the order of each field
    const updatePromises = fieldIds.map((fieldId, index) =>
      prisma.userCustomField.updateMany({
        where: {
          id: fieldId,
          clubId: req.user.clubId
        },
        data: {
          order: index
        }
      })
    );

    await Promise.all(updatePromises);

    res.json({ message: 'Field order updated successfully' });
  } catch (error) {
    console.error('Error reordering custom fields:', error);
    res.status(500).json({ error: 'Failed to reorder custom fields' });
  }
});

// Get custom field values for a user
router.get('/values/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the user belongs to the same club
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        clubId: req.user.clubId
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const values = await prisma.userCustomFieldValue.findMany({
      where: {
        userId
      },
      include: {
        field: true
      }
    });

    res.json(values);
  } catch (error) {
    console.error('Error fetching custom field values:', error);
    res.status(500).json({ error: 'Failed to fetch custom field values' });
  }
});

// Set custom field values for a user
router.post('/values/:userId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { values } = req.body;

    // Verify the user belongs to the same club
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        clubId: req.user.clubId
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate that all field IDs belong to the club
    const fieldIds = Object.keys(values);
    const fields = await prisma.userCustomField.findMany({
      where: {
        id: { in: fieldIds },
        clubId: req.user.clubId
      }
    });

    if (fields.length !== fieldIds.length) {
      return res.status(400).json({ error: 'Some field IDs are invalid' });
    }

    // Update or create values
    const updatePromises = Object.entries(values).map(([fieldId, value]) =>
      prisma.userCustomFieldValue.upsert({
        where: {
          userId_fieldId: {
            userId,
            fieldId
          }
        },
        update: {
          value: value?.toString() || null
        },
        create: {
          userId,
          fieldId,
          value: value?.toString() || null
        }
      })
    );

    await Promise.all(updatePromises);

    // Return updated custom field values in the same format as user endpoint
    const updatedValues = await prisma.userCustomFieldValue.findMany({
      where: {
        userId
      },
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
    });

    res.json(updatedValues);
  } catch (error) {
    console.error('Error updating custom field values:', error);
    res.status(500).json({ error: 'Failed to update custom field values' });
  }
});

module.exports = router; 