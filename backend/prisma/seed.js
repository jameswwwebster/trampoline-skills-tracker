const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Read the skills data
  const skillsDataPath = path.join(__dirname, '../../resources/skills.json');
  const skillsData = JSON.parse(fs.readFileSync(skillsDataPath, 'utf8'));

  console.log('📚 Creating levels and skills...');

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

    // Create skills for this level
    const skillMap = new Map(); // To track skills by name for routine creation
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
      skillMap.set(skillData.name, skill);
    }

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
          
          // Find the skill in the level's skills or create it if it doesn't exist
          let skill = skillMap.get(routineSkillData.name);
          if (!skill) {
            // Create skill if it doesn't exist in the level
            skill = await prisma.skill.create({
              data: {
                name: routineSkillData.name,
                description: routineSkillData.description || null,
                levelId: level.id,
                order: skillMap.size + 1
              }
            });
            skillMap.set(routineSkillData.name, skill);
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
      await prisma.skill.create({
        data: {
          name: skillData.name,
          description: skillData.description || null,
          levelId: level.id,
          order: i + 1 // Use array index + 1 as order
        }
      });
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