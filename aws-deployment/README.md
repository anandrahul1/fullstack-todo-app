# AWS Deployment - Todo App PoC

This directory contains the infrastructure and deployment configuration for deploying the Todo App to AWS using a simplified PoC setup.

## 🏗️ Architecture Overview

This PoC deployment uses:
- **Default VPC** - Uses existing default VPC and subnets
- **Application Load Balancer** - For load balancing and public access
- **ECS Fargate** - Containerized application hosting
- **ECR** - Container image registry
- **S3** - Data storage for todos
- **CloudWatch** - Logging and monitoring

## 📁 Files

- `infrastructure.yml` - CloudFormation template for AWS resources
- `deploy.sh` - Legacy deployment script (use GitHub Actions instead)
- `README.md` - This file

## 🚀 Deployment Options

### Option 1: GitHub Actions (Recommended)

The repository includes two GitHub Actions workflows:

#### Infrastructure Deployment
- **File**: `.github/workflows/infrastructure.yml`
- **Triggers**: Push to main/develop, manual dispatch
- **Purpose**: Deploy/destroy AWS infrastructure

#### Application Deployment  
- **File**: `.github/workflows/deploy-app.yml`
- **Triggers**: Push to main/develop (non-infrastructure changes), manual dispatch
- **Purpose**: Build and deploy application to ECS

#### Setup GitHub Actions

1. **Configure AWS Credentials**:
   ```bash
   # In your GitHub repository settings, add these secrets:
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

2. **Deploy Infrastructure**:
   - Go to Actions tab in GitHub
   - Run "Todo App - Infrastructure Deployment" workflow
   - Choose environment (dev/staging/prod)
   - Select "deploy" action

3. **Deploy Application**:
   - Push code changes to trigger automatic deployment
   - Or manually run "Todo App - Application Deployment" workflow

### Option 2: Local Deployment

Use the deployment script for local development:

```bash
# Deploy to dev environment
./scripts/deploy.sh

# Deploy to specific environment
ENVIRONMENT=staging ./scripts/deploy.sh

# Deploy to different region
AWS_REGION=us-west-2 ./scripts/deploy.sh

# Destroy infrastructure
./scripts/deploy.sh destroy
```

## 🔧 Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- Node.js 18+ (for local testing)

## 📊 AWS Resources Created

| Resource | Purpose | Estimated Cost/Month |
|----------|---------|---------------------|
| ECS Fargate (1 task) | Application hosting | $15-25 |
| Application Load Balancer | Load balancing | $20 |
| S3 Bucket | Data storage | $1-3 |
| ECR Repository | Container images | $1 |
| CloudWatch Logs | Logging | $1-2 |
| **Total** | | **~$38-51** |

## 🌐 Access Your Application

After deployment, you'll get:
- **Application URL**: `http://your-alb-domain.region.elb.amazonaws.com`
- **Health Check**: `http://your-alb-domain.region.elb.amazonaws.com/health`

## 🔍 Monitoring

- **ECS Console**: Monitor service health and tasks
- **CloudWatch Logs**: View application logs
- **Load Balancer**: Check target health

## 🛠️ Troubleshooting

### Common Issues

1. **ECS Service Won't Start**
   - Check CloudWatch logs for container errors
   - Verify ECR image exists and is accessible
   - Check security group rules

2. **Health Check Failing**
   - Ensure application listens on port 3000
   - Verify `/health` endpoint exists
   - Check container logs

3. **Can't Access Application**
   - Verify ALB security group allows port 80
   - Check target group health
   - Ensure ECS tasks are running

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster todo-app-dev-cluster --services todo-app-dev-service

# View CloudWatch logs
aws logs tail /ecs/todo-app-dev --follow

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

## 🔒 Security Considerations

This is a PoC setup with basic security:
- Uses default VPC (acceptable for PoC)
- ALB allows HTTP traffic from internet
- ECS tasks have minimal IAM permissions
- S3 bucket blocks public access

For production, consider:
- Custom VPC with private subnets
- HTTPS/SSL certificates
- WAF protection
- Enhanced monitoring and alerting
- Backup strategies

## 🧹 Cleanup

To avoid ongoing charges:

```bash
# Using script
./scripts/deploy.sh destroy

# Using GitHub Actions
# Run "Infrastructure Deployment" workflow with "destroy" action

# Manual cleanup
aws cloudformation delete-stack --stack-name todo-app-dev
```

## 📝 Next Steps

1. **Custom Domain**: Set up Route 53 and SSL certificate
2. **HTTPS**: Configure ALB with SSL/TLS
3. **Monitoring**: Set up CloudWatch alarms
4. **Scaling**: Configure auto-scaling policies
5. **CI/CD**: Enhance deployment pipeline
6. **Security**: Implement additional security measures