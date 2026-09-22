export interface SafeVoiceProfile {
  id: string;
  provider: 'elevenlabs';
  displayName: string;
  gender: 'female' | 'male';
  accent: string;
  description: string;
  sampleAudioAvailable: boolean;
}

// Verified premade ElevenLabs voices available on all tiers
export const SAFE_VOICE_CATALOG: SafeVoiceProfile[] = [
  {
    id: 'jsCqWAovK2LkecY7zXl4',
    provider: 'elevenlabs',
    displayName: 'Freya (Sweet Radiant)',
    gender: 'female',
    accent: 'Nordic / American (Sweet, Bright, Radiant, Charming)',
    description: 'Delightful, radiant, and charmingly sweet cadence with a warm acoustic smile.',
    sampleAudioAvailable: true,
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    provider: 'elevenlabs',
    displayName: 'Sarah',
    gender: 'female',
    accent: 'American (Mature, Reassuring, Executive)',
    description: 'Crisp, consultative cadence ideal for enterprise SDR, clinical intake, and advisory.',
    sampleAudioAvailable: true,
  },
  {
    id: 'Xb7hH8MSUJpSbSDYk0k2',
    provider: 'elevenlabs',
    displayName: 'Alice',
    gender: 'female',
    accent: 'American (Clear, Engaging, Educational)',
    description: 'Articulate and clear, optimal for patient instructions, customer support, and onboarding.',
    sampleAudioAvailable: true,
  },
  {
    id: 'hpp4J3VqNfWAUOO0d1Us',
    provider: 'elevenlabs',
    displayName: 'Bella',
    gender: 'female',
    accent: 'American (Bright, Friendly, Concierge)',
    description: 'Dynamic, warm, and personable for white-glove customer concierge service.',
    sampleAudioAvailable: true,
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    provider: 'elevenlabs',
    displayName: 'Jessica',
    gender: 'female',
    accent: 'American (Playful, Warm, Approachable)',
    description: 'Natural, lively tone suited for interactive mobile assistance.',
    sampleAudioAvailable: true,
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    provider: 'elevenlabs',
    displayName: 'Lily (Sweet Velvet)',
    gender: 'female',
    accent: 'British / American (Sweet, Warm, Velvet, Soothing)',
    description: 'Warm, velvet, soothing, and sweet gentle cadence with comforting acoustic warmth.',
    sampleAudioAvailable: true,
  },
  {
    id: 'LcfcDJNigUd50AZSDxio',
    provider: 'elevenlabs',
    displayName: 'Emily (Sweet Gentle)',
    gender: 'female',
    accent: 'American (Sweet, Gentle, Calm, Tender)',
    description: 'Tender, sweet, soft-spoken conversational tone with calm, empathetic reassurance.',
    sampleAudioAvailable: true,
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    provider: 'elevenlabs',
    displayName: 'Charlotte (Sweet Melodic)',
    gender: 'female',
    accent: 'English (Sweet, Delicate, Melodic, Silky)',
    description: 'Delicate, sweet, and melodic cadence with silky pronunciation for luxury hospitality.',
    sampleAudioAvailable: true,
  },
  {
    id: 'piTKgcLEGmPE4e6mEKli',
    provider: 'elevenlabs',
    displayName: 'Nicole (Sweet Whisper-Soft)',
    gender: 'female',
    accent: 'American (Sweet, Whisper-Soft, Velvet, Peaceful)',
    description: 'Velvety, intimate, and peacefully sweet whispery warmth designed for comforting interactions.',
    sampleAudioAvailable: true,
  },
  {
    id: 'JBFqnCBsd6RMkjVDRZzb',
    provider: 'elevenlabs',
    displayName: 'George',
    gender: 'male',
    accent: 'British / American (Warm, Captivating, Reassuring)',
    description: 'Authoritative, calm, and reassuring physician/advisor cadence.',
    sampleAudioAvailable: true,
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    provider: 'elevenlabs',
    displayName: 'Charlie',
    gender: 'male',
    accent: 'Australian / American (Deep, Confident, Energetic)',
    description: 'Poised and persuasive for enterprise sales, lead qualification, and logistics dispatch.',
    sampleAudioAvailable: true,
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    provider: 'elevenlabs',
    displayName: 'Liam',
    gender: 'male',
    accent: 'American (Energetic, Articulate)',
    description: 'Upbeat and clear for real-time customer onboarding.',
    sampleAudioAvailable: true,
  },
  {
    id: 'cjVigY5qzO86Huf0OWal',
    provider: 'elevenlabs',
    displayName: 'Eric',
    gender: 'male',
    accent: 'American (Smooth, Trustworthy)',
    description: 'Grounded and measured for wealth management and security verification.',
    sampleAudioAvailable: true,
  },
  {
    id: 'CwhRBWXzGAHq8TQ4Fs17',
    provider: 'elevenlabs',
    displayName: 'Roger',
    gender: 'male',
    accent: 'American (Resonant, Laid-Back)',
    description: 'Calm and steady for fleet dispatch and telemetry updates.',
    sampleAudioAvailable: true,
  },
];

// Alias mapping from legacy/library voice IDs to verified premade ElevenLabs IDs
const VOICE_ALIASES: Record<string, string> = {
  '21m00Tcm4TlvDq8ikWAM': 'jsCqWAovK2LkecY7zXl4', // Rachel -> Freya
  'ErXwobaYiN019PkySvjV': 'IKne3meq5aSn9XLyUdCD', // Antoni -> Charlie
  'pNInz6obpgDQGcFmaJgB': 'JBFqnCBsd6RMkjVDRZzb', // Adam -> George
};

