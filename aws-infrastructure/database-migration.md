# Database Migration Guide: Railway → AWS RDS

This guide covers migrating your PostgreSQL database from Railway to AWS RDS.

## Overview

Your current setup:
- **Railway**: PostgreSQL database with existing data
- **Target**: AWS RDS PostgreSQL with same schema and data

## Pre-Migration Checklist

### 1. Backup Current Database
```bash
# From your local machine, backup Railway database
# Replace with your actual Railway database URL
pg_dump "postgresql://user:password@host:port/database" > railway_backup.sql

# Or use Railway CLI
railway db dump > railway_backup.sql
```

### 2. Verify Schema Compatibility
```bash
# Check current PostgreSQL version on Railway
railway run psql -c "SELECT version();"

# Our AWS RDS will use PostgreSQL 15.4
# Ensure compatibility
```

## Migration Steps

### Step 1: Deploy AWS Infrastructure
```bash
# From aws-infrastructure directory
npm run build
npx cdk deploy

# Note the outputs:
# - DatabaseEndpoint
# - DatabaseSecretArn
# - S3BucketName
```

### Step 2: Get Database Connection Details
```bash
# Get database password from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id "DATABASE_SECRET_ARN" \
  --query SecretString --output text

# This returns JSON like: {"username":"postgres","password":"GENERATED_PASSWORD"}
```

### Step 3: Create Database Connection String
```bash
# Format: postgresql://username:password@host:port/database
# Example:
export AWS_DATABASE_URL="postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/trampoline_skills"
```

### Step 4: Run Prisma Migrations on AWS RDS
```bash
# From your backend directory
# Update DATABASE_URL to point to AWS RDS
export DATABASE_URL="$AWS_DATABASE_URL"

# Run migrations to create schema
npx prisma migrate deploy

# Verify schema was created
npx prisma studio
```

### Step 5: Data Migration
```bash
# Option A: Direct migration (if Railway and AWS can connect)
pg_dump "RAILWAY_DATABASE_URL" | psql "$AWS_DATABASE_URL"

# Option B: File-based migration
# 1. Export from Railway
pg_dump "RAILWAY_DATABASE_URL" > migration_data.sql

# 2. Import to AWS RDS
psql "$AWS_DATABASE_URL" < migration_data.sql
```

### Step 6: Verify Migration
```bash
# Connect to AWS RDS and verify data
psql "$AWS_DATABASE_URL"

# Check table counts
SELECT 
  schemaname,
  tablename,
  n_tup_ins as "rows"
FROM pg_stat_user_tables
ORDER BY n_tup_ins DESC;

# Verify specific tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM gymnasts;
SELECT COUNT(*) FROM skills;
-- etc.
```

## Post-Migration Tasks

### 1. Update Application Configuration
```bash
# Update environment variables in your deployment
# These will be automatically set by CDK:
STORAGE_TYPE=s3
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
DATABASE_URL=postgresql://postgres:password@rds-endpoint:5432/trampoline_skills
```

### 2. Test Application
```bash
# Deploy your application to ECS
# Verify all functionality works:
# - User authentication
# - Data loading
# - File uploads (now to S3)
# - Certificate generation
```

### 3. DNS and Domain Setup (Optional)
```bash
# If you have a custom domain:
# 1. Update Route 53 records
# 2. Add SSL certificate
# 3. Update CDK stack with domain configuration
```

## Rollback Plan

If migration fails:
1. Keep Railway database running during migration
2. Switch DNS back to Railway
3. Investigate and fix issues
4. Retry migration

## Environment Variables Summary

### Railway (Current)
```
DATABASE_URL=postgresql://...railway...
STORAGE_TYPE=local
```

### AWS (Target)
```
DATABASE_URL=postgresql://...rds...
STORAGE_TYPE=s3
AWS_S3_BUCKET=trampoline-skills-storage-ACCOUNT-REGION
AWS_REGION=us-east-1
NODE_ENV=production
```

## Cost Optimization

### RDS Instance Sizing
- **Start**: `db.t3.micro` (1 vCPU, 1GB RAM) - ~$13/month
- **Scale up**: `db.t3.small` (2 vCPU, 2GB RAM) - ~$26/month
- **Production**: `db.t3.medium` (2 vCPU, 4GB RAM) - ~$52/month

### S3 Storage
- **First 50TB**: $0.023 per GB/month
- **Requests**: $0.0004 per 1,000 PUT requests
- **Very cost-effective** for certificate templates

### ECS Fargate
- **CPU**: $0.04048 per vCPU/hour
- **Memory**: $0.004445 per GB/hour
- **512 CPU, 1GB RAM**: ~$30/month continuous

## Monitoring and Alerts

Post-migration, monitor:
- Database connections
- S3 upload/download errors
- Application response times
- Error rates

The CDK stack includes CloudWatch alarms for:
- High CPU utilization
- High memory utilization
- Database connection issues 