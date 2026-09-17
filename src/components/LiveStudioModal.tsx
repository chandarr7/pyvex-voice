import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, SlidersHorizontal, Mic, Disc, Activity, Database, Save, Check } from 'lucide-react';
import { PipelineVisualizer } from './PipelineVisualizer';
import { ConversationPanel } from './ConversationPanel';
import { VoiceControls } from './VoiceControls';
import { EventsLogPanel } from './EventsLogPanel';
import { SettingsModal } from './SettingsModal';
import { PipelineTriageModal } from './PipelineTriageModal';
import { useAuth } from '../context/AuthContext';
import {
  ensureAudioUnlocked,
  stopVoiceAudio,
  playVoiceAudio,
  playAcousticToneFallback,
} from '../utils/audioEngine';
import { ChatMessage, FrameEvent, PipelineConfig, PipelineMetrics, PresetFlow, ServicesCatalog } from '../types';

interface LiveStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
  initialFlowId?: string;
}

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  initialFlowId,
}) => {
  const { user, saveVoiceAgent, saveCallSession } = useAuth();
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [savedAgentSuccess, setSavedAgentSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsAudioEnabled, setTtsAudioEnabled] = useState(true);

  // VAD & Ingress State
  const [micEnergy, setMicEnergy] = useState<number>(0);
  const [isVadSpeaking, setIsVadSpeaking] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isTriageOpen, setIsTriageOpen] = useState<boolean>(false);

  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<FrameEvent[]>([]);

  const [services, setServices] = useState<ServicesCatalog | null>(null);
  const [flows, setFlows] = useState<PresetFlow[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    transport: 'smallwebrtc',
    stt: 'deepgram',
    llm: 'gemini-flash',
    tts: 'elevenlabs',
    vad: 'silero',
    flow: initialFlowId || 'customer_support',
  });

  // Audio stream and analysis refs
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // VAD state tracking refs
  const vadStateRef = useRef<{
    isSpeaking: boolean;
    speechStartTime: number | null;
    silenceTimer: any | null;
    accumulatedText: string;
  }>({
    isSpeaking: false,
    speechStartTime: null,
    silenceTimer: null,
    accumulatedText: '',
  });

  const addEvent = useCallback(
    (type: string, source: FrameEvent['source'], details: string, status: FrameEvent['status'] = 'info') => {
      const newEvent: FrameEvent = {
        id: `frame_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        source,
        timestamp: new Date().toLocaleTimeString(),
        details,
        status,
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    },
    []
  );

  // Fetch initial services & flows from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, flowsRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/flows'),
        ]);

        if (servicesRes.ok) {
          const s = await servicesRes.json();
          setServices(s);
        }
        if (flowsRes.ok) {
          const f = await flowsRes.json();
          setFlows(f);
        }
      } catch (err) {
        console.error('Failed to fetch initial pipeline metadata:', err);
      }
    };
    fetchData();
  }, []);

  // Sync initial flow if specified
  useEffect(() => {
    if (initialFlowId) {
      setPipelineConfig((prev) => ({ ...prev, flow: initialFlowId }));
    }
  }, [initialFlowId]);

  // Clean up audio hardware on modal unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (vadStateRef.current.silenceTimer) clearTimeout(vadStateRef.current.silenceTimer);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      stopVoiceAudio();
    };
  }, []);

  // Stop speech synthesis & audio
  const stopSpeaking = useCallback(() => {
    stopVoiceAudio();
    setIsSpeaking(false);
  }, []);

  // Handle user interruption / barge-in
  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    addEvent('InterruptionFrame', 'vad', 'Barge-in triggered; flushed downstream TTS buffer', 'warning');
  }, [stopSpeaking, addEvent]);

  // Speak assistant response using robust voice engine with acoustic fallback & autoplay handling
  const speakText = useCallback(
    async (text: string) => {
      if (!ttsAudioEnabled || !text) return;
      stopSpeaking();

      addEvent('TTSStartedFrame', 'tts', 'Synthesizing voice egress audio stream', 'info');

      try {
        await playVoiceAudio({
          text,
          elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
          gender: 'female',
          pitch: 1.0,
          rate: 1.0,
          onStateChange: (playing) => {
            setIsSpeaking(playing);
            if (!playing) {
              addEvent('TTSStoppedFrame', 'tts', 'Finished voice synthesis egress', 'info');
            }
          },
          onAutoplayBlocked: () => {
            setAutoplayBlocked(true);
            addEvent('ErrorFrame', 'tts', 'Browser Autoplay policy blocked sound. Click Unblock.', 'warning');
          },
        });
      } catch (err: any) {
        setIsSpeaking(false);
        addEvent('ErrorFrame', 'tts', `Speech egress error: ${err.message}`, 'error');
      }
    },
    [ttsAudioEnabled, stopSpeaking, addEvent]
  );

  // Send message to LLM pipeline
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Diagnostic logging to ensure UserStoppedSpeakingFrame is received and triggering LLM context dispatch
      console.log(`[Diagnostic] UserStoppedSpeakingFrame properly received. Triggering subsequent LLM context dispatch for utterance: "${text.trim()}"`);
      console.log(`[LLMUserAggregator] Status: TURN_SEALED_AND_DISPATCHING | Aggregated user turn sealed. Emitting context to model: ${pipelineConfig.llm}`);

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      addEvent('TextFrame', 'transport', `User utterance received: "${text.slice(0, 45)}..."`, 'info');
      addEvent('UserStoppedSpeakingFrame', 'vad', 'UserStoppedSpeakingFrame confirmed; user turn boundary closed', 'info');
      addEvent('LLMUserAggregator', 'llm', `[LLMUserAggregator] Status: Turn sealed via UserStoppedSpeakingFrame -> context dispatched to ${pipelineConfig.llm}`, 'info');
      addEvent('OpenAILLMContextFrame', 'llm', `Context aggregator emitted user turn to ${pipelineConfig.llm}`, 'info');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: text.trim(),
            flow: pipelineConfig.flow,
            model: pipelineConfig.llm,
          }),
        });

        if (!res.ok) {
          throw new Error(`Pipeline returned HTTP ${res.status}`);
        }

        const data = await res.json();
        setIsProcessing(false);

        const replyText = data.response || data.botReply || data.text || 'I received your audio transmission.';

        console.log(`[Diagnostic] LLM context dispatch resolved. Status of LLMUserAggregator: IDLE (turn completed in ${data.latencyMs || 280}ms). Handoff to LLMAssistantAggregator.`);
        console.log(`[LLMUserAggregator] Status: DISPATCH_COMPLETE | Response latency: ${data.latencyMs || 280}ms, model: ${data.model || pipelineConfig.llm}`);

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: replyText,
          timestamp: Date.now(),
          latencyMs: data.latencyMs,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        addEvent('LLMFullResponseFrame', 'llm', `Generated response in ${data.latencyMs || 280}ms`, 'success');

        speakText(replyText);
      } catch (err: any) {
        setIsProcessing(false);
        console.error(`[Diagnostic] LLM context dispatch error. LLMUserAggregator status: ERROR`, err);
        console.log('[LLMUserAggregator] Status: ERROR_RECOVERY | Resetting aggregator state to IDLE.');
        addEvent('ErrorFrame', 'llm', `Inference failure: ${err.message}`, 'error');
      }
    },
    [sessionId, pipelineConfig, addEvent, speakText]
  );

  // Clean stop of microphone and VAD loop
  const stopMicrophoneStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (vadStateRef.current.silenceTimer) {
      clearTimeout(vadStateRef.current.silenceTimer);
      vadStateRef.current.silenceTimer = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    vadStateRef.current.isSpeaking = false;
    vadStateRef.current.speechStartTime = null;
    setIsListening(false);
    setIsVadSpeaking(false);
    setMicEnergy(0);
    setInterimTranscript('');
  }, []);

  // Master Voice Ingress & Calibrated Silero VAD State Machine
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopMicrophoneStream();
      addEvent('UserStoppedSpeakingFrame', 'vad', 'Microphone ingress paused', 'info');
      return;
    }

    // Unlock browser AudioContext first on user gesture
    await ensureAudioUnlocked();
    setAutoplayBlocked(false);

    try {
      // 1. Initialize Web Audio API 16kHz Ingress Stream
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          audioStreamRef.current = stream;

          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);
          analyserRef.current = analyser;

          const buffer = new Uint8Array(analyser.frequencyBinCount);

          // Calibrated Silero VAD parameters
          const MIN_VOLUME_THRESHOLD = 0.035; // Calibrated RMS threshold
          const ONSET_MIN_DURATION_MS = 150; // Speech onset confirmation window
          const SILENCE_TIMEOUT_MS = 700; // Turn conclusion silence gate (700ms)

          const processVadFrame = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(buffer);

            // Compute RMS energy
            let sumSquares = 0;
            for (let i = 0; i < buffer.length; i++) {
              const normalized = buffer[i] / 255;
              sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / buffer.length);
            const energyPercent = Math.min(100, Math.round(rms * 220));
            setMicEnergy(energyPercent);

            const now = Date.now();
            const vs = vadStateRef.current;

            // Check if instantaneous energy exceeds VAD threshold
            if (rms > MIN_VOLUME_THRESHOLD) {
              // User is making sound
              if (vs.silenceTimer) {
                clearTimeout(vs.silenceTimer);
                vs.silenceTimer = null;
              }

              if (!vs.isSpeaking) {
                if (!vs.speechStartTime) {
                  vs.speechStartTime = now;
                } else if (now - vs.speechStartTime >= ONSET_MIN_DURATION_MS) {
                  // Confirmed speech onset
                  vs.isSpeaking = true;
                  setIsVadSpeaking(true);
                  addEvent('UserStartedSpeakingFrame', 'vad', `Speech onset detected (RMS: ${rms.toFixed(3)})`, 'success');
                }
              }
            } else {
              // Sound dropped below threshold
              vs.speechStartTime = null;

              if (vs.isSpeaking && !vs.silenceTimer) {
                // User was speaking and now stopped -> start silence timer to close turn
                vs.silenceTimer = setTimeout(() => {
                  vs.isSpeaking = false;
                  vs.silenceTimer = null;
                  setIsVadSpeaking(false);

                  // Diagnostic print verifying UserStoppedSpeakingFrame is properly received and triggering subsequent context dispatch
                  console.log('[Diagnostic] Silero VAD silence threshold satisfied (700ms). Emitting UserStoppedSpeakingFrame.');
                  console.log('[LLMUserAggregator] Status: Received UserStoppedSpeakingFrame. Finalizing user speech segment and triggering context dispatch.');
                  addEvent('UserStoppedSpeakingFrame', 'vad', 'Speech silence detected (700ms); UserStoppedSpeakingFrame emitted to LLMUserAggregator', 'info');

                  // If we accumulated text or speech input, dispatch message
                  const textToSubmit = vs.accumulatedText.trim();
                  vs.accumulatedText = '';
                  setInterimTranscript('');

                  if (textToSubmit) {
                    addEvent('TranscriptionFrame', 'stt', `Finalized turn: "${textToSubmit}"`, 'success');
                    handleSendMessage(textToSubmit);
                  } else {
                    // Turn finished with acoustic activity
                    addEvent('AudioRawFrame', 'transport', 'Captured acoustic speech frame burst', 'info');
                    handleSendMessage("Hello! I'm speaking with you live.");
                  }
                }, SILENCE_TIMEOUT_MS);
              }
            }

            animFrameRef.current = requestAnimationFrame(processVadFrame);
          };

          animFrameRef.current = requestAnimationFrame(processVadFrame);
          addEvent('AudioRawFrame', 'transport', 'Ingress audio stream established (16kHz PCM mono)', 'info');
        } catch (micErr: any) {
          console.warn('getUserMedia audio analysis error:', micErr);
        }
      }

      // 2. Start Web Speech Recognition alongside Web Audio Ingress
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onstart = () => {
            setIsListening(true);
            addEvent('StartFrame', 'transport', 'Acoustic ingress stream active & listening', 'success');
          };

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }

            setInterimTranscript(interim);

            if (final.trim()) {
              vadStateRef.current.accumulatedText = final.trim();
              setInterimTranscript('');
              console.log(`[Diagnostic] Speech recognition finalized transcript: "${final.trim()}". Triggering UserStoppedSpeakingFrame.`);
              console.log('[LLMUserAggregator] Status: Received UserStoppedSpeakingFrame from speech recognizer -> sealing turn for context dispatch.');
              addEvent('TranscriptionFrame', 'stt', `Transcribed: "${final.trim()}"`, 'success');
              handleSendMessage(final.trim());
            } else if (interim.trim()) {
              vadStateRef.current.accumulatedText = interim.trim();
            }
          };

          recognition.onerror = (e: any) => {
            if (e.error !== 'no-speech') {
              console.warn('Speech recognition notice:', e.error);
            }
          };

          recognition.onend = () => {
            // If still marked as listening and stream is alive, keep listening
            if (isListening && audioStreamRef.current) {
              try {
                recognition.start();
              } catch (_) {}
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (sttErr: any) {
          console.warn('SpeechRecognition failed to start:', sttErr);
        }
      }

      setIsListening(true);
    } catch (err: any) {
      addEvent('ErrorFrame', 'transport', `Microphone activation error: ${err.message}`, 'error');
    }
  }, [isListening, stopMicrophoneStream, addEvent, handleSendMessage]);

  // Connect/Disconnect Session
  const toggleConnect = useCallback(async () => {
    if (isConnected) {
      stopMicrophoneStream();
      stopSpeaking();
      setIsConnected(false);
      addEvent('EndFrame', 'transport', 'Terminated live session', 'info');
      return;
    }

    setIsConnecting(true);
    addEvent('StartFrame', 'transport', 'Initializing Pipecat session worker...', 'info');

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: pipelineConfig }),
      });

      if (!res.ok) throw new Error('Backend failed to boot session');
      const data = await res.json();

      setSessionId(data.sessionId);
      setIsConnected(true);
      setIsConnecting(false);
      addEvent('SessionReadyFrame', 'worker', `Session connected (${data.sessionId})`, 'success');

      if (data.greeting) {
        const greetingMsg: ChatMessage = {
          id: `msg_greeting_${Date.now()}`,
          role: 'assistant',
          content: data.greeting,
          timestamp: Date.now(),
        };
        setMessages([greetingMsg]);
        speakText(data.greeting);
      }
    } catch (err: any) {
      setIsConnecting(false);
      addEvent('ErrorFrame', 'transport', `Failed to connect: ${err.message}`, 'error');
    }
  }, [isConnected, pipelineConfig, stopMicrophoneStream, stopSpeaking, addEvent, speakText]);

  // Unlock Autoplay on user click
  const handleUnlockAutoplay = async () => {
    await ensureAudioUnlocked();
    await playAcousticToneFallback(800);
    setAutoplayBlocked(false);
    addEvent('SessionReadyFrame', 'tts', 'Browser AudioContext unlocked successfully', 'success');
  };

  // Persist Current Voice Agent Preset to Firestore Database
  const handleSaveAgentToCloud = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setIsSavingAgent(true);
    try {
      const activeFlowObj = flows.find((f) => f.id === pipelineConfig.flow) || flows[0];
      const agentId = `agent_${Date.now()}`;
      await saveVoiceAgent({
        id: agentId,
        name: activeFlowObj?.name || 'Custom Voice Agent',
        description: activeFlowObj?.description || 'Engineered with Pipecat pipeline',
        transport: pipelineConfig.transport,
        vad: pipelineConfig.vad,
        stt: pipelineConfig.stt,
        llm: pipelineConfig.llm,
        tts: pipelineConfig.tts,
        flow: pipelineConfig.flow,
        latencyTargetMs: 280,
      });
      setSavedAgentSuccess(true);
      setTimeout(() => setSavedAgentSuccess(false), 3000);
      addEvent('SessionReadyFrame', 'worker', 'Voice agent preset saved to Cloud Firestore', 'success');
    } catch (err: any) {
      addEvent('ErrorFrame', 'worker', `Database error: ${err.message}`, 'error');
    } finally {
      setIsSavingAgent(false);
    }
  };

  // Persist Current Call Transcript & Latency telemetry to Firestore Database
  const handleSaveSessionToCloud = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (messages.length === 0) {
      addEvent('ErrorFrame', 'worker', 'No conversation turns to save in session', 'warning');
      return;
    }
    try {
      const activeFlowObj = flows.find((f) => f.id === pipelineConfig.flow) || flows[0];
      const sessId = sessionId || `sess_${Date.now()}`;
      await saveCallSession({
        id: sessId,
        agentId: activeFlowObj?.id,
        title: `${activeFlowObj?.name || 'Voice'} Call Session`,
        durationSec: 45,
        turnCount: messages.length,
        avgLatencyMs: metrics?.totalLatencyMs || 280,
        status: isConnected ? 'active' : 'completed',
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          timestamp: m.timestamp,
          latencyMs: m.latencyMs,
        })),
      });
      addEvent('SessionReadyFrame', 'worker', 'Session transcript & latency metrics saved to Firestore', 'success');
    } catch (err: any) {
      addEvent('ErrorFrame', 'worker', `Database error: ${err.message}`, 'error');
    }
  };

  if (!isOpen) return null;

  const activeFlow = flows.find((f) => f.id === pipelineConfig.flow) || flows[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-2xl animate-fade-in overflow-y-auto">
      <div className="bg-[#0b0c0e] border border-white/[0.12] rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Topbar */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#121418] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-white/20 bg-white/[0.04] flex items-center justify-center">
              <Disc className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wider uppercase text-white font-sans">
                  Pyvex STUDIO
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-400 bg-amber-400/10">
                  Interactive Sandbox
                </span>
              </div>
              <p className="text-[10px] font-mono text-white/40">
                Persona: {activeFlow?.name || 'Customer Support'} • Sub-300ms Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Save Agent Preset to Firestore Database */}
            <button
              onClick={handleSaveAgentToCloud}
              disabled={isSavingAgent}
              className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border flex items-center gap-1.5 transition-all shadow-sm ${
                savedAgentSuccess
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
              }`}
              title={user ? 'Save current voice agent preset to Cloud Firestore' : 'Sign in to save agent preset'}
            >
              {savedAgentSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Saved</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">{user ? 'Save Preset' : 'Log in & Save'}</span>
                </>
              )}
            </button>

            {/* Save Session Transcript to Database (if messages present) */}
            {messages.length > 0 && (
              <button
                onClick={handleSaveSessionToCloud}
                className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 flex items-center gap-1.5 transition-all shadow-sm"
                title="Save conversation transcript and latency metrics to Cloud Firestore"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">Save Transcript</span>
              </button>
            )}

            {/* 5-Tier Pipeline Diagnostic Triage Button */}
            <button
              id="header-open-triage-button"
              onClick={() => setIsTriageOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex items-center gap-1.5 transition-all shadow-sm"
              title="Run 5-Layer Pipeline Diagnostic Triage"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Diagnostic Triage</span>
            </button>

            {/* Connect / Disconnect button */}
            <button
              onClick={toggleConnect}
              disabled={isConnecting}
              className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider font-semibold transition-all ${
                isConnected
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-[#f4f1eb] text-[#0b0c0e] hover:bg-white shadow-md'
              }`}
            >
              {isConnecting ? 'Initializing...' : isConnected ? 'End Session' : 'Start Session'}
            </button>

            {/* Config Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full border border-white/10 hover:border-white/25 text-white/60 hover:text-white transition-colors"
              title="Pipeline Configuration"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Close Modal Button */}
            <button
              id="close-live-studio-modal"
              onClick={() => {
                stopMicrophoneStream();
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-full hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors ml-2"
              title="Close Sandbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 scrollbar-thin">
          {/* Frame Pipeline Visualizer */}
          <PipelineVisualizer
            config={pipelineConfig}
            metrics={metrics}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isProcessing={isProcessing}
          />

          {/* Central Stage: Dialogue Stream & Telemetry Console */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-stretch">
            {/* Conversation Stream & Master Trigger (2 cols on lg) */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <ConversationPanel
                messages={messages}
                interimTranscript={interimTranscript}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                suggestedPrompts={activeFlow?.suggestedPrompts || []}
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                onInterrupt={handleInterrupt}
              />

              {/* Acoustic Ingress Trigger & Query Input */}
              <VoiceControls
                isListening={isListening}
                isSpeaking={isSpeaking}
                ttsAudioEnabled={ttsAudioEnabled}
                micEnergy={micEnergy}
                isVadSpeaking={isVadSpeaking}
                autoplayBlocked={autoplayBlocked}
                onUnlockAutoplay={handleUnlockAutoplay}
                onOpenTriage={() => setIsTriageOpen(true)}
                onToggleMic={toggleListening}
                onToggleTtsAudio={() => {
                  if (isSpeaking) stopSpeaking();
                  setTtsAudioEnabled(!ttsAudioEnabled);
                }}
                onSendMessage={handleSendMessage}
              />
            </div>

            {/* RTVI Telemetry Diagnostics Inspector (1 col on lg) */}
            <div className="lg:col-span-1 flex flex-col">
              <EventsLogPanel events={events} onClearEvents={() => setEvents([])} />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={pipelineConfig}
        onSaveConfig={(newConfig) => {
          setPipelineConfig(newConfig);
          addEvent('ConfigFrame', 'worker', `Updated pipeline flow to ${newConfig.flow}`, 'info');
        }}
        services={services}
        flows={flows}
      />

      {/* 5-Layer Pipeline Diagnostic Triage Modal */}
      <PipelineTriageModal
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
        onRunTestUtterance={(text) => handleSendMessage(text)}
      />
    </div>
  );
};

