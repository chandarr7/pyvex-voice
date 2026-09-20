import React, { useState } from 'react';
import {
  User,
  LogIn,
  LogOut,
  Database,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Sparkles,
  History,
  Bot,
  Cloud,
  X,
  Clock,
  Layers,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SavedVoiceAgent, SavedCallSession } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent?: (agent: SavedVoiceAgent) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSelectAgent,
}) => {
  const {
    user,
    userProfile,
    loading,
    authError,
    isUnauthorizedDomain,
    unauthorizedHostname,
    savedAgents,
    savedSessions,
    signInWithGoogle,
    signInAsDemoUser,
    signOut,
    deleteVoiceAgent,
    clearAuthError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'account' | 'agents' | 'sessions'>('account');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SavedCallSession | null>(null);
  const [copiedHostname, setCopiedHostname] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    clearAuthError();
    try {
      await signInWithGoogle();
    } catch {
      // Handled in context
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Cloud Database & Authentication
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Firestore Connected
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Persistent user profiles, custom voice agent presets, and conversation transcripts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs (when logged in) */}
        {user && (
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-800 bg-neutral-950/40">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'account'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Profile & Database
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'agents'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              Saved Voice Agents
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300">
                {savedAgents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Session History
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800 text-neutral-300">
                {savedSessions.length}
              </span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {authError && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Authentication Notice</span>
                {authError}
              </div>
              <button
                onClick={clearAuthError}
                className="text-red-400/80 hover:text-red-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isUnauthorizedDomain && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Domain Not Authorized in Firebase Console</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Firebase Authentication blocks Google Sign-In on domains that are not explicitly allowlisted in your Firebase project settings.
              </p>
              <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-amber-300 truncate">
                  {unauthorizedHostname || (typeof window !== 'undefined' ? window.location.hostname : '')}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const host =
                      unauthorizedHostname ||
                      (typeof window !== 'undefined' ? window.location.hostname : '');
                    navigator.clipboard?.writeText(host);
                    setCopiedHostname(true);
                    setTimeout(() => setCopiedHostname(false), 2500);
                  }}
                  className="px-2.5 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  {copiedHostname ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHostname ? 'Copied' : 'Copy Host'}</span>
                </button>
              </div>
              <div className="text-[11px] text-neutral-400 space-y-1">
                <div>
                  To enable Google Sign-In for this URL: open <strong>Firebase Console</strong> → <strong>Authentication</strong> → <strong>Settings</strong> → <strong>Authorized domains</strong> and add the domain above.
                </div>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={signInAsDemoUser}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Continue as Demo Voice Engineer (Instant Access)
                </button>
              </div>
            </div>
          )}

          {!user ? (
            /* Unauthenticated View: Login Prompt */
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-semibold text-white">
                  Sign in to PyVex Voice Platform
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Log in to securely persist custom voice agents, sync Silero VAD / Gemini pipelines across sessions, and review recorded call transcripts in Google Cloud Firestore.
                </p>
              </div>

              {/* Login Action Card */}
              <div className="w-full max-w-sm space-y-3 pt-2">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-neutral-100 text-neutral-900 font-medium text-sm rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.16C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.6H1.24C.45 8.2.01 10.05.01 12s.44 3.8 1.23 5.4l4.03-3.16z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.24 6.6l4.03 3.16c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  {isSigningIn ? 'Connecting...' : 'Continue with Google'}
                </button>

                <div className="flex items-center gap-2 my-2">
                  <div className="h-px bg-neutral-800 flex-1" />
                  <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider">or fast test</span>
                  <div className="h-px bg-neutral-800 flex-1" />
                </div>

                <button
                  type="button"
                  onClick={signInAsDemoUser}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-medium text-xs rounded-xl transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Continue as Demo Voice AI Engineer</span>
                </button>
              </div>

              {/* Security & Database Status Details */}
              <div className="w-full max-w-md pt-4 border-t border-neutral-800/80 grid grid-cols-2 gap-3 text-left">
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-medium mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    ABAC Security Rules
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Scoped UID isolation on all user collections and transcript logs.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
                  <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-medium mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    Live Cloud Sync
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Real-time state synchronization with persistent Firestore.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Authenticated View */
            <div>
              {userProfile?.isDemo && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-neutral-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span><strong>Demo Engineer Active</strong>: Custom agents & call logs are persisted locally.</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Offline / Dev Mode
                  </span>
                </div>
              )}
              {activeTab === 'account' && (
                <div className="space-y-6">
                  {/* User Profile Card */}
                  <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          className="w-14 h-14 rounded-2xl border border-neutral-700 object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold">
                          {(user.displayName || user.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">
                            {user.displayName || 'Voice AI Engineer'}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {userProfile?.role || 'engineer'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">
                          {user.email}
                        </p>
                        <p className="text-[11px] text-neutral-500 font-mono mt-1">
                          UID: {user.uid}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={signOut}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>

                  {/* Firestore Database Overview */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Firestore Database Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">
                          Database Collection
                        </span>
                        <div className="text-xs font-mono text-amber-400 font-medium">
                          /users/{user.uid.slice(0, 8)}...
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Profile Synced
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">
                          Voice Agents
                        </span>
                        <div className="text-xs font-mono text-white font-medium">
                          {savedAgents.length} Configurations
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Layers className="w-3 h-3 text-amber-400" />
                          /voice_agents
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-1">
                        <span className="text-[10px] uppercase font-mono text-neutral-500">
                          Call Sessions
                        </span>
                        <div className="text-xs font-mono text-white font-medium">
                          {savedSessions.length} Transcripts
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <History className="w-3 h-3 text-blue-400" />
                          /call_sessions
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Saved Voice Agents ({savedAgents.length})
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Custom pipeline configurations persisted in your Firestore account
                      </p>
                    </div>
                  </div>

                  {savedAgents.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-800 p-6 space-y-3">
                      <Bot className="w-8 h-8 mx-auto text-neutral-600" />
                      <p className="text-xs text-neutral-400">
                        No custom voice agents saved yet.
                      </p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        In the Live Voice Studio, click "Save Agent to Cloud" to persist your Silero VAD, Gemini model, and TTS voice parameters.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {savedAgents.map((agent) => (
                        <div
                          key={agent.id}
                          className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 transition-all flex items-center justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {agent.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-800 text-neutral-300">
                                {agent.flow || 'general'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                              <span>LLM: {agent.llm}</span>
                              <span>•</span>
                              <span>TTS: {agent.tts}</span>
                              <span>•</span>
                              <span>VAD: {agent.vad || 'silero'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {onSelectAgent && (
                              <button
                                onClick={() => {
                                  onSelectAgent(agent);
                                  onClose();
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
                              >
                                Deploy
                              </button>
                            )}
                            <button
                              onClick={() => deleteVoiceAgent(agent.id)}
                              className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition-colors"
                              title="Delete agent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Call Transcripts & Metrics ({savedSessions.length})
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        Historical voice conversations saved to Cloud Firestore
                      </p>
                    </div>
                  </div>

                  {savedSessions.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-800 p-6 space-y-3">
                      <History className="w-8 h-8 mx-auto text-neutral-600" />
                      <p className="text-xs text-neutral-400">
                        No recorded call sessions yet.
                      </p>
                      <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        When you conclude a voice interaction in the studio, click "Save Session" to record full turn transcripts and latency metrics.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {savedSessions.map((sess) => (
                        <div
                          key={sess.id}
                          onClick={() =>
                            setSelectedSession(
                              selectedSession?.id === sess.id ? null : sess
                            )
                          }
                          className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">
                                {sess.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {sess.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                              <Clock className="w-3 h-3 text-neutral-500" />
                              {sess.createdAt ? new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                            <span>Turns: {sess.turnCount || 0}</span>
                            <span>•</span>
                            <span>Duration: {sess.durationSec || 0}s</span>
                            <span>•</span>
                            <span>Avg Latency: {sess.avgLatencyMs || 280}ms</span>
                          </div>

                          {/* Expanded Transcript View */}
                          {selectedSession?.id === sess.id && (
                            <div className="pt-3 border-t border-neutral-800 space-y-2 mt-2">
                              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                Transcript Messages:
                              </span>
                              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                {sess.messages && sess.messages.length > 0 ? (
                                  sess.messages.map((m) => (
                                    <div
                                      key={m.id}
                                      className={`p-2 rounded-lg text-xs font-sans ${
                                        m.role === 'user'
                                          ? 'bg-amber-500/10 border border-amber-500/20 text-neutral-200'
                                          : 'bg-neutral-900 border border-neutral-800 text-neutral-300'
                                      }`}
                                    >
                                      <span className="text-[10px] font-mono font-semibold uppercase text-neutral-400 block mb-0.5">
                                        {m.role === 'user' ? 'User Speech' : 'Agent Response'}
                                      </span>
                                      {m.text}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-neutral-500 italic">
                                    No transcript text saved in this session.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Database: Firebase Firestore v10</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
