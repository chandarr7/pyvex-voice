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

export type GeminiModelId =
  | 'gemini-3.5-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.8-flash';

export interface GeminiChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  latencyMs?: number;
  model?: string;
  error?: boolean;
}

export interface GeminiChatRole {
  id: string;
  title: string;
  category: string;
  iconName: string;
  tagline: string;
  systemInstruction: string;
  suggestedPrompts: string[];
  recommendedModel: GeminiModelId;
  colorAccent: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'engineer' | 'operator' | 'admin';
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

