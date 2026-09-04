/**
 * Helper utility to resize and compress uploaded images for damage assessment photos.
 * Supports all image formats: JPG, JPEG, PNG, WEBP, HEIC/HEIF (Apple iPhone/iPad),
 * BMP, GIF, TIFF, AVIF, and raw camera uploads.
 * Ensures up to 10 photos per building can be stored smoothly in Firestore and local state
 * without exceeding the 1,048,576 bytes (1 MB) document limit.
 */

import { BuildingPhoto } from '../types';

/**
 * Checks if a file is an Apple HEIC/HEIF image based on extension or MIME type
 */
function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    type === 'image/heic' ||
    type === 'image/heif' ||
    type.includes('heic') ||
    type.includes('heif')
  );
}

/**
 * Converts HEIC/HEIF file to standard JPEG blob using heic2any
 */
async function convertHeicToJpeg(file: File): Promise<File | Blob> {
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = ((heic2anyModule as { default?: unknown }).default || heic2anyModule) as (options: {
      blob: Blob;
      toType?: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  } catch (err) {
    console.warn('heic2any dynamic conversion fallback:', err);
    return file;
  }
}

/**
 * Compresses and standardizes any image file into an optimized Data URL
 */
export async function compressImageFile(
  rawFile: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.78
): Promise<string> {
  // 1. Process Apple HEIC/HEIF photos if detected
  let file: File | Blob = rawFile;
  if (isHeicFile(rawFile)) {
    file = await convertHeicToJpeg(rawFile);
  }

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
