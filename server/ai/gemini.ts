/**
 * The single Gemini integration. Every endpoint that reaches an LLM goes
 * through here, so error translation and request shaping cannot drift apart
 * between the text and voice paths.
 */
import { GoogleGenAI } from '@google/genai';

import { AppError } from '../errors.js';
import { defaultModel, isSupportedModel } from '../models.js';

/** A turn in a conversation, in the roles the rest of the app speaks. */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  turns: ConversationTurn[];
  systemInstruction?: string;
  model?: string;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  /** Wall-clock duration of the provider call. Measured, never estimated. */
  latencyMs: number;
}

export interface GeminiService {
  generateConversationResponse(options: GenerateOptions): Promise<GenerateResult>;
  isConfigured(): boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Map a provider failure onto a typed error.
 *
 * The distinctions matter to callers: a 429 is worth retrying, a 401 means the
 * deployment is misconfigured, and a timeout may just be a slow turn.
 */
export function normalizeGeminiError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const message = (err as { message?: string })?.message ?? String(err);
  const status =
    (err as { status?: number })?.status ?? (err as { code?: number })?.code ?? undefined;

  if (message.includes('PYVEX_TIMEOUT')) {
    return new AppError('LLM_TIMEOUT', 'The language model did not respond in time.');
  }
  if (status === 401 || status === 403 || /API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    return new AppError('LLM_AUTH_ERROR', 'The language model rejected this deployment’s credentials.');
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return new AppError('LLM_RATE_LIMITED', 'The language model is rate limiting this deployment.');
  }
  if (status === 404 || /not found|NOT_FOUND/i.test(message)) {
    return new AppError('INVALID_MODEL', 'The language model rejected the requested model.');
  }
  if (/DEADLINE_EXCEEDED|timeout|ETIMEDOUT|abort/i.test(message)) {
    return new AppError('LLM_TIMEOUT', 'The language model did not respond in time.');
  }
  return new AppError('LLM_ERROR', 'The language model could not be reached.');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('PYVEX_TIMEOUT')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export function createGeminiService(env: NodeJS.ProcessEnv = process.env): GeminiService {
  let client: GoogleGenAI | null = null;

  function getClient(): GoogleGenAI {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('LLM_NOT_CONFIGURED', 'No language model is configured for this deployment.');
    }
    if (!client) {
      client = new GoogleGenAI({ apiKey });
    }
    return client;
  }

  return {
    isConfigured() {
      return Boolean(env.GEMINI_API_KEY);
    },

    async generateConversationResponse({
      turns,
      systemInstruction,
      model,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    }: GenerateOptions): Promise<GenerateResult> {
      if (!Array.isArray(turns) || turns.length === 0) {
        throw new AppError('INVALID_REQUEST', 'At least one conversation turn is required.');
      }
      const selectedModel = model ?? defaultModel(env);
      if (!isSupportedModel(selectedModel, env)) {
        throw new AppError('INVALID_MODEL', `Model "${selectedModel}" is not supported.`, {
          model: selectedModel,
        });
      }

      const contents = turns.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      }));

      const ai = getClient();
      const startedAt = Date.now();

      let response: { text?: string };
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: selectedModel,
            contents,
            config: systemInstruction?.trim() ? { systemInstruction: systemInstruction.trim() } : undefined,
          }),
          timeoutMs
        );
      } catch (err) {
        throw normalizeGeminiError(err);
      }

      const text = response.text?.trim() ?? '';
      if (!text) {
        // An empty completion is a failed turn, not an answer worth speaking.
        throw new AppError('LLM_ERROR', 'The language model returned an empty response.');
      }

      return { text, model: selectedModel, latencyMs: Date.now() - startedAt };
    },
  };
}
