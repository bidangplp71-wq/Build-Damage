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
 * Save a photo to IndexedDB and memory cache
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
}

/**
 * Get photo by ID from in-memory cache or IndexedDB
 */
export async function getPhotoLocally(photoId: string): Promise<string | null> {
  if (!photoId) return null;

  // Check hot memory cache first (0ms)
  if (memoryPhotoCache.has(photoId)) {
    return memoryPhotoCache.get(photoId) || null;
  }

  try {
    const db = await getDb();
    return new Promise((resolve) => {
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
  } catch {
    return null;
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

