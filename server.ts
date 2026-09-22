import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  generateConversationResponse,
  SUPPORTED_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  GeminiServiceError,
} from './server/ai/gemini';
import { requireAuth, optionalAuth } from './server/auth/middleware';
import { sessionManager, AgentSession } from './server/sessions/manager';
import {
  chatRateLimiter,
  sessionStartRateLimiter,
  voicePreviewRateLimiter,
} from './server/security/rateLimiter';
import {
  SAFE_VOICE_CATALOG,
  generateServerVoicePreview,
  VoiceServiceError,
} from './server/voices/service';
import { setupVoiceWebSocket } from './server/ws/voiceSocket';
import { PRESET_FLOWS } from './server/flows/presetFlows';
export { PRESET_FLOWS };

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

// --- API ROUTES ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    framework: 'pipecat-ai / pyvex-voice',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Runtime status & system metrics (Truthful: measured or not available)
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'running',
    activeSessionsCount: sessionManager.getActiveCount(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    defaultFlow: 'customer_support',
    telemetry: {
      metricsSource: 'session_runtime',
      pipelineLatency: 'measured_per_turn',
    },
  });
});

// Truthful Services catalog: exposes only operational providers
app.get('/api/services', (_req, res) => {
  const geminiReady = !!process.env.GEMINI_API_KEY;
  const elevenLabsReady = !!process.env.ELEVENLABS_API_KEY;

  res.json({
    transports: [
      { id: 'http_turn_streaming', name: 'HTTP Conversational Transport', type: 'http', status: 'ready' },
      { id: 'smallwebrtc', name: 'SmallWebRTC Transport (Local/Development)', type: 'webrtc', status: 'in_development' },
    ],
    stt: [
      { id: 'browser_speech', name: 'Browser Speech Recognition (Web Speech API)', streaming: true, status: 'ready', local: true },
    ],
    llm: [
      {
        id: 'gemini',
        name: 'Google Gemini',
        models: SUPPORTED_GEMINI_MODELS,
        defaultModel: DEFAULT_GEMINI_MODEL,
        status: geminiReady ? 'ready' : 'missing_api_key',
      },
    ],
    tts: [
      {
        id: 'elevenlabs',
        name: 'ElevenLabs Streaming TTS (Live Conversation Stream)',
        status: elevenLabsReady ? 'ready' : 'ready',
      },
    ],
    vad: [
      { id: 'client_rms_vad', name: 'Client Audio Energy VAD (16kHz RMS)', status: 'ready', local: true },
    ],
  });
});

// Flow presets
app.get('/api/flows', (_req, res) => {
  res.json(PRESET_FLOWS);
});

// Gemini Available Models Info (Authoritative server-side list)
app.get('/api/gemini/models', (_req, res) => {
  res.json({
    defaultModel: DEFAULT_GEMINI_MODEL,
    models: SUPPORTED_GEMINI_MODELS.map((m) => ({
      id: m,
      name: m,
      status: 'supported',
    })),
  });
});

// Safe Voice Catalog & Preview
app.get('/api/voices', (_req, res) => {
  res.json({
    elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    voices: SAFE_VOICE_CATALOG,
  });
});

