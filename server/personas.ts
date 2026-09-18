/**
 * Conversation personas, loaded from `shared/personas.json`.
 *
 * The voice worker reads the same file. Two hand-maintained copies of these
 * prompts would drift, and drift here means one runtime claiming a capability
 * the other refuses — the exact failure the guardrails exist to prevent.
 *
 * Each persona is bounded by what this deployment can do: hold a conversation
 * and take down what the caller says. Nothing here can reach a booking,
 * payment, order or records system, so no persona is permitted to report that
 * such an action happened. A persona gains a capability when the tool behind
 * it lands, not before.
 */
import personaData from '../shared/personas.json' with { type: 'json' };

export interface PresetFlow {
  id: string;
  name: string;
  description: string;
  greeting: string;
  systemPrompt: string;
  suggestedPrompts: string[];
}

interface PersonaFile {
  guardrails: string[];
  flows: Array<{
    id: string;
    name: string;
    description: string;
    greeting: string;
    persona: string;
    suggestedPrompts: string[];
  }>;
}

const data = personaData as PersonaFile;

/**
 * Appended to every persona. Repeated per persona rather than stated once,
 * because this is the instruction whose violation causes real-world harm.
 */
const GUARDRAILS = data.guardrails.join(' ');

export const PRESET_FLOWS: PresetFlow[] = data.flows.map((flow) => ({
  id: flow.id,
  name: flow.name,
  description: flow.description,
  greeting: flow.greeting,
  systemPrompt: `${flow.persona} ${GUARDRAILS}`,
  suggestedPrompts: flow.suggestedPrompts,
}));

export function findFlow(id: unknown): PresetFlow {
  const flow = typeof id === 'string' ? PRESET_FLOWS.find((f) => f.id === id) : undefined;
  return flow ?? PRESET_FLOWS[0];
}

export function isKnownFlow(id: unknown): id is string {
  return typeof id === 'string' && PRESET_FLOWS.some((f) => f.id === id);
}
