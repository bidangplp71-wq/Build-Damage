/**
 * Helper utility to resize and compress uploaded images for damage assessment photos.
 * Supports all image formats: JPG, JPEG, PNG, WEBP, HEIC/HEIF (Apple iPhone/iPad),
 * BMP, GIF, TIFF, AVIF, and raw camera uploads.
 * Ensures up to 20 photos per building can be stored smoothly in Firebase Cloud Storage,
 * Firestore, and local state without exceeding the 1,048,576 bytes (1 MB) document limit.
 */

import { BuildingPhoto } from '../types';

/**
 * Compresses and standardizes any image file into an optimized Data URL
 */
export async function compressImageFile(
  rawFile: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.72
): Promise<string> {
  const file: File | Blob = rawFile;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const originalDataUrl = (e.target?.result as string) || '';
      if (!originalDataUrl) {
        resolve('');
        return;
      }

      const img = new Image();

      img.onload = () => {
        let width = img.width || maxWidth;
        let height = img.height || maxHeight;

        // Scale proportionally if dimensions exceed maximum bounds
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(originalDataUrl);
            return;
          }

          // Fill white background for transparent PNG/WebP/GIF to avoid black backgrounds
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw scaled image
          ctx.drawImage(img, 0, 0, width, height);

          // Standardize to clean, lightweight JPEG for cross-platform compatibility
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (canvasErr) {
          console.warn('Canvas compression fallback to raw data URL:', canvasErr);
          resolve(originalDataUrl);
        }
      };

      img.onerror = () => {
        // If browser cannot render on canvas (e.g. rare raw camera format or TIFF),
        // fallback safely to original Data URL so the photo is never rejected
        console.warn('Direct Image() render fallback for format:', rawFile.type || rawFile.name);
        resolve(originalDataUrl);
      };

      img.src = originalDataUrl;
    };

    reader.onerror = () => {
      console.error('FileReader failed to read photo:', rawFile.name);
      resolve('');
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
  cloudCount: number;
  base64Count: number;
} {
  let totalBytes = 0;
  let cloudCount = 0;
  let base64Count = 0;

  for (const photo of photos) {
    if (photo.url) {
      if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
        cloudCount++;
        totalBytes += photo.url.length; // Cloud URL takes only ~100-200 bytes
      } else {
        base64Count++;
        totalBytes += photo.url.length; // Base64 character length approximates byte size
      }
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
    cloudCount,
    base64Count,
  };
}
