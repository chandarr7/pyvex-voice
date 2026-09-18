/**
 * The live conversation, over a real WebRTC connection to the voice worker.
 *
 * Speech recognition and synthesis both happen in the worker. The browser
 * captures a microphone track, plays the returned audio track, and reports the
 * state the peer connection is actually in.
 *
 * Every state here is entered only after the step it names succeeded, so a
 * label can never claim a capability that failed. The event timeline comes
 * from the worker's own frames rather than being synthesised here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api, describeApiError, type VoiceEvent } from '../lib/api';
import { MicrophoneDeniedError, VoiceConnection, type PeerState } from './webrtcConnection';

export type VoiceSessionState =
  | 'IDLE'
  | 'REQUESTING_MIC'
  | 'STARTING_SESSION'
  | 'NEGOTIATING'
  | 'CONNECTED'
  | 'SPEAKING'
  | 'LISTENING'
  | 'ERROR'
  | 'DISCONNECTED';

export interface VoiceSessionLogEntry {
  id: string;
  event: string;
  detail: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

/** Measured turn timings. A value is absent until something measured it. */
export interface TurnMetrics {
  llmDurationMs?: number;
  ttsDurationMs?: number;
  bargeInLatencyMs?: number;
}

export interface VoiceSessionController {
  state: VoiceSessionState;
  sessionId: string | null;
  errorMessage: string | null;
  log: VoiceSessionLogEntry[];
  metrics: TurnMetrics;
  /** The worker's audio, for a media element to play. */
  remoteStream: MediaStream | null;
  connect: (personaId: string, voiceProfileId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  clearLog: () => void;
}

let sequence = 0;
const nextId = () => `log_${Date.now()}_${(sequence += 1)}`;

/** How a worker event reads in the log, and how severe it is. */
const EVENT_PRESENTATION: Record<string, { detail: string; level: VoiceSessionLogEntry['level'] }> = {
  'session.created': { detail: 'Session created', level: 'info' },
  'transport.connecting': { detail: 'Establishing media connection', level: 'info' },
  'transport.connected': { detail: 'Media connection established', level: 'success' },
  'transport.disconnected': { detail: 'Media connection closed', level: 'info' },
  'transport.failed': { detail: 'Media connection failed', level: 'error' },
  'user.speech.started': { detail: 'Speech detected', level: 'info' },
  'user.speech.stopped': { detail: 'Speech ended', level: 'info' },
  'stt.final': { detail: 'Transcript received', level: 'success' },
  'llm.started': { detail: 'Model generating', level: 'info' },
  'llm.completed': { detail: 'Model responded', level: 'success' },
  'tts.started': { detail: 'Speaking', level: 'info' },
  'tts.first_audio': { detail: 'First audio', level: 'info' },
  'tts.completed': { detail: 'Finished speaking', level: 'info' },
  'interruption.started': { detail: 'Interrupted by caller', level: 'warning' },
  'session.completed': { detail: 'Session ended', level: 'info' },
  'session.failed': { detail: 'Session failed', level: 'error' },
};

/** How long between polls for worker events while a call is live. */
const EVENT_POLL_MS = 1_000;

export function useVoiceSession(): VoiceSessionController {
  const [state, setState] = useState<VoiceSessionState>('IDLE');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [log, setLog] = useState<VoiceSessionLogEntry[]>([]);
  const [metrics, setMetrics] = useState<TurnMetrics>({});
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const connectionRef = useRef<VoiceConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventMsRef = useRef(0);

  const addLog = useCallback(
    (event: string, detail: string, level: VoiceSessionLogEntry['level'] = 'info') => {
      setLog((prev) => [...prev.slice(-199), { id: nextId(), event, detail, level, timestamp: Date.now() }]);
    },
    []
  );

  const clearLog = useCallback(() => setLog([]), []);

  /** Fold one worker event into the log, the metrics and the speaking state. */
  const applyEvent = useCallback((event: VoiceEvent) => {
    const presentation = EVENT_PRESENTATION[event.event];
    setLog((prev) => [
      ...prev.slice(-199),
      {
        id: nextId(),
        event: event.event,
        detail: presentation?.detail ?? event.event,
        level: presentation?.level ?? 'info',
        timestamp: event.atMs,
      },
    ]);

    // Only measured values reach the UI; an absent one stays absent.
    setMetrics((prev) => {
      const next = { ...prev };
      if (event.event === 'llm.completed' && typeof event.durationMs === 'number') {
        next.llmDurationMs = event.durationMs;
      }
      if (event.event === 'tts.completed') {
        if (typeof event.durationMs === 'number') next.ttsDurationMs = event.durationMs;
        if (typeof event.bargeInLatencyMs === 'number') {
          next.bargeInLatencyMs = event.bargeInLatencyMs;
        }
      }
      return next;
    });

    setState((prev) => {
      // Never overwrite a terminal state with a late-arriving event.
      if (prev === 'ERROR' || prev === 'DISCONNECTED' || prev === 'IDLE') return prev;
      if (event.event === 'tts.started') return 'SPEAKING';
      if (event.event === 'tts.completed' || event.event === 'interruption.started') return 'LISTENING';
      if (event.event === 'user.speech.started') return 'LISTENING';
      if (event.event === 'session.failed') return 'ERROR';
      return prev;
    });

    if (event.event === 'session.failed') {
      setErrorMessage('The conversation ended unexpectedly.');
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { events } = await api.voiceEvents(id, lastEventMsRef.current);
          for (const event of events) {
            lastEventMsRef.current = Math.max(lastEventMsRef.current, event.atMs);
            applyEvent(event);
          }
        } catch {
          // A dropped poll loses nothing: the next one asks from the same
          // watermark, so no event is skipped.
        }
      }, EVENT_POLL_MS);
    },
    [applyEvent, stopPolling]
  );

  /**
   * Release everything this session holds, without deciding what state to
   * report. The caller owns that, so a failure's own state is not overwritten
   * by the cleanup that follows it.
   */
  const teardown = useCallback(async () => {
    stopPolling();
    const connection = connectionRef.current;
    connectionRef.current = null;
    await connection?.close();
    setRemoteStream(null);

    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);

    if (id) {
      try {
        await api.stopVoiceSession(id);
        addLog('session.stopped', 'Session closed', 'info');
      } catch {
        // The session expires on its own; a failed stop changes nothing here.
      }
    }
  }, [addLog, stopPolling]);

  const disconnect = useCallback(async () => {
    await teardown();
    setState('DISCONNECTED');
  }, [teardown]);

  const handlePeerState = useCallback(
    (peerState: PeerState, detail?: string) => {
      switch (peerState) {
        case 'acquiring-microphone':
          setState('REQUESTING_MIC');
          addLog('microphone.requested', 'Requesting microphone');
          break;
        case 'negotiating':
          setState('NEGOTIATING');
          addLog('transport.negotiating', 'Negotiating media connection');
          break;
        case 'connected':
          // The one place CONNECTED is set, and only from the peer
          // connection's own state.
          setState('CONNECTED');
          addLog('transport.connected', 'Media connection established', 'success');
          break;
        case 'disconnected':
          addLog('transport.disconnected', 'Media connection interrupted', 'warning');
          break;
        case 'failed':
          setState('ERROR');
          addLog('transport.failed', `Connection failed (${detail ?? 'unknown'})`, 'error');
          break;
        case 'closed':
          stopPolling();
          break;
        default:
          break;
      }
    },
    [addLog, stopPolling]
  );

  const connect = useCallback(
    async (personaId: string, voiceProfileId?: string) => {
      setErrorMessage(null);
      setMetrics({});
      lastEventMsRef.current = 0;
      setState('STARTING_SESSION');
      addLog('session.requested', `Starting "${personaId}"`);

      let created;
      try {
        created = await api.startVoiceSession({ personaId, voiceProfileId });
      } catch (err) {
        const message = describeApiError(err);
        addLog('session.failed', message, 'error');
        setErrorMessage(message);
        setState('ERROR');
        return;
      }

      const id = created.session.id;
      sessionIdRef.current = id;
      setSessionId(id);

      const connection = new VoiceConnection(id, {
        onStateChange: handlePeerState,
        onRemoteStream: setRemoteStream,
        onError: (message) => setErrorMessage(message),
      });
      connectionRef.current = connection;

      try {
        await connection.connect();
      } catch (err) {
        const message =
          err instanceof MicrophoneDeniedError
            ? 'Microphone access was denied. Allow it in your browser, then try again.'
            : err instanceof ApiError
              ? describeApiError(err)
              : (err as Error).message;
        setErrorMessage(message);
        setState('ERROR');
        // Released without resetting the state: the caller needs to see why
        // the call failed, not that it ended.
        void teardown();
        return;
      }

      startPolling(id);
    },
    [addLog, handlePeerState, startPolling, teardown]
  );

  useEffect(
    () => () => {
      stopPolling();
      void connectionRef.current?.close();
    },
    [stopPolling]
  );

  return {
    state,
    sessionId,
    errorMessage,
    log,
    metrics,
    remoteStream,
    connect,
    disconnect,
    clearLog,
  };
}
