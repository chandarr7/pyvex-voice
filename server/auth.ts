/**
 * Firebase ID token verification for the API.
 *
 * Identity comes from the verified token and nothing else: a `userId` in a body
 * or query string is data, never proof. When no verifier is configured the
 * middleware fails closed with AUTH_NOT_CONFIGURED, so a deployment missing its
 * Firebase credentials rejects requests rather than serving them unauthenticated.
 */
import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errors.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

/** Verifies a raw ID token, or throws. Injectable so tests need no network. */
export type TokenVerifier = (idToken: string) => Promise<AuthenticatedUser>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

/**
 * Build a verifier backed by firebase-admin.
 *
 * Returns null when the deployment has no Firebase project configured, which
 * the caller turns into a fail-closed middleware.
 */
export async function createFirebaseVerifier(
  env: NodeJS.ProcessEnv = process.env
): Promise<TokenVerifier | null> {
  const projectId =
    env.FIREBASE_PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT ?? env.GCLOUD_PROJECT ?? undefined;
  const hasCredentials = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_SERVICE_ACCOUNT);

  if (!projectId && !hasCredentials) return null;

  const admin = await import('firebase-admin/app');
  const authModule = await import('firebase-admin/auth');

  const existing = admin.getApps();
  const app = existing.length
    ? existing[0]
    : admin.initializeApp({
        // applicationDefault() reads GOOGLE_APPLICATION_CREDENTIALS or the
        // metadata server; neither ever lands in source or logs.
        credential: hasCredentials ? admin.applicationDefault() : undefined,
        projectId,
      });

  const auth = authModule.getAuth(app);

  return async (idToken: string): Promise<AuthenticatedUser> => {
    const decoded = await auth.verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
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
 * Require a valid Firebase ID token and attach the caller to `req.user`.
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
      next(new AppError('AUTH_REQUIRED', 'A Firebase ID token is required.'));
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
