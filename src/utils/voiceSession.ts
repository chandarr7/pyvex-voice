/**
 * The state machine behind the live conversation UI.
 *
 * Each state is entered only once the step it names has actually succeeded:
 * CONNECTED follows a session the server created, LISTENING follows a running
 * recogniser, SPEAKING follows the synthesiser's start event. The UI renders
 * this value directly, so a label cannot claim a capability that failed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api, describeApiError, type ChatTurnResult } from '../lib/api';
import { isSpeechSynthesisSupported, speak, stopSpeaking, SpeechError } from './audioEngine';
import { useMicrophone } from './microphone';
import { isSpeechRecognitionSupported, useSpeechRecognition } from './speechRecognition';

export type VoiceSessionState =
  | 'IDLE'
  | 'REQUESTING_MIC'
  | 'STARTING_SESSION'
  | 'CONNECTED'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR'
  | 'DISCONNECTED';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Measured provider latency for an assistant turn. Absent when unmeasured. */
  llmLatencyMs?: number;
}

export interface VoiceSessionLogEntry {
  id: string;
  /** Describes what this application did. Not a framework event name. */
  event: string;
  detail: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface VoiceSessionCapabilities {
  microphone: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
}

export interface VoiceSessionController {
  state: VoiceSessionState;
  capabilities: VoiceSessionCapabilities;
  transcript: TranscriptEntry[];
  log: VoiceSessionLogEntry[];
  interimTranscript: string;
  micLevel: number;
  errorMessage: string | null;
  sessionId: string | null;
  connect: (flow: string, model?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  sendText: (text: string) => Promise<void>;
  interrupt: () => void;
  clearLog: () => void;
}

let sequence = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${(sequence += 1)}`;

export function useVoiceSession(): VoiceSessionController {
  const [state, setState] = useState<VoiceSessionState>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [log, setLog] = useState<VoiceSessionLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  // Read the live state from event callbacks without re-creating them.
  const stateRef = useRef<VoiceSessionState>(state);
  const turnAbortRef = useRef<AbortController | null>(null);
  const wantsListeningRef = useRef(false);

  const capabilities: VoiceSessionCapabilities = {
    microphone: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
    speechRecognition: isSpeechRecognitionSupported(),
    speechSynthesis: isSpeechSynthesisSupported(),
  };

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addLog = useCallback(
    (event: string, detail: string, level: VoiceSessionLogEntry['level'] = 'info') => {
      setLog((prev) => [
        ...prev.slice(-199),
        { id: nextId('log'), event, detail, level, timestamp: Date.now() },
      ]);
    },
    []
  );

  const clearLog = useCallback(() => setLog([]), []);

  /** Cancel in-flight generation and stop playback. */
  const interrupt = useCallback(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    stopSpeaking();
    addLog('conversation.interrupted', 'Playback stopped and pending reply cancelled', 'warning');
    setState((prev) => (prev === 'SPEAKING' || prev === 'THINKING' ? 'CONNECTED' : prev));
  }, [addLog]);

  const speakReply = useCallback(
    async (text: string) => {
      if (!capabilities.speechSynthesis) {
        addLog('tts.unavailable', 'Browser speech synthesis is not available', 'warning');
        setState('CONNECTED');
        return;
      }
      try {
        addLog('tts.browser.requested', 'Requesting browser speech synthesis');
        await speak(text, { onStart: () => setState('SPEAKING') });
        addLog('tts.browser.completed', 'Finished speaking');
      } catch (err) {
        const reason = err instanceof SpeechError ? err.reason : 'synthesis-failed';
        addLog('tts.browser.failed', `Speech synthesis failed (${reason})`, 'error');
        setErrorMessage(
          reason === 'autoplay-blocked'
            ? 'Your browser blocked audio. Interact with the page, then try again.'
            : 'Could not play the reply aloud.'
        );
      } finally {
        setState((prev) => (prev === 'SPEAKING' ? 'CONNECTED' : prev));
      }
    },
    [addLog, capabilities.speechSynthesis]
  );

  const submitTurn = useCallback(
    async (text: string) => {
      const activeSession = sessionIdRef.current;
      if (!activeSession) return;

      const trimmed = text.trim();
      if (!trimmed) return;

      turnAbortRef.current?.abort();
      const controller = new AbortController();
      turnAbortRef.current = controller;

      setTranscript((prev) => [
        ...prev,
        { id: nextId('turn'), role: 'user', content: trimmed, timestamp: Date.now() },
      ]);
      setState('THINKING');
      setErrorMessage(null);
      addLog('llm.request.started', `Sent "${trimmed.slice(0, 60)}"`);

      let result: ChatTurnResult;
      try {
        result = await api.sendSessionTurn(activeSession, trimmed, controller.signal);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;

        // The assistant produced nothing, so nothing is added to the
        // transcript and nothing is spoken.
        const message = describeApiError(err);
        const code = err instanceof ApiError ? err.code : 'UNKNOWN';
        addLog('llm.request.failed', `${code}: ${message}`, 'error');
        setErrorMessage(message);
        setState(code === 'SESSION_EXPIRED' || code === 'SESSION_NOT_FOUND' ? 'DISCONNECTED' : 'ERROR');
        return;
      } finally {
        if (turnAbortRef.current === controller) turnAbortRef.current = null;
      }

      addLog('llm.request.completed', `Reply in ${result.metrics.llmLatencyMs}ms via ${result.model}`, 'success');
      setTranscript((prev) => [
        ...prev,
        {
          id: nextId('turn'),
          role: 'assistant',
          content: result.reply,
          timestamp: Date.now(),
          llmLatencyMs: result.metrics.llmLatencyMs,
        },
      ]);
      await speakReply(result.reply);
    },
    [addLog, speakReply]
  );

  const handleFinalTranscript = useCallback(
    (finalText: string) => {
      addLog('stt.browser.final_transcript', `Transcribed "${finalText.slice(0, 60)}"`, 'success');
      void submitTurn(finalText);
    },
    [addLog, submitTurn]
  );

  const recognition = useSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
    onError: (error) => {
      addLog('stt.browser.error', `Speech recognition error: ${error}`, 'error');
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        setErrorMessage('Microphone access was blocked for speech recognition.');
        setState('ERROR');
      }
    },
  });

  // Barge-in: any input while the assistant is speaking stops playback.
  const microphone = useMicrophone({
    onInputDetected: () => {
      if (stateRef.current === 'SPEAKING') interrupt();
    },
  });

  const connect = useCallback(
    async (flow: string, model?: string) => {
      setState('STARTING_SESSION');
      setErrorMessage(null);
      addLog('session.start.requested', `Starting "${flow}"`);
      try {
        const result = await api.startSession({ flow, model });
        sessionIdRef.current = result.session.id;
        setSessionId(result.session.id);
        setTranscript([
          { id: nextId('turn'), role: 'assistant', content: result.greeting, timestamp: Date.now() },
        ]);
        setState('CONNECTED');
        addLog('session.start.succeeded', `Session ${result.session.id} ready`, 'success');
        await speakReply(result.greeting);
      } catch (err) {
        const message = describeApiError(err);
        addLog('session.start.failed', message, 'error');
        setErrorMessage(message);
        setState('ERROR');
      }
    },
    [addLog, speakReply]
  );

  const disconnect = useCallback(async () => {
    wantsListeningRef.current = false;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    recognition.stop();
    microphone.stop();
    stopSpeaking();

    const activeSession = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    setState('DISCONNECTED');

    if (activeSession) {
      try {
        await api.stopSession(activeSession);
        addLog('session.stopped', 'Session closed');
      } catch {
        // The session expires on its own; a failed stop changes nothing here.
        addLog('session.stop.failed', 'Could not confirm session close', 'warning');
      }
    }
  }, [addLog, microphone, recognition]);

  const startListening = useCallback(async () => {
    if (!sessionIdRef.current) return;
    if (!capabilities.speechRecognition) {
      setErrorMessage(
        'Speech recognition is not available in this browser. Chrome or Edge supports it; you can also type below.'
      );
      addLog('stt.unsupported', 'Browser has no speech recognition', 'warning');
      setState('ERROR');
      return;
    }

    setState('REQUESTING_MIC');
    const granted = await microphone.start();
    if (!granted) {
      const reason = microphone.error;
      setErrorMessage(
        reason === 'denied'
          ? 'Microphone access was denied. Allow it in your browser, then try again.'
          : 'No microphone is available.'
      );
      addLog('microphone.failed', `Microphone unavailable (${reason ?? 'unknown'})`, 'error');
      setState('ERROR');
      return;
    }

    addLog('microphone.started', 'Microphone capture active', 'success');
    wantsListeningRef.current = true;
    recognition.start();
  }, [addLog, capabilities.speechRecognition, microphone, recognition]);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    recognition.stop();
    microphone.stop();
    addLog('microphone.stopped', 'Microphone capture stopped');
    setState((prev) => (prev === 'LISTENING' ? 'CONNECTED' : prev));
  }, [addLog, microphone, recognition]);

  // LISTENING is entered only once the recogniser reports it is running.
  useEffect(() => {
    if (recognition.listening && wantsListeningRef.current) {
      setState((prev) => (prev === 'REQUESTING_MIC' || prev === 'CONNECTED' ? 'LISTENING' : prev));
    }
  }, [recognition.listening]);

  useEffect(
    () => () => {
      turnAbortRef.current?.abort();
      stopSpeaking();
    },
    []
  );

  return {
    state,
    capabilities,
    transcript,
    log,
    interimTranscript: recognition.interimTranscript,
    micLevel: microphone.level,
    errorMessage,
    sessionId,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText: submitTurn,
    interrupt,
    clearLog,
  };
}
