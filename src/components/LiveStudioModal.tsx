/**
 * The live conversation surface.
 *
 * Audio runs over a real WebRTC connection to the voice worker: the microphone
 * is captured by the browser, everything else happens in the pipeline. This
 * component plays the returned audio and renders the state the connection is
 * actually in.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Phone, PhoneOff, X } from 'lucide-react';

import { api, type FlowInfo, type VoiceReadiness } from '../lib/api';
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
  NEGOTIATING: 'Connecting…',
  CONNECTED: 'Connected',
  LISTENING: 'Listening',
  SPEAKING: 'Speaking',
  ERROR: 'Error',
  DISCONNECTED: 'Disconnected',
};

const STATE_TONE: Record<VoiceSessionState, string> = {
  IDLE: 'bg-white/20',
  REQUESTING_MIC: 'bg-amber-400',
  STARTING_SESSION: 'bg-amber-400',
  NEGOTIATING: 'bg-amber-400',
  CONNECTED: 'bg-emerald-400',
  LISTENING: 'bg-emerald-400',
  SPEAKING: 'bg-[#24D8ED]',
  ERROR: 'bg-red-500',
  DISCONNECTED: 'bg-white/20',
};

const LIVE_STATES: VoiceSessionState[] = ['CONNECTED', 'LISTENING', 'SPEAKING'];
const BUSY_STATES: VoiceSessionState[] = ['REQUESTING_MIC', 'STARTING_SESSION', 'NEGOTIATING'];

export const LiveStudioModal: React.FC<LiveStudioModalProps> = ({
  isOpen,
  onClose,
  initialFlowId,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const session = useVoiceSession();

  const [flows, setFlows] = useState<FlowInfo[]>([]);
  const [selectedFlow, setSelectedFlow] = useState(initialFlowId ?? '');
  const [readiness, setReadiness] = useState<VoiceReadiness | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { state, disconnect, remoteStream } = session;
  const isLive = LIVE_STATES.includes(state);
  const isBusy = BUSY_STATES.includes(state);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();

    api
      .listFlows()
      .then((flowList) => {
        if (controller.signal.aborted) return;
        setFlows(flowList);
        setSelectedFlow((prev) => prev || initialFlowId || flowList[0]?.id || '');
        setCatalogError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError('Could not load conversation options.');
      });

    // Readiness needs a signed-in caller, so it is only asked for once there is one.
    if (user) {
      api
        .voiceReadiness()
        .then((result) => !controller.signal.aborted && setReadiness(result))
        .catch(() => {
          if (!controller.signal.aborted) {
            setReadiness({ status: 'unreachable', reason: 'Could not reach the voice service.' });
          }
        });
    }

    return () => controller.abort();
  }, [isOpen, initialFlowId, user]);

  // Attach the worker's audio track once it arrives.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = remoteStream;
    if (remoteStream) {
      void element.play().catch(() => {
        // Autoplay policies can block the first play; the element stays
        // attached and the control below lets the user start it.
      });
    }
  }, [remoteStream]);

  // Release the microphone, the peer connection and the worker session.
  useEffect(() => {
    if (!isOpen && (isLive || isBusy)) void disconnect();
  }, [isOpen, isLive, isBusy, disconnect]);

  const activeFlow = useMemo(() => flows.find((f) => f.id === selectedFlow), [flows, selectedFlow]);
  const voiceProfiles = readiness?.voiceProfiles ?? [];
  const canStart = Boolean(user) && Boolean(selectedFlow) && readiness?.status === 'ready' && !isBusy;

  const handleStart = useCallback(() => {
    void session.connect(selectedFlow, selectedVoice || undefined);
  }, [session, selectedFlow, selectedVoice]);

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

        {/* The worker's audio. Controls stay available so a viewer can start
            playback themselves if autoplay was blocked. */}
        <audio ref={audioRef} autoPlay playsInline controls className="sr-only" data-testid="remote-audio" />

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

        {/* Readiness comes from the worker, so an unavailable voice service is
            stated up front rather than discovered on a failed Start. */}
        {user && readiness && readiness.status !== 'ready' && (
          <div
            data-testid="voice-unavailable-notice"
            className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl border border-white/15 bg-white/[0.04] text-xs text-white/70"
          >
            Live voice isn&apos;t available on this deployment
            {readiness.reason ? `: ${readiness.reason}` : '.'}
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
          <section className="flex flex-col min-h-0 gap-4">
            {!isLive && (
              <div className="space-y-4">
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

                {voiceProfiles.length > 0 && (
                  <label className="block">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-white/40">Voice</span>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="mt-2 w-full bg-[#0D0F13] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                    >
                      <option value="">Default</option>
                      {voiceProfiles.map((profile) => (
                        <option key={profile} value={profile}>
                          {profile}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {isLive && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-sm text-white/80">
                  {state === 'SPEAKING' ? 'The agent is speaking.' : 'Listening — just talk.'}
                </p>
                <p className="mt-1 text-[11px] text-white/40">
                  Speak over the agent at any time to interrupt it.
                </p>
              </div>
            )}

            {/* Only measured values are shown; anything unmeasured reads N/A. */}
            <dl className="grid grid-cols-3 gap-2 text-center" data-testid="turn-metrics">
              {(
                [
                  ['Model', session.metrics.llmDurationMs],
                  ['Speech', session.metrics.ttsDurationMs],
                  ['Barge-in', session.metrics.bargeInLatencyMs],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] py-2">
                  <dt className="text-[10px] font-mono uppercase tracking-wider text-white/35">{label}</dt>
                  <dd className="text-sm text-white/80 tabular-nums">
                    {typeof value === 'number' ? `${value}ms` : 'N/A'}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              {!isLive ? (
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-black"
                >
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Start conversation
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void session.disconnect()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/90 hover:bg-red-500 text-sm font-medium text-white"
                >
                  <PhoneOff className="w-4 h-4" /> End
                </button>
              )}
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
