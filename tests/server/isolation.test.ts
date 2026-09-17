/**
 * Two concurrent users, isolated: distinct sessions, distinct transcripts,
 * neither visible to the other.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { bearer, buildApp, stubGemini } from './helpers.js';

describe('concurrent user isolation', () => {
  it('keeps two live conversations separate', async () => {
    const gemini = stubGemini();
    const { app } = buildApp({ gemini });

    const a = await request(app).post('/api/sessions').set(...bearer('alice')).send({ flow: 'real_estate' });
    const b = await request(app).post('/api/sessions').set(...bearer('bob')).send({ flow: 'clinical_intake' });

    expect(a.body.session.id).not.toBe(b.body.session.id);
    expect(a.body.session.flow).toBe('real_estate');
    expect(b.body.session.flow).toBe('clinical_intake');

    await request(app).post(`/api/sessions/${a.body.session.id}/chat`).set(...bearer('alice')).send({ message: 'ALICE_SECRET' });
    await request(app).post(`/api/sessions/${b.body.session.id}/chat`).set(...bearer('bob')).send({ message: 'BOB_SECRET' });

    const aRead = await request(app).get(`/api/sessions/${a.body.session.id}`).set(...bearer('alice'));
    const bRead = await request(app).get(`/api/sessions/${b.body.session.id}`).set(...bearer('bob'));

    expect(JSON.stringify(aRead.body)).toContain('ALICE_SECRET');
    expect(JSON.stringify(aRead.body)).not.toContain('BOB_SECRET');
    expect(JSON.stringify(bRead.body)).toContain('BOB_SECRET');
    expect(JSON.stringify(bRead.body)).not.toContain('ALICE_SECRET');

    // Each persona reached the model with its own system prompt.
    const prompts = gemini.calls.map((c) => c.systemInstruction ?? '');
    expect(prompts[0]).toContain('property enquiry');
    expect(prompts[1]).toContain('clinical intake');

    // Neither user's session list contains the other's.
    const aList = await request(app).get('/api/sessions').set(...bearer('alice'));
    expect(aList.body.sessions).toHaveLength(1);
    expect(aList.body.sessions[0].id).toBe(a.body.session.id);
  });
});
