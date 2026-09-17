import React, { useRef, useEffect } from 'react';
import { Bot, User, Volume2, Sparkles, AlertCircle } from 'lucide-react';
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
    <div className="flex flex-col flex-1 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl min-h-[420px]">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-zinc-200">Conversation Stream</h2>
        </div>

        {isSpeaking && (
          <button
            id="interrupt-bot-button"
            onClick={onInterrupt}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Interrupt Bot
          </button>
        )}
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 && !interimTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Bot className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-400">Pipeline is initialized & ready</p>
            <p className="text-xs max-w-sm mt-1">
              Tap the microphone or choose a quick prompt below to start speaking with the voice bot.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-br-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] mb-1 opacity-75">
                  <span className="font-medium">{isUser ? 'You' : 'Pyvex Assistant'}</span>
                  {msg.latencyMs && (
                    <span className="font-mono text-[10px]">{msg.latencyMs}ms</span>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Real-time Interim speech recognition bubble */}
        {interimTranscript && (
          <div className="flex items-start gap-3 justify-end">
            <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl rounded-br-none px-4 py-3 text-sm bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 animate-pulse">
              <div className="text-[11px] font-medium text-cyan-400 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Transcribing in real time...
              </div>
              <p className="italic">{interimTranscript}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-cyan-900/40 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0">
              <User className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && !interimTranscript && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
              </div>
              <span className="text-xs text-zinc-400">Synthesizing LLM turn...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts footer */}
      {suggestedPrompts.length > 0 && (
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Suggested Turns:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(prompt)}
                className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors shrink-0"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