export const DEFAULT_ELEVENLABS_VOICE_ID = 'jsCqWAovK2LkecY7zXl4'; // Freya (Sweet Radiant)

export interface VoiceSynthesisOptions {
  pitch?: number; // -10.0 to +10.0 scale or 0.5 - 2.0 ratio
  rate?: number; // 0.5x to 2.0x
  volume?: number; // 0.0 to 1.0
  voiceModel?: string; // e.g. eleven_turbo_v2_5
  stability?: number;
  similarity_boost?: number;
  style?: number;
}

export async function generateServerVoicePreview(
  voiceId: string,
  sampleText: string = 'Hello! This is a real-time vocal preview from the Pyvex Voice platform.',
  options: VoiceSynthesisOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new VoiceServiceError(
      'VOICE_PROVIDER_UNCONFIGURED',
      'ELEVENLABS_API_KEY is not configured on the server. Set ELEVENLABS_API_KEY in Settings > Secrets.',
      503
    );
  }

  // Resolve alias if legacy voice ID passed
  let resolvedVoiceId = VOICE_ALIASES[voiceId] || voiceId;

  // Clean and prepare spoken dialogue for fluid, real-time ElevenLabs voice stream
  let cleanText = (sampleText || '');
  // Strip turn counts e.g. "(1 turns)", "(2 turns)", "1 turns", "turn 1:", "[1 turns]"
  cleanText = cleanText.replace(/\(?\s*\d+\s+turns?\s*\)?/gi, '');
  cleanText = cleanText.replace(/\[\s*\d+\s+turns?\s*\]/gi, '');
  cleanText = cleanText.replace(/\bturns?\s*#?\d+:?/gi, '');
  cleanText = cleanText.replace(/\(\s*turn\s*#?\d+\s*\)/gi, '');
  // Strip meta-tags and system prompt echoes
  cleanText = cleanText.replace(/<[^>]+>/g, ' ');
  cleanText = cleanText.replace(/\[(?:system|instruction|meta|prompt|role|thought|note)[^\]]*\]/gi, '');
  cleanText = cleanText.replace(/\((?:system|instruction|meta|prompt|role|thought|note)[^)]*\)/gi, '');
  cleanText = cleanText.replace(/^(?:system|instruction|assistant|bot|ai|agent|model):\s*/i, '');
  cleanText = cleanText.replace(/\bvoice & interaction rules:[^.\n]*[.\n]?/gi, '');
  // Strip stage directions or bracketed actions
  cleanText = cleanText.replace(/\*[^*]+\*/g, ' ');
  cleanText = cleanText.replace(/\[(?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^\]]*\]/gi, '');
  cleanText = cleanText.replace(/\((?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^)]*\)/gi, '');
  // Clean markdown tokens
  cleanText = cleanText.replace(/[*_#`~>]/g, '');
  cleanText = cleanText.replace(/\s+/g, ' ').trim().slice(0, 1500);

  if (!cleanText) {
    throw new VoiceServiceError('INVALID_REQUEST', 'Spoken text cannot be empty.', 400);
  }

  const modelId = options.voiceModel || 'eleven_turbo_v2_5';
  const stability = typeof options.stability === 'number' ? Math.max(0, Math.min(1, options.stability)) : 0.5;
  const similarityBoost = typeof options.similarity_boost === 'number' ? Math.max(0, Math.min(1, options.similarity_boost)) : 0.8;
  const style = typeof options.style === 'number' ? Math.max(0, Math.min(1, options.style)) : 0.0;

  async function callElevenLabs(targetId: string): Promise<Response> {
    return fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${targetId}?optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey!,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
          },
        }),
      }
    );
  }

  let response = await callElevenLabs(resolvedVoiceId);

  // If ElevenLabs reports paid plan required for the voice, fall back gracefully
  if (response.status === 402) {
    console.warn(`[ElevenLabs] Voice ${resolvedVoiceId} requires paid plan. Attempting free premade fallback.`);
    const fallbackIds = ['EXAVITQu4vr4xnSDxMaL', 'Xb7hH8MSUJpSbSDYk0k2'];
    for (const fallbackId of fallbackIds) {
      if (fallbackId !== resolvedVoiceId) {
        response = await callElevenLabs(fallbackId);
        if (response.ok) break;
      }
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new VoiceServiceError('VOICE_AUTH_ERROR', 'ElevenLabs API key is invalid or unauthorized.', 401);
    }
    if (response.status === 429) {
      throw new VoiceServiceError('VOICE_RATE_LIMITED', 'ElevenLabs rate limit exceeded.', 429);
    }
    throw new VoiceServiceError('VOICE_PROVIDER_ERROR', `ElevenLabs API error: ${response.status} - ${errorText}`, 502);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type') || 'audio/mpeg',
  };
}

export class VoiceServiceError extends Error {
  constructor(
    public readonly code:
      | 'VOICE_PROVIDER_UNCONFIGURED'
      | 'INVALID_VOICE_ID'
      | 'INVALID_REQUEST'
      | 'VOICE_AUTH_ERROR'
      | 'VOICE_RATE_LIMITED'
      | 'VOICE_PROVIDER_ERROR',
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'VoiceServiceError';
  }
}
