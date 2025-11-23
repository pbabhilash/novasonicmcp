import { AudioPlayer } from "./lib/play/AudioPlayer.js";
import { ChatHistoryManager } from "./lib/util/ChatHistoryManager.js";

// Connect to the server
const socket = io();

// DOM elements
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const textButton = document.getElementById("text");
const statusElement = document.getElementById("status");
const chatContainer = document.getElementById("chat-container");
const statusTextElement = document.getElementById("status-text");
const pulsatingOrb = document.getElementById("pulsating-orb");
const configButton = document.getElementById("config-button");
const configModal = document.getElementById("config-modal");
const closeModalBtn = document.querySelector(".close-modal");
const promptSelect = document.getElementById("prompt-select");
const promptEditor = document.getElementById("prompt-editor");
const saveConfigBtn = document.getElementById("save-config");
const cancelConfigBtn = document.getElementById("cancel-config");

// Chat history management
let chat = { history: [] };
const chatRef = { current: chat };
const chatHistoryManager = ChatHistoryManager.getInstance(
  chatRef,
  (newChat) => {
    chat = { ...newChat };
    chatRef.current = chat;
    updateChatUI();
  }
);

// Audio processing variables
let audioContext;
let audioStream;
let isStreaming = false;
let isMuted = true; // Default microphone is off
let isChatVisible = true; // Chat visibility state
let processor;
let sourceNode;
let analyser; // Audio analyzer
let audioDataArray; // Store audio data
let animationFrame; // Animation frame
let lastAudioTimestamp = 0; // Last audio data timestamp
let voiceActivityHistory = []; // Store voice activity history
let voiceFrequencyHistory = []; // Store voice frequency feature history

// Smooth transition parameters
let currentScale = 1.0; // Current scale
let currentHue = 190; // Current hue
let currentSaturation = 80; // Current saturation
let currentLightness = 55; // Current lightness
let currentGlow = 70; // Current glow intensity
let currentOpacity = 0.8; // Current opacity
let currentInnerGlowOpacity = 0.3; // Inner glow opacity
let targetValues = {}; // Target values storage
let smoothingFactor = 0.15; // Smoothing factor (0-1), smaller = smoother
let waitingForAssistantResponse = false;
let waitingForUserTranscription = false;
let userThinkingIndicator = null;
let assistantThinkingIndicator = null;
let transcriptionReceived = false;
let displayAssistantText = false;
let role;
let audioPlayer = new AudioPlayer();
let sessionInitialized = false;
let micPermissionError = false;
let promptCache = {}; // Store prompt cache

// Dental receptionist system prompt - loaded inline for browser compatibility
let SYSTEM_PROMPT = `You are a professional and friendly dental receptionist AI assistant for our dental practice. Your role is to provide excellent customer service while helping patients with their inquiries and appointment needs.

## Your Responsibilities:
1. **Greet patients warmly** - Always be welcoming, friendly, and professional
2. **Answer questions** - Use the knowledge base to answer questions accurately
3. **Schedule appointments** - Help patients book, reschedule, or cancel appointments
4. **Collect information** - Gather patient name, contact info, reason for visit, insurance details when scheduling
5. **Handle emergencies** - Prioritize emergency situations and escalate appropriately
6. **Provide reassurance** - Many patients are nervous about dental visits; be empathetic and supportive

## Communication Guidelines:
- **Be conversational and natural** - Speak like a real person, not a robot
- **Keep responses concise** - Be helpful but don't overwhelm with too much information
- **Show empathy** - Acknowledge concerns about pain, cost, or dental anxiety
- **Never judge** - Many patients have gaps in dental care; be supportive
- **Clarify when needed** - If you need more information, ask politely
- **Be transparent** - If you don't know something, admit it and offer to have someone call them back
- **Maintain professionalism** - While friendly, maintain appropriate boundaries

## Important Rules:
❌ **NEVER provide medical diagnoses** - You can share general information but always say "A dentist will need to examine you to provide a proper diagnosis"
❌ **NEVER recommend specific medications** - Defer to the dentist for prescriptions
❌ **NEVER share other patients' information** - Maintain strict confidentiality
✅ **DO offer to schedule consultations** - For complex questions, suggest booking an appointment
✅ **DO provide cost estimates** - Use the ranges in the knowledge base
✅ **DO handle emergencies promptly** - Severe pain, broken teeth, infections need priority

## Practice Information:
- Location: City centre, near the main market area
- Hours: Monday to Saturday, 9 AM to 7 PM
- Services: General dentistry, cosmetic treatments, orthodontics, restorative procedures
- Teeth whitening: £300-£600 (in-office), £200-£400 (take-home)
- Invisalign: 12-18 months typically
- Payment plans available with 0% interest options
- Accept most major insurance plans

## Emergency Protocol:
If patient mentions severe pain, broken tooth, bleeding, swelling, or infection:
"This sounds like a dental emergency. I'm going to prioritize your appointment. Can you come in today?"

## Response Style:
Be warm, professional, and helpful. Keep responses short and conversational.`;

// Current voice configuration - using professional female voice for receptionist
let currentVoiceId = "tiffany"; // Default voice
let currentVoiceDisplay = "tiffany"; // Default display name

// Current language configuration
let currentLanguage = "en"; // Default language

// Multi-language text object
const translations = {
  en: {
    config: "Settings",
    prompt: "Prompts",
    language: "Language",
    mcpServers: "MCP Servers",
    selectPrompt: "Select Prompt:",
    customPrompt: "Custom Prompt:",
    selectLanguage: "Select Language:",
    save: "Save",
    cancel: "Cancel",
    loading: "Loading...",
    configSaved: "Settings Saved",
    disconnected: "Disconnected",
    connected: "Connected to server",
    requestingMic: "Requesting microphone permission...",
    micReady: "Microphone ready",
    recording: "Recording...",
    processing: "Processing...",
    ready: "Ready",
    initSession: "Initializing session...",
    sessionInited: "Session initialized",
    sessionError: "Session initialization error",
    talkOrTap: "Talk or tap to interrupt",
    micPermError: "Microphone permission error: ",
    micPermDenied: "Microphone permission denied. Please enable microphone access in browser settings.",
    refreshing: "Refreshing page...",
    voiceSwitched: "Switched to {voice} voice",
    startChat: "Click phone button below to start conversation",
    conversationEnded: "Conversation ended",
    enabled: "Enabled",
    disabled: "Disabled",
    command: "Command:",
    args: "Arguments:",
    availableTools: "Available Tools",
    noTools: "No tools provided by this server",
    noServers: "No MCP servers configured",
    failedToLoad: "Failed to load MCP server information",
    loadError: "Error loading MCP server information",
  },
};

