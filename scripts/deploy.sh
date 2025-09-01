#!/bin/bash

# 🚀 Todo App Deployment Script (Simplified for PoC)
# Uses default VPC and essential AWS services only

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="todo-app"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${APP_NAME}-${ENVIRONMENT}"

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
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo ""
    
    aws cloudformation deploy \
        --template-file aws-deployment/infrastructure.yml \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            AppName=$APP_NAME \
            Environment=$ENVIRONMENT \
        --capabilities CAPABILITY_IAM \
        --region $AWS_REGION \
        --no-fail-on-empty-changeset \
        --tags \
            Project=$APP_NAME \
            Environment=$ENVIRONMENT \
            ManagedBy=LocalDeploy
    
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
    
    # Get data bucket name
    DATA_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' \
        --output text)
    
    # Get ALB domain
    ALB_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ALBDomainName`].OutputValue' \
        --output text)
    
    # Get application URL
    APP_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApplicationURL`].OutputValue' \
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
    echo "Data Bucket: $DATA_BUCKET"
    echo "ALB Domain: $ALB_DOMAIN"
    echo "Application URL: $APP_URL"
    echo "ECS Cluster: $ECS_CLUSTER"
    echo "ECS Service: $ECS_SERVICE"
    echo ""
}

build_and_push_image() {
    print_header "Building and Pushing Docker Image"
    
    # Login to ECR
    echo "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build Docker image
    echo "Building Docker image..."
    docker build -t $APP_NAME:latest .
    
    # Tag image for ECR
    docker tag $APP_NAME:latest $ECR_URI:latest
    
    # Push image to ECR
    echo "Pushing image to ECR..."
    docker push $ECR_URI:latest
    
    print_success "Docker image built and pushed successfully"
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

test_deployment() {
    print_header "Testing Deployment"
    
    echo "Waiting for application to be ready..."
    sleep 30
    
    # Test the health endpoint
    if curl -f -s "$APP_URL/health" > /dev/null; then
        print_success "Health check passed"
    else
        print_warning "Health check failed - application may still be starting"
    fi
    
    # Test the todos API
    if curl -f -s "$APP_URL/api/todos" > /dev/null; then
        print_success "API endpoint is responding"
    else
        print_warning "API endpoint test failed"
    fi
    
    echo ""
}

show_deployment_info() {
    print_header "Deployment Complete! 🎉"
    
    echo -e "${GREEN}Your Todo App is now deployed on AWS!${NC}"
    echo ""
    echo "🌐 Application URL: $APP_URL"
    echo "🔗 Health Check: $APP_URL/health"
    echo "📊 AWS Console: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/$ECS_CLUSTER/services"
    echo ""
    echo -e "${BLUE}Resources Created:${NC}"
    echo "- ECS Cluster: $ECS_CLUSTER"
    echo "- ECS Service: $ECS_SERVICE"
    echo "- ECR Repository: $ECR_URI"
    echo "- S3 Data Bucket: $DATA_BUCKET"
    echo "- Application Load Balancer: $ALB_DOMAIN"
    echo ""
    echo -e "${YELLOW}Estimated monthly cost: ~$40-50 (PoC setup)${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Test your application at $APP_URL"
    echo "2. Monitor logs in CloudWatch"
    echo "3. Scale ECS service if needed"
    echo "4. Set up custom domain (optional)"
    echo ""
}

destroy_infrastructure() {
    print_header "Destroying Infrastructure"
    
    print_warning "This will delete all AWS resources for $ENVIRONMENT environment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment destruction cancelled."
        exit 0
    fi
    
    # Empty S3 bucket first
    if [ ! -z "$DATA_BUCKET" ]; then
        echo "Emptying S3 bucket: $DATA_BUCKET"
        aws s3 rm s3://$DATA_BUCKET --recursive || true
    fi
    
    # Delete CloudFormation stack
    echo "Deleting CloudFormation stack: $STACK_NAME"
    aws cloudformation delete-stack \
        --stack-name $STACK_NAME \
        --region $AWS_REGION
    
    echo "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete \
        --stack-name $STACK_NAME \
        --region $AWS_REGION
    
    print_success "Infrastructure destroyed successfully"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "🚀 Todo App AWS Deployment (PoC)"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo -e "${NC}"
    
    # Check for destroy flag
    if [ "$1" = "destroy" ]; then
        get_stack_outputs 2>/dev/null || true
        destroy_infrastructure
        exit 0
    fi
    
    check_prerequisites
    deploy_infrastructure
    get_stack_outputs
    build_and_push_image
    update_ecs_service
    wait_for_deployment
    test_deployment
    show_deployment_info
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [destroy]"
    echo ""
    echo "Environment variables:"
    echo "  ENVIRONMENT - Deployment environment (default: dev)"
    echo "  AWS_REGION  - AWS region (default: us-east-1)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy to dev environment"
    echo "  ENVIRONMENT=prod $0   # Deploy to prod environment"
    echo "  $0 destroy            # Destroy infrastructure"
    exit 0
fi

# Run main function
main "$@"