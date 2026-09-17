/**
 * The chat roles feed a live model as system instructions. With no tools
 * behind them, a role told to "verify the charge" or "coordinate the viewing"
 * will narrate a confirmation it cannot have earned.
 *
 * These assertions bound what the roles are allowed to ask for.
 */
import { describe, expect, it } from 'vitest';

import { GEMINI_CHAT_ROLES } from '../../src/data/geminiRoles';
import { PYVEX_PERSONAS } from '../../src/data/personas';

/** Instructions that would have the model report a completed action. */
const FORBIDDEN_INSTRUCTIONS = [
  'authorize security lockdowns',
  'verify suspicious account activity',
  'verify warehouse dock reservations',
  'monitor telematics diagnostics',
  'coordinate private sunset viewings',
  'organize express courier handoffs',
  'resolve high-value order modifications',
  'schedule your specialist',
  'assess portfolio volatility',
  'prepare structured intake summaries',
];

describe('chat role instructions', () => {
  for (const chatRole of GEMINI_CHAT_ROLES) {
    it(`"${chatRole.id}" asks for no unsupported action`, () => {
      const instruction = chatRole.systemInstruction.toLowerCase();
      for (const forbidden of FORBIDDEN_INSTRUCTIONS) {
        expect(instruction).not.toContain(forbidden);
      }
    });

    it(`"${chatRole.id}" states its limits and bans invented specifics`, () => {
      expect(chatRole.systemInstruction).toContain('no access to any account');
      expect(chatRole.systemInstruction).toContain('Never invent names, reference numbers');
      expect(chatRole.systemInstruction).toContain('Never state or imply that you have looked something up');
    });
  }

  it('uses only models the server accepts', async () => {
    const { supportedModels } = await import('../../server/models.js');
    const allowed = new Set(supportedModels().map((m) => m.id));
    for (const chatRole of GEMINI_CHAT_ROLES) {
      expect(allowed.has(chatRole.recommendedModel)).toBe(true);
    }
  });
});

describe('persona sample lines', () => {
  /**
   * Sample lines are spoken aloud in the product's own voice, so a line that
   * reports a lookup is the same defect as an invented API response.
   */
  const ASSERTED_FACT = [
    /I detected an unusual/i,
    /your portfolio gained/i,
    /is closed near the pass/i,
    /has been pre-cleared/i,
    /was dispatched this morning/i,
    /\$\d/,
  ];

  for (const persona of PYVEX_PERSONAS) {
    for (const gender of ['male', 'female'] as const) {
      const voice = persona.voices[gender];
      it(`${persona.id}/${gender} states no retrieved fact`, () => {
        for (const pattern of ASSERTED_FACT) {
          expect(voice.sampleScript).not.toMatch(pattern);
        }
      });
    }
  }
});
