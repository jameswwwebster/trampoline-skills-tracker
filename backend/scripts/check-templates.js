const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    console.log('🔍 Checking certificate templates...\n');
    
    // First check if we have any clubs
    const clubs = await prisma.club.findMany();
    console.log(`Found ${clubs.length} clubs in database`);
    
    // Then check templates
    const templates = await prisma.certificateTemplate.findMany({
      // Check all templates, not just active ones
      include: {
        club: {
          select: { name: true }
        }
      }
    });
    
    console.log(`Found ${templates.length} templates in database:\n`);
    
    for (const template of templates) {
      console.log(`📄 Template: ${template.name} (${template.club.name})`);
      console.log(`   ID: ${template.id}`);
      console.log(`   File: ${template.fileName}`);
      console.log(`   Path: ${template.filePath}`);
      console.log(`   Active: ${template.isActive}`);
      console.log(`   Default: ${template.isDefault}`);
      
      try {
        await fs.access(template.filePath);
        console.log(`   ✅ File exists`);
      } catch (error) {
        console.log(`   ❌ File MISSING!`);
        console.log(`   Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('✅ Template check complete!');
    
  } catch (error) {
    console.error('Error checking templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates(); 