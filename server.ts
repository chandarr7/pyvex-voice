import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory store for active sessions
interface AgentSession {
  id: string;
  flow: string;
  transport: string;
  sttService: string;
  llmService: string;
  ttsService: string;
  createdAt: number;
  status: 'initializing' | 'active' | 'idle' | 'stopped';
  messageCount: number;
}

const activeSessions = new Map<string, AgentSession>();

// Predefined services catalog matching Pipecat's ecosystem
const SERVICES_CATALOG = {
  transports: [
    { id: 'smallwebrtc', name: 'SmallWebRTC', type: 'webrtc', description: 'Lightweight peer-to-peer WebRTC transport' },
    { id: 'daily', name: 'Daily WebRTC', type: 'webrtc', description: 'Enterprise-grade ultra-low latency WebRTC room' },
    { id: 'websocket', name: 'WebSocket Server', type: 'websocket', description: 'Direct duplex audio/json streaming transport' },
  ],
  stt: [
    { id: 'deepgram', name: 'Deepgram Nova-2', latency: '120ms', streaming: true },
    { id: 'whisper', name: 'OpenAI Whisper', latency: '280ms', streaming: true },
    { id: 'cartesia-stt', name: 'Cartesia Listen', latency: '90ms', streaming: true },
    { id: 'google-stt', name: 'Google Cloud Speech', latency: '150ms', streaming: true },
    { id: 'assemblyai', name: 'AssemblyAI Streaming', latency: '180ms', streaming: true },
  ],
  llm: [
    { id: 'gemini-flash', name: 'Google Gemini 2.5 Flash', latency: '180ms', contextWindow: '1M tokens' },
    { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini', latency: '210ms', contextWindow: '128k tokens' },
    { id: 'claude-3-5-haiku', name: 'Anthropic Claude 3.5 Haiku', latency: '240ms', contextWindow: '200k tokens' },
    { id: 'groq-llama', name: 'Groq Llama 3.3 70B', latency: '95ms', contextWindow: '128k tokens' },
  ],
  tts: [
    { id: 'cartesia-sonic', name: 'Cartesia Sonic', latency: '90ms', voice: 'British Lady / American Male' },
    { id: 'elevenlabs', name: 'ElevenLabs Flash v2.5', latency: '140ms', voice: 'Rachel / Adam' },
    { id: 'openai-tts', name: 'OpenAI Alloy', latency: '230ms', voice: 'Alloy / Echo / Nova' },
    { id: 'deepgram-aura', name: 'Deepgram Aura', latency: '110ms', voice: 'Asteria / Helios' },
  ],
  vad: [
    { id: 'silero', name: 'Silero VAD v5 (ONNX)', latency: '30ms', local: true },
    { id: 'smart-turn', name: 'SmartTurn v3.2 End-of-Turn Analyzer', latency: '45ms', local: true },
  ]
};

// Preset bot personas / conversation flows from Pipecat examples
const PRESET_FLOWS = [
  {
    id: 'customer_support',
    name: 'Customer Support Concierge',
    description: 'Friendly agent resolving account inquiries, billing details, and service issues.',
    greeting: "Hello! Thanks for reaching out to Pyvex Support. How can I help you today?",
    systemPrompt: "You are a courteous, efficient customer support concierge. Keep answers concise, clear, and vocal-friendly.",
    suggestedPrompts: [
      "Can you check the status of my order #4829?",
      "I'd like to update my billing payment method.",
      "How do I upgrade my subscription plan?"
    ]
  },
  {
    id: 'food_ordering',
    name: 'QuickBite Pizza & Food Order',
    description: 'Conversational order assistant tracking toppings, crust, drinks, and checkout total.',
    greeting: "Welcome to QuickBite! Are you in the mood for a fresh pizza, sides, or drinks today?",
    systemPrompt: "You are an upbeat pizza ordering assistant. Confirm sizes, toppings, and delivery details succinctly.",
    suggestedPrompts: [
      "I'd like a large pepperoni pizza with extra cheese.",
      "Add two garlic dips and a cold Coke.",
      "What's my current total and delivery estimate?"
    ]
  },
  {
    id: 'patient_intake',
    name: 'Healthcare Patient Intake',
    description: 'Compassionate medical intake assistant collecting symptoms and scheduling appointments.',
    greeting: "Hello, welcome to HealthCare Clinic intake. How can we care for you today?",
    systemPrompt: "You are an empathetic medical intake assistant. Collect symptoms politely without providing diagnoses.",
    suggestedPrompts: [
      "I need to schedule a follow-up appointment for next Tuesday.",
      "I've had a mild cough and headache for two days.",
      "Could you confirm if my insurance is on file?"
    ]
  },
  {
    id: 'tech_interview',
    name: 'Technical Mock Interviewer',
    description: 'Senior software engineering interviewer conducting system design and coding discussions.',
    greeting: "Welcome! Today we will discuss distributed system architecture. Whenever you're ready, let me know!",
    systemPrompt: "You are a senior tech interviewer. Ask probing questions, evaluate trade-offs, and encourage structured thinking.",
    suggestedPrompts: [
      "Let's design a real-time voice streaming pipeline.",
      "How would you handle user interruptions during speech synthesis?",
      "Can we discuss WebRTC vs WebSocket latency trade-offs?"
    ]
  }
];

// --- API ROUTES ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    framework: 'pipecat-ai / pyvex-voice',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Runtime status & system metrics
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'running',
    activeSessionsCount: activeSessions.size,
    availableTransports: SERVICES_CATALOG.transports.map(t => t.id),
    defaultFlow: 'customer_support',
    framePipelineStats: {
      averageSttLatencyMs: 118,
      averageLlmTtftMs: 195,
      averageTtsLatencyMs: 102,
      totalPipelineRoundtripMs: 415,
      framesProcessed: 1420 + Math.floor(process.uptime() * 5),
    }
  });
});

