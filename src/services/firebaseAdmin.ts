import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import rawConfig from '../../firebase-applet-config.json' with { type: 'json' };

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  const apps = getApps();
  if (apps.length > 0) {
    adminApp = apps[0];
    return adminApp;
  }

  // 1. Check if FIREBASE_SERVICE_ACCOUNT_KEY is provided
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (serviceAccountKey) {
    try {
      const parsedCreds = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        credential: cert(parsedCreds),
        projectId: parsedCreds.project_id || rawConfig.projectId,
      });
      return adminApp;
    } catch (e: any) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e?.message);
    }
  }

  // 2. Check if Firestore Emulator is running
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    adminApp = initializeApp({
      projectId: rawConfig.projectId,
    });
    return adminApp;
  }

  // 3. Check for Firebase Cloud Functions or Google Cloud Run runtime
  if (
    process.env.FIREBASE_CONFIG ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_NAME ||
    process.env.FUNCTION_TARGET
  ) {
    try {
      adminApp = initializeApp({
        projectId: rawConfig.projectId,
      });
      return adminApp;
    } catch (err: any) {
      console.error('Failed to initialize Admin SDK in Cloud Functions environment:', err?.message);
    }
  }

  // 4. Check for Google Application Default Credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      adminApp = initializeApp({
        projectId: rawConfig.projectId,
      });
      return adminApp;
    } catch (err: any) {
      return null;
    }
  }

  return null;
}

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (!app) return null;

  try {
    adminDb = rawConfig.firestoreDatabaseId
      ? getFirestore(app, rawConfig.firestoreDatabaseId)
      : getFirestore(app);
    return adminDb;
  } catch (err: any) {
    console.error('getAdminFirestore error:', err?.message);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  if (!app) return null;

  try {
    adminAuth = getAuth(app);
    return adminAuth;
  } catch (err: any) {
    console.error('getAdminAuth error:', err?.message);
    return null;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return !!getAdminAuth() && !!getAdminFirestore();
}
