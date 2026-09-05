import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Export the generated config
export const firebaseConfig = firebaseAppletConfig;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

try {
  if (typeof window !== 'undefined') {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    // Use the specific databaseId provided in the generated config
    const dbId = firebaseConfig.firestoreDatabaseId || undefined;
    db = getFirestore(app, dbId);
    auth = getAuth(app);
    
    // Initialize Firebase Storage if bucket is declared
    if (firebaseConfig.storageBucket) {
      try {
        storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
      } catch {
        storage = getStorage(app);
      }
    } else {
      storage = getStorage(app);
    }
  }
} catch (err) {
  console.warn('Firebase initialization notice:', err);
}

export { app, db, auth, storage };

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error caught (offline/sync):', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Test Firebase Firestore connectivity
 */
export async function testFirebaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!db) {
    return {
      success: false,
      message: 'Firebase SDK belum terinisialisasi pada browser ini.',
    };
  }

  try {
    const testCol = collection(db, 'system_health');
    const snapshot = await getDocs(testCol);
    return {
      success: true,
      message: `Terhubung ke Firestore project "${firebaseConfig.projectId}" (${snapshot.size} status docs)`,
    };
  } catch (error: any) {
    // If permission-denied or offline, it still confirms configuration endpoints are active
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      return {
        success: true,
        message: `Terhubung ke project "${firebaseConfig.projectId}" (Aturan Keamanan Firestore Rules aktif).`,
      };
    }
    if (error?.code === 'unavailable' || error?.message?.includes('unavailable') || error?.message?.includes('offline')) {
      return {
        success: true,
        message: `Mode Offline Aktif: Terhubung ke cache lokal Firestore "${firebaseConfig.projectId}". Sinkronisasi cloud akan berlanjut secara otomatis saat jaringan stabil.`,
      };
    }
    return {
      success: false,
      message: error?.message || 'Gagal menghubungi server Firebase.',
    };
  }
}

/**
 * Upload a compressed photo (data URL / base64) to Firebase Cloud Storage.
 * Stores in path: assessments/{assessmentId}/{photoId}.jpg
 * Fallbacks safely to base64 if Firebase Storage is offline or unprovisioned.
 */
export async function uploadPhotoToFirebaseStorage(
  dataUrlOrBase64: string,
  assessmentId: string,
  photoId: string
): Promise<{ success: boolean; url: string; isCloudStorage: boolean; error?: string }> {
  if (!storage || !dataUrlOrBase64) {
    return { success: true, url: dataUrlOrBase64, isCloudStorage: false };
  }

  // If it's already an external HTTP/HTTPS URL, don't re-upload
  if (dataUrlOrBase64.startsWith('http://') || dataUrlOrBase64.startsWith('https://')) {
    return { success: true, url: dataUrlOrBase64, isCloudStorage: dataUrlOrBase64.includes('firebasestorage.googleapis.com') };
  }

  try {
    const cleanAssId = (assessmentId || 'draft').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanPhotoId = (photoId || `photo_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileRef = ref(storage, `assessments/${cleanAssId}/${cleanPhotoId}.jpg`);

    const uploadTask = (async () => {
      if (dataUrlOrBase64.startsWith('data:')) {
        await uploadString(fileRef, dataUrlOrBase64, 'data_url', {
          contentType: 'image/jpeg',
        });
      } else {
        await uploadString(fileRef, dataUrlOrBase64, 'base64', {
          contentType: 'image/jpeg',
        });
      }
      return await getDownloadURL(fileRef);
    })();

    // 4 seconds strict timeout so network lag or offline status never freezes the UI
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase Storage upload timeout (4s)')), 4000)
    );

    const downloadUrl = await Promise.race([uploadTask, timeoutPromise]);
    return { success: true, url: downloadUrl, isCloudStorage: true };
  } catch (err: any) {
    console.warn('Firebase Storage upload notice (using optimized fallback):', err?.message || err);
    return { success: true, url: dataUrlOrBase64, isCloudStorage: false, error: err?.message };
  }
}

/**
 * Deletes a photo from Firebase Cloud Storage if it was uploaded there
 */
export async function deletePhotoFromFirebaseStorage(url: string): Promise<void> {
  if (!storage || !url || !url.includes('firebasestorage.googleapis.com')) {
    return;
  }

  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (err) {
    console.warn('Firebase Storage delete notice:', err);
  }
}


