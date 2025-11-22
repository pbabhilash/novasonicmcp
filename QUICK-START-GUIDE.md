# 🚀 Quick Start Guide - Dental Receptionist AI

## 📋 Prerequisites

Before you begin, ensure you have:

1. **AWS Account** with Bedrock access
2. **Node.js 18+** installed
3. **AWS CLI** configured with credentials
4. **Microphone** and speakers

---

## ⚡ Quick Setup (5 Minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/statnativ/TabeoAI.git
cd TabeoAI
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Enter your:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region: us-east-1
# Default output format: json
```

### Step 4: Enable Bedrock Access

1. Go to AWS Console → Amazon Bedrock → Model access
2. Click "Manage model access"
3. Enable "Amazon Nova Sonic"
4. Click "Save changes"

### Step 5: Build Application

```bash
npm run build
```

### Step 6: Start Server

```bash
npm start
```

### Step 7: Open Browser

```
http://localhost:3000
```

---

## 🎯 Using the Dental Receptionist

### First Time Setup

1. **Allow Microphone Access**
   - Browser will prompt for microphone permission
   - Click "Allow"

2. **Start Conversation**
   - Click the green phone button (center)
   - Wait for "Connected" status

3. **Talk to the Receptionist**
   - Speak naturally: "Hello, I'd like to book an appointment"
   - The AI will respond with voice

4. **End Conversation**
   - Click the red phone button to end call

### Controls

- **Left Button (Microphone)**: Mute/Unmute your microphone
- **Center Button (Phone)**: Start/End conversation
- **Right Button (Text)**: Show/Hide conversation transcript

### Voice Selection

- Click the user avatar at top
- Choose from:
  - **Tiffany** (Female - Default)
  - **Matthew** (Male)
  - **Amy** (Female)

---

## 🔧 Configuration

### Customize Practice Information

Edit `dental-receptionist-config.js`:

```javascript
// Update your practice details
const DENTAL_KNOWLEDGE_BASE = `
## Practice Information
- Location: YOUR ADDRESS HERE
- Hours: YOUR HOURS HERE
- Phone: YOUR PHONE HERE
...
`;
```

### Change System Prompt

1. Click settings icon (top right)
2. Go to "Prompts" tab
3. Select "Dental Receptionist"
4. Edit the prompt
5. Click "Save"

---

## 🐛 Troubleshooting

### Issue: "Microphone permission denied"

**Solution:**
```
1. Click the lock icon in browser address bar
2. Set Microphone to "Allow"
3. Refresh the page
```

### Issue: "Timed out waiting for input events"

**Solution:**
```bash
# This happens when audio doesn't start quickly enough
# Fix: Click the phone button, then immediately start speaking
# The AI needs audio input within a few seconds
```

### Issue: "Session initialization error"

**Solution:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1 | grep nova-sonic
```

### Issue: "No audio output"

**Solution:**
```
1. Check browser audio settings
2. Ensure speakers are not muted
3. Try a different browser (Chrome recommended)
4. Check browser console for errors (F12)
```

### Issue: Chinese characters in logs

**Solution:**
```bash
# Rebuild the application
npm run build
npm start
```

---

## 📱 Testing the Receptionist

### Sample Conversations

**Booking an Appointment:**
```
You: "Hi, I'd like to book a dental checkup"
AI: "Of course! I'd be happy to help you schedule a checkup. 
     May I have your name please?"
You: "John Smith"
AI: "Thank you, John. What date works best for you?"
```

**Asking About Services:**
```
You: "Do you offer teeth whitening?"
AI: "Yes, we do! We offer both in-office whitening for £300-£600 
     and take-home kits for £200-£400. Would you like to schedule 
     a consultation?"
```

**Emergency Situation:**
```
You: "I have severe tooth pain"
AI: "This sounds like a dental emergency. I'm going to prioritize 
     your appointment. Can you come in today?"
```

---

## 🔐 Security Notes

### Local Development
- Runs on `localhost:3000`
- Only accessible from your computer
- AWS credentials stored locally

### Production Deployment
- Use HTTPS (SSL certificate)
- Restrict access with firewall rules
- Use IAM roles instead of access keys
- Enable CloudWatch logging

---

## 💰 Cost Estimates

### Local Testing (Free Tier)
- First 2 months: **FREE** (AWS Free Tier)
- After: ~$5-10/month for light testing

### Production Usage
- 100 conversations/day: ~$50-75/month
- 500 conversations/day: ~$200-300/month
- 1000 conversations/day: ~$400-500/month

**Cost Breakdown:**
- Bedrock Nova Sonic: ~$0.50-1.00 per conversation
- Includes: Audio input/output + text processing

---

## 📊 Monitoring

### View Logs

```bash
# In the terminal where npm start is running
# You'll see real-time logs

# Look for:
✓ "Server listening on port 3000"
✓ "New client connected"
✓ "Session established"
✓ "Processing response stream"
```

### Check AWS Usage

```bash
# View Bedrock usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name InvocationCount \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-12-31T23:59:59Z \
  --period 86400 \
  --statistics Sum
```

---

## 🔄 Updates

### Pull Latest Changes

```bash
cd TabeoAI
git pull origin main
npm install
npm run build
npm start
```

### Update Practice Information

```bash
# Edit configuration
nano dental-receptionist-config.js

# Rebuild
npm run build

# Restart
npm start
```

---

## 🚀 Deploy to Production

See **AWS-DEPLOYMENT-GUIDE.md** for:
- EC2 deployment
- Elastic Beanstalk deployment
- ECS Fargate deployment
- Custom domain setup
- SSL certificate configuration

---

## 📞 Support

### Common Questions

**Q: Can I use a different voice?**
A: Yes! Click the user avatar and select Matthew or Amy.

**Q: Can I customize the responses?**
A: Yes! Edit `dental-receptionist-config.js` to change practice info and response style.

**Q: Does it work on mobile?**
A: Yes, but desktop Chrome/Edge works best for audio quality.

**Q: Can multiple people use it at once?**
A: Yes! Each browser session creates a separate conversation.

**Q: How do I stop the server?**
A: Press `Ctrl+C` in the terminal where npm start is running.

---

## 🎓 Next Steps

1. ✅ Test locally with sample conversations
2. ✅ Customize practice information
3. ✅ Test different voices
4. ✅ Review conversation transcripts
5. ✅ Deploy to AWS for production use
6. ✅ Set up custom domain
7. ✅ Enable HTTPS
8. ✅ Configure monitoring

---

## 📝 File Structure

```
TabeoAI/
├── dental-receptionist-config.js  # Practice info & prompts
├── public/
│   ├── index.html                 # Main UI
│   └── src/
│       ├── main.js                # Frontend logic
│       └── style.css              # Styling
├── src/
│   ├── server.ts                  # Backend server
│   ├── core/
│   │   └── client.ts              # Bedrock client
│   └── services/
│       └── tools.ts               # Tool handlers
├── package.json                   # Dependencies
├── AWS-DEPLOYMENT-GUIDE.md        # Production deployment
└── QUICK-START-GUIDE.md          # This file
```

---

## ✅ Checklist

Before going live:

- [ ] Test all conversation flows
- [ ] Verify practice information is correct
- [ ] Test emergency scenarios
- [ ] Check audio quality
- [ ] Test on different browsers
- [ ] Review AWS costs
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Enable HTTPS
- [ ] Test from different devices

---

## 🎉 You're Ready!

Your dental receptionist AI is now running. Start a conversation and see it in action!

**Need help?** Check the troubleshooting section or review the logs.

**Ready for production?** Follow the AWS-DEPLOYMENT-GUIDE.md.
