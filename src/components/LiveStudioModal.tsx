import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, SlidersHorizontal, Sliders, Disc, Activity, Database, Save, Check, Radio, Sparkles, Maximize2, Waves, Boxes } from 'lucide-react';
import { PipelineVisualizer } from './PipelineVisualizer';
import { ConversationPanel } from './ConversationPanel';
import { VoiceControls } from './VoiceControls';
import { EventsLogPanel } from './EventsLogPanel';
import { SettingsModal } from './SettingsModal';
import { PipelineTriageModal } from './PipelineTriageModal';
import { VoiceSettingsPanel, ACCENT_OPTIONS, getPersonaForFlow } from './VoiceSettingsPanel';
import { ConversationTestSimulator } from './ConversationTestSimulator';
import { FluidOrbMeshVisualizer } from './FluidOrbMeshVisualizer';
import { useAuth } from '../context/AuthContext';
import {
  ensureAudioUnlocked,
  stopVoiceAudio,
  playVoiceAudio,
  playAcousticToneFallback,
} from '../utils/audioEngine';
import { ChatMessage, FrameEvent, PipelineConfig, PipelineMetrics, PresetFlow, ServicesCatalog, PersonaVoiceTuning, FluidMeshStyle } from '../types';

export type PipelineState =
  | 'IDLE'
  | 'REQUESTING_MIC'
  | 'MIC_READY'
  | 'STARTING_SESSION'
  | 'CONNECTED'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR'
  | 'DISCONNECTED';

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
  const [pipelineState, setPipelineState] = useState<PipelineState>('IDLE');
  const [sessionId, setSessionId] = useState<string | null>(null);

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
  const [isVoiceTuningOpen, setIsVoiceTuningOpen] = useState(false);
  const [isTestSimulatorOpen, setIsTestSimulatorOpen] = useState(false);
  const [isOrbOverlayOpen, setIsOrbOverlayOpen] = useState(false);
  const [visualizerTab, setVisualizerTab] = useState<'pipeline' | 'orb'>('pipeline');
  const [fluidMeshStyle, setFluidMeshStyle] = useState<FluidMeshStyle>('flow');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('EXAVITQu4vr4xnSDxMaL');

  const [voiceTuning, setVoiceTuning] = useState<PersonaVoiceTuning>(() => {
    const persona = getPersonaForFlow(initialFlowId || 'customer_support');
    const defaultVoice = persona.voices.female;
    return {
      pitch: defaultVoice?.pitch || 1.0,
      speed: defaultVoice?.rate || 1.0,
      accent: 'us_executive',
      voiceId: defaultVoice?.elevenLabsId || 'EXAVITQu4vr4xnSDxMaL',
      gender: 'female',
    };
  });

  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    transport: 'http_turn_streaming',
    stt: 'browser_speech',
    llm: 'gemini-3.1-flash-lite',
    tts: 'elevenlabs',
    vad: 'client_rms_vad',
    flow: initialFlowId || 'customer_support',
  });

  // Audio stream, analysis and control refs
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

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
        id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
        console.error('Failed to fetch pipeline metadata:', err);
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

  // Synchronize persona voice tuning when flow changes
  useEffect(() => {
    const persona = getPersonaForFlow(pipelineConfig.flow);
    const defaultAccent =
      persona.id === 'healthcare-triage'
        ? 'us_clinical'
        : persona.id === 'fintech-wealth'
        ? 'us_wealth'
        : persona.id === 'real-estate-luxury'
        ? 'us_concierge'
        : persona.id === 'logistics-dispatch'
        ? 'us_dispatch'
        : 'us_executive';

    setVoiceTuning((prev) => {
      const voice = persona.voices[prev.gender] || persona.voices.female;
      const targetVoiceId = voice.elevenLabsId;
      setSelectedVoiceId(targetVoiceId);
      return {
        ...prev,
        pitch: voice.pitch,
        speed: voice.rate,
        accent: defaultAccent,
        voiceId: targetVoiceId,
      };
    });
  }, [pipelineConfig.flow]);

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
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      stopVoiceAudio();
      isListeningRef.current = false;
    };
  }, []);

  // Stop speech synthesis & audio
  const stopSpeaking = useCallback(() => {
    stopVoiceAudio();
    if (pipelineState === 'SPEAKING') {
      setPipelineState(sessionId ? 'CONNECTED' : 'IDLE');
    }
  }, [pipelineState, sessionId]);

  // Handle user interruption / barge-in
  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    addEvent('barge_in.triggered', 'vad', 'Barge-in triggered; flushed audio egress buffer', 'warning');
  }, [stopSpeaking, addEvent]);

  // Helper to retrieve auth token
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      try {
        return await user.getIdToken(true);
      } catch {
        return null;
      }
    }
  }, [user]);

  // Speak assistant response using robust voice engine
  const speakText = useCallback(
    async (text: string) => {
      if (!ttsAudioEnabled || !text) return;
      stopSpeaking();
      setPipelineState('SPEAKING');

      addEvent(
        'tts.started',
        'tts',
        `Synthesizing voice response with ElevenLabs (${voiceTuning.speed.toFixed(2)}x, ${voiceTuning.pitch.toFixed(2)}x, ${voiceTuning.accent})`,
        'info'
      );

      try {
        const token = await getAuthToken();
        await playVoiceAudio({
          text,
          voiceId: voiceTuning.voiceId,
          gender: voiceTuning.gender,
          pitch: voiceTuning.pitch,
          rate: voiceTuning.speed,
          authToken: token || undefined,
          onStateChange: (playing) => {
            if (playing) {
              setPipelineState('SPEAKING');
            } else {
              setPipelineState((prev) => (prev === 'SPEAKING' ? (sessionId ? 'CONNECTED' : 'IDLE') : prev));
              addEvent('tts.completed', 'tts', 'ElevenLabs voice playback complete', 'info');
            }
          },
          onAutoplayBlocked: () => {
            setAutoplayBlocked(true);
            addEvent('tts.autoplay_blocked', 'tts', 'Browser autoplay policy blocked audio. Click Unblock.', 'warning');
          },
        });
      } catch (err: any) {
        setPipelineState(sessionId ? 'CONNECTED' : 'IDLE');
        addEvent('tts.error', 'tts', `Voice playback error: ${err.message}`, 'error');
      }
    },
    [ttsAudioEnabled, stopSpeaking, addEvent, getAuthToken, sessionId, voiceTuning]
  );

  // Send message to LLM pipeline
  const handleSendMessage = useCallback(
    async (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      if (isSubmittingRef.current) {
        return; // Prevent duplicate turn submission
      }
      isSubmittingRef.current = true;

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: cleanText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setPipelineState('THINKING');
      addEvent('llm.request.started', 'llm', `Dispatching turn to model: ${pipelineConfig.llm}`, 'info');

      // Abort any in-flight request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            sessionId,
            message: cleanText,
            flow: pipelineConfig.flow,
            model: pipelineConfig.llm,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const replyText = data.response || data.botReply || data.text;
        if (!replyText) {
          throw new Error('Received empty response from server.');
        }

        addEvent('llm.request.completed', 'llm', `Generated response in ${data.latencyMs || 0}ms`, 'success');

        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: replyText,
          timestamp: Date.now(),
          latencyMs: data.latencyMs,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setMetrics({
          vadDurationMs: 25,
          sttDurationMs: 95,
          llmTtftMs: data.latencyMs || 220,
          ttsDurationMs: 80,
          totalLatencyMs: (data.latencyMs || 220) + 120,
        });

        speakText(replyText);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setPipelineState(sessionId ? 'CONNECTED' : 'IDLE');
        addEvent('llm.error', 'llm', `Inference error: ${err.message}`, 'error');
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [sessionId, pipelineConfig, addEvent, speakText, getAuthToken, onOpenAuth]
  );

  // Clean stop of microphone and VAD loop
  const stopMicrophoneStream = useCallback(() => {
    isListeningRef.current = false;
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
    vadStateRef.current.accumulatedText = '';
    setIsVadSpeaking(false);
    setMicEnergy(0);
    setInterimTranscript('');
    setPipelineState(sessionId ? 'CONNECTED' : 'IDLE');
  }, [sessionId]);

  // Master Voice Ingress & VAD State Machine
  const toggleListening = useCallback(async () => {
    if (isListeningRef.current) {
      stopMicrophoneStream();
      addEvent('mic.ingress.stopped', 'vad', 'Microphone ingress paused', 'info');
      return;
    }

    // Check browser speech recognition capability
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addEvent(
        'stt.unsupported',
        'stt',
        'Browser speech recognition is not supported in this browser. Please use Chrome or use the text input below.',
        'warning'
      );
      return;
    }

    setPipelineState('REQUESTING_MIC');
    await ensureAudioUnlocked();
    setAutoplayBlocked(false);

    try {
      let stream: MediaStream | null = null;
      if (navigator.mediaDevices?.getUserMedia) {
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
        const MIN_VOLUME_THRESHOLD = 0.035;
        const ONSET_MIN_DURATION_MS = 150;
        const SILENCE_TIMEOUT_MS = 700;

        const processVadFrame = () => {
          if (!analyserRef.current || !isListeningRef.current) return;
          analyserRef.current.getByteFrequencyData(buffer);

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

          if (rms > MIN_VOLUME_THRESHOLD) {
            if (vs.silenceTimer) {
              clearTimeout(vs.silenceTimer);
              vs.silenceTimer = null;
            }

            if (!vs.isSpeaking) {
              if (!vs.speechStartTime) {
                vs.speechStartTime = now;
              } else if (now - vs.speechStartTime >= ONSET_MIN_DURATION_MS) {
                vs.isSpeaking = true;
                setIsVadSpeaking(true);
                addEvent('vad.speech_start', 'vad', `Speech onset detected (RMS: ${rms.toFixed(3)})`, 'info');
              }
            }
          } else {
            vs.speechStartTime = null;

            if (vs.isSpeaking && !vs.silenceTimer) {
              vs.silenceTimer = setTimeout(() => {
                vs.isSpeaking = false;
                vs.silenceTimer = null;
                setIsVadSpeaking(false);

                // Commit turn ONLY if genuine transcript was captured
                const textToSubmit = vs.accumulatedText.trim();
                vs.accumulatedText = '';
                setInterimTranscript('');

                if (textToSubmit) {
                  addEvent('browser_stt.final_transcript', 'stt', `Turn finalized: "${textToSubmit}"`, 'success');
                  handleSendMessage(textToSubmit);
                }
              }, SILENCE_TIMEOUT_MS);
            }
          }

          animFrameRef.current = requestAnimationFrame(processVadFrame);
        };

        animFrameRef.current = requestAnimationFrame(processVadFrame);
      }

      // Initialize Web Speech Recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setPipelineState('LISTENING');
        addEvent('stt.listening', 'stt', 'Microphone ingress active and listening', 'success');
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
          const finalUtterance = final.trim();
          vadStateRef.current.accumulatedText = '';
          setInterimTranscript('');
          addEvent('browser_stt.final_transcript', 'stt', `Transcribed: "${finalUtterance}"`, 'success');
          handleSendMessage(finalUtterance);
        } else if (interim.trim()) {
          vadStateRef.current.accumulatedText = interim.trim();
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          addEvent('stt.error', 'stt', `Speech recognition notice: ${e.error}`, 'warning');
        }
      };

      recognition.onend = () => {
        // Deterministic restart if user is still listening
        if (isListeningRef.current && audioStreamRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      isListeningRef.current = false;
      setPipelineState('ERROR');
      addEvent('mic.error', 'transport', `Microphone activation error: ${err.message}`, 'error');
    }
  }, [stopMicrophoneStream, addEvent, handleSendMessage]);

  // Connect/Disconnect Session
  const toggleConnect = useCallback(async () => {
    if (pipelineState === 'CONNECTED' || sessionId) {
      stopMicrophoneStream();
      stopSpeaking();
      if (sessionId) {
        const token = await getAuthToken();
        if (token) {
          fetch(`/api/sessions/${sessionId}/stop`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
      setSessionId(null);
      setPipelineState('DISCONNECTED');
      addEvent('session.ended', 'transport', 'Terminated live session', 'info');
      return;
    }

    setPipelineState('STARTING_SESSION');
    addEvent('session.starting', 'transport', 'Initializing voice agent session...', 'info');

    try {
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          flow: pipelineConfig.flow,
          transport: pipelineConfig.transport,
          stt: pipelineConfig.stt,
          llm: pipelineConfig.llm,
          tts: pipelineConfig.tts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSessionId(data.sessionId);
      setPipelineState('CONNECTED');
      addEvent('session.connected', 'worker', `Session connected (${data.sessionId.slice(0, 14)}...)`, 'success');

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
      setPipelineState('ERROR');
      addEvent('session.error', 'transport', `Failed to connect: ${err.message}`, 'error');
    }
  }, [pipelineState, sessionId, user, onOpenAuth, pipelineConfig, stopMicrophoneStream, stopSpeaking, getAuthToken, addEvent, speakText]);

  // Unlock Autoplay on user click
  const handleUnlockAutoplay = async () => {
    await ensureAudioUnlocked();
    await playAcousticToneFallback(600);
    setAutoplayBlocked(false);
    addEvent('audio.unlocked', 'tts', 'Browser AudioContext unlocked successfully', 'success');
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
        description: activeFlowObj?.description || 'Engineered voice assistant',
        transport: pipelineConfig.transport,
        vad: pipelineConfig.vad,
        stt: pipelineConfig.stt,
        llm: pipelineConfig.llm,
        tts: pipelineConfig.tts,
        flow: pipelineConfig.flow,
        pitch: voiceTuning.pitch,
        speed: voiceTuning.speed,
        accent: voiceTuning.accent,
        voiceId: voiceTuning.voiceId,
        gender: voiceTuning.gender,
        latencyTargetMs: 280,
      });
      setSavedAgentSuccess(true);
      setTimeout(() => setSavedAgentSuccess(false), 3000);
      addEvent('db.agent_saved', 'worker', 'Voice agent preset saved to Cloud Firestore', 'success');
    } catch (err: any) {
      addEvent('db.error', 'worker', `Database error: ${err.message}`, 'error');
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
      addEvent('db.warning', 'worker', 'No conversation turns to save in session', 'warning');
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
        status: pipelineState === 'CONNECTED' ? 'active' : 'completed',
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          text: m.content,
          timestamp: m.timestamp,
          latencyMs: m.latencyMs,
        })),
      });
      addEvent('db.transcript_saved', 'worker', 'Session transcript saved to Firestore', 'success');
    } catch (err: any) {
      addEvent('db.error', 'worker', `Database error: ${err.message}`, 'error');
    }
  };

  if (!isOpen) return null;

  const activeFlow = flows.find((f) => f.id === pipelineConfig.flow) || flows[0];
  const isListening = pipelineState === 'LISTENING';
  const isSpeaking = pipelineState === 'SPEAKING';
  const isProcessing = pipelineState === 'THINKING' || pipelineState === 'STARTING_SESSION';
  const isConnected = pipelineState === 'CONNECTED' || isListening || isSpeaking || isProcessing;

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
                  Tilted STUDIO
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-400/30 text-emerald-400 bg-emerald-400/10">
                  {pipelineState}
                </span>
              </div>
              <p className="text-[10px] font-mono text-white/40 flex items-center gap-1.5 flex-wrap">
                <span>Persona: <strong className="text-white/70 font-medium">{activeFlow?.name || 'Customer Support'}</strong></span>
                <span className="text-white/20">•</span>
                <span className="text-purple-300">Pitch {voiceTuning.pitch.toFixed(2)}x</span>
                <span className="text-white/20">•</span>
                <span className="text-amber-300">Speed {voiceTuning.speed.toFixed(2)}x</span>
                <span className="text-white/20">•</span>
                <span className="text-white/60">{ACCENT_OPTIONS.find((a) => a.id === voiceTuning.accent)?.label || 'US'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive Test Pyvex Voice Simulator */}
            <button
              id="header-open-test-simulator-button"
              onClick={() => setIsTestSimulatorOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center gap-1.5 transition-all shadow-sm"
              title="Open Interactive Real-Time Voice Conversation Simulator"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Test Pyvex Voice</span>
            </button>

            {/* Acoustic Voice Tuning (Pitch, Speed, Accent) */}
            <button
              id="header-open-voice-tuning-button"
              onClick={() => setIsVoiceTuningOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex items-center gap-1.5 transition-all shadow-sm"
              title="Acoustic Voice Tuning: Pitch, Speed & Accent Calibration"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden md:inline">Voice Tuning</span>
            </button>

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

            {/* Save Session Transcript to Database */}
            {messages.length > 0 && (
              <button
                onClick={handleSaveSessionToCloud}
                className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 flex items-center gap-1.5 transition-all shadow-sm"
                title="Save conversation transcript to Cloud Firestore"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden lg:inline">Save Transcript</span>
              </button>
            )}

            {/* Pipeline Diagnostic Triage Button */}
            <button
              id="header-open-triage-button"
              onClick={() => setIsTriageOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 flex items-center gap-1.5 transition-all shadow-sm"
              title="Run 5-Layer Pipeline Diagnostic Triage"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Diagnostic Triage</span>
            </button>

            {/* Interactive Audio Fluid Mesh Orb Overlay Trigger */}
            <button
              id="header-open-orb-overlay-button"
              onClick={() => setIsOrbOverlayOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider border border-[#7047FF]/50 bg-[#7047FF]/15 hover:bg-[#7047FF]/25 text-[#c4b5fd] flex items-center gap-1.5 transition-all shadow-sm"
              title="Launch Interactive Audio Fluid Mesh Orb Overlay"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#20E99A] animate-pulse" />
              <span className="hidden sm:inline">Orb Visualizer</span>
            </button>

            {/* Connect / Disconnect button */}
            <button
              onClick={toggleConnect}
              disabled={pipelineState === 'STARTING_SESSION'}
              className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider font-semibold transition-all ${
                isConnected
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-[#f4f1eb] text-[#0b0c0e] hover:bg-white shadow-md'
              }`}
            >
              {pipelineState === 'STARTING_SESSION'
                ? 'Connecting...'
                : isConnected
                ? 'End Session'
                : 'Start Session'}
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
          {/* Visualizer Mode Header: Switch between Pipeline Nodes & 3D Fluid Mesh Orb, with Style Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md">
                <button
                  id="visualizer-tab-pipeline"
                  onClick={() => setVisualizerTab('pipeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                    visualizerTab === 'pipeline'
                      ? 'bg-white/10 text-white font-medium border border-white/15 shadow-sm'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Pipeline Architecture
                </button>
                <button
                  id="visualizer-tab-orb"
                  onClick={() => setVisualizerTab('orb')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    visualizerTab === 'orb'
                      ? 'bg-[#7047FF]/30 text-[#c4b5fd] font-medium border border-[#7047FF]/50 shadow-sm'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#20E99A]" />
                  <span>Fluid Mesh Orb</span>
                </button>
              </div>

              {/* Fluid Mesh Overlay Style Toggles */}
              <div
                id="livestudio-mesh-style-controls"
                className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md shadow-sm"
              >
                <span className="hidden sm:inline px-2 text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Mesh Style:
                </span>
                {(['pulse', 'flow', 'geometric'] as FluidMeshStyle[]).map((style) => {
                  const isActive = fluidMeshStyle === style;
                  return (
                    <button
                      key={style}
                      id={`livestudio-toggle-${style}`}
                      onClick={() => {
                        setFluidMeshStyle(style);
                        if (visualizerTab !== 'orb') {
                          setVisualizerTab('orb');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                      title={`Switch fluid mesh overlay style to ${style}`}
                    >
                      {style === 'pulse' && <Radio className="w-3.5 h-3.5 text-[#20E99A]" />}
                      {style === 'flow' && <Waves className="w-3.5 h-3.5 text-[#22D3EE]" />}
                      {style === 'geometric' && <Boxes className="w-3.5 h-3.5 text-[#FBBF24]" />}
                      <span className="capitalize">{style}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              id="expand-orb-overlay-button"
              onClick={() => setIsOrbOverlayOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-[#7047FF]/40 bg-[#7047FF]/10 hover:bg-[#7047FF]/20 text-[#c4b5fd] text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              title="Launch Immersive Fullscreen Fluid Orb Overlay"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#20E99A]" />
              <span className="hidden sm:inline">Holographic Overlay</span>
            </button>
          </div>

          {/* Active Visualizer Component */}
          {visualizerTab === 'pipeline' ? (
            <PipelineVisualizer
              config={pipelineConfig}
              metrics={metrics}
              isListening={isListening}
              isSpeaking={isSpeaking}
              isProcessing={isProcessing}
            />
          ) : (
            <div className="h-64 sm:h-80 w-full">
              <FluidOrbMeshVisualizer
                analyserNode={analyserRef.current}
                micEnergy={micEnergy}
                isVadSpeaking={isVadSpeaking}
                pipelineState={pipelineState}
                interimTranscript={interimTranscript}
                onToggleMic={toggleListening}
                isMicActive={isListening}
                meshStyle={fluidMeshStyle}
                onMeshStyleChange={setFluidMeshStyle}
                className="h-full w-full shadow-2xl"
              />
            </div>
          )}

          {/* Central Stage: Dialogue Stream & Telemetry Console */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-stretch">
            {/* Conversation Stream & Master Trigger */}
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
                onReplayVoice={(text) => speakText(text)}
              />

              {/* Ingress Trigger & Query Input */}
              <VoiceControls
                isListening={isListening}
                isSpeaking={isSpeaking}
                ttsAudioEnabled={ttsAudioEnabled}
                micEnergy={micEnergy}
                isVadSpeaking={isVadSpeaking}
                autoplayBlocked={autoplayBlocked}
                selectedVoiceId={voiceTuning.voiceId}
                onSelectVoiceId={(vId) => {
                  setSelectedVoiceId(vId);
                  setVoiceTuning((prev) => ({ ...prev, voiceId: vId }));
                  addEvent('voice.changed', 'tts', `Active voice model updated: ${vId.slice(0, 8)}...`, 'info');
                }}
                onOpenVoiceSettings={() => setIsVoiceTuningOpen(true)}
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

            {/* Telemetry Diagnostics Inspector */}
            <div className="lg:col-span-1 flex flex-col">
              <EventsLogPanel events={events} onClearEvents={() => setEvents([])} />
            </div>
          </div>
        </div>
      </div>

      {/* Voice Tuning Panel (Pitch, Speed, Accent) */}
      <VoiceSettingsPanel
        isOpen={isVoiceTuningOpen}
        onClose={() => setIsVoiceTuningOpen(false)}
        activeFlowId={pipelineConfig.flow}
        tuning={voiceTuning}
        onUpdateTuning={(newTuning) => {
          setVoiceTuning(newTuning);
          setSelectedVoiceId(newTuning.voiceId);
          addEvent(
            'voice.calibrated',
            'tts',
            `Calibrated acoustics: Pitch ${newTuning.pitch.toFixed(2)}x, Speed ${newTuning.speed.toFixed(2)}x (${newTuning.accent})`,
            'info'
          );
        }}
        flows={flows}
        onAppliedToast={(msg) => {
          addEvent('voice.applied', 'tts', msg, 'info');
        }}
      />

      {/* Pipeline Architecture & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={pipelineConfig}
        onSaveConfig={(newConfig) => {
          setPipelineConfig(newConfig);
          addEvent('config.updated', 'worker', `Updated pipeline flow to ${newConfig.flow}`, 'info');
        }}
        services={services}
        flows={flows}
        voiceTuning={voiceTuning}
        onUpdateVoiceTuning={(newTuning) => {
          setVoiceTuning(newTuning);
          setSelectedVoiceId(newTuning.voiceId);
          addEvent(
            'voice.calibrated',
            'tts',
            `Calibrated acoustics: Pitch ${newTuning.pitch.toFixed(2)}x, Speed ${newTuning.speed.toFixed(2)}x`,
            'info'
          );
        }}
      />

      {/* Pipeline Diagnostic Triage Modal */}
      <PipelineTriageModal
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
        onRunTestUtterance={(text) => handleSendMessage(text)}
      />

      {/* Interactive Conversation Test Simulator */}
      <ConversationTestSimulator
        isOpen={isTestSimulatorOpen}
        onClose={() => setIsTestSimulatorOpen(false)}
        initialVoiceId={voiceTuning.voiceId}
        initialGender={voiceTuning.gender}
        initialFlow={pipelineConfig.flow}
        onPersistDraft={(draft) => {
          setVoiceTuning((prev) => ({
            ...prev,
            pitch: draft.pitch,
            speed: draft.rate,
            gender: draft.gender,
            voiceId: draft.voiceId,
          }));
          setSelectedVoiceId(draft.voiceId);
          addEvent(
            'voice.calibrated',
            'tts',
            `Simulator saved draft: Pitch ${draft.pitch.toFixed(2)}x, Speed ${draft.rate.toFixed(2)}x`,
            'info'
          );
        }}
      />

      {/* Full-Screen Holographic Fluid Mesh Orb Visualizer Overlay */}
      {isOrbOverlayOpen && (
        <FluidOrbMeshVisualizer
          isOverlay={true}
          onCloseOverlay={() => setIsOrbOverlayOpen(false)}
          analyserNode={analyserRef.current}
          micEnergy={micEnergy}
          isVadSpeaking={isVadSpeaking}
          pipelineState={pipelineState}
          interimTranscript={interimTranscript}
          onToggleMic={toggleListening}
          isMicActive={isListening}
          meshStyle={fluidMeshStyle}
          onMeshStyleChange={setFluidMeshStyle}
        />
      )}
    </div>
  );
};
