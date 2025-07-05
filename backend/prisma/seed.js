const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create development club and user
  console.log('👥 Creating development club and user...');
  
  const existingClub = await prisma.club.findFirst({
    where: { name: 'Development Club' }
  });

  let devClub;
  if (!existingClub) {
    devClub = await prisma.club.create({
      data: {
        name: 'Development Club',
        address: '123 Dev Street, Test City',
        phone: '555-0123',
        email: 'dev@trampolineclub.com'
      }
    });
    console.log('✅ Development club created: Development Club');
  } else {
    devClub = existingClub;
    console.log('✅ Development club already exists: Development Club');
  }

  const hashedPassword = await bcrypt.hash('password123', 10);
  
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

  // Read the skills data
  const skillsDataPath = path.join(__dirname, '../../resources/skills.json');
  const skillsData = JSON.parse(fs.readFileSync(skillsDataPath, 'utf8'));

  console.log('📚 Creating levels and skills...');

  // First pass: Create all levels and their skills
  const levelMap = new Map(); // To track levels by number
  const allSkills = new Map(); // To track all skills by name across all levels

  // Create sequential levels (1-10)
  for (const levelData of skillsData.levels) {
    console.log(`  Creating Level ${levelData.number}: ${levelData.name}`);
    
    const level = await prisma.level.create({
      data: {
        number: levelData.number,
        identifier: levelData.number.toString(),
        name: levelData.name,
        description: levelData.description,
        type: 'SEQUENTIAL', // Infer type for sequential levels
        prerequisiteId: levelData.number > 1 ? 
          (await prisma.level.findFirst({
            where: { number: levelData.number - 1, type: 'SEQUENTIAL' }
          }))?.id : null
      }
    });

    levelMap.set(levelData.number, level);

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
            console.log(`ℹ️  Skill "${routineSkillData.name}" is considered basic/automatic - not tracked separately`);
            continue;
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

  console.log('📊 Database seeding completed successfully!');
  
  // Print summary
  const levelCount = await prisma.level.count();
  const skillCount = await prisma.skill.count();
  const routineCount = await prisma.routine.count();
  const routineSkillCount = await prisma.routineSkill.count();
  
  console.log(`\n📈 Summary:`);
  console.log(`  • ${levelCount} levels created`);
  console.log(`  • ${skillCount} skills created`);
  console.log(`  • ${routineCount} routines created`);
  console.log(`  • ${routineSkillCount} routine-skill connections created`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 