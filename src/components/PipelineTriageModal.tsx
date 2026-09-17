/**
 * Capability diagnostics.
 *
 * Every check here runs something and reports what it observed. Components
 * this deployment does not have report `not_implemented` rather than passing,
 * so a green panel means the checks genuinely succeeded.
 */
import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, X, XCircle } from 'lucide-react';

import { isSpeechSynthesisSupported, speak } from '../utils/audioEngine';
import { isMicrophoneSupported } from '../utils/microphone';
import { isSpeechRecognitionSupported } from '../utils/speechRecognition';

interface PipelineTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail' | 'not_implemented';

interface CheckResult {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  detail: string;
}

const INITIAL_CHECKS: CheckResult[] = [
  {
    id: 'api',
    name: 'API reachability',
    description: 'Requests /api/health and reads the response.',
    status: 'idle',
    detail: 'Not run yet.',
  },
  {
    id: 'llm',
    name: 'Language model',
    description: 'Reads the server’s reported model configuration.',
    status: 'idle',
    detail: 'Not run yet.',
  },
  {
    id: 'microphone',
    name: 'Microphone access',
    description: 'Requests a live capture stream and releases it.',
    status: 'idle',
    detail: 'Not run yet.',
  },
  {
    id: 'stt',
    name: 'Browser speech recognition',
    description: 'Checks whether this browser exposes the Web Speech API.',
    status: 'idle',
    detail: 'Not run yet.',
  },
  {
    id: 'tts',
    name: 'Browser speech synthesis',
    description: 'Speaks a short phrase and waits for it to finish.',
    status: 'idle',
    detail: 'Not run yet.',
  },
  {
    id: 'pipeline',
    name: 'Server voice pipeline',
    description: 'Streaming transport, server-side STT and TTS.',
    status: 'idle',
    detail: 'Not run yet.',
  },
];

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  idle: <CircleDashed className="w-4 h-4 text-white/30" />,
  running: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  pass: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  not_implemented: <AlertTriangle className="w-4 h-4 text-white/40" />,
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  idle: 'not run',
  running: 'running',
  pass: 'pass',
  fail: 'fail',
  not_implemented: 'not implemented',
};

export const PipelineTriageModal: React.FC<PipelineTriageModalProps> = ({ isOpen, onClose }) => {
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL_CHECKS);
  const [isRunning, setIsRunning] = useState(false);

  const update = useCallback((id: string, status: CheckStatus, detail: string) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status, detail } : c)));
  }, []);

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'running', detail: 'Running…' })));

    // API reachability, and the component statuses the server reports.
    try {
      const health = await fetch('/api/health');
      if (!health.ok) throw new Error(`HTTP ${health.status}`);
      const payload = await health.json();
      update('api', 'pass', `Reachable. Service "${payload.service}", up ${payload.uptimeSeconds}s.`);
    } catch (err) {
      update('api', 'fail', `Could not reach the API: ${(err as Error).message}`);
    }

    try {
      const status = await fetch('/api/status');
      const payload = await status.json();
      const llm = payload.components?.llm;
      if (llm?.status === 'ready') {
        update('llm', 'pass', `Configured: ${llm.provider}, ${llm.models.length} model(s) available.`);
      } else {
        update('llm', 'fail', 'The server reports no language model is configured.');
      }
      const transport = payload.components?.transport?.status ?? 'unknown';
      update(
        'pipeline',
        transport === 'not_implemented' ? 'not_implemented' : 'pass',
        transport === 'not_implemented'
          ? 'No server-side voice pipeline on this deployment. Conversations use browser speech.'
          : `Transport reports "${transport}".`
      );
    } catch {
      update('llm', 'fail', 'Could not read server status.');
      update('pipeline', 'fail', 'Could not read server status.');
    }

    // Microphone: actually open a stream, then release it immediately.
    if (!isMicrophoneSupported()) {
      update('microphone', 'fail', 'This browser exposes no microphone API.');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const label = stream.getAudioTracks()[0]?.label || 'default device';
        stream.getTracks().forEach((track) => track.stop());
        update('microphone', 'pass', `Captured from "${label}" and released it.`);
      } catch (err) {
        update(
          'microphone',
          'fail',
          (err as DOMException)?.name === 'NotAllowedError'
            ? 'Microphone permission was denied.'
            : 'No microphone is available.'
        );
      }
    }

    update(
      'stt',
      isSpeechRecognitionSupported() ? 'pass' : 'fail',
      isSpeechRecognitionSupported()
        ? 'Web Speech API is available. Note this sends audio to the browser vendor.'
        : 'Not available in this browser. Chrome and Edge support it.'
    );

    if (!isSpeechSynthesisSupported()) {
      update('tts', 'fail', 'This browser has no speech synthesis.');
    } else {
      try {
        await speak('Diagnostics check.', { rate: 1.1 });
        update('tts', 'pass', 'Spoke a test phrase and it finished.');
      } catch (err) {
        update('tts', 'fail', `Synthesis failed: ${(err as Error).message}`);
      }
    }

    setIsRunning(false);
  }, [update]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
      <div className="bg-[#121316] border border-white/10 sm:rounded-3xl w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-4 sm:px-8 py-5 border-b border-white/[0.07] flex items-center justify-between">
          <div>
            <h2 className="text-base font-serif italic text-white">Diagnostics</h2>
            <p className="text-[11px] font-mono text-white/40">Each check runs live</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diagnostics"
            className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-3">
          {checks.map((check) => (
            <div key={check.id} className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[check.status]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm text-white/90">{check.name}</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 shrink-0">
                      {STATUS_LABEL[check.status]}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">{check.description}</p>
                  <p className="text-xs text-white/65 mt-1.5 break-words">{check.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="px-4 sm:px-8 py-4 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={isRunning}
            className="w-full py-3 rounded-full bg-[#7047FF] hover:bg-[#7c57ff] disabled:opacity-40 text-sm font-medium text-white"
          >
            {isRunning ? 'Running checks…' : 'Run diagnostics'}
          </button>
        </footer>
      </div>
    </div>
  );
};