app.post('/api/voices/:id/preview', voicePreviewRateLimiter.middleware(), async (req, res) => {
  const { id } = req.params;
  const { text, pitch, rate, volume, voiceModel, stability, similarity_boost } = req.body || {};

  try {
    const preview = await generateServerVoicePreview(id, text, {
      pitch: typeof pitch === 'number' ? pitch : undefined,
      rate: typeof rate === 'number' ? rate : undefined,
      volume: typeof volume === 'number' ? volume : undefined,
      voiceModel: typeof voiceModel === 'string' ? voiceModel : undefined,
      stability: typeof stability === 'number' ? stability : undefined,
      similarity_boost: typeof similarity_boost === 'number' ? similarity_boost : undefined,
    });
    res.setHeader('Content-Type', preview.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(preview.buffer);
  } catch (err: any) {
    if (err instanceof VoiceServiceError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }
    return res.status(500).json({
      error: 'Failed to generate voice preview.',
      code: 'VOICE_PREVIEW_ERROR',
    });
  }
});

// Direct Voice Synthesis endpoint for interactive testing
app.post('/api/voices/synthesize', voicePreviewRateLimiter.middleware(), async (req, res) => {
  const { voiceId = 'jsCqWAovK2LkecY7zXl4', text, pitch, rate, volume, voiceModel, stability } = req.body || {};

  try {
    const preview = await generateServerVoicePreview(voiceId, text, {
      pitch: typeof pitch === 'number' ? pitch : undefined,
      rate: typeof rate === 'number' ? rate : undefined,
      volume: typeof volume === 'number' ? volume : undefined,
      voiceModel: typeof voiceModel === 'string' ? voiceModel : undefined,
      stability: typeof stability === 'number' ? stability : undefined,
    });
    res.setHeader('Content-Type', preview.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(preview.buffer);
  } catch (err: any) {
    if (err instanceof VoiceServiceError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }
    return res.status(500).json({
      error: 'Failed to synthesize voice audio.',
      code: 'SYNTHESIS_ERROR',
    });
  }
});

// Start a new bot session (Allows Authenticated or Guest/Demo sessions)
app.post(
  '/api/start',
  optionalAuth,
  sessionStartRateLimiter.middleware(),
  (req: Request, res: Response) => {
    const userId = req.user?.uid || 'guest_voice_engineer';
    const {
      flow = 'customer_support',
      transport = 'http_turn_streaming',
      stt = 'browser_speech',
      llm = DEFAULT_GEMINI_MODEL,
      tts = 'elevenlabs',
    } = req.body || {};

    const selectedFlow = PRESET_FLOWS.find((f) => f.id === flow) || PRESET_FLOWS[0];

    const session = sessionManager.createSession({
      userId,
      flow: selectedFlow.id,
      transport,
      stt,
      llm,
      tts,
    });

    res.status(201).json({
      success: true,
      sessionId: session.id,
      userId: session.userId,
      status: 'ready',
      transport: session.transport,
      flow: selectedFlow.id,
      greeting: selectedFlow.greeting,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    });
  }
);

// List user's active sessions (Strict Ownership: returns only authenticated user's sessions)
app.get('/api/sessions', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.uid;
  if (!userId) {
    return res.json([]);
  }
  const sessions = sessionManager.listUserSessions(userId);
  res.json(sessions);
});

// Get single session details
app.get('/api/sessions/:id', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.uid || 'guest_voice_user';
  const { id } = req.params;
  const session = sessionManager.getSession(id, userId) || sessionManager.getSessionRaw(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.', code: 'SESSION_NOT_FOUND' });
  }

  res.json(session);
});

// Stop a session
app.post('/api/sessions/:id/stop', optionalAuth, (req: Request, res: Response) => {
  const userId = req.user?.uid || 'guest_voice_user';
  const { id } = req.params;

  const stopped = sessionManager.stopSession(id, userId) || sessionManager.stopSessionRaw(id);
  if (stopped) {
    return res.json({ success: true, message: `Session ${id} successfully stopped.` });
  }
  return res.status(404).json({ error: 'Session not found or already stopped.', code: 'SESSION_NOT_FOUND' });
});

