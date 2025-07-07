const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/csv');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `import-${uniqueSuffix}.csv`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Parse date from various formats
function parseDate(dateString) {
  if (!dateString || dateString.trim() === '') return null;
  
  try {
    const trimmed = dateString.trim();
    
    // Try multiple date formats
    const formats = [
      // MM/DD/YYYY format (British Gymnastics default)
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s|$)/,
      // DD/MM/YYYY format
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s|$)/,
      // YYYY-MM-DD format
      /^(\d{4})-(\d{1,2})-(\d{1,2})(\s|$)/,
      // DD-MM-YYYY format
      /^(\d{1,2})-(\d{1,2})-(\d{4})(\s|$)/
    ];
    
    // Try MM/DD/YYYY format first (most common for British Gymnastics)
    let match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s|$)/);
    if (match) {
      const [, month, day, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return date;
      }
    }
    
    // Try YYYY-MM-DD format
    match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(\s|$)/);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return date;
      }
    }
    
    // Try DD/MM/YYYY format (European)
    match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s|$)/);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return date;
      }
    }
    
    // Try DD-MM-YYYY format
    match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(\s|$)/);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime()) && date.getFullYear() == year) {
        return date;
      }
    }
    
    // Try JavaScript Date parsing as fallback
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

// Clean and validate phone number
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Return null if too short or too long
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }
  
  return phone.trim();
}

// Clean and validate email
function cleanEmail(email) {
  if (!email) return null;
  
  const cleaned = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

// Clean and normalize names for better matching
function cleanName(name) {
  if (!name) return null;
  return name.trim().toLowerCase();
}

// Determine if person is likely a gymnast based on age and roles
function isLikelyGymnast(age, roles) {
  // If age is under 18, very likely a gymnast
  if (age && age < 18) {
    return true;
  }
  
  // If age is under 25 and roles contains "Member" (and not coach/admin), likely a gymnast
  if (age && age < 25 && roles && roles.toLowerCase().includes('member') && !roles.toLowerCase().includes('coach') && !roles.toLowerCase().includes('administrator')) {
    return true;
  }
  
  // If roles contains "gymnast" explicitly
  if (roles && roles.toLowerCase().includes('gymnast')) {
    return true;
  }
  
  // If no clear indicators but age is young enough, assume gymnast
  if (age && age < 30) {
    return true;
  }
  
  // Default to gymnast if we can't determine (better to import than skip)
  return true;
}

// Save custom field values for a user
async function saveCustomFieldValues(userId, customFieldValues) {
  if (!customFieldValues || Object.keys(customFieldValues).length === 0) {
    return;
  }

  const savePromises = Object.entries(customFieldValues).map(([fieldId, value]) =>
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

  await Promise.all(savePromises);
}

// Preview CSV data before import
router.post('/preview', auth, requireRole(['CLUB_ADMIN']), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results = [];
    const errors = [];
    let lineNumber = 0;

    // Get custom fields for this club
    const customFields = await prisma.userCustomField.findMany({
      where: {
        clubId: req.user.clubId,
        isActive: true
      }
    });

    const stream = fs.createReadStream(req.file.path)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }));

    for await (const row of stream) {
      lineNumber++;
      
      try {
        const firstName = row['First Name']?.trim();
        const lastName = row['Last Name']?.trim();
        const email = cleanEmail(row['Email']);
        const phone = cleanPhoneNumber(row['Phone No']);
        const dateOfBirth = parseDate(row['Date Of Birth']);
        const age = parseInt(row['Age']);
        const organisation = row['Organisation']?.trim();
        const roles = row['Roles']?.trim();
        const memberships = row['Memberships']?.trim();
        const mid = row['MID']?.trim();

        // Extract custom field values
        const customFieldValues = {};
        customFields.forEach(field => {
          const value = row[field.name] || row[field.key];
          if (value !== undefined && value !== null && value.toString().trim() !== '') {
            customFieldValues[field.id] = value.toString().trim();
          }
        });

        // Validation
        if (!firstName || !lastName) {
          errors.push({
            line: lineNumber,
            error: 'Missing first name or last name',
            data: row
          });
          continue;
        }

        // Date of birth is optional for gymnasts, but if provided, must be valid
        if (row['Date Of Birth'] && row['Date Of Birth'].trim() !== '' && !dateOfBirth) {
          errors.push({
            line: lineNumber,
            error: 'Invalid date of birth format',
            data: row
          });
          continue;
        }

        // Check if this person is likely a gymnast
        const isGymnast = isLikelyGymnast(age, roles);

        const processedRow = {
          line: lineNumber,
          mid,
          firstName,
          lastName,
          email,
          phone,
          dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
          age,
          organisation,
          roles,
          memberships,
          customFieldValues,
          isGymnast,
          action: 'CREATE' // Default action
        };

        // Check for existing gymnast/user with enhanced matching
        const existingUser = email ? await prisma.user.findFirst({
          where: { 
            email: {
              equals: email,
              mode: 'insensitive'
            },
            clubId: req.user.clubId
          }
        }) : null;

        const existingGymnast = await prisma.gymnast.findFirst({
          where: {
            firstName: {
              equals: firstName,
              mode: 'insensitive'
            },
            lastName: {
              equals: lastName,
              mode: 'insensitive'
            },
            clubId: req.user.clubId
          },
          include: {
            user: true
          }
        });

        const hasCustomFields = Object.keys(customFieldValues).length > 0;

        if (existingUser || existingGymnast) {
          processedRow.action = 'UPDATE';
          processedRow.reason = existingUser ? 'Email already exists - will update' : 'Gymnast already exists - will update';
          processedRow.customFieldsCount = hasCustomFields;
        } else {
          processedRow.customFieldsCount = hasCustomFields;
        }

        results.push(processedRow);
      } catch (error) {
        errors.push({
          line: lineNumber,
          error: error.message,
          data: row
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      totalRows: results.length,
      validRows: results.filter(r => r.action === 'CREATE').length,
      updateRows: results.filter(r => r.action === 'UPDATE').length,
      skippedRows: results.filter(r => r.action === 'SKIP').length,
      errorRows: errors.length,
      customFieldsRows: results.filter(r => r.customFieldsCount > 0).length,
      data: results,
      errors
    });

  } catch (error) {
    console.error('CSV preview error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to preview CSV file' });
  }
});

