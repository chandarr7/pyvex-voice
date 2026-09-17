import React from 'react';
import { PYVEX_PERSONAS } from '../data/personas';
import { ArrowRight, Check } from 'lucide-react';

interface SolutionsGridProps {
  activePersonaId: string;
  onSelectPersona: (personaId: string) => void;
  onOpenStudio: () => void;
}

export const SolutionsGrid: React.FC<SolutionsGridProps> = ({
  activePersonaId,
  onSelectPersona,
}) => {
  return (
    <section id="solutions" className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-20 border-t border-[#292B3A]">
      <div className="space-y-4 max-w-2xl mb-12">
        <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#845CFF] font-semibold">
          Industry Deployments
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold font-sans text-[#F4F2F8] tracking-tight">
          Purpose-Built for Mission-Critical Voice Workflows
        </h2>
        <p className="text-base text-[#A4A3B2] font-sans">
          Deploy specialized voice agents tailored with domain vocabulary, compliance controls, and realistic vocal cadence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PYVEX_PERSONAS.map((persona) => {
          const isActive = persona.id === activePersonaId;
          return (
            <div
              key={persona.id}
              className={`p-7 rounded-3xl border transition-all duration-300 flex flex-col justify-between group cursor-pointer ${
                isActive
                  ? 'bg-[#1C1D25] border-[#845CFF] shadow-[0_0_25px_rgba(112,71,255,0.25)] scale-[1.01]'
                  : 'bg-[#12141A] border-[#292B3A] hover:border-[#34365C] hover:bg-[#171820]'
              }`}
              onClick={() => {
                onSelectPersona(persona.id);
                window.scrollTo({ top: 100, behavior: 'smooth' });
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded"
                      style={{
                        color: '#24D8ED',
                        background: 'rgba(36, 216, 237, 0.1)',
                        border: '1px solid rgba(36, 216, 237, 0.25)',
                      }}
                    >
                      {persona.category}
                    </span>

                    {/* Pill-shaped tag indicating Voice Model provider */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold border ${
                        persona.voiceProvider === 'ElevenLabs'
                          ? 'border-[#845CFF]/40 bg-[#845CFF]/15 text-[#D8B4FE]'
                          : 'border-[#24D8ED]/40 bg-[#24D8ED]/15 text-[#67E8F9]'
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          persona.voiceProvider === 'ElevenLabs' ? 'bg-[#845CFF]' : 'bg-[#24D8ED]'
                        }`}
                      />
                      <span>{persona.voiceProvider}</span>
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-[#20E99A] px-2 py-0.5 rounded border border-[#20E99A]/30 bg-[#20E99A]/5 shrink-0">
                    {persona.metrics.latency}
                  </span>
                </div>

                <h3 className="text-lg font-bold font-sans text-[#F4F2F8] mb-2 group-hover:text-[#845CFF] transition-colors">
                  {persona.roleTitle}
                </h3>
                <p className="text-xs text-[#A4A3B2] leading-relaxed line-clamp-3 mb-6 font-sans">
                  {persona.subheadline}
                </p>

                {/* Voice pairing preview */}
                <div className="space-y-2 py-3 border-y border-[#292B3A] mb-6 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-[#A4A3B2]">
                    <span className="text-[#666879]">Female Voice:</span>
                    <span className="text-[#F4F2F8]">{persona.voices.female.name.split('(')[0]}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#A4A3B2]">
                    <span className="text-[#666879]">Male Voice:</span>
                    <span className="text-[#F4F2F8]">{persona.voices.male.name.split('(')[0]}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#A4A3B2] group-hover:text-[#845CFF] transition-colors flex items-center gap-1.5 font-semibold">
                  <span>Test in 3D Carousel</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
                {isActive && <Check className="w-4 h-4 text-[#20E99A]" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
export default SolutionsGrid;
