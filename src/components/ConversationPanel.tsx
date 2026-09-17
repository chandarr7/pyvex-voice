import React, { useRef, useEffect } from 'react';
import { Volume2, Sparkles, XCircle, CornerDownLeft } from 'lucide-react';
import { ChatMessage } from '../types';

interface ConversationPanelProps {
  messages: ChatMessage[];
  interimTranscript: string;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  suggestedPrompts: string[];
  onSelectPrompt: (prompt: string) => void;
  onInterrupt: () => void;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  interimTranscript,
  isListening,
  isSpeaking,
  isProcessing,
  suggestedPrompts,
  onSelectPrompt,
  onInterrupt,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript, isProcessing]);

  return (
    <div className="flex flex-col flex-1 bg-[#121316]/70 border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl min-h-[460px]">
      {/* Panel Top Bar */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.015]">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-white/70">
            Acoustic Dialogue Transcript
          </h2>
          <span className="text-[10px] font-mono text-white/30">
            • {messages.length} utterances
          </span>
        </div>

        {/* Barge-in / Interruption Control */}
        {isSpeaking && (
          <button
            id="interrupt-bot-button"
            onClick={onInterrupt}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono uppercase tracking-wider bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all active:scale-[0.97]"
          >
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>Barge In</span>
          </button>
        )}
      </div>

      {/* Message Stream */}
      <div ref={scrollRef} className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
        {messages.length === 0 && !interimTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/40 my-auto">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-4 text-white/50">
              <Volume2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-serif italic text-white/80">
              Awaiting Voice Ingress
            </h3>
            <p className="text-xs text-white/40 max-w-sm mt-1.5 font-sans leading-relaxed">
              Press the acoustic trigger below or utter a prompt to initiate real-time conversational synthesis.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} transition-all duration-300`}
            >
              <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-white/35 px-1">
                <span className="uppercase tracking-widest">{isUser ? 'Human Voice' : 'Pyvex Agent'}</span>
                {msg.latencyMs && (
                  <>
                    <span>•</span>
                    <span>{msg.latencyMs}ms latency</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 transition-all duration-200 ${
                  isUser
                    ? 'bg-white/[0.08] border border-white/[0.12] text-white shadow-sm'
                    : 'bg-[#181a1f]/90 border border-white/[0.07] text-[#ece7de] shadow-inner'
                }`}
              >
                <p className={`text-sm leading-relaxed ${!isUser ? 'font-sans text-[14.5px] font-normal tracking-wide' : 'font-sans'}`}>
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}

        {/* Real-time Interim Streaming Transcript */}
        {interimTranscript && (
          <div className="flex flex-col items-end animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-amber-400/70 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span className="uppercase tracking-widest">Streaming Input</span>
            </div>
            <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 bg-white/[0.04] border border-amber-400/30 text-white/90">
              <p className="text-sm italic font-serif leading-relaxed text-amber-100/90">
                "{interimTranscript}"
              </p>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && !interimTranscript && (
          <div className="flex flex-col items-start animate-fade-in">
            <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-white/35 px-1">
              <span className="uppercase tracking-widest">Reasoning & Synthesizing</span>
            </div>
            <div className="bg-[#181a1f]/90 border border-white/[0.07] rounded-2xl px-5 py-3.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
              </div>
              <span className="text-xs font-mono text-white/50">Processing speech turn...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Turns Carousel */}
      {suggestedPrompts.length > 0 && (
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">
            <Sparkles className="w-3 h-3 text-amber-400/80" />
            <span>Suggested Utterances</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(prompt)}
                className="whitespace-nowrap text-xs px-3.5 py-1.5 rounded-full border border-white/[0.08] hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.06] text-white/70 hover:text-white transition-all text-left flex items-center gap-1.5"
              >
                <span>{prompt}</span>
                <CornerDownLeft className="w-2.5 h-2.5 text-white/30" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
