import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Export the generated config
export const firebaseConfig = firebaseAppletConfig;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (typeof window !== 'undefined') {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    // IMPORTANT: Use the specific databaseId if provided in the generated config
    if (firebaseConfig.firestoreDatabaseId) {
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }
    
    auth = getAuth(app);
  }
} catch (err) {
  console.warn('Firebase initialization notice:', err);
}

export { app, db, auth };

/**
 * Test Firebase Firestore connectivity
 */
export async function testFirebaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!db) {
    return {
      success: false,
      message: 'Firebase SDK belum terinisialisasi pada browser ini.'
    };
  }

  try {
    const testCol = collection(db, 'system_health');
    const snapshot = await getDocs(testCol);
    return {
      success: true,
      message: `Terhubung ke Firestore project "${firebaseConfig.projectId}" (${snapshot.size} status docs)`
    };
  } catch (error: any) {
    // If permission-denied or offline, it still confirms configuration endpoints are active
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      return {
        success: true,
        message: `Terhubung ke project "${firebaseConfig.projectId}" (Aturan Keamanan Firestore Rules aktif).`
      };
    }
    return {
      success: false,
      message: error?.message || 'Gagal menghubungi server Firebase.'
    };
  }
}
