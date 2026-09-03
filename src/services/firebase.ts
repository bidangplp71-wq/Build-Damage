import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Configuration provided for SIM-PKBG Firebase Project
export const firebaseConfig = {
  apiKey: "AIzaSyAdB8hNlAtVeP5U2_7AId8QnuOWGV9BBG8",
  authDomain: "simpkbg.firebaseapp.com",
  projectId: "simpkbg",
  storageBucket: "simpkbg.firebasestorage.app",
  messagingSenderId: "819784811353",
  appId: "1:819784811353:web:71b15df4ca19e73a554248",
  measurementId: "G-HN60YKJL3Y"
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (typeof window !== 'undefined') {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
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
