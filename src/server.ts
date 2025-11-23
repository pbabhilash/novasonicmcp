import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fromIni } from "@aws-sdk/credential-providers";
import cors from "cors";
import { NovaSonicBidirectionalStreamClient } from "./core/client";
import { Buffer } from "node:buffer";
import { ToolHandler } from "./services/tools";
import { McpManager } from "./services/mcp-manager-v2";
///import { McpManager } from "./services/mcp-manager";
import { McpTool } from "./types/types";

// Configure AWS credentials
const AWS_PROFILE_NAME = process.env.AWS_PROFILE || "default";

// Create Express app and HTTP server
const app = express();

// Enable CORS with specific options
const corsOptions = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Credentials",
  ],
  exposedHeaders: ["Access-Control-Allow-Origin"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle OPTIONS preflight requests
app.options("*", cors(corsOptions));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
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
  transports: ["websocket", "polling"],
});

// Create ToolHandler
const toolHandler = new ToolHandler();

// Create MCP manager
const mcpManager = new McpManager(toolHandler);

// Async initialize MCP servers
(async () => {
  try {
    console.log("Initializing MCP servers...");
    await mcpManager.initializeServers();
    console.log("MCP servers initialized");
  } catch (error) {
    console.error("Failed to initialize MCP servers:", error);
  }
})();

// Create AWS Bedrock client
const bedrockClient = new NovaSonicBidirectionalStreamClient(
  {
    requestHandlerConfig: {
      maxConcurrentStreams: 10,
    },
    clientConfig: {
      region: process.env.AWS_REGION || "eu-west-1"
    },
  },
  toolHandler // Pass in toolHandler
);

