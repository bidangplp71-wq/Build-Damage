/**
 * IndexedDB Local Photo Cache for SIM-PKBG PUPR
 * Provides persistent, unlimited local storage for building damage documentation photos.
 * Ensures photos are never lost even if localStorage is full or internet is offline.
 */

import { BuildingPhoto } from '../types';

const DB_NAME = 'sipandu_pupr_photos_db';
const DB_VERSION = 1;
const STORE_NAME = 'building_photos';

// In-memory hot cache for instant 0ms access
const memoryPhotoCache = new Map<string, string>();

interface StoredPhotoRecord {
  id: string;
  assessmentId?: string;
  url: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('assessmentId', 'assessmentId', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
          console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
          reject((event.target as IDBOpenDBRequest).error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  return dbPromise;
}

/**
 * Save a photo to IndexedDB and memory cache, and automatically sync to server
 */
export async function savePhotoLocally(
  photoId: string,
  assessmentId: string | undefined,
  dataUrlOrBase64: string
): Promise<void> {
  if (!photoId || !dataUrlOrBase64) return;

  // Update in-memory hot cache immediately
  memoryPhotoCache.set(photoId, dataUrlOrBase64);

  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredPhotoRecord = {
      id: photoId,
      assessmentId: assessmentId || 'general',
      url: dataUrlOrBase64,
      timestamp: Date.now(),
    };

    store.put(record);
  } catch (err) {
    console.warn('Failed to save photo to IndexedDB (in-memory cache active):', err);
  }

  // Background sync to server storage so other devices can access it immediately
  if (!dataUrlOrBase64.startsWith('/uploads/') && !dataUrlOrBase64.startsWith('http')) {
    uploadPhotoToServer(photoId, assessmentId, dataUrlOrBase64).catch(() => {});
  }
}

/**
 * Batch save multiple photos to IndexedDB
 */
export async function savePhotosLocally(
  photos: BuildingPhoto[],
  assessmentId?: string
): Promise<void> {
  if (!photos || photos.length === 0) return;

  photos.forEach((p) => {
    if (p.id && p.url) {
      memoryPhotoCache.set(p.id, p.url);
    }
  });

  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const p of photos) {
      if (p.id && p.url) {
        store.put({
          id: p.id,
          assessmentId: assessmentId || 'general',
          url: p.url,
          timestamp: Date.now(),
        });
      }
    }
  } catch (err) {
    console.warn('Batch photo IndexedDB save notice:', err);
  }

  // Batch sync to server in background
  const toSync = photos
    .filter((p) => p.id && p.url && !p.url.startsWith('http') && !p.url.startsWith('/uploads/'))
    .map((p) => ({ photoId: p.id, assessmentId, dataUrl: p.url }));
  if (toSync.length > 0) {
    syncBatchPhotosToServer(toSync).catch(() => {});
  }
}

/**
 * Get photo by ID from in-memory cache, IndexedDB, or server uploads
 */
export async function getPhotoLocally(photoId: string): Promise<string | null> {
  if (!photoId) return null;

  // Check hot memory cache first (0ms)
  if (memoryPhotoCache.has(photoId)) {
    return memoryPhotoCache.get(photoId) || null;
  }

  try {
    const db = await getDb();
    const localUrl = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(photoId);

      request.onsuccess = () => {
        const result = request.result as StoredPhotoRecord | undefined;
        if (result?.url) {
          memoryPhotoCache.set(photoId, result.url);
          resolve(result.url);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });

    if (localUrl) return localUrl;
  } catch {
    // Continue to server fallback
  }

  // Fallback: check if the photo was uploaded to the server's uploads directory
  try {
    const cleanId = photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const serverCandidateUrl = `/uploads/photos/${cleanId}.jpg`;
    const checkRes = await fetch(serverCandidateUrl, { method: 'HEAD' });
    if (checkRes.ok) {
      memoryPhotoCache.set(photoId, serverCandidateUrl);
      return serverCandidateUrl;
    }
  } catch {}

  return null;
}

