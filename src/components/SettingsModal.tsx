import React, { useState } from 'react';
import {
  X,
  Check,
  SlidersHorizontal,
  Server,
  Cpu,
  Volume2,
  Mic,
  Bot,
  Sliders,
  Globe,
  Gauge,
  Music,
  Play,
  Square,
  RotateCcw,
} from 'lucide-react';
import { PipelineConfig, PresetFlow, ServicesCatalog, PersonaVoiceTuning } from '../types';
import { ACCENT_OPTIONS, getPersonaForFlow } from './VoiceSettingsPanel';
import { playVoiceAudio, stopVoiceAudio } from '../utils/audioEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PipelineConfig;
  onSaveConfig: (newConfig: PipelineConfig) => void;
  services: ServicesCatalog | null;
  flows: PresetFlow[];
  voiceTuning?: PersonaVoiceTuning;
  onUpdateVoiceTuning?: (tuning: PersonaVoiceTuning) => void;
  authToken?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  services,
  flows,
  voiceTuning,
  onUpdateVoiceTuning,
  authToken,
}) => {
  const [currentConfig, setCurrentConfig] = React.useState<PipelineConfig>(config);
  const [activeTab, setActiveTab] = useState<'architecture' | 'voice'>('architecture');

  // Local copy of voice tuning
  const [localTuning, setLocalTuning] = useState<PersonaVoiceTuning>(
    voiceTuning || {
      pitch: 1.12,
      speed: 1.0,
      accent: 'sweet_freya',
      voiceId: 'jsCqWAovK2LkecY7zXl4',
      gender: 'female',
    }
  );
  const [isAuditioning, setIsAuditioning] = useState(false);

  React.useEffect(() => {
    setCurrentConfig(config);
  }, [config]);

  React.useEffect(() => {
    if (voiceTuning) {
      setLocalTuning(voiceTuning);
    }
  }, [voiceTuning]);

  React.useEffect(() => {
    return () => {
      stopVoiceAudio();
    };
  }, []);

  if (!isOpen) return null;

  const activePersona = getPersonaForFlow(currentConfig.flow);
  const currentAccent =
    ACCENT_OPTIONS.find((a) => a.id === localTuning.accent) || ACCENT_OPTIONS[0];

  const handleGenderChange = (gender: 'female' | 'male') => {
    const voiceForGender =
      currentAccent.voiceMap[gender]?.voiceId ||
      activePersona.voices[gender]?.elevenLabsId ||
      localTuning.voiceId;
    setLocalTuning((prev) => ({
      ...prev,
      gender,
      voiceId: voiceForGender,
    }));
  };

  const handleAccentChange = (accentId: string) => {
    const acc = ACCENT_OPTIONS.find((a) => a.id === accentId);
    if (!acc) return;
    const targetVoiceId = acc.voiceMap[localTuning.gender]?.voiceId || localTuning.voiceId;
    setLocalTuning((prev) => ({
      ...prev,
      accent: accentId,
      voiceId: targetVoiceId,
    }));
  };

  const handleToggleAudition = async () => {
    if (isAuditioning) {
      stopVoiceAudio();
      setIsAuditioning(false);
      return;
    }

    const script =
      activePersona.voices[localTuning.gender]?.sampleScript ||
      'Hello, this is Pyvex acoustic voice tuning with adjusted pitch and cadence.';

    setIsAuditioning(true);
    await playVoiceAudio({
      text: script,
      voiceId: localTuning.voiceId,
      gender: localTuning.gender,
      pitch: localTuning.pitch,
      rate: localTuning.speed,
      authToken,
      onStateChange: (playing) => {
        setIsAuditioning(playing);
      },
    });
  };

  const handleResetVoice = () => {
    stopVoiceAudio();
    setIsAuditioning(false);
    const defaultVoice = activePersona.voices[localTuning.gender];
    const defaultAccent =
      activePersona.id === 'healthcare-triage'
        ? 'us_clinical'
        : activePersona.id === 'fintech-wealth'
        ? 'us_wealth'
        : activePersona.id === 'real-estate-luxury'
        ? 'us_concierge'
        : activePersona.id === 'logistics-dispatch'
        ? 'us_dispatch'
        : 'us_executive';

    setLocalTuning({
      pitch: defaultVoice.pitch,
      speed: defaultVoice.rate,
      accent: defaultAccent,
      voiceId: defaultVoice.elevenLabsId,
      gender: localTuning.gender,
    });
  };

  const handleSave = () => {
    stopVoiceAudio();
    setIsAuditioning(false);
    onSaveConfig(currentConfig);
    if (onUpdateVoiceTuning) {
      onUpdateVoiceTuning(localTuning);
    }
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
                Pipecat Frame Processor & Voice Calibration
              </p>
            </div>
          </div>
          <button
            id="close-settings-modal"
            onClick={() => {
              stopVoiceAudio();
              setIsAuditioning(false);
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-8 pt-3 border-b border-white/[0.06] flex items-center gap-4 bg-white/[0.01]">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`pb-3 text-xs font-mono tracking-wider uppercase transition-colors relative ${
              activeTab === 'architecture'
                ? 'text-white font-semibold'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            Pipeline Architecture
            {activeTab === 'architecture' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`pb-3 text-xs font-mono tracking-wider uppercase transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'voice'
                ? 'text-purple-300 font-semibold'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Voice Pitch, Speed & Accent
            {activeTab === 'voice' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-7">
          {activeTab === 'architecture' ? (
            <>
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
            </>
          ) : (
            /* Voice Pitch, Speed, and Accent Tuning Tab */
            <div className="space-y-6 animate-fade-in">
              {/* Persona Context Banner */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{activePersona.roleTitle}</span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">{activePersona.subheadline || activePersona.headline}</p>
                </div>

                {/* Gender Toggle */}
                <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/[0.08] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGenderChange('female')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      localTuning.gender === 'female'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenderChange('male')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      localTuning.gender === 'male'
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Male
                  </button>
                </div>
              </div>

              {/* Accent & Regional Cadence */}
              <div>
                <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                  Voice Accent & Cadence
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                  {ACCENT_OPTIONS.map((acc) => {
                    const isSelected = localTuning.accent === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleAccentChange(acc.id)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-purple-500/60 bg-purple-500/15 text-white shadow-sm'
                            : 'border-white/[0.06] bg-white/[0.02] text-white/70 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span>{acc.flag}</span>
                            <span className="text-xs font-semibold text-white">{acc.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <p className="text-[11px] text-white/50 line-clamp-1">{acc.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pitch & Speed Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Speed Slider */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/50 flex items-center gap-2">
                      <Gauge className="w-3.5 h-3.5 text-amber-400" />
                      Speed (Rate)
                    </label>
                    <span className="text-xs font-mono font-semibold text-amber-300">
                      {localTuning.speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="1.40"
                    step="0.05"
                    value={localTuning.speed}
                    onChange={(e) =>
                      setLocalTuning((prev) => ({
                        ...prev,
                        speed: Number(parseFloat(e.target.value).toFixed(2)),
                      }))
                    }
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/40">
                    <span>0.70x</span>
                    <span>1.00x Normal</span>
                    <span>1.40x</span>
                  </div>
                </div>

                {/* Pitch Slider */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/50 flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-cyan-400" />
                      Pitch (Frequency)
                    </label>
                    <span className="text-xs font-mono font-semibold text-cyan-300">
                      {localTuning.pitch.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.35"
                    step="0.02"
                    value={localTuning.pitch}
                    onChange={(e) =>
                      setLocalTuning((prev) => ({
                        ...prev,
                        pitch: Number(parseFloat(e.target.value).toFixed(2)),
                      }))
                    }
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-white/40">
                    <span>0.75x Deep</span>
                    <span>1.00x Natural</span>
                    <span>1.35x Bright</span>
                  </div>
                </div>
              </div>

              {/* Audition & Reset */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleAudition}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-all ${
                    isAuditioning
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                  }`}
                >
                  {isAuditioning ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Audition Voice</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetVoice}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/50 hover:text-white border border-white/[0.08] flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Baseline</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/[0.07] flex items-center justify-end gap-3 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => {
              stopVoiceAudio();
              setIsAuditioning(false);
              onClose();
            }}
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