// Initialize voice dropdown menu
function initVoiceDropdown() {
  const userBox = document.getElementById("user-box");
  const voiceDropdown = document.getElementById("voice-dropdown");
  const voiceOptions = document.querySelectorAll(".voice-option");
  const currentVoiceElement = document.getElementById("current-voice");

  // Update selected voice option
  function updateSelectedVoice(voiceId) {
    voiceOptions.forEach((opt) => {
      if (opt.getAttribute("data-voice") === voiceId) {
        opt.classList.add("selected");
      } else {
        opt.classList.remove("selected");
      }
    });
  }

  // Initialize selected state
  updateSelectedVoice(currentVoiceId);

  // Click user box to show dropdown
  userBox.addEventListener("click", (e) => {
    e.stopPropagation();
    voiceDropdown.classList.toggle("show");
  });

  // Select voice option
  voiceOptions.forEach((option) => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      const voiceId = option.getAttribute("data-voice");
      const voiceName = option.querySelector(".voice-name").textContent;

      // Set current voice ID and display name
      currentVoiceId = voiceId;

      if (voiceId === "tiffany") {
        currentVoiceDisplay = "tiffany";
      } else if (voiceId === "matthew") {
        currentVoiceDisplay = "matthew";
      } else if (voiceId === "amy") {
        currentVoiceDisplay = "amy";
      }

      // Update display name
      currentVoiceElement.textContent = currentVoiceDisplay;

      // Update selected state
      updateSelectedVoice(voiceId);

      // Close dropdown
      voiceDropdown.classList.remove("show");

      // Send voice config to server
      socket.emit("voiceConfig", { voiceId: currentVoiceId });

      // Reset session to use new voice next time
      sessionInitialized = false;

      // Show notification
      statusElement.textContent = `Switched to ${currentVoiceDisplay} voice`;
      statusElement.className = "connected";
      setTimeout(() => {
        if (statusElement.textContent.includes("Switched")) {
          statusElement.textContent = isStreaming
            ? "Recording..."
            : "Ready";
          statusElement.className = isStreaming ? "recording" : "ready";
        }
      }, 2000);
    });
  });

  // Click elsewhere to close dropdown
  document.addEventListener("click", () => {
    voiceDropdown.classList.remove("show");
  });
}

// Get translation text for current language
function getText(key, substitutions = {}) {
  const lang = translations[currentLanguage] || translations.en; // Default to English
  let text = lang[key] || key; // If translation not found, use key name

  // Handle substitutions
  Object.keys(substitutions).forEach((subKey) => {
    text = text.replace(`{${subKey}}`, substitutions[subKey]);
  });

  return text;
}

// Update UI texts
function updateUITexts() {
  // Update config modal texts
  document.querySelector(".modal-header h2").textContent = getText("config");
  document.querySelector(".tab[data-tab='prompt']").textContent =
    getText("prompt");
  document.querySelector(".tab[data-tab='language']").textContent =
    getText("language");
  document.querySelector(".tab[data-tab='mcp-servers']").textContent =
    getText("mcpServers");
  document.querySelector("label[for='prompt-select']").textContent =
    getText("selectPrompt");
  document.querySelector("label[for='prompt-editor']").textContent =
    getText("customPrompt");
  document.querySelector("label[for='language-select']").textContent =
    getText("selectLanguage");
  document.querySelector("#save-config").textContent = getText("save");
  document.querySelector("#cancel-config").textContent = getText("cancel");

  // Update loading text
  const mcpLoading = document.querySelector("#mcp-servers-container p");
  if (mcpLoading && mcpLoading.textContent.includes("Loading")) {
    mcpLoading.textContent = getText("loading");
  }

  // Update status texts
  if (statusElement) {
    const currentStatus = statusElement.textContent;

    if (currentStatus.includes("Disconnected")) {
      statusElement.textContent = getText("disconnected");
    } else if (currentStatus.includes("Connected")) {
      statusElement.textContent = getText("connected");
    } else if (currentStatus.includes("Requesting")) {
      statusElement.textContent = getText("requestingMic");
    } else if (currentStatus.includes("Microphone ready")) {
      statusElement.textContent = getText("micReady");
    } else if (currentStatus.includes("Recording")) {
      statusElement.textContent = getText("recording");
    } else if (currentStatus.includes("Processing")) {
      statusElement.textContent = getText("processing");
    } else if (currentStatus.includes("Ready")) {
      statusElement.textContent = getText("ready");
    } else if (currentStatus.includes("Initializing")) {
      statusElement.textContent = getText("initSession");
    } else if (currentStatus.includes("initialized")) {
      statusElement.textContent = getText("sessionInited");
    } else if (currentStatus.includes("initialization error")) {
      statusElement.textContent = getText("sessionError");
    } else if (currentStatus.includes("Switched")) {
      statusElement.textContent = getText("voiceSwitched", {
        voice: currentVoiceDisplay,
      });
    } else if (currentStatus.includes("Saved")) {
      statusElement.textContent = getText("configSaved");
    }
  }

  // Update status description text
  if (
    statusTextElement &&
    statusTextElement.textContent.includes("Talk or tap")
  ) {
    statusTextElement.textContent = getText("talkOrTap");
  }

  // Update empty chat text
  const emptyChat = document.querySelector("#empty-chat-subtitle");
  if (emptyChat) {
    emptyChat.textContent = getText("startChat");
  }

  // Check for conversation ended message
  const systemMessages = document.querySelectorAll(".message.system");
  systemMessages.forEach((msg) => {
    if (msg.textContent.includes("Conversation ended")) {
      msg.textContent = getText("conversationEnded");
    }
  });
}

// Language selection function
function initLanguageSelect() {
  const languageSelect = document.getElementById("language-select");
  if (languageSelect) {
    // Set initial selected language
    languageSelect.value = currentLanguage;

    // Add change event to preview language effect
    languageSelect.addEventListener("change", () => {
      const selectedLanguage = languageSelect.value;
      // Temporarily switch language to preview effect
      const originalLanguage = currentLanguage;
      currentLanguage = selectedLanguage;
      updateUITexts();

      // If user doesn't save, restore original language when closing modal
      document.getElementById("cancel-config").addEventListener(
        "click",
        function onCancel() {
          currentLanguage = originalLanguage;
          updateUITexts();
          this.removeEventListener("click", onCancel);
        },
        { once: true }
      );
    });
  }
}