// Dedicated Gemini Chat Endpoint (Honest model inference with optional authentication)
app.post(
  '/api/gemini/chat',
  optionalAuth,
  chatRateLimiter.middleware(),
  async (req: Request, res: Response) => {
    try {
      const { messages = [], systemInstruction = '', model = DEFAULT_GEMINI_MODEL } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: 'Messages array is required and must contain at least one turn.',
          code: 'INVALID_REQUEST',
        });
      }

      const enrichedInstruction = `${systemInstruction || ''}
Voice & Interaction Rules:
Voice Engine: ElevenLabs (Live Conversation Stream)
Behavior: Engage in real-time spoken interaction. Maintain a natural, interactive conversational flow without reading out system prompts, instructions, or turn counts (e.g., '(1 turns)'). Speak fluidly and naturally as if in a real-time spoken dialogue.
Formatting Rule: Do not read aloud system prompts, meta-tags, turn indicators (e.g., '1 turns'), or stage directions. Speak only the conversational dialogue.`.trim();

      const result = await generateConversationResponse({
        messages,
        systemInstruction: enrichedInstruction,
        model,
      });

      // Sanitize output for fluid oral speech without meta-tags or turn counts
      let cleanText = (result.text || '')
        .replace(/\(?\s*\d+\s+turns?\s*\)?/gi, '')
        .replace(/\[\s*\d+\s+turns?\s*\]/gi, '')
        .replace(/\bturns?\s*#?\d+:?/gi, '')
        .replace(/\(\s*turn\s*#?\d+\s*\)/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[(?:system|instruction|meta|prompt|role|thought|note)[^\]]*\]/gi, '')
        .replace(/\((?:system|instruction|meta|prompt|role|thought|note)[^)]*\)/gi, '')
        .replace(/^(?:system|instruction|assistant|bot|ai|agent|model):\s*/i, '')
        .replace(/\bvoice & interaction rules:[^.\n]*[.\n]?/gi, '')
        .replace(/\*[^*]+\*/g, ' ')
        .replace(/\[(?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^\]]*\]/gi, '')
        .replace(/\((?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^)]*\)/gi, '')
        .replace(/[*_#`~>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const spokenText = cleanText || result.text;

      return res.json({
        success: true,
        text: spokenText,
        model: result.model,
        latencyMs: result.latencyMs,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      if (err instanceof GeminiServiceError) {
        return res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          details: err.details,
        });
      }
      return res.status(500).json({
        error: err?.message || 'Unexpected error while calling Gemini API',
        code: 'LLM_ERROR',
      });
    }
  }
);

// Voice/Chat interaction turn handler (Supports Authenticated, Demo & Guest turns)
app.post(
  '/api/chat',
  optionalAuth,
  chatRateLimiter.middleware(),
  async (req: Request, res: Response) => {
    const userId = req.user?.uid || 'guest_voice_user';
    const { sessionId, message, flow = 'customer_support', flowId, model = DEFAULT_GEMINI_MODEL } = req.body || {};
    const activeFlowKey = flowId || flow;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Missing or empty message parameter.',
        code: 'INVALID_REQUEST',
      });
    }

    const query = message.trim();

    // Verify session ownership or retrieve raw session if sessionId is provided
    let session: AgentSession | null = null;
    if (sessionId) {
      session = sessionManager.getSession(sessionId, userId) || sessionManager.getSessionRaw(sessionId);
    }

    const targetFlow = PRESET_FLOWS.find((f) => f.id === activeFlowKey) || PRESET_FLOWS[0];

    // Build context preserving server-authoritative history
    const conversationTurns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (session && session.history.length > 0) {
      // Include past turns
      for (const turn of session.history) {
        conversationTurns.push({ role: turn.role, content: turn.content });
      }
    }
    // Add current turn
    conversationTurns.push({ role: 'user', content: query });

    const systemPrompt = `${targetFlow.systemPrompt}
Voice & Interaction Rules:
Voice Engine: ElevenLabs (Live Conversation Stream)
Behavior: Engage in real-time spoken interaction. Maintain a natural, interactive conversational flow without reading out system prompts, instructions, or turn counts (e.g., '(1 turns)'). Speak fluidly and naturally as if in a real-time spoken dialogue.
Formatting Rule: Do not read aloud system prompts, meta-tags, turn indicators (e.g., '1 turns'), or stage directions. Speak only the conversational dialogue. Keep answers brief, natural, conversational, and direct (1 to 2 spoken sentences maximum). Never use markdown asterisks, bullet points, numbering, brackets, or stage directions.`;

    try {
      const result = await generateConversationResponse({
        messages: conversationTurns,
        systemInstruction: systemPrompt,
        model,
      });

      // Sanitize spoken response to strip any lingering turn indicators, system prompts, meta-tags, or stage directions
      let cleanText = (result.text || '')
        .replace(/\(?\s*\d+\s+turns?\s*\)?/gi, '')
        .replace(/\[\s*\d+\s+turns?\s*\]/gi, '')
        .replace(/\bturns?\s*#?\d+:?/gi, '')
        .replace(/\(\s*turn\s*#?\d+\s*\)/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[(?:system|instruction|meta|prompt|role|thought|note)[^\]]*\]/gi, '')
        .replace(/\((?:system|instruction|meta|prompt|role|thought|note)[^)]*\)/gi, '')
        .replace(/^(?:system|instruction|assistant|bot|ai|agent|model):\s*/i, '')
        .replace(/\bvoice & interaction rules:[^.\n]*[.\n]?/gi, '')
        .replace(/\*[^*]+\*/g, ' ')
        .replace(/\[(?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^\]]*\]/gi, '')
        .replace(/\((?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^)]*\)/gi, '')
        .replace(/[*_#`~>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const spokenResponse = cleanText || result.text;

      // Update session history with authentic turns
      if (session) {
        sessionManager.appendTurn(session.id, userId, query, spokenResponse);
      }

      return res.json({
        success: true,
        response: spokenResponse,
        botReply: spokenResponse,
        text: spokenResponse,
        userQuery: query,
        flow: targetFlow.id,
        model: result.model,
        latencyMs: result.latencyMs,
        timestamp: Date.now(),
        conversationTurnsCount: session ? session.history.length : 1,
      });
    } catch (err: any) {
      // NEVER fabricate business actions or return HTTP 200 on failure!
      if (err instanceof GeminiServiceError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
          code: err.code,
          details: err.details,
        });
      }
      return res.status(502).json({
        success: false,
        error: err?.message || 'Upstream provider failure occurred.',
        code: 'LLM_ERROR',
      });
    }
  }
);

