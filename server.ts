import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const CONFIG_FILE_PATH = path.join(process.cwd(), 'google_sheet_config.json');

// Middleware to parse JSON bodies with high limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'photos');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Durable local data directory for server-side persistence
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ASSESSMENTS_FILE = path.join(DATA_DIR, 'assessments.json');
const ASSESSMENTS_BACKUP_FILE = path.join(DATA_DIR, 'assessments.backup.json');

// Helper to safely load assessments from server file
function getStoredAssessments(): any[] {
  try {
    if (fs.existsSync(ASSESSMENTS_FILE)) {
      const content = fs.readFileSync(ASSESSMENTS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading assessments file, checking backup:', err);
    try {
      if (fs.existsSync(ASSESSMENTS_BACKUP_FILE)) {
        const backupContent = fs.readFileSync(ASSESSMENTS_BACKUP_FILE, 'utf8');
        const parsedBackup = JSON.parse(backupContent);
        if (Array.isArray(parsedBackup)) return parsedBackup;
      }
    } catch (bErr) {
      console.error('Error reading assessments backup:', bErr);
    }
  }
  return [];
}

// Helper to safely write assessments to server file with backup
function saveStoredAssessments(list: any[]): boolean {
  try {
    if (!Array.isArray(list)) return false;
    const jsonStr = JSON.stringify(list, null, 2);
    // Write backup first if current file exists
    if (fs.existsSync(ASSESSMENTS_FILE)) {
      try {
        fs.copyFileSync(ASSESSMENTS_FILE, ASSESSMENTS_BACKUP_FILE);
      } catch {}
    }
    fs.writeFileSync(ASSESSMENTS_FILE, jsonStr, 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing assessments file:', err);
    return false;
  }
}

// Serve uploaded photos statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ==========================================
// ASSESSMENTS API (Zero-quota Cloud Persistence)
// ==========================================

// Safe deduplication for server-stored assessments
function deduplicateServerAssessments(list: any[]): any[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];
  const result: any[] = [];
  const seenCodeMap = new Map<string, number>();
  const seenNikMap = new Map<string, number>();
  const seenLocMap = new Map<string, number>();
  const seenIdMap = new Map<string, number>();

  const clean = (s: any) =>
    String(s || '')
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  for (const item of list) {
    if (!item || !item.id) continue;
    const normCode = clean(item.code);
    const normNik =
      item.nikPemilik && item.nikPemilik !== '0' && String(item.nikPemilik).length >= 10
        ? String(item.nikPemilik).trim()
        : '';
    const normKec = clean(item.kecamatanName || item.kecamatanId);
    const normDesa = clean(item.desaName || item.desaId);
    const normBldg = clean(item.buildingName).replace(/\s*baris\s+\d+/i, '').trim();

    const nikKey = normNik && normKec ? `${normNik}::${normKec}` : '';
    const locKey = normKec && normDesa && normBldg ? `${normKec}::${normDesa}::${normBldg}` : '';

    let matchIdx = -1;
    if (seenIdMap.has(item.id)) {
      matchIdx = seenIdMap.get(item.id)!;
    } else if (normCode && seenCodeMap.has(normCode)) {
      matchIdx = seenCodeMap.get(normCode)!;
    } else if (nikKey && seenNikMap.has(nikKey)) {
      matchIdx = seenNikMap.get(nikKey)!;
    } else if (locKey && seenLocMap.has(locKey)) {
      matchIdx = seenLocMap.get(locKey)!;
    }

    if (matchIdx !== -1) {
      const existing = result[matchIdx];
      const mergedPhotos =
        item.photos && item.photos.length > 0 ? item.photos : existing.photos || [];
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      result[matchIdx] =
        incomingTime >= existingTime
          ? { ...existing, ...item, photos: mergedPhotos }
          : { ...item, ...existing, photos: mergedPhotos };
    } else {
      const newIdx = result.length;
      result.push(item);
      seenIdMap.set(item.id, newIdx);
      if (normCode) seenCodeMap.set(normCode, newIdx);
      if (nikKey) seenNikMap.set(nikKey, newIdx);
      if (locKey) seenLocMap.set(locKey, newIdx);
    }
  }
  return result;
}

// GET /api/assessments - Fetch all assessments stored on server
app.get('/api/assessments', (req, res) => {
  try {
    const list = deduplicateServerAssessments(getStoredAssessments());
    res.json({
      success: true,
      count: list.length,
      assessments: list,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Gagal mengambil data penilaian: ' + err.message });
  }
});

// POST /api/assessments - Upsert single assessment non-destructively
app.post('/api/assessments', (req, res) => {
  try {
    const assessment = req.body;
    if (!assessment || !assessment.id) {
      return res.status(400).json({ success: false, message: 'Data penilaian dan ID wajib ada' });
    }

    const currentList = getStoredAssessments();
    const updatedList = deduplicateServerAssessments([assessment, ...currentList]);
    saveStoredAssessments(updatedList);

    return res.json({
      success: true,
      count: updatedList.length,
      assessment: updatedList.find((a) => a.id === assessment.id) || assessment,
      message: 'Data penilaian berhasil disimpan di server!',
    });
  } catch (err: any) {
    console.error('Error saving assessment on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan penilaian: ' + err.message });
  }
});

// POST /api/assessments/sync-batch - Batch sync / merge assessments
app.post('/api/assessments/sync-batch', (req, res) => {
  try {
    const { assessments: incomingList, replace } = req.body;
    if (!Array.isArray(incomingList)) {
      return res.status(400).json({ success: false, message: 'Array assessments diperlukan' });
    }

    const currentList = getStoredAssessments();

    if (replace) {
      const cleanDeduped = deduplicateServerAssessments(incomingList);
      saveStoredAssessments(cleanDeduped);
      return res.json({
        success: true,
        count: cleanDeduped.length,
        assessments: cleanDeduped,
        message: `${cleanDeduped.length} data penilaian berhasil diperbarui bersih di server!`,
      });
    }

    const merged = deduplicateServerAssessments([...incomingList, ...currentList]);
    saveStoredAssessments(merged);

    return res.json({
      success: true,
      count: merged.length,
      assessments: merged,
      message: `${merged.length} data penilaian berhasil tersinkron di server!`,
    });
  } catch (err: any) {
    console.error('Error batch syncing assessments on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal sinkronisasi batch: ' + err.message });
  }
});

// DELETE /api/assessments/:id - Delete single assessment on server
app.delete('/api/assessments/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID diperlukan' });
    }

    const currentList = getStoredAssessments();
    const filtered = currentList.filter((a) => a.id !== id);
    saveStoredAssessments(filtered);

    return res.json({
      success: true,
      deletedId: id,
      remainingCount: filtered.length,
      message: 'Data penilaian berhasil dihapus dari server',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus penilaian: ' + err.message });
  }
});

