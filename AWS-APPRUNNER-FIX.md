# AWS App Runner Credentials Fix

## Problem
Your application was failing in AWS App Runner with the error:
```
Error: {"source":"bidirectionalStream","error":{"name":"CredentialsProviderError","tryNextLink":true}}
```

## Root Cause
The code was using `fromIni({ profile: AWS_PROFILE_NAME })` which tries to read AWS credentials from a local `~/.aws/credentials` file. This doesn't work in AWS App Runner because:

1. **No local credentials file exists** in the container environment
2. **AWS App Runner uses IAM roles** for authentication, not credential files

## Changes Made

### 1. Fixed `src/server.ts`
**Before:**
```typescript
import { fromIni } from "@aws-sdk/credential-providers";
const AWS_PROFILE_NAME = process.env.AWS_PROFILE || "default";

const bedrockClient = new NovaSonicBidirectionalStreamClient({
  clientConfig: {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: fromIni({ profile: AWS_PROFILE_NAME }),
  },
});
```

**After:**
```typescript
// No more fromIni import needed

const bedrockClient = new NovaSonicBidirectionalStreamClient({
  clientConfig: {
    region: process.env.AWS_REGION || "us-east-1",
    // Credentials auto-loaded from IAM role
  },
});
```

### 2. Fixed `src/core/client.ts`
**Before:**
```typescript
if (!config.clientConfig.credentials) {
  throw new Error("No credentials provided");
}

this.bedrockRuntimeClient = new BedrockRuntimeClient({
  ...config.clientConfig,
  credentials: config.clientConfig.credentials,
  region: config.clientConfig.region || "us-east-1",
  requestHandler: nodeHttp2Handler,
});
```

**After:**
```typescript
// Removed the credentials check - AWS SDK will auto-discover them

this.bedrockRuntimeClient = new BedrockRuntimeClient({
  ...config.clientConfig,
  region: config.clientConfig.region || "us-east-1",
  requestHandler: nodeHttp2Handler,
});
```

## How AWS Credentials Work Now

The AWS SDK will automatically discover credentials in this order:

1. **Environment Variables** (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
2. **IAM Role** - Used in AWS App Runner, EC2, ECS, Lambda
3. **Local Credentials File** (~/.aws/credentials) - For local development

## AWS App Runner Configuration

### Required IAM Permissions

Your App Runner service needs an **IAM role** with permissions to access Amazon Bedrock. Make sure your App Runner instance role has:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*:*:*"
    }
  ]
}
```

### Setting Up IAM Role in App Runner

1. **Go to AWS App Runner Console**
2. **Select your service**
3. **Configuration → Security**
4. **Instance role** - Select or create a role with Bedrock permissions

### Alternative: Use Environment Variables

If you prefer to use access keys (not recommended for production):

1. In App Runner Console → Configuration → Environment variables
2. Add:
   - `AWS_ACCESS_KEY_ID` = your access key
   - `AWS_SECRET_ACCESS_KEY` = your secret key
   - `AWS_REGION` = your region (e.g., us-east-1)

## Deployment Steps

1. **Commit the changes:**
```bash
git add src/server.ts src/core/client.ts
git commit -m "Fix AWS credentials for App Runner deployment"
git push
```

2. **Redeploy to App Runner** (it should auto-deploy if connected to your repo)

3. **Verify IAM role** is properly configured in App Runner settings

## Testing Locally

For local development, the code will still work because it will automatically use your `~/.aws/credentials` file:

```bash
# Make sure you have AWS CLI configured
aws configure

# Or set environment variables
export AWS_PROFILE=default
export AWS_REGION=us-east-1

# Run locally
npm run dev
```

## Additional Fixes Needed

### CORS Configuration
Your server is currently hardcoded to `http://localhost:3001`. Update CORS for App Runner:

```typescript
const corsOptions = {
  origin: process.env.FRONTEND_URL || "https://your-frontend-domain.com",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
};
```

### WebSocket URL
Update your frontend to use the App Runner WebSocket URL instead of localhost.

## Troubleshooting

### Still getting credentials error?
- Check App Runner instance role has Bedrock permissions
- Verify the role is attached to your App Runner service
- Check CloudWatch logs for detailed error messages

### WebSocket connection failed?
- Update CORS origins to include your App Runner URL
- Update frontend WebSocket connection URL
- Check App Runner port configuration (should be 3000)

### Build errors?
- Run `npm install` to ensure all dependencies are installed
- Run `npm run build` to compile TypeScript
- Check that Dockerfile includes the build step
