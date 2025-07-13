#!/bin/bash

# AWS Deployment Script for Trampoline Skills Tracker
# This script deploys the application to AWS using CDK and ECR

set -e  # Exit on any error

echo "🚀 Starting AWS deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGION=${AWS_REGION:-eu-west-2}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_NAME="trampoline-skills"
IMAGE_TAG=${IMAGE_TAG:-latest}

echo -e "${YELLOW}Configuration:${NC}"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  ECR Repository: $ECR_REPO_NAME"
echo "  Image Tag: $IMAGE_TAG"
echo ""

# Step 1: Build and test the application
echo -e "${YELLOW}Step 1: Building application...${NC}"
cd ..
docker build -t $ECR_REPO_NAME:$IMAGE_TAG .

# Step 2: Create ECR repository if it doesn't exist
echo -e "${YELLOW}Step 2: Setting up ECR repository...${NC}"
aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $REGION > /dev/null 2>&1 || {
    echo "Creating ECR repository..."
    aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION
}

# Step 3: Login to ECR
echo -e "${YELLOW}Step 3: Logging into ECR...${NC}"
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Step 4: Tag and push image
echo -e "${YELLOW}Step 4: Pushing image to ECR...${NC}"
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME:$IMAGE_TAG"
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_URI
docker push $ECR_URI

# Step 5: Deploy infrastructure
echo -e "${YELLOW}Step 5: Deploying infrastructure...${NC}"
cd aws-infrastructure
npm run build

# Check if this is first deployment
if npx cdk list | grep -q "AwsInfrastructureStack"; then
    echo "Updating existing stack..."
    npx cdk deploy --require-approval never
else
    echo "First deployment - creating new stack..."
    npx cdk deploy --require-approval never
fi

# Step 6: Update ECS service with new image
echo -e "${YELLOW}Step 6: Updating ECS service...${NC}"

# Get cluster and service names from CDK outputs
CLUSTER_NAME=$(aws cloudformation describe-stacks --stack-name AwsInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`ClusterName`].OutputValue' --output text)
SERVICE_NAME=$(aws cloudformation describe-stacks --stack-name AwsInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`ServiceName`].OutputValue' --output text)

# Update the service
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --force-new-deployment \
    --region $REGION

# Step 7: Wait for deployment to complete
echo -e "${YELLOW}Step 7: Waiting for deployment to complete...${NC}"
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION

# Step 8: Get application URL
echo -e "${YELLOW}Step 8: Getting application URL...${NC}"
LOAD_BALANCER_DNS=$(aws cloudformation describe-stacks --stack-name AwsInfrastructureStack --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}🌐 Application URL: http://$LOAD_BALANCER_DNS${NC}"
echo -e "${GREEN}📊 Health Check: http://$LOAD_BALANCER_DNS/api/health${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run database migration (see database-migration.md)"
echo "2. Set up custom domain (optional)"
echo "3. Configure monitoring alerts"
echo ""
echo -e "${GREEN}🎉 Your application is now running on AWS!${NC}" 