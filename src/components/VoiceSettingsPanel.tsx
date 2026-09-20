import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Volume2,
  Play,
  Square,
  RotateCcw,
  Check,
  Sparkles,
  Globe,
  Gauge,
  Music,
  User,
  X,
  Radio,
} from 'lucide-react';
import { PersonaVoiceTuning, PresetFlow } from '../types';
import { PYVEX_PERSONAS, Persona, SWEET_FEMALE_VOICES, SweetVoiceProfile } from '../data/personas';
import { playVoiceAudio, stopVoiceAudio } from '../utils/audioEngine';

export interface VoiceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFlowId: string;
  tuning: PersonaVoiceTuning;
  onUpdateTuning: (newTuning: PersonaVoiceTuning) => void;
  flows?: PresetFlow[];
  authToken?: string;
  onAppliedToast?: (message: string) => void;
}

export interface AccentOption {
  id: string;
  label: string;
  region: string;
  flag: string;
  description: string;
  voiceMap: {
    female: { voiceId: string; name: string };
    male: { voiceId: string; name: string };
  };
  recommendedPitch: number;
  recommendedSpeed: number;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'us_executive',
    label: 'American Executive',
    region: 'North America',
    flag: '🇺🇸',
    description: 'Crisp, consultative, polished corporate delivery for enterprise sales and leadership.',
    voiceMap: {
      female: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
      male: { voiceId: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
    },
    recommendedPitch: 1.02,
    recommendedSpeed: 1.0,
  },
  {
    id: 'us_clinical',
    label: 'American Clinical',
    region: 'North America',
    flag: '🏥',
    description: 'Empathetic, soothing, articulate cadence optimal for medical triage and patient care.',
    voiceMap: {
      female: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' },
      male: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
    },
    recommendedPitch: 1.05,
    recommendedSpeed: 0.98,
  },
  {
    id: 'us_concierge',
    label: 'American Concierge',
    region: 'North America',
    flag: '✨',
    description: 'Warm, vibrant, hospitable cadence suited for luxury hospitality and white-glove service.',
    voiceMap: {
      female: { voiceId: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella' },
      male: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
    },
    recommendedPitch: 1.08,
    recommendedSpeed: 1.02,
  },
  {
    id: 'us_dispatch',
    label: 'American Industrial Dispatch',
    region: 'North America',
    flag: '🚚',
    description: 'Direct, focused, high-clarity radio delivery engineered for fleet routing and logistics.',
    voiceMap: {
      female: { voiceId: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
      male: { voiceId: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
    },
    recommendedPitch: 0.95,
    recommendedSpeed: 1.05,
  },
  {
    id: 'uk_received',
    label: 'British Advisory (RP)',
    region: 'United Kingdom',
    flag: '🇬🇧',
    description: 'Distinguished, calm, authoritative cadence ideal for wealth planning and corporate advisory.',
    voiceMap: {
      female: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (UK Alt)' },
      male: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (British)' },
    },
    recommendedPitch: 0.98,
    recommendedSpeed: 0.96,
  },
  {
    id: 'au_dynamic',
    label: 'Australian Dynamic',
    region: 'Oceania',
    flag: '🇦🇺',
    description: 'Energetic, resonant, engaging delivery perfect for outreach and dynamic qualification.',
    voiceMap: {
      female: { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice (AU Alt)' },
      male: { voiceId: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Oceanic)' },
    },
    recommendedPitch: 1.0,
    recommendedSpeed: 1.04,
  },
  {
    id: 'us_wealth',
    label: 'American Financial & Trust',
    region: 'North America',
    flag: '🛡️',
    description: 'Grounded, measured, security-focused cadence for fintech and fraud verification.',
    voiceMap: {
      female: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
      male: { voiceId: 'cjVigY5qzO86Huf0OWal', name: 'Eric' },
    },
    recommendedPitch: 0.95,
    recommendedSpeed: 1.0,
  },
  {
    id: 'sweet_lily',
    label: 'Lily (Sweet Velvet)',
    region: 'Human Sweet Voice',
    flag: '🌸',
    description: 'Warm, velvet, soothing, and sweet gentle cadence with comforting acoustic warmth.',
    voiceMap: {
      female: { voiceId: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Sweet Velvet)' },
      male: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Warm)' },
    },
    recommendedPitch: 1.08,
    recommendedSpeed: 0.96,
  },
  {
    id: 'sweet_freya',
    label: 'Freya (Sweet Radiant)',
    region: 'Human Sweet Voice',
    flag: '✨',
    description: 'Delightful, radiant, and charmingly sweet cadence with a warm acoustic smile.',
    voiceMap: {
      female: { voiceId: 'jsCqWAovK2LkecY7zXl4', name: 'Freya (Sweet Radiant)' },
      male: { voiceId: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Dynamic)' },
    },
    recommendedPitch: 1.12,
    recommendedSpeed: 1.0,
  },
  {
    id: 'sweet_emily',
    label: 'Emily (Sweet Gentle)',
    region: 'Human Sweet Voice',
    flag: '🌷',
    description: 'Tender, sweet, soft-spoken conversational tone with calm empathetic intimacy.',
    voiceMap: {
      female: { voiceId: 'LcfcDJNigUd50AZSDxio', name: 'Emily (Sweet Gentle)' },
      male: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Gentle)' },
    },
    recommendedPitch: 1.06,
    recommendedSpeed: 0.98,
  },
  {
    id: 'sweet_charlotte',
    label: 'Charlotte (Sweet Melodic)',
    region: 'Human Sweet Voice',
    flag: '🕊️',
    description: 'Delicate, sweet, and melodic cadence with silky enunciation for luxury hospitality.',
    voiceMap: {
      female: { voiceId: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Sweet Melodic)' },
      male: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Advisory)' },
    },
    recommendedPitch: 1.10,
    recommendedSpeed: 0.95,
  },
  {
    id: 'sweet_nicole',
    label: 'Nicole (Sweet Whisper-Soft)',
    region: 'Human Sweet Voice',
    flag: '🌙',
    description: 'Velvety, intimate, and peacefully sweet whispery warmth designed for comforting interactions.',
    voiceMap: {
      female: { voiceId: 'piTKgcLEGmPE4e6mEKli', name: 'Nicole (Sweet Whisper-Soft)' },
      male: { voiceId: 'cjVigY5qzO86Huf0OWal', name: 'Eric (Calm)' },
    },
    recommendedPitch: 1.04,
    recommendedSpeed: 0.97,
  },
];

// Helper to find matching persona from data
export const getPersonaForFlow = (flowId: string): Persona => {
  if (flowId === 'clinical_triage') {
    return PYVEX_PERSONAS.find((p) => p.id === 'healthcare-triage') || PYVEX_PERSONAS[1];
  }
  if (flowId === 'fraud_alert') {
    return PYVEX_PERSONAS.find((p) => p.id === 'fintech-wealth') || PYVEX_PERSONAS[2];
  }
  if (flowId === 'luxury_real_estate') {
    return PYVEX_PERSONAS.find((p) => p.id === 'real-estate-luxury') || PYVEX_PERSONAS[3];
  }
  if (flowId === 'fleet_dispatch') {
    return PYVEX_PERSONAS.find((p) => p.id === 'logistics-dispatch') || PYVEX_PERSONAS[4];
  }
  return PYVEX_PERSONAS.find((p) => p.id === 'enterprise-sdr') || PYVEX_PERSONAS[0];
};

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  isOpen,
  onClose,
  activeFlowId,
  tuning,
  onUpdateTuning,
  flows,
  authToken,
  onAppliedToast,
}) => {
  const activePersona = getPersonaForFlow(activeFlowId);
  const activeFlowObj = flows?.find((f) => f.id === activeFlowId);

  // Local draft state before committing
  const [localTuning, setLocalTuning] = useState<PersonaVoiceTuning>(tuning);
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [auditionText, setAuditionText] = useState(
    activePersona.voices[tuning.gender]?.sampleScript ||
      'Hello! This is Pyvex acoustic synthesis preview with adjusted pitch, speed, and accent calibration.'
  );
  const [isSaved, setIsSaved] = useState(false);
  const [auditioningSweetId, setAuditioningSweetId] = useState<string | null>(null);

  // Sync draft when tuning or flow updates
  useEffect(() => {
    setLocalTuning(tuning);
    const defaultVoice = activePersona.voices[tuning.gender];
    if (defaultVoice) {
      setAuditionText(defaultVoice.sampleScript);
    }
  }, [tuning, activeFlowId, activePersona]);

  // Clean up playback on unmount or close
  useEffect(() => {
    return () => {
      stopVoiceAudio();
    };
  }, []);

  if (!isOpen) return null;

  // Active accent object
  const currentAccent =
    ACCENT_OPTIONS.find((a) => a.id === localTuning.accent) || ACCENT_OPTIONS[0];

  // Gender toggle handler
  const handleGenderChange = (gender: 'female' | 'male') => {
    const voiceForGender = currentAccent.voiceMap[gender]?.voiceId || activePersona.voices[gender]?.elevenLabsId || localTuning.voiceId;
    const newTuning: PersonaVoiceTuning = {
      ...localTuning,
      gender,
      voiceId: voiceForGender,
    };
    setLocalTuning(newTuning);
    const script = activePersona.voices[gender]?.sampleScript;
    if (script) setAuditionText(script);
  };

  // Accent selection handler
  const handleAccentSelect = (accent: AccentOption) => {
    const targetVoiceId = accent.voiceMap[localTuning.gender]?.voiceId || localTuning.voiceId;
    const newTuning: PersonaVoiceTuning = {
      ...localTuning,
      accent: accent.id,
      voiceId: targetVoiceId,
    };
    setLocalTuning(newTuning);
  };

  // Pitch change
  const handlePitchChange = (pitch: number) => {
    setLocalTuning((prev) => ({ ...prev, pitch: Number(pitch.toFixed(2)) }));
  };

  // Speed change
  const handleSpeedChange = (speed: number) => {
    setLocalTuning((prev) => ({ ...prev, speed: Number(speed.toFixed(2)) }));
  };

  // Select human female sweet voice
  const handleSelectSweetVoice = (sweetVoice: SweetVoiceProfile) => {
    stopVoiceAudio();
    setIsAuditioning(false);
    setAuditioningSweetId(null);
    const newTuning: PersonaVoiceTuning = {
      ...localTuning,
      gender: 'female',
      voiceId: sweetVoice.id,
      pitch: sweetVoice.pitch,
      speed: sweetVoice.rate,
      accent: `sweet_${sweetVoice.name.toLowerCase()}`,
    };
    setLocalTuning(newTuning);
    setAuditionText(sweetVoice.sampleScript);
  };

  // Audition specific sweet voice
  const handleAuditionSweetVoice = async (e: React.MouseEvent, sweetVoice: SweetVoiceProfile) => {
    e.stopPropagation();
    if (auditioningSweetId === sweetVoice.id) {
      stopVoiceAudio();
      setAuditioningSweetId(null);
      return;
    }

    stopVoiceAudio();
    setIsAuditioning(false);
    setAuditioningSweetId(sweetVoice.id);
    await playVoiceAudio({
      text: sweetVoice.sampleScript,
      voiceId: sweetVoice.id,
      gender: 'female',
      pitch: sweetVoice.pitch,
      rate: sweetVoice.rate,
      authToken,
      onStateChange: (playing) => {
        if (!playing) setAuditioningSweetId(null);
      },
    });
  };

  // Reset to active persona baseline
  const handleReset = () => {
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

    const baseline: PersonaVoiceTuning = {
      pitch: defaultVoice.pitch,
      speed: defaultVoice.rate,
      accent: defaultAccent,
      voiceId: defaultVoice.elevenLabsId,
      gender: localTuning.gender,
    };
    setLocalTuning(baseline);
    setAuditionText(defaultVoice.sampleScript);
    onUpdateTuning(baseline);
    if (onAppliedToast) onAppliedToast('Restored calibrated persona baseline');
  };

  // Audition voice synthesis
  const handleToggleAudition = async () => {
    if (isAuditioning) {
      stopVoiceAudio();
      setIsAuditioning(false);
      return;
    }

    setIsAuditioning(true);
    await playVoiceAudio({
      text: auditionText,
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

  // Apply to active session
  const handleApply = () => {
    stopVoiceAudio();
    setIsAuditioning(false);
    onUpdateTuning(localTuning);
    setIsSaved(true);
    if (onAppliedToast) {
      onAppliedToast(
        `Applied voice settings: Pitch ${localTuning.pitch.toFixed(2)}x, Speed ${localTuning.speed.toFixed(2)}x (${currentAccent.label})`
      );
    }
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 450);
  };

  // Pitch semitone calculation
  const pitchSemitones = (12 * Math.log2(localTuning.pitch)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#101216] border border-white/[0.12] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Panel Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-center text-purple-300 shadow-sm">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-white font-mono">
                  Acoustic Tuning Panel
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-400/30 text-purple-300 bg-purple-400/10">
                  Active Persona
                </span>
              </div>
              <p className="text-xs text-white/50">
                Calibrate voice pitch, speed, and accent for {activePersona.roleTitle}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopVoiceAudio();
              setIsAuditioning(false);
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-white/40 hover:text-white transition-colors"
            title="Close voice settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Active Persona Banner & Gender Toggle */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg border"
                style={{
                  borderColor: `${activePersona.accentColor}50`,
                  backgroundColor: `${activePersona.accentColor}15`,
                }}
              >
                <User className="w-5 h-5 text-white/90" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{activePersona.roleTitle}</span>
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    {activeFlowObj?.name || activePersona.category}
                  </span>
                </div>
                <p className="text-xs text-white/50 leading-tight mt-0.5">
                  Base Tone: {activePersona.voices[localTuning.gender]?.tone}
                </p>
              </div>
            </div>

            {/* Gender Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/[0.08] shrink-0 self-stretch sm:self-auto justify-center">
              <button
                type="button"
                onClick={() => handleGenderChange('female')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  localTuning.gender === 'female'
                    ? 'bg-purple-600/90 text-white font-semibold shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Female ({activePersona.voices.female.name.split(' ')[0]})
              </button>
              <button
                type="button"
                onClick={() => handleGenderChange('male')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  localTuning.gender === 'male'
                    ? 'bg-purple-600/90 text-white font-semibold shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Male ({activePersona.voices.male.name.split(' ')[0]})
              </button>
            </div>
          </div>

          {/* Human Female Sweet Voices Gallery */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-pink-500/[0.06] via-purple-500/[0.03] to-transparent border border-pink-500/25 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌸</span>
                <div>
                  <h3 className="text-xs font-semibold text-white tracking-wide font-mono flex items-center gap-2">
                    Human Female Sweet Voices
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-pink-500/40 text-pink-300 bg-pink-500/10">
                      5 Expressive Profiles
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Warm, velvet, and gentle human female acoustic signatures with high emotional resonance
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SWEET_FEMALE_VOICES.map((sv) => {
                const isSelected = localTuning.voiceId === sv.id;
                const isAudioPlaying = auditioningSweetId === sv.id;
                return (
                  <div
                    key={sv.id}
                    onClick={() => handleSelectSweetVoice(sv)}
                    className={`cursor-pointer text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-pink-500/80 bg-pink-500/15 text-white shadow-md ring-1 ring-pink-500/50'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-pink-400/40 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{sv.flag}</span>
                          <span className="text-xs font-semibold text-white">{sv.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            {sv.badge}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed mb-2.5">
                        {sv.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/40">
                        <span>{sv.pitch}x Pitch</span>
                        <span>•</span>
                        <span>{sv.rate}x Speed</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleAuditionSweetVoice(e, sv)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all ${
                          isAudioPlaying
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/[0.08] hover:bg-pink-500/30 text-white/80 hover:text-pink-200'
                        }`}
                        title="Audition voice sample"
                      >
                        {isAudioPlaying ? (
                          <>
                            <Square className="w-2.5 h-2.5" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accent & Regional Cadence */}
          <div>
            <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              Voice Accent & Character Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
              {ACCENT_OPTIONS.map((acc) => {
                const isSelected = localTuning.accent === acc.id;
                const assignedVoice = acc.voiceMap[localTuning.gender];
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleAccentSelect(acc)}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-purple-500/60 bg-purple-500/10 text-white shadow-md ring-1 ring-purple-500/40'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{acc.flag}</span>
                        <span className="text-xs font-semibold text-white tracking-tight">
                          {acc.label}
                        </span>
                      </div>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-white/30">{acc.region}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                      {acc.description}
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-white/40">
                      <span>Voice: {assignedVoice?.name || 'Assigned'}</span>
                      <span className="text-purple-300/70">ElevenLabs Turbo</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed & Pitch Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {/* Speed / Rate Controller */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/50 flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  Voice Speed (Rate)
                </label>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-amber-300">
                  {localTuning.speed.toFixed(2)}x
                </span>
              </div>

              <div className="relative pt-1">
                <input
                  id="voice-speed-slider"
                  type="range"
                  min="0.70"
                  max="1.40"
                  step="0.05"
                  value={localTuning.speed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1.5">
                  <span>0.70x (Deliberate)</span>
                  <span className="text-white/60">1.00x Normal</span>
                  <span>1.40x (Rapid)</span>
                </div>
              </div>

              {/* Quick speed preset pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '0.85x Deliberate', val: 0.85 },
                  { label: '1.00x Conversational', val: 1.0 },
                  { label: '1.15x Brisk', val: 1.15 },
                  { label: '1.30x Fast', val: 1.3 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handleSpeedChange(p.val)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors ${
                      Math.abs(localTuning.speed - p.val) < 0.02
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch Controller */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/50 flex items-center gap-2">
                  <Music className="w-3.5 h-3.5 text-cyan-400" />
                  Voice Pitch (Frequency)
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/[0.06] text-cyan-300">
                    {localTuning.pitch.toFixed(2)}x
                  </span>
                  <span className="text-[10px] font-mono text-white/40">
                    ({Number(pitchSemitones) > 0 ? `+${pitchSemitones}` : pitchSemitones} st)
                  </span>
                </div>
              </div>

              <div className="relative pt-1">
                <input
                  id="voice-pitch-slider"
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.02"
                  value={localTuning.pitch}
                  onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1.5">
                  <span>0.75x (Deep Base)</span>
                  <span className="text-white/60">1.00x Natural</span>
                  <span>1.35x (Bright)</span>
                </div>
              </div>

              {/* Quick pitch preset pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '0.86x Deep & Low', val: 0.86 },
                  { label: '1.00x Natural', val: 1.0 },
                  { label: '1.12x Bright & Crisp', val: 1.12 },
                  { label: '1.24x Resonant', val: 1.24 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => handlePitchChange(p.val)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors ${
                      Math.abs(localTuning.pitch - p.val) < 0.02
                        ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40'
                        : 'bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audition / Test Synthesis Section */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono tracking-[0.2em] uppercase text-white/50 flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                Live Audition & Synthesis Preview
              </label>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                Sub-300ms Synthesis Egress
              </span>
            </div>

            <div className="relative">
              <textarea
                value={auditionText}
                onChange={(e) => setAuditionText(e.target.value)}
                rows={2}
                maxLength={400}
                className="w-full bg-black/40 border border-white/[0.09] hover:border-white/20 focus:border-purple-500/50 rounded-xl p-3 text-xs text-white/80 font-sans focus:outline-none transition-colors resize-none leading-relaxed"
                placeholder="Enter sample text to test speech synthesis..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="audition-voice-preview-button"
                  onClick={handleToggleAudition}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 transition-all shadow-md ${
                    isAuditioning
                      ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
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
                      <span>Audition Voice Preview</span>
                    </>
                  )}
                </button>

                {isAuditioning && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auditioning...</span>
                  </div>
                )}
              </div>

              <span className="text-[10px] font-mono text-white/40">
                Voice ID: <code className="text-white/60">{localTuning.voiceId.slice(0, 8)}...</code>
              </span>
            </div>
          </div>
        </div>

        {/* Panel Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between bg-white/[0.02] gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-xs font-mono text-white/50 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] flex items-center gap-1.5 transition-colors"
            title="Revert to calibrated default pitch and speed for active persona"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset to Baseline</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                stopVoiceAudio();
                setIsAuditioning(false);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              id="apply-voice-settings-button"
              onClick={handleApply}
              className={`px-5 py-2 rounded-xl text-xs font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                isSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#f4f1eb] hover:bg-white text-[#0b0c0e]'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Apply to Session</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