// Periodically check for and close inactive sessions (every minute)
// Sessions with no activity for over 5 minutes will be force closed
setInterval(() => {
  console.log("Session cleanup check");
  const now = Date.now();

  // Check all active sessions
  bedrockClient.getActiveSessions().forEach((sessionId) => {
    const lastActivity = bedrockClient.getLastActivityTime(sessionId);

    // If no activity for 5 minutes, force close
    if (now - lastActivity > 5 * 60 * 1000) {
      console.log(
        `Closing inactive session ${sessionId} after 5 minutes of inactivity`
      );
      try {
        bedrockClient.forceCloseSession(sessionId);
      } catch (error) {
        console.error(`Error force closing inactive session ${sessionId}: ${error}`);
      }
    }
  });
}, 60000);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Create a unique session ID for this client
  const sessionId = socket.id;

  try {
    // Create session with the new API
    const session = bedrockClient.createStreamSession(sessionId);
    bedrockClient.initiateSession(sessionId);

    setInterval(() => {
      const connectionCount = Object.keys(io.sockets.sockets).length;
      console.log(`Active socket connections: ${connectionCount}`);
    }, 60000);

    // Set up event handlers
    session.onEvent("contentStart", (data) => {
      console.log("contentStart:", data);
      socket.emit("contentStart", data);
    });

    session.onEvent("textOutput", (data) => {
      console.log("Text output:", data);
      socket.emit("textOutput", data);
    });

    session.onEvent("audioOutput", (data) => {
      // console.log("Audio output received, sending to client");
      socket.emit("audioOutput", data);
    });

    session.onEvent("error", (data) => {
      console.error("Error in session:", data);
      socket.emit("error", data);
    });

    session.onEvent("toolUse", (data) => {
      console.log("Tool use detected:", data.toolName);
      socket.emit("toolUse", data);
    });

    session.onEvent("toolResult", (data) => {
      console.log("Tool result received");
      socket.emit("toolResult", data);
    });

    session.onEvent("contentEnd", (data) => {
      console.log("Content end received: ", data);
      socket.emit("contentEnd", data);
    });

    session.onEvent("streamComplete", () => {
      console.log("Stream completed for client:", socket.id);
      socket.emit("streamComplete");
    });

    // Simplified audioInput handler without rate limiting
    socket.on("audioInput", async (audioData) => {
      try {
        // Convert base64 string to Buffer
        const audioBuffer =
          typeof audioData === "string"
            ? Buffer.from(audioData, "base64")
            : Buffer.from(audioData);

        // Stream the audio
        await session.streamAudio(audioBuffer);
      } catch (error) {
        console.error("Error processing audio:", error);
        socket.emit("error", {
          message: "Error processing audio",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("promptStart", async () => {
      try {
        console.log("Prompt start received");
        await session.setupPromptStart();
      } catch (error) {
        console.error("Error processing prompt start:", error);
        socket.emit("error", {
          message: "Error processing prompt start",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("systemPrompt", async (data) => {
      try {
        console.log("System prompt received", data);
        await session.setupSystemPrompt(undefined, data);
      } catch (error) {
        console.error("Error processing system prompt:", error);
        socket.emit("error", {
          message: "Error processing system prompt",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Handle voice configuration event
    socket.on("voiceConfig", async (data) => {
      try {
        console.log("Voice configuration received:", data);
        if (data && data.voiceId) {
          // Save voiceId to session for use during initialization
          session.setVoiceId(data.voiceId);
          socket.emit("voiceConfigConfirmed", { voiceId: data.voiceId });
          console.log(`Voice ID updated to: ${data.voiceId}`);
        }
      } catch (error) {
        console.error("Error processing voice configuration:", error);
        socket.emit("error", {
          message: "Error processing voice configuration",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("audioStart", async (data) => {
      try {
        console.log("Audio start received", data);
        await session.setupStartAudio();
      } catch (error) {
        console.error("Error processing audio start:", error);
        socket.emit("error", {
          message: "Error processing audio start",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("stopAudio", async () => {
      try {
        console.log("Stop audio requested, beginning proper shutdown sequence");

        // Chain the closing sequence with delays
        await session.endAudioContent();
        await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for audio content to end

        await session.endPrompt();
        await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for prompt to end

        await session.close();
        await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for close to complete

        console.log("Session cleanup complete");
      } catch (error) {
        console.error("Error processing streaming end events:", error);
        socket.emit("error", {
          message: "Error processing streaming end events",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("Client disconnected abruptly:", socket.id);

      if (bedrockClient.isSessionActive(sessionId)) {
        try {
          console.log(
            `Beginning cleanup for abruptly disconnected session: ${socket.id}`
          );

          // Add explicit timeouts to avoid hanging promises
          const cleanupPromise = Promise.race([
            (async () => {
              await session.endAudioContent();
              await session.endPrompt();
              await session.close();
            })(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Session cleanup timeout")),
                3000
              )
            ),
          ]);

          await cleanupPromise;
          console.log(
            `Successfully cleaned up session after abrupt disconnect: ${socket.id}`
          );
        } catch (error) {
          console.error(`Error cleaning up session after disconnect: ${socket.id}: ${error}`);
          try {
            bedrockClient.forceCloseSession(sessionId);
            console.log(`Force closed session: ${sessionId}`);
          } catch (e) {
            console.error(`Failed even force close for session: ${sessionId}: ${e}`);
          }
        } finally {
          // Make sure socket is fully closed in all cases
          if (socket.connected) {
            socket.disconnect(true);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error creating session:", error);
    socket.emit("error", {
      message: "Failed to initialize session",
      details: error instanceof Error ? error.message : String(error),
    });
    socket.disconnect();
  }
});

// MCP服务器信息API端点
app.get("/api/mcp-servers", (req, res) => {
  try {
    // 指定类型，使TypeScript允许使用字符串索引
    const mcpServersInfo: Record<
      string,
      {
        command: string;
        args: string[];
        disabled: boolean;
        tools: McpTool[];
      }
    > = {};

    // 获取当前注册的MCP服务器信息
    mcpManager.getAllServersInfo().forEach((info, name) => {
      mcpServersInfo[name] = {
        command: info.command,
        args: info.args,
        disabled: info.disabled === true,
        tools: mcpManager.getServerTools(name),
      };
    });

    res.status(200).json(mcpServersInfo);
  } catch (error) {
    console.error("获取MCP服务器信息失败:", error);
    res.status(500).json({ error: "获取MCP服务器信息失败" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Bedrock credentials test endpoint
app.get("/api/bedrock-test", async (req, res) => {
  try {
    const { BedrockRuntimeClient } = await import("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "eu-west-1"
    });
    
    // If client creation succeeds, credentials are OK
    res.status(200).json({ 
      status: "Bedrock client initialized",
      region: process.env.AWS_REGION || "eu-west-1",
      message: "IAM role should be configured correctly. Check Bedrock console for model access."
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: "Bedrock credentials ERROR",
      error: error.message,
      region: process.env.AWS_REGION || "eu-west-1",
      solution: "Check IAM role permissions and Bedrock model access"
    });
  }
});

// Dental receptionist configuration endpoint
app.get("/api/dental-config", (req, res) => {
  try {
    // Load the dental receptionist config
    const configPath = path.join(__dirname, "../dental-receptionist-config.js");
    delete require.cache[require.resolve(configPath)]; // Clear cache to get fresh config
    const config = require(configPath);
    
    res.status(200).json({
      systemPrompt: config.DENTAL_RECEPTIONIST_PROMPT,
      knowledgeBase: config.DENTAL_KNOWLEDGE_BASE
    });
  } catch (error: any) {
    console.error("Error loading dental config:", error);
    res.status(500).json({ 
      error: "Failed to load dental receptionist configuration",
      details: error.message 
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    `Open http://localhost:${PORT} in your browser to access the application`
  );
});

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  const forceExitTimer = setTimeout(() => {
    console.error("Forcing server shutdown after timeout");
    process.exit(1);
  }, 5000);

  try {
    // Close MCP server connections
    console.log("Closing MCP server connections...");
    await mcpManager.closeAll();

    // First close Socket.IO server which manages WebSocket connections
    await new Promise((resolve) => io.close(resolve));
    console.log("Socket.IO server closed");

    // Then close all active sessions
    const activeSessions = bedrockClient.getActiveSessions();
    console.log(`Closing ${activeSessions.length} active sessions...`);

    await Promise.all(
      activeSessions.map(async (sessionId) => {
        try {
          await bedrockClient.closeSession(sessionId);
          console.log(`Closed session ${sessionId} during shutdown`);
        } catch (error) {
          console.error(`Error closing session ${sessionId} during shutdown: ${error}`);
          bedrockClient.forceCloseSession(sessionId);
        }
      })
    );

    // Now close the HTTP server with a promise
    await new Promise((resolve) => server.close(resolve));
    clearTimeout(forceExitTimer);
    console.log("Server shut down");
    process.exit(0);
  } catch (error) {
    console.error("Error during server shutdown:", String(error));
    process.exit(1);
  }
});


