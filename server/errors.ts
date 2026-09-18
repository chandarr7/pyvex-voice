/**
 * Typed application errors and their HTTP representation.
 *
 * Every failure leaving the API carries one of these codes so a client can tell
 * a provider outage from a bad request without parsing prose. The invariant the
 * whole API rests on: a failed operation never returns 2xx, and never carries
 * substitute content in place of the result it could not produce.
 */

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
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
  | 'VOICE_WORKER_NOT_CONFIGURED'
  | 'VOICE_WORKER_UNAVAILABLE'
  | 'VOICE_WORKER_TIMEOUT'
  | 'VOICE_NEGOTIATION_FAILED'
  | 'VOICE_NOT_FOUND'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_MODEL: 400,
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  AUTH_NOT_CONFIGURED: 503,
  FORBIDDEN: 403,
  SESSION_NOT_FOUND: 404,
  SESSION_EXPIRED: 410,
  RATE_LIMITED: 429,
  LLM_ERROR: 502,
  LLM_TIMEOUT: 504,
  LLM_AUTH_ERROR: 502,
  LLM_RATE_LIMITED: 429,
  LLM_NOT_CONFIGURED: 503,
  VOICE_WORKER_NOT_CONFIGURED: 503,
  VOICE_WORKER_UNAVAILABLE: 502,
  VOICE_WORKER_TIMEOUT: 504,
  VOICE_NEGOTIATION_FAILED: 502,
  VOICE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

/** An error with a stable code, an HTTP status, and a client-safe message. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): { error: { code: ErrorCode; message: string; details?: Record<string, unknown> } } {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
