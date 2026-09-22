export interface FrameEvent {
  id: string;
  type: string;
  source: 'transport' | 'vad' | 'stt' | 'llm' | 'tts' | 'worker';
  timestamp: string;
  details: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isInterrupted?: boolean;
  latencyMs?: number;
  flow?: string;
}

export interface PresetFlow {
  id: string;
  name: string;
  description: string;
  greeting: string;
  systemPrompt: string;
  suggestedPrompts: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  type?: string;
  latency?: string;
  streaming?: boolean;
  voice?: string;
  contextWindow?: string;
  local?: boolean;
}

export interface ServicesCatalog {
  transports: ServiceItem[];
  stt: ServiceItem[];
  llm: ServiceItem[];
  tts: ServiceItem[];
  vad: ServiceItem[];
}

export interface PipelineConfig {
  transport: string;
  stt: string;
  llm: string;
  tts: string;
  vad: string;
  flow: string;
}

export interface PipelineMetrics {
  vadDurationMs: number;
  sttDurationMs: number;
  llmTtftMs: number;
  ttsDurationMs: number;
  totalLatencyMs: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'engineer' | 'operator' | 'admin';
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonaVoiceTuning {
  pitch: number;
  speed: number;
  accent: string;
  voiceId: string;
  gender: 'female' | 'male';
  stability?: number; // Tone stability: 0.0 to 1.0 (default: 0.75)
}

export interface VoiceSettingsDoc {
  id?: string;
  userId: string;
  personaId: string;
  voiceId: string;
  speakingRate: number; // 0.25 to 3.0 (default: 1.0)
  pitch: number;        // -10.0 to 10.0 (default: 1.0)
  stability: number;    // 0.0 to 1.0 (default: 0.75)
  gender?: 'female' | 'male';
  accent?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedVoiceAgent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  transport?: string;
  vad?: string;
  stt?: string;
  llm: string;
  tts: string;
  flow?: string;
  pitch?: number;
  speed?: number;
  accent?: string;
  voiceId?: string;
  gender?: 'female' | 'male';
  latencyTargetMs?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedCallSession {
  id: string;
  userId: string;
  agentId?: string;
  title: string;
  durationSec?: number;
  turnCount?: number;
  avgLatencyMs?: number;
  status: 'active' | 'completed' | 'cancelled';
  messages?: Array<{
    id: string;
    role: string;
    text: string;
    timestamp: number;
    latencyMs?: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export type CloudSyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

export type FluidMeshStyle = 'pulse' | 'flow' | 'geometric';

