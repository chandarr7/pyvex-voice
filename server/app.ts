/**
 * The Pyvex Voice HTTP API.
 *
 * Built as a factory so tests can supply their own token verifier, LLM service
 * and clock, and exercise the real routes without a network or a Supabase
 * project.
 *
 * The rule the whole surface is built around: an operation that failed returns
 * a typed error with a non-2xx status. There is no path that substitutes
 * generated or canned content for a result the system could not produce.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';

import { createGeminiService, type ConversationTurn, type GeminiService } from './ai/gemini.js';
import { requireAuth, type TokenVerifier } from './auth.js';
import { AppError } from './errors.js';
import { defaultModel, isSupportedModel, supportedModels } from './models.js';
import { PRESET_FLOWS, findFlow, isKnownFlow } from './personas.js';
import { createRateLimiter } from './rateLimit.js';
import { SessionStore, toSummary } from './sessions.js';
import { createVoiceRouter } from './voiceRoutes.js';
import { VoiceSessionStore } from './voiceSessions.js';
import { createVoiceWorkerClient, type VoiceWorkerClient } from './voiceWorker.js';

export interface AppDependencies {
  verifier: TokenVerifier | null;
  gemini?: GeminiService;
  sessions?: SessionStore;
  voiceSessions?: VoiceSessionStore;
  voiceWorker?: VoiceWorkerClient;
  env?: NodeJS.ProcessEnv;
  /** Disabled in tests so limits do not leak between cases. */
  enableRateLimit?: boolean;
}

