const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard metrics for coaches and admins
router.get('/metrics', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const clubId = req.user.clubId;

    // Get all gymnasts in the club
    const gymnasts = await prisma.gymnast.findMany({
      where: { clubId },
      include: {
        levelProgress: {
          include: {
            level: true
          }
        },
        skillProgress: {
          where: {
            status: 'COMPLETED'
          },
          include: {
            skill: {
              include: {
                level: true
              }
            }
          }
        }
      }
    });

    // Get all levels for reference
    const levels = await prisma.level.findMany({
      orderBy: { number: 'asc' },
      include: {
        skills: true,
        competitions: {
          include: {
            competition: true
          }
        }
      }
    });

    // Calculate level distribution
    const levelDistribution = {};
    levels.forEach(level => {
      levelDistribution[level.identifier] = {
        levelName: level.name,
        count: 0,
        gymnasts: []
      };
    });

    // Helper function to check if a level is a side-track
    const isSideTrack = (identifier) => {
      return /^\d+[a-z]$/.test(identifier);
    };

    // Helper function to determine the gymnast's current working level
    const getCurrentLevel = (gymnast, levels) => {
      if (!gymnast || !levels.length) return null;

      // Get all completed main track levels (ignore side tracks)
      const completedMainTrackLevels = gymnast.levelProgress
        .filter(lp => lp.status === 'COMPLETED')
        .map(lp => lp.level)
        .filter(level => !isSideTrack(level.identifier)) // Only main track levels
        .map(level => parseInt(level.identifier))
        .sort((a, b) => a - b);

      // Find the next main track level to work on
      let nextLevelNumber = 1;
      if (completedMainTrackLevels.length > 0) {
        const highestCompleted = Math.max(...completedMainTrackLevels);
        nextLevelNumber = highestCompleted + 1;
      }

      // Find the actual level object
      return levels.find(level => 
        !isSideTrack(level.identifier) && parseInt(level.identifier) === nextLevelNumber
      ) || null;
    };

    // Calculate gymnastics metrics
    gymnasts.forEach(gymnast => {
      // Find current working level (next level to work on)
      const currentLevel = getCurrentLevel(gymnast, levels);

      if (currentLevel) {
        const identifier = currentLevel.identifier;
        if (levelDistribution[identifier]) {
          levelDistribution[identifier].count++;
          levelDistribution[identifier].gymnasts.push({
            id: gymnast.id,
            firstName: gymnast.firstName,
            lastName: gymnast.lastName
          });
        }
      }
    });

    // Calculate competition readiness (count gymnasts working on levels associated with competitions)
    const competitionReadiness = {};
    
    // First, collect all competitions
    const allCompetitions = {};
    levels.forEach(level => {
      level.competitions.forEach(({ competition }) => {
        if (!allCompetitions[competition.name]) {
          allCompetitions[competition.name] = {
            category: competition.category,
            levelNumber: level.number,
            levelId: level.id,
            levelName: level.name
          };
        }
      });
    });

    // Initialize competition readiness structure
    Object.keys(allCompetitions).forEach(competitionName => {
      competitionReadiness[competitionName] = {
        category: allCompetitions[competitionName].category,
        ready: 0,
        readyGymnasts: []
      };
    });

    // For each gymnast, check if they've completed a level associated with competitions
    gymnasts.forEach(gymnast => {
      // Get all completed levels for this gymnast
      const completedLevels = gymnast.levelProgress
        .filter(lp => lp.status === 'COMPLETED')
        .map(lp => lp.level);
      
      // Check each completed level for competition associations
      completedLevels.forEach(completedLevel => {
        if (completedLevel.competitions && completedLevel.competitions.length > 0) {
          completedLevel.competitions.forEach(({ competition }) => {
            if (competitionReadiness[competition.name]) {
              competitionReadiness[competition.name].ready++;
              competitionReadiness[competition.name].readyGymnasts.push({
                id: gymnast.id,
                firstName: gymnast.firstName,
                lastName: gymnast.lastName,
                level: completedLevel.name
              });
            }
          });
        }
      });
    });

    // Calculate recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSkillProgress = await prisma.skillProgress.findMany({
      where: {
        gymnast: { clubId },
        updatedAt: { gte: thirtyDaysAgo }
      },
      include: {
        gymnast: true,
        skill: {
          include: {
            level: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    const recentLevelProgress = await prisma.levelProgress.findMany({
      where: {
        gymnast: { clubId },
        updatedAt: { gte: thirtyDaysAgo }
      },
      include: {
        gymnast: true,
        level: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    // Calculate skill completion rates
    const skillStats = {};
    gymnasts.forEach(gymnast => {
      gymnast.skillProgress.forEach(sp => {
        const levelId = sp.skill.level.identifier;
        if (!skillStats[levelId]) {
          skillStats[levelId] = {
            levelName: sp.skill.level.name,
            totalSkills: 0,
            completedSkills: 0,
            completion: 0
          };
        }
        skillStats[levelId].totalSkills++;
        if (sp.status === 'COMPLETED') {
          skillStats[levelId].completedSkills++;
        }
      });
    });

    // Calculate completion percentages
    Object.keys(skillStats).forEach(levelId => {
      const stats = skillStats[levelId];
      stats.completion = stats.totalSkills > 0 
        ? Math.round((stats.completedSkills / stats.totalSkills) * 100)
        : 0;
    });

    // Summary statistics
    const totalGymnasts = gymnasts.length;
    const activeGymnasts = gymnasts.filter(g => 
      g.skillProgress.some(sp => {
        const lastUpdate = new Date(sp.updatedAt);
        return lastUpdate >= thirtyDaysAgo;
      })
    ).length;

    const totalSkillsCompleted = gymnasts.reduce((sum, gymnast) => 
      sum + gymnast.skillProgress.filter(sp => sp.status === 'COMPLETED').length, 0
    );

    res.json({
      summary: {
        totalGymnasts,
        activeGymnasts,
        totalSkillsCompleted,
        clubName: req.user.club?.name
      },
      levelDistribution,
      competitionReadiness,
      recentActivity: {
        skills: recentSkillProgress,
        levels: recentLevelProgress
      },
      skillStats
    });

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get certificates that haven't been printed yet
router.get('/unprinted-certificates', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const clubId = req.user.clubId;

    // Get all certificates with status 'AWARDED' (not yet printed)
    const unprintedCertificates = await prisma.certificate.findMany({
      where: {
        status: 'AWARDED',
        gymnast: {
          clubId,
          isArchived: false // Only show certificates for active gymnasts
        }
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
      },
      orderBy: [
        { awardedAt: 'desc' }
      ]
    });

    res.json(unprintedCertificates);
  } catch (error) {
    console.error('Get unprinted certificates error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get gymnasts who haven't received certificates yet (legacy endpoint - kept for compatibility)
router.get('/uncertified-gymnasts', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const clubId = req.user.clubId;

    // Get all gymnasts in the club with their completed levels and existing certificates
    const gymnasts = await prisma.gymnast.findMany({
      where: { 
        clubId,
        isArchived: false // Only show active gymnasts
      },
      include: {
        levelProgress: {
          where: {
            status: 'COMPLETED'
          },
          include: {
            level: true
          }
        },
        certificates: {
          select: {
            id: true,
            levelId: true,
            type: true
          }
        }
      }
    });

    // Filter gymnasts to find those with completed levels but no certificates for those levels
    const uncertifiedGymnasts = gymnasts.filter(gymnast => {
      // Get completed level IDs
      const completedLevelIds = gymnast.levelProgress.map(lp => lp.levelId);
      
      // Get level IDs that already have certificates
      const certifiedLevelIds = gymnast.certificates.map(cert => cert.levelId);
      
      // Find levels that are completed but don't have certificates
      const uncertifiedLevelIds = completedLevelIds.filter(levelId => 
        !certifiedLevelIds.includes(levelId)
      );
      
      return uncertifiedLevelIds.length > 0;
    }).map(gymnast => {
      // Get the uncertified levels for this gymnast
      const completedLevelIds = gymnast.levelProgress.map(lp => lp.levelId);
      const certifiedLevelIds = gymnast.certificates.map(cert => cert.levelId);
      const uncertifiedLevelIds = completedLevelIds.filter(levelId => 
        !certifiedLevelIds.includes(levelId)
      );
      
      const uncertifiedLevels = gymnast.levelProgress
        .filter(lp => uncertifiedLevelIds.includes(lp.levelId))
        .map(lp => lp.level)
        .sort((a, b) => a.number - b.number);

      return {
        id: gymnast.id,
        firstName: gymnast.firstName,
        lastName: gymnast.lastName,
        uncertifiedLevels,
        totalUncertifiedLevels: uncertifiedLevels.length
      };
    });

    // Sort by number of uncertified levels (descending) then by name
    uncertifiedGymnasts.sort((a, b) => {
      if (a.totalUncertifiedLevels !== b.totalUncertifiedLevels) {
        return b.totalUncertifiedLevels - a.totalUncertifiedLevels;
      }
      return a.firstName.localeCompare(b.firstName);
    });

    res.json(uncertifiedGymnasts);
  } catch (error) {
    console.error('Get uncertified gymnasts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 