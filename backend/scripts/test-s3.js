#!/usr/bin/env node

require('dotenv').config();
const { testS3Connection } = require('../config/storage');

async function main() {
  console.log('🔍 Testing S3 Configuration...\n');
  
  // Check environment variables
  const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these in your .env file or Railway environment variables.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found:');
  console.log(`   - AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
  console.log(`   - AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY?.substring(0, 8)}...`);
  console.log(`   - AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`   - AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET}`);
  console.log();
  
  // Test S3 connection
  console.log('🔗 Testing S3 connection...');
  const success = await testS3Connection();
  
  if (success) {
    console.log('\n🎉 S3 configuration is working correctly!');
    console.log('You can now deploy with STORAGE_TYPE=s3');
  } else {
    console.log('\n❌ S3 configuration failed.');
    console.log('Please check:');
    console.log('1. AWS credentials are correct');
    console.log('2. S3 bucket exists and is accessible');
    console.log('3. IAM user has proper permissions');
    console.log('4. Region is correct');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}); 