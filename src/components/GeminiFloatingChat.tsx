import React, { useState } from 'react';
import { Bot, X, Sparkles, MessageSquare } from 'lucide-react';
import { GeminiChatbot } from './GeminiChatbot';

export const GeminiFloatingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Floating Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 sm:w-[480px] sm:max-w-[calc(100vw-32px)] z-50 animate-fadeIn flex flex-col">
          {/* Backdrop on mobile */}
          <div
            className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 w-full flex flex-col h-full sm:h-auto">
            {/* Header bar on mobile with close button */}
            <div className="sm:hidden flex items-center justify-between p-3 bg-[#12141A] border-b border-[#292B3A] text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#845CFF]" />
                <span className="text-xs font-mono font-bold">Gemini Conversational Agent</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-[#A4A3B2] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <GeminiChatbot isCompact={true} onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        id="gemini-floating-chat-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2 px-4 py-3.5 rounded-full text-xs font-mono font-semibold text-[#F4F2F8] shadow-[0_6px_25px_rgba(112,71,255,0.45)] hover:shadow-[0_8px_35px_rgba(150,85,255,0.6)] active:scale-95 transition-all border border-[#845CFF]/50"
        style={{
          background: 'linear-gradient(135deg, #7047FF, #9655FF)',
        }}
        aria-label="Toggle Gemini Chatbot"
      >
        {isOpen ? (
          <>
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Close Chat</span>
          </>
        ) : (
          <>
            <div className="relative">
              <Bot className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#20E99A] animate-ping" />
            </div>
            <span>Chat with Gemini</span>
            <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/30 text-[9px] text-[#24D8ED] font-mono uppercase tracking-wider border border-white/10">
              Multi-turn
            </span>
          </>
        )}
      </button>
    </div>
  );
};
