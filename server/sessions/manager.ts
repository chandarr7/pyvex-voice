import crypto from 'crypto';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AgentSession {
  id: string;
  userId: string;
  flow: string;
  transport: string;
  sttService: string;
  llmService: string;
  ttsService: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  expiresAt: number;
  status: 'active' | 'idle' | 'stopped';
  messageCount: number;
  history: ConversationMessage[];
}

export interface CreateSessionParams {
  userId: string;
  flow: string;
  transport?: string;
  stt?: string;
  llm?: string;
  tts?: string;
}

export class SessionManager {
  private sessions = new Map<string, AgentSession>();
  private sweeperInterval: NodeJS.Timeout | null = null;

  // Defaults: 15 min idle TTL, 2 hour max lifetime
  constructor(
    private readonly idleTimeoutMs: number = 15 * 60 * 1000,
    private readonly maxLifetimeMs: number = 2 * 60 * 60 * 1000
  ) {
    this.startSweeper();
  }

  public createSession(params: CreateSessionParams): AgentSession {
    const now = Date.now();
    const id = `sess_${crypto.randomUUID()}`;

    const session: AgentSession = {
      id,
      userId: params.userId,
      flow: params.flow || 'customer_support',
      transport: params.transport || 'smallwebrtc',
      sttService: params.stt || 'deepgram',
      llmService: params.llm || 'gemini-3.5-flash',
      ttsService: params.tts || 'elevenlabs',
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      expiresAt: Math.min(now + this.idleTimeoutMs, now + this.maxLifetimeMs),
      status: 'active',
      messageCount: 0,
      history: [],
    };

    this.sessions.set(id, session);
    return session;
  }

  public getSession(id: string, userId: string): AgentSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;

    // Strict ownership verification
    if (session.userId !== userId) {
      return null;
    }

    // Check expiration
    if (this.isExpired(session)) {
      this.sessions.delete(id);
      return null;
    }

    return session;
  }

  public getSessionRaw(id: string): AgentSession | null {
    return this.sessions.get(id) || null;
  }

  public touchSession(id: string, userId: string): boolean {
    const session = this.getSession(id, userId);
    if (!session) return false;

    const now = Date.now();
    session.lastActivityAt = now;
    session.updatedAt = now;
    session.expiresAt = Math.min(now + this.idleTimeoutMs, session.createdAt + this.maxLifetimeMs);
    return true;
  }

  public appendTurn(id: string, userId: string, userText: string, assistantText: string): boolean {
    const session = this.getSession(id, userId);
    if (!session) return false;

    const now = Date.now();
    session.messageCount += 1;
    session.lastActivityAt = now;
    session.updatedAt = now;
    session.expiresAt = Math.min(now + this.idleTimeoutMs, session.createdAt + this.maxLifetimeMs);

    session.history.push({
      role: 'user',
      content: userText,
      timestamp: now,
    });
    session.history.push({
      role: 'assistant',
      content: assistantText,
      timestamp: now,
    });

    // Cap conversation history at last 40 turns to prevent unbounded memory growth
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    return true;
  }

  public stopSession(id: string, userId: string): boolean {
    const session = this.getSession(id, userId);
    if (!session) return false;

    session.status = 'stopped';
    this.sessions.delete(id);
    return true;
  }

  public stopSessionRaw(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.status = 'stopped';
    this.sessions.delete(id);
    return true;
  }

  public listUserSessions(userId: string): AgentSession[] {
    const result: AgentSession[] = [];
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        if (this.isExpired(session, now)) {
          this.sessions.delete(id);
        } else {
          result.push(session);
        }
      }
    }
    return result;
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }

  public clear(): void {
    this.sessions.clear();
  }

  public stopSweeper(): void {
    if (this.sweeperInterval) {
      clearInterval(this.sweeperInterval);
      this.sweeperInterval = null;
    }
  }

  public destroy(): void {
    this.stopSweeper();
    this.clear();
  }

  private isExpired(session: AgentSession, now: number = Date.now()): boolean {
    return now >= session.expiresAt || (now - session.createdAt) >= this.maxLifetimeMs;
  }

  private startSweeper(): void {
    // Run sweeper every 30 seconds
    this.sweeperInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (this.isExpired(session, now)) {
          this.sessions.delete(id);
        }
      }
    }, 30000);

    if (this.sweeperInterval.unref) {
      this.sweeperInterval.unref();
    }
  }
}

export const sessionManager = new SessionManager();
