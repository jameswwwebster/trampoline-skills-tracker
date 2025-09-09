const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash the development password (used for all test accounts)
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create system admin user first
  console.log('👑 Creating system administrator...');
  
  const systemAdmin = await prisma.user.upsert({
    where: { email: 'system@admin.com' },
    update: {},
    create: {
      email: 'system@admin.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'SUPER_ADMIN'
      // No clubId - system admin is not tied to any specific club
    }
  });

  console.log('✅ System administrator created:');
  console.log(`   Email: system@admin.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: SUPER_ADMIN`);
  console.log(`   🔧 Can manage all clubs and users`);

  // Create the development club and user
  console.log('👥 Creating development club and user...');

  const existingClub = await prisma.club.findFirst({
    where: { name: 'Development Club' }
  });

  let devClub;
  if (!existingClub) {
    devClub = await prisma.club.create({
      data: {
        name: 'Development Club'
      }
    });
    console.log(`✅ Development club created: ${devClub.name}`);
  } else {
    devClub = existingClub;
    console.log(`✅ Development club already exists: ${devClub.name}`);
  }

  // Hash the development password
  const devUser = await prisma.user.upsert({
    where: { email: 'dev@test.com' },
    update: {},
    create: {
      email: 'dev@test.com',
      password: hashedPassword,
      firstName: 'Dev',
      lastName: 'Coach',
      role: 'COACH',
      clubId: devClub.id
    }
  });

  console.log('✅ Development user created:');
  console.log(`   Email: dev@test.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: COACH`);
  console.log(`   Club: ${devClub.name}`);

  // Create a club admin user for testing
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Admin',
      role: 'CLUB_ADMIN',
      clubId: devClub.id
    }
  });

  console.log('✅ Development admin user created:');
  console.log(`   Email: admin@test.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: CLUB_ADMIN`);
  console.log(`   Club: ${devClub.name}`);

  // Create additional test users for testing different permissions
  const gymnasticUser = await prisma.user.upsert({
    where: { email: 'gymnast@test.com' },
    update: {},
    create: {
      email: 'gymnast@test.com',
      password: hashedPassword,
      firstName: 'Emma',
      lastName: 'Smith',
      role: 'GYMNAST',
      clubId: devClub.id
    }
  });

  console.log('✅ Test gymnast user created:');
  console.log(`   Email: gymnast@test.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: GYMNAST`);
  console.log(`   Club: ${devClub.name}`);

  const guardianUser = await prisma.user.upsert({
    where: { email: 'parent@test.com' },
    update: {
      shareCode: '123456' // Test share code for development
    },
    create: {
      email: 'parent@test.com',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'PARENT',
      clubId: devClub.id,
      shareCode: '123456' // Test share code for development
    }
  });

  console.log('✅ Test parent user created:');
  console.log(`   Email: parent@test.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: PARENT`);
  console.log(`   Share Code: 123456`);
  console.log(`   Club: ${devClub.name}`);

  const coachUser = await prisma.user.upsert({
    where: { email: 'coach2@test.com' },
    update: {},
    create: {
      email: 'coach2@test.com',
      password: hashedPassword,
      firstName: 'Mike',
      lastName: 'Wilson',
      role: 'COACH',
      clubId: devClub.id
    }
  });

  console.log('✅ Additional test coach created:');
  console.log(`   Email: coach2@test.com`);
  console.log(`   Password: password123`);
  console.log(`   Role: COACH`);
  console.log(`   Club: ${devClub.name}`);

  // Create a sample gymnast for testing
  const existingGymnast = await prisma.gymnast.findFirst({
    where: { 
      firstName: 'Test',
      lastName: 'Gymnast',
      clubId: devClub.id
    }
  });

  let sampleGymnast;
  if (!existingGymnast) {
    sampleGymnast = await prisma.gymnast.create({
      data: {
        firstName: 'Test',
        lastName: 'Gymnast',
        dateOfBirth: new Date('2010-01-01'),
        clubId: devClub.id
      }
    });
    console.log('✅ Sample gymnast created: Test Gymnast');
  } else {
    sampleGymnast = existingGymnast;
    console.log('✅ Sample gymnast already exists: Test Gymnast');
  }

  // Create additional test gymnasts for testing different scenarios
  const existingEmma = await prisma.gymnast.findFirst({
    where: {
      firstName: 'Emma',
      lastName: 'Smith',
      clubId: devClub.id
    }
  });

  let emmaGymnast;
  if (!existingEmma) {
    emmaGymnast = await prisma.gymnast.create({
      data: {
        firstName: 'Emma',
        lastName: 'Smith',
        dateOfBirth: new Date('2012-03-15'),
        clubId: devClub.id,
        userId: gymnasticUser.id, // Link to the gymnast user account
        guardians: {
          connect: { id: guardianUser.id } // Connect to parent user
        }
      }
    });
  } else {
    emmaGymnast = existingEmma;
  }

  const existingLiam = await prisma.gymnast.findFirst({
    where: {
      firstName: 'Liam',
      lastName: 'Johnson',
      clubId: devClub.id
    }
  });

  let liamGymnast;
  if (!existingLiam) {
    liamGymnast = await prisma.gymnast.create({
      data: {
        firstName: 'Liam',
        lastName: 'Johnson', 
        dateOfBirth: new Date('2011-07-22'),
        clubId: devClub.id,
        guardians: {
          connect: { id: guardianUser.id } // Connect to parent user
        }
      }
    });
  } else {
    liamGymnast = existingLiam;
  }

  const existingSophia = await prisma.gymnast.findFirst({
    where: {
      firstName: 'Sophia',
      lastName: 'Davis',
      clubId: devClub.id
    }
  });

  let sophiaGymnast;
  if (!existingSophia) {
    sophiaGymnast = await prisma.gymnast.create({
      data: {
        firstName: 'Sophia',
        lastName: 'Davis',
        dateOfBirth: new Date('2009-11-08'),
        clubId: devClub.id
      }
    });
  } else {
    sophiaGymnast = existingSophia;
  }

  console.log('✅ Additional test gymnasts created:');
  console.log(`   - Emma Smith (linked to gymnast@test.com)`);
  console.log(`   - Liam Johnson (child of parent@test.com)`);
  console.log(`   - Sophia Davis (independent gymnast)`);

  // Read the skills data with better path resolution
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

  console.log('🏆 Creating competitions...');

  // Helper function to map categories from JSON to string format
  const mapCategoryToString = (category) => {
    if (!category) return 'CLUB'; // Default fallback
    
    // Convert to uppercase for consistency with existing data
    return category.toUpperCase();
  };

  // Helper function to determine order from competition name
  const getCompetitionOrder = (id, name) => {
    // Extract numbers from the name/id for ordering
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

  // Create competitions from the JSON file
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

  console.log('📚 Creating levels and skills...');

  // First pass: Create all levels and their skills
  const levelMap = new Map(); // To track levels by number
  const allSkills = new Map(); // To track all skills by name across all levels

  // Create sequential levels (1-10)
  for (const levelData of skillsData.levels) {
    console.log(`  Creating Level ${levelData.number}: ${levelData.name}`);
    
    const level = await prisma.level.upsert({
      where: { identifier: levelData.number.toString() },
      update: {
        name: levelData.name,
        description: levelData.description,
        type: 'SEQUENTIAL' // Update type for sequential levels
      },
      create: {
        number: levelData.number,
        identifier: levelData.number.toString(),
        name: levelData.name,
        description: levelData.description,
        type: 'SEQUENTIAL' // Infer type for sequential levels
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

    // Create skills for this level ONLY
    for (let i = 0; i < levelData.skills.length; i++) {
      const skillData = levelData.skills[i];
      const skill = await prisma.skill.create({
        data: {
          name: skillData.name,
          description: skillData.description || null,
          levelId: level.id,
          order: i + 1 // Use array index + 1 as order
        }
      });
      allSkills.set(skillData.name, skill);
    }
  }

  console.log('🛤️  Creating side paths...');

  // Create side paths
  for (const sidePathData of skillsData.sidePaths) {
    console.log(`  Creating Side Path ${sidePathData.number}: ${sidePathData.name}`);
    
    const baseNumber = parseInt(sidePathData.number.replace(/[a-z]/i, ''));
    
    const level = await prisma.level.create({
      data: {
        number: baseNumber,
        identifier: sidePathData.number, // Full identifier like "3a", "8b"
        name: sidePathData.name,
        description: sidePathData.description || null,
        type: 'SIDE_PATH' // Infer type for side paths
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

    // Create skills for this side path
    for (let i = 0; i < sidePathData.skills.length; i++) {
      const skillData = sidePathData.skills[i];
      const skill = await prisma.skill.create({
        data: {
          name: skillData.name,
          description: skillData.description || null,
          levelId: level.id,
          order: i + 1 // Use array index + 1 as order
        }
      });
      allSkills.set(skillData.name, skill);
    }
  }

  console.log('🎯 Creating routines...');

  // Second pass: Create routines for sequential levels
  for (const levelData of skillsData.levels) {
    const level = levelMap.get(levelData.number);
    
    // Create routines for this level
    for (let routineIndex = 0; routineIndex < levelData.routines.length; routineIndex++) {
      const routineData = levelData.routines[routineIndex];
      const routine = await prisma.routine.create({
        data: {
          name: routineIndex === 0 ? `Level ${levelData.number} Routine` : `Alternative Level ${levelData.number} Routine`,
          levelId: level.id,
          order: routineIndex + 1,
          isAlternative: routineIndex > 0 // First routine is main, others are alternatives
        }
      });

      // Create routine skills if they exist
      if (routineData.skills && routineData.skills.length > 0) {
        for (let skillIndex = 0; skillIndex < routineData.skills.length; skillIndex++) {
          const routineSkillData = routineData.skills[skillIndex];
          
          // Find the skill across ALL levels (not just the current level)
          const skill = allSkills.get(routineSkillData.name);
          if (!skill) {
            console.log(`ℹ️  Skill "${routineSkillData.name}" is considered automatic/implicit - not tracked separately`);
            continue; // Skip automatic/implicit skills
          }

          // Create routine-skill junction (check for duplicates)
          const existingConnection = await prisma.routineSkill.findFirst({
            where: {
              routineId: routine.id,
              skillId: skill.id
            }
          });
          
          if (!existingConnection) {
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

  console.log('🔗 Setting up level prerequisites...');
  
  // Third pass: Set up level prerequisites now that all levels exist
  for (const levelData of skillsData.levels) {
    if (levelData.number > 1) {
      const currentLevel = levelMap.get(levelData.number);
      const previousLevel = levelMap.get(levelData.number - 1);
      
      if (currentLevel && previousLevel) {
        await prisma.level.update({
          where: { id: currentLevel.id },
          data: {
            prerequisite: {
              connect: { id: previousLevel.id }
            }
          }
        });
      }
    }
  }

  console.log('📊 Database seeding completed successfully!');
  
  // Print summary
  const levelCount = await prisma.level.count();
  const skillCount = await prisma.skill.count();
  const routineCount = await prisma.routine.count();
  const routineSkillCount = await prisma.routineSkill.count();
  const competitionCount = await prisma.competition.count();
  const levelCompetitionCount = await prisma.levelCompetition.count();
  
  console.log(`\n📈 Summary:`);
  console.log(`  • ${levelCount} levels created`);
  console.log(`  • ${skillCount} skills created`);
  console.log(`  • ${routineCount} routines created`);
  console.log(`  • ${routineSkillCount} routine-skill connections created`);
  console.log(`  • ${competitionCount} competitions created`);
  console.log(`  • ${levelCompetitionCount} level-competition associations created`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 