// Import CSV data
router.post('/gymnasts', auth, requireRole(['CLUB_ADMIN']), upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const { importOptions } = req.body;
    const options = importOptions ? JSON.parse(importOptions) : {};
    
    const results = [];
    const errors = [];
    const imported = [];
    const skipped = [];
    let lineNumber = 0;

    // Get custom fields for this club
    const customFields = await prisma.userCustomField.findMany({
      where: {
        clubId: req.user.clubId,
        isActive: true
      }
    });

    const stream = fs.createReadStream(req.file.path)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }));

    for await (const row of stream) {
      lineNumber++;
      
      try {
        const firstName = row['First Name']?.trim();
        const lastName = row['Last Name']?.trim();
        const email = cleanEmail(row['Email']);
        const phone = cleanPhoneNumber(row['Phone No']);
        const dateOfBirth = parseDate(row['Date Of Birth']);
        const age = parseInt(row['Age']);
        const organisation = row['Organisation']?.trim();
        const roles = row['Roles']?.trim();
        const memberships = row['Memberships']?.trim();
        const mid = row['MID']?.trim();

        // Extract custom field values
        const customFieldValues = {};
        customFields.forEach(field => {
          const value = row[field.name] || row[field.key];
          if (value !== undefined && value !== null && value.toString().trim() !== '') {
            customFieldValues[field.id] = value.toString().trim();
          }
        });

        // Validation
        if (!firstName || !lastName) {
          errors.push({
            line: lineNumber,
            error: 'Missing first name or last name',
            data: { firstName, lastName }
          });
          continue;
        }

        // Date of birth is optional for gymnasts, but if provided, must be valid
        if (row['Date Of Birth'] && row['Date Of Birth'].trim() !== '' && !dateOfBirth) {
          errors.push({
            line: lineNumber,
            error: 'Invalid date of birth format',
            data: { firstName, lastName, dateOfBirth: row['Date Of Birth'] }
          });
          continue;
        }

        // Check if this person should be imported as a gymnast
        const isGymnast = isLikelyGymnast(age, roles);
        
        // Skip if not importing non-gymnasts and this person isn't a gymnast
        if (!options.importNonGymnasts && !isGymnast) {
          skipped.push({
            line: lineNumber,
            reason: 'Not identified as gymnast',
            data: { firstName, lastName, age, roles }
          });
          continue;
        }

        // Enhanced matching logic for existing records with case-insensitive search
        const existingUser = email ? await prisma.user.findFirst({
          where: { 
            email: {
              equals: email,
              mode: 'insensitive'
            },
            clubId: req.user.clubId
          }
        }) : null;

        // Look for existing gymnast by name and club (case-insensitive)
        const existingGymnast = await prisma.gymnast.findFirst({
          where: {
            firstName: {
              equals: firstName,
              mode: 'insensitive'
            },
            lastName: {
              equals: lastName,
              mode: 'insensitive'
            },
            clubId: req.user.clubId
          },
          include: {
            user: true
          }
        });

        // For upsert operations, we need to handle various combinations
        const shouldUpdate = options.updateExisting;
        const hasCustomFields = Object.keys(customFieldValues).length > 0;
        
        // Skip only if we're not updating and record exists
        if (!shouldUpdate && (existingUser || existingGymnast)) {
          skipped.push({
            line: lineNumber,
            reason: existingUser ? 'Email already exists' : 'Gymnast already exists',
            data: { firstName, lastName, email }
          });
          continue;
        }

        let createdGymnast = null;
        let createdUser = null;

        if (isGymnast) {
          // Import as gymnast - handle upsert logic
          let gymnastData = {
            firstName,
            lastName,
            clubId: req.user.clubId
          };
          
          // Only add dateOfBirth if it's available
          if (dateOfBirth) {
            gymnastData.dateOfBirth = dateOfBirth;
          }

          if (existingGymnast) {
            // Update existing gymnast
            createdGymnast = await prisma.gymnast.update({
              where: { id: existingGymnast.id },
              data: gymnastData
            });
          } else {
            // Create new gymnast
            createdGymnast = await prisma.gymnast.create({
              data: gymnastData
            });
          }

          // Handle user account for custom fields or email
          if (hasCustomFields || email) {
            let userData = {
              firstName,
              lastName,
              role: 'GYMNAST',
              clubId: req.user.clubId,
              password: null
            };

            // Only set email if provided
            if (email) {
              userData.email = email;
            }

            // Determine which user to use/create
            if (existingUser) {
              // Use the existing user found by email
              createdUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: userData
              });
            } else if (existingGymnast && existingGymnast.user) {
              // Use the existing user linked to the gymnast
              createdUser = await prisma.user.update({
                where: { id: existingGymnast.user.id },
                data: userData
              });
            } else {
              // Create new user (email is optional for gymnasts with custom fields)
              createdUser = await prisma.user.create({
                data: userData
              });
            }

            // Ensure gymnast is linked to user account
            if (createdGymnast.userId !== createdUser.id) {
              await prisma.gymnast.update({
                where: { id: createdGymnast.id },
                data: { userId: createdUser.id }
              });
            }

            // Save custom field values for gymnast user
            await saveCustomFieldValues(createdUser.id, customFieldValues);
          }
        } else {
          // Import as parent/guardian (non-gymnast)
          if (!email) {
            errors.push({
              line: lineNumber,
              error: 'Email required for parent/guardian accounts',
              data: { firstName, lastName }
            });
            continue;
          }

          let userData = {
            email,
            firstName,
            lastName,
            role: 'PARENT',
            clubId: req.user.clubId,
            password: null // Will be set when they first log in
          };

          if (existingUser) {
            // Update existing user with all provided data
            createdUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: userData
            });
          } else {
            // Create new user
            createdUser = await prisma.user.create({
              data: userData
            });
          }

          // Save custom field values for parent/guardian user
          await saveCustomFieldValues(createdUser.id, customFieldValues);
        }

        imported.push({
          line: lineNumber,
          gymnastId: createdGymnast?.id,
          userId: createdUser?.id,
          action: existingGymnast || existingUser ? 'UPDATED' : 'CREATED',
          customFieldsCount: Object.keys(customFieldValues).length,
          existingMatches: {
            existingUser: !!existingUser,
            existingGymnast: !!existingGymnast,
            existingUserId: existingUser?.id,
            existingGymnastId: existingGymnast?.id
          },
          data: { firstName, lastName, email, dateOfBirth, age, roles }
        });

      } catch (error) {
        console.error('Error processing row:', error);
        errors.push({
          line: lineNumber,
          error: error.message,
          data: row
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      summary: {
        totalProcessed: lineNumber,
        imported: imported.length,
        created: imported.filter(r => r.action === 'CREATED').length,
        updated: imported.filter(r => r.action === 'UPDATED').length,
        customFieldsProcessed: imported.filter(r => r.customFieldsCount > 0).length,
        skipped: skipped.length,
        errors: errors.length
      },
      imported,
      skipped,
      errors
    });

  } catch (error) {
    console.error('CSV import error:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to import CSV file' });
  }
});

