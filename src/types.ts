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
