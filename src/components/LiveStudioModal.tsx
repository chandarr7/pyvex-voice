/**
 * The live conversation surface.
 *
 * Everything shown here is derived from `useVoiceSession`, whose states are
 * entered only after the underlying step succeeds. When a capability is missing
 * the panel says so rather than showing a control that cannot work.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Mic, MicOff, Phone, PhoneOff, Send, Square, X } from 'lucide-react';

import { api, type FlowInfo, type ModelInfo } from '../lib/api';
import { useVoiceSession, type VoiceSessionState } from '../utils/voiceSession';
import { useAuth } from '../context/AuthContext';
import { EventsLogPanel } from './EventsLogPanel';

interface LiveStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFlowId?: string;
  onOpenAuth?: () => void;
}

/** The single place a state becomes user-facing words. */
const STATE_LABELS: Record<VoiceSessionState, string> = {
  IDLE: 'Not connected',
  REQUESTING_MIC: 'Requesting microphone…',
  STARTING_SESSION: 'Starting session…',
  CONNECTED: 'Connected',
  LISTENING: 'Listening',
  THINKING: 'Thinking…',
  SPEAKING: 'Speaking',
  ERROR: 'Error',
  DISCONNECTED: 'Disconnected',
};

const STATE_TONE: Record<VoiceSessionState, string> = {
  IDLE: 'bg-white/20',
  REQUESTING_MIC: 'bg-amber-400',
  STARTING_SESSION: 'bg-amber-400',
  CONNECTED: 'bg-emerald-400',
  LISTENING: 'bg-emerald-400',
  THINKING: 'bg-[#7047FF]',
  SPEAKING: 'bg-[#24D8ED]',
  ERROR: 'bg-red-500',
  DISCONNECTED: 'bg-white/20',
};

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  onClose,
  initialFlowId,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const session = useVoiceSession();

  const [flows, setFlows] = useState<FlowInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedFlow, setSelectedFlow] = useState(initialFlowId ?? '');
  const [selectedModel, setSelectedModel] = useState('');
  const [draft, setDraft] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();

    Promise.all([api.listFlows(), api.listModels()])
      .then(([flowList, modelList]) => {
        if (controller.signal.aborted) return;
        setFlows(flowList);
        setModels(modelList.models);
        setSelectedFlow((prev) => prev || initialFlowId || flowList[0]?.id || '');
        setSelectedModel((prev) => prev || modelList.defaultModel);
        setCatalogError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError('Could not load conversation options.');
      });

    return () => controller.abort();
  }, [isOpen, initialFlowId]);

  const { state, capabilities, disconnect } = session;
  const isConnected = !['IDLE', 'DISCONNECTED', 'STARTING_SESSION'].includes(state);
  const isBusy = state === 'THINKING' || state === 'STARTING_SESSION' || state === 'REQUESTING_MIC';

  // Release the microphone, playback and server session when the panel closes.
  useEffect(() => {
    if (!isOpen && isConnected) void disconnect();
  }, [isOpen, isConnected, disconnect]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !session.sessionId) return;
    setDraft('');
    await session.sendText(text);
  }, [draft, session]);

  const activeFlow = useMemo(() => flows.find((f) => f.id === selectedFlow), [flows, selectedFlow]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
      <div className="bg-[#121316] border border-white/10 sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-4 sm:px-8 py-4 border-b border-white/[0.07] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-serif italic text-white truncate">Live Conversation</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${STATE_TONE[state]}`} aria-hidden="true" />
              <span className="text-[11px] font-mono text-white/60" data-testid="session-state">
                {STATE_LABELS[state]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close live conversation"
            className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {!user && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-100/90">
              <p className="font-medium">Sign in to start a conversation.</p>
              <button type="button" onClick={onOpenAuth} className="mt-1 underline hover:text-white">
                Sign in
              </button>
            </div>
          </div>
        )}

        {/*
          Capability gaps are surfaced before the user tries to use them, rather
          than after a control silently does nothing.
        */}
        {!capabilities.speechRecognition && (
          <div
            className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-white/15 bg-white/[0.04] text-xs text-white/70"
            data-testid="stt-unsupported-notice"
          >
            Speech recognition isn&apos;t available in this browser, so the microphone is disabled.
            Chrome and Edge support it. You can still type your side of the conversation below.
          </div>
        )}
        {!capabilities.speechSynthesis && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-white/15 bg-white/[0.04] text-xs text-white/70">
            This browser can&apos;t speak replies aloud. They will appear as text only.
          </div>
        )}
        {catalogError && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200">
            {catalogError}
          </div>
        )}
        {session.errorMessage && (
          <div
            role="alert"
            className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-200"
          >
            {session.errorMessage}
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4 sm:p-8 overflow-y-auto">
          <section className="flex flex-col min-h-0">
            {!isConnected && (
              <div className="space-y-4 mb-4">
                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-white/40">Scenario</span>
                  <select
                    value={selectedFlow}
                    onChange={(e) => setSelectedFlow(e.target.value)}
                    className="mt-2 w-full bg-[#0D0F13] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {flows.map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name}
                      </option>
                    ))}
                  </select>
                </label>
                {activeFlow && <p className="text-xs text-white/50">{activeFlow.description}</p>}

                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-white/40">Model</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="mt-2 w-full bg-[#0D0F13] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="flex-1 min-h-[200px] overflow-y-auto space-y-3 pr-1">
              {session.transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    entry.role === 'user'
                      ? 'ml-auto bg-[#7047FF]/20 text-white'
                      : 'bg-white/[0.06] text-white/90'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{entry.content}</p>
                  {entry.llmLatencyMs !== undefined && (
                    <span className="mt-1 block text-[10px] font-mono text-white/35">
                      {entry.llmLatencyMs}ms
                    </span>
                  )}
                </div>
              ))}
              {session.interimTranscript && (
                <p className="ml-auto max-w-[85%] text-right text-sm text-white/40 italic">
                  {session.interimTranscript}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isConnected ? (
                  <button
                    type="button"
                    disabled={!user || !selectedFlow || isBusy}
                    onClick={() => session.connect(selectedFlow, selectedModel)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-black"
                  >
                    {state === 'STARTING_SESSION' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    Start conversation
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void session.disconnect()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/90 hover:bg-red-500 text-sm font-medium text-white"
                    >
                      <PhoneOff className="w-4 h-4" /> End
                    </button>

                    <button
                      type="button"
                      disabled={!capabilities.speechRecognition}
                      onClick={() =>
                        state === 'LISTENING' ? session.stopListening() : void session.startListening()
                      }
                      title={
                        capabilities.speechRecognition
                          ? undefined
                          : 'Speech recognition is unavailable in this browser'
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white"
                    >
                      {state === 'LISTENING' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {state === 'LISTENING' ? 'Stop mic' : 'Use microphone'}
                    </button>

                    {(state === 'SPEAKING' || state === 'THINKING') && (
                      <button
                        type="button"
                        onClick={session.interrupt}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 hover:bg-white/10 text-sm text-white"
                      >
                        <Square className="w-3.5 h-3.5" /> Interrupt
                      </button>
                    )}
                  </>
                )}
              </div>

              {state === 'LISTENING' && (
                <div className="h-1 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                  <div
                    className="h-full bg-emerald-400 transition-[width] duration-100"
                    style={{ width: `${Math.min(100, Math.round(session.micLevel * 220))}%` }}
                  />
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!isConnected || isBusy}
                  placeholder={isConnected ? 'Type a message…' : 'Start a conversation first'}
                  aria-label="Message"
                  className="flex-1 min-w-0 bg-[#0D0F13] border border-white/15 rounded-full px-4 py-2 text-sm text-white placeholder-white/30 disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!isConnected || isBusy || !draft.trim()}
                  aria-label="Send message"
                  className="p-2.5 rounded-full bg-[#7047FF] hover:bg-[#7c57ff] disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </section>

          <aside className="min-h-0 hidden lg:block">
            <EventsLogPanel events={session.log} onClearEvents={session.clearLog} />
          </aside>
        </div>
      </div>
    </div>
  );
};
