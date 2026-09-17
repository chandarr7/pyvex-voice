/**
 * Authentication and the signed-in user's stored data.
 *
 * Reads and writes go straight to Supabase from the browser, where row-level
 * security is the boundary: every query below is additionally scoped to the
 * current user so an accidental policy gap shows up as an empty result rather
 * than another account's rows.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  handleDatabaseError,
  isSupabaseConfigured,
  supabase,
  toAppUser,
  type AppUser,
} from '../lib/supabase';
import { SavedCallSession, SavedVoiceAgent, UserProfile } from '../types';

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  configured: boolean;
  savedAgents: SavedVoiceAgent[];
  savedSessions: SavedCallSession[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveVoiceAgent: (
    agent: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<SavedVoiceAgent>;
  deleteVoiceAgent: (agentId: string) => Promise<void>;
  saveCallSession: (
    session: Omit<SavedCallSession, 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<SavedCallSession>;
  refreshUserData: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Database rows are snake_case; the application speaks camelCase. */
interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserProfile['role'];
  created_at: string;
  updated_at: string;
}

interface VoiceAgentRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  transport: string | null;
  vad: string | null;
  stt: string | null;
  llm: string;
  tts: string;
  flow: string | null;
  latency_target_ms: number | null;
  created_at: string;
  updated_at: string;
}

interface CallSessionRow {
  id: string;
  user_id: string;
  agent_id: string | null;
  title: string;
  status: SavedCallSession['status'];
  duration_sec: number | null;
  turn_count: number | null;
  avg_latency_ms: number | null;
  messages: SavedCallSession['messages'];
  created_at: string;
  updated_at: string;
}

const toProfile = (row: ProfileRow): UserProfile => ({
  uid: row.id,
  email: row.email,
  displayName: row.display_name ?? undefined,
  photoURL: row.avatar_url ?? undefined,
  role: row.role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toAgent = (row: VoiceAgentRow): SavedVoiceAgent => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description ?? undefined,
  transport: row.transport ?? undefined,
  vad: row.vad ?? undefined,
  stt: row.stt ?? undefined,
  llm: row.llm,
  tts: row.tts,
  flow: row.flow ?? undefined,
  latencyTargetMs: row.latency_target_ms ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toSession = (row: CallSessionRow): SavedCallSession => ({
  id: row.id,
  userId: row.user_id,
  agentId: row.agent_id ?? undefined,
  title: row.title,
  status: row.status,
  durationSec: row.duration_sec ?? undefined,
  turnCount: row.turn_count ?? undefined,
  avgLatencyMs: row.avg_latency_ms ?? undefined,
  messages: row.messages ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedAgents, setSavedAgents] = useState<SavedVoiceAgent[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedCallSession[]>([]);

  const loadUserData = useCallback(async (currentUser: AppUser) => {
    if (!supabase) return;

    // The signup trigger creates the profile, so a missing row means the
    // account predates it or the trigger failed; the app still works without
    // one, on the identity the token already carries.
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      console.warn('[supabase] Could not load profile:', profileError.message);
      setUserProfile(null);
    } else {
      setUserProfile(profileRow ? toProfile(profileRow) : null);
    }

    const { data: agentRows, error: agentsError } = await supabase
      .from('voice_agents')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .returns<VoiceAgentRow[]>();

    if (agentsError) {
      console.warn('[supabase] Could not load voice agents:', agentsError.message);
    } else {
      setSavedAgents((agentRows ?? []).map(toAgent));
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .returns<CallSessionRow[]>();

    if (sessionsError) {
      console.warn('[supabase] Could not load call sessions:', sessionsError.message);
    } else {
      setSavedSessions((sessionRows ?? []).map(toSession));
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setAuthError('Sign-in is not configured on this deployment.');
      return;
    }

    let cancelled = false;

    // onAuthStateChange also fires for the session restored from storage and
    // for the OAuth redirect, so this covers first load as well as sign-in.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const appUser = toAppUser(session?.user);
      setUser(appUser);
      setLoading(false);
      if (appUser) {
        void loadUserData(appUser);
      } else {
        setUserProfile(null);
        setSavedAgents([]);
        setSavedSessions([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!supabase) {
      const message = 'Sign-in is not configured on this deployment.';
      setAuthError(message);
      throw new Error(message);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
    // A successful call navigates to the provider; the session arrives on the
    // way back through onAuthStateChange.
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
      return;
    }
    setUser(null);
    setUserProfile(null);
    setSavedAgents([]);
    setSavedSessions([]);
  }, []);

  const saveVoiceAgent = useCallback(
    async (
      agentData: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>
    ): Promise<SavedVoiceAgent> => {
      if (!supabase || !user) {
        throw new Error('Sign in to save a voice agent.');
      }

      const { data, error } = await supabase
        .from('voice_agents')
        .upsert({
          id: agentData.id,
          user_id: user.id,
          name: agentData.name,
          description: agentData.description ?? null,
          transport: agentData.transport ?? null,
          vad: agentData.vad ?? null,
          stt: agentData.stt ?? null,
          llm: agentData.llm,
          tts: agentData.tts,
          flow: agentData.flow ?? null,
          latency_target_ms: agentData.latencyTargetMs ?? null,
        })
        .select()
        .single<VoiceAgentRow>();

      if (error) handleDatabaseError(error, 'write', 'voice_agents');

      const saved = toAgent(data);
      setSavedAgents((prev) => [saved, ...prev.filter((a) => a.id !== saved.id)]);
      return saved;
    },
    [user]
  );

  const deleteVoiceAgent = useCallback(
    async (agentId: string) => {
      if (!supabase || !user) return;

      const { error } = await supabase.from('voice_agents').delete().eq('id', agentId);
      if (error) handleDatabaseError(error, 'delete', 'voice_agents');

      setSavedAgents((prev) => prev.filter((a) => a.id !== agentId));
    },
    [user]
  );

  const saveCallSession = useCallback(
    async (
      sessionData: Omit<SavedCallSession, 'userId' | 'createdAt' | 'updatedAt'>
    ): Promise<SavedCallSession> => {
      if (!supabase || !user) {
        throw new Error('Sign in to save a conversation.');
      }

      const { data, error } = await supabase
        .from('call_sessions')
        .upsert({
          id: sessionData.id,
          user_id: user.id,
          agent_id: sessionData.agentId ?? null,
          title: sessionData.title,
          status: sessionData.status,
          duration_sec: sessionData.durationSec ?? null,
          turn_count: sessionData.turnCount ?? null,
          avg_latency_ms: sessionData.avgLatencyMs ?? null,
          messages: sessionData.messages ?? [],
        })
        .select()
        .single<CallSessionRow>();

      if (error) handleDatabaseError(error, 'write', 'call_sessions');

      const saved = toSession(data);
      setSavedSessions((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      return saved;
    },
    [user]
  );

  const refreshUserData = useCallback(async () => {
    if (user) await loadUserData(user);
  }, [loadUserData, user]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({
      user,
      userProfile,
      loading,
      authError,
      configured: isSupabaseConfigured,
      savedAgents,
      savedSessions,
      signInWithGoogle,
      signOut,
      saveVoiceAgent,
      deleteVoiceAgent,
      saveCallSession,
      refreshUserData,
      clearAuthError,
    }),
    [
      user,
      userProfile,
      loading,
      authError,
      savedAgents,
      savedSessions,
      signInWithGoogle,
      signOut,
      saveVoiceAgent,
      deleteVoiceAgent,
      saveCallSession,
      refreshUserData,
      clearAuthError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
