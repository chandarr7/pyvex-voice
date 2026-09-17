import React, { useState } from 'react';
import { Mic, MicOff, ArrowUp, Volume2, VolumeX, Activity, AlertCircle, Play } from 'lucide-react';

interface VoiceControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  ttsAudioEnabled: boolean;
  micEnergy?: number;
  isVadSpeaking?: boolean;
  autoplayBlocked?: boolean;
  onUnlockAutoplay?: () => void;
  onOpenTriage?: () => void;
  onToggleMic: () => void;
  onToggleTtsAudio: () => void;
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isListening,
  isSpeaking,
  ttsAudioEnabled,
  micEnergy = 0,
  isVadSpeaking = false,
  autoplayBlocked = false,
  onUnlockAutoplay,
  onOpenTriage,
  onToggleMic,
  onToggleTtsAudio,
  onSendMessage,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="bg-[#121316]/90 border border-white/[0.08] rounded-2xl p-5 shadow-2xl backdrop-blur-xl transition-all flex flex-col gap-3">
      {/* Autoplay blocked banner */}
      {autoplayBlocked && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-mono animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Browser autoplay blocked audio output. Click to enable speech playback.</span>
          </div>
          <button
            onClick={onUnlockAutoplay}
            className="px-3 py-1 rounded-full bg-amber-400 text-black font-semibold uppercase text-[10px] tracking-wider hover:bg-amber-300 transition-colors shrink-0 flex items-center gap-1"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Unblock Audio</span>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Master Acoustic Trigger Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <span
                className={`absolute rounded-full border pointer-events-none transition-all duration-150 ${
                  isVadSpeaking
                    ? 'w-20 h-20 border-emerald-400/60 bg-emerald-400/10 animate-ping'
                    : 'w-16 h-16 border-amber-400/40 animate-ring-expand'
                }`}
              />
            )}

            <button
              id="voice-mic-button"
              type="button"
              onClick={onToggleMic}
              disabled={disabled}
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-md ${
                isListening
                  ? isVadSpeaking
                    ? 'bg-emerald-400 text-[#0b0c0e] shadow-[0_0_28px_rgba(52,211,153,0.5)]'
                    : 'bg-amber-400 text-[#0b0c0e] shadow-[0_0_24px_rgba(251,191,36,0.35)]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/15 hover:border-white/30 text-white'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={isListening ? 'Halt Microphone Ingress' : 'Activate Microphone Ingress'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5 text-[#0b0c0e]" />
              ) : (
                <Mic className="w-5 h-5 text-white/90" />
              )}
            </button>
          </div>

          {/* Precision Live RMS Level Meter & VAD State */}
          <div className="flex flex-col gap-1 min-w-[72px]">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  isListening
                    ? isVadSpeaking
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                    : isSpeaking
                    ? 'bg-purple-400 animate-pulse'
                    : 'bg-white/20'
                }`}
              />
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">
                {isListening ? (isVadSpeaking ? 'Speaking' : 'Listening') : isSpeaking ? 'Egress' : 'Idle'}
              </span>
            </div>

            {/* RMS Energy bar */}
            {isListening ? (
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${Math.min(100, Math.max(8, micEnergy))}%`,
                    backgroundColor: isVadSpeaking ? '#34d399' : '#fbbf24',
                  }}
                />
              </div>
            ) : (
              <div className="w-16 h-1.5 rounded-full bg-white/5" />
            )}
          </div>

          {/* Mute Audio Playback */}
          <button
            id="toggle-tts-audio-button"
            type="button"
            onClick={onToggleTtsAudio}
            className={`p-2.5 rounded-full border transition-all active:scale-95 ${
              ttsAudioEnabled
                ? 'border-white/10 hover:border-white/25 bg-white/[0.02] text-white/60 hover:text-white'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            }`}
            title={ttsAudioEnabled ? 'Mute Speech Synthesis Audio' : 'Unmute Speech Synthesis Audio'}
          >
            {ttsAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Quick Triage Audit Trigger */}
          {onOpenTriage && (
            <button
              id="open-pipeline-triage-button"
              type="button"
              onClick={onOpenTriage}
              className="p-2.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-all active:scale-95"
              title="Open 5-Layer Pipeline Diagnostic Triage"
            >
              <Activity className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Minimalist Command & Query Input */}
        <form onSubmit={handleFormSubmit} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <input
              type="text"
              id="chat-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening to your voice... or type here..." : "Utter command verbally, or compose here..."}
              disabled={disabled}
              className="w-full bg-[#181a1f]/80 border border-white/[0.08] hover:border-white/20 focus:border-white/40 rounded-full px-5 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            id="send-message-button"
            disabled={disabled || !inputText.trim()}
            className="w-11 h-11 rounded-full bg-[#f4f1eb] hover:bg-white text-[#0b0c0e] flex items-center justify-center transition-all duration-200 disabled:opacity-20 disabled:hover:bg-[#f4f1eb] active:scale-95 shrink-0 shadow-sm"
            title="Dispatch Message"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

