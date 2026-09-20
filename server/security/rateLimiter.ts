import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly options: RateLimiterOptions) {
    this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(options.windowMs, 30000));
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.resolveKey(req);
      const now = Date.now();
      const cutoff = now - this.options.windowMs;

      let record = this.records.get(key);
      if (!record) {
        record = { timestamps: [] };
        this.records.set(key, record);
      }

      // Filter out timestamps older than the sliding window
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

      if (record.timestamps.length >= this.options.maxRequests) {
        const oldest = record.timestamps[0];
        const retryAfterSeconds = Math.ceil((oldest + this.options.windowMs - now) / 1000);

        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
          error: `Rate limit exceeded. Maximum ${this.options.maxRequests} requests per ${Math.round(this.options.windowMs / 1000)}s.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds,
        });
      }

      record.timestamps.push(now);
      res.setHeader('X-RateLimit-Limit', this.options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', this.options.maxRequests - record.timestamps.length);
      next();
    };
  }

  public reset(): void {
    this.records.clear();
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private resolveKey(req: Request): string {
    const prefix = this.options.keyPrefix || 'rl';
    const userId = req.user?.uid;
    if (userId) {
      return `${prefix}:uid:${userId}`;
    }
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return `${prefix}:ip:${ip}`;
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.options.windowMs;
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters
export const chatRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  keyPrefix: 'chat',
});

export const sessionStartRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'session_start',
});

export const voicePreviewRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'voice_preview',
});
