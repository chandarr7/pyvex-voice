import React from 'react';
import { ArrowRight, Activity, Radio, Cpu, Volume2, Mic } from 'lucide-react';
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
      step: '01',
      name: 'Ingress',
      provider: config.transport === 'smallwebrtc' ? 'SmallWebRTC' : config.transport === 'daily' ? 'Daily WebRTC' : 'WebSocket',
      spec: '24kHz • PCM',
      active: isListening,
      indicator: 'Mic In',
    },
    {
      step: '02',
      name: 'VAD Gate',
      provider: config.vad === 'silero' ? 'Silero v5' : 'SmartTurn v3',
      spec: metrics ? `${metrics.vadDurationMs}ms` : '30ms',
      active: isListening,
      indicator: 'Voice Gate',
    },
    {
      step: '03',
      name: 'STT Decode',
      provider: config.stt === 'deepgram' ? 'Deepgram Nova-2' : config.stt === 'whisper' ? 'Whisper-1' : 'Cartesia STT',
      spec: metrics ? `${metrics.sttDurationMs}ms` : '110ms',
      active: isProcessing,
      indicator: 'Transcribe',
    },
    {
      step: '04',
      name: 'LLM Reason',
      provider: config.llm === 'gemini-flash' ? 'Gemini 2.5 Flash' : config.llm === 'gpt-4o-mini' ? 'GPT-4o Mini' : 'Claude 3.5',
      spec: metrics ? `${metrics.llmTtftMs}ms` : '190ms',
      active: isProcessing,
      indicator: 'Inference',
    },
    {
      step: '05',
      name: 'TTS Egress',
      provider: config.tts?.includes('flash')
        ? 'ElevenLabs Flash v2.5'
        : config.tts?.includes('multilingual')
        ? 'ElevenLabs Multilingual v2'
        : 'ElevenLabs Turbo v2.5',
      spec: metrics ? `${metrics.ttsDurationMs}ms` : '95ms',
      active: isSpeaking,
      indicator: 'Playback',
    },
  ];

  return (
    <section className="bg-[#121316]/70 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div>
          <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-white/50 block">
            Acoustic Signal Processing Chain
          </span>
          <h2 className="text-base font-medium text-white/90 tracking-tight mt-0.5">
            Sequential Frame Processor Architecture
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
            <span className="text-white/40 uppercase text-[11px]">Roundtrip</span>
            <span className="text-white font-semibold">{metrics ? `${metrics.totalLatencyMs}ms` : '385ms'}</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
            <span className="text-white/40 uppercase text-[11px]">Sample Rate</span>
            <span className="text-white font-semibold">24.0 kHz</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5">
        {stages.map((stage, idx) => (
          <div
            key={stage.name}
            className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-300 ${
              stage.active
                ? 'border-white/30 bg-white/[0.06] text-white shadow-[0_0_20px_rgba(255,255,255,0.04)]'
                : 'border-white/[0.05] bg-white/[0.015] text-white/60 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono tracking-widest text-white/40">
                {stage.step}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  stage.active ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' : 'bg-white/15'
                }`}
              />
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-semibold tracking-wide text-white uppercase">
                {stage.name}
              </h3>
              <p className="text-[11px] text-white/50 truncate font-mono">
                {stage.provider}
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-white/40">
              <span>{stage.indicator}</span>
              <span className="text-white/75">{stage.spec}</span>
            </div>

            {idx < stages.length - 1 && (
              <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-[#0b0c0e] border border-white/10 items-center justify-center pointer-events-none">
                <ArrowRight className="w-2.5 h-2.5 text-white/30" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
