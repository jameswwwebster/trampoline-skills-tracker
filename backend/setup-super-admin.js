#!/usr/bin/env node

/**
 * Setup Super Admin Script
 * 
 * This script helps you set up your first super admin user.
 * Run it with: node setup-super-admin.js
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Looking for existing users...\n');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in the database.');
      console.log('Please create a user account first through the application.');
      return;
    }
    
    console.log('📋 Available users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
    });
    
    console.log('\n🎯 Recommended users to promote to Super Admin:');
    const recommendedUsers = users.filter(user => 
      user.role === 'CLUB_ADMIN' || user.role === 'SYSTEM_ADMIN'
    );
    
    if (recommendedUsers.length > 0) {
      recommendedUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      });
    } else {
      console.log('   No admin users found. You can promote any user.');
    }
    
    console.log('\n💡 To promote a user to Super Admin, run:');
    console.log('   DATABASE_URL="your_connection_string" node -e "');
    console.log('   const { PrismaClient } = require(\'@prisma/client\');');
    console.log('   const prisma = new PrismaClient();');
    console.log('   prisma.user.update({');
    console.log('     where: { email: \'USER_EMAIL_HERE\' },');
    console.log('     data: { role: \'SUPER_ADMIN\' }');
    console.log('   }).then(() => console.log(\'✅ Super Admin created!\')).finally(() => prisma.$disconnect());');
    console.log('   "');
    
    console.log('\n🔧 Or use Prisma Studio:');
    console.log('   DATABASE_URL="your_connection_string" npx prisma studio');
    console.log('   Then edit the User table and change the role field to SUPER_ADMIN');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('P1001')) {
      console.log('\n💡 Database connection failed. Make sure you have the correct DATABASE_URL.');
      console.log('   Get it from your Render dashboard under your PostgreSQL database.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
