/**
 * Helper utility to resize and compress uploaded images for damage assessment photos.
 * Ensures up to 10 photos per building can be stored smoothly in Firestore and local state
 * without exceeding the 1,048,576 bytes (1 MB) document limit.
 */

import { BuildingPhoto } from '../types';

export async function compressImageFile(
  file: File,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.68
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Draw and compress with progressive quality
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('Gagal memuat file gambar'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates estimated payload size in Bytes/KB of building photos
 * Firestore has a hard limit of 1,048,576 bytes (1 MB) per document.
 */
export function calculatePhotosPayloadSize(photos: BuildingPhoto[]): {
  bytes: number;
  kb: number;
  mb: number;
  percentageOfLimit: number;
  isSafe: boolean;
  formatted: string;
} {
  let totalBytes = 0;
  for (const photo of photos) {
    if (photo.url) {
      totalBytes += photo.url.length; // Base64 character length approximates byte size
    }
  }

  const kb = Math.round(totalBytes / 1024);
  const mb = Number((totalBytes / (1024 * 1024)).toFixed(2));
  const maxBytes = 1048576; // 1 MB Firestore document limit
  const percentageOfLimit = Math.min(100, Math.round((totalBytes / maxBytes) * 100));
  const isSafe = totalBytes <= 850000; // Leave 150KB headroom for metadata & calculations

  let formatted = `${kb} KB`;
  if (kb >= 1024) {
    formatted = `${mb} MB`;
  }

  return {
    bytes: totalBytes,
    kb,
    mb,
    percentageOfLimit,
    isSafe,
    formatted,
  };
}
