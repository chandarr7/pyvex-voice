import type { Express } from 'express';

import { createApp } from '../../server/app.js';
import { AppError } from '../../server/errors.js';
import type { GeminiService, GenerateOptions, GenerateResult } from '../../server/ai/gemini.js';
import { SessionStore } from '../../server/sessions.js';
import type { TokenVerifier } from '../../server/auth.js';

/** Tokens are the uid: "alice" authenticates as alice, "bad" always fails. */
export const testVerifier: TokenVerifier = async (token: string) => {
  if (!token || token === 'bad') throw new Error('invalid token');
  return { uid: token, email: `${token}@example.test` };
};

export function bearer(uid: string): [string, string] {
  return ['Authorization', `Bearer ${uid}`];
}

export interface StubGemini extends GeminiService {
  calls: GenerateOptions[];
  reply: string;
  failWith: AppError | null;
}

export function stubGemini(overrides: Partial<Pick<StubGemini, 'reply' | 'failWith'>> = {}): StubGemini {
  const service: StubGemini = {
    calls: [],
    reply: overrides.reply ?? 'A model reply.',
    failWith: overrides.failWith ?? null,
    isConfigured: () => true,
    async generateConversationResponse(options: GenerateOptions): Promise<GenerateResult> {
      service.calls.push(options);
      if (service.failWith) throw service.failWith;
      return { text: service.reply, model: options.model ?? 'gemini-3.5-flash', latencyMs: 7 };
    },
  };
  return service;
}

export function buildApp(
  opts: { gemini?: GeminiService; sessions?: SessionStore; verifier?: TokenVerifier | null; enableRateLimit?: boolean } = {}
): { app: Express; sessions: SessionStore } {
  const sessions = opts.sessions ?? new SessionStore();
  const app = createApp({
    verifier: opts.verifier === undefined ? testVerifier : opts.verifier,
    gemini: opts.gemini ?? stubGemini(),
    sessions,
    enableRateLimit: opts.enableRateLimit ?? false,
  });
  return { app, sessions };
}
