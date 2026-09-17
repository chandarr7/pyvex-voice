import React from 'react';
import { Activity, Mic, Phone, Radio, Settings, Volume2, ShieldCheck } from 'lucide-react';
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
    <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              Pyvex Voice
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Pipecat v1.0
              </span>
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Real-Time Multimodal Voice Pipeline • <span className="text-zinc-300 font-medium">{activeFlowName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Status indicator pills */}
        <div className="hidden sm:flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300">
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
          <span className="font-mono">{pipelineConfig.transport.toUpperCase()}</span>
        </div>

        {isListening && (
          <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 animate-pulse">
            <Mic className="w-3.5 h-3.5" />
            <span>Listening</span>
          </div>
        )}

        {isSpeaking && (
          <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 animate-pulse">
            <Volume2 className="w-3.5 h-3.5" />
            <span>TTS Speaking</span>
          </div>
        )}

        {/* Configuration button */}
        <button
          id="open-settings-button"
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
          title="Pipeline Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Connect/Disconnect button */}
        <button
          id="connect-pipeline-button"
          onClick={onToggleConnect}
          disabled={isConnecting}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
            isConnected
              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
              : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold shadow-cyan-500/20'
          }`}
        >
          <Phone className={`w-4 h-4 ${isConnected ? 'rotate-135 text-rose-400' : ''}`} />
          {isConnecting ? 'Connecting...' : isConnected ? 'End Session' : 'Start Session'}
        </button>
      </div>
    </header>
  );
};
