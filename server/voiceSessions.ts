/**
 * Live voice sessions, owned by the user who created them.
 *
 * Separate from the text SessionStore because a voice session's lifecycle is
 * the transport's: it is negotiating, connected, failed or ended, and those
 * states come from what actually happened to the peer connection.
 *
 * State lives in this process. A worker restart ends live calls, which no
 * amount of bookkeeping here can change; durable conversation history belongs
 * in Supabase, not in this map.
 */
import { randomUUID } from 'node:crypto';

import { AppError } from './errors.js';

export type VoiceSessionStatus =
  | 'created'
  | 'negotiated'
  | 'connected'
  | 'failed'
  | 'ended';

export interface VoiceSession {
  id: string;
  userId: string;
  personaId: string;
  voiceProfileId?: string;
  /** The worker's peer-connection id, known only after negotiation. */
  pcId?: string;
  status: VoiceSessionStatus;
  failureCode?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export type VoiceSessionSummary = Omit<VoiceSession, 'userId'>;

export interface VoiceSessionStoreOptions {
  /** A session that never negotiates should not hold memory indefinitely. */
  idleTimeoutMs?: number;
  maxSessionsPerUser?: number;
  now?: () => number;
}

const DEFAULTS = { idleTimeoutMs: 30 * 60 * 1000, maxSessionsPerUser: 3 };

export class VoiceSessionStore {
  private readonly sessions = new Map<string, VoiceSession>();
  private readonly idleTimeoutMs: number;
  private readonly maxSessionsPerUser: number;
  private readonly now: () => number;
  private sweeper: NodeJS.Timeout | null = null;

  constructor(options: VoiceSessionStoreOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs;
    this.maxSessionsPerUser = options.maxSessionsPerUser ?? DEFAULTS.maxSessionsPerUser;
    this.now = options.now ?? Date.now;
  }

  startSweeper(intervalMs = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweepExpired(), intervalMs);
    this.sweeper.unref?.();
  }

  stopSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  clear(): void {
    this.sessions.clear();
  }

  get size(): number {
    return this.sessions.size;
  }

  sweepExpired(): number {
    const currentTime = this.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= currentTime) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  toSummary(session: VoiceSession): VoiceSessionSummary {
    const { userId, ...rest } = session;
    return rest;
  }

  create(params: {
    userId: string;
    personaId: string;
    voiceProfileId?: string;
  }): VoiceSession {
    this.sweepExpired();
    const currentTime = this.now();

    const owned = [...this.sessions.values()].filter((s) => s.userId === params.userId);
    if (owned.length >= this.maxSessionsPerUser) {
      // A live call is expensive, so the cap evicts the least recently touched
      // rather than refusing to start a new one.
      const oldest = owned.reduce((a, b) => (a.updatedAt <= b.updatedAt ? a : b));
      this.sessions.delete(oldest.id);
    }

    const session: VoiceSession = {
      id: randomUUID(),
      userId: params.userId,
      personaId: params.personaId,
      voiceProfileId: params.voiceProfileId,
      status: 'created',
      createdAt: currentTime,
      updatedAt: currentTime,
      expiresAt: currentTime + this.idleTimeoutMs,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  listForUser(userId: string): VoiceSessionSummary[] {
    this.sweepExpired();
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => this.toSummary(s));
  }

  /**
   * Fetch a session the caller owns.
   *
   * Someone else's session reports SESSION_NOT_FOUND, identical to one that
   * never existed, so ids cannot be probed for existence.
   */
  requireOwned(sessionId: string, userId: string): VoiceSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError('SESSION_NOT_FOUND', 'No such voice session.');
    }
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      throw new AppError('SESSION_EXPIRED', 'This voice session has expired.');
    }
    if (session.status === 'ended' || session.status === 'failed') {
      throw new AppError('SESSION_EXPIRED', 'This voice session is no longer active.');
    }
    return session;
  }

  private touch(session: VoiceSession): void {
    const currentTime = this.now();
    session.updatedAt = currentTime;
    session.expiresAt = currentTime + this.idleTimeoutMs;
  }

  markNegotiated(sessionId: string, pcId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'negotiated';
    session.pcId = pcId ?? session.pcId;
    this.touch(session);
  }

  /**
   * Record that the transport reported a live connection.
   *
   * Only the transport's own state reaches this, never an optimistic guess
   * from having sent an answer.
   */
  markConnected(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'connected';
    this.touch(session);
  }

  markFailed(sessionId: string, failureCode: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'failed';
    session.failureCode = failureCode;
    this.touch(session);
  }

  stop(sessionId: string, userId: string): void {
    const session = this.requireOwned(sessionId, userId);
    session.status = 'ended';
    this.sessions.delete(session.id);
  }
}
