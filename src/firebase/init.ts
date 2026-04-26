import { firebaseConfig } from './config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let firebaseApp: FirebaseApp;

export function getSdks(app: FirebaseApp) {
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}

let cachedSdks: ReturnType<typeof getSdks> | null = null;

export function initializeFirebase() {
  if (cachedSdks) return cachedSdks;

  if (typeof window !== 'undefined' && !getApps().length) {
    try {
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
    cachedSdks = getSdks(firebaseApp);
    return cachedSdks;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cachedSdks = getSdks(app);
  return cachedSdks;
}
