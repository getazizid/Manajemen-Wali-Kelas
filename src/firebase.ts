import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigStatic from '../firebase-applet-config.json';

// Support environment variables dynamically (useful for deployments like Vercel)
const metaEnv = (import.meta as any).env || {};

const cleanValue = (val: any, staticVal: string): string => {
  if (!val) return staticVal;
  const str = String(val).trim();
  if (
    str === '' || 
    str.includes('nama-project-anda') || 
    str.includes('your-project-id') || 
    str.includes('AIzaSyA1klig_azNHgFIQ...') ||
    str.includes('nama-project-anda.firebaseapp.com') ||
    str.includes('nama-project-anda.firebasestorage.app') ||
    str.includes('1:413451716443:web:5bcff...') ||
    str.startsWith('(')
  ) {
    return staticVal;
  }
  return str;
};

const staticProjectId = firebaseConfigStatic.projectId;
const currentProjectId = cleanValue(metaEnv.VITE_FIREBASE_PROJECT_ID || metaEnv.VITE_PROJECT_ID, staticProjectId);
const isCustomProject = currentProjectId !== staticProjectId;

const firebaseConfig = {
  apiKey: cleanValue(metaEnv.VITE_FIREBASE_API_KEY || metaEnv.VITE_API_KEY, firebaseConfigStatic.apiKey),
  authDomain: cleanValue(metaEnv.VITE_FIREBASE_AUTH_DOMAIN || metaEnv.VITE_AUTH_DOMAIN, firebaseConfigStatic.authDomain),
  projectId: currentProjectId,
  storageBucket: cleanValue(metaEnv.VITE_FIREBASE_STORAGE_BUCKET || metaEnv.VITE_STORAGE_BUCKET, firebaseConfigStatic.storageBucket),
  messagingSenderId: cleanValue(metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || metaEnv.VITE_MESSAGING_SENDER_ID, firebaseConfigStatic.messagingSenderId),
  appId: cleanValue(metaEnv.VITE_FIREBASE_APP_ID || metaEnv.VITE_APP_ID, firebaseConfigStatic.appId),
  firestoreDatabaseId: cleanValue(
    metaEnv.VITE_FIREBASE_DATABASE_ID || metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || metaEnv.VITE_FIRESTORE_DATABASE_ID,
    isCustomProject ? '(default)' : (firebaseConfigStatic.firestoreDatabaseId || '(default)')
  )
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Clean up database ID if it is the default one or is an instruction placeholder
const isValidDatabaseId = (id: string) => {
  if (!id) return false;
  if (
    id === '(default)' || 
    id.toLowerCase().includes('opsional') || 
    id.toLowerCase().includes('custom') || 
    id.toLowerCase().includes('default') ||
    id.includes('(')
  ) {
    return false;
  }
  return /^[a-z][a-z0-9-]*$/.test(id);
};

const dbId = isValidDatabaseId(firebaseConfig.firestoreDatabaseId)
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = getFirestore(app, dbId);
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