// Utility route to find and clean up duplicate users/gymnasts
router.get('/duplicates', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  try {
    // Find duplicate users (same email)
    const duplicateUsers = await prisma.user.groupBy({
      by: ['email'],
      where: {
        clubId: req.user.clubId,
        email: { not: null }
      },
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      }
    });

    // Find duplicate gymnasts (same name)
    const duplicateGymnasts = await prisma.gymnast.groupBy({
      by: ['firstName', 'lastName'],
      where: {
        clubId: req.user.clubId
      },
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      }
    });

    // Get detailed information for duplicates
    const duplicateUserDetails = [];
    for (const dup of duplicateUsers) {
      const users = await prisma.user.findMany({
        where: {
          email: dup.email,
          clubId: req.user.clubId
        },
        include: {
          gymnasts: true,
          guardedGymnasts: true,
          customFieldValues: true
        }
      });
      duplicateUserDetails.push({
        email: dup.email,
        count: dup._count.id,
        users
      });
    }

    const duplicateGymnastDetails = [];
    for (const dup of duplicateGymnasts) {
      const gymnasts = await prisma.gymnast.findMany({
        where: {
          firstName: dup.firstName,
          lastName: dup.lastName,
          clubId: req.user.clubId
        },
        include: {
          user: {
            include: {
              customFieldValues: true
            }
          },
          guardians: true
        }
      });
      duplicateGymnastDetails.push({
        name: `${dup.firstName} ${dup.lastName}`,
        count: dup._count.id,
        gymnasts
      });
    }

    res.json({
      duplicateUsers: duplicateUserDetails,
      duplicateGymnasts: duplicateGymnastDetails,
      summary: {
        duplicateUserCount: duplicateUsers.length,
        duplicateGymnastCount: duplicateGymnasts.length
      }
    });

  } catch (error) {
    console.error('Find duplicates error:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

module.exports = router; 