# WebSocket Connection Fix for AWS App Runner

## Problem
WebSocket connections to AWS App Runner were failing with repeated connection errors:
```
WebSocket connection to 'wss://xty4pkm2a2.eu-west-1.awsapprunner.com/socket.io/?EIO=4&transport=websocket' failed
```

## Root Cause Analysis

AWS App Runner has specific requirements for WebSocket connections:

1. **Transport Order**: App Runner works better when Socket.IO starts with HTTP long-polling and then upgrades to WebSocket, rather than attempting WebSocket immediately.

2. **Timeout Configuration**: Default Socket.IO timeouts are too aggressive for App Runner's infrastructure.

3. **Path Configuration**: Explicit path configuration is needed for proper routing in containerized environments.

4. **CORS Configuration**: Need to ensure proper CORS headers for WebSocket upgrade requests.

## Changes Made

### 1. Server Configuration (`src/server.ts`)

**Key Changes:**
- Changed transport order from `["websocket", "polling"]` to `["polling", "websocket"]`
- Added explicit `path: '/socket.io/'` configuration
- Increased timeout values for better stability
- Added connection logging for debugging

```typescript
const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: process.env.NODE_ENV === 'production' ? '*' : allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  },
  allowEIO3: true,
  transports: ["polling", "websocket"], // Polling first for AWS App Runner
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  connectTimeout: 45000,
});
```

**Added Request Logging Middleware:**
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${req.headers.origin || 'no-origin'}`);
  
  // Set additional headers for WebSocket support
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  next();
});
```

**Added Connection Event Logging:**
```typescript
io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);
  console.log("Transport:", socket.conn.transport.name);
  console.log("Client headers:", socket.handshake.headers);

  socket.conn.on('upgrade', (transport) => {
    console.log(`⬆️ Client ${socket.id} upgraded to:`, transport.name);
  });
  
  // ... rest of the connection handler
});
```

### 2. Client Configuration (`public/src/main.js`)

**Key Changes:**
- Changed transport order to match server: `['polling', 'websocket']`
- Added explicit `path: '/socket.io/'`
- Increased reconnection attempts and timeout values
- Added comprehensive connection event logging

```javascript
const socket = io(window.location.origin, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'], // Start with polling, then upgrade
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 20000,
  autoConnect: true,
  forceNew: false,
  upgrade: true,
  rememberUpgrade: true
});
```

**Added Detailed Connection Logging:**
```javascript
// Connection events
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('Error details:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
  if (reason === 'io server disconnect') {
    socket.connect(); // Reconnect if server disconnected
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Reconnection attempt:', attemptNumber);
});

socket.io.engine.on('upgrade', (transport) => {
  console.log('⬆️ Transport upgraded to:', transport.name);
});

socket.io.engine.on('upgradeError', (error) => {
  console.error('❌ Transport upgrade error:', error.message);
});
```

## Deployment Instructions

### Step 1: Rebuild and Redeploy

```bash
# Build the application
npm run build

# Test locally first
npm start

# Then deploy to AWS App Runner
# (Use your existing deployment method)
```

### Step 2: Verify AWS App Runner Configuration

Ensure your App Runner service has:

1. **Port Configuration**: Port `3000` exposed (already configured in Dockerfile)

2. **Health Check**: Path `/health` should return 200 OK

3. **Environment Variables**:
   ```
   NODE_ENV=production
   AWS_REGION=eu-west-1
   PORT=3000
   ```

4. **IAM Role**: Ensure the instance role has Bedrock permissions:
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
         "Resource": "*"
       }
     ]
   }
   ```

### Step 3: Monitor Connection

After deployment, open browser DevTools Console and look for:

```
✅ Socket connected: [socket-id]
Transport: polling
⬆️ Transport upgraded to: websocket
```

This indicates successful connection and upgrade sequence.

### Step 4: Troubleshooting

If connections still fail:

1. **Check App Runner Logs**:
   - Look for connection attempts
   - Verify no credential errors
   - Check for transport upgrade messages

2. **Browser Console**:
   - Should see polling connection first
   - Then upgrade to websocket
   - No repeated connection errors

3. **Network Tab**:
   - Look for successful `/socket.io/?EIO=4&transport=polling` requests
   - Followed by websocket upgrade

4. **Test Health Endpoint**:
   ```bash
   curl https://xty4pkm2a2.eu-west-1.awsapprunner.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

## Why This Fix Works

### Transport Order Matters

AWS App Runner's infrastructure handles HTTP requests differently than WebSocket connections. By starting with polling:

1. **Initial Connection**: Establishes using standard HTTP (which App Runner handles well)
2. **Upgrade Request**: Once connection is stable, Socket.IO negotiates WebSocket upgrade
3. **Fallback**: If upgrade fails, continues working with polling

### Increased Timeouts

App Runner's routing layer can introduce latency. Longer timeouts prevent premature disconnections during:
- Initial connection establishment
- Transport upgrade negotiation
- Network hiccups

### Explicit Configuration

Containerized environments benefit from explicit configuration:
- Path specification prevents routing confusion
- Transport order ensures compatibility
- Timeout values account for infrastructure overhead

## Expected Behavior

### Successful Connection Flow:

1. Client connects via polling: `GET /socket.io/?EIO=4&transport=polling`
2. Server accepts and establishes session
3. Client requests upgrade: `GET /socket.io/?EIO=4&transport=polling&sid=...`
4. Server approves upgrade
5. WebSocket connection established: `WSS /socket.io/?EIO=4&transport=websocket&sid=...`
6. All subsequent communication over WebSocket

### In Browser Console:
```
✅ Socket connected: abc123
Transport: polling
⬆️ Transport upgraded to: websocket
```

### In Server Logs:
```
✅ New client connected: abc123
Transport: polling
⬆️ Client abc123 upgraded to: websocket
```

## Additional Recommendations

### 1. Enable AWS App Runner Logs

Configure CloudWatch Logs to capture all container output for debugging.

### 2. Monitor Connection Health

Add application-level monitoring to track:
- Connection success/failure rates
- Transport upgrade success rates
- Average connection establishment time

### 3. Consider Connection Pooling

For high-traffic scenarios, consider implementing connection pooling or using AWS API Gateway with WebSocket support.

### 4. Test from Different Networks

Test connections from:
- Different geographic regions
- Different network types (WiFi, cellular, corporate)
- Behind different firewall configurations

## Testing Checklist

- [ ] Local development works (`npm start`)
- [ ] Build succeeds (`npm run build`)
- [ ] Deployment completes successfully
- [ ] Health endpoint responds
- [ ] Browser console shows successful connection
- [ ] Transport upgrades to WebSocket
- [ ] Audio streaming works end-to-end
- [ ] No repeated connection errors
- [ ] Reconnection works after temporary disconnect
- [ ] Multiple concurrent users can connect

## Support

If issues persist after applying these fixes:

1. Check AWS App Runner service logs
2. Verify IAM permissions for Bedrock
3. Test health endpoint accessibility
4. Review browser console for specific error messages
5. Check Network tab for failed requests

## Version Information

- **Node.js**: 18.x
- **Socket.IO**: 4.8.1
- **AWS SDK**: 3.787.0
- **Target Platform**: AWS App Runner
- **Region**: eu-west-1
