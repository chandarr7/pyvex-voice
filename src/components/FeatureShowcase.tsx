import React from 'react';
import { Zap, PhoneCall, Code2, Cpu, ArrowRight } from 'lucide-react';

interface FeatureShowcaseProps {
  onOpenStudio: () => void;
}

export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({ onOpenStudio }) => {
  return (
    <section id="platform" className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 border-t border-[#292B3A]">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="space-y-3 max-w-2xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-[0.2em] text-[#F4F2F8] w-fit"
            style={{
              background: '#12141A',
              border: '1px solid #34365C',
            }}
          >
            <Cpu className="w-3.5 h-3.5 text-[#845CFF]" />
            <span>Acoustic Infrastructure</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-sans text-[#F4F2F8] tracking-tight">
            Engineered for Sub-300ms Conversational Latency
          </h2>
          <p className="text-base text-[#A4A3B2] leading-relaxed font-sans">
            Traditional AI voice bots cascade HTTP requests through disconnected endpoints. Pyvex STUDIO streams raw audio frames through in-memory pipeline workers.
          </p>
        </div>

        <button
          onClick={onOpenStudio}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#845CFF] hover:text-[#9655FF] pb-2 border-b border-[#7047FF]/40 hover:border-[#845CFF] transition-all w-fit font-semibold"
        >
          <span>Explore Architecture Specs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Latency Comparison Matrix */}
      <div
        className="p-7 sm:p-9 rounded-3xl border shadow-2xl mb-16 overflow-hidden backdrop-blur-xl"
        style={{
          background: '#12141A',
          border: '1px solid #292B3A',
        }}
      >
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#292B3A]">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#A4A3B2]">
            Global Turn-Taking Latency Benchmark (End-to-End)
          </span>
          <span className="text-xs font-mono font-semibold text-[#20E99A] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#20E99A] shadow-[0_0_8px_#20E99A] animate-pulse" />
            <span>4.8x Faster Turn-Around</span>
          </span>
        </div>

        <div className="space-y-6 font-mono text-xs">
          {/* Pyvex STUDIO bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[#F4F2F8]">
              <span className="font-semibold tracking-wider uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#845CFF] shadow-[0_0_8px_#845CFF]" />
                Pyvex STUDIO (Frame-Based WebRTC & SIP Pipeline)
              </span>
              <span className="text-[#20E99A] font-bold text-sm">240ms</span>
            </div>
            <div className="w-full h-3.5 rounded-full bg-[#08090B] overflow-hidden p-0.5 border border-[#34365C]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7047FF] via-[#845CFF] to-[#24D8ED] w-[20%] shadow-[0_0_12px_rgba(112,71,255,0.6)]" />
            </div>
          </div>

          {/* Standard Cascade Bot bar */}
          <div className="space-y-2 opacity-60">
            <div className="flex items-center justify-between text-[#A4A3B2]">
              <span>Standard Cascading API Bot (Whisper + GPT-4o + REST TTS)</span>
              <span>1,280ms</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#08090B] overflow-hidden border border-[#292B3A]">
              <div className="h-full rounded-full bg-[#34365C] w-[65%]" />
            </div>
          </div>

          {/* Legacy IVR bar */}
          <div className="space-y-2 opacity-40">
            <div className="flex items-center justify-between text-[#666879]">
              <span>Legacy Telephony IVR System</span>
              <span>2,400ms+</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#08090B] overflow-hidden border border-[#292B3A]">
              <div className="h-full rounded-full bg-[#292B3A] w-[95%]" />
            </div>
          </div>
        </div>
      </div>

      {/* Feature Pillar Bento Grid */}
      <div id="architecture" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="p-7 rounded-3xl border space-y-4 hover:border-[#34365C] transition-all"
          style={{
            background: '#12141A',
            border: '1px solid #292B3A',
          }}
        >
          <div className="w-10 h-10 rounded-full border border-[#34365C] bg-[#171820] flex items-center justify-center">
            <PhoneCall className="w-5 h-5 text-[#845CFF]" />
          </div>
          <h3 className="text-lg font-bold font-sans text-[#F4F2F8]">Direct SIP & Telephony Trunking</h3>
          <p className="text-xs text-[#A4A3B2] leading-relaxed font-sans">
            Connect directly to Twilio, Vonage, Telnyx, Plivo, or private PBX with dual-channel μ-law audio and instant DTMF key detection.
          </p>
          <div className="text-[11px] font-mono text-[#666879] pt-2">
            RFC 3261 • G.711 & Opus Codecs
          </div>
        </div>

        <div
          className="p-7 rounded-3xl border space-y-4 hover:border-[#34365C] transition-all"
          style={{
            background: '#12141A',
            border: '1px solid #292B3A',
          }}
        >
          <div className="w-10 h-10 rounded-full border border-[#34365C] bg-[#171820] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#24D8ED]" />
          </div>
          <h3 className="text-lg font-bold font-sans text-[#F4F2F8]">Sub-Second Barge-In & VAD</h3>
          <p className="text-xs text-[#A4A3B2] leading-relaxed font-sans">
            Hardware-accelerated Silero VAD detects natural conversational interruptions within 30ms, flushing downstream audio queues instantaneously.
          </p>
          <div className="text-[11px] font-mono text-[#666879] pt-2">
            InterruptionFrame • Zero Audio Overlap
          </div>
        </div>

        <div
          className="p-7 rounded-3xl border space-y-4 hover:border-[#34365C] transition-all"
          style={{
            background: '#12141A',
            border: '1px solid #292B3A',
          }}
        >
          <div className="w-10 h-10 rounded-full border border-[#34365C] bg-[#171820] flex items-center justify-center">
            <Code2 className="w-5 h-5 text-[#20E99A]" />
          </div>
          <h3 className="text-lg font-bold font-sans text-[#F4F2F8]">Real-Time Function Calling</h3>
          <p className="text-xs text-[#A4A3B2] leading-relaxed font-sans">
            Equip voice agents with external API tools (Stripe, Salesforce, EHR systems, PostgreSQL) with non-blocking async execution.
          </p>
          <div className="text-[11px] font-mono text-[#666879] pt-2">
            JSON Schema Tool Definition • Async RPC
          </div>
        </div>
      </div>
    </section>
  );
};
export default FeatureShowcase;
