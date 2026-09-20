import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_GEMINI_MODELS, GeminiServiceError } from '../server/ai/gemini';

describe('Gemini Service Module Tests', () => {
  test('supported models includes production Gemini model lineup', () => {
    assert.ok(SUPPORTED_GEMINI_MODELS.includes('gemini-3.1-flash-lite'));
    assert.ok(SUPPORTED_GEMINI_MODELS.includes('gemini-flash-latest'));
    assert.ok(SUPPORTED_GEMINI_MODELS.includes('gemini-3.5-flash'));
    assert.ok(SUPPORTED_GEMINI_MODELS.includes('gemini-3.1-pro-preview'));
  });

  test('GeminiServiceError constructs with proper status code and type code', () => {
    const error = new GeminiServiceError(
      'LLM_AUTH_ERROR',
      'API key is required',
      503
    );

    assert.equal(error.code, 'LLM_AUTH_ERROR');
    assert.equal(error.statusCode, 503);
    assert.equal(error.message, 'API key is required');
    assert.equal(error.name, 'GeminiServiceError');
  });
});