const MAX_MESSAGE_LENGTH = 4_000;

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError('INVALID_REQUEST', `"${field}" must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new AppError('INVALID_REQUEST', `"${field}" must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

/** Wraps an async handler so a rejection reaches the error middleware. */
function route(handler: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function createApp(deps: AppDependencies): Express {
  const env = deps.env ?? process.env;
  const gemini = deps.gemini ?? createGeminiService(env);
  const sessions = deps.sessions ?? new SessionStore();
  const voiceSessions = deps.voiceSessions ?? new VoiceSessionStore();
  const voiceWorker = deps.voiceWorker ?? createVoiceWorkerClient(env);
  const app = express();

  app.use(express.json({ limit: '64kb' }));

  // Correlates the log lines for one request. Never contains user content.
  app.use((req, _res, next) => {
    req.requestId = randomUUID();
    next();
  });

  const auth = requireAuth(deps.verifier);
  const useRateLimit = deps.enableRateLimit ?? true;
  const llmLimiter = createRateLimiter({ name: 'llm', windowMs: 60_000, max: 20 });
  const sessionLimiter = createRateLimiter({ name: 'session', windowMs: 60_000, max: 10 });
  const pass = (_req: Request, _res: Response, next: NextFunction) => next();
  const llmLimit = useRateLimit ? llmLimiter.middleware : pass;
  const sessionLimit = useRateLimit ? sessionLimiter.middleware : pass;

  // --- Public routes -------------------------------------------------------

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'pyvex-voice',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Component readiness, probed rather than asserted.
   *
   * Voice components report `not_implemented` because this deployment has no
   * voice pipeline; they will report real state when one exists.
   */
  app.get('/api/status', (_req, res) => {
    res.json({
      status: 'running',
      components: {
        llm: {
          status: gemini.isConfigured() ? 'ready' : 'not_configured',
          provider: 'google-gemini',
          models: supportedModels(env).map((m) => m.id),
        },
        auth: { status: deps.verifier ? 'ready' : 'not_configured', provider: 'supabase' },
        voice: {
          // Reported by the worker itself; this process cannot know whether a
          // conversation would succeed.
          status: voiceWorker.isConfigured() ? 'configured' : 'not_configured',
          transport: 'smallwebrtc',
          stt: 'elevenlabs',
          tts: 'elevenlabs',
          vad: 'silero',
        },
      },
      // Turn metrics come from a session's own events, not from this endpoint.
      metrics: null,
    });
  });

  /**
   * Only what this deployment can actually run. Providers are added here when
   * an implementation and its tests land, never in anticipation of one.
   */
  app.get('/api/services', (_req, res) => {
    // Only what this deployment can actually run. The voice stack appears only
    // when a worker is configured behind it.
    const voiceAvailable = voiceWorker.isConfigured();
    res.json({
      llm: supportedModels(env).map((m) => ({ ...m, provider: 'google-gemini' })),
      stt: voiceAvailable ? [{ id: 'elevenlabs', name: 'ElevenLabs realtime' }] : [],
      tts: voiceAvailable ? [{ id: 'elevenlabs', name: 'ElevenLabs streaming' }] : [],
      vad: voiceAvailable ? [{ id: 'silero', name: 'Silero VAD' }] : [],
      transports: voiceAvailable ? [{ id: 'smallwebrtc', name: 'SmallWebRTC' }] : [],
    });
  });

  app.get('/api/models', (_req, res) => {
    res.json({ models: supportedModels(env), defaultModel: defaultModel(env) });
  });

  app.get('/api/flows', (_req, res) => {
    res.json(
      PRESET_FLOWS.map(({ id, name, description, greeting, suggestedPrompts }) => ({
        id,
        name,
        description,
        greeting,
        suggestedPrompts,
      }))
    );
  });

  // --- Authenticated routes ------------------------------------------------

  app.post(
    '/api/sessions',
    auth,
    sessionLimit,
    route((req, res) => {
      const body = req.body ?? {};
      const flow = body.flow === undefined ? PRESET_FLOWS[0].id : body.flow;
      if (!isKnownFlow(flow)) {
        throw new AppError('INVALID_REQUEST', `Unknown flow "${String(flow)}".`);
      }
      const model = body.model === undefined ? defaultModel(env) : body.model;
      if (!isSupportedModel(model, env)) {
        throw new AppError('INVALID_MODEL', `Model "${String(model)}" is not supported.`);
      }

      const session = sessions.create({ userId: req.user!.uid, flow, model });
      const preset = findFlow(flow);

      res.status(201).json({
        session: toSummary(session),
        greeting: preset.greeting,
        // Voice transport is not implemented; the field says so rather than
        // carrying a placeholder offer a client might try to use.
        transport: { status: 'not_implemented' },
      });
    })
  );

  app.get(
    '/api/sessions',
    auth,
    route((req, res) => {
      res.json({ sessions: sessions.listForUser(req.user!.uid) });
    })
  );

  app.get(
    '/api/sessions/:id',
    auth,
    route((req, res) => {
      const session = sessions.requireOwned(req.params.id, req.user!.uid);
      res.json({ session: toSummary(session), turns: session.turns });
    })
  );

  app.post(
    '/api/sessions/:id/stop',
    auth,
    route((req, res) => {
      sessions.stop(req.params.id, req.user!.uid);
      res.json({ stopped: true, sessionId: req.params.id });
    })
  );

  /**
   * One conversational turn within an owned session.
   *
   * History comes from the store, so the model sees the transcript the server
   * recorded. A provider failure propagates: the user turn is only committed
   * once a reply exists, leaving the transcript consistent for a retry.
   */
  app.post(
    '/api/sessions/:id/chat',
    auth,
    llmLimit,
    route(async (req, res) => {
      const message = requireString(req.body?.message, 'message', MAX_MESSAGE_LENGTH);
      const session = sessions.requireOwned(req.params.id, req.user!.uid);
      const preset = findFlow(session.flow);

      const result = await gemini.generateConversationResponse({
        turns: [...session.turns, { role: 'user', content: message }],
        systemInstruction: preset.systemPrompt,
        model: session.model,
      });

      sessions.appendTurn(session, { role: 'user', content: message });
      sessions.appendTurn(session, { role: 'assistant', content: result.text });

      res.json({
        sessionId: session.id,
        reply: result.text,
        model: result.model,
        // The only timing the server can honestly report: its own call.
        metrics: { llmLatencyMs: result.latencyMs },
        turnCount: session.turns.length,
      });
    })
  );

  /**
   * Stateless chat for the text assistant, where the client owns the thread.
   * Shares the provider implementation with the session path above.
   */
  app.post(
    '/api/chat',
    auth,
    llmLimit,
    route(async (req, res) => {
      const rawTurns = req.body?.turns;
      if (!Array.isArray(rawTurns) || rawTurns.length === 0) {
        throw new AppError('INVALID_REQUEST', '"turns" must be a non-empty array.');
      }
      if (rawTurns.length > 100) {
        throw new AppError('INVALID_REQUEST', '"turns" must contain at most 100 entries.');
      }
      const turns: ConversationTurn[] = rawTurns.map((turn: unknown, index: number) => {
        const t = turn as { role?: unknown; content?: unknown };
        if (t?.role !== 'user' && t?.role !== 'assistant') {
          throw new AppError('INVALID_REQUEST', `turns[${index}].role must be "user" or "assistant".`);
        }
        return {
          role: t.role,
          content: requireString(t.content, `turns[${index}].content`, MAX_MESSAGE_LENGTH),
        };
      });

      const model = req.body?.model === undefined ? defaultModel(env) : req.body.model;
      if (!isSupportedModel(model, env)) {
        throw new AppError('INVALID_MODEL', `Model "${String(model)}" is not supported.`);
      }

      // A named flow wins; otherwise the client may set its own instruction.
      // This only shapes the caller's own conversation, and the caller already
      // controls the user turns, so it grants no reach beyond their session.
      let systemInstruction: string | undefined;
      if (isKnownFlow(req.body?.flow)) {
        systemInstruction = findFlow(req.body.flow).systemPrompt;
      } else if (req.body?.systemInstruction !== undefined) {
        systemInstruction = requireString(req.body.systemInstruction, 'systemInstruction', 8_000);
      }

      const result = await gemini.generateConversationResponse({ turns, systemInstruction, model });

      res.json({
        reply: result.text,
        model: result.model,
        metrics: { llmLatencyMs: result.latencyMs },
      });
    })
  );

  app.use(
    '/api/voice',
    createVoiceRouter({
      worker: voiceWorker,
      sessions: voiceSessions,
      auth,
      rateLimit: useRateLimit ? sessionLimiter.middleware : undefined,
    })
  );

  // --- Error handling ------------------------------------------------------

  app.use('/api', (_req, res) => {
    res.status(404).json(new AppError('INVALID_REQUEST', 'No such endpoint.').toBody());
  });

  /**
   * Body-parser rejections are the client's fault, not the server's, so they
   * are typed rather than falling through to a 500.
   */
  function fromBodyParser(err: unknown): AppError | null {
    const type = (err as { type?: string })?.type;
    if (type === 'entity.too.large') {
      return new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }
    if (type === 'entity.parse.failed' || type === 'encoding.unsupported') {
      return new AppError('INVALID_REQUEST', 'The request body could not be parsed.');
    }
    return null;
  }

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const appError =
      err instanceof AppError
        ? err
        : fromBodyParser(err) ?? new AppError('INTERNAL_ERROR', 'An unexpected error occurred.');

    // Structured, and free of credentials, tokens and user content.
    console.error(
      JSON.stringify({
        event: 'api.error',
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        code: appError.code,
        status: appError.status,
        userId: req.user?.uid,
      })
    );
    if (!(err instanceof AppError) && appError.code === 'INTERNAL_ERROR') {
      console.error(err);
    }

    res.status(appError.status).json(appError.toBody());
  });

  return app;
}
