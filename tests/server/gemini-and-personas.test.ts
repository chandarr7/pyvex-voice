/**
 * Provider error translation, the single model vocabulary, and the guarantee
 * that no persona is told to perform an action the system cannot perform.
 */
import { describe, expect, it } from 'vitest';

import { createGeminiService, normalizeGeminiError } from '../../server/ai/gemini.js';
import { defaultModel, isSupportedModel, supportedModels } from '../../server/models.js';
import { PRESET_FLOWS } from '../../server/personas.js';

describe('provider error translation', () => {
  const cases: Array<[string, unknown, string]> = [
    ['a 401', { status: 401, message: 'unauthorized' }, 'LLM_AUTH_ERROR'],
    ['an API key complaint', { message: 'API key not valid' }, 'LLM_AUTH_ERROR'],
    ['a 429', { status: 429, message: 'too many' }, 'LLM_RATE_LIMITED'],
    ['a quota message', { message: 'RESOURCE_EXHAUSTED' }, 'LLM_RATE_LIMITED'],
    ['a timeout', { message: 'PYVEX_TIMEOUT' }, 'LLM_TIMEOUT'],
    ['a deadline', { message: 'DEADLINE_EXCEEDED' }, 'LLM_TIMEOUT'],
    ['a 404', { status: 404, message: 'model not found' }, 'INVALID_MODEL'],
    ['anything else', { message: 'socket hang up' }, 'LLM_ERROR'],
  ];

  for (const [label, raw, expectedCode] of cases) {
    it(`maps ${label} to ${expectedCode}`, () => {
      expect(normalizeGeminiError(raw).code).toBe(expectedCode);
    });
  }

  it('never leaks the raw provider message to the client', () => {
    const err = normalizeGeminiError({ status: 401, message: 'key AIzaSyExampleNotReal rejected' });
    expect(err.message).not.toContain('AIzaSy');
  });
});

describe('model whitelist', () => {
  it('rejects every identifier the old catalog offered', () => {
    for (const bad of ['gemini-flash', 'gpt-4o-mini', 'claude-3-5-haiku', 'groq-llama', '', null, 7]) {
      expect(isSupportedModel(bad)).toBe(false);
    }
  });

  it('accepts its own advertised models and has a default among them', () => {
    const models = supportedModels();
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) expect(isSupportedModel(model.id)).toBe(true);
    expect(isSupportedModel(defaultModel())).toBe(true);
  });

  it('honours a deployment override', () => {
    const env = { PYVEX_GEMINI_MODELS: 'gemini-2.5-flash' } as NodeJS.ProcessEnv;
    expect(supportedModels(env).map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    expect(isSupportedModel('gemini-3.5-flash', env)).toBe(false);
  });
});

describe('gemini service guards', () => {
  it('reports missing configuration instead of attempting a call', async () => {
    const service = createGeminiService({} as NodeJS.ProcessEnv);
    expect(service.isConfigured()).toBe(false);
    await expect(
      service.generateConversationResponse({ turns: [{ role: 'user', content: 'hi' }] })
    ).rejects.toMatchObject({ code: 'LLM_NOT_CONFIGURED' });
  });

  it('rejects an unsupported model before constructing a client', async () => {
    const service = createGeminiService({ GEMINI_API_KEY: 'unused-in-this-test' } as NodeJS.ProcessEnv);
    await expect(
      service.generateConversationResponse({ turns: [{ role: 'user', content: 'hi' }], model: 'gemini-flash' })
    ).rejects.toMatchObject({ code: 'INVALID_MODEL' });
  });

  it('rejects an empty conversation', async () => {
    const service = createGeminiService({ GEMINI_API_KEY: 'unused-in-this-test' } as NodeJS.ProcessEnv);
    await expect(service.generateConversationResponse({ turns: [] })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });
});

describe('persona prompts claim no capability the system lacks', () => {
  /** Instructions that would have the model narrate a completed action. */
  const FORBIDDEN_INSTRUCTIONS = [
    'schedule appointments',
    'schedule the appointment',
    'book the appointment',
    'authorize the payment',
    'freeze the card',
    'dispatch the shipment',
    'confirm security actions',
    'triage urgency',
  ];

  for (const flow of PRESET_FLOWS) {
    it(`"${flow.id}" instructs no unsupported action`, () => {
      const prompt = flow.systemPrompt.toLowerCase();
      for (const forbidden of FORBIDDEN_INSTRUCTIONS) {
        expect(prompt).not.toContain(forbidden);
      }
    });

    it(`"${flow.id}" states its limits and bans invented specifics`, () => {
      expect(flow.systemPrompt).toContain('no access to any account');
      expect(flow.systemPrompt).toContain('Never invent names, reference numbers');
    });

    it(`"${flow.id}" greets without asserting a retrieved fact`, () => {
      // The old greetings opened with invented telemetry, e.g. a specific
      // transaction the system had never seen.
      expect(flow.greeting).not.toMatch(/\$\d/);
      expect(flow.greeting).not.toMatch(/I detected|I have reserved|is closed near/i);
    });
  }
});
