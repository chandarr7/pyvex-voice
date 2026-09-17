/**
 * In-memory conversation sessions, owned by the user who created them.
 *
 * The store is the authority on conversation history: a client sends one
 * utterance per turn and the transcript it gets back is the one the server
 * recorded, so a client cannot rewrite what was said earlier in the call.
 *
 * State lives in this process and is lost on restart. That is adequate while a
 * session is a single live conversation; durable transcripts belong in
 * Firestore alongside the rest of the user's data.
 */
import { randomUUID } from 'node:crypto';

import { AppError } from './errors.js';
import type { ConversationTurn } from './ai/gemini.js';

export type SessionStatus = 'active' | 'stopped' | 'expired';

export interface AgentSession {
  id: string;
  userId: string;
  flow: string;
  model: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  expiresAt: number;
  turns: ConversationTurn[];
}

/** The view returned to clients: history is fetched deliberately, not by default. */
export type SessionSummary = Omit<AgentSession, 'turns'> & { turnCount: number };

export interface SessionStoreOptions {
  /** Sliding window: each turn pushes expiry out by this much. */
  idleTimeoutMs?: number;
  /** Hard ceiling from creation, regardless of activity. */
  absoluteTimeoutMs?: number;
  maxTurns?: number;
  maxSessionsPerUser?: number;
  now?: () => number;
}

const DEFAULTS = {
  idleTimeoutMs: 15 * 60 * 1000,
  absoluteTimeoutMs: 2 * 60 * 60 * 1000,
  maxTurns: 100,
  maxSessionsPerUser: 10,
};

export function toSummary(session: AgentSession): SessionSummary {
  const { turns, ...rest } = session;
  return { ...rest, turnCount: turns.length };
}

export class SessionStore {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly idleTimeoutMs: number;
  private readonly absoluteTimeoutMs: number;
  private readonly maxTurns: number;
  private readonly maxSessionsPerUser: number;
  private readonly now: () => number;
  private sweeper: NodeJS.Timeout | null = null;

  constructor(options: SessionStoreOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs;
    this.absoluteTimeoutMs = options.absoluteTimeoutMs ?? DEFAULTS.absoluteTimeoutMs;
    this.maxTurns = options.maxTurns ?? DEFAULTS.maxTurns;
    this.maxSessionsPerUser = options.maxSessionsPerUser ?? DEFAULTS.maxSessionsPerUser;
    this.now = options.now ?? Date.now;
  }

  /** Begin periodic expiry sweeps. Unref'd so it never holds the process open. */
  startSweeper(intervalMs = 60_000): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => this.sweepExpired(), intervalMs);
    this.sweeper.unref?.();
  }

  stopSweeper(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }

  /** Drop everything, e.g. on shutdown. */
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

  create(params: { userId: string; flow: string; model: string }): AgentSession {
    const currentTime = this.now();
    this.sweepExpired();

    const owned = [...this.sessions.values()].filter((s) => s.userId === params.userId);
    if (owned.length >= this.maxSessionsPerUser) {
      // Evict this user's least recently used session rather than refusing to
      // start a call; the cap exists to bound memory, not to block the user.
      const oldest = owned.reduce((a, b) => (a.lastActivityAt <= b.lastActivityAt ? a : b));
      this.sessions.delete(oldest.id);
    }

    const session: AgentSession = {
      id: randomUUID(),
      userId: params.userId,
      flow: params.flow,
      model: params.model,
      status: 'active',
      createdAt: currentTime,
      updatedAt: currentTime,
      lastActivityAt: currentTime,
      expiresAt: currentTime + this.idleTimeoutMs,
      turns: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  listForUser(userId: string): SessionSummary[] {
    this.sweepExpired();
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map(toSummary);
  }

  /**
   * Fetch a session the caller owns.
   *
   * A session belonging to someone else reports SESSION_NOT_FOUND, identical to
   * one that never existed, so ids cannot be probed for existence.
   */
  requireOwned(sessionId: string, userId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError('SESSION_NOT_FOUND', 'No such session.');
    }
    if (session.expiresAt <= this.now()) {
      this.sessions.delete(sessionId);
      throw new AppError('SESSION_EXPIRED', 'This session has expired. Start a new one.');
    }
    if (session.status !== 'active') {
      throw new AppError('SESSION_EXPIRED', 'This session is no longer active.');
    }
    return session;
  }

  /** Record a turn and slide the idle window forward. */
  appendTurn(session: AgentSession, turn: ConversationTurn): void {
    session.turns.push(turn);
    if (session.turns.length > this.maxTurns) {
      session.turns.splice(0, session.turns.length - this.maxTurns);
    }
    const currentTime = this.now();
    session.updatedAt = currentTime;
    session.lastActivityAt = currentTime;
    session.expiresAt = Math.min(
      currentTime + this.idleTimeoutMs,
      session.createdAt + this.absoluteTimeoutMs
    );
  }

  stop(sessionId: string, userId: string): void {
    const session = this.requireOwned(sessionId, userId);
    session.status = 'stopped';
    this.sessions.delete(session.id);
  }
}
