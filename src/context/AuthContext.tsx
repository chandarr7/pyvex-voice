import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  FirebaseUser,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  getDocFromServer,
} from 'firebase/firestore';
import { UserProfile, SavedVoiceAgent, SavedCallSession, VoiceSettingsDoc } from '../types';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo?: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextType {
  user: AppUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  authError: string | null;
  isUnauthorizedDomain: boolean;
  unauthorizedHostname: string;
  savedAgents: SavedVoiceAgent[];
  savedSessions: SavedCallSession[];
  savedVoiceSettings: Record<string, VoiceSettingsDoc>;
  signInWithGoogle: () => Promise<boolean>;
  signInAsDemoUser: () => void;
  signOut: () => Promise<void>;
  saveVoiceAgent: (agent: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>) => Promise<SavedVoiceAgent>;
  deleteVoiceAgent: (agentId: string) => Promise<void>;
  saveCallSession: (session: Omit<SavedCallSession, 'userId' | 'createdAt' | 'updatedAt'>) => Promise<SavedCallSession>;
  saveVoiceSettings: (settings: Omit<VoiceSettingsDoc, 'userId' | 'createdAt' | 'updatedAt'>) => Promise<VoiceSettingsDoc>;
  getVoiceSettings: (personaId: string) => Promise<VoiceSettingsDoc | null>;
  refreshUserData: () => Promise<void>;
  clearAuthError: () => void;
}

const DEMO_USER: AppUser = {
  uid: 'demo_voice_engineer',
  email: 'engineer@pyvex.internal',
  displayName: 'Voice AI Engineer (Demo)',
  photoURL: null,
  isDemo: true,
  getIdToken: async () => 'test-token-demo_voice_engineer',
};

