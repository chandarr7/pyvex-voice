/**
 * The authoritative list of LLM models this deployment will call.
 *
 * Model ids are drawn from those the installed `@google/genai` SDK recognises,
 * restricted to text-conversation models: image, live-audio and robotics
 * variants are excluded because no endpoint here can drive them. A client may
 * name a model but never define one — an id absent from this set is rejected
 * before it can reach the provider SDK.
 */

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Overridable so a deployment can narrow the set (or track a model the pinned
 * SDK predates) without a code change. Unset means the built-in list applies.
 */
const ENV_OVERRIDE = 'PYVEX_GEMINI_MODELS';

const BUILT_IN_MODELS: ModelInfo[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Balanced latency and reasoning. The default for conversation.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Lowest latency; best for short conversational turns.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro (preview)',
    description: 'Deeper multi-step reasoning at higher latency.',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Previous-generation flash model, broadly available.',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Previous-generation reasoning model.',
  },
];

function parseOverride(raw: string): ModelInfo[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => {
      const known = BUILT_IN_MODELS.find((m) => m.id === id);
      return known ?? { id, name: id, description: 'Configured for this deployment.' };
    });
}

export function supportedModels(env: NodeJS.ProcessEnv = process.env): ModelInfo[] {
  const override = env[ENV_OVERRIDE];
  const models = override ? parseOverride(override) : BUILT_IN_MODELS;
  return models.length > 0 ? models : BUILT_IN_MODELS;
}

export function defaultModel(env: NodeJS.ProcessEnv = process.env): string {
  return supportedModels(env)[0].id;
}

export function isSupportedModel(id: unknown, env: NodeJS.ProcessEnv = process.env): id is string {
  return typeof id === 'string' && supportedModels(env).some((m) => m.id === id);
}
