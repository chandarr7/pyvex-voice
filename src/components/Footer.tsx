import React from 'react';
import { Disc, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative w-full bg-[#08090B] border-t border-[#292B3A] text-[#A4A3B2] font-mono text-xs overflow-hidden">
      {/* ================= FOOTER AMBIENT SINE WAVE ================= */}
      {/* Glowing sine-wave graphic at the base of the viewport blending gradients of --purple-dark, --purple-bright, and --cyan */}
      <div className="w-full overflow-hidden pointer-events-none select-none relative">
        <svg
          viewBox="0 0 1440 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-20 sm:h-28 lg:h-36 block"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradient blending --purple-dark (#35246E), --purple-bright (#845CFF), and --cyan (#24D8ED) */}
            <linearGradient id="footer-ambient-wave-grad-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#35246E" stopOpacity="0.4" />
              <stop offset="30%" stopColor="#845CFF" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#7047FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#24D8ED" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id="footer-ambient-wave-grad-2" x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#24D8ED" stopOpacity="0.6" />
              <stop offset="45%" stopColor="#845CFF" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#35246E" stopOpacity="0.3" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="wave-glow-filter" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background area glow fill */}
          <path
            d="M0,80 C320,140 640,20 960,110 C1200,160 1340,50 1440,80 L1440,160 L0,160 Z"
            fill="url(#footer-ambient-wave-grad-1)"
            opacity="0.08"
          />

          {/* Primary glowing sine wave ribbon */}
          <path
            d="M0,80 C320,140 640,20 960,110 C1200,160 1340,50 1440,80"
            stroke="url(#footer-ambient-wave-grad-1)"
            strokeWidth="3.5"
            fill="none"
            filter="url(#wave-glow-filter)"
          />

          {/* Secondary subtle resonant harmonic wave */}
          <path
            d="M0,100 C280,30 600,135 920,65 C1180,10 1360,120 1440,95"
            stroke="url(#footer-ambient-wave-grad-2)"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />
        </svg>

        {/* Ambient bottom illumination */}
        <div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[800px] h-24 blur-3xl pointer-events-none rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(132, 92, 255, 0.25), rgba(36, 216, 237, 0.15), transparent 70%)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-10 pb-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border border-[#34365C] bg-[#12141A] flex items-center justify-center shadow-[0_0_10px_rgba(112,71,255,0.3)]">
                <Disc className="w-4 h-4 text-[#845CFF]" />
              </div>
              <span className="text-sm font-bold tracking-tight text-[#F4F2F8] font-sans">
                Tilted <span className="text-[#845CFF]">STUDIO</span>
              </span>
            </div>
            <p className="text-xs text-[#A4A3B2] leading-relaxed font-sans">
              High-performance real-time AI voice agent orchestration infrastructure with sub-300ms conversational latency.
            </p>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#20E99A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20E99A] shadow-[0_0_8px_#20E99A] animate-pulse" />
              <span>All Systems Operational (99.99%)</span>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <span className="text-[#F4F2F8] uppercase tracking-widest text-[11px] font-semibold block">
              Platform & Core
            </span>
            <ul className="space-y-2 text-[#A4A3B2]">
              <li><a href="#gemini-chat" className="hover:text-[#F4F2F8] transition-colors text-[#D8B4FE] font-medium">Tilted Sales Agent</a></li>
              <li><a href="#platform" className="hover:text-[#F4F2F8] transition-colors">Frame-Based Pipeline</a></li>
              <li><a href="#architecture" className="hover:text-[#F4F2F8] transition-colors">Telephony SIP Trunking</a></li>
              <li><a href="#architecture" className="hover:text-[#F4F2F8] transition-colors">Silero VAD Barge-In</a></li>
              <li><a href="#architecture" className="hover:text-[#F4F2F8] transition-colors">ElevenLabs Multi-Voice</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <span className="text-[#F4F2F8] uppercase tracking-widest text-[11px] font-semibold block">
              Solutions by Sector
            </span>
            <ul className="space-y-2 text-[#A4A3B2]">
              <li><a href="#solutions" className="hover:text-[#F4F2F8] transition-colors">Enterprise B2B Sales SDR</a></li>
              <li><a href="#solutions" className="hover:text-[#F4F2F8] transition-colors">Clinical Triage & Patient Intake</a></li>
              <li><a href="#solutions" className="hover:text-[#F4F2F8] transition-colors">Wealth Advisory & Banking</a></li>
              <li><a href="#solutions" className="hover:text-[#F4F2F8] transition-colors">Fleet Dispatch & Logistics</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <span className="text-[#F4F2F8] uppercase tracking-widest text-[11px] font-semibold block">
              Developer & Governance
            </span>
            <ul className="space-y-2 text-[#A4A3B2]">
              <li><a href="#docs" className="hover:text-[#F4F2F8] transition-colors flex items-center gap-1">API Documentation <ArrowUpRight className="w-3 h-3 text-[#666879]" /></a></li>
              <li><a href="#compliance" className="hover:text-[#F4F2F8] transition-colors">HIPAA & SOC-2 Compliance</a></li>
              <li><a href="#security" className="hover:text-[#F4F2F8] transition-colors">Biometric Voice Security</a></li>
              <li><a href="#terms" className="hover:text-[#F4F2F8] transition-colors">Terms of Infrastructure</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-[#292B3A] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#666879]">
          <div>
            © {new Date().getFullYear()} Tilted STUDIO Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-[#A4A3B2]">
            <span>Core: Pipecat Engine 1.4</span>
            <span className="text-[#845CFF]">ElevenLabs v2.5 Turbo</span>
            <span className="text-[#24D8ED]">WebRTC 1.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