// Initialize config modal
function initConfigModal() {
  // Get tab elements
  const tabs = document.querySelectorAll(".modal-tabs .tab");
  const tabContents = document.querySelectorAll(".tab-content");

  // Show config modal
  configButton.addEventListener("click", () => {
    configModal.classList.add("show");
    loadPromptOptions();
    loadMcpServers(); // Load MCP server info
    updateUITexts(); // Update UI texts
    initLanguageSelect(); // Initialize language selection
  });

  // Close config modal
  closeModalBtn.addEventListener("click", () => {
    configModal.classList.remove("show");
  });

  // Cancel button
  cancelConfigBtn.addEventListener("click", () => {
    configModal.classList.remove("show");
  });

  // Tab switching functionality
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = tab.getAttribute("data-tab");

      // Update active tab
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Update tab content
      tabContents.forEach((content) => {
        content.classList.remove("active");
        if (content.id === `${tabId}-tab`) {
          content.classList.add("active");
        }
      });
    });
  });

  // Save configuration
  saveConfigBtn.addEventListener("click", () => {
    const selectedPrompt = promptSelect.value;
    const selectedLanguage = document.getElementById("language-select").value;

    // Save prompt configuration
    if (selectedPrompt === "custom") {
      // Use custom prompt
      SYSTEM_PROMPT = promptEditor.value.trim();
    } else if (promptCache[selectedPrompt]) {
      // Use preset prompt
      SYSTEM_PROMPT = promptCache[selectedPrompt];
    }

    // Save language configuration
    if (selectedLanguage !== currentLanguage) {
      currentLanguage = selectedLanguage;
      updateUITexts(); // Update UI texts immediately
    }

    // Reset session to use new prompt
    sessionInitialized = false;

    // Close modal
    configModal.classList.remove("show");

    // Show notification
    statusElement.textContent = "Settings Saved";
    statusElement.className = "connected";
    setTimeout(() => {
      if (statusElement.textContent === "Settings Saved") {
        statusElement.textContent = isStreaming
          ? "Recording..."
          : "Ready";
        statusElement.className = isStreaming ? "recording" : "ready";
      }
    }, 2000);
  });

  // When prompt type selection changes
  promptSelect.addEventListener("change", async () => {
    const selectedPrompt = promptSelect.value;

    if (selectedPrompt === "custom") {
      // Custom mode, show current system prompt
      promptEditor.value = SYSTEM_PROMPT;
      promptEditor.disabled = false;
    } else if (selectedPrompt === "dental") {
      // Dental receptionist mode - reload default prompt
      promptEditor.disabled = true;
      const dentalPrompt = `You are a professional and friendly dental receptionist AI assistant for our dental practice. Your role is to provide excellent customer service while helping patients with their inquiries and appointment needs.

## Your Responsibilities:
1. **Greet patients warmly** - Always be welcoming, friendly, and professional
2. **Answer questions** - Use the knowledge base to answer questions accurately
3. **Schedule appointments** - Help patients book, reschedule, or cancel appointments
4. **Collect information** - Gather patient name, contact info, reason for visit, insurance details when scheduling
5. **Handle emergencies** - Prioritize emergency situations and escalate appropriately
6. **Provide reassurance** - Many patients are nervous about dental visits; be empathetic and supportive

## Communication Guidelines:
- **Be conversational and natural** - Speak like a real person, not a robot
- **Keep responses concise** - Be helpful but don't overwhelm with too much information
- **Show empathy** - Acknowledge concerns about pain, cost, or dental anxiety
- **Never judge** - Many patients have gaps in dental care; be supportive
- **Clarify when needed** - If you need more information, ask politely
- **Be transparent** - If you don't know something, admit it and offer to have someone call them back
- **Maintain professionalism** - While friendly, maintain appropriate boundaries

## Important Rules:
❌ **NEVER provide medical diagnoses** - You can share general information but always say "A dentist will need to examine you to provide a proper diagnosis"
❌ **NEVER recommend specific medications** - Defer to the dentist for prescriptions
❌ **NEVER share other patients' information** - Maintain strict confidentiality
✅ **DO offer to schedule consultations** - For complex questions, suggest booking an appointment
✅ **DO provide cost estimates** - Use the ranges in the knowledge base
✅ **DO handle emergencies promptly** - Severe pain, broken teeth, infections need priority

## Practice Information:
- Location: City centre, near the main market area
- Hours: Monday to Saturday, 9 AM to 7 PM
- Services: General dentistry, cosmetic treatments, orthodontics, restorative procedures
- Teeth whitening: £300-£600 (in-office), £200-£400 (take-home)
- Invisalign: 12-18 months typically
- Payment plans available with 0% interest options
- Accept most major insurance plans

## Emergency Protocol:
If patient mentions severe pain, broken tooth, bleeding, swelling, or infection:
"This sounds like a dental emergency. I'm going to prioritize your appointment. Can you come in today?"

## Response Style:
Be warm, professional, and helpful. Keep responses short and conversational.`;
      promptEditor.value = dentalPrompt;
    } else {
      // Preset mode, load corresponding prompt
      promptEditor.disabled = true;

      // If prompt is cached, use it directly
      if (promptCache[selectedPrompt]) {
        promptEditor.value = promptCache[selectedPrompt];
      } else {
        // Otherwise load prompt file
        try {
          promptEditor.value = "Loading...";
          const response = await fetch(`/prompts/${selectedPrompt}.md`);
          if (response.ok) {
            const text = await response.text();
            promptCache[selectedPrompt] = text;
            promptEditor.value = text;
          } else {
            promptEditor.value = "Failed to load";
          }
        } catch (error) {
          console.error("Failed to load prompt:", error);
          promptEditor.value = "Failed to load";
        }
      }
    }
  });
}

// Load prompt options
async function loadPromptOptions() {
  // Set current option to dental receptionist by default
  promptSelect.value = "dental";
  promptEditor.value = SYSTEM_PROMPT;
  promptEditor.disabled = true;
  
  // Add custom option
  let customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom";
  promptSelect.appendChild(customOption);
}

// Initialize WebSocket audio
// If chat is empty, show empty chat message
function checkEmptyChat() {
  if (
    !chat.history.length &&
    !waitingForUserTranscription &&
    !waitingForAssistantResponse
  ) {
    chatContainer.innerHTML = `
            <div id="empty-chat">
                <div id="empty-chat-subtitle">Click phone button below to start conversation</div>
            </div>
        `;
    return true;
  }
  return false;
}

// Initialize audio analyzer and animation
function setupAudioVisualization() {
  if (!audioContext || !sourceNode) return;

  // Create audio analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  // Connect analyzer
  sourceNode.connect(analyser);

  // Create data array
  const bufferLength = analyser.frequencyBinCount;
  audioDataArray = new Uint8Array(bufferLength);

  // Start animation loop
  updateOrbAnimation();
}

