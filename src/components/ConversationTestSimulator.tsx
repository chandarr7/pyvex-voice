import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  Send,
  Sparkles,
  RefreshCw,
  Activity,
  Zap,
  Radio,
  Square,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { playVoiceAudio, stopVoiceAudio } from '../utils/audioEngine';
import { PYVEX_PERSONAS, PersonaVoice } from '../data/personas';

export type SimulatorState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface VoiceTestDraftConfig {
  voiceId: string;
  voiceName: string;
  gender: 'male' | 'female';
  pitch: number; // -10.0 to +10.0
  rate: number; // 0.5x to 2.0x
  volume: number; // 0.0 to 1.0
  noiseSuppression: boolean;
  latencyThresholdMs: number;
  voiceModel: string;
  flow: string;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  latencyMs?: number;
  model?: string;
  isInterim?: boolean;
}

interface ConversationTestSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  initialVoiceId?: string;
  initialGender?: 'male' | 'female';
  initialFlow?: string;
  onPersistDraft?: (draft: VoiceTestDraftConfig) => void;
}

export const ALL_VOICE_PROFILES: Array<{
  id: string;
  name: string;
  gender: 'male' | 'female';
  personaCategory: string;
  provider: string;
  sampleScript: string;
}> = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah (Inbound SDR)',
    gender: 'female',
    personaCategory: 'Enterprise B2B',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Hello, this is Sarah from Pyvex Enterprise Solutions. I can walk you through our sub-300ms acoustic pipeline, SIP trunking integrations, and custom voice deployments.',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie (Inbound SDR)',
    gender: 'male',
    personaCategory: 'Enterprise B2B',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Hi there, thanks for reaching out to Pyvex. What volume of concurrent voice sessions are you planning for this quarter?',
  },
  {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    name: 'Dr. Alice (Clinical Intake)',
    gender: 'female',
    personaCategory: 'Healthcare & Clinical',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Hello! I am your clinical intake assistant at Pyvex Health. I can triage your symptoms and schedule your specialist consultation right away.',
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'Dr. George (Physician Advisor)',
    gender: 'male',
    personaCategory: 'Healthcare & Clinical',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Good day. I am reviewing your clinical records and medication history. Are you currently experiencing any fever or respiratory discomfort?',
  },
  {
    id: 'cjVigY5qzO86Huf0OWal',
    name: 'Eric (Institutional Wealth Advisor)',
    gender: 'male',
    personaCategory: 'Fintech & Wealth',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Good afternoon. This is Eric from Pyvex Institutional Wealth. I am notifying you of an unusual debit authorization on your corporate treasury account.',
  },
  {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Victoria (Luxury Estates)',
    gender: 'female',
    personaCategory: 'Real Estate & Luxury',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Welcome to Pyvex Private Estates. Would you prefer a waterfront penthouse tour in Miami or a Beverly Hills private viewing?',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Marcus (Fleet Dispatcher)',
    gender: 'male',
    personaCategory: 'Logistics & Supply',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Dispatch check, unit 402. Highway 80 westbound has a 45-minute closure. Rerouting via arterial corridor 12 now.',
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica (Customer Concierge)',
    gender: 'female',
    personaCategory: 'Customer Success',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: 'Welcome to Tilted customer support. How can I assist you with your subscription or account today?',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily (Sweet Velvet)',
    gender: 'female',
    personaCategory: 'Human Sweet Voice',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: "Hello! I'm Lily. It is such a pleasure to speak with you today. Take your time, and let me know how I can help make things easier for you.",
  },
  {
    id: 'jsCqWAovK2LkecY7zXl4',
    name: 'Freya (Sweet Radiant)',
    gender: 'female',
    personaCategory: 'Human Sweet Voice',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: "Hi there! I'm Freya. I'm so excited to connect with you! Everything is running smoothly, and I'd love to assist you with whatever you need.",
  },
  {
    id: 'LcfcDJNigUd50AZSDxio',
    name: 'Emily (Sweet Gentle)',
    gender: 'female',
    personaCategory: 'Human Sweet Voice',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: "Hello, this is Emily. I'm right here with you. Please feel free to share any details, and we'll take care of everything step by step.",
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte (Sweet Melodic)',
    gender: 'female',
    personaCategory: 'Human Sweet Voice',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: "A very warm welcome to you. I'm Charlotte. It is an absolute delight to assist you today with the finest care and personalized attention.",
  },
  {
    id: 'piTKgcLEGmPE4e6mEKli',
    name: 'Nicole (Sweet Whisper-Soft)',
    gender: 'female',
    personaCategory: 'Human Sweet Voice',
    provider: 'ElevenLabs Turbo v2.5',
    sampleScript: "Hi, I'm Nicole. Take a gentle breath. I'm here to listen, support you, and guide you through whenever you are ready.",
  },
];

