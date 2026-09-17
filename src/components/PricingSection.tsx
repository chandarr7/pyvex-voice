import React from 'react';
import { Check } from 'lucide-react';

interface PricingSectionProps {
  onOpenStudio: () => void;
  onBookDemo: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onOpenStudio, onBookDemo }) => {
  return (
    <section id="pricing" className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 border-t border-[#292B3A]">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#845CFF] font-semibold">
          Transparent Voice Economics
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold font-sans text-[#F4F2F8] tracking-tight">
          Simple Per-Minute Billing. Zero Hidden Overheads.
        </h2>
        <p className="text-sm text-[#A4A3B2] font-sans">
          Deploy prototypes for free in the sandbox, scale effortlessly across telephony carriers with wholesale rates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {/* Developer Sandbox */}
        <div
          className="p-8 rounded-3xl border flex flex-col justify-between"
          style={{
            background: '#12141A',
            border: '1px solid #292B3A',
          }}
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#A4A3B2] mb-2 font-semibold">
              Developer
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-mono font-bold text-[#F4F2F8]">$0</span>
              <span className="text-xs text-[#666879] font-mono">/month</span>
            </div>
            <p className="text-xs text-[#A4A3B2] mb-6 font-sans">
              Ideal for prototyping custom voice agents and testing ElevenLabs voice configurations.
            </p>

            <ul className="space-y-3 text-xs font-mono text-[#A4A3B2] border-t border-[#292B3A] pt-6 mb-8">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#845CFF] shrink-0" />
                <span>100 free pipeline minutes</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#845CFF] shrink-0" />
                <span>WebRTC browser transport</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#845CFF] shrink-0" />
                <span>Shared frame processors</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#845CFF] shrink-0" />
                <span>Community support</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onOpenStudio}
            className="w-full py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold border border-[#292B3A] hover:border-[#34365C] bg-[#0D0F13] hover:bg-[#171820] text-[#F4F2F8] transition-all active:scale-95"
          >
            Launch Free Sandbox
          </button>
        </div>

        {/* Growth Pro Tier (Featured) */}
        <div
          className="p-8 rounded-3xl border shadow-2xl flex flex-col justify-between relative"
          style={{
            background: '#1C1D25',
            border: '1px solid #7047FF',
            boxShadow: '0 0 35px rgba(112, 71, 255, 0.25)',
          }}
        >
          <div
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest text-[#F4F2F8] font-bold shadow-md"
            style={{
              background: '#7047FF',
              boxShadow: '0 0 12px rgba(112, 71, 255, 0.5)',
            }}
          >
            Most Popular
          </div>

          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#845CFF] mb-2 font-bold">
              Growth & Scale
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-mono font-bold text-[#F4F2F8]">$0.08</span>
              <span className="text-xs text-[#A4A3B2] font-mono">/voice minute</span>
            </div>
            <p className="text-xs text-[#A4A3B2] mb-6 font-sans">
              Production scale with direct SIP carrier integration, custom ElevenLabs voices, and low-latency LLM routing.
            </p>

            <ul className="space-y-3 text-xs font-mono text-[#F4F2F8] border-t border-[#34365C] pt-6 mb-8">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#20E99A] shrink-0" />
                <span>Sub-300ms latency routing</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#20E99A] shrink-0" />
                <span>Unlimited concurrent SIP calls</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#20E99A] shrink-0" />
                <span>Bring your own ElevenLabs Key</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#20E99A] shrink-0" />
                <span>Custom function calling & webhook tools</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#20E99A] shrink-0" />
                <span className="text-[#20E99A]">99.99% uptime SLA</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onOpenStudio}
            className="w-full py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-bold text-[#F4F2F8] transition-all shadow-lg active:scale-95"
            style={{
              background: '#7047FF',
              boxShadow: '0 4px 18px rgba(112, 71, 255, 0.4)',
            }}
          >
            Start Scaled Deployment
          </button>
        </div>

        {/* Enterprise Tier */}
        <div
          id="enterprise"
          className="p-8 rounded-3xl border flex flex-col justify-between"
          style={{
            background: '#12141A',
            border: '1px solid #292B3A',
          }}
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#A4A3B2] mb-2 font-semibold">
              Enterprise
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-mono font-bold text-[#F4F2F8]">Custom</span>
              <span className="text-xs text-[#666879] font-mono">/annual</span>
            </div>
            <p className="text-xs text-[#A4A3B2] mb-6 font-sans">
              Dedicated single-tenant infrastructure with HIPAA BAA, SOC2 Type II reporting, and custom model fine-tuning.
            </p>

            <ul className="space-y-3 text-xs font-mono text-[#A4A3B2] border-t border-[#292B3A] pt-6 mb-8">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#24D8ED] shrink-0" />
                <span>Private VPC / On-premise deployment</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#24D8ED] shrink-0" />
                <span>HIPAA & GDPR BAA execution</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#24D8ED] shrink-0" />
                <span>Dedicated voice biometric auth pipeline</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#24D8ED] shrink-0" />
                <span>24/7 dedicated solutions engineering</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onBookDemo}
            className="w-full py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold border border-[#292B3A] hover:border-[#34365C] bg-[#0D0F13] hover:bg-[#171820] text-[#F4F2F8] transition-all active:scale-95"
          >
            Request Enterprise Briefing
          </button>
        </div>
      </div>
    </section>
  );
};
export default PricingSection;
