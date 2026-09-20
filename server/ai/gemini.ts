import { GoogleGenAI } from '@google/genai';

export const SUPPORTED_GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];
export const DEFAULT_GEMINI_MODEL: SupportedGeminiModel = 'gemini-3.1-flash-lite';

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiServiceError(
        'LLM_AUTH_ERROR',
        'Gemini API key is not configured on the server. Set GEMINI_API_KEY in server environment.',
        503
      );
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'pyvex-voice/1.0.0',
        },
      },
    });
  }
  return geminiClient;
}

export class GeminiServiceError extends Error {
  constructor(
    public readonly code:
      | 'LLM_AUTH_ERROR'
      | 'LLM_RATE_LIMITED'
      | 'LLM_TIMEOUT'
      | 'INVALID_MODEL'
      | 'INVALID_REQUEST'
      | 'LLM_ERROR',
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'model';
  content?: string;
  text?: string;
}

export interface GenerateConversationParams {
  messages: ConversationTurn[];
  systemInstruction?: string;
  model?: string;
}

export interface GenerateConversationResult {
  text: string;
  model: SupportedGeminiModel;
  latencyMs: number;
}

export function validateModel(modelInput?: string): SupportedGeminiModel {
  if (!modelInput) return DEFAULT_GEMINI_MODEL;
  if ((SUPPORTED_GEMINI_MODELS as readonly string[]).includes(modelInput)) {
    return modelInput as SupportedGeminiModel;
  }
  throw new GeminiServiceError(
    'INVALID_MODEL',
    `Unsupported model "${modelInput}". Supported models: ${SUPPORTED_GEMINI_MODELS.join(', ')}`,
    400
  );
}

export function normalizeGeminiError(err: any): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;

  const msg = err?.message || String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('api_key') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403')) {
    return new GeminiServiceError('LLM_AUTH_ERROR', 'Gemini API authentication failed or key is invalid.', 401, msg);
  }
  if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) {
    return new GeminiServiceError('LLM_RATE_LIMITED', 'Gemini API rate limit exceeded. Please try again later.', 429, msg);
  }
  if (lower.includes('deadline') || lower.includes('timeout') || lower.includes('timed out')) {
    return new GeminiServiceError('LLM_TIMEOUT', 'Gemini API request timed out.', 504, msg);
  }
  if (lower.includes('invalid') || lower.includes('bad request') || lower.includes('400')) {
    return new GeminiServiceError('INVALID_REQUEST', `Gemini request rejected: ${msg}`, 400, msg);
  }

  return new GeminiServiceError('LLM_ERROR', `Gemini provider failure: ${msg}`, 502, msg);
}

export async function generateConversationResponse({
  messages,
  systemInstruction,
  model,
}: GenerateConversationParams): Promise<GenerateConversationResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new GeminiServiceError('INVALID_REQUEST', 'Messages must be a non-empty array of conversation turns.', 400);
  }

  const selectedModel = validateModel(model);
  const ai = getGeminiClient();
  const startTime = Date.now();

  const contents = messages.map((m) => {
    const isModel = m.role === 'model' || m.role === 'assistant';
    const textContent = (m.text || m.content || '').trim();
    return {
      role: isModel ? 'model' : 'user',
      parts: [{ text: textContent }],
    };
  });

  const config: Record<string, any> = {};
  if (systemInstruction && systemInstruction.trim().length > 0) {
    config.systemInstruction = systemInstruction.trim();
  }

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    const replyText = (response.text || '').trim();
    if (!replyText) {
      throw new GeminiServiceError('LLM_ERROR', 'Gemini returned an empty response.', 502);
    }

    return {
      text: replyText,
      model: selectedModel,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    if (selectedModel !== 'gemini-3.1-flash-lite') {
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: Object.keys(config).length > 0 ? config : undefined,
        });
        const replyText = (fallbackResponse.text || '').trim();
        if (replyText) {
          return {
            text: replyText,
            model: 'gemini-3.1-flash-lite',
            latencyMs: Date.now() - startTime,
          };
        }
      } catch {
        // Continue to throw normalized original error
      }
    }
    throw normalizeGeminiError(err);
  }
}
