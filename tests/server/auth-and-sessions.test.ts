/**
 * Identity, ownership, expiry and rate limiting on the API surface.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { SessionStore } from '../../server/sessions.js';
import { bearer, buildApp, stubGemini } from './helpers.js';

async function startSession(app: Parameters<typeof request>[0], uid: string) {
  const res = await request(app).post('/api/sessions').set(...bearer(uid)).send({});
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

describe('authentication', () => {
  const protectedRoutes: Array<[string, string]> = [
    ['post', '/api/sessions'],
    ['get', '/api/sessions'],
    ['get', '/api/sessions/some-id'],
    ['post', '/api/sessions/some-id/stop'],
    ['post', '/api/sessions/some-id/chat'],
    ['post', '/api/chat'],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`rejects ${method.toUpperCase()} ${path} without a token`, async () => {
      const { app } = buildApp();
      const res = await (request(app) as any)[method](path).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
  }

  it('rejects a token the verifier refuses', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/sessions').set(...bearer('bad'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID');
  });

  it('fails closed when no verifier is configured', async () => {
    const { app } = buildApp({ verifier: null });
    const res = await request(app).get('/api/sessions').set(...bearer('alice'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('ignores a userId supplied in the body and uses the token identity', async () => {
    const { app, sessions } = buildApp();
    const res = await request(app)
      .post('/api/sessions')
      .set(...bearer('alice'))
      .send({ userId: 'bob', flow: 'customer_support' });

    expect(res.status).toBe(201);
    expect(sessions.requireOwned(res.body.session.id, 'alice').userId).toBe('alice');
  });
});

describe('session ownership', () => {
  it('keeps one user’s session invisible and untouchable to another', async () => {
    const { app } = buildApp();
    const sessionA = await startSession(app, 'alice');

    const list = await request(app).get('/api/sessions').set(...bearer('bob'));
    expect(list.body.sessions).toEqual([]);

    const read = await request(app).get(`/api/sessions/${sessionA}`).set(...bearer('bob'));
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe('SESSION_NOT_FOUND');

    const stop = await request(app).post(`/api/sessions/${sessionA}/stop`).set(...bearer('bob'));
    expect(stop.status).toBe(404);

    const chat = await request(app)
      .post(`/api/sessions/${sessionA}/chat`)
      .set(...bearer('bob'))
      .send({ message: 'let me in' });
    expect(chat.status).toBe(404);

    // Still intact and usable by its owner.
    const ownerRead = await request(app).get(`/api/sessions/${sessionA}`).set(...bearer('alice'));
    expect(ownerRead.status).toBe(200);
  });

  it('uses unguessable session ids', async () => {
    const { app } = buildApp();
    const id = await startSession(app, 'alice');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).not.toMatch(/^session_\d+/);
  });
});

describe('conversation history', () => {
  it('preserves alternating turns across requests', async () => {
    const gemini = stubGemini({ reply: 'Noted.' });
    const { app } = buildApp({ gemini });
    const sessionId = await startSession(app, 'alice');

    await request(app).post(`/api/sessions/${sessionId}/chat`).set(...bearer('alice')).send({ message: 'first' });
    await request(app).post(`/api/sessions/${sessionId}/chat`).set(...bearer('alice')).send({ message: 'second' });

    const read = await request(app).get(`/api/sessions/${sessionId}`).set(...bearer('alice'));
    expect(read.body.turns.map((t: { role: string }) => t.role)).toEqual([
      'user', 'assistant', 'user', 'assistant',
    ]);

    // The second provider call saw the whole prior transcript, not just the latest line.
    expect(gemini.calls[1].turns.map((t) => t.content)).toEqual(['first', 'Noted.', 'second']);
  });

  it('builds history from the store, not from client-supplied turns', async () => {
    const gemini = stubGemini();
    const { app } = buildApp({ gemini });
    const sessionId = await startSession(app, 'alice');

    await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set(...bearer('alice'))
      .send({ message: 'real', turns: [{ role: 'user', content: 'INJECTED' }] });

    expect(JSON.stringify(gemini.calls[0].turns)).not.toContain('INJECTED');
  });
});

describe('session expiry', () => {
  it('expires an idle session and rejects further turns', async () => {
    let clock = 1_000;
    const sessions = new SessionStore({ idleTimeoutMs: 1_000, now: () => clock });
    const { app } = buildApp({ sessions });
    const sessionId = await startSession(app, 'alice');

    clock += 5_000;

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set(...bearer('alice'))
      .send({ message: 'still there?' });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('sweeps expired sessions out of memory', async () => {
    let clock = 1_000;
    const sessions = new SessionStore({ idleTimeoutMs: 1_000, now: () => clock });
    const { app } = buildApp({ sessions });
    await startSession(app, 'alice');
    expect(sessions.size).toBe(1);

    clock += 5_000;
    expect(sessions.sweepExpired()).toBe(1);
    expect(sessions.size).toBe(0);
  });

  it('bounds how many sessions one user can hold open', async () => {
    const sessions = new SessionStore({ maxSessionsPerUser: 3 });
    const { app } = buildApp({ sessions });
    for (let i = 0; i < 8; i += 1) await startSession(app, 'alice');
    expect(sessions.size).toBe(3);
  });

  it('rejects an unknown session id', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/sessions/11111111-1111-4111-8111-111111111111/chat')
      .set(...bearer('alice'))
      .send({ message: 'hi' });
    expect(res.status).toBe(404);
  });
});

describe('input validation', () => {
  it('rejects a model the server does not support', async () => {
    const { app } = buildApp();
    for (const model of ['gemini-flash', 'gpt-4o-mini', 'claude-3-5-haiku', 'groq-llama', '../../etc']) {
      const res = await request(app).post('/api/sessions').set(...bearer('alice')).send({ model });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MODEL');
    }
  });

  it('never passes an unsupported model through to the provider', async () => {
    const gemini = stubGemini();
    const { app } = buildApp({ gemini });
    await request(app).post('/api/chat').set(...bearer('alice')).send({
      turns: [{ role: 'user', content: 'hi' }],
      model: 'attacker-controlled',
    });
    expect(gemini.calls).toHaveLength(0);
  });

  it('rejects an unknown flow and malformed messages', async () => {
    const { app } = buildApp();
    const flow = await request(app).post('/api/sessions').set(...bearer('alice')).send({ flow: 'nope' });
    expect(flow.status).toBe(400);

    const sessionId = await startSession(app, 'alice');
    for (const message of [undefined, '', '   ', 42, { a: 1 }]) {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/chat`)
        .set(...bearer('alice'))
        .send({ message });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });
});

describe('rate limiting', () => {
  it('returns 429 once a user exceeds the per-window budget', async () => {
    const { app } = buildApp({ enableRateLimit: true });
    const sessionId = await startSession(app, 'alice');

    let sawRateLimit = false;
    for (let i = 0; i < 30; i += 1) {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/chat`)
        .set(...bearer('alice'))
        .send({ message: `turn ${i}` });
      if (res.status === 429) {
        expect(res.body.error.code).toBe('RATE_LIMITED');
        expect(res.headers['retry-after']).toBeDefined();
        sawRateLimit = true;
        break;
      }
    }
    expect(sawRateLimit).toBe(true);
  });

  it('meters each user separately', async () => {
    const { app } = buildApp({ enableRateLimit: true });
    const aliceSession = await startSession(app, 'alice');
    for (let i = 0; i < 25; i += 1) {
      await request(app).post(`/api/sessions/${aliceSession}/chat`).set(...bearer('alice')).send({ message: 'x' });
    }
    // Bob's budget is untouched by Alice exhausting hers.
    const bobSession = await request(app).post('/api/sessions').set(...bearer('bob')).send({});
    expect(bobSession.status).toBe(201);
  });
});
