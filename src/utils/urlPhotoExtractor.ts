import { BuildingPhoto } from '../types';

/**
 * Normalizes any image URL (especially Google Drive, Dropbox, Google Photos)
 * into a directly embeddable, high-resolution image URL that works in <img> tags.
 */
export function normalizeDirectImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // 1. Google Drive single file link patterns:
  // e.g. https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing
  // e.g. https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
  // e.g. https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
  // e.g. https://drive.google.com/uc?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs&export=download
  const gDriveFileMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/i) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,})/i) ||
    trimmed.match(/drive\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i) ||
    trimmed.match(/drive\.google\.com\/thumbnail\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i);

  if (gDriveFileMatch && gDriveFileMatch[1]) {
    const fileId = gDriveFileMatch[1];
    // lh3.googleusercontent.com/d/{fileId} is the direct Google Drive image CDN
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // 2. Dropbox links: change dl=0 to raw=1
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace(/[?&]dl=0/g, '?raw=1').replace(/[?&]dl=1/g, '?raw=1');
  }

  // 3. Imgur album or direct link
  if (trimmed.match(/imgur\.com\/([a-zA-Z0-9]{5,7})$/)) {
    const imgurId = trimmed.split('/').pop();
    return `https://i.imgur.com/${imgurId}.jpg`;
  }

  return trimmed;
}

/**
 * Checks if a URL is a Google Drive Folder / Directory link
 */
export function isGoogleDriveFolderUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('drive.google.com/drive/folders') ||
    lower.includes('drive.google.com/drive/u/') ||
    lower.includes('drive.google.com/embeddedfolderview') ||
    lower.includes('drive.google.com/folderview') ||
    lower.includes('/folders/') ||
    lower.includes('photos.app.goo.gl') ||
    lower.includes('photos.google.com')
  );
}

/**
 * Extracts Google Drive folder ID from URL
 */
export function extractGoogleDriveFolderId(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{20,})/i) ||
    url.match(/folders\/([a-zA-Z0-9_-]{20,})/i) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/i);
  return match ? match[1] : null;
}

/**
 * Parses raw text or URLs, supporting multiple URLs separated by newlines, commas,
 * spaces, or inside markdown / text.
 */
export function extractUrlsFromText(rawText: string): string[] {
  if (!rawText) return [];
  const urlRegex = /(https?:\/\/[^\s<>"',;]+)/gi;
  const matches = rawText.match(urlRegex) || [];
  
  // Clean up trailing punctuation from matches
  const cleaned = matches.map((u) => u.replace(/[)\]}>.,;]+$/, '').trim());
  return Array.from(new Set(cleaned.filter((u) => u.length > 5)));
}

export interface ExtractedPhotosResult {
  photos: BuildingPhoto[];
  folderUrl?: string;
  isFolder: boolean;
  totalFound: number;
  message?: string;
}

/**
 * Returns an alternative Google Drive URL if the primary CDN fails to load
 */
export function getFallbackThumbnailUrl(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/i) ||
    url.match(/thumbnail\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i) ||
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/i);

  if (match && match[1]) {
    const fileId = match[1];
    if (url.includes('lh3.googleusercontent.com')) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return null;
}

/**
 * Main service to intelligently resolve any URL input:
 * - Single image URL
 * - Multiple image URLs (pasted together via newlines, commas, spaces)
 * - Google Drive Folder link (extracts all images inside)
 * - Google Drive File link
 * - Google Photos album link
 */