const DEMO_PROFILE: UserProfile = {
  uid: 'demo_voice_engineer',
  email: 'engineer@pyvex.internal',
  displayName: 'Voice AI Engineer (Demo)',
  photoURL: '',
  role: 'engineer',
  isDemo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_DEMO_AGENTS: SavedVoiceAgent[] = [
  {
    id: 'agent_customer_support_fast',
    userId: 'demo_voice_engineer',
    name: 'Customer Concierge (Fast Track)',
    description: 'Ultra-low latency tier with Deepgram Nova-2 and Silero VAD',
    transport: 'smallwebrtc',
    vad: 'silero',
    stt: 'deepgram',
    llm: 'gemini-flash',
    tts: 'elevenlabs',
    flow: 'customer_support',
    latencyTargetMs: 220,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'agent_clinical_triage_intake',
    userId: 'demo_voice_engineer',
    name: 'Clinical Triage Intake Agent',
    description: 'HIPAA-compliant patient greeting and symptom intake pipeline',
    transport: 'smallwebrtc',
    vad: 'silero',
    stt: 'deepgram',
    llm: 'gemini-flash',
    tts: 'cartesia',
    flow: 'clinical_triage',
    latencyTargetMs: 260,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_DEMO_SESSIONS: SavedCallSession[] = [
  {
    id: 'sess_demo_sample_1',
    userId: 'demo_voice_engineer',
    agentId: 'agent_customer_support_fast',
    title: 'Customer Concierge Call Session',
    durationSec: 52,
    turnCount: 4,
    avgLatencyMs: 245,
    status: 'completed',
    messages: [
      {
        id: 'msg_1',
        role: 'assistant',
        text: 'Welcome to Pyvex Voice services. How may I route your inquiry today?',
        timestamp: Date.now() - 60000,
        latencyMs: 210,
      },
      {
        id: 'msg_2',
        role: 'user',
        text: 'I need to check the status of my voice pipeline integration.',
        timestamp: Date.now() - 45000,
      },
      {
        id: 'msg_3',
        role: 'assistant',
        text: 'Your WebRTC pipeline is active with 220ms glass-to-glass latency and healthy Silero VAD frames.',
        timestamp: Date.now() - 30000,
        latencyMs: 235,
      },
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [unauthorizedHostname, setUnauthorizedHostname] = useState('');
  const [savedAgents, setSavedAgents] = useState<SavedVoiceAgent[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedCallSession[]>([]);
  const [savedVoiceSettings, setSavedVoiceSettings] = useState<Record<string, VoiceSettingsDoc>>({});
  const [isDemo, setIsDemo] = useState(false);

  // Validate connection to Firestore on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn('[Firebase] Firestore client is offline. Please check network/configuration.');
        }
      }
    }
    testConnection();
  }, []);

  // Sync profile & user data from Firestore for real Firebase users
  const syncUserData = async (currentUser: FirebaseUser) => {
    const userDocRef = doc(db, 'users', currentUser.uid);

    try {
      const docSnap = await getDoc(userDocRef);
      const nowIso = new Date().toISOString();

      if (!docSnap.exists()) {
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || 'operator@pipecat.internal',
          displayName: currentUser.displayName || 'Voice AI Engineer',
          photoURL: currentUser.photoURL || '',
          role: 'engineer',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await setDoc(userDocRef, newProfile);
        setUserProfile(newProfile);
      } else {
        const existingData = docSnap.data() as UserProfile;
        setUserProfile(existingData);
      }
    } catch (err) {
      console.warn('[Firestore] Sync profile note:', err);
      setUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || 'operator@pipecat.internal',
        displayName: currentUser.displayName || 'Voice AI Engineer',
        photoURL: currentUser.photoURL || '',
        role: 'engineer',
      });
    }

    // Load user's saved agents from Firestore
    try {
      const agentsQuery = query(
        collection(db, 'voice_agents'),
        where('userId', '==', currentUser.uid)
      );
      const querySnap = await getDocs(agentsQuery);
      const agents: SavedVoiceAgent[] = [];
      querySnap.forEach((d) => {
        agents.push(d.data() as SavedVoiceAgent);
      });
      setSavedAgents(agents);
    } catch (err) {
      console.warn('[Firestore] Agent query notice:', err);
    }

    // Load user's saved call sessions from Firestore
    try {
      const sessionsQuery = query(
        collection(db, 'call_sessions'),
        where('userId', '==', currentUser.uid)
      );
      const sessionSnap = await getDocs(sessionsQuery);
      const sessions: SavedCallSession[] = [];
      sessionSnap.forEach((d) => {
        sessions.push(d.data() as SavedCallSession);
      });
      setSavedSessions(sessions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      console.warn('[Firestore] Sessions query notice:', err);
    }

    // Load user's saved voice settings from Firestore
    try {
      const settingsQuery = query(
        collection(db, 'voice_settings'),
        where('userId', '==', currentUser.uid)
      );
      const settingsSnap = await getDocs(settingsQuery);
      const settingsMap: Record<string, VoiceSettingsDoc> = {};
      settingsSnap.forEach((d) => {
        const data = d.data() as VoiceSettingsDoc;
        if (data.personaId) {
          settingsMap[data.personaId] = data;
        }
      });
      setSavedVoiceSettings(settingsMap);
    } catch (err) {
      console.warn('[Firestore] Voice settings query notice:', err);
    }
  };

  // Check for existing demo session or Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setIsDemo(false);
        setUser(currentUser);
        setAuthError(null);
        setIsUnauthorizedDomain(false);
        await syncUserData(currentUser);
      } else {
        // Check if demo mode was previously active
        try {
          const demoActive = localStorage.getItem('pyvex_demo_active');
          if (demoActive === 'true') {
            setIsDemo(true);
            setUser(DEMO_USER);
            setUserProfile(DEMO_PROFILE);

            const storedAgents = localStorage.getItem('pyvex_demo_agents');
            setSavedAgents(storedAgents ? JSON.parse(storedAgents) : DEFAULT_DEMO_AGENTS);

            const storedSessions = localStorage.getItem('pyvex_demo_sessions');
            setSavedSessions(storedSessions ? JSON.parse(storedSessions) : DEFAULT_DEMO_SESSIONS);

            const storedVoiceSettings = localStorage.getItem('pyvex_demo_voice_settings');
            if (storedVoiceSettings) {
              setSavedVoiceSettings(JSON.parse(storedVoiceSettings));
            }
          } else {
            setUser(null);
            setUserProfile(null);
            setSavedAgents([]);
            setSavedSessions([]);
            setSavedVoiceSettings({});
          }
        } catch {
          setUser(null);
          setUserProfile(null);
          setSavedAgents([]);
          setSavedSessions([]);
          setSavedVoiceSettings({});
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    setIsUnauthorizedDomain(false);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setIsDemo(false);
        try {
          localStorage.removeItem('pyvex_demo_active');
        } catch {}
        await syncUserData(result.user);
        return true;
      }
      return false;
    } catch (err: any) {
      const errCode = err?.code || '';
      const errMsg = err?.message || String(err);

      if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        console.warn(
          `[Firebase Auth] Domain "${currentHost}" is not in Firebase Authorized Domains. ` +
          `Add it under Firebase Console > Authentication > Settings > Authorized domains. ` +
          `Demo mode is available to test instantly without domain authorization.`
        );
        setIsUnauthorizedDomain(true);
        setUnauthorizedHostname(currentHost);
        setAuthError(
          `Domain "${currentHost}" is not yet added to Firebase Console Authorized Domains. Add "${currentHost}" in Firebase Console > Authentication > Settings > Authorized domains, or click "Continue as Demo Voice Engineer" below.`
        );
      } else if (errCode === 'auth/popup-blocked') {
        console.warn('[Firebase Auth] Sign-in popup was blocked by your browser.');
        setAuthError('Popup was blocked by your browser. Please allow popups or use Demo Mode.');
      } else if (errCode === 'auth/cancelled-popup-request' || errCode === 'auth/popup-closed-by-user') {
        console.info('[Firebase Auth] Sign-in was closed by user.');
        setAuthError('Sign-in closed by user.');
      } else {
        console.warn('[Firebase Auth] Sign-in notice:', errMsg);
        setAuthError(errMsg || 'Authentication failed.');
      }
      return false;
    }
  };

  const signInAsDemoUser = () => {
    setAuthError(null);
    setIsUnauthorizedDomain(false);
    setIsDemo(true);
    setUser(DEMO_USER);
    setUserProfile(DEMO_PROFILE);

    try {
      localStorage.setItem('pyvex_demo_active', 'true');
      const storedAgents = localStorage.getItem('pyvex_demo_agents');
      if (storedAgents) {
        setSavedAgents(JSON.parse(storedAgents));
      } else {
        setSavedAgents(DEFAULT_DEMO_AGENTS);
        localStorage.setItem('pyvex_demo_agents', JSON.stringify(DEFAULT_DEMO_AGENTS));
      }

      const storedSessions = localStorage.getItem('pyvex_demo_sessions');
      if (storedSessions) {
        setSavedSessions(JSON.parse(storedSessions));
      } else {
        setSavedSessions(DEFAULT_DEMO_SESSIONS);
        localStorage.setItem('pyvex_demo_sessions', JSON.stringify(DEFAULT_DEMO_SESSIONS));
      }
    } catch (e) {
      console.warn('[Demo Mode] LocalStorage access warning:', e);
      setSavedAgents(DEFAULT_DEMO_AGENTS);
      setSavedSessions(DEFAULT_DEMO_SESSIONS);
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setIsUnauthorizedDomain(false);
    if (isDemo) {
      setIsDemo(false);
      try {
        localStorage.removeItem('pyvex_demo_active');
      } catch {}
      setUser(null);
      setUserProfile(null);
      setSavedAgents([]);
      setSavedSessions([]);
      setSavedVoiceSettings({});
      return;
    }
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      setSavedAgents([]);
      setSavedSessions([]);
      setSavedVoiceSettings({});
    } catch (err: any) {
      console.warn('[Firebase Auth] Sign Out Error:', err);
      setAuthError(err.message);
    }
  };

  const saveVoiceAgent = async (
    agentData: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SavedVoiceAgent> => {
    if (!user) {
      throw new Error('Authentication required to persist voice agent configuration.');
    }

    const nowIso = new Date().toISOString();
    const fullAgent: SavedVoiceAgent = {
      ...agentData,
      userId: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (isDemo || user.isDemo) {
      setSavedAgents((prev) => {
        const existingIdx = prev.findIndex((a) => a.id === fullAgent.id);
        const updated =
          existingIdx >= 0
            ? prev.map((a, i) => (i === existingIdx ? fullAgent : a))
            : [fullAgent, ...prev];
        try {
          localStorage.setItem('pyvex_demo_agents', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      return fullAgent;
    }

    const path = `voice_agents/${fullAgent.id}`;
    try {
      await setDoc(doc(db, 'voice_agents', fullAgent.id), fullAgent);
      setSavedAgents((prev) => {
        const existingIdx = prev.findIndex((a) => a.id === fullAgent.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = fullAgent;
          return updated;
        }
        return [fullAgent, ...prev];
      });
      return fullAgent;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const deleteVoiceAgent = async (agentId: string) => {
    if (!user) return;

    if (isDemo || user.isDemo) {
      setSavedAgents((prev) => {
        const updated = prev.filter((a) => a.id !== agentId);
        try {
          localStorage.setItem('pyvex_demo_agents', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      return;
    }

    const path = `voice_agents/${agentId}`;
    try {
      await deleteDoc(doc(db, 'voice_agents', agentId));
      setSavedAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const saveCallSession = async (
    sessionData: Omit<SavedCallSession, 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SavedCallSession> => {
    if (!user) {
      throw new Error('Authentication required to save session transcript.');
    }

    const nowIso = new Date().toISOString();
    const fullSession: SavedCallSession = {
      ...sessionData,
      userId: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (isDemo || user.isDemo) {
      setSavedSessions((prev) => {
        const updated = [fullSession, ...prev];
        try {
          localStorage.setItem('pyvex_demo_sessions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      return fullSession;
    }

    const path = `call_sessions/${fullSession.id}`;
    try {
      await setDoc(doc(db, 'call_sessions', fullSession.id), fullSession);
      setSavedSessions((prev) => [fullSession, ...prev]);
      return fullSession;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const saveVoiceSettings = async (
    settingsData: Omit<VoiceSettingsDoc, 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<VoiceSettingsDoc> => {
    if (!user) {
      throw new Error('Authentication required to persist voice settings.');
    }

    const nowIso = new Date().toISOString();
    // Unique ID format for voice settings: setting_<userId>_<personaId>
    const id = settingsData.id || `setting_${user.uid}_${settingsData.personaId || 'default'}`;
    const fullSettings: VoiceSettingsDoc = {
      ...settingsData,
      id,
      userId: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (isDemo || user.isDemo) {
      setSavedVoiceSettings((prev) => {
        const updated = {
          ...prev,
          [fullSettings.personaId]: fullSettings,
        };
        try {
          localStorage.setItem('pyvex_demo_voice_settings', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      return fullSettings;
    }

    const path = `voice_settings/${fullSettings.id}`;
    try {
      await setDoc(doc(db, 'voice_settings', fullSettings.id), fullSettings);
      setSavedVoiceSettings((prev) => ({
        ...prev,
        [fullSettings.personaId]: fullSettings,
      }));
      return fullSettings;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getVoiceSettings = async (personaId: string): Promise<VoiceSettingsDoc | null> => {
    if (savedVoiceSettings[personaId]) {
      return savedVoiceSettings[personaId];
    }
    if (!user || isDemo || user.isDemo) {
      return null;
    }
    const settingDocId = `setting_${user.uid}_${personaId}`;
    const path = `voice_settings/${settingDocId}`;
    try {
      const snap = await getDoc(doc(db, 'voice_settings', settingDocId));
      if (snap.exists()) {
        const data = snap.data() as VoiceSettingsDoc;
        setSavedVoiceSettings((prev) => ({
          ...prev,
          [personaId]: data,
        }));
        return data;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.READ, path);
      return null;
    }
  };

  const refreshUserData = async () => {
    if (user && !isDemo && !user.isDemo) {
      await syncUserData(user as FirebaseUser);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
    setIsUnauthorizedDomain(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isDemo,
        authError,
        isUnauthorizedDomain,
        unauthorizedHostname,
        savedAgents,
        savedSessions,
        savedVoiceSettings,
        signInWithGoogle,
        signInAsDemoUser,
        signOut,
        saveVoiceAgent,
        deleteVoiceAgent,
        saveCallSession,
        saveVoiceSettings,
        getVoiceSettings,
        refreshUserData,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
