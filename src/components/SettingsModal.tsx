import React from 'react';
import { X, Check, SlidersHorizontal, Server, Cpu, Volume2, Mic, Bot } from 'lucide-react';
import { PipelineConfig, PresetFlow, ServicesCatalog } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PipelineConfig;
  onSaveConfig: (newConfig: PipelineConfig) => void;
  services: ServicesCatalog | null;
  flows: PresetFlow[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  services,
  flows,
}) => {
  const [currentConfig, setCurrentConfig] = React.useState<PipelineConfig>(config);

  React.useEffect(() => {
    setCurrentConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(currentConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121316] border border-white/[0.1] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-white/[0.07] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-white/80" />
            </div>
            <div>
              <h2 className="text-base font-serif italic text-white tracking-wide">
                Acoustic Architecture Settings
              </h2>
              <p className="text-[11px] font-mono text-white/40">
                Pipecat Frame Processor Orchestration
              </p>
            </div>
          </div>
          <button
            id="close-settings-modal"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-7">
          {/* Persona / Flow selection */}
          <div>
            <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-3 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-white/60" />
              Dialogue Scenario & Persona
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {flows.map((flow) => {
                const isSelected = currentConfig.flow === flow.id;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setCurrentConfig({ ...currentConfig, flow: flow.id })}
                    className={`text-left p-4 rounded-2xl border transition-all duration-200 ${
                      isSelected
                        ? 'border-white/40 bg-white/[0.08] text-white shadow-lg'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/70 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium tracking-tight text-white">{flow.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{flow.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Infrastructure modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Transport */}
            <div>
              <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-white/60" />
                Transport Protocol
              </label>
              <select
                value={currentConfig.transport}
                onChange={(e) => setCurrentConfig({ ...currentConfig, transport: e.target.value })}
                className="w-full mt-1.5 bg-[#181a1f] border border-white/[0.09] hover:border-white/25 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/50 transition-colors"
              >
                {services?.transports?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            {/* STT */}
            <div>
              <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-white/60" />
                Speech-to-Text Engine
              </label>
              <select
                value={currentConfig.stt}
                onChange={(e) => setCurrentConfig({ ...currentConfig, stt: e.target.value })}
                className="w-full mt-1.5 bg-[#181a1f] border border-white/[0.09] hover:border-white/25 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/50 transition-colors"
              >
                {services?.stt?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (~{s.latency})
                  </option>
                ))}
              </select>
            </div>

            {/* LLM */}
            <div>
              <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-white/60" />
                Cognitive Reasoning Model
              </label>
              <select
                value={currentConfig.llm}
                onChange={(e) => setCurrentConfig({ ...currentConfig, llm: e.target.value })}
                className="w-full mt-1.5 bg-[#181a1f] border border-white/[0.09] hover:border-white/25 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/50 transition-colors"
              >
                {services?.llm?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (~{l.latency})
                  </option>
                ))}
              </select>
            </div>

            {/* TTS */}
            <div>
              <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-white/60" />
                Speech Synthesis Voice
              </label>
              <select
                value={currentConfig.tts}
                onChange={(e) => setCurrentConfig({ ...currentConfig, tts: e.target.value })}
                className="w-full mt-1.5 bg-[#181a1f] border border-white/[0.09] hover:border-white/25 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-white/50 transition-colors"
              >
                {services?.tts?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (~{t.latency})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/[0.07] flex items-center justify-end gap-3 bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            id="apply-settings-button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold bg-[#f4f1eb] hover:bg-white text-[#0b0c0e] transition-all shadow-md active:scale-95"
          >
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
