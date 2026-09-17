import React, { useState } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface VoiceControlsProps {
  isListening: boolean;
  isSpeaking: boolean;
  ttsAudioEnabled: boolean;
  onToggleMic: () => void;
  onToggleTtsAudio: () => void;
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isListening,
  isSpeaking,
  ttsAudioEnabled,
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
    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Main Microphone Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
          <button
            id="voice-mic-button"
            type="button"
            onClick={onToggleMic}
            disabled={disabled}
            className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? 'bg-rose-500 text-white ring-4 ring-rose-500/30 shadow-lg shadow-rose-500/30'
                : 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white hover:brightness-110 shadow-lg shadow-cyan-500/20'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={isListening ? 'Click to pause microphone' : 'Click to speak'}
          >
            {isListening ? (
              <>
                <MicOff className="w-6 h-6 animate-pulse" />
                <span className="absolute -inset-1 rounded-full border-2 border-rose-400 animate-ping opacity-75 pointer-events-none" />
              </>
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          {/* Voice Waveform Animation when listening or speaking */}
          <div className="flex items-center gap-1 h-8 px-2">
            {isListening ? (
              <>
                <div className="w-1 bg-cyan-400 rounded-full animate-wave-1" />
                <div className="w-1 bg-cyan-400 rounded-full animate-wave-2" />
                <div className="w-1 bg-cyan-400 rounded-full animate-wave-3" />
                <div className="w-1 bg-cyan-400 rounded-full animate-wave-4" />
                <div className="w-1 bg-cyan-400 rounded-full animate-wave-5" />
              </>
            ) : isSpeaking ? (
              <>
                <div className="w-1 bg-purple-400 rounded-full animate-wave-2" />
                <div className="w-1 bg-purple-400 rounded-full animate-wave-4" />
                <div className="w-1 bg-purple-400 rounded-full animate-wave-1" />
                <div className="w-1 bg-purple-400 rounded-full animate-wave-5" />
                <div className="w-1 bg-purple-400 rounded-full animate-wave-3" />
              </>
            ) : (
              <span className="text-xs text-zinc-500 font-medium">Mic idle</span>
            )}
          </div>

          {/* Audio Output Mute / Unmute Toggle */}
          <button
            id="toggle-tts-audio-button"
            type="button"
            onClick={onToggleTtsAudio}
            className={`p-2.5 rounded-xl border transition-colors ${
              ttsAudioEnabled
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
            title={ttsAudioEnabled ? 'Mute Speech Synthesis Audio' : 'Unmute Speech Synthesis Audio'}
          >
            {ttsAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* Text Prompt Input Bar fallback */}
        <form onSubmit={handleFormSubmit} className="flex-1 flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <input
              type="text"
              id="chat-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or type a message to the agent..."
              disabled={disabled}
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            id="send-message-button"
            disabled={disabled || !inputText.trim()}
            className="px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:hover:bg-cyan-600 flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
