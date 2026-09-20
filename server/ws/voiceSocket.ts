import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { generateConversationResponse } from '../ai/gemini';
import { PRESET_FLOWS } from '../flows/presetFlows';

interface ClientVoiceConfig {
  voiceId: string;
  pitch: number; // -10.0 to +10.0 or 0.5 to 2.0
  rate: number; // 0.5x to 2.0x
  volume: number; // 0.0 to 1.0
  noiseSuppression: boolean;
  latencyThresholdMs: number;
  voiceModel?: string;
}

interface SocketSessionState {
  sessionId: string;
  flow: string;
  systemInstruction?: string;
  voiceConfig: ClientVoiceConfig;
  history: Array<{ role: 'user' | 'model'; content: string }>;
  state: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
}

export function setupVoiceWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/api/ws/voice' });

  wss.on('connection', (ws: WebSocket) => {
    const sessionId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const session: SocketSessionState = {
      sessionId,
      flow: 'customer_support',
      voiceConfig: {
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah (Default)
        pitch: 0,
        rate: 1.0,
        volume: 1.0,
        noiseSuppression: true,
        latencyThresholdMs: 250,
        voiceModel: 'eleven_turbo_v2_5',
      },
      history: [],
      state: 'IDLE',
    };

    const sendJson = (payload: Record<string, any>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    // Send initial handshake
    sendJson({
      type: 'connection_ready',
      sessionId,
      state: 'IDLE',
      voiceConfig: session.voiceConfig,
      timestamp: Date.now(),
    });

    ws.on('message', async (raw: string | Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        const { type } = data;

        switch (type) {
          case 'ping': {
            sendJson({
              type: 'pong',
              clientTime: data.clientTime,
              serverTime: Date.now(),
            });
            break;
          }

          case 'start_session': {
            if (data.flow) {
              session.flow = data.flow;
            }
            if (data.voiceConfig) {
              session.voiceConfig = {
                ...session.voiceConfig,
                ...data.voiceConfig,
              };
            }

            const flowPreset = PRESET_FLOWS.find((f) => f.id === session.flow);
            if (flowPreset) {
              session.systemInstruction = flowPreset.systemPrompt;
            }

            session.state = 'LISTENING';
            sendJson({
              type: 'session_started',
              sessionId: session.sessionId,
              flow: session.flow,
              state: 'LISTENING',
              voiceConfig: session.voiceConfig,
              greeting: flowPreset?.greeting || 'Hello! Pyvex Voice conversational agent connected.',
            });
            break;
          }

          case 'update_tuning': {
            if (data.voiceConfig) {
              session.voiceConfig = {
                ...session.voiceConfig,
                ...data.voiceConfig,
              };
            }
            if (data.flow && data.flow !== session.flow) {
              session.flow = data.flow;
              const flowPreset = PRESET_FLOWS.find((f) => f.id === session.flow);
              if (flowPreset) {
                session.systemInstruction = flowPreset.systemPrompt;
              }
            }

            sendJson({
              type: 'tuning_updated',
              voiceConfig: session.voiceConfig,
              flow: session.flow,
              timestamp: Date.now(),
            });
            break;
          }

          case 'user_speech': {
            const userText = (data.text || '').trim();
            if (!userText) return;

            // Broadcast user transcript
            sendJson({
              type: 'transcript',
              role: 'user',
              text: userText,
              timestamp: Date.now(),
            });

            // Transition to THINKING
            session.state = 'THINKING';
            sendJson({
              type: 'state_change',
              state: 'THINKING',
              timestamp: Date.now(),
            });

            session.history.push({ role: 'user', content: userText });
            // Keep history manageable
            if (session.history.length > 16) {
              session.history = session.history.slice(-16);
            }

            const startTime = Date.now();
            try {
              const flowPreset = PRESET_FLOWS.find((f) => f.id === session.flow);
              const systemPrompt =
                session.systemInstruction ||
                flowPreset?.systemPrompt ||
                'You are Pyvex Voice, an ultra-fast real-time conversational voice assistant. Keep answers natural, concise, conversational, and direct.';

              const llmResult = await generateConversationResponse({
                messages: session.history,
                systemInstruction: systemPrompt,
                model: 'gemini-3.1-flash-lite',
              });

              const replyText = llmResult.text.trim();
              const llmLatency = Date.now() - startTime;

              session.history.push({ role: 'model', content: replyText });

              // Send assistant transcript
              sendJson({
                type: 'transcript',
                role: 'assistant',
                text: replyText,
                latencyMs: llmLatency,
                model: llmResult.model,
                timestamp: Date.now(),
              });

              // Transition to SPEAKING
              session.state = 'SPEAKING';
              sendJson({
                type: 'state_change',
                state: 'SPEAKING',
                voiceConfig: session.voiceConfig,
                timestamp: Date.now(),
              });

              // Send audio synthesis payload
              sendJson({
                type: 'audio_ready',
                text: replyText,
                voiceConfig: session.voiceConfig,
                llmLatencyMs: llmLatency,
                timestamp: Date.now(),
              });
            } catch (err: any) {
              console.error('[WebSocket] Voice turn error:', err);
              session.state = 'LISTENING';
              sendJson({
                type: 'error',
                message: err.message || 'Error generating voice response',
                state: 'LISTENING',
              });
            }
            break;
          }

          case 'playback_ended': {
            session.state = 'LISTENING';
            sendJson({
              type: 'state_change',
              state: 'LISTENING',
              timestamp: Date.now(),
            });
            break;
          }

          case 'interrupt': {
            session.state = 'LISTENING';
            sendJson({
              type: 'interrupted',
              state: 'LISTENING',
              timestamp: Date.now(),
            });
            break;
          }

          default: {
            // Unrecognized type
            break;
          }
        }
      } catch (parseErr) {
        console.warn('[WebSocket] Invalid JSON received:', parseErr);
      }
    });

    ws.on('close', () => {
      // Clean up session
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket] Socket error:', err.message);
    });
  });

  return wss;
}