// POST /api/webhook / POST /api/sheet-webhook - Catch incoming survey data from Google Apps Script or external tools
app.all(['/api/webhook', '/api/sheet-webhook'], (req, res) => {
  try {
    const payload = req.body || req.query;
    console.log('Incoming webhook received:', typeof payload === 'object' ? Object.keys(payload) : payload);

    if (payload && typeof payload === 'object') {
      const currentList = getStoredAssessments();
      const map = new Map<string, any>();
      currentList.forEach((a) => {
        if (a && a.id) map.set(a.id, a);
      });

      // If array of items
      if (Array.isArray(payload.data)) {
        payload.data.forEach((item: any) => {
          if (item && (item.id || item.code || item.buildingName)) {
            const itemId = item.id || `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            map.set(itemId, { ...item, id: itemId });
          }
        });
      } else if (payload.buildingName || payload.id || payload.code) {
        const itemId = payload.id || `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        map.set(itemId, { ...payload, id: itemId });
      }

      const updated = Array.from(map.values());
      saveStoredAssessments(updated);
    }

    return res.json({
      status: 'success',
      success: true,
      message: 'Webhook data received and safely saved to server',
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// API endpoint to upload a single photo
app.post('/api/photos/upload', (req, res) => {
  try {
    const { photoId, assessmentId, dataUrl } = req.body;
    if (!photoId || !dataUrl) {
      return res.status(400).json({ success: false, message: 'photoId dan dataUrl wajib diisi' });
    }

    const cleanPhotoId = (photoId || `photo_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    let ext = 'jpg';
    let base64Data = dataUrl;

    if (dataUrl.startsWith('data:')) {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mime = matches[1];
        base64Data = matches[2];
        if (mime.includes('png')) ext = 'png';
        else if (mime.includes('webp')) ext = 'webp';
      } else {
        base64Data = dataUrl.split(',')[1] || dataUrl;
      }
    }

    const filename = `${cleanPhotoId}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/photos/${filename}`;
    return res.json({
      success: true,
      photoId,
      url: publicUrl,
      size: buffer.length,
      message: 'Foto berhasil disimpan di server!',
    });
  } catch (err: any) {
    console.error('Error saving photo on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan foto: ' + err.message });
  }
});

// API endpoint to delete a single physical photo file from server
app.delete('/api/photos/:photoId', (req, res) => {
  try {
    const { photoId } = req.params;
    if (!photoId) {
      return res.status(400).json({ success: false, message: 'photoId wajib diisi' });
    }

    const cleanPhotoId = photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const extensions = ['jpg', 'png', 'webp', 'jpeg'];
    let deleted = false;

    for (const ext of extensions) {
      const filePath = path.join(UPLOADS_DIR, `${cleanPhotoId}.${ext}`);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          deleted = true;
        } catch (e) {
          console.warn('Gagal unlink file foto:', filePath, e);
        }
      }
    }

    return res.json({
      success: true,
      deleted,
      photoId,
      message: deleted ? 'File foto fisik berhasil dihapus dari server.' : 'File foto tidak ditemukan atau sudah terhapus.',
    });
  } catch (err: any) {
    console.error('Error deleting photo from server:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus file foto: ' + err.message });
  }
});

// API endpoint to batch sync photos (used by auto-recovery engine)
app.post('/api/photos/sync-batch', (req, res) => {
  try {
    const { photos } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ success: false, message: 'Array photos diperlukan' });
    }

    const results: Record<string, string> = {};
    for (const item of photos) {
      if (!item.photoId || !item.dataUrl) continue;
      const cleanPhotoId = item.photoId.replace(/[^a-zA-Z0-9_-]/g, '_');
      let ext = 'jpg';
      let base64Data = item.dataUrl;

      if (item.dataUrl.startsWith('data:')) {
        const matches = item.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          base64Data = matches[2];
          if (mime.includes('png')) ext = 'png';
          else if (mime.includes('webp')) ext = 'webp';
        } else {
          base64Data = item.dataUrl.split(',')[1] || item.dataUrl;
        }
      }

      const filename = `${cleanPhotoId}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      results[item.photoId] = `/uploads/photos/${filename}`;
    }

    return res.json({
      success: true,
      savedCount: Object.keys(results).length,
      urls: results,
      message: `${Object.keys(results).length} foto berhasil disinkronkan ke server!`,
    });
  } catch (err: any) {
    console.error('Error batch syncing photos on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal sinkronisasi batch foto: ' + err.message });
  }
});

// Load saved config or fall back to environment variables
function getGoogleSheetConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading google_sheet_config.json:', err);
  }
  return {
    spreadsheetUrl: process.env.VITE_SPREADSHEET_URL || '',
    webhookUrl: process.env.VITE_WEBHOOK_URL || '',
    driveFolderId: process.env.VITE_DRIVE_FOLDER_ID || 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
  };
}

// 1. API route to get Google Sheet config
app.get('/api/config', (req, res) => {
  const config = getGoogleSheetConfig();
  res.json({
    success: true,
    config,
  });
});

// ==========================================
// SMART PHOTO URL EXTRACTOR & RESOLVER
// ==========================================
app.post('/api/extract-photos', async (req, res) => {
  try {
    const { url, rawText, webhookUrl } = req.body;
    const inputText = (rawText || url || '').trim();

    if (!inputText) {
      return res.status(400).json({ success: false, message: 'URL atau teks foto wajib diisi' });
    }

    const extractedUrls: string[] = [];
    const seenUrls = new Set<string>();
    let isFolder = false;
    let folderUrl: string | undefined = undefined;

    // Helper to add valid image URL deduplicated
    const addUrl = (u: string) => {
      if (!u || typeof u !== 'string') return;
      const clean = u.trim();
      if (!clean || clean.length < 10) return;
      if (!seenUrls.has(clean)) {
        seenUrls.add(clean);
        extractedUrls.push(clean);
      }
    };

    // 1. First, extract any explicit direct file URLs and Google Drive files directly inside inputText
    const urlRegex = /(https?:\/\/[^\s<>"',;]+)/gi;
    const allMatches = inputText.match(urlRegex) || [];
    const cleanList = allMatches.map((u) => u.replace(/[)\]}>.,;]+$/, '').trim());

    cleanList.forEach((raw) => {
      const gDriveFileMatch =
        raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,})/i) ||
        raw.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,})/i) ||
        raw.match(/drive\.google\.com\/uc\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i) ||
        raw.match(/drive\.google\.com\/thumbnail\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i);

      if (gDriveFileMatch && gDriveFileMatch[1]) {
        addUrl(`https://lh3.googleusercontent.com/d/${gDriveFileMatch[1]}`);
      } else if (raw.includes('dropbox.com')) {
        addUrl(raw.replace(/[?&]dl=0/g, '?raw=1').replace(/[?&]dl=1/g, '?raw=1'));
      } else if (
        !raw.includes('drive.google.com/drive/folders') &&
        !raw.includes('drive.google.com/embeddedfolderview') &&
        !raw.includes('/folders/') &&
        !raw.includes('photos.app.goo.gl') &&
        !raw.includes('photos.google.com')
      ) {
        addUrl(raw);
      }
    });

    // 2. Check if input contains a Google Drive folder link
    const gDriveFolderMatch =
      inputText.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{20,})/i) ||
      inputText.match(/drive\.google\.com\/embeddedfolderview\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i) ||
      inputText.match(/drive\.google\.com\/open\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i) ||
      inputText.match(/\/folders\/([a-zA-Z0-9_-]{20,})/i);

    if (gDriveFolderMatch && gDriveFolderMatch[1]) {
      isFolder = true;
      const folderId = gDriveFolderMatch[1];
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

      // Try querying Apps Script Webhook if available (native DriveApp access)
      if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
        try {
          const hookResp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_drive_folder_photos',
              folderId,
            }),
          });
          if (hookResp.ok) {
            const hookData = await hookResp.json();
            if (hookData && Array.isArray(hookData.photos) && hookData.photos.length > 0) {
              hookData.photos.forEach((item: any) => {
                const imgUrl = item.url || (item.id ? `https://lh3.googleusercontent.com/d/${item.id}` : '');
                if (imgUrl) addUrl(imgUrl);
              });
            }
          }
        } catch (hErr) {
          console.warn('Apps Script folder scan notice:', hErr);
        }
      }

      // Try fetching folder web page to extract all file IDs inside
      if (extractedUrls.length === 0) {
        try {
          const fetchUrls = [
            `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
            `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
            `https://drive.google.com/drive/folders/${folderId}?usp=sharing`,
            `https://drive.google.com/drive/u/0/folders/${folderId}`,
          ];

          const foundFileIds = new Set<string>();

          for (const targetUrl of fetchUrls) {
            if (foundFileIds.size > 0) break;
            try {
              const resp = await fetch(targetUrl, {
                signal: AbortSignal.timeout(3500),
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                  'Accept-Language': 'id,en-US,en;q=0.9',
                },
              });

              if (resp.ok) {
                const html = await resp.text();

                // Match file patterns like /file/d/ID or ["ID","image/..." or id="ID"
                const fileIdRegexes = [
                  /\/file\/d\/([a-zA-Z0-9_-]{25,45})/g,
                  /["']([a-zA-Z0-9_-]{25,45})["']\s*,\s*\[\s*["']image\//g,
                  /\[\s*["']([a-zA-Z0-9_-]{25,45})["']\s*,\s*["'][^"']+\.(?:jpg|jpeg|png|webp|heic|bmp)/gi,
                  /data-id=["']([a-zA-Z0-9_-]{25,45})["']/g,
                  /["']docid["']\s*:\s*["']([a-zA-Z0-9_-]{25,45})["']/g,
                  /["']targetId["']\s*:\s*["']([a-zA-Z0-9_-]{25,45})["']/g,
                  /\[["']([a-zA-Z0-9_-]{25,45})["'],\[["']https:\/\/drive\.google\.com/g,
                  /thumbnail\?(?:amp;)?id=([a-zA-Z0-9_-]{25,45})/g,
                  /drive\.google\.com\/uc\?(?:amp;)?(?:export=download&amp;)?id=([a-zA-Z0-9_-]{25,45})/g,
                  /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{25,45})/g,
                ];

                for (const regex of fileIdRegexes) {
                  let match;
                  while ((match = regex.exec(html)) !== null) {
                    const id = match[1];
                    if (id && id !== folderId && id.length >= 25 && id.length <= 45) {
                      foundFileIds.add(id);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Error fetching folder page variant:', e);
            }
          }

          if (foundFileIds.size > 0) {
            foundFileIds.forEach((id) => {
              addUrl(`https://lh3.googleusercontent.com/d/${id}`);
            });
          }
        } catch (fErr) {
          console.warn('Drive folder fetch error:', fErr);
        }
      }
    } else if (inputText.includes('photos.app.goo.gl') || inputText.includes('photos.google.com/share')) {
      // 3. Google Photos Album
      isFolder = true;
      try {
        const resp = await fetch(inputText, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });

        if (resp.ok) {
          const html = await resp.text();
          const gPhotosRegex = /"https:\/\/(lh3\.googleusercontent\.com\/[a-zA-Z0-9_-]{30,})"/g;
          let match;
          while ((match = gPhotosRegex.exec(html)) !== null) {
            const rawImgUrl = match[1];
            if (rawImgUrl && !rawImgUrl.includes('placeholder')) {
              addUrl(`https://${rawImgUrl}=w1600-h1200`);
            }
          }
        }
      } catch (gErr) {
        console.warn('Google Photos fetch error:', gErr);
      }
    }

    if (isFolder && extractedUrls.length === 0) {
      return res.json({
        success: true,
        isFolder: true,
        folderUrl,
        count: 0,
        extractedUrls: [],
        message: 'Folder Google Drive terdeteksi dan dikaitkan ke arsip gedung. Untuk memuat foto satu per satu, silakan salin daftar tautan berkas foto di dalamnya atau unggah langsung.',
      });
    }

    return res.json({
      success: true,
      isFolder,
      folderUrl,
      count: extractedUrls.length,
      extractedUrls,
      message: isFolder
        ? `Berhasil mengekstrak ${extractedUrls.length} foto dari Google Drive!`
        : `Berhasil memproses ${extractedUrls.length} tautan foto.`,
    });
  } catch (err: any) {
    console.error('Error in extract-photos endpoint:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengekstrak foto: ' + err.message });
  }
});

// ==========================================
// FAST ATOMIC KECAMATAN SHEETS FETCHER (STRICTLY 7 KECAMATAN SHEETS ONLY)
// High-speed direct datacenter peering with Google Sheets
// ==========================================
interface ServerKecamatanCache {
  spreadsheetId: string;
  timestamp: number;
  rows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }>;
}
let serverKecamatanCache: ServerKecamatanCache | null = null;
const SERVER_KECAMATAN_CACHE_TTL = 30000; // 30 seconds

const KECAMATAN_SPECS = [
  { name: 'Aesesa', aliases: ['Kec. Aesesa', 'Aesesa', 'Kec Aesesa', 'AESESA'] },
  { name: 'Aesesa Selatan', aliases: ['Kec. Aesesa Selatan', 'Aesesa Selatan', 'Kec Aesesa Selatan', 'AESESA SELATAN'] },
  { name: 'Boawae', aliases: ['Kec. Boawae', 'Boawae', 'Kec Boawae', 'BOAWAE'] },
  { name: 'Mauponggo', aliases: ['Kec. Mauponggo', 'Mauponggo', 'Kec Mauponggo', 'MAUPONGGO'] },
  { name: 'Nangaroro', aliases: ['Kec. Nangaroro', 'Nangaroro', 'Kec Nangaroro', 'NANGARORO'] },
  { name: 'Keo Tengah', aliases: ['Kec. Keo Tengah', 'Keo Tengah', 'Kec Keo Tengah', 'KEO TENGAH'] },
  { name: 'Wolowae', aliases: ['Kec. Wolowae', 'Wolowae', 'Kec Wolowae', 'WOLOWAE'] },
];

function parseServerGvizTextToRows(rawText: string, sheetName: string): Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> {
  if (!rawText || !rawText.includes('google.visualization.Query.setResponse')) return [];
  try {
    const match = rawText.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
    if (!match || !match[1]) return [];
    const json = JSON.parse(match[1]);
    if (!json || json.status === 'error' || !json.table) return [];

    const cols = json.table.cols || [];
    const headers = cols.map((col: any, idx: number) => {
      return (col.label && String(col.label).trim()) || (col.id && String(col.id).trim()) || `kolom_${idx + 1}`;
    });

    const rows = json.table.rows || [];
    const extracted: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> = [];

    rows.forEach((r: any, rIdx: number) => {
      if (!r || !Array.isArray(r.c)) return;
      const rowObj: Record<string, any> = {};
      let hasData = false;

      r.c.forEach((cell: any, cIdx: number) => {
        const colName = headers[cIdx] || `kolom_${cIdx + 1}`;
        let val = '';
        if (cell !== null && cell !== undefined) {
          val = cell.f !== undefined && cell.f !== null ? cell.f : cell.v !== undefined && cell.v !== null ? cell.v : '';
        }
        if (val !== '' && val !== null && val !== undefined && String(val).trim() !== '-' && String(val).trim() !== '') {
          hasData = true;
        }
        rowObj[colName] = val;
      });

      if (hasData) {
        extracted.push({
          rowObj,
          sheetRowNumber: rIdx + 2,
          sourceSheet: sheetName,
        });
      }
    });

    return extracted;
  } catch {
    return [];
  }
}

async function fetchKecamatanRowsOnServer(
  spreadsheetId: string,
  kec: { name: string; aliases: string[] },
  cacheBuster: number
): Promise<{ success: boolean; rows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }>; matchedTab?: string }> {
  const prioritized = [`Kec. ${kec.name}`, kec.name, ...kec.aliases.filter(a => a !== `Kec. ${kec.name}` && a !== kec.name)];
  const probeTopTwo = prioritized.slice(0, 2);

  const fetchSingleAlias = async (alias: string) => {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(alias)}&_t=${cacheBuster}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) return null;
      const text = await resp.text();
      const parsed = parseServerGvizTextToRows(text, alias);
      if (parsed.length === 0) return null;

      // Validate that this is NOT a Master Rekap fallback (which contains rows from multiple other kecamatans)
      const targetLower = kec.name.toLowerCase();
      let matchCount = 0;
      let otherKecCount = 0;
      const otherKecNames = KECAMATAN_SPECS.filter(k => k.name.toLowerCase() !== targetLower).map(k => k.name.toLowerCase());

      parsed.forEach(p => {
        const rawKec = String(
          p.rowObj['Kecamatan'] || p.rowObj['Kec'] || p.rowObj['Wilayah Kecamatan'] || p.rowObj['Nama Kecamatan'] || ''
        ).toLowerCase().trim();
        if (rawKec) {
          if (rawKec.includes(targetLower)) matchCount++;
          else if (otherKecNames.some(o => rawKec.includes(o))) otherKecCount++;
        }
      });

      // If other kecamatans dominate, it's the Master Rekap sheet returned by Google fallback, not the target tab
      if (otherKecCount >= 2 && otherKecCount > matchCount) {
        return null;
      }

      return { rows: parsed, matchedTab: alias };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  };

  // Run top two variants concurrently
  const topResults = await Promise.all(probeTopTwo.map(fetchSingleAlias));
  for (const res of topResults) {
    if (res && res.rows.length > 0) {
      return { success: true, rows: res.rows, matchedTab: res.matchedTab };
    }
  }

  // Check remaining aliases if top two yielded no data
  const remaining = prioritized.slice(2);
  for (const alias of remaining) {
    const res = await fetchSingleAlias(alias);
    if (res && res.rows.length > 0) {
      return { success: true, rows: res.rows, matchedTab: res.matchedTab };
    }
  }

  return { success: false, rows: [] };
}

