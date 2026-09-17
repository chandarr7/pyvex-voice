/**
 * Supabase JWT verification for the API.
 *
 * Identity comes from the verified token and nothing else: a `userId` in a body
 * or query string is data, never proof. When no verifier is configured the
 * middleware fails closed with AUTH_NOT_CONFIGURED, so a deployment missing its
 * Supabase settings rejects requests rather than serving them unauthenticated.
 *
 * Tokens are verified locally. Asking the Auth API to validate each one would
 * add a network round-trip to every conversational turn, which is latency this
 * application cannot spend.
 */
import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { AppError } from './errors.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/** Verifies a raw access token, or throws. Injectable so tests need no network. */
export type TokenVerifier = (accessToken: string) => Promise<AuthenticatedUser>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

/** Supabase issues end-user tokens with this audience and role claim. */
const EXPECTED_AUDIENCE = 'authenticated';

function toUser(payload: JWTPayload): AuthenticatedUser {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('token carries no subject');
  }
  // A service-role key is a JWT too. Accepting one here would let a leaked
  // server secret act as an arbitrary end user.
  if (payload.role !== EXPECTED_AUDIENCE) {
    throw new Error('token is not an end-user token');
  }
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  return { uid: payload.sub, email };
}

/**
 * Build a verifier for the configured Supabase project.
 *
 * Projects sign with an asymmetric key that the JWKS endpoint publishes;
 * older ones use a shared HS256 secret. Setting `SUPABASE_JWT_SECRET` selects
 * the legacy path, and its absence uses JWKS, which needs no secret at all.
 *
 * Returns null when no project is configured, which the caller turns into a
 * fail-closed middleware.
 */
export async function createSupabaseVerifier(
  env: NodeJS.ProcessEnv = process.env
): Promise<TokenVerifier | null> {
  const projectUrl = env.SUPABASE_URL?.replace(/\/+$/, '');
  if (!projectUrl) return null;

  const issuer = `${projectUrl}/auth/v1`;
  const sharedSecret = env.SUPABASE_JWT_SECRET;

  let getKey: JWTVerifyGetKey | Uint8Array;
  if (sharedSecret) {
    getKey = new TextEncoder().encode(sharedSecret);
  } else {
    // Fetched on demand and cached by `jose`, which also handles key rotation.
    getKey = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }

  return async (accessToken: string): Promise<AuthenticatedUser> => {
    const { payload } = await jwtVerify(accessToken, getKey as JWTVerifyGetKey, {
      issuer,
      audience: EXPECTED_AUDIENCE,
    });
    return toUser(payload);
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme ?? '') || !token) return null;
  return token.trim() || null;
}

/**
 * Require a valid Supabase access token and attach the caller to `req.user`.
 */
export function requireAuth(verifier: TokenVerifier | null) {
  return async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
    if (!verifier) {
      next(
        new AppError(
          'AUTH_NOT_CONFIGURED',
          'Authentication is not configured for this deployment.'
        )
      );
      return;
    }

    const token = extractBearerToken(req);
    if (!token) {
      next(new AppError('AUTH_REQUIRED', 'A Supabase access token is required.'));
      return;
    }

    try {
      req.user = await verifier(token);
      next();
    } catch {
      // The underlying reason is deliberately not echoed: it would tell an
      // attacker which part of a forged token failed.
      next(new AppError('AUTH_INVALID', 'The provided credentials are not valid.'));
    }
  };
}