export async function processInputPhotoUrl(
  input: string,
  defaultLocation: string = 'Arsitektur - Dinding / Plesteran',
  defaultCaption: string = '',
  existingCount: number = 0,
  maxAllowed: number = 20,
  webhookUrl?: string
): Promise<ExtractedPhotosResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { photos: [], isFolder: false, totalFound: 0 };
  }

  const remainingQuota = Math.max(0, maxAllowed - existingCount);
  if (remainingQuota <= 0) {
    return { photos: [], isFolder: false, totalFound: 0, message: `Batas kuota ${maxAllowed} foto telah tercapai.` };
  }

  // Check if it's a Google Drive folder link or multiple URLs
  const isDriveFolder = isGoogleDriveFolderUrl(trimmed);
  const multipleUrls = extractUrlsFromText(trimmed);

  // If server-side extractor endpoint is available, try extracting via server
  try {
    const res = await fetch('/api/extract-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: trimmed,
        rawText: trimmed,
        defaultLocation,
        defaultCaption,
        webhookUrl: webhookUrl || '',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.extractedUrls) && data.extractedUrls.length > 0) {
        const dateStr = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        const newPhotos: BuildingPhoto[] = data.extractedUrls
          .slice(0, remainingQuota)
          .map((urlItem: string, idx: number) => {
            const normalized = normalizeDirectImageUrl(urlItem);
            return {
              id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
              url: normalized,
              damageLocation: defaultLocation,
              caption:
                defaultCaption.trim() ||
                (data.extractedUrls.length > 1
                  ? `Dokumentasi visual ${defaultLocation.toLowerCase()} (Foto #${existingCount + idx + 1})`
                  : `Dokumentasi visual ${defaultLocation.toLowerCase()}`),
              takenAt: dateStr,
            };
          });

        return {
          photos: newPhotos,
          folderUrl: data.folderUrl || (isDriveFolder ? trimmed : undefined),
          isFolder: Boolean(data.isFolder || isDriveFolder),
          totalFound: data.extractedUrls.length,
          message: data.message || `Berhasil mengekstrak ${newPhotos.length} foto!`,
        };
      } else if (data.isFolder || isDriveFolder) {
        // Folder detected, but 0 photos extracted by server
        return {
          photos: [],
          folderUrl: data.folderUrl || trimmed,
          isFolder: true,
          totalFound: 0,
          message: data.message || 'Folder Google Drive terdeteksi. Pastikan folder disetel ke "Siapa saja yang memiliki link", atau salin link foto-foto di dalamnya dan tempelkan di sini.',
        };
      }
    }
  } catch (err) {
    console.warn('Backend extract-photos notice, fallback to client-side parser:', err);
  }

  // Fallback client-side resolution
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (multipleUrls.length > 1) {
    const newPhotos: BuildingPhoto[] = multipleUrls
      .slice(0, remainingQuota)
      .map((u, idx) => ({
        id: `photo_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        url: normalizeDirectImageUrl(u),
        damageLocation: defaultLocation,
        caption:
          defaultCaption.trim() ||
          `Dokumentasi visual ${defaultLocation.toLowerCase()} (Foto #${existingCount + idx + 1})`,
        takenAt: dateStr,
      }));

    return {
      photos: newPhotos,
      isFolder: false,
      totalFound: multipleUrls.length,
      message: `Berhasil menambahkan ${newPhotos.length} foto dari tautan!`,
    };
  }

  // If it's a folder URL and we reached here with 0 extracted photos:
  // DO NOT add the folder URL as an image!
  if (isDriveFolder || isGoogleDriveFolderUrl(trimmed)) {
    return {
      photos: [],
      folderUrl: trimmed,
      isFolder: true,
      totalFound: 0,
      message: 'Folder Google Drive terdeteksi. Izin folder memerlukan akses Google Drive atau link foto spesifik. Silakan salin link foto di dalam folder tersebut dan tempelkan di tab "Tempel Banyak Link" atau unggah langsung file foto.',
    };
  }

  // Single URL
  const normalizedSingle = normalizeDirectImageUrl(trimmed);
  if (!normalizedSingle || isGoogleDriveFolderUrl(normalizedSingle) || normalizedSingle.includes('/folders/') || normalizedSingle.includes('photos.app.goo.gl')) {
    return {
      photos: [],
      folderUrl: isGoogleDriveFolderUrl(trimmed) ? trimmed : undefined,
      isFolder: isGoogleDriveFolderUrl(trimmed),
      totalFound: 0,
      message: isGoogleDriveFolderUrl(trimmed)
        ? 'Folder Google Drive terdeteksi dan dikaitkan ke arsip gedung. Silakan salin link foto spesifik di dalamnya untuk menambahkan foto bangunan.'
        : 'Tautan tidak valid atau tidak dapat dimuat langsung sebagai gambar.',
    };
  }

  const singlePhoto: BuildingPhoto = {
    id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url: normalizedSingle,
    damageLocation: defaultLocation,
    caption: defaultCaption.trim() || `Dokumentasi visual ${defaultLocation.toLowerCase()}`,
    takenAt: dateStr,
  };

  return {
    photos: [singlePhoto],
    folderUrl: undefined,
    isFolder: false,
    totalFound: 1,
    message: 'Berhasil menambahkan 1 foto.',
  };
}
