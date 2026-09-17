/**
 * Firebase app, auth, and Firestore singletons for the Pyvex Voice client.
 *
 * Credentials come from `VITE_FIREBASE_*` environment variables and fall back to
 * `firebase-applet-config.json`, the provisioned project this app ships against.
 * Firebase web config is public by design — access is enforced by the rules in
 * `firestore.rules`, not by hiding these values.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

import appletConfig from '../../firebase-applet-config.json';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? appletConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? appletConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? appletConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? appletConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? appletConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID ?? appletConfig.appId,
};

// The project stores this app's data in a named Firestore database rather than
// "(default)", so the instance has to be created with that id.
const firestoreDatabaseId =
  env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ?? appletConfig.firestoreDatabaseId ?? '(default)';

// Vite dev-server HMR re-evaluates this module, so reuse any app already initialized.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirestore(): Firestore {
  try {
    return initializeFirestore(app, {}, firestoreDatabaseId);
  } catch {
    // Already initialized on a previous evaluation of this module.
    return getFirestore(app, firestoreDatabaseId);
  }
}

export const auth = getAuth(app);
export const db = createFirestore();
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

/** The Firestore operation a failure came from, used to phrase the thrown error. */
export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
}

/**
 * Rethrow a Firestore failure as an error naming the operation and document path.
 *
 * Always throws, so callers can use it as the whole body of a `catch` without
 * having to satisfy their own return type.
 */
export function handleFirestoreError(
  error: unknown,
  operation: OperationType,
  path: string
): never {
  const code = (error as { code?: string })?.code;
  const detail = (error as { message?: string })?.message ?? String(error);

  if (code === 'permission-denied') {
    throw new Error(
      `Permission denied on ${operation} of "${path}". Check your sign-in state and firestore.rules.`
    );
  }
  if (code === 'unavailable') {
    throw new Error(`Firestore is unreachable — could not ${operation} "${path}". Retry shortly.`);
  }
  throw new Error(`Failed to ${operation} "${path}": ${detail}`);
}

export { signInWithPopup, firebaseSignOut, onAuthStateChanged };
export type { FirebaseUser };
export { app };
