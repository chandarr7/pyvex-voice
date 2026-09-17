import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { ConversationPanel } from './components/ConversationPanel';
import { VoiceControls } from './components/VoiceControls';
import { EventsLogPanel } from './components/EventsLogPanel';
import { SettingsModal } from './components/SettingsModal';
import { ChatMessage, FrameEvent, PipelineConfig, PipelineMetrics, PresetFlow, ServicesCatalog } from './types';

export function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsAudioEnabled, setTtsAudioEnabled] = useState(true);

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
    tts: 'cartesia-sonic',
    vad: 'silero',
    flow: 'customer_support',
  });

  // Speech Recognition ref
  const recognitionRef = useRef<any>(null);
  const speechSynthesisUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  // Stop current speech synthesis
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Handle interruption
  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    addEvent('InterruptionFrame', 'vad', 'User interrupted assistant speech; flushed downstream queues', 'warning');
  }, [stopSpeaking, addEvent]);

  // Speak assistant response using Web Speech Synthesis
  const speakText = useCallback(
    (text: string) => {
      if (!ttsAudioEnabled || !('speechSynthesis' in window)) return;

      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        addEvent('TTSAudioFrame', 'tts', `Started audio playback (${text.slice(0, 32)}...)`, 'info');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        addEvent('TTSSpeakDoneFrame', 'tts', 'Completed audio packet synthesis', 'success');
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        console.warn('SpeechSynthesis error:', e);
      };

      speechSynthesisUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [ttsAudioEnabled, stopSpeaking, addEvent]
  );

  // Send message to server and handle bot turn
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);

      // Frame pipeline events
      addEvent('UserStoppedSpeakingFrame', 'vad', 'VAD detected end of speech turn', 'info');
      addEvent('TranscriptionFrame', 'stt', `Final transcript: "${text}"`, 'success');
      addEvent('LLMResponseStartFrame', 'llm', 'Aggregator context dispatched to LLM Worker', 'info');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: text,
            flowId: pipelineConfig.flow,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        setIsProcessing(false);

        if (data.metrics) {
          setMetrics(data.metrics);
        }

        const assistantMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          role: 'assistant',
          content: data.botReply,
          timestamp: Date.now(),
          latencyMs: data.metrics?.totalLatencyMs,
          flow: pipelineConfig.flow,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        addEvent('LLMFullResponseEndFrame', 'llm', `Generated ${data.botReply.length} chars`, 'success');

        // Trigger TTS voice
        speakText(data.botReply);
      } catch (err: any) {
        setIsProcessing(false);
        addEvent('ErrorFrame', 'worker', `Turn failure: ${err.message}`, 'error');
      }
    },
    [sessionId, pipelineConfig.flow, addEvent, speakText]
  );

  // Initialize and toggle Web Speech Recognition
  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Your browser does not support the Web Speech API. You can still chat by typing in the input box below.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setInterimTranscript('');
      addEvent('UserStoppedSpeakingFrame', 'transport', 'Microphone paused by user', 'info');
      return;
    }

    try {
      // If assistant is currently speaking, interrupt it when user starts mic
      if (isSpeaking) {
        handleInterrupt();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        addEvent('UserStartedSpeakingFrame', 'transport', 'Audio stream opened on port 3000', 'info');
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

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final) {
          setInterimTranscript('');
          handleSendMessage(final.trim());
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e);
        setIsListening(false);
        setInterimTranscript('');
        if (e.error !== 'no-speech') {
          addEvent('ErrorFrame', 'transport', `Microphone event error: ${e.error}`, 'warning');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  }, [isListening, isSpeaking, handleInterrupt, addEvent, handleSendMessage]);

  // Connect or disconnect session
  const toggleConnect = useCallback(async () => {
    if (isConnected) {
      // Disconnect
      if (sessionId) {
        try {
          await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
        } catch (e) {
          console.error(e);
        }
      }
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopSpeaking();
      setIsConnected(false);
      setSessionId(null);
      addEvent('EndFrame', 'transport', 'Session ended gracefully', 'info');
      return;
    }

    // Connect
    setIsConnecting(true);
    addEvent('StartFrame', 'transport', `Bootstrapping ${pipelineConfig.transport.toUpperCase()} transport pipeline...`, 'info');

    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipelineConfig),
      });

      if (!res.ok) throw new Error('Start failed');
      const data = await res.json();

      setSessionId(data.sessionId);
      setIsConnected(true);
      setIsConnecting(false);

      addEvent('ConnectedFrame', 'transport', `Transport ready (Session: ${data.sessionId})`, 'success');

      // Bot greeting message
      if (data.greeting) {
        const greetingMsg: ChatMessage = {
          id: `greet_${Date.now()}`,
          role: 'assistant',
          content: data.greeting,
          timestamp: Date.now(),
          flow: pipelineConfig.flow,
        };
        setMessages([greetingMsg]);
        speakText(data.greeting);
      }
    } catch (err: any) {
      setIsConnecting(false);
      addEvent('ErrorFrame', 'transport', `Failed to connect: ${err.message}`, 'error');
    }
  }, [isConnected, sessionId, isListening, pipelineConfig, stopSpeaking, addEvent, speakText]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const activeFlow = flows.find((f) => f.id === pipelineConfig.flow) || flows[0];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <Header
        isConnected={isConnected}
        isConnecting={isConnecting}
        isListening={isListening}
        isSpeaking={isSpeaking}
        pipelineConfig={pipelineConfig}
        activeFlowName={activeFlow?.name || 'Customer Support'}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleConnect={toggleConnect}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-5">
        {/* Frame Pipeline Visualizer */}
        <PipelineVisualizer
          config={pipelineConfig}
          metrics={metrics}
          isListening={isListening}
          isSpeaking={isSpeaking}
          isProcessing={isProcessing}
        />

        {/* Central Grid: Conversation & Event Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
          {/* Conversation Stream (2 columns on lg) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
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

            {/* Voice & Text Interaction Controls */}
            <VoiceControls
              isListening={isListening}
              isSpeaking={isSpeaking}
              ttsAudioEnabled={ttsAudioEnabled}
              onToggleMic={toggleListening}
              onToggleTtsAudio={() => {
                if (isSpeaking) stopSpeaking();
                setTtsAudioEnabled(!ttsAudioEnabled);
              }}
              onSendMessage={handleSendMessage}
            />
          </div>

          {/* RTVI & Frame Event Stream (1 column on lg) */}
          <div className="lg:col-span-1">
            <EventsLogPanel events={events} onClearEvents={() => setEvents([])} />
          </div>
        </div>
      </main>

      {/* Pipeline Configuration Modal */}
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
    </div>
  );
}
export default App;
