# Push to GitHub - Step by Step Guide

## Step 1: Create New GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name: `TabeoAI-Deploy`
4. Select scopes:
   - ✅ **repo** (all sub-options)
   - ✅ **workflow**
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)

## Step 2: Push Code to GitHub

Open PowerShell in the project directory and run:

```powershell
cd C:\AllVirtualEnv\tabeo\novasonicmcp\sample-nova-sonic-mcp

# Set your GitHub username
$username = "statnativ"

# Paste your new token here
$token = "YOUR_NEW_TOKEN_HERE"

# Push to GitHub
git push -u https://${username}:${token}@github.com/statnativ/TabeoAI.git main --force
```

## Step 3: Verify Push

Go to https://github.com/statnativ/TabeoAI and verify all files are there.

---

# Complete Execution Guide

## Prerequisites Setup

### 1. AWS Account Setup

```powershell
# Install AWS CLI (if not installed)
# Download from: https://aws.amazon.com/cli/

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key  
# - Default region: us-east-1
# - Default output format: json
```

### 2. Request Bedrock Access

1. Go to AWS Console → Amazon Bedrock
2. Click "Model access" in left menu
3. Click "Request model access"
4. Find "Amazon Nova Sonic" and click "Request access"
5. Wait for approval (usually instant)

### 3. Verify Bedrock Access

```powershell
aws bedrock list-foundation-models --region us-east-1 --query 'modelSummaries[?contains(modelId, `nova-sonic`)]'
```

You should see the Nova Sonic model listed.

---

## Local Testing (Before Deployment)

### Step 1: Install Dependencies

```powershell
cd C:\AllVirtualEnv\tabeo\novasonicmcp\sample-nova-sonic-mcp

# Install Node.js dependencies
npm install

# Build the application
npm run build
```

### Step 2: Test Locally

```powershell
# Start the server
npm start

# You should see:
# "Server listening on port 3000"
# "Open http://localhost:3000 in your browser"
```

### Step 3: Test in Browser

1. Open http://localhost:3000
2. Allow microphone access when prompted
3. Click the green phone button to start
4. Speak: "Hello, I'd like to book an appointment"
5. The AI receptionist should respond

**If it works locally, you're ready to deploy to AWS!**

---

## AWS Deployment

### Option A: Quick Deploy with EC2 (Recommended)

#### Step 1: Launch EC2 Instance

```powershell
# Create EC2 instance
aws ec2 run-instances `
  --image-id ami-0c55b159cbfafe1f0 `
  --instance-type t3.medium `
  --key-name YOUR_KEY_NAME `
  --security-group-ids sg-YOUR_SG `
  --subnet-id subnet-YOUR_SUBNET `
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=TabeoAI}]'
```

Or use AWS Console:
1. Go to EC2 → Launch Instance
2. Name: `TabeoAI`
3. AMI: Ubuntu 22.04 LTS
4. Instance type: t3.medium
5. Create/select key pair
6. Security group: Allow ports 22, 80, 443, 3000
7. Launch

#### Step 2: Connect to EC2

```powershell
# Get instance public IP from AWS Console
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

#### Step 3: Setup on EC2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Install PM2
sudo npm install -g pm2

# Configure AWS credentials
aws configure
# Enter your AWS credentials

# Clone repository
git clone https://github.com/statnativ/TabeoAI.git
cd TabeoAI

# Install dependencies
npm install

# Build
npm run build

# Start with PM2
pm2 start npm --name "tabeo-ai" -- start

# Save PM2 config
pm2 save
pm2 startup
# Run the command it outputs

# Check status
pm2 status
pm2 logs tabeo-ai
```

#### Step 4: Access Your Application

Open browser to: `http://YOUR_EC2_IP:3000`

---

### Option B: Deploy with Docker

#### Step 1: Build Docker Image

```powershell
cd C:\AllVirtualEnv\tabeo\novasonicmcp\sample-nova-sonic-mcp

# Build image
docker build -t tabeo-ai:latest .

# Test locally
docker run -p 3000:3000 `
  -e AWS_REGION=us-east-1 `
  -e AWS_ACCESS_KEY_ID=YOUR_KEY `
  -e AWS_SECRET_ACCESS_KEY=YOUR_SECRET `
  tabeo-ai:latest
```

#### Step 2: Push to ECR

```powershell
# Set variables
$AWS_ACCOUNT_ID = "YOUR_ACCOUNT_ID"
$AWS_REGION = "us-east-1"

# Create ECR repository
aws ecr create-repository --repository-name tabeo-ai --region $AWS_REGION

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Tag image
docker tag tabeo-ai:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tabeo-ai:latest"

# Push to ECR
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/tabeo-ai:latest"
```

