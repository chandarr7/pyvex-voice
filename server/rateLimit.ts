/**
 * Fixed-window rate limiting for endpoints that cost money or allocate memory.
 *
 * In-memory and therefore per-process: it bounds spend from a single runaway
 * client, which is what this deployment needs. A multi-instance deployment
 * needs a shared counter before this is load-bearing.
 */
import type { NextFunction, Request, Response } from 'express';

import { AppError } from './errors.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Distinguishes limiters so one endpoint's budget is not another's. */
  name: string;
  now?: () => number;
}

interface Counter {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  reset: () => void;
}

/**
 * Key on the authenticated uid when present so one user cannot exhaust another
 * user's budget from a shared address, and on the peer address otherwise.
 */
function clientKey(req: Request): string {
  if (req.user?.uid) return `uid:${req.user.uid}`;
  return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
}

export function createRateLimiter({ windowMs, max, name, now = Date.now }: RateLimitOptions): RateLimiter {
  const counters = new Map<string, Counter>();

  function sweep(currentTime: number) {
    for (const [key, counter] of counters) {
      if (counter.resetAt <= currentTime) counters.delete(key);
    }
  }

  return {
    reset: () => counters.clear(),

    middleware(req: Request, res: Response, next: NextFunction) {
      const currentTime = now();
      if (counters.size > 10_000) sweep(currentTime);

      const key = `${name}:${clientKey(req)}`;
      const existing = counters.get(key);

      if (!existing || existing.resetAt <= currentTime) {
        counters.set(key, { count: 1, resetAt: currentTime + windowMs });
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(max - 1));
        next();
        return;
      }

      existing.count += 1;
      if (existing.count > max) {
        const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        next(
          new AppError('RATE_LIMITED', 'Too many requests. Try again shortly.', {
            retryAfterSeconds: retryAfterSec,
          })
        );
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - existing.count));
      next();
    },
  };
}
