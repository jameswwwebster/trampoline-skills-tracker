const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to map categories from JSON to string format
const mapCategoryToString = (category) => {
  if (!category) return 'CLUB'; // Default fallback
  return category.toUpperCase();
};

// Helper function to determine order from competition name
const getCompetitionOrder = (id, name) => {
  const match = name.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  // Special cases for non-numbered competitions
  if (id.includes('silver') || name.toLowerCase().includes('silver')) {
    return 1;
  }
  if (id.includes('gold') || name.toLowerCase().includes('gold')) {
    return 2;
  }
  if (id.includes('fig') || name.toLowerCase().includes('fig')) {
    return 1;
  }
  
  return 1; // Default order
};

/**
 * Create default levels, skills, competitions, and routines for a new club
 * @param {string} clubId - The ID of the club to create data for
 */
async function createDefaultDataForClub(clubId) {
  try {
    console.log(`🌱 Creating default data for club ${clubId}...`);

    // Load skills data with better path resolution
    const possiblePaths = [
      path.join(__dirname, '../resources/skills.json'),          // Backend-local resources
      path.join(__dirname, '../../resources/skills.json'),       // Root resources
      path.join(process.cwd(), 'resources/skills.json'),         // Current working directory
      path.join(process.cwd(), '../resources/skills.json'),      // Parent directory
      path.join(__dirname, '../../../resources/skills.json')     // Far parent directory
    ];
    
    let skillsData = null;
    let skillsDataPath = null;
    
    for (const testPath of possiblePaths) {
      try {
        console.log(`🔍 Trying to read skills data from: ${testPath}`);
        if (fs.existsSync(testPath)) {
          skillsData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
          skillsDataPath = testPath;
          console.log(`✅ Successfully loaded skills data from: ${testPath}`);
          break;
        } else {
          console.log(`❌ File not found at: ${testPath}`);
        }
      } catch (error) {
        console.log(`❌ Error reading from ${testPath}:`, error.message);
      }
    }
    
    if (!skillsData) {
      console.log('⚠️  Could not find skills.json file, using fallback data');
      skillsData = { 
        competitions: [], 
        levels: [], 
        sidePaths: [] 
      };
    }

    // Create competitions (these are global, not club-specific)
    console.log('🏆 Creating competitions...');
    const competitionMap = new Map();
    
    if (skillsData.competitions && skillsData.competitions.length > 0) {
      for (const competitionData of skillsData.competitions) {
        const category = mapCategoryToString(competitionData.category);
        const order = competitionData.order || getCompetitionOrder(competitionData.id, competitionData.name);
        
        const competition = await prisma.competition.upsert({
          where: { code: competitionData.id },
          update: {
            name: competitionData.name,
            code: competitionData.id,
            category,
            order,
            isActive: true
          },
          create: {
            name: competitionData.name,
            code: competitionData.id,
            category,
            order,
            isActive: true
          }
        });
        
        competitionMap.set(competitionData.id, competition);
        console.log(`  ✅ Competition: ${competition.name} (${competition.category})`);
      }
    } else {
      // Fallback to hardcoded competitions if not found in JSON
      console.log('  ⚠️  No competitions found in JSON, using fallback list');
      const fallbackCompetitions = [
        { name: 'Club Level 1', code: 'club-level-1', category: 'CLUB', order: 1 },
        { name: 'Club Level 2', code: 'club-level-2', category: 'CLUB', order: 2 },
        { name: 'Club Level 3', code: 'club-level-3', category: 'CLUB', order: 3 },
        { name: 'Regional Level 1', code: 'regional-level-1', category: 'REGIONAL', order: 1 },
        { name: 'Regional Level 2', code: 'regional-level-2', category: 'REGIONAL', order: 2 },
        { name: 'Regional Level 3', code: 'regional-level-3', category: 'REGIONAL', order: 3 }
      ];
      
      for (const competitionData of fallbackCompetitions) {
        const competition = await prisma.competition.upsert({
          where: { code: competitionData.code },
          update: competitionData,
          create: competitionData
        });
        competitionMap.set(competitionData.code, competition);
        console.log(`  ✅ Competition: ${competition.name}`);
      }
    }

    // Create levels and skills for this specific club
    console.log('📚 Creating levels and skills...');
    const levelMap = new Map();
    const allSkills = new Map();

    // Create sequential levels (1-10)
    for (const levelData of skillsData.levels) {
      console.log(`  Creating Level ${levelData.number}: ${levelData.name}`);
      
      const level = await prisma.level.create({
        data: {
          number: levelData.number,
          identifier: levelData.number.toString(),
          name: levelData.name,
          description: levelData.description,
          type: 'SEQUENTIAL',
          clubId: clubId // Associate with the specific club
        }
      });

      levelMap.set(levelData.number, level);

      // Create level-competition relationships
      if (levelData.competitionLevel && levelData.competitionLevel.length > 0) {
        for (const competitionCode of levelData.competitionLevel) {
          const competition = competitionMap.get(competitionCode);
          if (competition) {
            await prisma.levelCompetition.create({
              data: {
                levelId: level.id,
                competitionId: competition.id
              }
            });
          }
        }
      }

      // Create skills for this level
      for (let i = 0; i < levelData.skills.length; i++) {
        const skillData = levelData.skills[i];
        const skill = await prisma.skill.create({
          data: {
            name: skillData.name,
            description: skillData.description || null,
            levelId: level.id,
            order: i + 1
          }
        });
        allSkills.set(skillData.name, skill);
      }

      // Create routines for this level
      if (levelData.routines && levelData.routines.length > 0) {
        for (let routineIndex = 0; routineIndex < levelData.routines.length; routineIndex++) {
          const routineData = levelData.routines[routineIndex];
          
          const routine = await prisma.routine.create({
            data: {
              name: `${levelData.name} Routine ${routineIndex + 1}`,
              levelId: level.id,
              order: routineIndex + 1
            }
          });

          // Create routine skills
          for (let skillIndex = 0; skillIndex < routineData.skills.length; skillIndex++) {
            const routineSkillData = routineData.skills[skillIndex];
            const skill = allSkills.get(routineSkillData.name);
            
            if (skill) {
              await prisma.routineSkill.create({
                data: {
                  routineId: routine.id,
                  skillId: skill.id,
                  order: skillIndex + 1
                }
              });
            }
          }
        }
      }
    }

    // Create side paths
    console.log('🛤️  Creating side paths...');
    for (const sidePathData of skillsData.sidePaths) {
      console.log(`  Creating Side Path ${sidePathData.number}: ${sidePathData.name}`);
      
      const baseNumber = parseInt(sidePathData.number.replace(/[a-z]/i, ''));
      
      const level = await prisma.level.create({
        data: {
          number: baseNumber,
          identifier: sidePathData.number,
          name: sidePathData.name,
          description: sidePathData.description || null,
          type: 'SIDE_PATH',
          clubId: clubId
        }
      });

      // Create level-competition relationships for side paths
      if (sidePathData.competitionLevel && sidePathData.competitionLevel.length > 0) {
        for (const competitionCode of sidePathData.competitionLevel) {
          const competition = competitionMap.get(competitionCode);
          if (competition) {
            await prisma.levelCompetition.create({
              data: {
                levelId: level.id,
                competitionId: competition.id
              }
            });
          }
        }
      }

      // Create skills for side path
      for (let i = 0; i < sidePathData.skills.length; i++) {
        const skillData = sidePathData.skills[i];
        const skill = await prisma.skill.create({
          data: {
            name: skillData.name,
            description: skillData.description || null,
            levelId: level.id,
            order: i + 1
          }
        });
        allSkills.set(skillData.name, skill);
      }

      // Create routines for side path
      if (sidePathData.routines && sidePathData.routines.length > 0) {
        for (let routineIndex = 0; routineIndex < sidePathData.routines.length; routineIndex++) {
          const routineData = sidePathData.routines[routineIndex];
          
          const routine = await prisma.routine.create({
            data: {
              name: `${sidePathData.name} Routine ${routineIndex + 1}`,
              levelId: level.id,
              order: routineIndex + 1
            }
          });

          // Create routine skills
          for (let skillIndex = 0; skillIndex < routineData.skills.length; skillIndex++) {
            const routineSkillData = routineData.skills[skillIndex];
            const skill = allSkills.get(routineSkillData.name);
            
            if (skill) {
              await prisma.routineSkill.create({
                data: {
                  routineId: routine.id,
                  skillId: skill.id,
                  order: skillIndex + 1
                }
              });
            }
          }
        }
      }
    }

    console.log(`✅ Default data created successfully for club ${clubId}`);
    console.log(`   - ${levelMap.size} levels created`);
    console.log(`   - ${allSkills.size} skills created`);
    console.log(`   - ${competitionMap.size} competitions available`);
    
  } catch (error) {
    console.error(`Error creating default data for club ${clubId}:`, error);
    throw error;
  }
}

module.exports = {
  createDefaultDataForClub
}; 