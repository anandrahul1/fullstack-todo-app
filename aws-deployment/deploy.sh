#!/bin/bash

# 🚀 Todo App AWS Deployment Script
# Simple Architecture Deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="todo-app"
ENVIRONMENT="prod"
AWS_REGION="us-east-1"
STACK_NAME="${APP_NAME}-${ENVIRONMENT}-infrastructure"

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    print_success "AWS CLI is installed"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    print_success "AWS credentials are configured"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
    
    echo ""
}

deploy_infrastructure() {
    print_header "Deploying Infrastructure"
    
    echo "Deploying CloudFormation stack: $STACK_NAME"
    echo "Region: $AWS_REGION"
    echo ""
    
    aws cloudformation deploy \
        --template-file infrastructure.yml \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            AppName=$APP_NAME \
            Environment=$ENVIRONMENT \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION \
        --no-fail-on-empty-changeset
    
    if [ $? -eq 0 ]; then
        print_success "Infrastructure deployed successfully"
    else
        print_error "Infrastructure deployment failed"
        exit 1
    fi
    
    echo ""
}

get_stack_outputs() {
    print_header "Getting Stack Outputs"
    
    # Get ECR repository URI
    ECR_URI=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
        --output text)
    
    # Get frontend bucket name
    FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
        --output text)
    
    # Get data bucket name
    DATA_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' \
        --output text)
    
    # Get CloudFront domain
    CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
        --output text)
    
    # Get ALB domain
    ALB_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDomainName`].OutputValue' \
        --output text)
    
    # Get ECS cluster and service names
    ECS_CLUSTER=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' \
        --output text)
    
    ECS_SERVICE=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ECSServiceName`].OutputValue' \
        --output text)
    
    print_success "Retrieved stack outputs"
    echo "ECR URI: $ECR_URI"
    echo "Frontend Bucket: $FRONTEND_BUCKET"
    echo "Data Bucket: $DATA_BUCKET"
    echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
    echo "ALB Domain: $ALB_DOMAIN"
    echo ""
}

build_and_push_image() {
    print_header "Building and Pushing Docker Image"
    
    # Login to ECR
    echo "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build Docker image
    echo "Building Docker image..."
    cd ..
    docker build -t $APP_NAME:latest .
    
    # Tag image for ECR
    docker tag $APP_NAME:latest $ECR_URI:latest
    
    # Push image to ECR
    echo "Pushing image to ECR..."
    docker push $ECR_URI:latest
    
    print_success "Docker image built and pushed successfully"
    echo ""
}

deploy_frontend() {
    print_header "Deploying Frontend to S3"
    
    cd ..
    
    # Update frontend configuration
    cat > public/js/config.js << EOF
// AWS Configuration
window.APP_CONFIG = {
    API_BASE_URL: 'http://$ALB_DOMAIN',
    ENVIRONMENT: '$ENVIRONMENT'
};
EOF
    
    # Sync frontend files to S3
    aws s3 sync public/ s3://$FRONTEND_BUCKET/ --delete
    
    print_success "Frontend deployed to S3"
    echo ""
}

update_ecs_service() {
    print_header "Updating ECS Service"
    
    # Force new deployment to pull latest image
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $ECS_SERVICE \
        --force-new-deployment \
        --region $AWS_REGION
    
    print_success "ECS service update initiated"
    echo ""
}

wait_for_deployment() {
    print_header "Waiting for Deployment to Complete"
    
    echo "Waiting for ECS service to stabilize..."
    aws ecs wait services-stable \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION
    
    print_success "ECS service is stable"
    echo ""
}

show_deployment_info() {
    print_header "Deployment Complete! 🎉"
    
    echo -e "${GREEN}Your Todo App is now deployed on AWS!${NC}"
    echo ""
    echo "📱 Frontend URL: https://$CLOUDFRONT_DOMAIN"
    echo "🔗 API URL: http://$ALB_DOMAIN"
    echo "📊 AWS Console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$ECS_CLUSTER/services"
    echo ""
    echo -e "${YELLOW}Note: It may take a few minutes for CloudFront to propagate globally.${NC}"
    echo ""
    
    # Test the deployment
    echo "Testing deployment..."
    sleep 30  # Wait a bit for services to be ready
    
    if curl -f -s "http://$ALB_DOMAIN/health" > /dev/null; then
        print_success "Backend health check passed"
    else
        print_warning "Backend health check failed - it may still be starting up"
    fi
    
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Test your application at https://$CLOUDFRONT_DOMAIN"
    echo "2. Set up a custom domain (optional)"
    echo "3. Configure HTTPS for the ALB (optional)"
    echo "4. Set up monitoring and alerts"
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "🚀 Todo App AWS Deployment"
    echo "Simple Architecture"
    echo -e "${NC}"
    
    check_prerequisites
    deploy_infrastructure
    get_stack_outputs
    build_and_push_image
    deploy_frontend
    update_ecs_service
    wait_for_deployment
    show_deployment_info
}

# Run main function
main "$@"