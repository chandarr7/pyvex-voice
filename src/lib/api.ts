/**
 * Typed client for the Pyvex Voice API.
 *
 * Every call carries the signed-in user's Supabase access token, and every
 * failure arrives as an ApiError with the server's code so the UI can say what
 * actually went wrong instead of guessing.
 */
import { supabase } from './supabase';

export type ApiErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_MODEL'
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'AUTH_NOT_CONFIGURED'
  | 'FORBIDDEN'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'RATE_LIMITED'
  | 'LLM_ERROR'
  | 'LLM_TIMEOUT'
  | 'LLM_AUTH_ERROR'
  | 'LLM_RATE_LIMITED'
  | 'LLM_NOT_CONFIGURED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** What the user is told for each failure. Never a substitute answer. */
const USER_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  AUTH_REQUIRED: 'Please sign in to continue.',
  AUTH_INVALID: 'Your session has ended. Sign in again.',
  AUTH_NOT_CONFIGURED: 'Sign-in is unavailable on this deployment.',
  SESSION_EXPIRED: 'This conversation timed out. Start a new one.',
  SESSION_NOT_FOUND: 'That conversation is no longer available.',
  RATE_LIMITED: "You're sending messages too quickly. Wait a moment.",
  LLM_RATE_LIMITED: 'The assistant is busy right now. Try again shortly.',
  LLM_TIMEOUT: "The assistant didn't respond in time.",
  LLM_NOT_CONFIGURED: 'No assistant is configured on this deployment.',
  LLM_AUTH_ERROR: 'The assistant is misconfigured. Contact an administrator.',
  LLM_ERROR: "I can't reach the assistant right now.",
  NETWORK_ERROR: 'Network unavailable. Check your connection.',
  INVALID_MODEL: 'That model is not available.',
};

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return USER_MESSAGES[error.code] ?? error.message;
  }
  if ((error as { name?: string })?.name === 'AbortError') return 'Cancelled.';
  return 'Something went wrong.';
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) {
    throw new ApiError('AUTH_NOT_CONFIGURED', 'Sign-in is not configured.', 503);
  }
  // getSession refreshes an expired access token before returning it.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new ApiError('AUTH_REQUIRED', 'Not signed in.', 401);
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Public endpoints skip the token so they work signed-out. */
  authenticated?: boolean;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, authenticated = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated) Object.assign(headers, await authHeader());

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server.');
  }

  if (!response.ok) {
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      if (payload?.error?.code) {
        code = payload.error.code;
        message = payload.error.message ?? message;
      }
    } catch {
      // A non-JSON error body leaves the status-derived defaults in place.
    }
    throw new ApiError(code, message, response.status);
  }

  return (await response.json()) as T;
}

// --- Response shapes -------------------------------------------------------

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface FlowInfo {
  id: string;
  name: string;
  description: string;
  greeting: string;
  suggestedPrompts: string[];
}

export interface SessionSummary {
  id: string;
  userId: string;
  flow: string;
  model: string;
  status: 'active' | 'stopped' | 'expired';
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  expiresAt: number;
  turnCount: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface StartSessionResult {
  session: SessionSummary;
  greeting: string;
  transport: { status: string };
}

export interface ChatTurnResult {
  sessionId: string;
  reply: string;
  model: string;
  metrics: { llmLatencyMs: number };
  turnCount: number;
}

export interface StatelessChatResult {
  reply: string;
  model: string;
  metrics: { llmLatencyMs: number };
}

// --- Endpoints -------------------------------------------------------------

export const api = {
  listModels: () =>
    apiRequest<{ models: ModelInfo[]; defaultModel: string }>('/api/models', { authenticated: false }),

  listFlows: () => apiRequest<FlowInfo[]>('/api/flows', { authenticated: false }),

  startSession: (body: { flow: string; model?: string }, signal?: AbortSignal) =>
    apiRequest<StartSessionResult>('/api/sessions', { method: 'POST', body, signal }),

  stopSession: (sessionId: string) =>
    apiRequest<{ stopped: boolean }>(`/api/sessions/${sessionId}/stop`, { method: 'POST' }),

  sendSessionTurn: (sessionId: string, message: string, signal?: AbortSignal) =>
    apiRequest<ChatTurnResult>(`/api/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: { message },
      signal,
    }),

  chat: (
    body: { turns: ConversationTurn[]; model?: string; flow?: string; systemInstruction?: string },
    signal?: AbortSignal
  ) =>
    apiRequest<StatelessChatResult>('/api/chat', { method: 'POST', body, signal }),
};
