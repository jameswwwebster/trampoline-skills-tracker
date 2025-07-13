const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function cleanupTemplates() {
  try {
    console.log('🧹 Starting template cleanup...\n');
    
    const templatesDir = path.join(__dirname, '..', 'uploads', 'certificate-templates');
    
    // Check if templates directory exists
    try {
      await fs.access(templatesDir);
    } catch (error) {
      console.log('📁 Templates directory does not exist, creating it...');
      await fs.mkdir(templatesDir, { recursive: true });
      console.log('✅ Templates directory created');
      return;
    }
    
    // Get all template files
    const files = await fs.readdir(templatesDir);
    console.log(`📄 Found ${files.length} files in templates directory`);
    
    // Get all template records from database
    const templates = await prisma.certificateTemplate.findMany({
      include: {
        club: {
          select: { name: true }
        }
      }
    });
    console.log(`💾 Found ${templates.length} template records in database\n`);
    
    // Check for orphaned files (files without database records)
    const orphanedFiles = [];
    for (const file of files) {
      const filePath = path.join(templatesDir, file);
      const hasDbRecord = templates.some(template => 
        template.filePath === filePath || 
        template.fileName === file ||
        template.filePath.endsWith(file)
      );
      
      if (!hasDbRecord) {
        orphanedFiles.push(file);
      }
    }
    
    if (orphanedFiles.length > 0) {
      console.log(`🗑️  Found ${orphanedFiles.length} orphaned files:`);
      orphanedFiles.forEach(file => console.log(`   - ${file}`));
      console.log('');
    }
    
    // Check for database records with missing files
    const missingFiles = [];
    for (const template of templates) {
      try {
        await fs.access(template.filePath);
        console.log(`✅ ${template.name} (${template.club.name}) - File exists`);
      } catch (error) {
        console.log(`❌ ${template.name} (${template.club.name}) - File MISSING: ${template.filePath}`);
        missingFiles.push(template);
      }
    }
    
    if (missingFiles.length > 0) {
      console.log(`\n🔧 Fixing ${missingFiles.length} templates with missing files...`);
      
      for (const template of missingFiles) {
        // Mark template as inactive
        await prisma.certificateTemplate.update({
          where: { id: template.id },
          data: { 
            isActive: false,
            isDefault: false // Remove default status if file is missing
          }
        });
        console.log(`   ✅ Marked "${template.name}" as inactive`);
      }
    }
    
    console.log('\n✅ Template cleanup complete!');
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   - ${templates.length} templates in database`);
    console.log(`   - ${files.length} files in uploads directory`);
    console.log(`   - ${orphanedFiles.length} orphaned files`);
    console.log(`   - ${missingFiles.length} templates with missing files (marked inactive)`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTemplates(); 