// Update pulsating orb animation
function updateOrbAnimation() {
  if (!analyser || !isStreaming) {
    cancelAnimationFrame(animationFrame);
    return;
  }

  // Get frequency data and time domain data
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);

  // Save current audio data to audio data array
  audioDataArray = frequencyData;

  // Calculate average amplitude and analyze different frequency bands
  let sum = 0;
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;

  // Analyze energy in different frequency bands
  const bassRange = Math.floor(frequencyData.length * 0.3); // Bass
  const midRange = Math.floor(frequencyData.length * 0.6); // Mid

  // Calculate zero crossing rate (voice activity detection metric)
  let zeroCrossings = 0;
  let prevSample = timeData[0] < 128 ? -1 : 1;

  for (let i = 1; i < timeData.length; i++) {
    const currentSample = timeData[i] < 128 ? -1 : 1;
    if (prevSample !== currentSample) {
      zeroCrossings++;
    }
    prevSample = currentSample;
  }

  // Store voice activity history
  const now = Date.now();
  if (now - lastAudioTimestamp > 50) {
    // Sample every 50ms
    const voiceActivityScore = (zeroCrossings / timeData.length) * 1000;

    // Save recent voice activity data, max 20 points
    voiceActivityHistory.push(voiceActivityScore);
    if (voiceActivityHistory.length > 20) {
      voiceActivityHistory.shift();
    }

    // Extract frequency features and save history
    const frequencyFeature = {
      bass: 0,
      mid: 0,
      treble: 0,
    };

    lastAudioTimestamp = now;
  }

  for (let i = 0; i < frequencyData.length; i++) {
    sum += frequencyData[i];

    // Analyze by frequency range
    if (i < bassRange) {
      bassSum += frequencyData[i];
    } else if (i < midRange) {
      midSum += frequencyData[i];
    } else {
      trebleSum += frequencyData[i];
    }
  }

  const average = sum / frequencyData.length;
  const bassAvg = bassSum / bassRange;
  const midAvg = midSum / (midRange - bassRange);
  const trebleAvg = trebleSum / (frequencyData.length - midRange);

  // Calculate voice activity level
  const voiceActivityLevel = Math.min(
    1.0,
    zeroCrossings / (timeData.length * 0.15)
  );

  // Non-linear mapping for visible changes even with weak sounds
  const volumeFactor = Math.pow(average / 128, 0.5);

  // Dynamic scale factor combines volume and voice activity
  const dynamicScaleFactor = Math.max(
    volumeFactor,
    voiceActivityLevel * 0.7 + Math.sin(Date.now() / 200) * 0.05
  );

  // Adjust orb pulsation based on volume and frequency
  const scale = 1 + Math.min(0.5, dynamicScaleFactor * 0.7);
  const opacity = 0.8 + (average / 256) * 0.2;

  // Adjust glow effect based on different frequency band energy
  const bassIntensity = Math.min(1.0, bassAvg / 110);
  const midIntensity = Math.min(1.0, midAvg / 90);
  const trebleIntensity = Math.min(1.0, trebleAvg / 70);

  // Sound feature analysis
  const soundEnergy =
    bassIntensity * 0.5 + midIntensity * 0.3 + trebleIntensity * 0.2;
  const isPulsating = soundEnergy > 0.2 || voiceActivityLevel > 0.3;

  // More dynamic glow effect
  const baseGlow = 60;
  const glow =
    baseGlow + Math.min(120, average * 1.0 + voiceActivityLevel * 60);

  // Dynamically change color based on voice activity and frequency features
  let r, g, b;

  // If there is clear voice activity
  if (voiceActivityLevel > 0.3) {
    // Blue-purple tone - more vibrant voice color
    r = Math.floor(50 + trebleIntensity * 100 + bassIntensity * 50);
    g = Math.floor(80 + midIntensity * 90);
    b = Math.floor(200 + voiceActivityLevel * 55);
  } else {
    // Blue-green tone - default state or background noise
    r = Math.floor(30 + bassIntensity * 100);
    g = Math.floor(150 + midIntensity * 60);
    b = Math.floor(220 + trebleIntensity * 35);
  }

  // Apply pulsation effect
  let transformStyle = `scale(${scale})`;

  // Add small random movement to make orb look more alive
  if (isPulsating) {
    const offsetX = (Math.random() - 0.5) * 5 * voiceActivityLevel;
    const offsetY = (Math.random() - 0.5) * 5 * voiceActivityLevel;
    transformStyle += ` translate(${offsetX}px, ${offsetY}px)`;
  }

  pulsatingOrb.style.transform = transformStyle;
  pulsatingOrb.style.opacity = opacity;

  // More dynamic shadow effect and inner glow
  pulsatingOrb.style.boxShadow = `
    0 0 ${glow}px rgba(${r}, ${g}, ${b}, ${0.6 + voiceActivityLevel * 0.2}), 
    0 0 ${glow * 1.5}px rgba(${r}, ${g}, ${b}, ${0.3 + soundEnergy * 0.2}), 
    inset 0 0 ${
      40 + average * 0.6 + voiceActivityLevel * 30
    }px rgba(255, 255, 255, ${
    0.4 + trebleIntensity * 0.3 + voiceActivityLevel * 0.3
  })
  `;

  // Dynamically change orb inner gradient
  if (average > 30 || voiceActivityLevel > 0.2) {
    pulsatingOrb.style.background = `radial-gradient(
      circle, 
      rgba(${r + 50}, ${g + 30}, ${b + 20}, ${
      0.7 + voiceActivityLevel * 0.3
    }) 0%,
      rgba(${r}, ${g}, ${b}, ${0.6 + soundEnergy * 0.2}) 60%,
      rgba(${r - 30}, ${g - 20}, ${b - 10}, ${0.5 + bassIntensity * 0.2}) 100%
    )`;
  }

  // Continue loop
  animationFrame = requestAnimationFrame(updateOrbAnimation);
}

// Stop audio visualization animation
function stopAudioVisualization() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  // Reset orb style
  if (pulsatingOrb) {
    pulsatingOrb.style.transform = "";
    pulsatingOrb.style.opacity = "";
    pulsatingOrb.style.boxShadow = "";
  }
}

async function initAudio() {
  try {
    statusElement.textContent = "Requesting microphone permission...";
    statusElement.className = "connecting";

    // Request microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    audioContext = new AudioContext({
      sampleRate: 16000,
    });

    await audioPlayer.start();

    statusElement.textContent = "Microphone ready";
    statusElement.className = "ready";
    startButton.disabled = false;
    stopButton.disabled = false; // Allow clicking phone button to start conversation
    micPermissionError = false;

    // Set initial style for microphone and phone buttons
    startButton.style.backgroundColor = "#ff3b30"; // Red, indicates mic is off
    startButton.querySelector("i").textContent = "mic_off";
    stopButton.style.backgroundColor = "#4cd964";
    stopButton.querySelector("i").textContent = "call";

    // Ensure microphone initial state is off
    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        track.enabled = false; // Turn off microphone
      });
    }
  } catch (error) {
    console.error("Error accessing microphone:", error);
    statusElement.textContent = "Microphone permission error: " + error.message;
    statusElement.className = "error";
    micPermissionError = true;
  }

  // Initially show empty chat state
  checkEmptyChat();
}

// Initialize the session with Bedrock
async function initializeSession() {
  if (sessionInitialized) return;

  statusElement.textContent = "Initializing session...";

  try {
    // Send events in sequence
    socket.emit("promptStart");
    socket.emit("systemPrompt", SYSTEM_PROMPT);
    socket.emit("audioStart");

    // Mark session as initialized
    sessionInitialized = true;
    statusElement.textContent = "Session initialized";
  } catch (error) {
    console.error("Failed to initialize session:", error);
    statusElement.textContent = "Session initialization error";
    statusElement.className = "error";
  }
}

// Handle microphone mute/unmute
function toggleMute() {
  if (!audioStream) return;

  isMuted = !isMuted;
  audioStream.getAudioTracks().forEach((track) => {
    track.enabled = !isMuted;
  });

  // Update microphone button style
  startButton.style.backgroundColor = isMuted ? "#ff3b30" : "#4cd964"; // Red or green
  startButton.querySelector("i").textContent = isMuted ? "mic_off" : "mic";
}

