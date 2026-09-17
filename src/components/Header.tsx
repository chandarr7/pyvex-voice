import React from 'react';
import { SlidersHorizontal, Power, Radio, Disc, Mic, Volume2 } from 'lucide-react';
import { PipelineConfig } from '../types';

interface HeaderProps {
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  pipelineConfig: PipelineConfig;
  activeFlowName: string;
  onOpenSettings: () => void;
  onToggleConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  isConnecting,
  isListening,
  isSpeaking,
  pipelineConfig,
  activeFlowName,
  onOpenSettings,
  onToggleConnect,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0b0c0e]/90 backdrop-blur-xl border-b border-white/[0.07] px-6 lg:px-12 py-4 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-white/15 bg-gradient-to-b from-white/[0.08] to-transparent flex items-center justify-center shadow-inner">
            <Disc className={`w-5 h-5 text-white/90 ${isConnected ? 'animate-spin [animation-duration:8s]' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold tracking-[0.2em] uppercase text-white">
                Pyvex
              </span>
              <span className="text-[10px] font-mono font-medium tracking-wider px-2 py-0.5 rounded-full border border-white/10 text-white/60 bg-white/[0.03]">
                STUDIO • PIPECAT
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5 tracking-wide">
              {activeFlowName} <span className="text-white/20">•</span> <span className="font-mono text-[11px] text-white/50">{pipelineConfig.transport.toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* Status Indicators & Master Controls */}
        <div className="flex items-center gap-3">
          {/* Real-time acoustic state badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02] text-xs font-mono text-white/70">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isSpeaking
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse'
                  : isListening
                  ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse'
                  : isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  : 'bg-white/20'
              }`}
            />
            <span className="tracking-wider uppercase text-[11px]">
              {isSpeaking ? 'Synthesizing' : isListening ? 'Capturing' : isConnected ? 'Live 24kHz' : 'Standby'}
            </span>
          </div>

          {/* Settings button */}
          <button
            id="open-settings-button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] text-xs font-medium text-white/80 transition-all active:scale-[0.98]"
            title="Configure Acoustic Pipeline"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-white/60" />
            <span className="hidden sm:inline tracking-wider uppercase text-[11px]">Params</span>
          </button>

          {/* Connect / Disconnect Action */}
          <button
            id="connect-pipeline-button"
            onClick={onToggleConnect}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 active:scale-[0.97] ${
              isConnected
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-[#f4f1eb] hover:bg-white text-[#0b0c0e] shadow-[0_2px_12px_rgba(244,241,235,0.12)]'
            }`}
          >
            <Power className={`w-3.5 h-3.5 ${isConnected ? 'text-rose-400' : 'text-[#0b0c0e]'}`} />
            <span>
              {isConnecting ? 'Connecting...' : isConnected ? 'End Session' : 'Initialize'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
