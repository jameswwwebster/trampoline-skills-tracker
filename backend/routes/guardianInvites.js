const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

// Utility function to check if user is under 18
// Guardian invites are disabled since dateOfBirth field was removed
const isUnder18 = (dateOfBirth) => {
  return false; // Always return false since we don't track age anymore
};

// Get current user's age status and guardian invitation options
router.get('/status', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        guardians: true,
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
      return res.status(404).json({ error: 'User not found' });
    }

    const under18 = isUnder18(null);
    const hasGuardians = user.guardians && user.guardians.length > 0;

    res.json({
      isUnder18: under18,
      hasGuardians,
      guardians: user.guardians || [],
      canInviteGuardian: under18 && !hasGuardians,
      club: user.club
    });
  } catch (error) {
    console.error('Guardian status error:', error);
    res.status(500).json({ error: 'Failed to get guardian status' });
  }
});

// Send guardian invitation
router.post('/invite', auth, async (req, res) => {
  try {
    const { guardianEmail, guardianFirstName, guardianLastName, relationship } = req.body;

    if (!guardianEmail || !guardianFirstName || !guardianLastName || !relationship) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get current user with club info
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is under 18
    if (!isUnder18(null)) {
      return res.status(400).json({ error: 'Guardian invitations are only available for users under 18' });
    }

    // Check if user already has guardians
    const existingGuardians = await prisma.user.findMany({
      where: {
        guardedGymnasts: {
          some: { id: user.id }
        }
      }
    });

    if (existingGuardians.length > 0) {
      return res.status(400).json({ error: 'You already have guardians assigned' });
    }

    // Check if guardian email already exists in the system
    const existingGuardian = await prisma.user.findUnique({
      where: { email: guardianEmail }
    });

    if (existingGuardian) {
      // If guardian exists, create the relationship directly
      await prisma.user.update({
        where: { id: existingGuardian.id },
        data: {
          guardedGymnasts: {
            connect: { id: user.id }
          }
        }
      });

      // Send email notification if club has email enabled
      let emailResult = { success: true, skipped: true };
      if (user.club.emailEnabled) {
        emailResult = await emailService.sendGuardianConnectionNotification(
          guardianEmail,
          `${guardianFirstName} ${guardianLastName}`,
          `${user.firstName} ${user.lastName}`,
          user.club.name,
          relationship
        );
      } else {
        console.log('📧 Guardian connection notification skipped - club has email disabled');
      }

      return res.json({
        message: 'Guardian connected successfully',
        guardian: {
          id: existingGuardian.id,
          firstName: existingGuardian.firstName,
          lastName: existingGuardian.lastName,
          email: existingGuardian.email
        },
        emailSent: !emailResult.skipped
      });
    }

    // Create guardian request
    const guardianRequest = await prisma.guardianRequest.create({
      data: {
        clubId: user.clubId,
        requestedBy: user.id,
        requestedGymnastFirstName: user.firstName,
        requestedGymnastLastName: user.lastName,
        requestedGymnastDOB: null,
        requesterFirstName: user.firstName,
        requesterLastName: user.lastName,
        requesterEmail: user.email,
        relationshipToGymnast: relationship,
        notes: `Guardian invitation from ${user.firstName} ${user.lastName}`
      }
    });

    // Send invitation email if club has email enabled
    let emailResult = { success: true, skipped: true };
    if (user.club.emailEnabled) {
      emailResult = await emailService.sendGuardianInvitationEmail(
        guardianEmail,
        guardianFirstName,
        guardianLastName,
        `${user.firstName} ${user.lastName}`,
        user.club.name,
        relationship,
        guardianRequest.id
      );
    } else {
      console.log('📧 Guardian invitation email skipped - club has email disabled');
    }

    res.status(201).json({
      message: 'Guardian invitation sent successfully',
      request: guardianRequest,
      emailSent: !emailResult.skipped
    });
  } catch (error) {
    console.error('Guardian invite error:', error);
    res.status(500).json({ error: 'Failed to send guardian invitation' });
  }
});

// Get pending guardian requests for a user
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await prisma.guardianRequest.findMany({
      where: {
        requestedBy: req.user.id,
        status: 'PENDING'
      },
      include: {
        club: {
          select: {
            name: true
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
    res.status(500).json({ error: 'Failed to get guardian requests' });
  }
});

module.exports = router;