/**
 * Upload a photo directly to the server's permanent storage (/uploads/photos/)
 */
export async function uploadPhotoToServer(
  photoId: string,
  assessmentId: string | undefined,
  dataUrlOrBase64: string
): Promise<{ success: boolean; url: string; error?: string }> {
  if (!photoId || !dataUrlOrBase64) {
    return { success: false, url: '', error: 'Data foto tidak lengkap' };
  }

  // If already an HTTP/HTTPS URL, don't re-upload
  if (dataUrlOrBase64.startsWith('http://') || dataUrlOrBase64.startsWith('https://') || dataUrlOrBase64.startsWith('/uploads/')) {
    return { success: true, url: dataUrlOrBase64 };
  }

  try {
    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoId,
        assessmentId: assessmentId || 'general',
        dataUrl: dataUrlOrBase64,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, url: '', error: errJson.message || 'Server upload failed' };
    }

    const data = await res.json();
    if (data.success && data.url) {
      // Also cache server URL
      memoryPhotoCache.set(photoId, data.url);
      return { success: true, url: data.url };
    }
    return { success: false, url: '', error: data.message };
  } catch (err: any) {
    return { success: false, url: '', error: err.message };
  }
}

/**
 * Batch upload multiple photos from local IndexedDB to the server
 */
export async function syncBatchPhotosToServer(
  items: { photoId: string; assessmentId?: string; dataUrl: string }[]
): Promise<{ success: boolean; urls: Record<string, string>; savedCount: number }> {
  if (!items || items.length === 0) {
    return { success: true, urls: {}, savedCount: 0 };
  }

  try {
    const res = await fetch('/api/photos/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: items }),
    });

    if (!res.ok) {
      return { success: false, urls: {}, savedCount: 0 };
    }

    const data = await res.json();
    if (data.success && data.urls) {
      Object.entries(data.urls).forEach(([pId, u]) => {
        memoryPhotoCache.set(pId, u as string);
      });
      return { success: true, urls: data.urls, savedCount: data.savedCount || 0 };
    }
    return { success: false, urls: {}, savedCount: 0 };
  } catch {
    return { success: false, urls: {}, savedCount: 0 };
  }
}

/**
 * Retrieve all photo records stored in local IndexedDB
 */
export async function getAllLocalPhotoRecords(): Promise<StoredPhotoRecord[]> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as StoredPhotoRecord[]) || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Delete a photo from IndexedDB and memory cache
 */
export async function deletePhotoLocally(photoId: string): Promise<void> {
  if (!photoId) return;
  memoryPhotoCache.delete(photoId);

  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(photoId);
  } catch (err) {
    console.warn('IndexedDB photo delete notice:', err);
  }
}

/**
 * Delete a photo from the server uploads directory
 */
export async function deletePhotoFromServer(photoId: string): Promise<boolean> {
  if (!photoId) return false;
  try {
    const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.success);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Delete photo everywhere (IndexedDB cache + memory + server disk)
 */
export async function deletePhotoCompletely(photoId: string): Promise<void> {
  await Promise.allSettled([
    deletePhotoLocally(photoId),
    deletePhotoFromServer(photoId),
  ]);
}

/**
 * Delete all photos belonging to a deleted assessment from IndexedDB
 */
export async function deletePhotosByAssessmentIdLocally(assessmentId: string): Promise<void> {
  if (!assessmentId) return;
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('assessmentId');
    const request = index.getAllKeys(assessmentId);

    request.onsuccess = () => {
      const keys = request.result;
      if (Array.isArray(keys)) {
        keys.forEach((k) => {
          memoryPhotoCache.delete(String(k));
          store.delete(k);
        });
      }
    };
  } catch (err) {
    console.warn('IndexedDB bulk assessment photo delete notice:', err);
  }
}

