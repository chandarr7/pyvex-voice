import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Sparkles,
  ArrowRight,
  Volume2,
  Sliders,
  Radio,
} from 'lucide-react';
import { Persona, PYVEX_PERSONAS } from '../data/personas';
import { playVoiceAudio, stopVoiceAudio } from '../utils/audioEngine';
import { DynamicAudioVisualizer } from './DynamicAudioVisualizer';
import { ConversationTestSimulator, VoiceTestDraftConfig } from './ConversationTestSimulator';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';
import { PersonaVoiceTuning } from '../types';

interface HeroCarouselProps {
  onOpenStudio: () => void;
  onBookDemo: () => void;
  onSelectPersona?: (personaId: string) => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  onOpenStudio,
  onBookDemo,
  onSelectPersona,
}) => {
  const [currentIndex] = useState(0);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTestAgentActive, setIsTestAgentActive] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isVoiceTuningOpen, setIsVoiceTuningOpen] = useState(false);
  const [, setActiveDraft] = useState<VoiceTestDraftConfig | null>(null);

  const activePersona: Persona = PYVEX_PERSONAS[currentIndex];
  const nextPersona: Persona = PYVEX_PERSONAS[(currentIndex + 1) % PYVEX_PERSONAS.length];
  const activeVoice = activePersona.voices[selectedGender];

  const [voiceTuning, setVoiceTuning] = useState<PersonaVoiceTuning>({
    pitch: activeVoice.pitch || 1.0,
    speed: activeVoice.rate || 1.0,
    accent: 'neutral',
    voiceId: activeVoice.elevenLabsId,
    gender: selectedGender,
  });

  // Synchronize voice tuning if active voice changes
  useEffect(() => {
    setVoiceTuning((prev) => ({
      ...prev,
      voiceId: prev.voiceId || activeVoice.elevenLabsId,
      gender: selectedGender,
    }));
  }, [activeVoice.elevenLabsId, selectedGender]);

  // Parallax and 3D tilt tracking for stacked cards deck
  const deckRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({
    rotateX: 0,
    rotateY: 0,
    translateX: 0,
    translateY: 0,
    glareX: 50,
    glareY: 50,
    isHovered: false,
  });

  const handleDeckMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!deckRef.current) return;
    const rect = deckRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Normalised center coordinates from -1 to 1
    const cx = (x - 0.5) * 2;
    const cy = (y - 0.5) * 2;

    // Smooth subtle tilt (-6.5deg to +6.5deg) and slight translation (±6px)
    setTilt({
      rotateX: -cy * 6.5,
      rotateY: cx * 6.5,
      translateX: cx * 6,
      translateY: cy * 6,
      glareX: Math.max(0, Math.min(100, x * 100)),
      glareY: Math.max(0, Math.min(100, y * 100)),
      isHovered: true,
    });
  };

  const handleDeckMouseEnter = () => {
    setTilt((prev) => ({ ...prev, isHovered: true }));
  };

  const handleDeckMouseLeave = () => {
    // Smooth reset to neutral position on cursor leave
    setTilt({
      rotateX: 0,
      rotateY: 0,
      translateX: 0,
      translateY: 0,
      glareX: 50,
      glareY: 50,
      isHovered: false,
    });
  };

  const handleToggleVoicePlay = () => {
    stopVoiceAudio();
    setIsPlaying(false);
    setIsTestAgentActive(false);
    setIsSimulatorOpen(true);
  };

  const handleToggleCardAudio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stopVoiceAudio();
      setIsPlaying(false);
      return;
    }

    stopVoiceAudio();
    setIsPlaying(true);
    await playVoiceAudio({
      text: activeVoice.sampleScript,
      voiceId: voiceTuning.voiceId || activeVoice.elevenLabsId,
      gender: selectedGender,
      pitch: voiceTuning.pitch,
      rate: voiceTuning.speed,
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
    });
  };

  // Notify parent if persona changes
  useEffect(() => {
    if (onSelectPersona) {
      onSelectPersona(activePersona.id);
    }
  }, [activePersona, onSelectPersona]);

  return (
    <section className="relative w-full max-w-7xl mx-auto px-6 lg:px-12 pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background ambient radial glow */}
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[750px] h-[450px] blur-3xl pointer-events-none rounded-full -z-10"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(112, 71, 255, 0.16), transparent 70%)',
        }}
      />

      {/* Main Hero Grid: Left Column & Right Glassmorphic Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
        {/* ================= HERO LEFT COLUMN ================= */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-7">
          {/* Status Badge: Rounded badge with glowing green dot (#20E99A) */}
          <div
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wider text-[#F4F2F8] w-fit"
            style={{
              background: '#12141A',
              border: '1px solid #34365C',
            }}
          >
            <span
              className="w-2 h-2 rounded-full shadow-[0_0_8px_#20E99A] animate-pulse"
              style={{ backgroundColor: '#20E99A' }}
            />
            <span>PYVEX ENGINE V2.5 LIVE</span>
          </div>

          {/* Headline: Bold, high-contrast typography */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-sans tracking-tight text-[#F4F2F8] leading-[1.12]">
              The Real-Time Voice Infrastructure for Enterprise AI.
            </h1>

            {/* Subheadline: Highlighted in electric purple (#9655FF) */}
            <p
              className="text-base sm:text-lg font-sans leading-relaxed font-medium max-w-xl"
              style={{ color: '#9655FF' }}
            >
              Hyper-realistic voice agents that adapt tone, voice, and industry context in sub-300ms.
            </p>
          </div>

          {/* Metrics Bar: Horizontal container displaying stats separated by muted dividers */}
          <div
            className="w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl font-mono"
            style={{
              background: '#0D0F13',
              border: '1px solid #292B3A',
            }}
          >
            <div className="flex-1 text-left pl-2">
              <div className="text-base sm:text-xl font-bold text-[#F4F2F8] tracking-tight">
                1,500,000+
              </div>
              <div className="text-[10px] sm:text-xs text-[#A4A3B2] uppercase tracking-wider mt-0.5">
                Sessions
              </div>
            </div>

            <div className="h-9 w-px bg-[#292B3A]" />

            <div className="flex-1 text-center">
              <div className="text-base sm:text-xl font-bold text-[#F4F2F8] tracking-tight">
                &lt;300ms
              </div>
              <div className="text-[10px] sm:text-xs text-[#A4A3B2] uppercase tracking-wider mt-0.5">
                Latency
              </div>
            </div>

            <div className="h-9 w-px bg-[#292B3A]" />

            <div className="flex-1 text-right pr-2">
              <div
                className="text-base sm:text-xl font-bold tracking-tight"
                style={{
                  color: '#20E99A',
                  textShadow: '0 0 10px rgba(32, 233, 154, 0.4)',
                }}
              >
                99.99%
              </div>
              <div
                className="text-[10px] sm:text-xs uppercase tracking-wider mt-0.5"
                style={{ color: '#20E99A', opacity: 0.85 }}
              >
                Uptime
              </div>
            </div>
          </div>

          {/* CTAs: Primary pill button "Build in Studio" + Secondary outline button "Book Enterprise Demo" */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              id="hero-build-studio-button"
              onClick={onOpenStudio}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F2F8] transition-all duration-300 shadow-[0_4px_20px_rgba(112,71,255,0.4)] hover:shadow-[0_4px_28px_rgba(132,92,255,0.6)] active:scale-95"
              style={{
                backgroundColor: '#7047FF',
              }}
            >
              <Sparkles className="w-4 h-4 text-[#F4F2F8]" />
              <span>Build in Studio</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#F4F2F8]/70 ml-1" />
            </button>

            <button
              id="hero-book-demo-button"
              onClick={onBookDemo}
              className="flex items-center gap-2 px-6 py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold text-[#F4F2F8] transition-all hover:bg-[#1C1D25] hover:border-[#34365C] active:scale-95"
              style={{
                background: '#12141A',
                border: '1px solid #292B3A',
              }}
            >
              <span>Book Enterprise Demo</span>
            </button>
          </div>

          {/* Voice Tuning Calibration Trigger (Clean Outside Launcher) */}
          <div className="pt-2">
            <button
              id="hero-voice-tuning-calibration-button"
              type="button"
              onClick={() => setIsVoiceTuningOpen(true)}
              className="w-full p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between group cursor-pointer shadow-lg hover:shadow-[0_0_24px_rgba(112,71,255,0.25)] hover:border-[#845CFF]/60"
              style={{
                background: 'linear-gradient(135deg, #12141A 0%, #171924 100%)',
                border: '1px solid #292B3A',
              }}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#845CFF]/15 border border-[#845CFF]/30 flex items-center justify-center text-[#A78BFA] group-hover:scale-105 group-hover:border-[#845CFF]/60 transition-all shadow-[0_0_12px_rgba(132,92,255,0.2)]">
                  <Sliders className="w-5 h-5 text-[#845CFF]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider font-bold text-[#F4F2F8]">
                      Voice Tuning Calibration
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-purple-500/40 text-purple-300 bg-purple-500/15 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#845CFF] animate-pulse" />
                      Acoustic Studio
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A4A3B2] mt-0.5 font-sans">
                    Fine-tune pitch ({voiceTuning.pitch.toFixed(2)}x), speed ({voiceTuning.speed.toFixed(2)}x), regional accents &amp; human sweet voice signatures
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-[#845CFF] group-hover:text-[#A78BFA] transition-colors">
                <span className="hidden sm:inline text-[11px] font-semibold">Calibrate</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>

        {/* ================= HERO RIGHT COLUMN (GLASSMORPHIC DECK) ================= */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div
            ref={deckRef}
            onMouseMove={handleDeckMouseMove}
            onMouseEnter={handleDeckMouseEnter}
            onMouseLeave={handleDeckMouseLeave}
            className="relative w-full max-w-lg mx-auto py-2 group select-none"
            style={{
              perspective: '1200px',
            }}
          >
            {/* Tertiary background stacked card (3rd depth layer) with counter-parallax */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
              style={{
                background: '#0D0E13',
                border: '1px solid #232534',
                boxShadow: tilt.isHovered
                  ? '0 30px 55px rgba(0,0,0,0.85), 0 0 25px rgba(112,71,255,0.1)'
                  : '0 20px 40px rgba(0,0,0,0.7)',
                transform: tilt.isHovered
                  ? `rotate(${-4 + tilt.rotateY * 0.25}deg) scale(0.95) translate3d(${tilt.translateX * -1.6}px, ${tilt.translateY * -1.6}px, -45px)`
                  : 'rotate(-4deg) scale(0.95) translate3d(0, 0, -45px)',
                transition: tilt.isHovered
                  ? 'transform 0.12s ease-out, box-shadow 0.3s ease, opacity 0.3s ease'
                  : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s ease, opacity 0.6s ease',
                zIndex: 1,
                opacity: tilt.isHovered ? 0.55 : 0.35,
              }}
            />

            {/* Secondary card layered behind tilted at a subtle 6-degree angle with dynamic counter-parallax */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
              style={{
                background: '#171820',
                border: tilt.isHovered ? '1px solid #3D4068' : '1px solid #34365C',
                boxShadow: tilt.isHovered
                  ? '0 25px 45px rgba(0,0,0,0.8), 0 0 25px rgba(36,216,237,0.15)'
                  : '0 15px 35px rgba(0,0,0,0.6)',
                transform: tilt.isHovered
                  ? `rotate(${6 + tilt.rotateY * 0.4}deg) scale(0.98) translate3d(${tilt.translateX * -0.9}px, ${tilt.translateY * -0.9}px, -15px)`
                  : 'rotate(6deg) scale(0.98) translate3d(0, 0, 0)',
                transition: tilt.isHovered
                  ? 'transform 0.1s ease-out, box-shadow 0.3s ease, border-color 0.3s ease'
                  : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s ease, border-color 0.6s ease',
                zIndex: 2,
                opacity: tilt.isHovered ? 0.88 : 0.75,
              }}
            >
              <div className="p-6 sm:p-7 space-y-4 opacity-40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider"
                      style={{
                        color: '#24D8ED',
                        background: 'rgba(36, 216, 237, 0.1)',
                        border: '1px solid rgba(36, 216, 237, 0.3)',
                      }}
                    >
                      {nextPersona.category}
                    </span>
                    {/* Pill-shaped tag indicating Voice Model provider on background card */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-medium border ${
                        nextPersona.voiceProvider === 'ElevenLabs'
                          ? 'border-[#845CFF]/40 bg-[#845CFF]/15 text-[#D8B4FE]'
                          : 'border-[#24D8ED]/40 bg-[#24D8ED]/15 text-[#67E8F9]'
                      }`}
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          nextPersona.voiceProvider === 'ElevenLabs' ? 'bg-[#845CFF]' : 'bg-[#24D8ED]'
                        }`}
                      />
                      <span>{nextPersona.voiceProvider}</span>
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#666879]">NEXT AGENT</span>
                </div>
                <div className="text-lg font-bold font-sans text-[#F4F2F8] truncate">
                  {nextPersona.roleTitle}
                </div>
                <div className="h-28 w-full bg-[#08090B] rounded-2xl border border-[#292B3A]/60" />
              </div>
            </div>

            {/* Primary Glassmorphic Card with interactive 3D parallax tilt & specular reflection */}
            <div
              className="relative rounded-3xl p-6 sm:p-7 backdrop-blur-xl space-y-5 overflow-hidden"
              style={{
                background: 'linear-gradient(155deg, #1C1D25 0%, #171820 100%)',
                border: tilt.isHovered
                  ? '1px solid rgba(132, 92, 255, 0.65)'
                  : '1px solid #34365C',
                boxShadow: tilt.isHovered
                  ? '0 32px 70px -10px rgba(0,0,0,0.92), 0 0 35px rgba(112, 71, 255, 0.32)'
                  : '0 20px 30px rgba(0,0,0,0.8)',
                transform: tilt.isHovered
                  ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translate3d(${tilt.translateX}px, ${tilt.translateY}px, 20px)`
                  : 'rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)',
                transition: tilt.isHovered
                  ? 'transform 0.08s ease-out, border-color 0.25s ease, box-shadow 0.25s ease'
                  : 'transform 0.65s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.5s ease, box-shadow 0.5s ease',
                transformStyle: 'preserve-3d',
                zIndex: 10,
              }}
            >
              {/* Dynamic specular glass reflection overlay following mouse cursor tilt */}
              <div
                className="absolute inset-0 pointer-events-none rounded-3xl transition-opacity duration-300 z-30"
                style={{
                  opacity: tilt.isHovered ? 1 : 0,
                  background: `radial-gradient(circle 420px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, 0.12), rgba(132, 92, 255, 0.05) 45%, transparent 75%)`,
                  mixBlendMode: 'overlay',
                }}
              />
              {/* Card Header: Category Badge, Voice Model Provider Pill Tag & Carousel Switchers */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Badge in Cyan (#24D8ED): ENTERPRISE B2B */}
                    <span
                      className="inline-block px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider"
                      style={{
                        color: '#24D8ED',
                        background: 'rgba(36, 216, 237, 0.1)',
                        border: '1px solid rgba(36, 216, 237, 0.3)',
                      }}
                    >
                      {activePersona.category}
                    </span>

                    {/* Pill-shaped tag indicating the 'Voice Model' provider (e.g., ElevenLabs, Cartesia) */}
                    <div
                      id={`voice-model-pill-${activePersona.id}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold tracking-wide border shadow-sm ${
                        activePersona.voiceProvider === 'ElevenLabs'
                          ? 'border-[#845CFF]/50 bg-[#845CFF]/15 text-[#D8B4FE]'
                          : 'border-[#24D8ED]/50 bg-[#24D8ED]/15 text-[#67E8F9]'
                      }`}
                      title={`Voice Model Provider: ${activePersona.voiceProvider} (${activePersona.voiceModel})`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          activePersona.voiceProvider === 'ElevenLabs'
                            ? 'bg-[#845CFF] shadow-[0_0_8px_#845CFF]'
                            : 'bg-[#24D8ED] shadow-[0_0_8px_#24D8ED]'
                        }`}
                      />
                      <span className="text-[#A4A3B2] font-normal">Voice Model:</span>
                      <span className="font-bold text-[#F4F2F8]">{activePersona.voiceProvider}</span>
                      <span className="text-[9px] opacity-75">({activePersona.voiceModel})</span>
                    </div>
                  </div>

                  {/* Title: Inbound Sales SDR Agent */}
                  <h3 className="text-xl sm:text-2xl font-bold font-sans text-[#F4F2F8] tracking-tight">
                    {activePersona.roleTitle}
                  </h3>
                </div>

                {/* Real-time Acoustic Engine Badge */}
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border border-[#292B3A] bg-[#12141A] text-[#A4A3B2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20E99A] animate-pulse" />
                    <span>Real-Time Synthesizer</span>
                  </span>
                </div>
              </div>

              {/* Active Voice Acoustic Profile Status */}
              <div
                className="p-3 rounded-xl flex items-center justify-between text-xs font-mono"
                style={{
                  background: '#0D0F13',
                  border: '1px solid #292B3A',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#20E99A] shadow-[0_0_8px_#20E99A]" />
                  <span className="text-[#A4A3B2] text-[11px]">Active Voice Profile:</span>
                  <span className="text-[#F4F2F8] font-semibold text-[11px] truncate max-w-[170px] sm:max-w-[220px]">
                    {activeVoice.name}
                  </span>
                </div>
                <button
                  type="button"
                  id="card-open-calibration-btn"
                  onClick={() => setIsVoiceTuningOpen(true)}
                  className="px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                  title="Open Voice Tuning Calibration"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Calibrate</span>
                </button>
              </div>

              {/* Audio Waveform Box: Dark inset box (#08090B) housing an animated bar-visualizer using alternating heights and color accents (#845CFF, #9655FF, #24D8ED) */}
              <div
                className="rounded-2xl p-4 space-y-3 transition-transform duration-300"
                style={{
                  background: '#08090B',
                  border: '1px solid #292B3A',
                  transform: tilt.isHovered ? 'translateZ(10px)' : 'translateZ(0px)',
                }}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#A4A3B2]">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Volume2 className="w-3.5 h-3.5 text-[#9655FF]" />
                    <span>Acoustic Waveform Visualizer</span>
                  </span>
                  <span
                    className="font-semibold text-[10px]"
                    style={{ color: isPlaying || isTestAgentActive ? '#20E99A' : '#666879' }}
                  >
                    {isPlaying
                      ? 'STREAMING 24kHz'
                      : isTestAgentActive
                      ? 'MIC ACTIVE'
                      : 'STANDBY'}
                  </span>
                </div>

                {/* Animated bar-visualizer with alternating heights and color accents (#845CFF, #9655FF, #24D8ED) */}
                <div className="flex items-center justify-between gap-1 h-10 px-1">
                  {[
                    { h: '55%', c: '#845CFF', anim: 'animate-acoustic-1' },
                    { h: '85%', c: '#9655FF', anim: 'animate-acoustic-3' },
                    { h: '40%', c: '#24D8ED', anim: 'animate-acoustic-2' },
                    { h: '95%', c: '#845CFF', anim: 'animate-acoustic-4' },
                    { h: '70%', c: '#9655FF', anim: 'animate-acoustic-5' },
                    { h: '50%', c: '#24D8ED', anim: 'animate-acoustic-2' },
                    { h: '80%', c: '#845CFF', anim: 'animate-acoustic-3' },
                    { h: '100%', c: '#9655FF', anim: 'animate-acoustic-1' },
                    { h: '65%', c: '#24D8ED', anim: 'animate-acoustic-4' },
                    { h: '45%', c: '#845CFF', anim: 'animate-acoustic-2' },
                    { h: '90%', c: '#9655FF', anim: 'animate-acoustic-5' },
                    { h: '75%', c: '#24D8ED', anim: 'animate-acoustic-3' },
                    { h: '55%', c: '#845CFF', anim: 'animate-acoustic-1' },
                    { h: '85%', c: '#9655FF', anim: 'animate-acoustic-4' },
                  ].map((bar, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-300 ${
                        isPlaying || isTestAgentActive ? bar.anim : 'opacity-25'
                      }`}
                      style={{
                        height: isPlaying || isTestAgentActive ? bar.h : '25%',
                        backgroundColor: bar.c,
                        boxShadow:
                          isPlaying || isTestAgentActive
                            ? `0 0 8px ${bar.c}`
                            : 'none',
                      }}
                    />
                  ))}
                </div>

                {/* Dynamic Canvas-based visualizer for real-time microphone input levels */}
                <DynamicAudioVisualizer
                  isActive={isTestAgentActive || isPlaying}
                  className="mt-2"
                />
              </div>

              {/* Sample Dialog Script Excerpt */}
              <div
                className="p-3.5 rounded-xl text-xs font-sans text-[#A4A3B2] italic leading-relaxed flex items-start justify-between gap-3"
                style={{
                  background: '#12141A',
                  border: '1px solid #292B3A',
                }}
              >
                <div className="flex-1">
                  &quot;{activeVoice.sampleScript}&quot;
                </div>
                <button
                  type="button"
                  id={`card-audition-btn-${activePersona.id}`}
                  onClick={handleToggleCardAudio}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-semibold flex items-center gap-1.5 transition-all ${
                    isPlaying
                      ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                      : 'bg-[#7047FF]/20 hover:bg-[#7047FF]/30 text-[#845CFF] hover:text-white border border-[#7047FF]/40'
                  }`}
                  title={isPlaying ? 'Stop Voice Audition' : 'Instant Voice Audition'}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Audition</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Button: Full-width glowing pill button "▶ TEST PYVEX VOICE" */}
              <button
                type="button"
                id="test-agent-voice-button"
                onClick={handleToggleVoicePlay}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-full text-xs font-mono uppercase tracking-widest font-bold text-[#F4F2F8] transition-all duration-300 active:scale-98 shadow-[0_4px_20px_rgba(112,71,255,0.4)] hover:shadow-[0_4px_28px_rgba(132,92,255,0.6)] hover:brightness-110"
                style={{
                  background: 'linear-gradient(90deg, #7047FF, #9655FF)',
                  transform: tilt.isHovered ? 'translateZ(14px)' : 'translateZ(0px)',
                }}
              >
                <Radio className="w-4 h-4 text-[#20E99A] animate-pulse" />
                <span>▶ TEST PYVEX VOICE (LIVE SIMULATOR)</span>
              </button>
            </div>

            {/* Subtle 3D Glass Deck interaction status pill */}
            <div
              className="mt-3 flex items-center justify-center gap-2 text-[10px] font-mono text-[#666879] transition-all duration-300"
              style={{
                opacity: tilt.isHovered ? 0.95 : 0.4,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: tilt.isHovered ? '#845CFF' : '#494A5C',
                  boxShadow: tilt.isHovered ? '0 0 8px #845CFF' : 'none',
                }}
              />
              <span>
                {tilt.isHovered
                  ? `3D Glass Deck Active (${Math.round(tilt.rotateX)}° / ${Math.round(tilt.rotateY)}° tilt)`
                  : 'Interactive 3D Deck • Hover to Tilt'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Conversation Test Simulator Modal */}
      <ConversationTestSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        initialVoiceId={voiceTuning.voiceId || activeVoice.elevenLabsId}
        initialGender={selectedGender}
        initialFlow={activePersona.id}
        onPersistDraft={(draft) => {
          setActiveDraft(draft);
          if (draft.voiceId) {
            setVoiceTuning((prev) => ({
              ...prev,
              voiceId: draft.voiceId,
              gender: draft.gender,
              pitch: draft.pitch,
              speed: draft.rate,
            }));
            setSelectedGender(draft.gender);
          }
        }}
      />

      {/* Voice Tuning Calibration Modal */}
      <VoiceSettingsPanel
        isOpen={isVoiceTuningOpen}
        onClose={() => setIsVoiceTuningOpen(false)}
        activeFlowId={activePersona.id}
        tuning={voiceTuning}
        onUpdateTuning={(newTuning) => {
          setVoiceTuning(newTuning);
          setSelectedGender(newTuning.gender);
        }}
      />
    </section>
  );
};
export default HeroCarousel;
