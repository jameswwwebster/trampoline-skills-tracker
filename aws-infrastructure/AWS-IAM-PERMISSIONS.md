# AWS IAM Permissions Guide

This guide covers the IAM permissions needed for your AWS CLI user to deploy and manage the Trampoline Skills Tracker infrastructure.

## Option 1: Quick Setup (Recommended for Development)

### Administrator Access (Simplest)
For development and testing, you can use the built-in AWS managed policy:

1. **Go to IAM Console** → Users → Create User
2. **Username**: `trampoline-skills-deployer`
3. **Attach policies directly**:
   - ✅ `AdministratorAccess` (AWS managed policy)

**Pros**: Simple, works immediately
**Cons**: Broad permissions (not recommended for production)

## Option 2: Minimal Required Permissions (Production)

### Core CDK Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "sts:AssumeRole",
                "iam:*",
                "ssm:*"
            ],
            "Resource": "*"
        }
    ]
}
```

### Service-Specific Permissions

#### 1. VPC and Networking
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 2. ECS and Container Management
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:*",
                "ecr:*",
                "logs:*",
                "application-autoscaling:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 3. RDS Database
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "rds:*",
                "secretsmanager:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 4. S3 Storage
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 5. Load Balancer
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "elasticloadbalancing:*",
                "elasticloadbalancingv2:*"
            ],
            "Resource": "*"
        }
    ]
}
```

#### 6. CloudWatch Monitoring
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudwatch:*",
                "logs:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## Option 3: Combined Minimal Policy (Recommended)

### Single Policy for All Required Permissions
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "CDKBootstrapPermissions",
            "Effect": "Allow",
            "Action": [
                "cloudformation:*",
                "sts:AssumeRole",
                "iam:*",
                "ssm:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "NetworkingPermissions",
            "Effect": "Allow",
            "Action": [
                "ec2:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ContainerPermissions",
            "Effect": "Allow",
            "Action": [
                "ecs:*",
                "ecr:*",
                "logs:*",
                "application-autoscaling:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "DatabasePermissions",
            "Effect": "Allow",
            "Action": [
                "rds:*",
                "secretsmanager:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "StoragePermissions",
            "Effect": "Allow",
            "Action": [
                "s3:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "LoadBalancerPermissions",
            "Effect": "Allow",
            "Action": [
                "elasticloadbalancing:*",
                "elasticloadbalancingv2:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "MonitoringPermissions",
            "Effect": "Allow",
            "Action": [
                "cloudwatch:*",
                "logs:*"
            ],
            "Resource": "*"
        }
    ]
}
```

## Step-by-Step Setup Instructions

### 1. Create IAM User

1. **Go to AWS Console** → IAM → Users → Create User
2. **User name**: `trampoline-skills-deployer`
3. **Select**: "Provide user access to the AWS Management Console" (optional)
4. **Click**: Next

### 2. Set Permissions

#### Option A: Use Administrator Access (Quick)
1. **Select**: "Attach policies directly"
2. **Search**: "AdministratorAccess"
3. **Check**: AdministratorAccess
4. **Click**: Next

#### Option B: Create Custom Policy (Secure)
1. **Select**: "Attach policies directly"
2. **Click**: "Create policy"
3. **Select**: JSON tab
4. **Paste**: The combined minimal policy above
5. **Policy name**: `TrampolineSkillsDeployerPolicy`
6. **Click**: Create policy
7. **Go back** and attach the new policy

### 3. Create Access Keys

1. **Click**: Create user
2. **Go to**: Security credentials tab
3. **Click**: "Create access key"
4. **Select**: "Command Line Interface (CLI)"
5. **Check**: "I understand the above recommendation"
6. **Click**: Next
7. **Description**: "Trampoline Skills Deployment"
8. **Click**: Create access key
9. **⚠️ IMPORTANT**: Save both keys securely!

### 4. Configure AWS CLI

```bash
aws configure
# AWS Access Key ID: [YOUR_ACCESS_KEY]
# AWS Secret Access Key: [YOUR_SECRET_KEY]
# Default region name: eu-west-2  # You changed this from us-east-1
# Default output format: json
```

### 5. Test Configuration

```bash
# Test basic access
aws sts get-caller-identity

# Test CDK access
cd aws-infrastructure
npx cdk doctor
```

## GitHub Actions Setup

If using GitHub Actions, add these secrets to your repository:

1. **Go to**: GitHub Repository → Settings → Secrets and variables → Actions
2. **Add secrets**:
   - `AWS_ACCESS_KEY_ID`: Your access key ID
   - `AWS_SECRET_ACCESS_KEY`: Your secret access key

## Security Best Practices

### 1. Principle of Least Privilege
- Start with minimal permissions
- Add permissions only when needed
- Remove unused permissions regularly

### 2. Access Key Management
- ✅ Store keys securely (never in code)
- ✅ Rotate keys regularly (every 90 days)
- ✅ Use different keys for different environments
- ❌ Never commit keys to version control

### 3. Monitoring and Auditing
```bash
# Monitor API calls
aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=trampoline-skills-deployer

# Review permissions
aws iam get-user-policy --user-name trampoline-skills-deployer --policy-name TrampolineSkillsDeployerPolicy
```

### 4. Alternative: IAM Roles (Advanced)

Instead of long-term access keys, consider:
- **EC2 Instance Roles** for deployment from EC2
- **GitHub OIDC** for GitHub Actions
- **AWS SSO** for human access

## Troubleshooting Common Permission Issues

### 1. CDK Bootstrap Fails
**Error**: `User: arn:aws:iam::123456789012:user/deployer is not authorized to perform: iam:CreateRole`

**Solution**: Ensure IAM permissions include `iam:*`

### 2. ECR Push Fails
**Error**: `User: arn:aws:iam::123456789012:user/deployer is not authorized to perform: ecr:GetAuthorizationToken`

**Solution**: Add ECR permissions: `ecr:*`

### 3. RDS Creation Fails
**Error**: `User: arn:aws:iam::123456789012:user/deployer is not authorized to perform: rds:CreateDBInstance`

**Solution**: Add RDS permissions: `rds:*`

### 4. S3 Bucket Creation Fails
**Error**: `Access Denied` when creating S3 bucket

**Solution**: Add S3 permissions: `s3:*`

## Cost Implications

### IAM Costs
- **IAM Users**: Free
- **IAM Policies**: Free
- **Access Keys**: Free
- **API Calls**: Free (within limits)

### Monitoring Costs
- **CloudTrail**: First trail free, then $2/month
- **CloudWatch**: Free tier includes 10 custom metrics

## Summary

### For Development/Testing:
✅ Use **AdministratorAccess** policy (quick and simple)

### For Production:
✅ Use the **combined minimal policy** above (secure and specific)

### Key Points:
- Store access keys securely
- Test with `aws sts get-caller-identity`
- Monitor usage with CloudTrail
- Rotate keys every 90 days
- Use IAM roles when possible

The permissions above will allow you to deploy and manage your Trampoline Skills Tracker infrastructure on AWS successfully! 