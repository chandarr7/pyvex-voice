import React from 'react';
import { X, Check, Sliders, Server, Cpu, Volume2, Mic, Bot } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-zinc-100">Pipecat Pipeline Configuration</h2>
          </div>
          <button
            id="close-settings-modal"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Persona / Flow */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-cyan-400" />
              Bot Flow / Persona
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {flows.map((flow) => {
                const isSelected = currentConfig.flow === flow.id;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => setCurrentConfig({ ...currentConfig, flow: flow.id })}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-100 shadow-sm shadow-cyan-500/10'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{flow.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{flow.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Transport */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyan-400" />
                Transport Layer
              </label>
              <select
                value={currentConfig.transport}
                onChange={(e) => setCurrentConfig({ ...currentConfig, transport: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
              >
                {services?.transports?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </select>
            </div>

            {/* STT Service */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-cyan-400" />
                Speech-to-Text (STT)
              </label>
              <select
                value={currentConfig.stt}
                onChange={(e) => setCurrentConfig({ ...currentConfig, stt: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
              >
                {services?.stt?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (~{s.latency})
                  </option>
                ))}
              </select>
            </div>

            {/* LLM Service */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                LLM Worker Service
              </label>
              <select
                value={currentConfig.llm}
                onChange={(e) => setCurrentConfig({ ...currentConfig, llm: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
              >
                {services?.llm?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (~{l.latency})
                  </option>
                ))}
              </select>
            </div>

            {/* TTS Service */}
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                Text-to-Speech (TTS)
              </label>
              <select
                value={currentConfig.tts}
                onChange={(e) => setCurrentConfig({ ...currentConfig, tts: e.target.value })}
                className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-cyan-500"
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

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="apply-settings-button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors shadow-sm"
          >
            Apply Pipeline Settings
          </button>
        </div>
      </div>
    </div>
  );
};
