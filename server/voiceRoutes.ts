/**
 * Voice session routes.
 *
 * The browser asks for a conversation with a persona and a voice profile by
 * id. Everything a provider needs — the system prompt, the provider voice id,
 * the model, the credentials — is resolved here from the authenticated user's
 * configuration and sent to the worker. A browser can name a choice but never
 * define one, so a caller cannot craft their own system prompt or point a
 * session at an arbitrary voice.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';

import { AppError } from './errors.js';
import { isKnownFlow, findFlow } from './personas.js';
import type { VoiceSessionStore } from './voiceSessions.js';
import type { VoiceWorkerClient } from './voiceWorker.js';

export interface VoiceRouteDeps {
  worker: VoiceWorkerClient;
  sessions: VoiceSessionStore;
  /** Applied to every route here; identity comes from the verified token. */
  auth: (req: Request, res: Response, next: NextFunction) => void;
  rateLimit?: (req: Request, res: Response, next: NextFunction) => void;
}

function route(handler: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function requireSdp(body: unknown): { sdp: string; type: string; pcId?: string } {
  const candidate = body as { sdp?: unknown; type?: unknown; pcId?: unknown };
  if (typeof candidate?.sdp !== 'string' || candidate.sdp.trim().length === 0) {
    throw new AppError('INVALID_REQUEST', '"sdp" must be a non-empty string.');
  }
  if (candidate.type !== 'offer') {
    throw new AppError('INVALID_REQUEST', '"type" must be "offer".');
  }
  // An SDP is small; a large one is a payload probe rather than a real offer.
  if (candidate.sdp.length > 64_000) {
    throw new AppError('INVALID_REQUEST', '"sdp" is too large.');
  }
  return {
    sdp: candidate.sdp,
    type: candidate.type,
    pcId: typeof candidate.pcId === 'string' ? candidate.pcId : undefined,
  };
}

export function createVoiceRouter({ worker, sessions, auth, rateLimit }: VoiceRouteDeps): Router {
  const router = Router();
  const limited = rateLimit ?? ((_req, _res, next) => next());

  router.get(
    '/readiness',
    auth,
    route(async (_req, res) => {
      res.json(await worker.readiness());
    })
  );

  router.post(
    '/sessions',
    auth,
    limited,
    route(async (req, res) => {
      const body = req.body ?? {};
      const personaId = body.personaId ?? 'customer_support';
      if (!isKnownFlow(personaId)) {
        throw new AppError('INVALID_REQUEST', `Unknown persona "${String(personaId)}".`);
      }
      const voiceProfileId =
        typeof body.voiceProfileId === 'string' && body.voiceProfileId.trim()
          ? body.voiceProfileId.trim()
          : undefined;

      if (!worker.isConfigured()) {
        throw new AppError(
          'VOICE_WORKER_NOT_CONFIGURED',
          'No voice worker is configured for this deployment.'
        );
      }

      const session = sessions.create({
        userId: req.user!.uid,
        personaId,
        voiceProfileId,
      });

      res.status(201).json({
        session: sessions.toSummary(session),
        persona: {
          id: personaId,
          name: findFlow(personaId).name,
          greeting: findFlow(personaId).greeting,
        },
      });
    })
  );

  router.post(
    '/sessions/:id/offer',
    auth,
    limited,
    route(async (req, res) => {
      const offer = requireSdp(req.body);
      const session = sessions.requireOwned(req.params.id, req.user!.uid);

      let answer;
      try {
        answer = await worker.negotiate(
          {
            sessionId: session.id,
            personaId: session.personaId,
            voiceProfileId: session.voiceProfileId,
          },
          offer
        );
      } catch (err) {
        // Negotiation failed, so the session never becomes connected. Marking
        // it here keeps the stored state matching what the caller experienced.
        sessions.markFailed(
          session.id,
          err instanceof AppError ? err.code : 'VOICE_NEGOTIATION_FAILED'
        );
        throw err;
      }

      sessions.markNegotiated(session.id, answer.pc_id);
      res.json({ answer, sessionId: session.id });
    })
  );

  router.patch(
    '/sessions/:id/ice',
    auth,
    route(async (req, res) => {
      const session = sessions.requireOwned(req.params.id, req.user!.uid);
      if (!session.pcId) {
        throw new AppError('INVALID_REQUEST', 'This session has not been negotiated yet.');
      }

      const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
      if (candidates.length > 50) {
        throw new AppError('INVALID_REQUEST', 'Too many candidates in one request.');
      }

      await worker.addIceCandidates(
        session.pcId,
        candidates.map((c: Record<string, unknown>) => ({
          candidate: String(c.candidate ?? ''),
          sdpMid: String(c.sdpMid ?? ''),
          sdpMLineIndex: Number(c.sdpMLineIndex ?? 0),
        }))
      );
      res.json({ accepted: candidates.length });
    })
  );

  /**
   * The session's real events, for the UI to render.
   *
   * Relayed from the worker rather than synthesised here, so the timeline a
   * user sees is the one the pipeline actually produced.
   */
  router.get(
    '/sessions/:id/events',
    auth,
    route(async (req, res) => {
      const session = sessions.requireOwned(req.params.id, req.user!.uid);
      const afterMs = Number.parseInt(String(req.query.afterMs ?? '0'), 10) || 0;

      try {
        res.json({ sessionId: session.id, events: await worker.events(session.id, afterMs) });
      } catch (err) {
        // A session the worker has already finished with is not an error for
        // the caller; it simply has no further events.
        if (err instanceof AppError && err.code === 'VOICE_NOT_FOUND') {
          res.json({ sessionId: session.id, events: [] });
          return;
        }
        throw err;
      }
    })
  );

  router.post(
    '/sessions/:id/stop',
    auth,
    route((req, res) => {
      sessions.stop(req.params.id, req.user!.uid);
      res.json({ stopped: true, sessionId: req.params.id });
    })
  );

  router.get(
    '/sessions',
    auth,
    route((req, res) => {
      res.json({ sessions: sessions.listForUser(req.user!.uid) });
    })
  );

  return router;
}
