import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Bot,
  User,
  Sparkles,
  Send,
  Trash2,
  Copy,
  Check,
  Zap,
  Brain,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  ArrowRight,
  Activity,
  ShieldAlert,
  Cpu,
  Navigation,
  Building2,
  Headphones,
  AlertCircle,
  CornerDownLeft,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GeminiChatMessage, GeminiModelId, GeminiChatRole } from '../types';
import { GEMINI_CHAT_ROLES } from '../data/geminiRoles';
import { useAuth } from '../context/AuthContext';
import { playVoiceAudio, stopVoiceAudio, ensureAudioUnlocked } from '../utils/audioEngine';

interface GeminiChatbotProps {
  initialRole?: string;
  onClose?: () => void;
  isCompact?: boolean;
}

const MODEL_OPTIONS: {
  id: GeminiModelId;
  name: string;
  badge: string;
  description: string;
  recommendedFor: string;
  color: string;
}[] = [
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'General Tasks',
    description: 'Balanced speed & intelligence for conversational depth.',
    recommendedFor: 'General multi-turn conversations & queries',
    color: '#845CFF',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Fastest Response',
    description: 'Ultra-low latency inference for immediate replies.',
    recommendedFor: 'Tasks requiring split-second latency',
    color: '#20E99A',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    badge: 'Complex Reasoning',
    description: 'Maximum intelligence for deep analysis & complex logic.',
    recommendedFor: 'Particularly complex reasoning & triage',
    color: '#24D8ED',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Flagship Multimodal',
    description: 'Advanced foundation model with high reasoning speed.',
    recommendedFor: 'Acoustic & multimodal agent tasks',
    color: '#9655FF',
  },
];

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  initialRole = 'tilted_sales_agent',
  isCompact = false,
}) => {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<GeminiChatRole>(() => {
    return GEMINI_CHAT_ROLES.find((r) => r.id === initialRole) || GEMINI_CHAT_ROLES[0];
  });

  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(activeRole.recommendedModel);
  const [systemInstruction, setSystemInstruction] = useState<string>(activeRole.systemInstruction);
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);

  // Conversation history: maintained in local state and sent for multi-turn context
  const [messages, setMessages] = useState<GeminiChatMessage[]>(() => {
    return [
      {
        id: 'initial_msg',
        role: 'model',
        content: `Greetings! I am **${activeRole.title}**, your dedicated **${activeRole.category}** agent powered by Google Gemini.\n\n*${activeRole.tagline}*\n\nHow may I assist you today? Feel free to ask a question or select one of the suggested prompts below.`,
        timestamp: Date.now(),
        model: activeRole.recommendedModel,
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ElevenLabs Voice Response States
  const [autoVoiceResponse, setAutoVoiceResponse] = useState<boolean>(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('EXAVITQu4vr4xnSDxMaL');
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [isVoiceLoading, setIsVoiceLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopVoiceAudio();
    };
  }, []);

  const handlePlayVoice = async (msgId: string, text: string) => {
    if (playingMsgId === msgId) {
      stopVoiceAudio();
      setPlayingMsgId(null);
      return;
    }

    stopVoiceAudio();
    setPlayingMsgId(msgId);
    setIsVoiceLoading(true);

    try {
      await ensureAudioUnlocked();
      const token = user ? await user.getIdToken() : null;
      await playVoiceAudio({
        text,
        voiceId: selectedVoiceId,
        gender: 'female',
        pitch: 1.0,
        rate: 1.0,
        authToken: token || undefined,
        onStateChange: (playing) => {
          if (!playing) setPlayingMsgId(null);
        },
      });
    } catch (err) {
      console.warn('Voice playback error:', err);
      setPlayingMsgId(null);
    } finally {
      setIsVoiceLoading(false);
    }
  };

  // Auto-scroll conversation thread when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // When changing role, update instruction & model default
  const handleSelectRole = (role: GeminiChatRole) => {
    setActiveRole(role);
    setSystemInstruction(role.systemInstruction);
    setSelectedModel(role.recommendedModel);

    // Add greeting turn for new role
    setMessages((prev) => [
      ...prev,
      {
        id: `role_switch_${Date.now()}`,
        role: 'model',
        content: `Switched agent persona to **${role.title}** (*${role.category}*).\n\nSystem instruction updated to: \`${role.tagline}\`\n\nHow can I help you in this role?`,
        timestamp: Date.now(),
        model: role.recommendedModel,
      },
    ]);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `cleared_${Date.now()}`,
        role: 'model',
        content: `Conversation thread reset. You are chatting with **${activeRole.title}** (*${activeRole.category}*) using **${selectedModel}**.\n\nSystem instruction is active. What would you like to discuss?`,
        timestamp: Date.now(),
        model: selectedModel,
      },
    ]);
    setErrorMessage(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!prompt || isLoading) return;

    setErrorMessage(null);
    setInputPrompt('');

    const userMessage: GeminiChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    // Append user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Build clean payload maintaining full multi-turn history
      // Exclude initial system-switch banners if they were just local UI greetings
      const historyPayload = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user) {
        try {
          const token = await user.getIdToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } catch {
          // Guest fallback
        }
      }

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: historyPayload,
          systemInstruction: systemInstruction,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server returned an error');
      }

      const botMessage: GeminiChatMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        content: data.text || '*(No response content returned)*',
        timestamp: data.timestamp || Date.now(),
        latencyMs: data.latencyMs,
        model: data.model || selectedModel,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Automatically speak response with ElevenLabs voice if enabled
      if (autoVoiceResponse && data.text) {
        handlePlayVoice(botMessage.id, data.text);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errText = err?.message || 'Failed to connect to Gemini service.';
      setErrorMessage(errText);

      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'model',
          content: `⚠️ **Error receiving response:** ${errText}\n\n*Please ensure your GEMINI_API_KEY is configured in Settings > Secrets.*`,
          timestamp: Date.now(),
          error: true,
          model: selectedModel,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render role icons
  const renderRoleIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Activity':
        return <Activity className={className} />;
      case 'ShieldAlert':
        return <ShieldAlert className={className} />;
      case 'Cpu':
        return <Cpu className={className} />;
      case 'Navigation':
        return <Navigation className={className} />;
      case 'Building2':
        return <Building2 className={className} />;
      case 'Headphones':
        return <Headphones className={className} />;
      default:
        return <Bot className={className} />;
    }
  };

  return (
    <div
      id="gemini-chatbot-container"
      className={`rounded-3xl border border-[#292B3A] bg-[#0D0F13] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)] ${
        isCompact ? 'h-[640px]' : 'h-[750px] max-h-[85vh]'
      }`}
    >
      {/* Top Header Bar: Role Selector, Model Switcher & Quick Actions */}
      <div className="p-4 sm:p-5 border-b border-[#292B3A] bg-[#12141A]/80 backdrop-blur-md flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Chatbot Identity & Role Title */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-[0_0_20px_rgba(112,71,255,0.3)] transition-all"
              style={{
                background: `linear-gradient(135deg, ${activeRole.colorAccent}25, rgba(13,15,19,0.9))`,
                borderColor: `${activeRole.colorAccent}50`,
                color: activeRole.colorAccent,
              }}
            >
              {renderRoleIcon(activeRole.iconName, 'w-5 h-5')}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#F4F2F8] tracking-tight flex items-center gap-2">
                  <span>{activeRole.title}</span>
                  <span
                    className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{
                      color: activeRole.colorAccent,
                      borderColor: `${activeRole.colorAccent}40`,
                      background: `${activeRole.colorAccent}15`,
                    }}
                  >
                    {activeRole.category}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-[#A4A3B2] line-clamp-1">{activeRole.tagline}</p>
            </div>
          </div>

          {/* Right Actions: ElevenLabs Voice Toggle, System Prompt, and Clear */}
          <div className="flex items-center gap-2">
            {/* ElevenLabs Voice Switcher */}
            <div className="flex items-center gap-1.5 bg-[#171820] border border-[#292B3A] rounded-xl p-1">
              <button
                type="button"
                onClick={() => {
                  if (playingMsgId) stopVoiceAudio();
                  setAutoVoiceResponse(!autoVoiceResponse);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                  autoVoiceResponse
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                    : 'text-[#A4A3B2] hover:text-[#F4F2F8]'
                }`}
                title={autoVoiceResponse ? 'ElevenLabs Auto-Voice is Active' : 'Enable ElevenLabs Auto-Voice'}
              >
                {autoVoiceResponse ? <Volume2 className="w-3.5 h-3.5 text-purple-400" /> : <VolumeX className="w-3.5 h-3.5 text-[#666879]" />}
                <span className="hidden sm:inline">ElevenLabs:</span>
                <span className="font-semibold text-[10px]">{autoVoiceResponse ? 'ON' : 'OFF'}</span>
              </button>

              {autoVoiceResponse && (
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="bg-[#0D0F13] border border-purple-500/30 rounded-lg px-2 py-1 text-[10px] font-mono text-purple-200 focus:outline-none cursor-pointer"
                  title="Select ElevenLabs Voice"
                >
                  <optgroup label="Sweet Human Female Voices">
                    <option value="pFZP5JQG7iQjIQuC4Bku">🌸 Lily (Sweet Velvet)</option>
                    <option value="jsCqWAovK2LkecY7zXl4">✨ Freya (Sweet Radiant)</option>
                    <option value="LcfcDJNigUd50AZSDxio">🌷 Emily (Sweet Gentle)</option>
                    <option value="XB0fDUnXU5powFXDhCwa">🕊️ Charlotte (Sweet Melodic)</option>
                    <option value="piTKgcLEGmPE4e6mEKli">🌙 Nicole (Sweet Whisper-Soft)</option>
                  </optgroup>
                  <optgroup label="Standard Enterprise Voices">
                    <option value="EXAVITQu4vr4xnSDxMaL">Sarah (Executive)</option>
                    <option value="Xb7hH8MSUJpSbSDYk0k2">Alice (Clinical)</option>
                    <option value="hpp4J3VqNfWAUOO0d1Us">Bella (Concierge)</option>
                    <option value="cgSgspJ2msm6clMCkdW9">Jessica (Dispatch)</option>
                    <option value="JBFqnCBsd6RMkjVDRZzb">George (Physician)</option>
                    <option value="IKne3meq5aSn9XLyUdCD">Charlie (Sales SDR)</option>
                    <option value="cjVigY5qzO86Huf0OWal">Eric (Advisor)</option>
                    <option value="TX3LPaxmHKxFdv7VOQHJ">Liam (Specialist)</option>
                    <option value="CwhRBWXzGAHq8TQ4Fs17">Roger (Fleet)</option>
                  </optgroup>
                </select>
              )}
            </div>

            <button
              onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                isSystemPromptOpen
                  ? 'bg-[#7047FF]/20 border-[#845CFF] text-[#F4F2F8]'
                  : 'bg-[#171820] border-[#292B3A] text-[#A4A3B2] hover:text-[#F4F2F8] hover:border-[#34365C]'
              }`}
              title="Inspect or modify Role System Instruction"
            >
              <Sliders className="w-3.5 h-3.5 text-[#9655FF]" />
              <span className="hidden sm:inline">Role System Prompt</span>
              {isSystemPromptOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl border border-[#292B3A] bg-[#171820] text-[#A4A3B2] hover:text-[#FF6269] hover:border-[#FF6269]/40 transition-colors"
              title="Clear conversation thread"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Second Row: Role Selector Buttons (Pill List) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#666879] shrink-0 mr-1 flex items-center gap-1">
            <Bot className="w-3 h-3 text-[#845CFF]" />
            <span>Agent Role:</span>
          </span>
          {GEMINI_CHAT_ROLES.map((role) => {
            const isSelected = role.id === activeRole.id;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all shrink-0 border ${
                  isSelected
                    ? 'border-[#845CFF] shadow-[0_0_15px_rgba(132,92,255,0.3)] text-[#F4F2F8]'
                    : 'border-[#292B3A] bg-[#171820]/60 text-[#A4A3B2] hover:text-[#F4F2F8] hover:border-[#34365C]'
                }`}
                style={{
                  background: isSelected
                    ? `linear-gradient(90deg, #1C1D25, #171820)`
                    : undefined,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: isSelected ? role.colorAccent : '#666879',
                  }}
                />
                <span>{role.title}</span>
              </button>
            );
          })}
        </div>

        {/* Third Row: Model Selection Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#292B3A]/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#666879] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#24D8ED]" />
              <span>Model:</span>
            </span>

            {MODEL_OPTIONS.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border ${
                    isSelected
                      ? 'border-[#24D8ED] bg-[#24D8ED]/10 text-[#24D8ED] font-semibold'
                      : 'border-[#292B3A] bg-[#12141A] text-[#A4A3B2] hover:text-[#F4F2F8] hover:border-[#34365C]'
                  }`}
                  title={`${m.name}: ${m.description} (${m.recommendedFor})`}
                >
                  <span
                    className={`w-1 h-1 rounded-full ${
                      isSelected ? 'bg-[#24D8ED]' : 'bg-[#666879]'
                    }`}
                  />
                  <span>{m.name}</span>
                  <span className="text-[9px] text-[#666879] hidden lg:inline">
                    • {m.badge}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] font-mono text-[#A4A3B2] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#20E99A] animate-pulse" />
            <span>Multi-turn History Active</span>
          </div>
        </div>

        {/* Collapsible System Instruction Inspector / Editor */}
        {isSystemPromptOpen && (
          <div className="mt-2 p-3.5 rounded-2xl bg-[#08090B] border border-[#34365C] space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-[#F4F2F8]">
                <Brain className="w-3.5 h-3.5 text-[#9655FF]" />
                <span className="font-semibold">Active System Instruction (Role Prompt)</span>
              </div>
              <button
                onClick={() => setSystemInstruction(activeRole.systemInstruction)}
                className="text-[10px] font-mono text-[#A4A3B2] hover:text-[#24D8ED] flex items-center gap-1 transition-colors"
                title="Reset to default persona instruction"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset to Role Default</span>
              </button>
            </div>

            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              rows={3}
              className="w-full rounded-xl p-2.5 text-xs font-mono text-[#F4F2F8] bg-[#0D0F13] border border-[#292B3A] focus:outline-none focus:border-[#7047FF] transition-all resize-none leading-relaxed"
              placeholder="Provide custom instructions to guide the chatbot's role and behavior..."
            />

            <div className="flex items-center justify-between text-[10px] font-mono text-[#666879]">
              <span>Instructs Gemini on persona, behavioral guardrails, tone, and triage urgency.</span>
              <span>{systemInstruction.length} characters</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Scrollable Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin bg-radial from-[#12141A]/50 to-[#08090B]">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
              }`}
            >
              {/* Model Avatar */}
              {!isUser && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5"
                  style={{
                    backgroundColor: '#171820',
                    borderColor: msg.error ? '#FF6269' : `${activeRole.colorAccent}40`,
                    color: msg.error ? '#FF6269' : activeRole.colorAccent,
                  }}
                >
                  {msg.error ? (
                    <AlertCircle className="w-4 h-4 text-[#FF6269]" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`rounded-2xl p-4 text-xs sm:text-sm font-sans leading-relaxed relative group transition-all ${
                  isUser
                    ? 'bg-[#7047FF] text-[#F4F2F8] rounded-tr-none shadow-[0_4px_16px_rgba(112,71,255,0.25)]'
                    : msg.error
                    ? 'bg-[#1C1D25] text-[#FF6269] border border-[#FF6269]/40 rounded-tl-none'
                    : 'bg-[#171820] text-[#F4F2F8] border border-[#292B3A] rounded-tl-none shadow-sm'
                }`}
              >
                {/* Header Metadata inside Assistant Bubble */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-4 pb-2 mb-2 border-b border-[#292B3A]/60 text-[10px] font-mono text-[#A4A3B2]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F4F2F8]">{activeRole.title}</span>
                      {msg.model && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0D0F13] text-[#24D8ED] border border-[#24D8ED]/20 text-[9px]">
                          {msg.model}
                        </span>
                      )}
                      {!msg.error && (
                        <button
                          type="button"
                          onClick={() => handlePlayVoice(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono transition-all border ${
                            playingMsgId === msg.id
                              ? 'bg-purple-600/30 border-purple-400 text-purple-200 animate-pulse'
                              : 'border-[#292B3A] bg-[#0D0F13] text-purple-300 hover:text-purple-100 hover:border-purple-500/60'
                          }`}
                          title={playingMsgId === msg.id ? 'Stop voice playback' : 'Listen with ElevenLabs voice'}
                        >
                          {playingMsgId === msg.id ? (
                            <>
                              <VolumeX className="w-3 h-3 text-purple-300" />
                              <span>Stop</span>
                            </>
                          ) : isVoiceLoading && playingMsgId === msg.id ? (
                            <>
                              <Activity className="w-3 h-3 animate-spin text-purple-400" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-purple-400" />
                              <span>ElevenLabs</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {msg.latencyMs && (
                        <span className="flex items-center gap-1 text-[#20E99A]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{msg.latencyMs}ms</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="opacity-0 group-hover:opacity-100 hover:text-[#F4F2F8] transition-opacity"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#20E99A]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Markdown Formatted Content */}
                <div className="markdown-body space-y-2 text-inherit">
                  <Markdown>{msg.content}</Markdown>
                </div>

                {/* User Message Footer */}
                {isUser && (
                  <div className="mt-1 text-[9px] font-mono text-purple-200/60 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-[#1C1D25] border border-[#845CFF]/40 flex items-center justify-center shrink-0 mt-0.5 text-[#D8B4FE]">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading / Thinking Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: '#171820',
                borderColor: `${activeRole.colorAccent}40`,
                color: activeRole.colorAccent,
              }}
            >
              <Bot className="w-4 h-4 animate-bounce" />
            </div>

            <div className="rounded-2xl rounded-tl-none p-4 bg-[#171820] border border-[#292B3A] text-xs font-mono text-[#A4A3B2] flex items-center gap-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#845CFF] animate-ping" />
              <span>
                {activeRole.title} is synthesizing with {selectedModel}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts for the Active Role */}
      {activeRole.suggestedPrompts && activeRole.suggestedPrompts.length > 0 && (
        <div className="px-4 py-2 bg-[#12141A]/60 border-t border-[#292B3A] flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#666879] shrink-0 flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#F5BD24]" />
            <span>Suggested:</span>
          </span>
          {activeRole.suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              disabled={isLoading}
              onClick={() => handleSendMessage(prompt)}
              className="text-[11px] font-mono text-[#A4A3B2] hover:text-[#F4F2F8] bg-[#171820] hover:bg-[#1C1D25] border border-[#292B3A] hover:border-[#34365C] px-3 py-1 rounded-full shrink-0 transition-all text-left flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="truncate max-w-[260px]">{prompt}</span>
              <ArrowRight className="w-2.5 h-2.5 shrink-0 text-[#845CFF]" />
            </button>
          ))}
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="p-3 sm:p-4 bg-[#12141A] border-t border-[#292B3A]">
        {errorMessage && (
          <div className="mb-2 p-2.5 rounded-xl bg-[#FF6269]/10 border border-[#FF6269]/30 text-[#FF6269] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 truncate">{errorMessage}</span>
          </div>
        )}

        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeRole.title} (${activeRole.category})...`}
            className="flex-1 rounded-2xl px-4 py-3 text-xs sm:text-sm font-sans text-[#F4F2F8] placeholder-[#666879] bg-[#0D0F13] border border-[#292B3A] focus:outline-none focus:border-[#7047FF] transition-all resize-none leading-relaxed"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading}
            className="p-3.5 rounded-2xl font-semibold transition-all shrink-0 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(112,71,255,0.3)] active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7047FF, #9655FF)',
              color: '#F4F2F8',
            }}
            title="Send Message (Enter)"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#F4F2F8]" />
            ) : (
              <Send className="w-4 h-4 text-[#F4F2F8]" />
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#666879]">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft className="w-3 h-3 text-[#666879]" />
            <span>Press Enter to send, Shift+Enter for new line</span>
          </span>
          <span>
            Powered by Google Gemini • {selectedModel}
          </span>
        </div>
      </div>
    </div>
  );
};
