/**
 * The defect this suite exists to prevent: a provider failure being answered
 * with invented business facts under a 2xx status.
 *
 * These assertions are deliberately blunt. If a future change reintroduces any
 * canned-response path, these fail.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { AppError } from '../../server/errors.js';
import { bearer, buildApp, stubGemini } from './helpers.js';

/** Phrases from the removed rule engine, plus the claims it used to make. */
const FABRICATION_MARKERS = [
  'FedEx',
  'Zurich',
  'Evelyn Vance',
  '#4829',
  'has been frozen',
  'been immediately frozen',
  'verified and authorized',
  'reserved an appointment',
  'prepaid shipping label',
  'out for delivery',
  'overnighted',
];

async function startSession(app: Parameters<typeof request>[0], uid: string, flow = 'customer_support') {
  const res = await request(app).post('/api/sessions').set(...bearer(uid)).send({ flow });
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

describe('provider failure is never disguised as success', () => {
  const failures: Array<[string, AppError, number]> = [
    ['provider unreachable', new AppError('LLM_ERROR', 'unreachable'), 502],
    ['provider timeout', new AppError('LLM_TIMEOUT', 'timed out'), 504],
    ['provider rejected credentials', new AppError('LLM_AUTH_ERROR', 'bad key'), 502],
    ['provider rate limited', new AppError('LLM_RATE_LIMITED', 'slow down'), 429],
    ['no model configured', new AppError('LLM_NOT_CONFIGURED', 'no key'), 503],
  ];

  for (const [label, error, expectedStatus] of failures) {
    it(`returns ${expectedStatus} and no content when the ${label}`, async () => {
      const gemini = stubGemini({ failWith: error });
      const { app } = buildApp({ gemini });
      const sessionId = await startSession(app, 'alice');

      const res = await request(app)
        .post(`/api/sessions/${sessionId}/chat`)
        .set(...bearer('alice'))
        .send({ message: 'Can you check the status of my order #4829?' });

      expect(res.status).toBe(expectedStatus);
      expect(res.body.error.code).toBe(error.code);
      expect(res.body.success).toBeUndefined();
      expect(res.body.reply).toBeUndefined();
      expect(res.body.response).toBeUndefined();
      expect(res.body.botReply).toBeUndefined();
    });
  }

  it('never emits a known fabricated business claim on any flow', async () => {
    const prompts = [
      'Can you check the status of my order #4829?',
      'Freeze my primary debit card immediately.',
      'Verify the Zurich charge as authorized.',
      'Can I schedule an appointment for Thursday?',
      "I'd like to initiate an exchange for my overcoat.",
    ];
    const flows = ['customer_support', 'account_security', 'clinical_intake', 'real_estate'];

    for (const flow of flows) {
      const gemini = stubGemini({ failWith: new AppError('LLM_ERROR', 'down') });
      const { app } = buildApp({ gemini });
      const sessionId = await startSession(app, 'alice', flow);

      for (const message of prompts) {
        const res = await request(app)
          .post(`/api/sessions/${sessionId}/chat`)
          .set(...bearer('alice'))
          .send({ message });

        expect(res.status).toBeGreaterThanOrEqual(400);
        const body = JSON.stringify(res.body);
        for (const marker of FABRICATION_MARKERS) {
          expect(body).not.toContain(marker);
        }
      }
    }
  });

  it('does not commit the user turn when the provider fails, so a retry is clean', async () => {
    const gemini = stubGemini({ failWith: new AppError('LLM_ERROR', 'down') });
    const { app, sessions } = buildApp({ gemini });
    const sessionId = await startSession(app, 'alice');

    await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set(...bearer('alice'))
      .send({ message: 'hello' });

    const listed = await request(app).get(`/api/sessions/${sessionId}`).set(...bearer('alice'));
    expect(listed.body.turns).toEqual([]);
    expect(sessions.requireOwned(sessionId, 'alice').turns).toHaveLength(0);
  });

  it('treats an empty completion as a failure rather than speaking silence', async () => {
    const gemini = stubGemini();
    gemini.generateConversationResponse = async () => {
      throw new AppError('LLM_ERROR', 'The language model returned an empty response.');
    };
    const { app } = buildApp({ gemini });
    const sessionId = await startSession(app, 'alice');

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set(...bearer('alice'))
      .send({ message: 'hello' });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('LLM_ERROR');
  });
});

describe('no fabricated telemetry or transport', () => {
  it('reports voice components as not implemented rather than healthy', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    expect(res.body.components.stt.status).toBe('not_implemented');
    expect(res.body.components.tts.status).toBe('not_implemented');
    expect(res.body.components.transport.status).toBe('not_implemented');
    expect(res.body.metrics).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('framesProcessed');
  });

  it('advertises no provider it cannot run', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/services');

    expect(res.body.stt).toEqual([]);
    expect(res.body.tts).toEqual([]);
    expect(res.body.transports).toEqual([]);
    const body = JSON.stringify(res.body);
    for (const absent of ['Deepgram', 'Cartesia', 'AssemblyAI', 'Whisper', 'Silero', 'Daily', 'ElevenLabs']) {
      expect(body).not.toContain(absent);
    }
  });

  it('returns no fake transport offer when a session starts', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/sessions').set(...bearer('alice')).send({});

    expect(res.body.transport).toEqual({ status: 'not_implemented' });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('v=0');
    expect(body).not.toContain('daily.co');
    expect(body).not.toContain('wss://');
  });

  it('reports only measured timings on a successful turn', async () => {
    const { app } = buildApp();
    const sessionId = await startSession(app, 'alice');
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/chat`)
      .set(...bearer('alice'))
      .send({ message: 'hello' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.metrics)).toEqual(['llmLatencyMs']);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('framesEmitted');
    expect(body).not.toContain('vadDurationMs');
    expect(body).not.toContain('sttDurationMs');
  });
});
