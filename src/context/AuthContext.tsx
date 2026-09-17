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
  orderBy,
} from 'firebase/firestore';
import { UserProfile, SavedVoiceAgent, SavedCallSession } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  savedAgents: SavedVoiceAgent[];
  savedSessions: SavedCallSession[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  saveVoiceAgent: (agent: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>) => Promise<SavedVoiceAgent>;
  deleteVoiceAgent: (agentId: string) => Promise<void>;
  saveCallSession: (session: Omit<SavedCallSession, 'userId' | 'createdAt' | 'updatedAt'>) => Promise<SavedCallSession>;
  refreshUserData: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedAgents, setSavedAgents] = useState<SavedVoiceAgent[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedCallSession[]>([]);

  // Sync profile & user data from Firestore
  const syncUserData = async (currentUser: FirebaseUser) => {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocPath = `users/${currentUser.uid}`;

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
      // Non-blocking fallback profile in state
      setUserProfile({
        uid: currentUser.uid,
        email: currentUser.email || 'operator@pipecat.internal',
        displayName: currentUser.displayName || 'Voice AI Engineer',
        photoURL: currentUser.photoURL || '',
        role: 'engineer',
      });
    }

    // Load user's saved agents
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

    // Load user's saved call sessions
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
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      if (currentUser) {
        await syncUserData(currentUser);
      } else {
        setUserProfile(null);
        setSavedAgents([]);
        setSavedSessions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await syncUserData(result.user);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups or use Demo Account.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in cancelled by user.');
      } else {
        setAuthError(err.message || 'Authentication failed.');
      }
      throw err;
    }
  };

  const signOut = async () => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      setSavedAgents([]);
      setSavedSessions([]);
    } catch (err: any) {
      console.error('Sign Out Error:', err);
      setAuthError(err.message);
    }
  };

  const saveVoiceAgent = async (
    agentData: Omit<SavedVoiceAgent, 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<SavedVoiceAgent> => {
    if (!user) {
      throw new Error('Authentication required to persist voice agent configuration to Firestore database.');
    }

    const nowIso = new Date().toISOString();
    const fullAgent: SavedVoiceAgent = {
      ...agentData,
      userId: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

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

    const path = `call_sessions/${fullSession.id}`;
    try {
      await setDoc(doc(db, 'call_sessions', fullSession.id), fullSession);
      setSavedSessions((prev) => [fullSession, ...prev]);
      return fullSession;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await syncUserData(user);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
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
