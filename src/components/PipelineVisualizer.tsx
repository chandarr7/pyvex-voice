import React from 'react';
import { ArrowRight, Cpu, Headphones, Layers, Mic, Volume2, Zap } from 'lucide-react';
import { PipelineConfig, PipelineMetrics } from '../types';

interface PipelineVisualizerProps {
  config: PipelineConfig;
  metrics: PipelineMetrics | null;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
}

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  config,
  metrics,
  isListening,
  isSpeaking,
  isProcessing,
}) => {
  const stages = [
    {
      name: 'Audio In',
      desc: config.transport === 'smallwebrtc' ? 'SmallWebRTC' : config.transport === 'daily' ? 'Daily WebRTC' : 'WebSocket',
      icon: Mic,
      active: isListening,
      activeColor: 'border-cyan-500/70 bg-cyan-500/10 text-cyan-400',
      badge: isListening ? 'Streaming' : 'Ready',
    },
    {
      name: 'VAD Analyzer',
      desc: config.vad === 'silero' ? 'Silero VAD v5' : 'SmartTurn v3',
      icon: Headphones,
      active: isListening,
      activeColor: 'border-blue-500/70 bg-blue-500/10 text-blue-400',
      badge: metrics ? `${metrics.vadDurationMs}ms` : '30ms',
    },
    {
      name: 'Speech-to-Text',
      desc: config.stt === 'deepgram' ? 'Deepgram Nova-2' : config.stt === 'whisper' ? 'OpenAI Whisper' : 'Cartesia Listen',
      icon: Layers,
      active: isProcessing,
      activeColor: 'border-amber-500/70 bg-amber-500/10 text-amber-400',
      badge: metrics ? `${metrics.sttDurationMs}ms` : '110ms',
    },
    {
      name: 'LLM Worker',
      desc: config.llm === 'gemini-flash' ? 'Gemini 2.5 Flash' : config.llm === 'gpt-4o-mini' ? 'GPT-4o Mini' : 'Claude 3.5 Haiku',
      icon: Cpu,
      active: isProcessing,
      activeColor: 'border-emerald-500/70 bg-emerald-500/10 text-emerald-400',
      badge: metrics ? `${metrics.llmTtftMs}ms` : '190ms',
    },
    {
      name: 'Text-to-Speech',
      desc: config.tts === 'cartesia-sonic' ? 'Cartesia Sonic' : config.tts === 'elevenlabs' ? 'ElevenLabs v2.5' : 'OpenAI Alloy',
      icon: Volume2,
      active: isSpeaking,
      activeColor: 'border-purple-500/70 bg-purple-500/10 text-purple-400',
      badge: metrics ? `${metrics.ttsDurationMs}ms` : '95ms',
    },
  ];

  return (
    <section className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Frame-Based Pipeline Flow
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time frame processors linked sequentially in memory
          </p>
        </div>

        {metrics && (
          <div className="flex items-center gap-2 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300">
            <span className="text-zinc-500">Total Roundtrip:</span>
            <span className="text-cyan-400 font-semibold">{metrics.totalLatencyMs}ms</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.name}
              className={`relative flex flex-col p-3 rounded-xl border transition-all duration-300 ${
                stage.active
                  ? stage.activeColor + ' shadow-md shadow-cyan-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg ${stage.active ? 'bg-zinc-950/50' : 'bg-zinc-800/50'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-950/60 border border-zinc-800 text-zinc-300">
                  {stage.badge}
                </span>
              </div>
              <h3 className="text-xs font-semibold text-zinc-200">{stage.name}</h3>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{stage.desc}</p>

              {idx < stages.length - 1 && (
                <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