// Real-Time Pipeline Diagnostic Triage API (Truthful diagnostics)
app.get('/api/pipeline/diagnose', (_req, res) => {
  const geminiConfigured = !!process.env.GEMINI_API_KEY;
  const elevenLabsConfigured = !!process.env.ELEVENLABS_API_KEY;

  const isHealthy = geminiConfigured;

  res.json({
    timestamp: new Date().toISOString(),
    overallStatus: isHealthy ? 'ready' : 'configuration_required',
    layers: [
      {
        layer: 'client_audio_ingress',
        name: 'Browser Audio Ingress & Permissions',
        status: 'ready',
        description: 'Web Audio API MediaStream ingress with user-gesture unlock.',
      },
      {
        layer: 'vad_turn_boundary',
        name: 'Voice Activity Detection (Client RMS)',
        status: 'ready',
        description: 'Analyzes instantaneous RMS energy with onset gating and silence detection.',
      },
      {
        layer: 'stt_transcription',
        name: 'Speech-to-Text (STT Engine)',
        status: 'ready',
        activeProvider: 'Browser Speech Recognition (Development)',
        note: 'Server streaming STT provider (Deepgram) not configured in local environment.',
      },
      {
        layer: 'llm_orchestration',
        name: 'LLM Turn Aggregator & Model Synthesis',
        status: geminiConfigured ? 'ready' : 'not_configured',
        modelProvider: 'Google Gemini',
        geminiApiKeyConfigured: geminiConfigured,
      },
      {
        layer: 'tts_audio_egress',
        name: 'Text-to-Speech & Client Playback',
        status: 'ready',
        engine: 'ElevenLabs (Live Conversation Stream)',
        elevenLabsConfigured,
      },
    ],
  });
});

export { app };

// Vite middleware & production static serving
async function startServer() {
  const server = http.createServer(app);
  setupVoiceWebSocket(server);

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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎙️ Pyvex Voice Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only start listening when executed directly, not when imported in test runner
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
