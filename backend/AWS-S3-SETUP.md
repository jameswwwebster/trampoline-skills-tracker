# AWS S3 Integration Setup Guide

This guide will help you set up AWS S3 storage for your certificate templates, solving the ephemeral file system issue on Railway.

## Step 1: Create AWS Account and S3 Bucket

### 1.1 Create AWS Account
1. Go to [AWS Console](https://aws.amazon.com/)
2. Create an account if you don't have one
3. Sign in to the AWS Console

### 1.2 Create S3 Bucket
1. Navigate to S3 service
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `your-app-name-certificates`)
4. Select a region (e.g., `us-east-1`)
5. **Block Public Access**: Keep all blocks enabled (we'll use signed URLs)
6. **Bucket Versioning**: Enable (recommended for backup)
7. **Encryption**: Enable server-side encryption
8. Click "Create bucket"

## Step 2: Create IAM User and Permissions

### 2.1 Create IAM User
1. Navigate to IAM service
2. Click "Users" → "Add users"
3. Username: `trampoline-tracker-s3-user`
4. Access type: Select "Programmatic access"
5. Click "Next: Permissions"

### 2.2 Create Policy
1. Click "Attach policies directly"
2. Click "Create policy"
3. Use the JSON editor and paste this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

4. Replace `your-bucket-name` with your actual bucket name
5. Name the policy: `TrampolineTrackerS3Policy`
6. Click "Create policy"

### 2.3 Attach Policy to User
1. Go back to user creation
2. Search for your policy: `TrampolineTrackerS3Policy`
3. Select it and click "Next"
4. Review and click "Create user"

### 2.4 Save Credentials
1. **IMPORTANT**: Save the Access Key ID and Secret Access Key
2. You won't be able to see the secret key again!

## Step 3: Configure Railway Environment Variables

In your Railway dashboard, add these environment variables:

```bash
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

## Step 4: Test the Configuration

### 4.1 Local Testing
1. Create a `.env` file in your backend directory:

```bash
# Add to backend/.env
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

2. Test locally:
```bash
cd backend
npm start
```

Look for the log message: `✅ S3 connection successful`

### 4.2 Railway Testing
1. Deploy to Railway with the environment variables
2. Check the Railway logs for the S3 connection message
3. Try uploading a certificate template

## Step 5: Migration Strategy

### 5.1 Development Environment
- Keep using `STORAGE_TYPE=local` for development
- Use `STORAGE_TYPE=s3` for production

### 5.2 Existing Templates
Since Railway has ephemeral storage, existing templates are likely already lost. Users will need to re-upload their templates, but this will be the last time!

### 5.3 Gradual Migration
1. Deploy with S3 configuration
2. Notify users about the improvement
3. Users re-upload templates (they'll be permanently stored now)
4. Monitor S3 usage and costs

## Step 6: Monitoring and Costs

### 6.1 S3 Costs
- **Storage**: ~$0.023 per GB per month
- **Requests**: ~$0.0004 per 1,000 PUT requests
- **Data Transfer**: First 1GB free per month

For certificate templates (small images), expect costs under $1/month for most applications.

### 6.2 Monitoring
1. Set up CloudWatch alerts for S3 costs
2. Monitor S3 bucket usage in AWS Console
3. Set up billing alerts

## Step 7: Security Best Practices

### 7.1 Bucket Security
- ✅ Block public access (already done)
- ✅ Enable versioning (backup protection)
- ✅ Enable encryption at rest
- ✅ Use IAM policies with minimal permissions

### 7.2 Access Keys
- ✅ Use IAM user with limited permissions
- ✅ Rotate access keys regularly
- ✅ Never commit keys to version control
- ✅ Use Railway environment variables

### 7.3 Additional Security
- Consider enabling MFA for your AWS account
- Set up CloudTrail for API logging
- Enable S3 access logging

## Step 8: Backup and Recovery

### 8.1 S3 Versioning
- Already enabled during bucket creation
- Protects against accidental deletion
- Can restore previous versions

### 8.2 Cross-Region Replication (Optional)
For critical applications, consider setting up cross-region replication:
1. Create a bucket in another region
2. Set up replication rules
3. Additional costs apply

## Troubleshooting

### Common Issues

**Error: "Missing required AWS environment variables"**
- Check that all 4 environment variables are set in Railway
- Verify variable names are exactly correct

**Error: "S3 connection failed"**
- Verify AWS credentials are correct
- Check bucket name and region
- Ensure IAM user has correct permissions

**Error: "Access Denied"**
- Review IAM policy
- Ensure bucket name in policy matches actual bucket
- Check if bucket exists in the specified region

**Files not uploading**
- Check Railway logs for detailed error messages
- Verify S3 bucket permissions
- Test with a simple file upload

### Testing S3 Connection

You can test the S3 connection manually:

```bash
# In backend directory
node -e "
require('dotenv').config();
const { testS3Connection } = require('./config/storage');
testS3Connection();
"
```

## Next Steps

1. ✅ Set up AWS account and S3 bucket
2. ✅ Create IAM user and policy
3. ✅ Configure Railway environment variables
4. ✅ Test the configuration
5. ✅ Deploy to Railway
6. ✅ Notify users about the improvement
7. ✅ Monitor costs and usage

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify AWS credentials and permissions
3. Test S3 connection using the test function
4. Check AWS CloudTrail for API call logs

The S3 integration will permanently solve the ephemeral file system issue and provide a robust, scalable solution for file storage! 