const handleKecamatanRawFetch = async (req: express.Request, res: express.Response) => {
  try {
    const spreadsheetUrl = (req.body?.spreadsheetUrl || req.query?.spreadsheetUrl || getGoogleSheetConfig().spreadsheetUrl || '').toString().trim();
    const forceRefresh = req.body?.forceRefresh === true || req.query?.forceRefresh === 'true';

    const match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{15,})/);
    const spreadsheetId = match ? match[1] : '';

    if (!spreadsheetId) {
      return res.status(400).json({ success: false, message: 'ID Spreadsheet Google Sheet tidak valid atau kosong.', rows: [] });
    }

    // In-memory cache hit (15 seconds for snappy navigation)
    if (!forceRefresh && serverKecamatanCache && serverKecamatanCache.spreadsheetId === spreadsheetId) {
      const age = Date.now() - serverKecamatanCache.timestamp;
      if (age < SERVER_KECAMATAN_CACHE_TTL && serverKecamatanCache.rows.length > 0) {
        return res.json({
          success: true,
          count: serverKecamatanCache.rows.length,
          rows: serverKecamatanCache.rows,
          cached: true,
          message: `Memuat instan ${serverKecamatanCache.rows.length} baris dari server cache 7 kecamatan.`,
        });
      }
    }

    const cacheBuster = Date.now();
    // Concurrently fetch ONLY the 7 kecamatan sheets - strictly no rekap or summary sheets
    const kecResults = await Promise.all(
      KECAMATAN_SPECS.map(kec => fetchKecamatanRowsOnServer(spreadsheetId, kec, cacheBuster))
    );

    const allRows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> = [];
    const scannedSheets: string[] = [];

    kecResults.forEach((r, idx) => {
      if (r.success && r.rows.length > 0) {
        allRows.push(...r.rows);
        scannedSheets.push(r.matchedTab || KECAMATAN_SPECS[idx].name);
      }
    });

    if (allRows.length > 0) {
      serverKecamatanCache = {
        spreadsheetId,
        timestamp: Date.now(),
        rows: allRows,
      };
    }

    return res.json({
      success: true,
      count: allRows.length,
      rows: allRows,
      scannedSheets,
      cached: false,
      message: `Berhasil memuat ${allRows.length} baris data murni dari ke-7 sheet kecamatan.`,
    });
  } catch (err: any) {
    console.error('Error fetching kecamatan sheets on server:', err);
    return res.status(500).json({ success: false, message: 'Gagal membaca sheet kecamatan: ' + err.message, rows: [] });
  }
};

