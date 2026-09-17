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

// Enable CORS and OPTIONS handling for all endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
const BUFFER_QUEUE_FILE = path.join(DATA_DIR, 'buffer_queue.json');
const ACTIVE_SESSIONS_FILE = path.join(DATA_DIR, 'active_sessions.json');

const MAX_CONCURRENT_SURVEYORS = 15;
const SESSION_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes timeout without heartbeat

function isPriorityRole(role: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'super_admin' || r === 'admin' || r === 'admin_verifikator';
}

function getStoredActiveSessions(): any[] {
  try {
    if (fs.existsSync(ACTIVE_SESSIONS_FILE)) {
      const content = fs.readFileSync(ACTIVE_SESSIONS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading active sessions file:', err);
  }
  return [];
}

function saveStoredActiveSessions(sessions: any[]): boolean {
  try {
    fs.writeFileSync(ACTIVE_SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing active sessions file:', err);
    return false;
  }
}

function pruneStaleSessions(sessions: any[]): any[] {
  const now = Date.now();
  return sessions.filter((s) => s && s.sessionId && (now - (s.lastHeartbeat || 0) < SESSION_TIMEOUT_MS));
}

// Helper to safely load buffer queue from server file
function getStoredBufferQueue(): { items: any[]; lastProcessedTime?: string; nextRunTime?: string } {
  try {
    if (fs.existsSync(BUFFER_QUEUE_FILE)) {
      const content = fs.readFileSync(BUFFER_QUEUE_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch (err) {
    console.error('Error reading buffer queue file:', err);
  }
  const defaultNextRun = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { items: [], lastProcessedTime: undefined, nextRunTime: defaultNextRun };
}

// Helper to safely write buffer queue to server file
function saveStoredBufferQueue(data: { items: any[]; lastProcessedTime?: string; nextRunTime?: string }): boolean {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(BUFFER_QUEUE_FILE, jsonStr, 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing buffer queue file:', err);
    return false;
  }
}

// Internal processor for transferring buffer queue items to primary assessments list
function processBufferQueueInternal(): { processedCount: number; remainingCount: number; message: string } {
  try {
    const bufferData = getStoredBufferQueue();
    const pendingItems = bufferData.items.filter((item: any) => item && (item.status === 'pending_transfer' || !item.status));
    
    if (pendingItems.length === 0) {
      bufferData.nextRunTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      saveStoredBufferQueue(bufferData);
      return { processedCount: 0, remainingCount: 0, message: 'Tidak ada data antrean baru untuk diproses.' };
    }

    const currentList = getStoredAssessments();
    const fullAssessmentsToMerge = pendingItems.map((p: any) => p.assessmentData || p);
    const merged = deduplicateServerAssessments([...fullAssessmentsToMerge, ...currentList]);
    saveStoredAssessments(merged);

    // Update buffer items status or prune transferred ones
    const updatedItems = bufferData.items.map((item: any) => {
      if (item && (item.status === 'pending_transfer' || !item.status)) {
        return { ...item, status: 'transferred', transferredAt: new Date().toISOString() };
      }
      return item;
    });

    const nowIso = new Date().toISOString();
    const nextRunIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // Retain only last 50 transferred items for audit history
    const prunedItems = updatedItems.slice(-50);
    saveStoredBufferQueue({
      items: prunedItems,
      lastProcessedTime: nowIso,
      nextRunTime: nextRunIso,
    });

    console.log(`[BufferQueue] Successfully transferred ${pendingItems.length} items to primary assessment storage. Next scheduled run: ${nextRunIso}`);
    return {
      processedCount: pendingItems.length,
      remainingCount: 0,
      message: `Berhasil memindahkan ${pendingItems.length} data dari antrean sementara ke daftar penilaian utama.`,
    };
  } catch (err: any) {
    console.error('[BufferQueue] Error processing buffer queue:', err);
    return { processedCount: 0, remainingCount: 0, message: 'Gagal memproses antrean: ' + err.message };
  }
}

// Start 1-Hour Scheduled Batch Sync on server
setInterval(() => {
  console.log('[BufferQueue] 1-Hour automated batch timer triggered.');
  processBufferQueueInternal();
}, 60 * 60 * 1000);


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

// Safe deduplication for server-stored assessments by ID, Registration Code, Location, and Sheet Row
function deduplicateServerAssessments(list: any[]): any[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];
  const result: any[] = [];
  const keyToIdx = new Map<string, number>();

  for (const item of list) {
    if (!item) continue;

    const keys: string[] = [];
    if (item.id && String(item.id).trim()) {
      keys.push(`id:${String(item.id).trim()}`);
    }
    const rawCode = String(item.code || '').trim();
    if (rawCode && rawCode.length >= 3 && !rawCode.startsWith('REG-TEMP') && !rawCode.startsWith('REG-PREVIEW')) {
      keys.push(`code:${rawCode.toUpperCase()}`);
    }
    const cleanBldg = String(item.buildingName || '').toLowerCase().replace(/\s*\(baris\s+\d+\)/i, '').trim();
    const cleanKec = String(item.kecamatanName || item.kecamatanId || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanDesa = String(item.desaName || '').toLowerCase().trim();
    if (cleanBldg && cleanBldg.length >= 4 && !cleanBldg.startsWith('survei lapangan') && cleanKec) {
      keys.push(`loc_bldg:${cleanKec}::${cleanDesa || 'nodesa'}::${cleanBldg}`);
    }

    let matchIdx: number | undefined = undefined;
    for (const k of keys) {
      if (keyToIdx.has(k)) {
        matchIdx = keyToIdx.get(k);
        break;
      }
    }

    if (matchIdx !== undefined) {
      const existing = result[matchIdx];
      const areSameBldg = (existing.id && item.id && existing.id === item.id) ||
        (existing.code && item.code && existing.code === item.code) ||
        (existing.buildingName && item.buildingName && String(existing.buildingName).toLowerCase().trim() === String(item.buildingName).toLowerCase().trim());

      const mergedPhotos = areSameBldg
        ? [...(existing.photos || []), ...(item.photos || [])].filter((p, idx, arr) => arr.findIndex(x => (x.url || (x as any).dataUrl) === (p.url || (p as any).dataUrl)) === idx)
        : (new Date(item.updatedAt || item.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime() ? (item.photos || existing.photos || []) : (existing.photos || item.photos || []));

      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      
      const stableId = existing.id && !String(existing.id).startsWith('sheet_')
        ? existing.id
        : item.id && !String(item.id).startsWith('sheet_')
        ? item.id
        : item.id || existing.id;

      const stableCode = existing.code && !String(existing.code).startsWith('REG-TEMP')
        ? existing.code
        : item.code && !String(item.code).startsWith('REG-TEMP')
        ? item.code
        : item.code || existing.code;

      result[matchIdx] =
        incomingTime >= existingTime
          ? { ...existing, ...item, id: stableId, code: stableCode, photos: mergedPhotos }
          : { ...item, ...existing, id: stableId, code: stableCode, photos: mergedPhotos };

      for (const k of keys) {
        keyToIdx.set(k, matchIdx);
      }
    } else {
      const newIdx = result.length;
      result.push(item);
      for (const k of keys) {
        keyToIdx.set(k, newIdx);
      }
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

// Default Google Apps Script Webhook URL
const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec';

function extractSpreadsheetId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Helper to forward assessment to Google Apps Script Webhook automatically from server
async function forwardAssessmentToGoogleSheet(
  assessment: any,
  action: 'insert' | 'update' | 'delete' = 'insert',
  customConfig?: any,
  explicitTargetSheetName?: string
) {
  try {
    const config = customConfig || getGoogleSheetConfig();
    const webhookUrl = (config.webhookUrl && config.webhookUrl.startsWith('http')) ? config.webhookUrl : DEFAULT_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith('http')) return { success: false, message: 'URL Webhook belum diatur' };

    const ownerName = assessment.namaPemilikRumah || assessment.namaPemilikGedung || assessment.ownerAgency || '-';
    const kecName = assessment.kecamatanName || 'Aesesa';
    const targetSheetName = (explicitTargetSheetName || assessment.targetSheetName || `Kec. ${kecName}`).replace(/[:\\/?*\[\]]/g, '').trim().substring(0, 30);

    // Pemetaan 21 komponen individual
    const compMap: Record<string, number> = {};
    if (assessment.components && Array.isArray(assessment.components)) {
      assessment.components.forEach((c: any) => {
        if (c && c.id) compMap[c.id] = c.damagePercentInput || 0;
      });
    }

    const rowData: Record<string, any> = {
      'No Registrasi': assessment.code || assessment.id,
      'ID Penilaian': assessment.id,
      'Nama Bangunan': assessment.buildingName,
      'Kategori / Fungsi Bangunan': assessment.buildingCategory || 'Gedung Pemerintah',
      'Jenis Bencana': assessment.disasterType || 'Gempa Bumi',
      'Tanggal Bencana': assessment.disasterDate || '',
      'Tanggal Penilaian': assessment.assessmentDate || '',
      'Pengguna / Pemilik': ownerName,
      'Nama Pemilik Rumah': assessment.namaPemilikRumah || '-',
      'Nama Pemilik Gedung': assessment.namaPemilikGedung || '-',
      'NIK Pemilik': assessment.nikPemilik || '0',
      'No KK Pemilik': assessment.noKkPemilik || '0',
      'Dinas Teknis': assessment.responsibleDepartment || '',
      'Kelas Bangunan': assessment.buildingClass || '',
      'Kecamatan': assessment.kecamatanName || '',
      'Desa / Kelurahan': assessment.desaName || '',
      'Alamat Lengkap': assessment.detailedAddress || '',
      'Luas Lantai (M2)': assessment.totalFloorAreaM2 || 0,
      'Jumlah Tingkat': assessment.numberOfFloors || 1,
      'Tahun Dibangun': assessment.yearBuilt || 2020,
      'Tingkat Kerusakan (%)': assessment.totalDamagePercent || 0,
      'Klasifikasi Kerusakan': assessment.damageClassification || 'Rusak Ringan',
      // 21 Kolom Komponen Individual
      'Pondasi (%)': compMap['pondasi_1'] ?? 0,
      'Kolom & Balok (%)': compMap['struktur_kolom_balok'] ?? 0,
      'Struktur Plesteran (%)': compMap['struktur_plesteran'] ?? 0,
      'Atap Kuda-kuda (%)': compMap['atap_kuda_kuda'] ?? 0,
      'Atap Gording (%)': compMap['atap_gording'] ?? 0,
      'Atap Penutup (%)': compMap['atap_penutup'] ?? 0,
      'Rangka Langit (%)': compMap['langit_rangka'] ?? 0,
      'Penutup Langit (%)': compMap['langit_penutup'] ?? 0,
      'Dinding Bata (%)': compMap['dinding_bata'] ?? 0,
      'Dinding Plesteran (%)': compMap['dinding_plesteran'] ?? 0,
      'Dinding Kaca (%)': compMap['dinding_kaca'] ?? 0,
      'Dinding Pintu (%)': compMap['dinding_pintu'] ?? 0,
      'Dinding Kosen (%)': compMap['dinding_kosen'] ?? 0,
      'Penutup Lantai (%)': compMap['lantai_penutup'] ?? 0,
      'Instalasi Listrik (%)': compMap['utilitas_listrik'] ?? 0,
      'Instalasi Air (%)': compMap['utilitas_air'] ?? 0,
      'Drainase Limbah (%)': compMap['utilitas_drainase'] ?? 0,
      'Cat Struktur (%)': compMap['finishing_struktur'] ?? 0,
      'Cat Langit (%)': compMap['finishing_langit'] ?? 0,
      'Cat Dinding (%)': compMap['finishing_dinding'] ?? 0,
      'Cat Kosen Pintu (%)': compMap['finishing_kosen_pintu'] ?? 0,
      'HSBGN / M2 (Rp)': assessment.hsbgnPerM2 || 0,
      'Biaya Perawatan / M2 (Rp)': assessment.treatmentCostPerM2 || 0,
      'Biaya Bongkaran / M2 (Rp)': assessment.demolitionCostPerM2 || 0,
      'Total Biaya / M2 (Rp)': assessment.totalCostPerM2 || 0,
      'Ajuan Biaya Rehab (Rp)': assessment.roundedRehabCost || 0,
      'Format Rupiah': 'Rp ' + Number(assessment.roundedRehabCost || 0).toLocaleString('id-ID'),
      'Terbilang': assessment.costTerbilang || '',
      'Link Folder G-Drive (Backup Foto)': assessment.backupDriveUrl || '-',
      'Status Verifikasi': assessment.verificationStatus || 'Menunggu Verifikasi',
      'Diverifikasi Oleh': assessment.verifiedBy || '-',
      'Tanggal Verifikasi': assessment.verifiedAt ? new Date(assessment.verifiedAt).toLocaleDateString('id-ID') : '-',
      'Catatan Verifikator': assessment.verificationNotes || '-',
      'Jumlah Foto Kerusakan': Array.isArray(assessment.photos) ? assessment.photos.length : 0,
      'Link Folder Foto Google Drive': assessment.googleDriveFolderUrl || '-',
      'Surveyor / Petugas': assessment.createdByName || '-',
      'Kota Laporan': assessment.cityLocation || '',
      'Nama Kepala Dinas': assessment.headOfDepartment?.name || '-',
      'NIP Kepala Dinas': assessment.headOfDepartment?.nip || '-',
      'Tim Analisis': Array.isArray(assessment.analysisTeam) ? assessment.analysisTeam.join(', ') : '-',
      'Terakhir Diperbarui': new Date(assessment.updatedAt || Date.now()).toLocaleString('id-ID'),
    };

    const isExplicit = Boolean(explicitTargetSheetName && explicitTargetSheetName.trim());
    const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl) || undefined;
    const payload = {
      action,
      sheetName: explicitTargetSheetName || config.sheetName || 'REKAP_SEMUA_KECAMATAN',
      targetSheetName,
      kecamatanSheetName: targetSheetName,
      buildingName: assessment.buildingName,
      desaName: assessment.desaName,
      kecamatanName: assessment.kecamatanName,
      splitByKecamatan: isExplicit ? false : (config.splitByKecamatan !== false),
      includeMasterSummary: isExplicit ? false : (config.includeMasterSummarySheet !== false),
      spreadsheetUrl: config.spreadsheetUrl || '',
      spreadsheetId,
      assessmentId: assessment.id,
      registrationCode: assessment.code || assessment.id,
      previousRegistrationCode: assessment.code || assessment.id,
      data: rowData,
      photos: Array.isArray(assessment.photos) ? assessment.photos.map((p: any, idx: number) => ({
        id: p.id || `photo_${idx}`,
        caption: p.caption || '',
        damageLocation: p.damageLocation || `Foto ${idx + 1}`,
        url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/')) ? p.url : '',
      })) : [],
      savePhotosToDrive: false,
      timestamp: new Date().toISOString(),
    };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { status: resp.ok ? 'success' : 'error', message: responseText };
    }

    if (responseJson.status === 'error') {
      const errMsg = String(responseJson.message || '');
      console.warn(`[Server -> GoogleSheet] Google Apps Script notice for "${assessment.buildingName}":`, errMsg);

      // If document is too large / out of cells, try ultra-light single-tab fallback
      if (errMsg.includes('grown too large') || errMsg.includes('cannot be modified')) {
        try {
          const lightweightPayload = {
            action,
            targetSheetName,
            splitByKecamatan: false,
            includeMasterSummary: false,
            spreadsheetUrl: config.spreadsheetUrl || '',
            spreadsheetId,
            registrationCode: assessment.code || assessment.id,
            buildingName: assessment.buildingName,
            data: rowData,
            savePhotosToDrive: false,
            timestamp: new Date().toISOString(),
          };

          const fallbackResp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lightweightPayload),
          });
          const fbText = await fallbackResp.text();
          let fbJson: any = null;
          try { fbJson = JSON.parse(fbText); } catch { fbJson = { status: fallbackResp.ok ? 'success' : 'error', message: fbText }; }
          
          if (fbJson.status === 'success') {
            console.info(`[Server -> GoogleSheet] Lightweight fallback sync succeeded for "${assessment.buildingName}"`);
            return { success: true, message: fbJson.message || 'Berhasil disimpan melalui mode hemat kapasitas' };
          }
        } catch {}

        return {
          success: false,
          isDocumentTooLarge: true,
          message: 'Google Spreadsheet tujuan penuh / melebihi batas kapasitas Google Sheets ("The document cannot be modified. Perhaps it has grown too large?"). Silakan buka Google Sheet dan hapus baris-baris kosong berlebih di bawah tabel, atau gunakan Buku 2 (Spreadsheet Baru) di menu Pengaturan.',
        };
      }

      return { success: false, message: errMsg };
    }

    console.info(`[Server -> GoogleSheet] Synced "${assessment.buildingName}" (action: ${action}, target: ${targetSheetName}, status: ${resp.status})`);
    return { success: true, message: responseJson.message || 'Sinkronisasi Google Sheet berhasil' };
  } catch (err: any) {
    console.warn('[Server -> GoogleSheet] Auto-sync notice:', err?.message || err);
    return { success: false, message: err?.message || 'Gagal terhubung ke Google Apps Script Webhook' };
  }
}

// POST /api/google-sheet/sync - Proxy endpoint to execute Google Sheet sync and report exact status
app.post('/api/google-sheet/sync', async (req, res) => {
  try {
    const { assessment, action, targetSheetName, config: clientConfig } = req.body;
    if (!assessment) {
      return res.status(400).json({ success: false, message: 'Data assessment wajib diisi' });
    }
    const result = await forwardAssessmentToGoogleSheet(
      assessment,
      action || 'insert',
      clientConfig,
      targetSheetName
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
  }
});

// POST /api/google-sheet/sync-all - Proxy endpoint to execute bulk Google Sheet sync to all Kecamatan tabs
app.post('/api/google-sheet/sync-all', async (req, res) => {
  try {
    const { assessments, config: clientConfig } = req.body;
    if (!Array.isArray(assessments)) {
      return res.status(400).json({ success: false, message: 'Array assessments diperlukan' });
    }

    const config = clientConfig || getGoogleSheetConfig();
    const webhookUrl = (config.webhookUrl && config.webhookUrl.startsWith('http')) ? config.webhookUrl : DEFAULT_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.status(400).json({ success: false, message: 'URL Webhook Google Apps Script belum diatur.' });
    }

    const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl) || undefined;

    // Group by kecamatan and format
    const dataByKecamatan: Record<string, any[]> = {};
    const rows: any[] = [];

    for (const item of assessments) {
      if (!item || !item.buildingName) continue;
      const kecName = item.kecamatanName || 'Lainnya';
      const tabName = `Kec. ${kecName}`.replace(/[:\\/?*\[\]]/g, '').trim().substring(0, 30);

      const compMap: Record<string, number> = {};
      if (item.components && Array.isArray(item.components)) {
        item.components.forEach((c: any) => {
          if (c && c.id) compMap[c.id] = c.damagePercentInput || 0;
        });
      }

      const ownerName = item.namaPemilikRumah || item.namaPemilikGedung || item.ownerAgency || '-';
      const rowData = {
        'No Registrasi': item.code || item.id,
        'Nama Bangunan': item.buildingName,
        'Kategori / Fungsi Bangunan': item.buildingCategory || 'Gedung Pemerintah',
        'Jenis Bencana': item.disasterType || 'Gempa Bumi',
        'Tanggal Bencana': item.disasterDate || '',
        'Tanggal Penilaian': item.assessmentDate || '',
        'Pengguna / Pemilik': ownerName,
        'Nama Pemilik Rumah': item.namaPemilikRumah || '-',
        'Nama Pemilik Gedung': item.namaPemilikGedung || '-',
        'NIK Pemilik': item.nikPemilik || '0',
        'No KK Pemilik': item.noKkPemilik || '0',
        'Dinas Teknis': item.responsibleDepartment || '',
        'Kelas Bangunan': item.buildingClass || '',
        'Kecamatan': item.kecamatanName || '',
        'Desa / Kelurahan': item.desaName || '',
        'Alamat Lengkap': item.detailedAddress || '',
        'Luas Lantai (M2)': item.totalFloorAreaM2 || 0,
        'Jumlah Tingkat': item.numberOfFloors || 1,
        'Tahun Dibangun': item.yearBuilt || 2020,
        'Tingkat Kerusakan (%)': item.totalDamagePercent || 0,
        'Klasifikasi Kerusakan': item.damageClassification || 'Rusak Ringan',
        'Pondasi (%)': compMap['pondasi_1'] ?? 0,
        'Kolom & Balok (%)': compMap['struktur_kolom_balok'] ?? 0,
        'Struktur Plesteran (%)': compMap['struktur_plesteran'] ?? 0,
        'Atap Kuda-kuda (%)': compMap['atap_kuda_kuda'] ?? 0,
        'Atap Gording (%)': compMap['atap_gording'] ?? 0,
        'Atap Penutup (%)': compMap['atap_penutup'] ?? 0,
        'Rangka Langit (%)': compMap['langit_rangka'] ?? 0,
        'Penutup Langit (%)': compMap['langit_penutup'] ?? 0,
        'Dinding Bata (%)': compMap['dinding_bata'] ?? 0,
        'Dinding Plesteran (%)': compMap['dinding_plesteran'] ?? 0,
        'Dinding Kaca (%)': compMap['dinding_kaca'] ?? 0,
        'Dinding Pintu (%)': compMap['dinding_pintu'] ?? 0,
        'Dinding Kosen (%)': compMap['dinding_kosen'] ?? 0,
        'Penutup Lantai (%)': compMap['lantai_penutup'] ?? 0,
        'Instalasi Listrik (%)': compMap['utilitas_listrik'] ?? 0,
        'Instalasi Air (%)': compMap['utilitas_air'] ?? 0,
        'Drainase Limbah (%)': compMap['utilitas_drainase'] ?? 0,
        'Cat Struktur (%)': compMap['finishing_struktur'] ?? 0,
        'Cat Langit (%)': compMap['finishing_langit'] ?? 0,
        'Cat Dinding (%)': compMap['finishing_dinding'] ?? 0,
        'Cat Kosen Pintu (%)': compMap['finishing_kosen_pintu'] ?? 0,
        'HSBGN / M2 (Rp)': item.hsbgnPerM2 || 0,
        'Biaya Perawatan / M2 (Rp)': item.treatmentCostPerM2 || 0,
        'Biaya Bongkaran / M2 (Rp)': item.demolitionCostPerM2 || 0,
        'Total Biaya / M2 (Rp)': item.totalCostPerM2 || 0,
        'Ajuan Biaya Rehab (Rp)': item.roundedRehabCost || 0,
        'Format Rupiah': 'Rp ' + Number(item.roundedRehabCost || 0).toLocaleString('id-ID'),
        'Terbilang': item.costTerbilang || '',
        'Link Folder G-Drive (Backup Foto)': item.backupDriveUrl || '-',
        'Status Verifikasi': item.verificationStatus || 'Menunggu Verifikasi',
        'Diverifikasi Oleh': item.verifiedBy || '-',
        'Tanggal Verifikasi': item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString('id-ID') : '-',
        'Catatan Verifikator': item.verificationNotes || '-',
        'Jumlah Foto Kerusakan': Array.isArray(item.photos) ? item.photos.length : 0,
        'Link Folder Foto Google Drive': item.googleDriveFolderUrl || '-',
        'Surveyor / Petugas': item.createdByName || '-',
        'Kota Laporan': item.cityLocation || '',
        'Nama Kepala Dinas': item.headOfDepartment?.name || '-',
        'NIP Kepala Dinas': item.headOfDepartment?.nip || '-',
        'Tim Analisis': Array.isArray(item.analysisTeam) ? item.analysisTeam.join(', ') : '-',
        'Terakhir Diperbarui': new Date(item.updatedAt || Date.now()).toLocaleString('id-ID'),
      };

      rows.push(rowData);
      if (!dataByKecamatan[tabName]) {
        dataByKecamatan[tabName] = [];
      }
      dataByKecamatan[tabName].push(rowData);
    }

    const payload = {
      action: 'sync_all',
      sheetName: config.sheetName || 'REKAP_SEMUA_KECAMATAN',
      splitByKecamatan: config.splitByKecamatan !== false,
      includeMasterSummary: config.includeMasterSummarySheet !== false,
      spreadsheetUrl: config.spreadsheetUrl || '',
      spreadsheetId,
      data: rows,
      dataByKecamatan,
      timestamp: new Date().toISOString(),
    };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await resp.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { status: resp.ok ? 'success' : 'error', message: responseText };
    }

    if (responseJson.status === 'error') {
      return res.status(502).json({ success: false, message: responseJson.message || 'Google Apps Script mengembalikan status galat.' });
    }

    return res.json({
      success: true,
      count: rows.length,
      kecamatanCount: Object.keys(dataByKecamatan).length,
      message: responseJson.message || `Berhasil menyinkronkan ${rows.length} data ke Google Sheet!`,
      details: responseJson,
    });
  } catch (err: any) {
    console.error('[Server -> GoogleSheet SyncAll] Error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Gagal terhubung ke Google Apps Script Webhook' });
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

    // Auto-forward to Google Sheet Webhook asynchronously from server
    forwardAssessmentToGoogleSheet(assessment, 'insert').catch(() => {});

    return res.json({
      success: true,
      count: updatedList.length,
      assessment: updatedList.find((a) => a.id === assessment.id) || assessment,
      message: 'Data penilaian berhasil disimpan di server & diteruskan ke Google Sheet!',
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
    const targetItem = currentList.find((a) => a.id === id);
    const filtered = currentList.filter((a) => a.id !== id);
    saveStoredAssessments(filtered);

    if (targetItem) {
      forwardAssessmentToGoogleSheet(targetItem, 'delete').catch(() => {});
    }

    return res.json({
      success: true,
      deletedId: id,
      remainingCount: filtered.length,
      message: 'Data penilaian berhasil dihapus dari server & Google Sheet',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus penilaian: ' + err.message });
  }
});

// ==========================================
// BUFFER QUEUE API (1-Hour Staging & Batch Overhaul)
// ==========================================

// GET /api/buffer-queue - Fetch status of staging buffer queue
app.get('/api/buffer-queue', (req, res) => {
  try {
    const bufferData = getStoredBufferQueue();
    const pendingItems = bufferData.items.filter((item: any) => item && (item.status === 'pending_transfer' || !item.status));
    return res.json({
      success: true,
      enabled: true,
      pendingCount: pendingItems.length,
      items: bufferData.items,
      nextRunTime: bufferData.nextRunTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      lastProcessedTime: bufferData.lastProcessedTime,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data antrean: ' + err.message });
  }
});

// POST /api/buffer-queue/add - Push a new survey to the staging buffer
app.post('/api/buffer-queue/add', (req, res) => {
  try {
    const { assessment, submittedBy } = req.body;
    if (!assessment || !assessment.id) {
      return res.status(400).json({ success: false, message: 'Data assessment valid diperlukan' });
    }

    const bufferData = getStoredBufferQueue();
    const existingIdx = bufferData.items.findIndex((item: any) => item.id === assessment.id);
    
    const bufferItem = {
      id: assessment.id,
      registrationCode: assessment.code || assessment.registrationCode || '',
      buildingName: assessment.buildingName || '',
      kecamatanName: assessment.kecamatanName || assessment.kecamatan || '',
      desaName: assessment.desaName || assessment.village || '',
      submittedAt: new Date().toISOString(),
      submittedBy: submittedBy || assessment.surveyorName || 'Surveyor',
      damageClassification: assessment.damageClassification || '',
      status: 'pending_transfer',
      assessmentData: assessment,
    };

    if (existingIdx >= 0) {
      bufferData.items[existingIdx] = bufferItem;
    } else {
      bufferData.items.push(bufferItem);
    }

    // Also persist immediately to assessments.json so client UI sees it in local survey list without lag
    const currentList = getStoredAssessments();
    const merged = deduplicateServerAssessments([assessment, ...currentList]);
    saveStoredAssessments(merged);

    saveStoredBufferQueue(bufferData);

    const pendingCount = bufferData.items.filter((item: any) => item.status === 'pending_transfer').length;
    return res.json({
      success: true,
      message: `Data gedung "${assessment.buildingName}" berhasil ditampung di antrean sementara (${pendingCount} antrean aktif).`,
      pendingCount,
      item: bufferItem,
      nextRunTime: bufferData.nextRunTime,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan ke antrean: ' + err.message });
  }
});

// POST /api/buffer-queue/process - Manually or automatically trigger transfer from buffer to primary list & sheets
app.post('/api/buffer-queue/process', (req, res) => {
  try {
    const result = processBufferQueueInternal();
    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memproses antrean: ' + err.message });
  }
});

// POST /api/buffer-queue/clear - Clear processed items
app.post('/api/buffer-queue/clear', (req, res) => {
  try {
    const bufferData = getStoredBufferQueue();
    bufferData.items = bufferData.items.filter((item: any) => item && item.status === 'pending_transfer');
    saveStoredBufferQueue(bufferData);
    return res.json({
      success: true,
      message: 'Riwayat antrean yang telah diproses berhasil dibersihkan.',
      remainingPending: bufferData.items.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal membersihkan antrean: ' + err.message });
  }
});

// ==========================================
// CONCURRENT SURVEYOR QUOTA & SESSION MANAGER
// ==========================================

// GET /api/sessions/status - Get current active sessions summary
app.get('/api/sessions/status', (req, res) => {
  try {
    const sessions = pruneStaleSessions(getStoredActiveSessions());
    saveStoredActiveSessions(sessions);

    const activeSurveyors = sessions.filter((s) => !s.isPriority).length;
    const activePriorityUsers = sessions.filter((s) => s.isPriority).length;

    return res.json({
      success: true,
      activeSurveyors,
      maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
      activePriorityUsers,
      availableSurveyorSlots: Math.max(0, MAX_CONCURRENT_SURVEYORS - activeSurveyors),
      activeSessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        userName: s.userName,
        role: s.role,
        isPriority: s.isPriority,
        loginAt: s.loginAt,
        lastHeartbeatAgoSec: Math.round((Date.now() - s.lastHeartbeat) / 1000),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memeriksa status sesi: ' + err.message });
  }
});

// POST /api/sessions/acquire - Acquire an active session slot
app.post('/api/sessions/acquire', (req, res) => {
  try {
    const { sessionId, userId, userName, userEmail, role, deviceInfo } = req.body;
    if (!sessionId || !role) {
      return res.status(400).json({ success: false, message: 'sessionId dan role diperlukan' });
    }

    let sessions = pruneStaleSessions(getStoredActiveSessions());
    const isPriority = isPriorityRole(role);
    const existingIdx = sessions.findIndex((s) => s.sessionId === sessionId);

    if (isPriority) {
      // Super Admin, Admin, and Verifikator ALWAYS have immediate guaranteed access
      const sessionObj = {
        sessionId,
        userId: userId || 'priority_user',
        userName: userName || 'Admin/Verifikator',
        userEmail: userEmail || '',
        role,
        isPriority: true,
        lastHeartbeat: Date.now(),
        loginAt: existingIdx >= 0 ? sessions[existingIdx].loginAt : new Date().toISOString(),
        deviceInfo: deviceInfo || '',
      };

      if (existingIdx >= 0) {
        sessions[existingIdx] = sessionObj;
      } else {
        sessions.push(sessionObj);
      }

      saveStoredActiveSessions(sessions);
      const activeSurveyors = sessions.filter((s) => !s.isPriority).length;
      const activePriority = sessions.filter((s) => s.isPriority).length;

      return res.json({
        success: true,
        allowed: true,
        isPriority: true,
        reason: 'PRIORITY_GRANTED',
        activeSurveyors,
        maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
        activePriorityUsers: activePriority,
        message: 'Akses prioritas administrator/verifikator aktif tanpa batasan kuota antrean.',
      });
    }

    // Surveyor Role (e.g. Kabnagekeo, admin_user, admin_publik)
    const activeSurveyorsList = sessions.filter((s) => !s.isPriority);
    const alreadyActive = activeSurveyorsList.some((s) => s.sessionId === sessionId);

    if (alreadyActive) {
      // Refresh heartbeat for currently holding session
      if (existingIdx >= 0) {
        sessions[existingIdx].lastHeartbeat = Date.now();
        sessions[existingIdx].userName = userName || sessions[existingIdx].userName;
        saveStoredActiveSessions(sessions);
      }
      return res.json({
        success: true,
        allowed: true,
        isPriority: false,
        reason: 'ACTIVE',
        activeSurveyors: activeSurveyorsList.length,
        maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
        message: 'Sesi surveyor Anda aktif.',
      });
    }

    // New surveyor session requesting slot
    if (activeSurveyorsList.length >= MAX_CONCURRENT_SURVEYORS) {
      // Quota is full!
      return res.json({
        success: true,
        allowed: false,
        isPriority: false,
        reason: 'QUOTA_FULL',
        activeSurveyors: activeSurveyorsList.length,
        maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
        waitingEstimatedMinutes: 2,
        message: `Mohon Maaf, Kuota Akses Surveyor Sedang Penuh (Maksimal ${MAX_CONCURRENT_SURVEYORS} Surveyor Aktif Bersamaan). Sistem menjaga kestabilan Google Sheet. Mohon menunggu beberapa saat hingga rekan surveyor selesai input data atau logout.`,
      });
    }

    // Grant new surveyor slot
    const newSurveyorSession = {
      sessionId,
      userId: userId || 'surveyor',
      userName: userName || 'Surveyor Lapangan',
      userEmail: userEmail || '',
      role,
      isPriority: false,
      lastHeartbeat: Date.now(),
      loginAt: new Date().toISOString(),
      deviceInfo: deviceInfo || '',
    };

    sessions.push(newSurveyorSession);
    saveStoredActiveSessions(sessions);

    return res.json({
      success: true,
      allowed: true,
      isPriority: false,
      reason: 'ACTIVE',
      activeSurveyors: activeSurveyorsList.length + 1,
      maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
      message: `Sesi surveyor berhasil diberikan (Slot ${activeSurveyorsList.length + 1} dari ${MAX_CONCURRENT_SURVEYORS}).`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengalokasikan sesi: ' + err.message });
  }
});

// POST /api/sessions/heartbeat - Keep active session alive
app.post('/api/sessions/heartbeat', (req, res) => {
  try {
    const { sessionId, role, userName } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId diperlukan' });
    }

    let sessions = pruneStaleSessions(getStoredActiveSessions());
    const idx = sessions.findIndex((s) => s.sessionId === sessionId);

    if (idx >= 0) {
      sessions[idx].lastHeartbeat = Date.now();
      if (userName) sessions[idx].userName = userName;
      saveStoredActiveSessions(sessions);

      const activeSurveyors = sessions.filter((s) => !s.isPriority).length;
      return res.json({
        success: true,
        allowed: true,
        isPriority: sessions[idx].isPriority,
        activeSurveyors,
        maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
      });
    }

    // If session was pruned due to inactivity, check if can re-acquire
    const isPriority = isPriorityRole(role);
    const activeSurveyors = sessions.filter((s) => !s.isPriority).length;

    if (isPriority || activeSurveyors < MAX_CONCURRENT_SURVEYORS) {
      const restored = {
        sessionId,
        userId: 'restored_user',
        userName: userName || 'Pengguna',
        role: role || 'admin_user',
        isPriority,
        lastHeartbeat: Date.now(),
        loginAt: new Date().toISOString(),
      };
      sessions.push(restored);
      saveStoredActiveSessions(sessions);
      return res.json({
        success: true,
        allowed: true,
        isPriority,
        activeSurveyors: sessions.filter((s) => !s.isPriority).length,
        maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
      });
    }

    return res.json({
      success: true,
      allowed: false,
      reason: 'QUOTA_FULL',
      activeSurveyors,
      maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
      message: 'Sesi kadaluarsa dan kuota surveyor saat ini telah penuh.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui heartbeat: ' + err.message });
  }
});

// POST /api/sessions/release - Explicitly release active session (on logout or tab close)
app.post('/api/sessions/release', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.json({ success: true, message: 'Tidak ada sessionId untuk dilepas' });
    }

    let sessions = getStoredActiveSessions();
    const prevCount = sessions.length;
    sessions = sessions.filter((s) => s.sessionId !== sessionId);
    saveStoredActiveSessions(sessions);

    console.log(`[Sessions] Released session ${sessionId}. Active total: ${sessions.length} (was ${prevCount})`);
    return res.json({
      success: true,
      message: 'Sesi berhasil dilepas',
      activeSurveyors: sessions.filter((s) => !s.isPriority).length,
      maxSurveyorQuota: MAX_CONCURRENT_SURVEYORS,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal melepas sesi: ' + err.message });
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
      const parsed = JSON.parse(data);
      return {
        spreadsheetUrl: parsed.spreadsheetUrl || process.env.VITE_SPREADSHEET_URL || '',
        webhookUrl: parsed.webhookUrl || process.env.VITE_WEBHOOK_URL || DEFAULT_WEBHOOK_URL,
        driveFolderId: parsed.driveFolderId || process.env.VITE_DRIVE_FOLDER_ID || 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
        sheetName: parsed.sheetName || 'REKAP_SEMUA_KECAMATAN',
        splitByKecamatan: parsed.splitByKecamatan !== false,
        includeMasterSummarySheet: parsed.includeMasterSummarySheet !== false,
        spreadsheetProfiles: parsed.spreadsheetProfiles || [
          {
            id: 'profile_default_1',
            name: 'Buku 1: Utama / Kab. Nagekeo',
            spreadsheetUrl: parsed.spreadsheetUrl || process.env.VITE_SPREADSHEET_URL || '',
            pageNumber: 1,
            capacityStatus: 'Normal',
            estimatedRowCount: 0,
            maxCapacityRows: 500,
            isDefault: true,
          }
        ],
        activeProfileId: parsed.activeProfileId || 'profile_default_1',
      };
    }
  } catch (err) {
    console.error('Error reading google_sheet_config.json:', err);
  }
  return {
    spreadsheetUrl: process.env.VITE_SPREADSHEET_URL || '',
    webhookUrl: process.env.VITE_WEBHOOK_URL || DEFAULT_WEBHOOK_URL,
    driveFolderId: process.env.VITE_DRIVE_FOLDER_ID || 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
    sheetName: 'REKAP_SEMUA_KECAMATAN',
    splitByKecamatan: true,
    includeMasterSummarySheet: true,
    spreadsheetProfiles: [
      {
        id: 'profile_default_1',
        name: 'Buku 1: Utama / Kab. Nagekeo',
        spreadsheetUrl: process.env.VITE_SPREADSHEET_URL || '',
        pageNumber: 1,
        capacityStatus: 'Normal',
        estimatedRowCount: 0,
        maxCapacityRows: 500,
        isDefault: true,
      }
    ],
    activeProfileId: 'profile_default_1',
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
  { name: 'Aesesa', aliases: ['Kec. Aesesa', 'Kec Aesesa', 'Kec.Aesesa', 'KEC. AESESA', 'KECAMATAN AESESA', 'KEC AESESA'] },
  { name: 'Aesesa Selatan', aliases: ['Kec. Aesesa Selatan', 'Kec Aesesa Selatan', 'Kec.Aesesa Selatan', 'KEC. AESESA SELATAN', 'KECAMATAN AESESA SELATAN', 'KEC AESESA SELATAN'] },
  { name: 'Boawae', aliases: ['Kec. Boawae', 'Kec Boawae', 'Kec.Boawae', 'KEC. BOAWAE', 'KECAMATAN BOAWAE', 'KEC BOAWAE'] },
  { name: 'Mauponggo', aliases: ['Kec. Mauponggo', 'Kec Mauponggo', 'Kec.Mauponggo', 'KEC. MAUPONGGO', 'KECAMATAN MAUPONGGO', 'KEC MAUPONGGO'] },
  { name: 'Nangaroro', aliases: ['Kec. Nangaroro', 'Kec Nangaroro', 'Kec.Nangaroro', 'KEC. NANGARORO', 'KECAMATAN NANGARORO', 'KEC NANGARORO'] },
  { name: 'Keo Tengah', aliases: ['Kec. Keo Tengah', 'Kec Keo Tengah', 'Kec.Keo Tengah', 'KEC. KEO TENGAH', 'KECAMATAN KEO TENGAH', 'KEC KEO TENGAH'] },
  { name: 'Wolowae', aliases: ['Kec. Wolowae', 'Kec Wolowae', 'Kec.Wolowae', 'KEC. WOLOWAE', 'KECAMATAN WOLOWAE', 'KEC WOLOWAE'] },
];

function isMasterRekapFallbackServer(
  parsedRows: Array<{ rowObj: Record<string, any> }>,
  currentKecName: string
): boolean {
  if (!parsedRows || parsedRows.length === 0) return false;
  const distinctOtherKecs = new Set<string>();
  const currentNorm = currentKecName.toLowerCase().trim();

  const allOtherKecNames = [
    'aesesa',
    'aesesa selatan',
    'boawae',
    'mauponggo',
    'nangaroro',
    'keo tengah',
    'wolowae',
  ].filter((k) => {
    if (currentNorm === 'aesesa') return k !== 'aesesa';
    if (currentNorm === 'aesesa selatan') return k !== 'aesesa selatan';
    return k !== currentNorm;
  });

  parsedRows.forEach((r) => {
    const rawKec = String(
      r.rowObj['Kecamatan'] ||
      r.rowObj['Kec'] ||
      r.rowObj['Wilayah Kecamatan'] ||
      r.rowObj['Nama Kecamatan'] ||
      ''
    ).toLowerCase().trim();

    if (rawKec) {
      for (const other of allOtherKecNames) {
        if (other === 'aesesa' && rawKec.includes('aesesa selatan')) continue;
        if (other === 'aesesa selatan' && !rawKec.includes('selatan')) continue;
        if (rawKec.includes(other)) {
          distinctOtherKecs.add(other);
        }
      }
    }
  });

  return distinctOtherKecs.size >= 3;
}

function parseServerGvizTextToRows(rawText: string, sheetName: string): Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> {
  if (!rawText || !rawText.includes('google.visualization.Query.setResponse')) return [];
  const clean = (sheetName || '').trim().toUpperCase().replace(/[\s_-]+/g, '_');
  // Only exclude purely administrative non-assessment metadata tabs
  if (
    clean === 'PENGGUNA' ||
    clean === 'DAFTAR_PENGGUNA' ||
    clean === 'LOG_PENGGUNA' ||
    clean === 'LOG_AKTIVITAS' ||
    clean === 'REFERENSI_WILAYAH' ||
    clean === 'RINGKASAN_EKSEKUTIF'
  ) {
    return [];
  }
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
): Promise<{ success: boolean; rows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }>; matchedTabs: string[] }> {
  // Probe both the standard active tab ("Kec. <Nama>") and archive tab ("Kec <Nama>")
  const candidateTabs = Array.from(
    new Set([`Kec. ${kec.name}`, `Kec ${kec.name}`, ...kec.aliases])
  ).filter((a) => a.toLowerCase().startsWith('kec'));

  const collectedRows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> = [];
  const matchedTabs: string[] = [];

  const fetchSingleAliasWithRetry = async (alias: string): Promise<{ rows: any[]; matchedTab: string } | null> => {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(alias)}&_t=${cacheBuster}`;

    // Try up to 2 times with backoff on 429
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        clearTimeout(timeout);

        if (resp.status === 429) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        if (!resp.ok) return null;
        const text = await resp.text();
        const parsed = parseServerGvizTextToRows(text, alias);
        if (parsed.length === 0) return null;

        return { rows: parsed, matchedTab: alias };
      } catch {
        clearTimeout(timeout);
      }
    }
    return null;
  };

  // Stop after finding the first valid matching tab for this Kecamatan
  for (const alias of candidateTabs) {
    const res = await fetchSingleAliasWithRetry(alias);
    if (res && res.rows.length > 0) {
      collectedRows.push(...res.rows);
      matchedTabs.push(res.matchedTab);
      break; // Found the active tab for this kecamatan, do NOT duplicate with aliases!
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  return { success: collectedRows.length > 0, rows: collectedRows, matchedTabs };
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

    if (forceRefresh) {
      serverKecamatanCache = null;
    }

    // In-memory cache hit (5 seconds for high responsiveness during active input)
    if (!forceRefresh && serverKecamatanCache && serverKecamatanCache.spreadsheetId === spreadsheetId) {
      const age = Date.now() - serverKecamatanCache.timestamp;
      if (age < 5000 && serverKecamatanCache.rows.length > 0) {
        return res.json({
          success: true,
          count: serverKecamatanCache.rows.length,
          rows: serverKecamatanCache.rows,
          cached: true,
          message: `Memuat instan ${serverKecamatanCache.rows.length} baris dari server cache.`,
        });
      }
    }

    const cacheBuster = Date.now();
    const allRows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet: string }> = [];
    const scannedSheets: string[] = [];

    // Sequentially fetch kecamatan sheets (both active and archive tabs)
    for (const kec of KECAMATAN_SPECS) {
      try {
        const resKec = await fetchKecamatanRowsOnServer(spreadsheetId, kec, cacheBuster);
        if (resKec.success && resKec.rows.length > 0) {
          allRows.push(...resKec.rows);
          scannedSheets.push(...resKec.matchedTabs);
        }
      } catch (err) {
        console.warn(`Server queue notice for ${kec.name}:`, err);
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    // Fallback: If no rows found from kecamatan tabs, probe gid or operational tabs
    const extraTargetUrls: Array<{ url: string; label: string }> = [];
    if (allRows.length === 0) {
      const gidMatch = spreadsheetUrl.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : null;
      if (gid) {
        extraTargetUrls.push({
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?gid=${encodeURIComponent(gid)}&_t=${cacheBuster}`,
          label: `Sheet (gid=${gid})`,
        });
      }

      // Common custom/operational tab names
      const commonOperationalTabs = [
        'Data_Terverifikasi',
        'Data Terverifikasi',
        'Data_Kerusakan',
        'Data Kerusakan',
        'Data_Penilaian',
        'Data Penilaian',
        'Survei',
        'Survei Lapangan',
        'Sheet1',
      ];

      for (const tab of commonOperationalTabs) {
        extraTargetUrls.push({
          url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(tab)}&_t=${cacheBuster}`,
          label: tab,
        });
      }
      extraTargetUrls.push({
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?_t=${cacheBuster}`,
        label: 'Sheet Utama',
      });
    }

    for (const target of extraTargetUrls) {
      if (scannedSheets.includes(target.label)) continue;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(target.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const text = await resp.text();
          const parsed = parseServerGvizTextToRows(text, target.label);
          if (parsed.length > 0) {
            allRows.push(...parsed);
            scannedSheets.push(target.label);
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 60));
    }

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
      message: `Berhasil memuat ${allRows.length} baris data murni dari ke-7 sheet kecamatan via antrian teratur.`,
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
  const { spreadsheetUrl, webhookUrl, driveFolderId, spreadsheetProfiles, activeProfileId } = req.body;
  const currentConfig = getGoogleSheetConfig();
  const config = {
    ...currentConfig,
    spreadsheetUrl: spreadsheetUrl !== undefined ? spreadsheetUrl : currentConfig.spreadsheetUrl,
    webhookUrl: webhookUrl !== undefined ? webhookUrl : currentConfig.webhookUrl,
    driveFolderId: driveFolderId !== undefined ? driveFolderId : currentConfig.driveFolderId,
    spreadsheetProfiles: spreadsheetProfiles !== undefined ? spreadsheetProfiles : currentConfig.spreadsheetProfiles,
    activeProfileId: activeProfileId !== undefined ? activeProfileId : currentConfig.activeProfileId,
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
