const express = require('express');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const submitRequestSchema = Joi.object({
  clubCode: Joi.string().required(),
  requestedGymnastFirstName: Joi.string().min(2).max(50).required(),
  requestedGymnastLastName: Joi.string().min(2).max(50).required(),
  requestedGymnastDOB: Joi.date().optional(),
  requesterFirstName: Joi.string().min(2).max(50).required(),
  requesterLastName: Joi.string().min(2).max(50).required(),
  requesterEmail: Joi.string().email().required(),
  requesterPhone: Joi.string().optional(),
  relationshipToGymnast: Joi.string().min(2).max(50).required()
});

const processRequestSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  selectedGymnastId: Joi.string().when('action', { is: 'approve', then: Joi.required(), otherwise: Joi.optional() }),
  notes: Joi.string().max(500).optional(),
  createNewParent: Joi.boolean().default(false)
});

// Submit a guardian request (public endpoint for parents)
router.post('/submit', async (req, res) => {
  try {
    const { error, value } = submitRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      clubCode,
      requestedGymnastFirstName,
      requestedGymnastLastName,
      requestedGymnastDOB,
      requesterFirstName,
      requesterLastName,
      requesterEmail,
      requesterPhone,
      relationshipToGymnast
    } = value;

    // Find the club by code
    const club = await prisma.club.findFirst({
      where: {
        OR: [
          { name: { contains: clubCode, mode: 'insensitive' } },
          { email: clubCode },
          // You might want to add a specific club code field later
        ]
      }
    });

    if (!club) {
      return res.status(404).json({ error: 'Club not found. Please check the club code.' });
    }

    // Check if a request already exists for this email and gymnast
    const existingRequest = await prisma.guardianRequest.findFirst({
      where: {
        requesterEmail,
        clubId: club.id,
        requestedGymnastFirstName: { equals: requestedGymnastFirstName, mode: 'insensitive' },
        requestedGymnastLastName: { equals: requestedGymnastLastName, mode: 'insensitive' },
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        error: 'A request for this gymnast is already pending review.' 
      });
    }

    // Check if user already exists and is connected to the gymnast
    const existingUser = await prisma.user.findUnique({
      where: { email: requesterEmail },
      include: {
        guardedGymnasts: {
          where: {
            firstName: { equals: requestedGymnastFirstName, mode: 'insensitive' },
            lastName: { equals: requestedGymnastLastName, mode: 'insensitive' },
            clubId: club.id
          }
        }
      }
    });

    if (existingUser && existingUser.guardedGymnasts.length > 0) {
      return res.status(400).json({ 
        error: 'You are already connected to this gymnast.' 
      });
    }

    // Create a system user for tracking (if not exists)
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@guardianrequests.local' }
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: 'system@guardianrequests.local',
          firstName: 'System',
          lastName: 'GuardianRequests',
          role: 'CLUB_ADMIN',
          password: await bcrypt.hash('system-generated', 10)
        }
      });
    }

    // Create the guardian request
    const request = await prisma.guardianRequest.create({
      data: {
        clubId: club.id,
        requestedBy: systemUser.id,
        requestedGymnastFirstName,
        requestedGymnastLastName,
        requestedGymnastDOB: requestedGymnastDOB ? new Date(requestedGymnastDOB) : null,
        requesterFirstName,
        requesterLastName,
        requesterEmail,
        requesterPhone,
        relationshipToGymnast
      },
      include: {
        club: {
          select: { name: true }
        }
      }
    });

    res.status(201).json({
      message: 'Guardian request submitted successfully. A coach will review your request shortly.',
      requestId: request.id,
      clubName: request.club.name
    });

  } catch (error) {
    console.error('Submit guardian request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all pending guardian requests for a club (coaches only)
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { status } = req.query;
    
    const whereClause = {
      clubId: req.user.clubId
    };

    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.guardianRequest.findMany({
      where: whereClause,
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        gymnast: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true
          }
        },
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(requests);
  } catch (error) {
    console.error('Get guardian requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get potential gymnast matches for a request (coaches only)
router.get('/:requestId/matches', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await prisma.guardianRequest.findFirst({
      where: {
        id: requestId,
        clubId: req.user.clubId
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Guardian request not found' });
    }

    // Search for potential matches
    const searchCriteria = [];

    // Exact name match
    searchCriteria.push({
      firstName: { equals: request.requestedGymnastFirstName, mode: 'insensitive' },
      lastName: { equals: request.requestedGymnastLastName, mode: 'insensitive' },
      clubId: req.user.clubId,
      isArchived: false
    });

    // Close name matches (fuzzy search)
    searchCriteria.push({
      AND: [
        {
          OR: [
            { firstName: { contains: request.requestedGymnastFirstName, mode: 'insensitive' } },
            { firstName: { startsWith: request.requestedGymnastFirstName.substring(0, 3), mode: 'insensitive' } }
          ]
        },
        {
          OR: [
            { lastName: { contains: request.requestedGymnastLastName, mode: 'insensitive' } },
            { lastName: { startsWith: request.requestedGymnastLastName.substring(0, 3), mode: 'insensitive' } }
          ]
        }
      ],
      clubId: req.user.clubId,
      isArchived: false
    });

    const allMatches = [];
    
    for (const criteria of searchCriteria) {
      const matches = await prisma.gymnast.findMany({
        where: criteria,
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
      });
      allMatches.push(...matches);
    }

    // Remove duplicates and score matches
    const uniqueMatches = Array.from(
      new Map(allMatches.map(match => [match.id, match])).values()
    );

    const scoredMatches = uniqueMatches.map(match => {
      let score = 0;
      let matchType = 'fuzzy';

      // Score based on name matching
      if (match.firstName.toLowerCase() === request.requestedGymnastFirstName.toLowerCase() &&
          match.lastName.toLowerCase() === request.requestedGymnastLastName.toLowerCase()) {
        score += 100;
        matchType = 'exact';
      } else {
        if (match.firstName.toLowerCase().includes(request.requestedGymnastFirstName.toLowerCase())) {
          score += 50;
        }
        if (match.lastName.toLowerCase().includes(request.requestedGymnastLastName.toLowerCase())) {
          score += 50;
        }
      }

      // Score based on date of birth matching
      if (request.requestedGymnastDOB && match.dateOfBirth) {
        const requestedDate = new Date(request.requestedGymnastDOB);
        const gymDate = new Date(match.dateOfBirth);
        if (requestedDate.getTime() === gymDate.getTime()) {
          score += 50;
          matchType = matchType === 'exact' ? 'exact' : 'date-confirmed';
        }
      }

      return {
        ...match,
        matchScore: score,
        matchType,
        hasExistingGuardians: match.guardians.length > 0
      };
    });

    // Sort by score (highest first)
    scoredMatches.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      request,
      potentialMatches: scoredMatches
    });

  } catch (error) {
    console.error('Get gymnast matches error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Process a guardian request (approve/reject) - coaches only
router.post('/:requestId/process', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { error, value } = processRequestSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { action, selectedGymnastId, notes, createNewParent } = value;

    const request = await prisma.guardianRequest.findFirst({
      where: {
        id: requestId,
        clubId: req.user.clubId,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Guardian request not found or already processed' });
    }

    if (action === 'reject') {
      // Simply reject the request
      const updatedRequest = await prisma.guardianRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          processedBy: req.user.id,
          notes: notes || 'Request rejected by coach'
        }
      });

      return res.json({
        message: 'Guardian request rejected',
        request: updatedRequest
      });
    }

    // Handle approval
    if (action === 'approve') {
      if (!selectedGymnastId) {
        return res.status(400).json({ error: 'selectedGymnastId is required for approval' });
      }

      // Verify the gymnast exists and belongs to the club
      const gymnast = await prisma.gymnast.findFirst({
        where: {
          id: selectedGymnastId,
          clubId: req.user.clubId
        }
      });

      if (!gymnast) {
        return res.status(404).json({ error: 'Selected gymnast not found' });
      }

      // Check if parent user already exists
      let parentUser = await prisma.user.findUnique({
        where: { email: request.requesterEmail }
      });

      if (!parentUser && createNewParent) {
        // Create new parent user
        const tempPassword = Math.random().toString(36).slice(-8);
        parentUser = await prisma.user.create({
          data: {
            email: request.requesterEmail,
            firstName: request.requesterFirstName,
            lastName: request.requesterLastName,
            role: 'PARENT',
            clubId: req.user.clubId,
            password: await bcrypt.hash(tempPassword, 10),
            mustChangePassword: true
          }
        });

        // TODO: Send email with login credentials
        console.log(`Created parent account for ${request.requesterEmail} with temporary password: ${tempPassword}`);
      }

      if (!parentUser) {
        return res.status(400).json({ 
          error: 'Parent user account not found. Please create an account first or check "Create new parent account".' 
        });
      }

      // Connect the parent to the gymnast
      await prisma.gymnast.update({
        where: { id: selectedGymnastId },
        data: {
          guardians: {
            connect: { id: parentUser.id }
          }
        }
      });

      // Update the request
      const updatedRequest = await prisma.guardianRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          processedBy: req.user.id,
          guardianId: parentUser.id,
          gymnastId: selectedGymnastId,
          notes: notes || 'Request approved and connection established'
        }
      });

      return res.json({
        message: 'Guardian request approved and connection established',
        request: updatedRequest,
        parentCreated: createNewParent && parentUser
      });
    }

  } catch (error) {
    console.error('Process guardian request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Disconnect a parent from a gymnast (coaches only)
router.delete('/connections/:gymnastId/guardians/:guardianId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { gymnastId, guardianId } = req.params;

    // Verify gymnast belongs to user's club
    const gymnast = await prisma.gymnast.findFirst({
      where: {
        id: gymnastId,
        clubId: req.user.clubId
      },
      include: {
        guardians: {
          where: { id: guardianId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found in your club' });
    }

    if (gymnast.guardians.length === 0) {
      return res.status(404).json({ error: 'Guardian connection not found' });
    }

    const guardian = gymnast.guardians[0];

    // Disconnect the parent from the gymnast
    await prisma.gymnast.update({
      where: { id: gymnastId },
      data: {
        guardians: {
          disconnect: { id: guardianId }
        }
      }
    });

    res.json({
      message: `Successfully disconnected ${guardian.firstName} ${guardian.lastName} from ${gymnast.firstName} ${gymnast.lastName}`,
      disconnectedGuardian: guardian
    });

  } catch (error) {
    console.error('Disconnect guardian error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get connections for a specific gymnast (coaches only)
router.get('/connections/:gymnastId', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const { gymnastId } = req.params;

    const gymnast = await prisma.gymnast.findFirst({
      where: {
        id: gymnastId,
        clubId: req.user.clubId
      },
      include: {
        guardians: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            createdAt: true
          }
        }
      }
    });

    if (!gymnast) {
      return res.status(404).json({ error: 'Gymnast not found in your club' });
    }

    res.json({
      gymnast: {
        id: gymnast.id,
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        dateOfBirth: gymnast.dateOfBirth
      },
      guardians: gymnast.guardians
    });

  } catch (error) {
    console.error('Get gymnast connections error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 