/**
 * Client for the Python voice worker.
 *
 * The worker sits on a private boundary and trusts the shared token as proof
 * that a request came from this API, which has already established identity
 * against Supabase. The token is a server secret and never reaches a browser.
 *
 * Every failure becomes a typed AppError: a session that could not be
 * negotiated is reported as such, never as a connected one.
 */
import { AppError } from './errors.js';

export interface SdpOffer {
  sdp: string;
  type: string;
  pcId?: string;
  restartPc?: boolean;
}

export interface SdpAnswer {
  sdp: string;
  type: string;
  pc_id?: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

export interface WorkerSessionSpec {
  sessionId: string;
  personaId: string;
  voiceProfileId?: string;
}

export interface WorkerReadiness {
  status: 'ready' | 'not_ready' | 'unreachable';
  providers?: Record<string, string>;
  voiceProfiles?: string[];
  reason?: string;
}

export interface VoiceWorkerClient {
  isConfigured(): boolean;
  readiness(): Promise<WorkerReadiness>;
  negotiate(spec: WorkerSessionSpec, offer: SdpOffer): Promise<SdpAnswer>;
  addIceCandidates(pcId: string, candidates: IceCandidatePayload[]): Promise<void>;
  events(sessionId: string, afterMs: number): Promise<Array<Record<string, unknown>>>;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function workerError(status: number, code: string, message: string): AppError {
  if (status === 503) return new AppError('VOICE_WORKER_UNAVAILABLE', message, { workerCode: code });
  if (status === 400) return new AppError('INVALID_REQUEST', message, { workerCode: code });
  return new AppError('VOICE_NEGOTIATION_FAILED', message, { workerCode: code });
}

export function createVoiceWorkerClient(env: NodeJS.ProcessEnv = process.env): VoiceWorkerClient {
  const baseUrl = env.VOICE_WORKER_URL?.replace(/\/+$/, '');
  const token = env.VOICE_WORKER_TOKEN;

  async function call(
    path: string,
    init: { method: string; body?: unknown; timeoutMs?: number }
  ): Promise<Response> {
    if (!baseUrl || !token) {
      throw new AppError(
        'VOICE_WORKER_NOT_CONFIGURED',
        'No voice worker is configured for this deployment.'
      );
    }

    // Every call is bounded: a worker that stops answering must surface as a
    // failure rather than holding the caller's request open.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      return await fetch(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Pyvex-Worker-Token': token,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        throw new AppError('VOICE_WORKER_TIMEOUT', 'The voice worker did not respond in time.');
      }
      throw new AppError('VOICE_WORKER_UNAVAILABLE', 'The voice worker could not be reached.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function failureFrom(response: Response): Promise<AppError> {
    let code = 'UNKNOWN';
    let message = `The voice worker returned ${response.status}.`;
    try {
      const payload = await response.json();
      const detail = payload?.detail;
      if (detail?.code) code = detail.code;
      if (typeof detail?.message === 'string') message = detail.message;
    } catch {
      // A non-JSON body leaves the status-derived defaults in place.
    }
    return workerError(response.status, code, message);
  }

  return {
    isConfigured: () => Boolean(baseUrl && token),

    async readiness(): Promise<WorkerReadiness> {
      if (!baseUrl || !token) {
        return { status: 'unreachable', reason: 'No voice worker is configured.' };
      }
      try {
        const response = await call('/ready', { method: 'GET', timeoutMs: 5_000 });
        const body = (await response.json()) as WorkerReadiness;
        return response.ok ? { ...body, status: 'ready' } : { ...body, status: 'not_ready' };
      } catch (err) {
        return {
          status: 'unreachable',
          reason: err instanceof AppError ? err.message : 'The voice worker could not be reached.',
        };
      }
    },

    async negotiate(spec: WorkerSessionSpec, offer: SdpOffer): Promise<SdpAnswer> {
      const response = await call('/offer', {
        method: 'POST',
        body: {
          sdp: offer.sdp,
          type: offer.type,
          pc_id: offer.pcId,
          restart_pc: offer.restartPc,
          session_id: spec.sessionId,
          persona_id: spec.personaId,
          voice_profile_id: spec.voiceProfileId,
        },
      });
      if (!response.ok) throw await failureFrom(response);
      return (await response.json()) as SdpAnswer;
    },

    async addIceCandidates(pcId: string, candidates: IceCandidatePayload[]): Promise<void> {
      const response = await call('/offer', {
        method: 'PATCH',
        body: {
          pc_id: pcId,
          candidates: candidates.map((c) => ({
            candidate: c.candidate,
            sdp_mid: c.sdpMid,
            sdp_mline_index: c.sdpMLineIndex,
          })),
        },
        timeoutMs: 5_000,
      });
      if (!response.ok) throw await failureFrom(response);
    },

    async events(sessionId: string, afterMs: number): Promise<Array<Record<string, unknown>>> {
      const response = await call(
        `/sessions/${encodeURIComponent(sessionId)}/events?after_ms=${afterMs}`,
        { method: 'GET', timeoutMs: 5_000 }
      );
      if (!response.ok) throw await failureFrom(response);
      const body = (await response.json()) as { events?: Array<Record<string, unknown>> };
      return body.events ?? [];
    },
  };
}