#### Step 3: Deploy to ECS

```powershell
# Create ECS cluster
aws ecs create-cluster --cluster-name tabeo-ai-cluster --region $AWS_REGION

# Register task definition (create task-definition.json first)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service `
  --cluster tabeo-ai-cluster `
  --service-name tabeo-ai-service `
  --task-definition tabeo-ai `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

## Production Setup

### 1. Setup Domain (Optional)

```powershell
# Request SSL certificate
aws acm request-certificate `
  --domain-name receptionist.yourdomain.com `
  --validation-method DNS `
  --region us-east-1

# Follow DNS validation in ACM console
```

### 2. Setup Nginx (on EC2)

```bash
# Install Nginx
sudo apt install -y nginx

# Create config
sudo nano /etc/nginx/sites-available/tabeo-ai
```

Add this:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tabeo-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Setup Monitoring

```powershell
# Create CloudWatch alarm
aws cloudwatch put-metric-alarm `
  --alarm-name tabeo-ai-high-cpu `
  --alarm-description "Alert when CPU exceeds 80%" `
  --metric-name CPUUtilization `
  --namespace AWS/EC2 `
  --statistic Average `
  --period 300 `
  --threshold 80 `
  --comparison-operator GreaterThanThreshold `
  --evaluation-periods 2
```

---

## Maintenance Commands

### View Logs

```bash
# PM2 logs
pm2 logs tabeo-ai

# Follow logs
pm2 logs tabeo-ai --lines 100 --follow
```

### Update Application

```bash
cd TabeoAI
git pull
npm install
npm run build
pm2 restart tabeo-ai
```

### Monitor Performance

```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

### Backup

```powershell
# Create AMI snapshot
aws ec2 create-image `
  --instance-id i-xxxxx `
  --name "tabeo-ai-backup-$(Get-Date -Format 'yyyyMMdd')" `
  --description "Backup of TabeoAI"
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs tabeo-ai --lines 50

# Check AWS credentials
aws sts get-caller-identity

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1
```

### Microphone Not Working

1. Check browser permissions
2. Ensure HTTPS is enabled (required for microphone)
3. Check browser console for errors

### High Latency

1. Check AWS region (use closest to users)
2. Monitor CloudWatch metrics
3. Consider upgrading instance type

### Connection Timeout

1. Check security group rules
2. Verify WebSocket support
3. Check Nginx configuration

---

## Cost Optimization

### Current Setup Costs (Monthly)

- **EC2 t3.medium**: ~$30
- **Data Transfer**: ~$10
- **Bedrock Nova Sonic**: ~$50-100 (usage-based)
- **Total**: ~$90-140/month

### Save Money

1. **Use Spot Instances**: Save 70%
2. **Auto-scaling**: Scale down during off-hours
3. **Reserved Instances**: Save 40% with 1-year commitment
4. **Optimize logs**: Reduce CloudWatch retention

---

## Security Checklist

- ✅ Enable HTTPS/SSL
- ✅ Restrict SSH to your IP only
- ✅ Use IAM roles instead of access keys
- ✅ Enable CloudTrail for audit logs
- ✅ Regular security updates
- ✅ Enable AWS WAF
- ✅ Use Secrets Manager for sensitive data
- ✅ Enable VPC for network isolation

---

## Support & Resources

- **GitHub Repo**: https://github.com/statnativ/TabeoAI
- **AWS Bedrock Docs**: https://docs.aws.amazon.com/bedrock/
- **Nova Sonic Guide**: https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-nova-sonic.html

---

## Quick Reference Commands

```powershell
# Start locally
npm start

# Build
npm run build

# Push to GitHub
git add .
git commit -m "Update"
git push

# Deploy update to EC2
ssh ubuntu@YOUR_IP "cd TabeoAI && git pull && npm install && npm run build && pm2 restart tabeo-ai"

# View EC2 logs
ssh ubuntu@YOUR_IP "pm2 logs tabeo-ai --lines 50"

# Check AWS costs
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost
```

---

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Test locally
3. ✅ Deploy to AWS EC2
4. ⬜ Setup custom domain
5. ⬜ Enable HTTPS
6. ⬜ Configure monitoring
7. ⬜ Setup backups
8. ⬜ Optimize costs

**You're ready to deploy! Start with local testing, then move to AWS EC2.**