// Handle start/end conversation
function toggleConversation() {
  if (isStreaming) {
    stopStreaming();
    stopButton.style.backgroundColor = "#4cd964"; // Green
    stopButton.querySelector("i").textContent = "call";

    // Show refreshing status after ending call
    statusElement.textContent = "Refreshing page...";
    statusElement.className = "processing";

    // Add short delay then refresh page
    setTimeout(() => {
      window.location.reload();
    }, 1000); // Refresh after 1 second to give user visual feedback
  } else {
    if (micPermissionError) {
      handleRequestPermission();
    } else {
      startStreaming();
      stopButton.style.backgroundColor = "#ff3b30"; // Red
      stopButton.querySelector("i").textContent = "call_end";

      // When starting conversation, automatically enable microphone
      if (isMuted) {
        isMuted = false;
        audioStream.getAudioTracks().forEach((track) => {
          track.enabled = true; // Enable microphone
        });

        // Update microphone button style
        startButton.style.backgroundColor = "#4cd964"; // Green
        startButton.querySelector("i").textContent = "mic";
      }
    }
  }
}

async function startStreaming() {
  if (isStreaming) return;

  try {
    // Ensure AudioPlayer is initialized
    if (!audioPlayer.initialized) {
      await audioPlayer.start();
    }

    // First, make sure the session is initialized
    if (!sessionInitialized) {
      await initializeSession();
    }

    // Create audio processor
    sourceNode = audioContext.createMediaStreamSource(audioStream);

    // Setup audio analyzer and visualization
    setupAudioVisualization();

    // Use ScriptProcessorNode for audio processing
    if (audioContext.createScriptProcessor) {
      processor = audioContext.createScriptProcessor(512, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!isStreaming) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }

        // Convert to base64 (browser-safe way)
        const base64Data = arrayBufferToBase64(pcmData.buffer);

        // Send to server
        socket.emit("audioInput", base64Data);
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);
    }

    isStreaming = true;
    startButton.disabled = false; // Keep mic button enabled for muting
    stopButton.disabled = false;
    statusElement.textContent = "Recording...";
    statusElement.className = "recording";
    statusTextElement.textContent = "Talk or tap to interrupt";

    // Activate pulsating orb
    pulsatingOrb.classList.add("active");

    // Show user thinking indicator when starting to record
    transcriptionReceived = false;
    showUserThinkingIndicator();
  } catch (error) {
    console.error("Error starting recording:", error);
    statusElement.textContent = "Error: " + error.message;
    statusElement.className = "error";
  }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
  const binary = [];
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary.push(String.fromCharCode(bytes[i]));
  }
  return btoa(binary.join(""));
}

function stopStreaming() {
  if (!isStreaming) return;

  isStreaming = false;

  // Clean up audio processing
  if (processor) {
    processor.disconnect();
    sourceNode.disconnect();
  }

  // Stop audio visualization
  stopAudioVisualization();

  startButton.disabled = false;
  stopButton.disabled = false; // Keep phone button enabled to restart conversation
  statusElement.textContent = "Processing...";
  statusElement.className = "processing";
  statusTextElement.textContent = "";

  // Deactivate pulsating orb
  pulsatingOrb.classList.remove("active");

  audioPlayer.stop();
  // Tell server to finalize processing
  socket.emit("stopAudio");

  // End the current turn in chat history
  chatHistoryManager.endTurn();

  // Create new AudioPlayer instance after stopping
  audioPlayer = new AudioPlayer();

  // Reset session state so next conversation will reinitialize session
  sessionInitialized = false;

  // After conversation ends, turn off microphone again
  isMuted = true;
  if (audioStream) {
    audioStream.getAudioTracks().forEach((track) => {
      track.enabled = false; // Turn off microphone
    });
  }
  // Update microphone button style
  startButton.style.backgroundColor = "#ff3b30"; // Red
  startButton.querySelector("i").textContent = "mic_off";
}

// Base64 to Float32Array conversion
function base64ToFloat32Array(base64String) {
  try {
    const binaryString = window.atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
  } catch (error) {
    console.error("Error in base64ToFloat32Array:", error);
    throw error;
  }
}

// Process message data and add to chat history
function handleTextOutput(data) {
  console.log("Processing text output:", data);
  if (data.content) {
    const messageData = {
      role: data.role,
      message: data.content,
    };
    chatHistoryManager.addTextMessage(messageData);
  }
}

