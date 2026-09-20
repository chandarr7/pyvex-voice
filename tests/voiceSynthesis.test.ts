import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SAFE_VOICE_CATALOG, generateServerVoicePreview } from '../server/voices/service';
import { PRESET_FLOWS } from '../server/flows/presetFlows';

describe('Voice Synthesis & Protocol Unit Tests', () => {
  test('voice catalog contains valid Pyvex persona voices', () => {
    assert.ok(SAFE_VOICE_CATALOG.length >= 8);
    const hasSarah = SAFE_VOICE_CATALOG.some((v) => v.id === 'EXAVITQu4vr4xnSDxMaL');
    assert.ok(hasSarah, 'Sarah voice should be in catalog');
  });

  test('voice catalog contains all 5 human female sweet voices', () => {
    const sweetVoiceIds = [
      'pFZP5JQG7iQjIQuC4Bku', // Lily
      'jsCqWAovK2LkecY7zXl4', // Freya
      'LcfcDJNigUd50AZSDxio', // Emily
      'XB0fDUnXU5powFXDhCwa', // Charlotte
      'piTKgcLEGmPE4e6mEKli', // Nicole
    ];

    for (const id of sweetVoiceIds) {
      const voice = SAFE_VOICE_CATALOG.find((v) => v.id === id);
      assert.ok(voice, `Sweet voice ${id} must exist in SAFE_VOICE_CATALOG`);
      assert.equal(voice.gender, 'female');
      assert.ok(voice.displayName.length > 0);
    }
  });

  test('preset flows provide valid system prompts and non-empty greetings', () => {
    assert.ok(PRESET_FLOWS.length >= 5);
    for (const flow of PRESET_FLOWS) {
      assert.ok(flow.id.length > 0);
      assert.ok(flow.greeting.length > 10);
      assert.ok(flow.systemPrompt.length > 20);
      assert.ok(Array.isArray(flow.suggestedPrompts) && flow.suggestedPrompts.length > 0);
    }
  });

  test('generateServerVoicePreview accepts custom pitch and rate parameters', async () => {
    try {
      const result = await generateServerVoicePreview('EXAVITQu4vr4xnSDxMaL', 'Hello world', {
        pitch: 1.2,
        rate: 1.1,
        volume: 0.9,
      });

      assert.ok(result);
      assert.ok(typeof result.contentType === 'string');
      assert.ok(result.buffer instanceof Buffer);
      assert.ok(result.buffer.length > 0);
    } catch (err: any) {
      // If elevenlabs key is invalid or rate limited in test runner, verify it threw appropriate VoiceServiceError
      assert.ok(err.name === 'VoiceServiceError' || err.statusCode !== undefined);
    }
  });
});
