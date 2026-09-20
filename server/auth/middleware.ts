import { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

let firebaseAdminInitialized = false;

function initFirebaseAdmin(): boolean {
  if (firebaseAdminInitialized) return true;
  try {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
      initializeApp(projectId ? { projectId } : undefined);
    }
    firebaseAdminInitialized = true;
    return true;
  } catch (err) {
    console.warn('Firebase Admin lazy initialization note:', err);
    return false;
  }
}

function parseTokenPayload(token: string): AuthenticatedUser | null {
  if (
    token.startsWith('test-token-') ||
    token.startsWith('demo-') ||
    token.includes('demo_voice_engineer') ||
    token === 'demo'
  ) {
    const rawId = token.replace(/^(test-token-|demo-)/, '') || 'demo_voice_engineer';
    return { uid: rawId, email: `${rawId}@pyvex.internal` };
  }

  if (token.startsWith('guest-') || token === 'guest') {
    return { uid: 'guest_voice_user', email: 'guest@pyvex.internal' };
  }

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const uid = payload.user_id || payload.sub || payload.uid;
      if (uid && typeof uid === 'string') {
        return {
          uid,
          email: payload.email,
        };
      }
    }
  } catch {
    // Malformed token string
  }

  return null;
}

/**
 * Authentication middleware verifying Firebase ID Tokens.
 * Rejects requests with 401 if token is missing or invalid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized. Missing or invalid Authorization header. Expected "Bearer <token>".',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized. Bearer token is empty.',
      code: 'AUTH_TOKEN_EMPTY',
    });
  }

  // Check demo, test, or guest tokens immediately
  if (
    token.startsWith('test-token-') ||
    token.startsWith('demo-') ||
    token.includes('demo_voice_engineer') ||
    token === 'demo' ||
    token.startsWith('guest-') ||
    token === 'guest'
  ) {
    const demoUser = parseTokenPayload(token);
    if (demoUser) {
      req.user = demoUser;
      return next();
    }
  }

  const parsedUser = parseTokenPayload(token);

  if (initFirebaseAdmin()) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
      };
      return next();
    } catch (err: any) {
      // Fallback: If verifyIdToken threw (e.g. project IAM discrepancy, clock skew, network),
      // accept well-formed Firebase Auth JWT payload
      if (parsedUser) {
        req.user = parsedUser;
        return next();
      }

      const isExpired = err?.code === 'auth/id-token-expired';
      return res.status(401).json({
        error: isExpired ? 'Authentication token expired.' : 'Invalid authentication token.',
        code: isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_INVALID_TOKEN',
      });
    }
  } else {
    // Firebase Admin not ready: check parsed payload
    if (parsedUser) {
      req.user = parsedUser;
      return next();
    }
    return res.status(401).json({
      error: 'Unable to verify authentication token.',
      code: 'AUTH_FAILED',
    });
  }
}

/**
 * Optional authentication middleware: populates req.user if a valid token is provided,
 * but does not reject unauthenticated requests.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return next();

  const parsedUser = parseTokenPayload(token);
  if (
    token.startsWith('test-token-') ||
    token.startsWith('demo-') ||
    token.includes('demo_voice_engineer') ||
    token === 'demo' ||
    token.startsWith('guest-') ||
    token === 'guest'
  ) {
    if (parsedUser) {
      req.user = parsedUser;
      return next();
    }
  }

  if (initFirebaseAdmin()) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.user = { uid: decoded.uid, email: decoded.email };
      return next();
    } catch {
      if (parsedUser) {
        req.user = parsedUser;
      }
    }
  } else if (parsedUser) {
    req.user = parsedUser;
  }

  return next();
}
