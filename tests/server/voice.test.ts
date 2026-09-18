/**
 * The voice session surface: ownership, and the rule that a session which did
 * not negotiate is never reported as connected.
 */
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { createApp } from '../../server/app.js';
import { AppError } from '../../server/errors.js';
import { VoiceSessionStore } from '../../server/voiceSessions.js';
import type { SdpAnswer, VoiceWorkerClient } from '../../server/voiceWorker.js';
import { bearer, stubGemini, testVerifier } from './helpers.js';

const OFFER = { sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', type: 'offer' };

interface StubWorker extends VoiceWorkerClient {
  negotiateCalls: Array<Record<string, unknown>>;
  failWith: AppError | null;
}

function stubWorker(overrides: { configured?: boolean; failWith?: AppError } = {}): StubWorker {
  const worker: StubWorker = {
    negotiateCalls: [],
    failWith: overrides.failWith ?? null,
    isConfigured: () => overrides.configured ?? true,
    readiness: async () => ({ status: 'ready', providers: { gemini: 'configured' } }),
    async negotiate(spec, offer): Promise<SdpAnswer> {
      worker.negotiateCalls.push({ ...spec, sdp: offer.sdp });
      if (worker.failWith) throw worker.failWith;
      return { sdp: 'v=0\r\nanswer', type: 'answer', pc_id: `pc-${spec.sessionId}` };
    },
    addIceCandidates: vi.fn(async () => {}),
    events: async () => [{ event: 'session.created', sessionId: 'x', atMs: 1 }],
  };
  return worker;
}

function buildVoiceApp(worker: VoiceWorkerClient = stubWorker(), store = new VoiceSessionStore()) {
  const app = createApp({
    verifier: testVerifier,
    gemini: stubGemini(),
    voiceWorker: worker,
    voiceSessions: store,
    enableRateLimit: false,
  });
  return { app, store };
}

async function startVoiceSession(app: Parameters<typeof request>[0], uid: string, personaId = 'real_estate') {
  const res = await request(app).post('/api/voice/sessions').set(...bearer(uid)).send({ personaId });
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

describe('authentication', () => {
  const routes: Array<[string, string]> = [
    ['post', '/api/voice/sessions'],
    ['get', '/api/voice/sessions'],
    ['post', '/api/voice/sessions/abc/offer'],
    ['patch', '/api/voice/sessions/abc/ice'],
    ['get', '/api/voice/sessions/abc/events'],
    ['post', '/api/voice/sessions/abc/stop'],
    ['get', '/api/voice/readiness'],
  ];

  for (const [method, path] of routes) {
    it(`rejects ${method.toUpperCase()} ${path} without a token`, async () => {
      const { app } = buildVoiceApp();
      const res = await (request(app) as any)[method](path).send({});
      expect(res.status).toBe(401);
    });
  }
});

describe('session creation', () => {
  it('refuses when no worker is configured rather than pretending', async () => {
    const { app } = buildVoiceApp(stubWorker({ configured: false }));
    const res = await request(app).post('/api/voice/sessions').set(...bearer('alice')).send({});
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('VOICE_WORKER_NOT_CONFIGURED');
  });

  it('rejects an unknown persona', async () => {
    const { app } = buildVoiceApp();
    const res = await request(app)
      .post('/api/voice/sessions')
      .set(...bearer('alice'))
      .send({ personaId: 'not_a_persona' });
    expect(res.status).toBe(400);
  });

  it('issues an unguessable id and starts in a pre-connected state', async () => {
    const { app } = buildVoiceApp();
    const res = await request(app).post('/api/voice/sessions').set(...bearer('alice')).send({});

    expect(res.body.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(res.body.session.status).toBe('created');
    // Ownership is server-side and never echoed to the browser.
    expect(res.body.session.userId).toBeUndefined();
  });
});

describe('negotiation', () => {
  it('returns the worker answer and records the session as negotiated', async () => {
    const worker = stubWorker();
    const { app, store } = buildVoiceApp(worker);
    const sessionId = await startVoiceSession(app, 'alice');

    const res = await request(app)
      .post(`/api/voice/sessions/${sessionId}/offer`)
      .set(...bearer('alice'))
      .send(OFFER);

    expect(res.status).toBe(200);
    expect(res.body.answer.type).toBe('answer');
    expect(store.requireOwned(sessionId, 'alice').status).toBe('negotiated');
  });

  it('resolves the persona server-side rather than from the browser', async () => {
    const worker = stubWorker();
    const { app } = buildVoiceApp(worker);
    const sessionId = await startVoiceSession(app, 'alice', 'clinical_intake');

    await request(app)
      .post(`/api/voice/sessions/${sessionId}/offer`)
      .set(...bearer('alice'))
      // A browser trying to redirect the session at negotiation time.
      .send({ ...OFFER, personaId: 'real_estate', voiceProfileId: 'attacker_choice' });

    expect(worker.negotiateCalls[0]).toMatchObject({
      sessionId,
      personaId: 'clinical_intake',
    });
    expect(worker.negotiateCalls[0].voiceProfileId).toBeUndefined();
  });

  it('marks the session failed and reports the failure when the worker refuses', async () => {
    const worker = stubWorker({
      failWith: new AppError('VOICE_WORKER_UNAVAILABLE', 'worker down'),
    });
    const { app, store } = buildVoiceApp(worker);
    const sessionId = await startVoiceSession(app, 'alice');

    const res = await request(app)
      .post(`/api/voice/sessions/${sessionId}/offer`)
      .set(...bearer('alice'))
      .send(OFFER);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('VOICE_WORKER_UNAVAILABLE');
    // Nothing in the response could be mistaken for a live connection.
    expect(res.body.answer).toBeUndefined();

    // The stored session reflects the failure, so a later read cannot show it
    // as connectable.
    const listed = await request(app).get('/api/voice/sessions').set(...bearer('alice'));
    expect(listed.body.sessions[0].status).toBe('failed');
    expect(listed.body.sessions[0].failureCode).toBe('VOICE_WORKER_UNAVAILABLE');
  });

  it('will not negotiate a session that already failed', async () => {
    const worker = stubWorker({ failWith: new AppError('VOICE_WORKER_TIMEOUT', 'slow') });
    const { app } = buildVoiceApp(worker);
    const sessionId = await startVoiceSession(app, 'alice');

    await request(app).post(`/api/voice/sessions/${sessionId}/offer`).set(...bearer('alice')).send(OFFER);
    const retry = await request(app)
      .post(`/api/voice/sessions/${sessionId}/offer`)
      .set(...bearer('alice'))
      .send(OFFER);

    expect(retry.status).toBe(410);
  });

  for (const bad of [{ type: 'offer' }, { sdp: '', type: 'offer' }, { sdp: 'x', type: 'answer' }]) {
    it(`rejects a malformed offer ${JSON.stringify(bad).slice(0, 40)}`, async () => {
      const { app } = buildVoiceApp();
      const sessionId = await startVoiceSession(app, 'alice');
      const res = await request(app)
        .post(`/api/voice/sessions/${sessionId}/offer`)
        .set(...bearer('alice'))
        .send(bad);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    });
  }

  it('rejects an oversized body as a client error, not a server fault', async () => {
    const { app } = buildVoiceApp();
    const sessionId = await startVoiceSession(app, 'alice');
    const res = await request(app)
      .post(`/api/voice/sessions/${sessionId}/offer`)
      .set(...bearer('alice'))
      .send({ sdp: 'x'.repeat(200_000), type: 'offer' });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('ownership', () => {
  it("keeps one user's voice session invisible and untouchable to another", async () => {
    const { app } = buildVoiceApp();
    const sessionA = await startVoiceSession(app, 'alice');

    const list = await request(app).get('/api/voice/sessions').set(...bearer('bob'));
    expect(list.body.sessions).toEqual([]);

    for (const attempt of [
      request(app).post(`/api/voice/sessions/${sessionA}/offer`).set(...bearer('bob')).send(OFFER),
      request(app).patch(`/api/voice/sessions/${sessionA}/ice`).set(...bearer('bob')).send({ candidates: [] }),
      request(app).get(`/api/voice/sessions/${sessionA}/events`).set(...bearer('bob')),
      request(app).post(`/api/voice/sessions/${sessionA}/stop`).set(...bearer('bob')),
    ]) {
      const res = await attempt;
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    }

    // Still usable by its owner.
    const owner = await request(app).get('/api/voice/sessions').set(...bearer('alice'));
    expect(owner.body.sessions).toHaveLength(1);
  });

  it('never lets one user relay ICE into another user’s peer connection', async () => {
    const worker = stubWorker();
    const { app } = buildVoiceApp(worker);
    const sessionA = await startVoiceSession(app, 'alice');
    await request(app).post(`/api/voice/sessions/${sessionA}/offer`).set(...bearer('alice')).send(OFFER);

    const res = await request(app)
      .patch(`/api/voice/sessions/${sessionA}/ice`)
      .set(...bearer('bob'))
      .send({ candidates: [{ candidate: 'x', sdpMid: '0', sdpMLineIndex: 0 }] });

    expect(res.status).toBe(404);
    expect(worker.addIceCandidates).not.toHaveBeenCalled();
  });
});

describe('ice and events', () => {
  it('refuses candidates before negotiation', async () => {
    const { app } = buildVoiceApp();
    const sessionId = await startVoiceSession(app, 'alice');
    const res = await request(app)
      .patch(`/api/voice/sessions/${sessionId}/ice`)
      .set(...bearer('alice'))
      .send({ candidates: [{ candidate: 'x', sdpMid: '0', sdpMLineIndex: 0 }] });

    expect(res.status).toBe(400);
  });

  it('relays the worker’s own events rather than synthesising a timeline', async () => {
    const { app } = buildVoiceApp();
    const sessionId = await startVoiceSession(app, 'alice');
    const res = await request(app)
      .get(`/api/voice/sessions/${sessionId}/events`)
      .set(...bearer('alice'));

    expect(res.status).toBe(200);
    expect(res.body.events[0].event).toBe('session.created');
  });

  it('reports no events rather than failing once the worker has finished', async () => {
    const worker = stubWorker();
    worker.events = async () => {
      throw new AppError('VOICE_NOT_FOUND', 'gone');
    };
    const { app } = buildVoiceApp(worker);
    const sessionId = await startVoiceSession(app, 'alice');

    const res = await request(app)
      .get(`/api/voice/sessions/${sessionId}/events`)
      .set(...bearer('alice'));
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });
});

describe('isolation', () => {
  it('gives two concurrent callers separate sessions and personas', async () => {
    const worker = stubWorker();
    const { app } = buildVoiceApp(worker);

    const a = await startVoiceSession(app, 'alice', 'real_estate');
    const b = await startVoiceSession(app, 'bob', 'clinical_intake');
    expect(a).not.toBe(b);

    await request(app).post(`/api/voice/sessions/${a}/offer`).set(...bearer('alice')).send(OFFER);
    await request(app).post(`/api/voice/sessions/${b}/offer`).set(...bearer('bob')).send(OFFER);

    const [callA, callB] = worker.negotiateCalls;
    expect(callA.personaId).toBe('real_estate');
    expect(callB.personaId).toBe('clinical_intake');
    expect(callA.sessionId).not.toBe(callB.sessionId);
  });
});
