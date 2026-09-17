import React from 'react';
import { GeminiChatbot } from './GeminiChatbot';
import { Sparkles, MessageSquare, Zap, ShieldCheck, Cpu } from 'lucide-react';

interface GeminiChatSectionProps {
  initialRole?: string;
}

export const GeminiChatSection: React.FC<GeminiChatSectionProps> = ({
  initialRole = 'clinical_intake',
}) => {
  return (
    <section
      id="gemini-chat"
      className="py-24 px-6 lg:px-12 bg-[#08090B] border-t border-[#292B3A] relative overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#7047FF]/10 via-[#24D8ED]/5 to-transparent blur-[140px] pointer-events-none -z-0" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#845CFF]/30 bg-[#845CFF]/10 text-[#D8B4FE] text-xs font-mono mb-4 shadow-[0_0_20px_rgba(132,92,255,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-[#24D8ED]" />
            <span>Multi-Turn Conversational Intelligence</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F4F2F8] tracking-tight mb-4">
            Gemini Conversational Agents
          </h2>

          <p className="text-sm sm:text-base text-[#A4A3B2] leading-relaxed">
            Experience real-time, multi-turn dialogue powered by Google Gemini. Switch between specialized clinical triage, fraud investigation, autonomous logistics, and pipeline engineering roles with fine-tuned system instructions and dynamic model selection.
          </p>

          {/* Key capability pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-xs font-mono text-[#A4A3B2]">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#292B3A] bg-[#12141A]">
              <Zap className="w-3 h-3 text-[#20E99A]" />
              <span>Full Context History</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#292B3A] bg-[#12141A]">
              <Cpu className="w-3 h-3 text-[#845CFF]" />
              <span>gemini-3.5-flash / gemini-3.1-pro / gemini-3.1-lite</span>
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#292B3A] bg-[#12141A]">
              <ShieldCheck className="w-3 h-3 text-[#24D8ED]" />
              <span>Role-Specific System Instructions</span>
            </span>
          </div>
        </div>

        {/* The Chatbot Application Frame */}
        <div className="max-w-5xl mx-auto">
          <GeminiChatbot initialRole={initialRole} />
        </div>
      </div>
    </section>
  );
};
