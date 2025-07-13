# AWS Deployment Guide

This guide will walk you through deploying your Trampoline Skills Tracker application to AWS.

## Prerequisites

### 1. AWS Account Setup
1. Create an AWS account at [aws.amazon.com](https://aws.amazon.com)
2. Set up billing alerts (recommended)
3. Note your AWS Account ID

### 2. AWS CLI Installation
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download from https://awscli.amazonaws.com/AWSCLIV2.msi
```

### 3. AWS CLI Configuration
```bash
aws configure
```
Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-east-1`
- Default output format: `json`

### 4. Docker Installation
- Install Docker Desktop from [docker.com](https://docker.com)
- Ensure Docker is running

## Deployment Options

### Option A: Manual Deployment (Recommended for first time)

#### Step 1: Deploy Infrastructure
```bash
cd aws-infrastructure
npm install
npm run build
npx cdk bootstrap  # First time only
npx cdk deploy
```

#### Step 2: Build and Deploy Application
```bash
# From project root
chmod +x aws-infrastructure/deploy.sh
./aws-infrastructure/deploy.sh
```

### Option B: GitHub Actions (Automated)

#### Step 1: Set up GitHub Secrets
In your GitHub repository, go to Settings → Secrets and variables → Actions, and add:

- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key

#### Step 2: Push to Main Branch
```bash
git add .
git commit -m "Deploy to AWS"
git push origin main
```

The GitHub Action will automatically:
- Run tests
- Build the application
- Deploy to AWS
- Update the ECS service

## Post-Deployment Setup

### 1. Database Migration

#### Get Database Connection Details
```bash
# Get the database secret ARN from CloudFormation outputs
aws cloudformation describe-stacks --stack-name AwsInfrastructureStack --query 'Stacks[0].Outputs'

# Get database password
aws secretsmanager get-secret-value --secret-id "YOUR_SECRET_ARN" --query SecretString --output text
```

#### Run Migrations
```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:PASSWORD@RDS_ENDPOINT:5432/trampoline_skills"

# Run migrations
cd backend
npx prisma migrate deploy
```

### 2. Data Migration from Railway
See `aws-infrastructure/database-migration.md` for detailed steps.

### 3. Verify Deployment
```bash
# Get the application URL
aws cloudformation describe-stacks --stack-name AwsInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text

# Test health endpoint
curl http://YOUR_LOAD_BALANCER_DNS/api/health
```

## Environment Configuration

### AWS Services Created

1. **VPC** with public/private subnets
2. **RDS PostgreSQL** database (db.t3.micro)
3. **S3 bucket** for file storage
4. **ECS Fargate** cluster and service
5. **Application Load Balancer**
6. **CloudWatch** logs and monitoring
7. **IAM roles** with least privilege

### Environment Variables (Auto-configured)

```bash
NODE_ENV=production
STORAGE_TYPE=s3
AWS_S3_BUCKET=trampoline-skills-storage-ACCOUNT-REGION
AWS_REGION=us-east-1
DATABASE_URL=postgresql://postgres:password@rds-endpoint:5432/trampoline_skills
```

## Cost Estimates

### Monthly Costs (approximate)

| Service | Configuration | Cost |
|---------|---------------|------|
| RDS PostgreSQL | db.t3.micro | $13 |
| ECS Fargate | 0.5 vCPU, 1GB RAM | $30 |
| Application Load Balancer | Standard | $16 |
| S3 Storage | 1GB + requests | $1 |
| CloudWatch Logs | 1GB/month | $0.50 |
| **Total** | | **~$60/month** |

### Cost Optimization Tips

1. **Use Reserved Instances** for RDS (up to 60% savings)
2. **Scale down during low usage** (nights/weekends)
3. **Monitor and set billing alerts**
4. **Use S3 lifecycle policies** for old files

## Scaling Configuration

### Auto Scaling (Pre-configured)
- **Min capacity**: 1 task
- **Max capacity**: 10 tasks
- **CPU threshold**: 70%
- **Memory threshold**: 80%

### Manual Scaling
```bash
# Scale up
aws ecs update-service --cluster CLUSTER_NAME --service SERVICE_NAME --desired-count 3

# Scale down
aws ecs update-service --cluster CLUSTER_NAME --service SERVICE_NAME --desired-count 1
```

## Monitoring and Logging

### CloudWatch Dashboards
- Application metrics
- Database performance
- Load balancer metrics
- Auto-scaling events

### Alarms (Pre-configured)
- High CPU utilization (>80%)
- High memory utilization (>85%)
- Database connection issues

### Logs
```bash
# View application logs
aws logs tail /ecs/trampoline-skills --follow

# View specific log group
aws logs describe-log-groups --log-group-name-prefix trampoline
```

## Security Features

### Network Security
- **VPC** with private subnets for database
- **Security groups** with minimal required ports
- **NAT Gateway** for outbound internet access

### Data Security
- **S3 encryption** at rest
- **RDS encryption** at rest
- **Secrets Manager** for database credentials
- **IAM roles** with least privilege

### Application Security
- **Non-root Docker user**
- **Health checks** for container monitoring
- **Load balancer** health checks

## Backup and Recovery

### Automated Backups
- **RDS**: 7-day backup retention
- **S3**: Versioning enabled
- **CloudWatch**: Log retention policies

### Manual Backup
```bash
# Database backup
pg_dump "postgresql://postgres:password@rds-endpoint:5432/trampoline_skills" > backup.sql

# S3 backup
aws s3 sync s3://your-bucket-name ./s3-backup/
```

## Troubleshooting

### Common Issues

#### 1. Deployment Fails
```bash
# Check CDK errors
npx cdk diff
npx cdk doctor

# Check CloudFormation events
aws cloudformation describe-stack-events --stack-name AwsInfrastructureStack
```

#### 2. Application Won't Start
```bash
# Check ECS service status
aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME

# Check container logs
aws logs tail /ecs/trampoline-skills --follow
```

#### 3. Database Connection Issues
```bash
# Test database connectivity
psql "postgresql://postgres:password@rds-endpoint:5432/trampoline_skills"

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

#### 4. File Upload Issues
```bash
# Check S3 permissions
aws s3 ls s3://your-bucket-name/
aws iam get-role-policy --role-name ECSTaskRole --policy-name S3Access
```

## Updating the Application

### Code Changes
```bash
# Option 1: Manual
./aws-infrastructure/deploy.sh

# Option 2: GitHub Actions
git push origin main
```

### Infrastructure Changes
```bash
# Update CDK stack
cd aws-infrastructure
npm run build
npx cdk diff  # Review changes
npx cdk deploy
```

## Custom Domain Setup (Optional)

### 1. Register Domain
- Use Route 53 or external registrar

### 2. Create SSL Certificate
```bash
# Request certificate
aws acm request-certificate --domain-name yourdomain.com --validation-method DNS

# Update CDK stack with domain configuration
```

### 3. Update Load Balancer
- Add HTTPS listener
- Redirect HTTP to HTTPS

## Support and Maintenance

### Regular Tasks
1. **Monitor costs** monthly
2. **Update dependencies** quarterly
3. **Review security** annually
4. **Backup verification** monthly

### Getting Help
- AWS Support (if you have a support plan)
- AWS Documentation
- Community forums
- GitHub issues

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Migrate database
3. ✅ Test application
4. 🔄 Set up monitoring alerts
5. 🔄 Configure custom domain
6. 🔄 Set up CI/CD pipeline
7. 🔄 Performance optimization

---

**🎉 Congratulations! Your application is now running on AWS with enterprise-grade infrastructure!** 