app.post('/api/sheets/kecamatan-raw', handleKecamatanRawFetch);
app.get('/api/sheets/kecamatan-raw', handleKecamatanRawFetch);

// ==========================================
// 2. API route to update Google Sheet config (called by Super Admin)
app.post('/api/config', (req, res) => {
  const { spreadsheetUrl, webhookUrl, driveFolderId } = req.body;
  const currentConfig = getGoogleSheetConfig();
  const config = {
    ...currentConfig,
    spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl : currentConfig.spreadsheetUrl,
    webhookUrl: webhookUrl !== undefined ? webhookUrl : currentConfig.webhookUrl,
    driveFolderId: driveFolderId !== undefined ? driveFolderId : currentConfig.driveFolderId,
  };

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    res.json({
      success: true,
      message: 'Konfigurasi Google Sheet & Drive berhasil disimpan di server!',
      config,
    });
  } catch (err: any) {
    console.error('Error saving google_sheet_config.json:', err);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan konfigurasi di server: ' + (err?.message || 'Error internal'),
    });
  }
});

// ==========================================
// PYTHON FAST ANALYTICS API (Permen PUPR)
// ==========================================
app.all('/api/analytics/python', (req, res) => {
  try {
    const assessments = req.body?.assessments || req.body || [];
    const inputList = Array.isArray(assessments) && assessments.length > 0
      ? assessments
      : getStoredAssessments();

    const scriptPath = path.join(process.cwd(), 'scripts', 'data_analyzer.py');

    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        success: false,
        message: 'Modul Python scripts/data_analyzer.py tidak ditemukan di server.',
      });
    }

    const pyProcess = spawn('python3', [scriptPath]);
    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python process failed with exit code:', code, stderrData);
        return res.status(500).json({
          success: false,
          message: 'Eksekusi analisis data Python gagal: ' + (stderrData || `Code ${code}`),
        });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        return res.json(parsed);
      } catch (parseErr: any) {
        return res.status(500).json({
          success: false,
          message: 'Gagal mem-parsing output JSON dari Python: ' + parseErr.message,
          rawOutput: stdoutData.substring(0, 500),
        });
      }
    });

    pyProcess.stdin.write(JSON.stringify(inputList));
    pyProcess.stdin.end();
  } catch (err: any) {
    console.error('Error invoking Python analytics:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memanggil Python engine: ' + (err?.message || 'Internal Error'),
    });
  }
});

// Setup Vite middleware or static serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