// Services catalog
app.get('/api/services', (_req, res) => {
  res.json(SERVICES_CATALOG);
});

// Flow presets
app.get('/api/flows', (_req, res) => {
  res.json(PRESET_FLOWS);
});

// Start a new bot session
app.post('/api/start', (req, res) => {
  const {
    flow = 'customer_support',
    transport = 'smallwebrtc',
    stt = 'deepgram',
    llm = 'gemini-flash',
    tts = 'cartesia-sonic',
  } = req.body || {};

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const selectedFlow = PRESET_FLOWS.find(f => f.id === flow) || PRESET_FLOWS[0];

  const newSession: AgentSession = {
    id: sessionId,
    flow: selectedFlow.id,
    transport,
    sttService: stt,
    llmService: llm,
    ttsService: tts,
    createdAt: Date.now(),
    status: 'active',
    messageCount: 1,
  };

  activeSessions.set(sessionId, newSession);

  res.json({
    success: true,
    sessionId,
    status: 'ready',
    transport,
    greeting: selectedFlow.greeting,
    roomUrl: transport === 'daily' ? `https://pyvex.daily.co/${sessionId}` : null,
    wsUrl: transport === 'websocket' ? `wss://${req.headers.host || 'localhost:3000'}/ws/${sessionId}` : null,
    offer: transport === 'smallwebrtc' ? { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=Pipecat\r\n' } : null,
    session: newSession,
  });
});

// List active sessions
app.get('/api/sessions', (_req, res) => {
  res.json(Array.from(activeSessions.values()));
});

// Stop a session
app.post('/api/sessions/:id/stop', (req, res) => {
  const { id } = req.params;
  const session = activeSessions.get(id);
  if (session) {
    session.status = 'stopped';
    activeSessions.delete(id);
    return res.json({ success: true, message: `Session ${id} closed.` });
  }
  res.status(404).json({ error: 'Session not found' });
});

// Chat / Voice interaction turn handler
app.post('/api/chat', async (req, res) => {
  const { sessionId, message, flowId = 'customer_support' } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing message parameter' });
  }

  const session = sessionId ? activeSessions.get(sessionId) : null;
  if (session) {
    session.messageCount += 1;
  }

  const targetFlow = PRESET_FLOWS.find(f => f.id === flowId) || PRESET_FLOWS[0];
  const query = message.trim();

  // Generate contextual AI response
  let replyText = '';
  const lower = query.toLowerCase();

  if (targetFlow.id === 'food_ordering') {
    if (lower.includes('pepperoni') || lower.includes('pizza')) {
      replyText = "Got it! Large pepperoni pizza with extra mozzarella added to your order. Would you like thin crust or traditional?";
    } else if (lower.includes('total') || lower.includes('bill') || lower.includes('price')) {
      replyText = "Your current order total is $23.50 including tax. Estimated delivery time is approximately 25 minutes!";
    } else if (lower.includes('drink') || lower.includes('coke') || lower.includes('garlic')) {
      replyText = "I've added cold beverages and garlic dips to your cart. Anything else before checkout?";
    } else {
      replyText = `Understood: "${query}". I've noted that for your order. Would you like to add any drinks or desserts with that?`;
    }
  } else if (targetFlow.id === 'patient_intake') {
    if (lower.includes('appointment') || lower.includes('schedule') || lower.includes('tuesday')) {
      replyText = "I've reserved Tuesday at 10:30 AM with Dr. Ramirez for you. A calendar confirmation has been prepared.";
    } else if (lower.includes('cough') || lower.includes('headache') || lower.includes('symptom')) {
      replyText = "I've recorded your symptoms. Have you experienced any fever or difficulty breathing along with the cough?";
    } else {
      replyText = `Thank you for providing that detail. Our medical triage team has received your note: "${query}".`;
    }
  } else if (targetFlow.id === 'tech_interview') {
    if (lower.includes('pipeline') || lower.includes('voice') || lower.includes('webrtc')) {
      replyText = "Great topic. In a real-time voice pipeline, how do you handle user interruptions when the TTS frame queue is currently streaming audio packets downstream?";
    } else if (lower.includes('interruption') || lower.includes('vad')) {
      replyText = "Exactly. Broadcaster InterruptionFrames must flush downstream queues while immediately cutting off audio output to maintain natural turn-taking latency.";
    } else {
      replyText = `Good observation. Let's dig deeper: how would you optimize memory buffers and jitter when scaling this architecture to ten thousand concurrent calls?`;
    }
  } else {
    // Customer support
    if (lower.includes('order') || lower.includes('status')) {
      replyText = "Order #4829 has been processed and is out for delivery with FedEx. Tracking indicates arrival tomorrow by 2:00 PM.";
    } else if (lower.includes('billing') || lower.includes('payment') || lower.includes('card')) {
      replyText = "I can help update your payment method. You can securely enter your updated card details in your account billing portal.";
    } else if (lower.includes('plan') || lower.includes('upgrade') || lower.includes('subscription')) {
      replyText = "The Pro tier includes unlimited voice pipeline minutes, priority audio transcoding, and multi-agent coordination. Would you like me to apply this change?";
    } else {
      replyText = `I hear you regarding "${query}". I'm actively handling that for you right now—is there any specific detail you'd like me to double-check?`;
    }
  }

  // Simulated frame metrics
  const metrics = {
    vadDurationMs: Math.floor(Math.random() * 15 + 25),
    sttDurationMs: Math.floor(Math.random() * 40 + 95),
    llmTtftMs: Math.floor(Math.random() * 50 + 160),
    ttsDurationMs: Math.floor(Math.random() * 30 + 85),
    totalLatencyMs: Math.floor(Math.random() * 70 + 380),
  };

  res.json({
    success: true,
    userQuery: query,
    botReply: replyText,
    flow: targetFlow.id,
    timestamp: Date.now(),
    metrics,
    framesEmitted: [
      { type: 'UserStartedSpeakingFrame', timestamp: Date.now() - 600 },
      { type: 'TranscriptionFrame', text: query, isFinal: true, timestamp: Date.now() - 400 },
      { type: 'UserStoppedSpeakingFrame', timestamp: Date.now() - 350 },
      { type: 'LLMFullResponseStartFrame', timestamp: Date.now() - 200 },
      { type: 'TTSAudioFrame', sampleRate: 24000, channels: 1, timestamp: Date.now() }
    ]
  });
});

// Vite middleware & production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎙️ Pyvex Voice / Pipecat Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
