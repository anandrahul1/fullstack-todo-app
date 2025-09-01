# 🚀 AWS Deployment Guide - Fullstack Todo App

## 📋 Overview

This guide provides multiple AWS deployment architectures for your Node.js Express + Vanilla JavaScript todo application, ranging from simple to enterprise-grade solutions.

## 🏗️ Architecture Options

### 1. 🎯 Simple Architecture (Recommended for MVP)

**Best for**: Development, testing, small-scale production

**Components**:
- **Frontend**: CloudFront + S3 Static Website
- **Backend**: ECS Fargate with Application Load Balancer
- **Storage**: S3 Bucket (JSON files)
- **Monitoring**: CloudWatch

**Estimated Cost**: $20-50/month

**Pros**:
- ✅ Quick to deploy
- ✅ Low cost
- ✅ Minimal complexity
- ✅ Auto-scaling with Fargate

**Cons**:
- ❌ File-based storage limitations
- ❌ Single region only
- ❌ Basic monitoring

### 2. 🏢 Production Architecture (Recommended for Scale)

**Best for**: Production workloads, high availability

**Components**:
- **Frontend**: CloudFront + S3 + Route 53
- **Backend**: ECS Fargate Multi-AZ with ALB
- **Storage**: S3 + DynamoDB + S3 Glacier backups
- **Security**: WAF, IAM roles, VPC
- **CI/CD**: CodePipeline + CodeBuild + ECR
- **Monitoring**: CloudWatch + CloudTrail

**Estimated Cost**: $100-300/month

**Pros**:
- ✅ High availability (Multi-AZ)
- ✅ Auto-scaling
- ✅ Comprehensive security
- ✅ Automated CI/CD
- ✅ Advanced monitoring

**Cons**:
- ❌ Higher complexity
- ❌ Higher cost
- ❌ Requires more setup time

### 3. ⚡ Serverless Architecture (Recommended for Variable Load)

**Best for**: Variable traffic, cost optimization, event-driven

**Components**:
- **Frontend**: CloudFront + S3
- **Backend**: API Gateway + Lambda functions
- **Storage**: DynamoDB
- **Security**: Cognito + IAM
- **Monitoring**: CloudWatch

**Estimated Cost**: $5-50/month (pay per use)

**Pros**:
- ✅ Pay-per-use pricing
- ✅ Automatic scaling to zero
- ✅ No server management
- ✅ Built-in security

**Cons**:
- ❌ Cold start latency
- ❌ Vendor lock-in
- ❌ Requires code refactoring

## 💾 Database Migration Options

Your current app uses file-based JSON storage. Here are migration paths:

### Option 1: Keep File-based (Easiest)
- **Current**: Local JSON files
- **AWS**: S3 bucket with JSON files
- **Migration**: Minimal code changes
- **Pros**: No refactoring needed
- **Cons**: Limited scalability

### Option 2: NoSQL Database (Recommended)
- **Target**: DynamoDB
- **Migration**: Moderate refactoring
- **Pros**: Serverless, auto-scaling, fast
- **Cons**: Learning curve

### Option 3: Relational Database
- **Target**: RDS PostgreSQL or Aurora
- **Migration**: Significant refactoring
- **Pros**: ACID compliance, complex queries
- **Cons**: Higher cost, more complex

## 🚀 Quick Start Deployment

### Prerequisites
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure
```

### Option A: Simple Architecture Deployment

1. **Create S3 Buckets**
```bash
# Static website bucket
aws s3 mb s3://your-todo-app-frontend-bucket
aws s3 website s3://your-todo-app-frontend-bucket --index-document index.html

# Data storage bucket
aws s3 mb s3://your-todo-app-data-bucket
```

2. **Deploy Frontend**
```bash
# Upload static files
aws s3 sync ./public s3://your-todo-app-frontend-bucket
```

3. **Create ECS Cluster**
```bash
# Create cluster
aws ecs create-cluster --cluster-name todo-app-cluster

# Create task definition (see task-definition.json below)
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

4. **Create Application Load Balancer**
```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name todo-app-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345
```

### Option B: Serverless Architecture Deployment

1. **Install Serverless Framework**
```bash
npm install -g serverless
serverless create --template aws-nodejs --path todo-app-serverless
```

2. **Create Lambda Functions**
```javascript
// lambda/getTodos.js
exports.handler = async (event) => {
  // Your todo retrieval logic
  return {
    statusCode: 200,
    body: JSON.stringify({ todos: [] })
  };
};
```

3. **Deploy with Serverless**
```bash
serverless deploy
```