// Update the UI based on the current chat history
function updateChatUI() {
  if (!chatContainer) {
    console.error("Chat container not found");
    return;
  }

  // 检查是否为空聊天
  if (checkEmptyChat()) {
    return;
  }

  // Clear existing chat messages
  chatContainer.innerHTML = "";

  // Add all messages from history
  chat.history.forEach((item) => {
    if (item.endOfConversation) {
      const endDiv = document.createElement("div");
      endDiv.className = "message system";
      endDiv.textContent = "Conversation ended";
      chatContainer.appendChild(endDiv);
      return;
    }

    if (item.role) {
      const messageDiv = document.createElement("div");
      const roleLowerCase = item.role.toLowerCase();
      messageDiv.className = `message ${roleLowerCase}`;

      const roleLabel = document.createElement("div");
      roleLabel.className = "role-label";
      roleLabel.textContent = item.role;
      messageDiv.appendChild(roleLabel);

      const content = document.createElement("div");
      content.textContent = item.message || "No content";
      messageDiv.appendChild(content);

      chatContainer.appendChild(messageDiv);
    }
  });

  // Re-add thinking indicators if we're still waiting
  if (waitingForUserTranscription) {
    showUserThinkingIndicator();
  }

  if (waitingForAssistantResponse) {
    showAssistantThinkingIndicator();
  }

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Listening" indicator for user
function showUserThinkingIndicator() {
  hideUserThinkingIndicator();

  waitingForUserTranscription = true;
  userThinkingIndicator = document.createElement("div");
  userThinkingIndicator.className = "message user thinking";

  const roleLabel = document.createElement("div");
  roleLabel.className = "role-label";
  roleLabel.textContent = "USER";
  userThinkingIndicator.appendChild(roleLabel);

  const listeningText = document.createElement("div");
  listeningText.className = "thinking-text";
  listeningText.textContent =
    currentLanguage === "en" ? "Listening" : "正在聆听";
  userThinkingIndicator.appendChild(listeningText);

  const dotContainer = document.createElement("div");
  dotContainer.className = "thinking-dots";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotContainer.appendChild(dot);
  }

  userThinkingIndicator.appendChild(dotContainer);
  chatContainer.appendChild(userThinkingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Thinking" indicator for assistant
function showAssistantThinkingIndicator() {
  hideAssistantThinkingIndicator();

  waitingForAssistantResponse = true;
  assistantThinkingIndicator = document.createElement("div");
  assistantThinkingIndicator.className = "message assistant thinking";

  const roleLabel = document.createElement("div");
  roleLabel.className = "role-label";
  roleLabel.textContent = "ASSISTANT";
  assistantThinkingIndicator.appendChild(roleLabel);

  const thinkingText = document.createElement("div");
  thinkingText.className = "thinking-text";
  thinkingText.textContent = currentLanguage === "en" ? "Thinking" : "正在思考";
  assistantThinkingIndicator.appendChild(thinkingText);

  const dotContainer = document.createElement("div");
  dotContainer.className = "thinking-dots";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotContainer.appendChild(dot);
  }

  assistantThinkingIndicator.appendChild(dotContainer);
  chatContainer.appendChild(assistantThinkingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Hide the user thinking indicator
function hideUserThinkingIndicator() {
  waitingForUserTranscription = false;
  if (userThinkingIndicator && userThinkingIndicator.parentNode) {
    userThinkingIndicator.parentNode.removeChild(userThinkingIndicator);
  }
  userThinkingIndicator = null;
}

// Hide the assistant thinking indicator
function hideAssistantThinkingIndicator() {
  waitingForAssistantResponse = false;
  if (assistantThinkingIndicator && assistantThinkingIndicator.parentNode) {
    assistantThinkingIndicator.parentNode.removeChild(
      assistantThinkingIndicator
    );
  }
  assistantThinkingIndicator = null;
}

// EVENT HANDLERS
// --------------

// Handle content start from the server
socket.on("contentStart", (data) => {
  console.log("Content start received:", data);

  if (data.type === "TEXT") {
    // Below update will be enabled when role is moved to the contentStart
    role = data.role;
    if (data.role === "USER") {
      // When user's text content starts, hide user thinking indicator
      hideUserThinkingIndicator();
    } else if (data.role === "ASSISTANT") {
      // When assistant's text content starts, hide assistant thinking indicator
      hideAssistantThinkingIndicator();
      let isSpeculative = false;
      try {
        if (data.additionalModelFields) {
          const additionalFields = JSON.parse(data.additionalModelFields);
          isSpeculative = additionalFields.generationStage === "SPECULATIVE";
          if (isSpeculative) {
            console.log("Received speculative content");
            displayAssistantText = true;
          } else {
            displayAssistantText = false;
          }
        }
      } catch (e) {
        console.error("Error parsing additionalModelFields:", e);
      }
    }
  } else if (data.type === "AUDIO") {
    // When audio content starts, we may need to show user thinking indicator
    if (isStreaming) {
      showUserThinkingIndicator();
    }
  }
});

// Handle text output from the server
socket.on("textOutput", (data) => {
  console.log("Received text output:", data);

  if (role === "USER") {
    // When user text is received, show thinking indicator for assistant response
    transcriptionReceived = true;
    //hideUserThinkingIndicator();

    // Add user message to chat
    handleTextOutput({
      role: data.role,
      content: data.content,
    });

    // Show assistant thinking indicator after user text appears
    showAssistantThinkingIndicator();
  } else if (role === "ASSISTANT") {
    //hideAssistantThinkingIndicator();
    if (displayAssistantText) {
      handleTextOutput({
        role: data.role,
        content: data.content,
      });
    }
  }
});

// Smooth transition function: gradually transition from current value to target value
function smoothTransition(currentVal, targetVal, factor) {
  return currentVal + (targetVal - currentVal) * factor;
}

// Handle audio output
socket.on("audioOutput", (data) => {
  if (data.content) {
    try {
      const audioData = base64ToFloat32Array(data.content);
      audioPlayer.playAudio(audioData);

      // 更新语音历史记录，用于跟踪语音特征变化
      const now = Date.now();
      if (now - lastAudioTimestamp > 30) {
        // 每30ms采样一次
        lastAudioTimestamp = now;

        // 使球体根据AI的音频输出做出更平滑动态的视觉响应
        if (pulsatingOrb) {
          // Calculate audio features
          let sum = 0;
          let peakValue = 0;
          let zeroCrossings = 0;
          let prevSample = 0;
          let energyInBands = [0, 0, 0]; // 低、中、高频段能量
          let segmentLength = Math.floor(audioData.length / 3);

          // Calculate more detailed voice features
          for (let i = 0; i < audioData.length; i++) {
            const absValue = Math.abs(audioData[i]);
            sum += absValue;

            // Find peak value
            if (absValue > peakValue) {
              peakValue = absValue;
            }

            // Calculate zero crossing rate (important metric for voice activity)
            if (
              (audioData[i] >= 0 && prevSample < 0) ||
              (audioData[i] < 0 && prevSample >= 0)
            ) {
              zeroCrossings++;
            }
            prevSample = audioData[i];

            // Divide audio into 3 segments to analyze different frequency features (simplified model)
            const bandIndex = Math.min(2, Math.floor(i / segmentLength));
            energyInBands[bandIndex] += absValue;
          }

          // Normalize energy distribution
          for (let i = 0; i < energyInBands.length; i++) {
            energyInBands[i] = energyInBands[i] / (segmentLength || 1);
          }

          const average = sum / audioData.length;
          // Increase coefficient so small volumes also have visible effect
          const intensity = Math.min(1.0, average * 15);
          const activityFactor = Math.min(
            1.0,
            (zeroCrossings / audioData.length) * 220
          );

          // Save features to history
          if (voiceFrequencyHistory.length > 30) voiceFrequencyHistory.shift();
          voiceFrequencyHistory.push({
            intensity,
            activity: activityFactor,
            peak: peakValue,
            energyBands: [...energyInBands],
            timestamp: now,
          });

          // Target parameter calculation - based on audio features but not directly applied
          // Adjust color target values based on voice activity type
          let targetHue, targetSaturation, targetLightness, targetGlow;
          let targetScale =
            1 +
            Math.min(0.5, intensity * 0.35 + Math.sin(Date.now() / 180) * 0.05);

          // Whether vowel-like (high low-frequency energy) or consonant-like (high high-frequency energy)
          const isVowelLike = energyInBands[0] > energyInBands[2] * 1.5;
          const isConsonantLike = energyInBands[2] > energyInBands[0] * 1.2;

          if (isVowelLike) {
            // Vowel: warm tone (like blue-purple)
            targetHue = 230 + activityFactor * 30;
            targetSaturation = 75 + intensity * 25;
            targetLightness = 50 + intensity * 30;
          } else if (isConsonantLike) {
            // Consonant: cool tone (like cyan)
            targetHue = 160 + activityFactor * 40;
            targetSaturation = 85 + intensity * 15;
            targetLightness = 45 + intensity * 35;
          } else {
            // Default or mixed sound: neutral tone
            targetHue = 190 + activityFactor * 45;
            targetSaturation = 80 + intensity * 20;
            targetLightness = 55 + intensity * 25;
          }

          // Target glow value based on audio activity
          const baseGlow = 70;
          targetGlow =
            baseGlow + Math.min(120, average * 110 + activityFactor * 60);

          // Target opacity
          const targetOpacity = 0.8 + (average / 256) * 0.2;
          const targetInnerGlowOpacity = 0.2 + intensity * 0.5;

          // Dynamically adjust smoothing factor - fast rise, slow fall effect
          // Quick response to sudden sound peaks, but smooth transition back to normal
          const upTransition = 0.3; // Upward transition speed (fast response)
          const downTransition = 0.08; // Downward transition speed (slow decay)

          // Choose different smoothing factors based on change direction
          let hueSmooth =
            Math.abs(targetHue - currentHue) > 30
              ? upTransition
              : smoothingFactor;
          let scaleSmooth =
            targetScale > currentScale ? upTransition : downTransition;
          let glowSmooth =
            targetGlow > currentGlow ? upTransition : downTransition;

          // Smooth transition to target values
          currentHue = smoothTransition(currentHue, targetHue, hueSmooth);
          currentSaturation = smoothTransition(
            currentSaturation,
            targetSaturation,
            smoothingFactor
          );
          currentLightness = smoothTransition(
            currentLightness,
            targetLightness,
            smoothingFactor
          );
          currentGlow = smoothTransition(currentGlow, targetGlow, glowSmooth);
          currentScale = smoothTransition(
            currentScale,
            targetScale,
            scaleSmooth
          );
          currentOpacity = smoothTransition(currentOpacity, targetOpacity, 0.2);
          currentInnerGlowOpacity = smoothTransition(
            currentInnerGlowOpacity,
            targetInnerGlowOpacity,
            0.2
          );

          // Apply visual effects using smoothed values

          // Apply scale effect - smooth transformation without jitter
          let transformStyle = `scale(${currentScale})`;

          // Only add small random displacement when sound intensity is high, but control intensity with smooth values
          if (intensity > 0.25) {
            // Reduce jitter amount and use square root scaling for smoother effect
            const jitterAmount = Math.sqrt(intensity) * 3;
            // Use current time as seed to generate deterministic but seemingly random movement
            const t = Date.now() / 1000;
            const offsetX = Math.sin(t * 4.7) * jitterAmount * 0.5;
            const offsetY = Math.cos(t * 5.3) * jitterAmount * 0.5;
            transformStyle += ` translate(${offsetX}px, ${offsetY}px)`;
          }

          pulsatingOrb.style.transform = transformStyle;
          pulsatingOrb.style.opacity = currentOpacity.toString();

          // Wave effect - using smoothly transitioned intensity
          const voiceWaves = document.querySelector(".voice-waves");
          if (voiceWaves) {
            // Smooth wave opacity
            const waveOpacity = Math.min(0.4 + intensity * 0.6, 1.0);
            voiceWaves.style.opacity = waveOpacity.toString();

            // Dynamically set wave animation speed - based on smooth values
            const animationDuration = Math.max(1, 3 - intensity * 1.5);

            // CSS selector may not work directly here, consider using CSS variables for control
            // Add custom CSS property to control animation
            voiceWaves.style.setProperty(
              "--wave-duration",
              `${animationDuration}s`
            );
          }

          // Voice particle effect - create particles based on smooth intensity values
          const voiceParticles = document.querySelector(".voice-particles");
          if (voiceParticles && intensity > 0.15) {
            const particleOpacity = Math.min(0.6 + intensity * 0.4, 1.0);
            voiceParticles.style.opacity = particleOpacity.toString();

            // Adjust particle creation frequency based on smooth intensity
            // Higher intensity, higher probability of generating particles
            const particleThreshold = 0.7 - intensity * 0.3; // 0.4 - 0.7 range

            // Create or update dynamic particles
            if (intensity > 0.25 && Math.random() > particleThreshold) {
              // Particle size based on smoothed values
              const particleSize = 2 + Math.pow(intensity, 0.7) * 6;
              const particle = document.createElement("div");
              particle.className = "dynamic-particle";

              // Particle color coordinates with orb's overall tone
              let particleOpacity = 0.7 + intensity * 0.3;
              let particleHue = Math.round(
                currentHue + (Math.random() * 40 - 20)
              );

              // Create random path points to make particle movement more natural
              const x1 = (Math.random() - 0.5) * 10;
              const y1 = (Math.random() - 0.5) * 10 - 5;
              const x2 = (Math.random() - 0.5) * 20 - 5;
              const y2 = (Math.random() - 0.5) * 20 - 15;
              const x3 = (Math.random() - 0.5) * 30 - 10;
              const y3 = (Math.random() - 0.5) * 30 - 30;
              const x4 = (Math.random() - 0.5) * 40 - 20;
              const y4 = (Math.random() - 0.5) * 40 - 50;

              particle.style.cssText = `
                position: absolute;
                width: ${particleSize}px;
                height: ${particleSize}px;
                background-color: hsla(${particleHue}, 80%, 75%, ${particleOpacity});
                border-radius: 50%;
                left: ${20 + Math.random() * 60}%;
                top: ${20 + Math.random() * 60}%;
                filter: blur(${particleSize > 4 ? 2 : 1}px);
                pointer-events: none;
                z-index: 2;
                opacity: ${particleOpacity};
                transform: translate(0, 0);
                --x1: ${x1}px;
                --y1: ${y1}px;
                --x2: ${x2}px;
                --y2: ${y2}px;
                --x3: ${x3}px;
                --y3: ${y3}px;
                --x4: ${x4}px;
                --y4: ${y4}px;
                animation: ${
                  Math.random() > 0.5 ? "particleFloat" : "smoothParticleFloat"
                } ${
                2.5 + Math.random() * 2
              }s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
              `;

              voiceParticles.appendChild(particle);

              // Automatically remove particle element
              setTimeout(() => {
                if (voiceParticles.contains(particle)) {
                  // Smooth fade out
                  particle.style.transition = "opacity 0.5s ease-out";
                  particle.style.opacity = "0";

                  setTimeout(() => {
                    if (voiceParticles.contains(particle)) {
                      voiceParticles.removeChild(particle);
                    }
                  }, 500);
                }
              }, 2500);
            }
          }

          // Smoothly apply multi-layer glow effect
          const r = Math.floor(
            currentHue <= 180
              ? 30 + currentHue / 3
              : 30 + (360 - currentHue) / 2
          );
          const g = Math.floor(80 + currentLightness * 0.8);
          const b = Math.floor(120 + currentSaturation * 0.5);

          // Multi-layer glow effect
          pulsatingOrb.style.boxShadow = `
            0 0 ${currentGlow}px hsla(${currentHue}, ${currentSaturation}%, ${currentLightness}%, 0.9),
            0 0 ${currentGlow * 1.8}px hsla(${currentHue - 20}, ${
            currentSaturation - 10
          }%, ${currentLightness - 10}%, 0.7),
            0 0 ${currentGlow * 2.5}px hsla(${currentHue - 40}, ${
            currentSaturation - 20
          }%, ${currentLightness - 20}%, 0.5),
            inset 0 0 ${30 + currentGlow / 3}px rgba(255, 255, 255, ${
            0.4 + intensity * 0.4
          })
          `;

          // Update gradient background using smoothly transitioned color values
          pulsatingOrb.style.background = `radial-gradient(
            circle, 
            hsla(${currentHue + 20}, ${currentSaturation}%, ${
            currentLightness + 10
          }%, 0.9) 0%,
            hsla(${currentHue}, ${currentSaturation}%, ${
            currentLightness - 5
          }%, 0.7) 60%,
            hsla(${currentHue - 20}, ${currentSaturation - 10}%, ${
            currentLightness - 15
          }%, 0.6) 100%
          )`;

          // Set inner glow light-dark contrast
          const innerGlow = document.querySelector(".inner-glow");
          if (innerGlow) {
            innerGlow.style.opacity = currentInnerGlowOpacity.toString();
          }
        }
      }
    } catch (error) {
      console.error("Error processing audio data:", error);
    }
  }
});

// Handle content end events
socket.on("contentEnd", (data) => {
  console.log("Content end received:", data);

  if (data.type === "TEXT") {
    if (role === "USER") {
      // When user's text content ends, make sure assistant thinking is shown
      hideUserThinkingIndicator();
      showAssistantThinkingIndicator();
    } else if (role === "ASSISTANT") {
      // When assistant's text content ends, prepare for user input in next turn
      hideAssistantThinkingIndicator();
    }

    // Handle stop reasons
    if (data.stopReason && data.stopReason.toUpperCase() === "END_TURN") {
      chatHistoryManager.endTurn();
    } else if (
      data.stopReason &&
      data.stopReason.toUpperCase() === "INTERRUPTED"
    ) {
      console.log("Interrupted by user");
      audioPlayer.bargeIn();
    }
  } else if (data.type === "AUDIO") {
    // When audio content ends, we may need to show user thinking indicator
    if (isStreaming) {
      showUserThinkingIndicator();
    }
  }
});

// Stream completion event
socket.on("streamComplete", () => {
  if (isStreaming) {
    stopStreaming();
  }
  statusElement.textContent = "Ready";
  statusElement.className = "ready";

  // Ensure session state is reset to prevent client state desync after server closes session
  sessionInitialized = false;
});

// Handle microphone permission request
async function handleRequestPermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    micPermissionError = false;
    // Refresh page to reinitialize audio
    window.location.reload();
  } catch (error) {
    console.error("Microphone permission request denied:", error);
    micPermissionError = true;
    statusElement.textContent =
      "Microphone permission denied. Please enable microphone access in browser settings.";
    statusElement.className = "error";
  }
}

// Handle connection status updates
socket.on("connect", () => {
  statusElement.textContent = "Connected to server";
  statusElement.className = "connected";
  sessionInitialized = false;
});

socket.on("disconnect", () => {
  statusElement.textContent = "Disconnected";
  statusElement.className = "disconnected";
  startButton.disabled = true;
  stopButton.disabled = true;
  sessionInitialized = false;
  hideUserThinkingIndicator();
  hideAssistantThinkingIndicator();
  stopAudioVisualization();
});

// Handle errors
socket.on("error", (error) => {
  console.error("Server error:", error);
  statusElement.textContent =
    "Error: " + (error.message || JSON.stringify(error).substring(0, 100));
  statusElement.className = "error";
  hideUserThinkingIndicator();
  hideAssistantThinkingIndicator();
});

// Button event listeners
startButton.addEventListener("click", toggleMute);
stopButton.addEventListener("click", toggleConversation);

// Text button to show/hide conversation
textButton.addEventListener("click", () => {
  isChatVisible = !isChatVisible;

  // Update text button style
  textButton.style.backgroundColor = isChatVisible ? "#4cd964" : "#ff3b30"; // Green or red

  // Show or hide chat container
  if (isChatVisible) {
    chatContainer.style.display = "block";
    updateChatUI(); // Update chat interface
  } else {
    chatContainer.style.display = "none";
  }
});

// Initialize page display with dark theme
document.body.style.backgroundColor = "#000000";
document.body.style.color = "#FFFFFF";

// Load MCP server information
async function loadMcpServers() {
  const mcpServersContainer = document.getElementById("mcp-servers-container");

  try {
    // Send request to get MCP server information
    const response = await fetch("/api/mcp-servers");

    if (response.ok) {
      const mcpServers = await response.json();

      // Clear container
      mcpServersContainer.innerHTML = "";

      if (Object.keys(mcpServers).length === 0) {
        mcpServersContainer.innerHTML = "<p>No MCP servers configured</p>";
        return;
      }

      // Iterate through server information and create UI
      Object.entries(mcpServers).forEach(([serverName, serverInfo]) => {
        const serverElement = document.createElement("div");
        serverElement.className = "mcp-server";

        // Create server header row
        const serverHeader = document.createElement("div");
        serverHeader.className = "mcp-server-header";

        const nameElement = document.createElement("div");
        nameElement.className = "mcp-server-name";
        nameElement.textContent = serverName;

        const statusElement = document.createElement("div");
        statusElement.className = serverInfo.disabled
          ? "mcp-server-status disabled"
          : "mcp-server-status";
        statusElement.textContent = serverInfo.disabled ? "Disabled" : "Enabled";

        serverHeader.appendChild(nameElement);
        serverHeader.appendChild(statusElement);
        serverElement.appendChild(serverHeader);

        // Server basic information
        const infoElement = document.createElement("div");
        infoElement.innerHTML = '';  // Clear current content
        const commandDiv = document.createElement('div');
        const commandText = document.createTextNode(`Command: ${serverInfo.command}`);
        commandDiv.appendChild(commandText);
        infoElement.appendChild(commandDiv);

        const argsDiv = document.createElement('div');
        const argsText = document.createTextNode(`Arguments: ${serverInfo.args.join(", ")}`);
        argsDiv.appendChild(argsText);
        infoElement.appendChild(argsDiv);
        
        serverElement.appendChild(infoElement);

        // Tool information
        if (serverInfo.tools && serverInfo.tools.length > 0) {
          const toolsTitle = document.createElement("div");
          toolsTitle.className = "mcp-tools-title collapsed";
          toolsTitle.textContent = `Available Tools (${serverInfo.tools.length})`;
          serverElement.appendChild(toolsTitle);

          const toolsList = document.createElement("div");
          toolsList.className = "mcp-tools-list";
          toolsList.style.display = "none"; // Default collapsed

          // Add tool list content
          serverInfo.tools.forEach((tool) => {
            const toolElement = document.createElement("div");
            toolElement.className = "mcp-tool";

            const toolName = document.createElement("div");
            toolName.className = "mcp-tool-name";
            toolName.textContent = tool.name;

            const toolDesc = document.createElement("div");
            toolDesc.className = "mcp-tool-description";
            toolDesc.textContent = tool.description || "No description";

            toolElement.appendChild(toolName);
            toolElement.appendChild(toolDesc);
            toolsList.appendChild(toolElement);
          });

          serverElement.appendChild(toolsList);

          // Add click event to toggle expand/collapse state
          toolsTitle.addEventListener("click", () => {
            const isCollapsed = toolsTitle.classList.contains("collapsed");

            // Toggle style and display state
            if (isCollapsed) {
              toolsTitle.classList.remove("collapsed");
              toolsList.style.display = "block";
            } else {
              toolsTitle.classList.add("collapsed");
              toolsList.style.display = "none";
            }
          });
        } else {
          const noTools = document.createElement("div");
          noTools.className = "mcp-server-info";
          noTools.textContent = "No tools provided by this server";
          serverElement.appendChild(noTools);
        }

        mcpServersContainer.appendChild(serverElement);
      });
    } else {
      mcpServersContainer.innerHTML = "<p>Failed to load MCP server information</p>";
    }
  } catch (error) {
    console.error("Failed to load MCP server information:", error);
    mcpServersContainer.innerHTML = "<p>Error loading MCP server information</p>";
  }
}

// Initialize the app when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initAudio();
  initConfigModal();
  initVoiceDropdown(); // Initialize voice selection dropdown

  // Set text button initial style
  textButton.style.backgroundColor = "#4cd964"; // Green, indicates chat is visible
});