const LOCAL_STORAGE_KEY = 'pyvex_active_voice_draft';

export const ConversationTestSimulator: React.FC<ConversationTestSimulatorProps> = ({
  isOpen,
  onClose,
  initialVoiceId,
  initialGender = 'female',
  initialFlow = 'customer_support',
  onPersistDraft,
}) => {
  // Load saved draft or initialize defaults
  const [draftConfig, setDraftConfig] = useState<VoiceTestDraftConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          voiceId: initialVoiceId || parsed.voiceId || 'EXAVITQu4vr4xnSDxMaL',
          voiceName: parsed.voiceName || 'Sarah (Inbound SDR)',
          gender: initialGender || parsed.gender || 'female',
          pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 0.0,
          rate: typeof parsed.rate === 'number' ? parsed.rate : 1.0,
          volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
          noiseSuppression: parsed.noiseSuppression ?? true,
          latencyThresholdMs: parsed.latencyThresholdMs || 250,
          voiceModel: parsed.voiceModel || 'eleven_turbo_v2_5',
          flow: initialFlow || parsed.flow || 'customer_support',
        };
      }
    } catch {}

    const defaultVoice = ALL_VOICE_PROFILES.find((v) => v.id === initialVoiceId) || ALL_VOICE_PROFILES[0];
    return {
      voiceId: defaultVoice.id,
      voiceName: defaultVoice.name,
      gender: defaultVoice.gender,
      pitch: 0.0,
      rate: 1.0,
      volume: 1.0,
      noiseSuppression: true,
      latencyThresholdMs: 250,
      voiceModel: 'eleven_turbo_v2_5',
      flow: initialFlow,
    };
  });

  // Simulator Runtime States
  const [simState, setSimState] = useState<SimulatorState>('IDLE');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isAudioSettingsExpanded, setIsAudioSettingsExpanded] = useState<boolean>(false);
  const [activeLatencyMs, setActiveLatencyMs] = useState<number>(210);
  const [lastSavedNotice, setLastSavedNotice] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimText]);

  // Persist draft updates to localStorage and notify parent
  const updateDraft = useCallback((updates: Partial<VoiceTestDraftConfig>) => {
    setDraftConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (onPersistDraft) {
        onPersistDraft(next);
      }
      return next;
    });

    setLastSavedNotice('Draft auto-saved');
    setTimeout(() => setLastSavedNotice(''), 2500);

    // Send tuning update via WebSocket if active
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'update_tuning',
          voiceConfig: updates,
        })
      );
    }
  }, [onPersistDraft]);

  // Voice profile selection helper
  const handleSelectVoice = (voiceId: string) => {
    const matched = ALL_VOICE_PROFILES.find((v) => v.id === voiceId);
    if (matched) {
      updateDraft({
        voiceId: matched.id,
        voiceName: matched.name,
        gender: matched.gender,
      });
    }
  };

  // Setup WebSocket connection when simulator opens
  useEffect(() => {
    if (!isOpen) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopVoiceAudio();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setSimState('IDLE');
      setWsConnected(false);
      return;
    }

    // Connect to WebSocket server on current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/voice`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'start_session',
            flow: draftConfig.flow,
            voiceConfig: {
              voiceId: draftConfig.voiceId,
              pitch: draftConfig.pitch,
              rate: draftConfig.rate,
              volume: draftConfig.volume,
              noiseSuppression: draftConfig.noiseSuppression,
              latencyThresholdMs: draftConfig.latencyThresholdMs,
              voiceModel: draftConfig.voiceModel,
            },
          })
        );
      };

      socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'session_started') {
            setSimState('LISTENING');
            if (msg.greeting && transcripts.length === 0) {
              const greetingEntry: TranscriptEntry = {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                text: msg.greeting,
                timestamp: Date.now(),
                latencyMs: 180,
                model: 'Pyvex Voice Live Engine',
              };
              setTranscripts([greetingEntry]);

              // Play greeting
              isSpeakingRef.current = true;
              setSimState('SPEAKING');
              playVoiceAudio({
                text: msg.greeting,
                voiceId: draftConfig.voiceId,
                gender: draftConfig.gender,
                pitch: draftConfig.pitch,
                rate: draftConfig.rate,
                volume: draftConfig.volume,
                voiceModel: draftConfig.voiceModel,
                onStateChange: (playing) => {
                  isSpeakingRef.current = playing;
                  if (!playing) {
                    setSimState('LISTENING');
                  }
                },
              });
            }
          } else if (msg.type === 'state_change') {
            setSimState(msg.state);
          } else if (msg.type === 'transcript') {
            if (msg.role === 'assistant') {
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  role: 'assistant',
                  text: msg.text,
                  timestamp: msg.timestamp || Date.now(),
                  latencyMs: msg.latencyMs,
                  model: msg.model || 'Gemini 3.1 Flash Lite',
                },
              ]);
              if (msg.latencyMs) {
                setActiveLatencyMs(msg.latencyMs);
              }
            }
          } else if (msg.type === 'audio_ready') {
            // Audio synthesis playback
            isSpeakingRef.current = true;
            setSimState('SPEAKING');
            playVoiceAudio({
              text: msg.text,
              voiceId: draftConfig.voiceId,
              gender: draftConfig.gender,
              pitch: draftConfig.pitch,
              rate: draftConfig.rate,
              volume: draftConfig.volume,
              voiceModel: draftConfig.voiceModel,
              onStateChange: (playing) => {
                isSpeakingRef.current = playing;
                if (!playing) {
                  setSimState('LISTENING');
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'playback_ended' }));
                  }
                }
              },
            });
          } else if (msg.type === 'interrupted') {
            stopVoiceAudio();
            isSpeakingRef.current = false;
            setSimState('LISTENING');
          }
        } catch (err) {
          console.warn('Socket message parse error:', err);
        }
      };

      socket.onerror = () => {
        setWsConnected(false);
      };

      socket.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn('Failed to establish WebSocket:', err);
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [isOpen, draftConfig.flow]);

  // Setup Speech-to-Text Recognition in Browser
  useEffect(() => {
    if (!isOpen || isMicMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Browser SpeechRecognition not supported. Manual text input enabled.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimText(interim);

        if (finalTranscript.trim()) {
          setInterimText('');
          handleDispatchUserMessage(finalTranscript.trim());
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', err.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart if modal is open and mic is unmuted and not assistant speaking
        if (isOpen && !isMicMuted && !isSpeakingRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Failed to start SpeechRecognition:', err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isOpen, isMicMuted]);

  // Handle sending a user message turn to Pyvex Agent
  const handleDispatchUserMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add user turn to transcript immediately
    const userEntry: TranscriptEntry = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };
    setTranscripts((prev) => [...prev, userEntry]);
    setTextInput('');
    setSimState('THINKING');

    // If WebSocket is open, send through socket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user_speech',
          text: text.trim(),
        })
      );
    } else {
      // HTTP Fallback if WebSocket is disconnected
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            systemInstruction: 'You are Pyvex Voice, an ultra-fast real-time conversational voice assistant. Keep answers natural, concise, conversational, and direct.',
            model: 'gemini-3.1-flash-lite',
          }),
        });
        const data = await res.json();
        const reply = data.text || "I'm connected and listening.";
        const latency = data.latencyMs || 220;

        setTranscripts((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            text: reply,
            timestamp: Date.now(),
            latencyMs: latency,
            model: data.model || 'Gemini 3.1 Flash Lite',
          },
        ]);

        setActiveLatencyMs(latency);
        setSimState('SPEAKING');
        isSpeakingRef.current = true;

        await playVoiceAudio({
          text: reply,
          voiceId: draftConfig.voiceId,
          gender: draftConfig.gender,
          pitch: draftConfig.pitch,
          rate: draftConfig.rate,
          volume: draftConfig.volume,
          voiceModel: draftConfig.voiceModel,
          onStateChange: (playing) => {
            isSpeakingRef.current = playing;
            if (!playing) setSimState('LISTENING');
          },
        });
      } catch (httpErr) {
        setSimState('LISTENING');
      }
    }
  };

  // Interrupt active speech
  const handleInterrupt = () => {
    stopVoiceAudio();
    isSpeakingRef.current = false;
    setSimState('LISTENING');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  };

  // Pitch label formatter
  const getPitchLabel = (val: number) => {
    if (val === 0) return '0.0 (Natural)';
    if (val > 0) return `+${val.toFixed(1)} st (High)`;
    return `${val.toFixed(1)} st (Deep)`;
  };

  if (!isOpen) return null;

  return (
    <div
      id="conversation-test-simulator-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopVoiceAudio();
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border transition-all"
        style={{
          background: '#08090B',
          borderColor: '#292B3A',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(112, 71, 255, 0.2)',
        }}
      >
        {/* ================= HEADER ================= */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{
            background: '#0D0E13',
            borderColor: '#232534',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center relative shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #7047FF, #9655FF)',
              }}
            >
              <Radio className="w-5 h-5 text-[#F4F2F8] animate-pulse" />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#08090B]"
                style={{
                  backgroundColor: wsConnected ? '#20E99A' : '#F59E0B',
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-sans font-bold text-[#F4F2F8] tracking-tight">
                  Pyvex Real-Time Voice Simulator
                </h2>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border"
                  style={{
                    backgroundColor: 'rgba(32, 233, 154, 0.12)',
                    borderColor: 'rgba(32, 233, 154, 0.3)',
                    color: '#20E99A',
                  }}
                >
                  Sub-300ms Live Stream
                </span>
              </div>
              <p className="text-xs text-[#666879] font-mono">
                Active Profile: <span className="text-[#F4F2F8] font-medium">{draftConfig.voiceName}</span> • Pitch {draftConfig.pitch > 0 ? `+${draftConfig.pitch}` : draftConfig.pitch} • Speed {draftConfig.rate.toFixed(2)}x
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastSavedNotice && (
              <span className="text-[11px] font-mono text-[#20E99A] flex items-center gap-1 bg-[#20E99A]/10 px-2.5 py-1 rounded-full border border-[#20E99A]/25 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lastSavedNotice}</span>
              </span>
            )}

            <button
              id="close-conversation-simulator-button"
              type="button"
              onClick={() => {
                stopVoiceAudio();
                onClose();
              }}
              className="p-2 rounded-xl text-[#666879] hover:text-[#F4F2F8] hover:bg-[#1C1D25] transition-colors"
              title="Close Simulator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= MAIN DUAL PANEL GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* LEFT COLUMN: VISUAL STATE + CONTROLS (5 cols) */}
          <div
            className="lg:col-span-5 p-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r overflow-y-auto"
            style={{
              background: '#0D0F13',
              borderColor: '#232534',
            }}
          >
            {/* Visual State Orb & Soundwave Canvas Card */}
            <div
              className="p-4 rounded-2xl flex flex-col items-center justify-center gap-3 relative overflow-hidden"
              style={{
                background: '#08090B',
                border: '1px solid #292B3A',
              }}
            >
              {/* Dynamic status badge */}
              <div className="flex items-center justify-between w-full text-[11px] font-mono">
                <span className="text-[#666879] uppercase tracking-wider">Agent State</span>
                <span
                  className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{
                    backgroundColor:
                      simState === 'SPEAKING'
                        ? 'rgba(112, 71, 255, 0.2)'
                        : simState === 'THINKING'
                        ? 'rgba(150, 85, 255, 0.2)'
                        : simState === 'LISTENING'
                        ? 'rgba(32, 233, 154, 0.2)'
                        : 'rgba(102, 104, 121, 0.2)',
                    color:
                      simState === 'SPEAKING'
                        ? '#A855F7'
                        : simState === 'THINKING'
                        ? '#C084FC'
                        : simState === 'LISTENING'
                        ? '#20E99A'
                        : '#A4A3B2',
                  }}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      simState === 'IDLE' ? 'bg-[#666879]' : 'animate-ping'
                    }`}
                    style={{
                      backgroundColor:
                        simState === 'SPEAKING'
                          ? '#A855F7'
                          : simState === 'THINKING'
                          ? '#C084FC'
                          : simState === 'LISTENING'
                          ? '#20E99A'
                          : '#666879',
                    }}
                  />
                  <span>{simState}</span>
                </span>
              </div>

              {/* Central Glowing Orb & Waveform */}
              <div className="relative w-28 h-28 flex items-center justify-center my-1">
                {/* Outer Ripple */}
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-700 ${
                    simState === 'LISTENING'
                      ? 'scale-125 bg-[#20E99A]/10 border border-[#20E99A]/30 animate-pulse'
                      : simState === 'SPEAKING'
                      ? 'scale-125 bg-[#7047FF]/15 border border-[#7047FF]/40 animate-pulse'
                      : simState === 'THINKING'
                      ? 'scale-110 bg-[#9655FF]/10 border border-[#9655FF]/30 animate-spin'
                      : 'scale-95 bg-white/5 border border-white/10'
                  }`}
                />

                {/* Inner Core */}
                <div
                  className="w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300"
                  style={{
                    background:
                      simState === 'SPEAKING'
                        ? 'radial-gradient(circle, #9655FF 0%, #7047FF 80%)'
                        : simState === 'LISTENING'
                        ? 'radial-gradient(circle, #24D8ED 0%, #059669 80%)'
                        : simState === 'THINKING'
                        ? 'radial-gradient(circle, #C084FC 0%, #6B21A8 80%)'
                        : 'radial-gradient(circle, #1F212E 0%, #12141A 80%)',
                    boxShadow:
                      simState === 'SPEAKING'
                        ? '0 0 30px rgba(112, 71, 255, 0.6)'
                        : simState === 'LISTENING'
                        ? '0 0 30px rgba(32, 233, 154, 0.5)'
                        : '0 0 15px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {simState === 'SPEAKING' && <Volume2 className="w-8 h-8 text-white animate-bounce" />}
                  {simState === 'LISTENING' && <Mic className="w-8 h-8 text-white animate-pulse" />}
                  {simState === 'THINKING' && <Sparkles className="w-8 h-8 text-white animate-spin" />}
                  {simState === 'IDLE' && <Activity className="w-7 h-7 text-[#666879]" />}
                </div>
              </div>

              {/* Multi-Frequency Acoustic Wave Bar Visualizer */}
              <div className="flex items-center justify-center gap-1.5 w-full h-8 px-2">
                {[45, 80, 55, 95, 30, 75, 100, 60, 90, 40, 85, 50, 70, 35].map((h, i) => {
                  const isActive = simState === 'SPEAKING' || simState === 'LISTENING';
                  const heightVal = isActive ? `${h}%` : '20%';
                  const barColor =
                    simState === 'LISTENING'
                      ? '#20E99A'
                      : i % 2 === 0
                      ? '#7047FF'
                      : '#24D8ED';
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-200"
                      style={{
                        height: heightVal,
                        backgroundColor: barColor,
                        opacity: isActive ? 0.9 : 0.25,
                        boxShadow: isActive ? `0 0 8px ${barColor}` : 'none',
                      }}
                    />
                  );
                })}
              </div>

              {/* Status metrics footer */}
              <div className="flex items-center justify-between w-full pt-1 border-t border-[#1C1D25] text-[10px] font-mono text-[#666879]">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#20E99A]" />
                  <span>TTS Latency: {activeLatencyMs}ms</span>
                </span>
                {simState === 'SPEAKING' && (
                  <button
                    type="button"
                    onClick={handleInterrupt}
                    className="flex items-center gap-1 text-[#F43F5E] hover:text-[#FB7185] transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Interrupt Agent</span>
                  </button>
                )}
              </div>
            </div>

            {/* Voice Profile Dropdown Control */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#A4A3B2] flex items-center justify-between">
                <span>Voice Profile Selection</span>
                <span className="text-[#845CFF] text-[10px]">{draftConfig.voiceModel}</span>
              </label>

              <div className="relative">
                <select
                  id="simulator-voice-select"
                  value={draftConfig.voiceId}
                  onChange={(e) => handleSelectVoice(e.target.value)}
                  className="w-full appearance-none rounded-xl px-3.5 py-2.5 text-xs font-sans font-medium text-[#F4F2F8] focus:outline-none focus:border-[#7047FF] transition-colors cursor-pointer pr-9"
                  style={{
                    background: '#12141A',
                    border: '1px solid #292B3A',
                  }}
                >
                  {ALL_VOICE_PROFILES.map((vp) => (
                    <option key={vp.id} value={vp.id} className="bg-[#0D0F13] text-[#F4F2F8]">
                      {vp.name} • {vp.personaCategory} ({vp.gender})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#666879] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Pitch Slider Control (-10.0 to +10.0) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[#12141A] border border-[#292B3A]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#A4A3B2]">Voice Pitch</span>
                <span className="text-[#845CFF] font-semibold">{getPitchLabel(draftConfig.pitch)}</span>
              </div>
              <input
                id="simulator-pitch-slider"
                type="range"
                min="-10"
                max="10"
                step="0.5"
                value={draftConfig.pitch}
                onChange={(e) => updateDraft({ pitch: parseFloat(e.target.value) })}
                className="w-full accent-[#7047FF] cursor-pointer h-1.5 bg-[#292B3A] rounded-lg"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#666879]">
                <span>-10 st (Deep)</span>
                <span>0 (Natural)</span>
                <span>+10 st (High)</span>
              </div>
            </div>

            {/* Speed / Speaking Rate Slider (0.5x to 2.0x) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[#12141A] border border-[#292B3A]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#A4A3B2]">Speaking Rate</span>
                <span className="text-[#24D8ED] font-semibold">{draftConfig.rate.toFixed(2)}x</span>
              </div>
              <input
                id="simulator-rate-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={draftConfig.rate}
                onChange={(e) => updateDraft({ rate: parseFloat(e.target.value) })}
                className="w-full accent-[#24D8ED] cursor-pointer h-1.5 bg-[#292B3A] rounded-lg"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#666879]">
                <span>0.5x (Deliberate)</span>
                <span>1.0x (Normal)</span>
                <span>2.0x (Rapid)</span>
              </div>
            </div>

            {/* Audio Settings Panel Toggle */}
            <div className="rounded-xl border border-[#292B3A] bg-[#12141A] overflow-hidden">
              <button
                type="button"
                id="toggle-audio-settings-button"
                onClick={() => setIsAudioSettingsExpanded(!isAudioSettingsExpanded)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-mono text-[#A4A3B2] hover:text-[#F4F2F8] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#845CFF]" />
                  <span>Advanced Audio Settings</span>
                </span>
                {isAudioSettingsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isAudioSettingsExpanded && (
                <div className="p-3.5 space-y-3.5 border-t border-[#232534] bg-[#0D0F13] text-xs font-mono">
                  {/* Output Volume */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#A4A3B2]">
                      <span>Output Volume</span>
                      <span className="text-[#F4F2F8] font-semibold">{Math.round(draftConfig.volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={draftConfig.volume}
                      onChange={(e) => updateDraft({ volume: parseFloat(e.target.value) })}
                      className="w-full accent-[#7047FF] cursor-pointer h-1.5 bg-[#292B3A] rounded-lg"
                    />
                  </div>

                  {/* Noise Suppression Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#A4A3B2]">Noise Suppression</span>
                    <button
                      type="button"
                      onClick={() => updateDraft({ noiseSuppression: !draftConfig.noiseSuppression })}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        draftConfig.noiseSuppression ? 'bg-[#20E99A]' : 'bg-[#292B3A]'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          draftConfig.noiseSuppression ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Latency Threshold Selector */}
                  <div className="space-y-1.5">
                    <span className="text-[#A4A3B2]">Latency Target</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[150, 250, 350].map((lat) => (
                        <button
                          key={lat}
                          type="button"
                          onClick={() => updateDraft({ latencyThresholdMs: lat })}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                            draftConfig.latencyThresholdMs === lat
                              ? 'bg-[#7047FF] text-[#F4F2F8] shadow-sm'
                              : 'bg-[#12141A] text-[#666879] hover:text-[#A4A3B2]'
                          }`}
                        >
                          {lat}ms
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: REAL-TIME CONVERSATION TRANSCRIPT & MIC INGRESS (7 cols) */}
          <div
            className="lg:col-span-7 flex flex-col h-[520px] lg:h-auto"
            style={{
              background: '#08090B',
            }}
          >
            {/* Transcript Header Toolbar */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b text-xs font-mono"
              style={{
                background: '#0D0F13',
                borderColor: '#232534',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#20E99A]" />
                <span className="text-[#F4F2F8] font-medium">Live Conversation Stream</span>
                <span className="text-[#666879]">({transcripts.length} turns)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTranscripts([])}
                  className="px-2.5 py-1 rounded-lg text-[11px] text-[#666879] hover:text-[#F4F2F8] hover:bg-[#1C1D25] transition-colors"
                >
                  Clear History
                </button>
              </div>
            </div>

            {/* Scrollable Live Transcript Panel */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
              {transcripts.length === 0 && !interimText && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#666879]">
                  <Mic className="w-10 h-10 text-[#292B3A] mb-3 animate-pulse" />
                  <p className="text-sm font-sans font-medium text-[#A4A3B2]">
                    Start speaking into your microphone or pick a prompt below.
                  </p>
                  <p className="text-xs font-mono mt-1 text-[#666879]">
                    Sub-300ms two-way acoustic feedback loop with Gemini + ElevenLabs.
                  </p>
                </div>
              )}

              {transcripts.map((entry) => {
                const isUser = entry.role === 'user';
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#666879] px-1">
                      <span>{isUser ? 'You (Client Mic)' : `Pyvex Voice • ${entry.model || 'Flash Lite'}`}</span>
                      {entry.latencyMs && (
                        <span className="text-[#20E99A] font-semibold">
                          ⚡ {entry.latencyMs}ms
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs font-sans leading-relaxed shadow-md ${
                        isUser
                          ? 'bg-[#7047FF] text-[#F4F2F8] rounded-br-xs'
                          : 'bg-[#12141A] text-[#F4F2F8] border border-[#292B3A] rounded-bl-xs'
                      }`}
                    >
                      {entry.text}
                    </div>
                  </div>
                );
              })}

              {/* Interim Live Speech Indicator */}
              {interimText && (
                <div className="flex flex-col items-end gap-1 animate-in fade-in">
                  <div className="text-[10px] font-mono text-[#20E99A] px-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20E99A] animate-ping" />
                    <span>Listening...</span>
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs font-sans italic bg-[#7047FF]/40 text-[#F4F2F8] border border-[#7047FF]/60 rounded-br-xs">
                    {interimText}
                  </div>
                </div>
              )}

              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Test Prompt Chips */}
            <div className="px-5 py-2 border-t border-[#1C1D25] flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono scrollbar-none">
              <span className="text-[#666879] flex-shrink-0 text-[10px] uppercase">Prompts:</span>
              {[
                'Tell me about your voice pipeline latency.',
                'Can you schedule an intake appointment for tomorrow?',
                'What is your objection handling strategy for enterprise deals?',
                'Switch to a calm advisory tone.',
              ].map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDispatchUserMessage(promptText)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[#12141A] border border-[#292B3A] text-[#A4A3B2] hover:text-[#F4F2F8] hover:border-[#7047FF] transition-colors"
                >
                  &quot;{promptText}&quot;
                </button>
              ))}
            </div>

            {/* Bottom Ingress Control Bar (Mic Toggle + Text Fallback) */}
            <div
              className="p-4 border-t flex items-center gap-3"
              style={{
                background: '#0D0F13',
                borderColor: '#232534',
              }}
            >
              {/* Mic Toggle Button */}
              <button
                type="button"
                id="simulator-mic-toggle-button"
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`p-3 rounded-2xl flex items-center justify-center transition-all ${
                  isMicMuted
                    ? 'bg-[#292B3A] text-[#666879] hover:bg-[#34365C]'
                    : 'bg-[#20E99A] text-[#08090B] shadow-[0_0_15px_rgba(32,233,154,0.4)]'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input for Typing fallback */}
              <div className="relative flex-1">
                <input
                  id="simulator-text-input"
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleDispatchUserMessage(textInput);
                    }
                  }}
                  placeholder="Speak into microphone or type a test message..."
                  className="w-full rounded-2xl px-4 py-3 text-xs font-sans text-[#F4F2F8] placeholder-[#666879] focus:outline-none focus:border-[#7047FF] transition-colors pr-10"
                  style={{
                    background: '#12141A',
                    border: '1px solid #292B3A',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleDispatchUserMessage(textInput)}
                  disabled={!textInput.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-[#7047FF] text-white disabled:opacity-40 hover:bg-[#845CFF] transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