## 📁 Required Configuration Files

### ECS Task Definition (task-definition.json)
```json
{
  "family": "todo-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "todo-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/todo-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "S3_BUCKET",
          "value": "your-todo-app-data-bucket"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/todo-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### CloudFormation Template (infrastructure.yml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Todo App Infrastructure'

Parameters:
  AppName:
    Type: String
    Default: todo-app
    Description: Application name

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${AppName}-vpc

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${AppName}-igw

  # S3 Buckets
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${AppName}-frontend-${AWS::AccountId}
      WebsiteConfiguration:
        IndexDocument: index.html
        ErrorDocument: error.html
      PublicAccessBlockConfiguration:
        BlockPublicAcls: false
        BlockPublicPolicy: false
        IgnorePublicAcls: false
        RestrictPublicBuckets: false

  DataBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${AppName}-data-${AWS::AccountId}
      VersioningConfiguration:
        Status: Enabled

Outputs:
  FrontendBucketName:
    Description: Frontend S3 bucket name
    Value: !Ref FrontendBucket
    Export:
      Name: !Sub ${AppName}-frontend-bucket

  DataBucketName:
    Description: Data S3 bucket name
    Value: !Ref DataBucket
    Export:
      Name: !Sub ${AppName}-data-bucket
```

## 🔧 Code Modifications for AWS

### Update Storage Service for S3
```javascript
// services/awsStorageService.js
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

class AWSStorageService {
  constructor(bucketName = process.env.S3_BUCKET) {
    this.bucketName = bucketName;
    this.key = 'todos.json';
  }

  async loadTodos() {
    try {
      const result = await s3.getObject({
        Bucket: this.bucketName,
        Key: this.key
      }).promise();
      
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return [];
      }
      throw error;
    }
  }

  async saveTodos(todos) {
    await s3.putObject({
      Bucket: this.bucketName,
      Key: this.key,
      Body: JSON.stringify(todos, null, 2),
      ContentType: 'application/json'
    }).promise();
  }
}

module.exports = AWSStorageService;
```

### Update package.json for AWS SDK
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "uuid": "^9.0.0",
    "aws-sdk": "^2.1490.0"
  }
}
```

### Environment Variables
```bash
# .env.production
NODE_ENV=production
PORT=3000
S3_BUCKET=your-todo-app-data-bucket
AWS_REGION=us-east-1
ALLOWED_ORIGINS=https://your-domain.com
```

## 🔒 Security Considerations

### IAM Roles and Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-todo-app-data-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Security Best Practices
- ✅ Use IAM roles instead of access keys
- ✅ Enable VPC for network isolation
- ✅ Use HTTPS everywhere (CloudFront + ALB)
- ✅ Enable WAF for DDoS protection
- ✅ Use Secrets Manager for sensitive data
- ✅ Enable CloudTrail for audit logging
- ✅ Regular security updates

## 📊 Monitoring and Logging

### CloudWatch Dashboards
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ServiceName", "todo-app-service"],
          ["AWS/ECS", "MemoryUtilization", "ServiceName", "todo-app-service"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ECS Metrics"
      }
    }
  ]
}
```

### Alerts
- CPU utilization > 80%
- Memory utilization > 80%
- Error rate > 5%
- Response time > 2 seconds

## 💰 Cost Optimization

### Simple Architecture (~$30/month)
- ECS Fargate: $15-25
- ALB: $16
- S3: $1-5
- CloudWatch: $2-5

### Production Architecture (~$150/month)
- ECS Fargate Multi-AZ: $30-50
- ALB: $16
- RDS/DynamoDB: $25-50
- CloudFront: $5-15
- WAF: $5-10
- Monitoring: $10-20
- Data transfer: $10-30

### Serverless Architecture (~$10-30/month)
- Lambda: $0-10 (pay per use)
- API Gateway: $3-15
- DynamoDB: $2-10
- S3 + CloudFront: $2-5

## 🚀 Next Steps

1. **Choose Architecture**: Start with Simple for MVP, upgrade to Production for scale
2. **Set up CI/CD**: Implement automated deployments
3. **Add Monitoring**: Set up comprehensive logging and alerting
4. **Security Hardening**: Implement security best practices
5. **Performance Optimization**: Add caching, CDN optimization
6. **Backup Strategy**: Implement automated backups
7. **Disaster Recovery**: Plan for multi-region deployment

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CloudFormation Templates](https://aws.amazon.com/cloudformation/templates/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

**Ready to deploy?** Choose your architecture and follow the deployment steps above! 🚀