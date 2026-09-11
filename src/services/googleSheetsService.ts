import * as XLSX from 'xlsx';
import { BuildingAssessment, GoogleSheetConfig, Kecamatan, UserActivityLog, UserAccount } from '../types';
import { INITIAL_DESA } from '../data/initialData';
import { formatRupiah, getInitialSubComponents } from '../utils/puprCalculations';
import { hydrateAssessmentPhotos } from '../utils/imageCompressor';
import { getPhotoLocally } from '../utils/photoStorage';

/**
 * Guarantees a valid Data URL / Base64 string for any photo record regardless of where it is cached
 */
export async function ensurePhotoDataBase64(photo: any): Promise<string> {
  if (!photo) return '';
  if (photo.dataBase64 && typeof photo.dataBase64 === 'string' && photo.dataBase64.startsWith('data:')) {
    return photo.dataBase64;
  }
  if (photo.url && typeof photo.url === 'string' && photo.url.startsWith('data:')) {
    return photo.url;
  }
  if (photo.id) {
    try {
      const local = await getPhotoLocally(photo.id);
      if (local && local.startsWith('data:')) {
        return local;
      }
    } catch {}
  }
  if (photo.url && typeof photo.url === 'string' && (photo.url.startsWith('/uploads/') || photo.url.startsWith('http'))) {
    try {
      const res = await fetch(photo.url);
      if (res.ok) {
        const blob = await res.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      return '';
    }
  }
  return '';
}

export interface GoogleSheetRowPayload {
  action: 'insert' | 'update' | 'delete' | 'sync_all' | 'ping' | 'sync_activity_logs' | 'log_user_access' | 'test_drive' | 'consolidate_sheets';
  sheetName: string;
  logSheetName?: string;
  kecamatanSheetName?: string;
  targetSheetName?: string;
  buildingName?: string;
  desaName?: string;
  kecamatanName?: string;
  sheetRowNumber?: number;
  splitByKecamatan?: boolean;
  includeMasterSummary?: boolean;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  registrationCode?: string;
  previousRegistrationCode?: string;
  data?: Record<string, any> | Record<string, any>[];
  dataByKecamatan?: Record<string, Record<string, any>[]>;
  photos?: {
    id: string;
    caption: string;
    damageLocation?: string;
    url?: string;
    dataBase64?: string;
  }[];
  savePhotosToDrive?: boolean;
  driveFolderId?: string;
  timestamp: string;
}

/**
 * Extracts Google Spreadsheet ID from a standard Google Sheets URL
 */
export function extractSpreadsheetId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Checks if the Google Spreadsheet URL is configured and not the dummy/example placeholder.
 */
export function isConfiguredSheetUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return false;
  if (trimmed.includes('ContohSheetGedungPUPR') || trimmed.includes('example.com')) return false;
  return trimmed.includes('docs.google.com/spreadsheets');
}

/**
 * Extracts Google Drive Folder ID from various URL formats or returns the raw ID
 * Supports:
 * - https://drive.google.com/drive/folders/1BxiMVs0XRA5nFM...
 * - https://drive.google.com/drive/u/0/folders/1BxiMVs0XRA5nFM...
 * - https://drive.google.com/drive/u/1/folders/1BxiMVs0XRA5nFM...
 * - https://drive.google.com/open?id=1BxiMVs0XRA5nFM...
 * - Raw ID: 1BxiMVs0XRA5nFM...
 */
export function extractDriveFolderId(input?: string): string {
  if (!input) return '';
  const str = input.trim();
  // If already clean ID (at least 15 alphanumeric, hyphens or underscores, no slashes)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) {
    return str;
  }
  // Match /folders/([a-zA-Z0-9_-]+)
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }
  // Match ?id=([a-zA-Z0-9_-]+)
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  // If user pasted a URL, strip domain
  if (str.startsWith('http')) {
    return str.replace(/^https?:\/\/[^\/]+\//, '').split('?')[0].replace(/^folders\//, '').replace(/\/+$/, '').trim();
  }
  return str;
}

/**
 * Returns full Google Drive folder URL from a folder ID or URL
 */
export function getDriveFolderUrl(idOrUrl?: string): string {
  if (!idOrUrl) return '';
  const str = idOrUrl.trim();
  if (str.startsWith('http')) return str;
  const id = extractDriveFolderId(str);
  if (id && /^[a-zA-Z0-9_-]{15,}$/.test(id) && !id.includes('/')) {
    return `https://drive.google.com/drive/folders/${id}`;
  }
  return '';
}

/**
 * Sanitize string for valid Excel / Google Sheet tab names (max 31 chars, no special characters like : \ / ? * [ ])
 */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*\[\]]/g, '').trim();
  return cleaned.length > 30 ? cleaned.substring(0, 30) : cleaned;
}

/**
 * Formats assessment data into tabular row columns for Google Sheets & Excel
 */
export function formatAssessmentForGoogleSheet(item: BuildingAssessment) {
  const ownerName = item.namaPemilikRumah || item.namaPemilikGedung || item.ownerAgency || '-';
  return {
    'No Registrasi': item.code || item.id,
    'Nama Bangunan': item.buildingName,
    'Kategori / Fungsi Bangunan': item.buildingCategory || 'Gedung Pemerintah',
    'Jenis Bencana': item.disasterType,
    'Tanggal Bencana': item.disasterDate,
    'Tanggal Penilaian': item.assessmentDate,
    'Pengguna / Pemilik': ownerName,
    'Nama Pemilik Rumah': item.namaPemilikRumah || '-',
    'Nama Pemilik Gedung': item.namaPemilikGedung || '-',
    'NIK Pemilik': item.nikPemilik || '0',
    'No KK Pemilik': item.noKkPemilik || '0',
    'Dinas Teknis': item.responsibleDepartment,
    'Kelas Bangunan': item.buildingClass,
    'Kecamatan': item.kecamatanName,
    'Desa / Kelurahan': item.desaName,
    'Alamat Lengkap': item.detailedAddress,
    'Luas Lantai (M2)': item.totalFloorAreaM2,
    'Jumlah Tingkat': item.numberOfFloors,
    'Tahun Dibangun': item.yearBuilt,
    'Tingkat Kerusakan (%)': item.totalDamagePercent,
    'Klasifikasi Kerusakan': item.damageClassification,
    'HSBGN / M2 (Rp)': item.hsbgnPerM2,
    'Biaya Perawatan / M2 (Rp)': item.treatmentCostPerM2,
    'Biaya Bongkaran / M2 (Rp)': item.demolitionCostPerM2,
    'Total Biaya / M2 (Rp)': item.totalCostPerM2,
    'Ajuan Biaya Rehab (Rp)': item.roundedRehabCost,
    'Format Rupiah': formatRupiah(item.roundedRehabCost),
    'Terbilang': item.costTerbilang,
    'Link Folder G-Drive (Backup Foto)': item.backupDriveUrl || '-',
    'Status Verifikasi': item.verificationStatus,
    'Diverifikasi Oleh': item.verifiedBy || '-',
    'Tanggal Verifikasi': item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString('id-ID') : '-',
    'Catatan Verifikator': item.verificationNotes || '-',
    'Jumlah Foto Kerusakan': item.photos ? item.photos.length : 0,
    'Link Folder Foto Google Drive': item.googleDriveFolderUrl || '-',
    'Surveyor / Petugas': item.createdByName,
    'Kota Laporan': item.cityLocation,
    'Nama Kepala Dinas': item.headOfDepartment?.name || '-',
    'NIP Kepala Dinas': item.headOfDepartment?.nip || '-',
    'Tim Analisis': item.analysisTeam?.join(', ') || '-',
    'Rincian Komponen JSON': JSON.stringify(item.components || []),
    'Foto JSON': JSON.stringify(item.photos || []),
    'Terakhir Diperbarui': new Date(item.updatedAt).toLocaleString('id-ID'),
  };
}

/**
 * Group assessments by Kecamatan name
 */
export function groupAssessmentsByKecamatan(assessments: BuildingAssessment[]): Record<string, BuildingAssessment[]> {
  const grouped: Record<string, BuildingAssessment[]> = {};
  for (const item of assessments) {
    const kec = item.kecamatanName || 'Lainnya';
    if (!grouped[kec]) {
      grouped[kec] = [];
    }
    grouped[kec].push(item);
  }
  return grouped;
}

/**
 * Directly save assessment data to Google Sheet via Webhook endpoint
 * Supports auto-routing to Kecamatan-specific tab sheet + Master sheet + Google Drive photo folders
 */
export async function directSaveToGoogleSheet(
  assessment: BuildingAssessment,
  config: GoogleSheetConfig,
  action: 'insert' | 'update' | 'delete' = 'insert',
  previousCode?: string,
  explicitTargetSheetName?: string
): Promise<{ success: boolean; message: string; folderUrl?: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Link / URL Webhook Google Sheet belum dikonfigurasi.',
    };
  }

  // Detect if user mistakenly pasted a Google Drive link in the webhook field
  if (config.webhookUrl.includes('drive.google.com')) {
    return {
      success: false,
      message: 'URL Webhook keliru: Anda memasukkan tautan Google Drive di kolom URL Webhook. Kolom Webhook memerlukan URL Web App Google Apps Script (https://script.google.com/macros/s/.../exec).',
    };
  }

  // Ensure photos are hydrated from local storage if needed before sending to Google Apps Script
  const hydratedAssessment = await hydrateAssessmentPhotos(assessment);
  const rowData = formatAssessmentForGoogleSheet(hydratedAssessment);
  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);

  // Directly route to chosen destination sheet or kecamatan tab
  const chosenTab = explicitTargetSheetName?.trim() || assessment.targetSheetName?.trim() || assessment.sourceSheet?.trim();
  const kecSheetName = chosenTab
    ? sanitizeSheetName(chosenTab)
    : sanitizeSheetName(`Kec. ${hydratedAssessment.kecamatanName || 'Lainnya'}`);
  const cleanFolderId = extractDriveFolderId(config.driveFolderId);

  // Extract sheet row number if ID contains _r(\d+)
  let sheetRowNumber: number | undefined;
  const rowMatch = assessment.id.match(/_r(\d+)/i);
  if (rowMatch) {
    sheetRowNumber = parseInt(rowMatch[1], 10);
  }

  const preparedPhotos = (action !== 'delete' && hydratedAssessment.photos)
    ? await Promise.all(
        hydratedAssessment.photos.map(async (p, idx) => {
          const b64 = await ensurePhotoDataBase64(p);
          return {
            id: p.id || `photo_${idx}`,
            caption: p.caption || '',
            damageLocation: p.damageLocation || `Foto ${idx + 1}`,
            url: p.url,
            dataBase64: b64 || undefined,
          };
        })
      )
    : [];

  const payload: GoogleSheetRowPayload = {
    action,
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    targetSheetName: kecSheetName,
    kecamatanSheetName: kecSheetName,
    buildingName: assessment.buildingName,
    desaName: assessment.desaName,
    kecamatanName: assessment.kecamatanName,
    sheetRowNumber,
    splitByKecamatan: config.splitByKecamatan !== false,
    includeMasterSummary: config.includeMasterSummarySheet !== false,
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: spreadsheetId || undefined,
    registrationCode: hydratedAssessment.code || hydratedAssessment.id,
    previousRegistrationCode: previousCode || hydratedAssessment.id,
    data: rowData,
    photos: preparedPhotos,
    savePhotosToDrive: action !== 'delete' && config.savePhotosToDrive !== false,
    driveFolderId: cleanFolderId || (config.driveFolderId || '').trim() || undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    // Google Apps Script endpoint requires no-cors for direct browser POST
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (action === 'delete') {
      return {
        success: true,
        message: `Data gedung "${assessment.buildingName}" berhasil dihapus dari sistem & baris Google Sheet (${kecSheetName})!`,
      };
    }

    const destination = config.splitByKecamatan !== false 
      ? `tab "${kecSheetName}"` 
      : `tab "${config.sheetName || 'Data_Kerusakan_PUPR'}"`;

    const folderUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : undefined;

    return {
      success: true,
      message: `Data gedung "${assessment.buildingName}" langsung masuk ke Google Sheet (${destination})!`,
      folderUrl,
    };
  } catch (err: any) {
    console.error('Error saving directly to Google Sheet:', err);
    return {
      success: false,
      message: `Gagal mengirim ke Google Sheet: ${err.message || 'Koneksi terputus'}`,
    };
  }
}

/**
 * Test photo upload directly to Google Drive via Apps Script webhook
 */
export async function testDrivePhotoUpload(
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; folderUrl?: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script belum diisi.',
    };
  }

  if (config.webhookUrl.includes('drive.google.com')) {
    return {
      success: false,
      message: 'URL Webhook keliru: Anda memasukkan tautan Google Drive di kolom Webhook. Kolom Webhook harus berisi URL Web App Apps Script (https://script.google.com/macros/s/.../exec).',
    };
  }

  const cleanFolderId = extractDriveFolderId(config.driveFolderId);
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGYzAAAO9+BQJ3f5Y8AAAAAElFTkSuQmCC';

  const payload: GoogleSheetRowPayload = {
    action: 'test_drive',
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    driveFolderId: (config.driveFolderId || '').trim() || undefined,
    savePhotosToDrive: true,
    data: {
      'No Registrasi': 'TEST-001',
      'Nama Bangunan': 'Gedung Uji Coba SIM-PKBG',
      'Kecamatan': 'Uji Coba',
    },
    photos: [
      {
        id: 'test_photo_sample',
        caption: 'Foto Uji Coba Integrasi Google Drive',
        damageLocation: 'Uji Coba Sistem SIM-PKBG',
        dataBase64: sampleBase64,
      }
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const folderUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : undefined;
    return {
      success: true,
      message: 'Uji coba pengunggahan foto berhasil dikirim ke Google Apps Script! Periksa Google Drive Anda.',
      folderUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi Webhook: ${err.message || 'Koneksi gagal'}`,
    };
  }
}

/**
 * Sync individual assessment photos to Google Drive
 */
export async function syncAssessmentPhotosToDrive(
  assessment: BuildingAssessment,
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; folderUrl?: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'URL Webhook Google Apps Script belum dikonfigurasi.',
    };
  }
  if (!assessment.photos || assessment.photos.length === 0) {
    return {
      success: false,
      message: 'Gedung ini belum memiliki dokumentasi foto untuk diunggah.',
    };
  }

  const res = await directSaveToGoogleSheet(assessment, config, 'update');
  const cleanFolderId = extractDriveFolderId(config.driveFolderId);
  const folderUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : undefined;
  return {
    success: res.success,
    message: res.success ? `Foto gedung "${assessment.buildingName}" berhasil dikirimkan ke Google Drive!` : res.message,
    folderUrl,
  };
}

/**
 * Backward compatibility alias for direct saving
 */
export const syncToGoogleSheetWebhook = directSaveToGoogleSheet;

/**
 * Sync multiple assessments to Google Sheet with multi-sheet per Kecamatan support
 */
export async function syncAllToGoogleSheet(
  assessments: BuildingAssessment[],
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; syncedCount: number }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'URL Webhook Google Sheet belum dikonfigurasi.',
      syncedCount: 0,
    };
  }

  const rows = assessments.map(formatAssessmentForGoogleSheet);
  
  // Group by Kecamatan for multi-sheet creation
  const grouped = groupAssessmentsByKecamatan(assessments);
  const dataByKecamatan: Record<string, Record<string, any>[]> = {};
  for (const [kecName, items] of Object.entries(grouped)) {
    const tabName = sanitizeSheetName(`Kec. ${kecName}`);
    dataByKecamatan[tabName] = items.map(formatAssessmentForGoogleSheet);
  }

  const payload: GoogleSheetRowPayload = {
    action: 'sync_all',
    sheetName: config.sheetName || 'Rekap_Semua_Kecamatan',
    splitByKecamatan: config.splitByKecamatan !== false,
    includeMasterSummary: config.includeMasterSummarySheet !== false,
    data: rows,
    dataByKecamatan,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const kecCount = Object.keys(dataByKecamatan).length;
    return {
      success: true,
      message: `Berhasil sinkronisasi ${assessments.length} data penilaian ke Google Sheet (Terbagi dalam ${kecCount} Sheet Kecamatan + Sheet Rekap Master)!`,
      syncedCount: assessments.length,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal sinkronisasi masal: ${err.message}`,
      syncedCount: 0,
    };
  }
}

/**
 * Generates ready-to-use Google Apps Script code for multi-sheet per Kecamatan
 */
export function getGoogleAppsScriptTemplate(): string {
  return `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SIM-PKBG PUPR (SISTEM MULTI-SHEET PER KECAMATAN)
 * =========================================================================
 * Fitur:
 * 1. Otomatis membuatkan TAB SHEET TERSENDIRI untuk SETIAP KECAMATAN (misal: 'Kec. Aesesa', 'Kec. Mauponggo', dll).
 * 2. Menyediakan sheet 'REKAPITULASI MASTER' berisi gabungan data dan statistik seluruh kecamatan.
 * 3. Otomatis menyusun header tabel bergaya profesional PUPR dengan auto-width kolom.
 * 4. Mendukung penambahan baru (insert), pembaruan data (update), dan sinkronisasi masal (sync_all).
 * 
 * CARA PASANG DALAM 1 MENIT:
 * 1. Buka file Google Spreadsheet Anda di browser.
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'.
 * 3. Hapus seluruh kode bawaan yang ada, lalu paste KODE LENGKAP INI.
 * 4. Klik tombol biru 'Terapkan' (Deploy) > 'Deployment baru' (New deployment).
 * 5. Pilih jenis (ikon roda gigi): 'Aplikasi Web' (Web App).
 * 6. Setel:
 *    - Deskripsi: SIM-PKBG PUPR Multi-Sheet
 *    - Jalankan sebagai: Saya (Email Anda)
 *    - Yang memiliki akses (Who has access): 'Siapa saja' (Anyone)  <-- WAJIB
 * 7. Klik 'Terapkan', izinkan otorisasi akun Google Anda.
 * 8. Salin URL Aplikasi Web (akhiran /exec) dan paste ke menu Google Sheet di SIM-PKBG.
 * =========================================================================
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var json = JSON.parse(e.postData.contents);
    var action = json.action || 'insert';
    var splitByKecamatan = json.splitByKecamatan !== false; // Default true (Multi-Sheet per Kecamatan)
    var masterSheetName = json.sheetName || "Data_Penilaian_Kerusakan_PUPR";
    
    var ss;
    if (json.spreadsheetId) {
      try {
        ss = SpreadsheetApp.openById(json.spreadsheetId);
      } catch (err) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    // ACTION 1: PING (TEST CONNECTION)
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Koneksi Google Apps Script SIM-PKBG Aktif & Siap!",
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION 1B: CONSOLIDATE ALL 7 KECAMATAN SHEETS INTO 1 MASTER REKAP SHEET
    if (action === 'consolidate_sheets' || action === 'consolidate') {
      var targetRekap = masterSheetName || "REKAP_SEMUA_KECAMATAN";
      var consRes = consolidateKecamatanSheetsToRekap(ss, targetRekap);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Berhasil menyatukan data dari " + consRes.sourceSheetCount + " sheet kecamatan ke 1 sheet rekap utama ('" + consRes.masterTabName + "')! Total " + consRes.totalConsolidatedRows + " gedung.",
        totalRows: consRes.totalConsolidatedRows,
        sourceSheets: consRes.sourceSheets,
        masterSheet: consRes.masterTabName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION 2: SYNC_ALL (MASS SYNC WITH MULTI-SHEET PER KECAMATAN)
    if (action === 'sync_all') {
      var allRows = json.data || [];
      var dataByKec = json.dataByKecamatan || {};
      
      // 1. Tulis ke Master Sheet (Rekap Semua Kecamatan)
      if (allRows.length > 0) {
        var masterSheet = getOrCreateSheet(ss, masterSheetName);
        writeTableToSheet(masterSheet, allRows, "#0f172a"); // Navy Header
      }
      
      // 2. Buat Sheet Khusus untuk Masing-Masing Kecamatan
      var createdTabs = [];
      var kecNames = Object.keys(dataByKec);
      
      for (var k = 0; k < kecNames.length; k++) {
        var tabName = kecNames[k];
        var kecRows = dataByKec[tabName];
        if (kecRows && kecRows.length > 0) {
          var kecSheet = getOrCreateSheet(ss, tabName);
          writeTableToSheet(kecSheet, kecRows, "#1e3a8a"); // Deep Blue Header
          createdTabs.push(tabName);
        }
      }
      
      // 3. Buat Sheet Ringkasan Statistik Kecamatan (Dashboard Summary)
      createStatisticsSummarySheet(ss, allRows);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Berhasil membuat " + createdTabs.length + " sheet kecamatan + 1 Master Rekap!",
        kecamatanTabs: createdTabs,
        totalRecords: allRows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2B: SYNC USER ACCESS LOGS & AUDIT TRAIL TO DEDICATED SHEET
    if (action === 'sync_activity_logs') {
      var logRows = json.data || [];
      var logTabName = json.logSheetName || "Log_Akses_Pengguna";
      var logSheet = getOrCreateSheet(ss, logTabName);
      writeTableToSheet(logSheet, logRows, "#4338ca"); // Indigo Header

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Berhasil menyinkronkan " + logRows.length + " data log akses pengguna ke sheet '" + logTabName + "'!",
        totalLogs: logRows.length,
        sheet: logTabName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2C: APPEND SINGLE USER ACCESS LOG
    if (action === 'log_user_access') {
      var singleLog = json.data;
      if (singleLog) {
        var logTabName2 = json.logSheetName || "Log_Akses_Pengguna";
        var logSheet2 = getOrCreateSheet(ss, logTabName2);
        saveOrUpdateRow(logSheet2, singleLog, singleLog['ID Log'] || "", 'insert', "#4338ca");
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Log akses tercatat di Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION 2D: TEST PHOTO UPLOAD TO GOOGLE DRIVE
    if (action === 'test_drive') {
      var testPhotos = json.photos || [{
        damageLocation: "Uji Coba Sistem SIM-PKBG",
        caption: "Foto Uji Coba Integrasi Google Drive",
        dataBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGYzAAAO9+BQJ3f5Y8AAAAAElFTkSuQmCC"
      }];
      var testUrl = savePhotosToGoogleDrive(testPhotos, "TEST-001", "Gedung Uji Coba SIM-PKBG", json.driveFolderId);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Perintah uji coba pengunggahan foto ke Google Drive berhasil diproses!",
        driveFolderUrl: testUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2E: SAVE SINGLE USER ACCOUNT TO GOOGLE SHEET (DAFTAR_PENGGUNA)
    if (action === 'save_user' || action === 'delete_user') {
      var userRowData = json.data;
      var userTabName = json.userSheetName || "Daftar_Pengguna";
      var userSheet = getOrCreateSheet(ss, userTabName);
      var userId = json.userId || (userRowData ? userRowData['ID Pengguna'] : "");
      
      if (userRowData) {
        saveOrUpdateRow(userSheet, userRowData, userId, json.email || "", action === 'delete_user' ? 'delete' : 'insert', "#4c1d95");
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Akun pengguna (" + (userRowData ? userRowData['Nama Lengkap'] : userId) + ") tersimpan di Google Sheet!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2F: SYNC ALL USER ACCOUNTS TO GOOGLE SHEET
    if (action === 'sync_users') {
      var allUserRows = json.data || [];
      var userTabName2 = json.userSheetName || "Daftar_Pengguna";
      var userSheet2 = getOrCreateSheet(ss, userTabName2);
      writeTableToSheet(userSheet2, allUserRows, "#4c1d95");

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Berhasil menyinkronkan " + allUserRows.length + " data akun pengguna ke sheet '" + userTabName2 + "'!",
        totalUsers: allUserRows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2G: FETCH ALL USER ACCOUNTS FROM GOOGLE SHEET
    if (action === 'fetch_users') {
      var userTabName3 = json.userSheetName || "Daftar_Pengguna";
      var userSheet3 = ss.getSheetByName(userTabName3);
      var userList = [];
      if (userSheet3 && userSheet3.getLastRow() > 1) {
        var rawData = userSheet3.getDataRange().getValues();
        var headers = rawData[0];
        for (var i = 1; i < rawData.length; i++) {
          var obj = {};
          for (var h = 0; h < headers.length; h++) {
            obj[headers[h]] = rawData[i][h];
          }
          userList.push(obj);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        users: userList,
        totalUsers: userList.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 3: INSERT / UPDATE / DELETE SINGLE ROW (LANGSUNG DARI FORMULIR SURVEI / TABEL)
    var rowData = json.data || {};
    var regCode = json.registrationCode || (rowData['No Registrasi'] || "");
    var prevRegCode = json.previousRegistrationCode || "";
    var kecamatanName = json.kecamatanName || rowData['Kecamatan'] || "Lainnya";
    var targetTabName = json.targetSheetName || json.kecamatanSheetName || ("Kec. " + kecamatanName);
    var bldgName = json.buildingName || (rowData && rowData['Nama Bangunan']) || "";
    var sheetRowNumber = json.sheetRowNumber;

    if (action === 'delete') {
      var deletedFrom = [];
      // 1. Coba hapus di Sheet Tujuan Kecamatan Terkait
      var targetKecSheet = findSheetByNameFuzzy(ss, targetTabName);
      if (targetKecSheet) {
        var didDel = deleteMatchingRow(targetKecSheet, regCode, prevRegCode, bldgName, sheetRowNumber);
        if (didDel) deletedFrom.push(targetKecSheet.getName());
      }
      
      // 2. Jika belum terhapus, cari di seluruh sheet kecamatan lainnya
      if (deletedFrom.length === 0) {
        var allSheets = ss.getSheets();
        for (var s = 0; s < allSheets.length; s++) {
          var sName = allSheets[s].getName();
          if (sName !== 'Log_Akses_Pengguna' && sName !== 'Daftar_Pengguna') {
            if (deleteMatchingRow(allSheets[s], regCode, prevRegCode, bldgName, sheetRowNumber)) {
              deletedFrom.push(sName);
              break;
            }
          }
        }
      }

      // 3. Hapus juga dari Master Rekap (jika ada)
      var master1 = findSheetByNameFuzzy(ss, "Data_Penilaian_Kerusakan_PUPR");
      if (master1) deleteMatchingRow(master1, regCode, prevRegCode, bldgName, 0);
      var master2 = findSheetByNameFuzzy(ss, "REKAP_SEMUA_KECAMATAN");
      if (master2) deleteMatchingRow(master2, regCode, prevRegCode, bldgName, 0);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Data penilaian berhasil dihapus dari sheet: " + (deletedFrom.join(', ') || targetTabName),
        deletedFrom: deletedFrom
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!rowData || Object.keys(rowData).length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Data baris kosong" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // SIMPAN DOKUMENTASI FOTO KE GOOGLE DRIVE (Folder per Bangunan)
    if (json.photos && json.photos.length > 0 && json.savePhotosToDrive !== false) {
      var driveFolderUrl = savePhotosToGoogleDrive(json.photos, regCode, rowData['Nama Bangunan'], json.driveFolderId);
      if (driveFolderUrl) {
        rowData['Link Folder Foto Google Drive'] = driveFolderUrl;
      }
    }
    
    // A. Tulis langsung ke Sheet Tujuan sesuai pilihan letak data
    var targetSheet = getOrCreateSheet(ss, targetTabName);
    saveOrUpdateRow(targetSheet, rowData, regCode, prevRegCode, action, "#1e3a8a", {
      buildingName: bldgName,
      sheetRowNumber: sheetRowNumber
    });
    
    // B. Perbarui Master Sheet Rekap Semua jika aktif
    if (includeMasterSummary) {
      var primaryMasterSheet = getOrCreateSheet(ss, "Data_Penilaian_Kerusakan_PUPR");
      saveOrUpdateRow(primaryMasterSheet, rowData, regCode, prevRegCode, action, "#0f172a", {
        buildingName: bldgName
      });

      if (masterSheetName && masterSheetName !== "Data_Penilaian_Kerusakan_PUPR") {
        var secondaryMasterSheet = getOrCreateSheet(ss, masterSheetName);
        saveOrUpdateRow(secondaryMasterSheet, rowData, regCode, prevRegCode, action, "#0f172a", {
          buildingName: bldgName
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data langsung masuk ke Sheet '" + targetSheet.getName() + "' & Arsip Foto Google Drive!",
      registrationCode: regCode,
      targetTab: targetSheet.getName(),
      driveFolderUrl: rowData['Link Folder Foto Google Drive'] || ""
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Mencari sheet secara fleksibel (fuzzy match mengabaikan spasi, titik, awalan 'Kec.')
 */
function findSheetByNameFuzzy(ss, name) {
  if (!name) return null;
  var exact = ss.getSheetByName(name);
  if (exact) return exact;
  var cleanTarget = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sName = sheets[i].getName();
    var cleanS = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanS === cleanTarget) return sheets[i];
  }
  for (var j = 0; j < sheets.length; j++) {
    var sName2 = sheets[j].getName();
    var cleanS2 = sName2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTarget.length >= 4 && (cleanS2.indexOf(cleanTarget) !== -1 || cleanTarget.indexOf(cleanS2) !== -1)) {
      return sheets[j];
    }
  }
  return null;
}

/**
 * Mendapatkan sheet berdasarkan nama atau membuatnya baru bila belum ada
 */
function getOrCreateSheet(ss, name) {
  var found = findSheetByNameFuzzy(ss, name);
  if (found) return found;
  var cleanName = (name || 'Sheet').replace(/[^a-zA-Z0-9 _-]/g, '').trim().substring(0, 30) || 'Sheet1';
  return ss.insertSheet(cleanName);
}

/**
 * Menghapus baris yang cocok berdasarkan No Registrasi, Nama Bangunan, atau nomor baris
 */
function deleteMatchingRow(sheet, regCode, prevRegCode, buildingName, sheetRowNumber) {
  if (!sheet || sheet.getLastRow() <= 1) return false;
  var allData = sheet.getDataRange().getValues();
  var currentHeaders = allData[0];
  var colReg = -1;
  var colName = -1;

  for (var c = 0; c < currentHeaders.length; c++) {
    var h = String(currentHeaders[c]).toLowerCase().trim();
    if (colReg === -1 && (h.indexOf('registrasi') !== -1 || h.indexOf('kode') !== -1 || h === 'id')) colReg = c;
    if (colName === -1 && (h.indexOf('bangunan') !== -1 || h.indexOf('gedung') !== -1 || h.indexOf('pemilik') !== -1 || h === 'nama')) colName = c;
  }

  var foundIndex = -1;
  var regTarget = (regCode || '').toString().trim().toLowerCase();
  var prevRegTarget = (prevRegCode || '').toString().trim().toLowerCase();
  var bldgTarget = (buildingName || '').toString().trim().toLowerCase();

  // Match 1: By sheetRowNumber if provided and in bounds
  if (sheetRowNumber && sheetRowNumber >= 2 && sheetRowNumber <= allData.length) {
    var candRow = allData[sheetRowNumber - 1];
    var candName = colName >= 0 ? String(candRow[colName]).toLowerCase().trim() : '';
    var candReg = colReg >= 0 ? String(candRow[colReg]).toLowerCase().trim() : '';
    if (!bldgTarget || candName.indexOf(bldgTarget) !== -1 || bldgTarget.indexOf(candName) !== -1 || (regTarget && candReg === regTarget)) {
      foundIndex = sheetRowNumber;
    }
  }

  // Match 2: By regCode
  if (foundIndex === -1 && regTarget && regTarget !== '-' && regTarget.indexOf('assess_') !== 0) {
    for (var r1 = 1; r1 < allData.length; r1++) {
      if ((colReg >= 0 && String(allData[r1][colReg]).trim().toLowerCase() === regTarget) || String(allData[r1][0]).trim().toLowerCase() === regTarget) {
        foundIndex = r1 + 1;
        break;
      }
    }
  }

  // Match 3: By prevRegCode
  if (foundIndex === -1 && prevRegTarget && prevRegTarget !== '-') {
    for (var r2 = 1; r2 < allData.length; r2++) {
      if ((colReg >= 0 && String(allData[r2][colReg]).trim().toLowerCase() === prevRegTarget) || String(allData[r2][0]).trim().toLowerCase() === prevRegTarget) {
        foundIndex = r2 + 1;
        break;
      }
    }
  }

  // Match 4: By buildingName (case-insensitive)
  if (foundIndex === -1 && bldgTarget && bldgTarget.length > 2) {
    for (var r3 = 1; r3 < allData.length; r3++) {
      var rowBldg = colName >= 0 ? String(allData[r3][colName]).trim().toLowerCase() : '';
      if (rowBldg && (rowBldg === bldgTarget || rowBldg.indexOf(bldgTarget) !== -1 || bldgTarget.indexOf(rowBldg) !== -1)) {
        foundIndex = r3 + 1;
        break;
      }
      for (var cc = 0; cc < allData[r3].length; cc++) {
        if (String(allData[r3][cc]).trim().toLowerCase() === bldgTarget) {
          foundIndex = r3 + 1;
          break;
        }
      }
      if (foundIndex !== -1) break;
    }
  }

  if (foundIndex > 0) {
    sheet.deleteRow(foundIndex);
    return true;
  }
  return false;
}

/**
 * Menyimpan atau memperbarui satu baris data pada sheet tertentu
 */
function saveOrUpdateRow(sheet, rowData, regCode, prevRegCode, action, headerBgColor, extraParams) {
  if (!sheet || !rowData) return;
  extraParams = extraParams || {};
  var bldgName = (extraParams.buildingName || rowData['Nama Bangunan'] || '').toString().trim();
  var sheetRowNumber = extraParams.sheetRowNumber;
  var headers = Object.keys(rowData);
  
  // Jika sheet baru/kosong, buat baris Header
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerBgColor || "#0f172a");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    var allData = sheet.getDataRange().getValues();
    var colReg = -1;
    var colName = -1;
    for (var c = 0; c < currentHeaders.length; c++) {
      var h = String(currentHeaders[c]).toLowerCase().trim();
      if (colReg === -1 && (h.indexOf('registrasi') !== -1 || h.indexOf('kode') !== -1 || h === 'id')) colReg = c;
      if (colName === -1 && (h.indexOf('bangunan') !== -1 || h.indexOf('gedung') !== -1 || h.indexOf('pemilik') !== -1 || h === 'nama')) colName = c;
    }

    var foundIndex = -1;
    var regTarget = (regCode || '').toString().trim().toLowerCase();
    var prevRegTarget = (prevRegCode || '').toString().trim().toLowerCase();
    var bldgTarget = bldgName.toLowerCase();

    // Match 1: By sheetRowNumber if provided
    if (sheetRowNumber && sheetRowNumber >= 2 && sheetRowNumber <= allData.length) {
      var candRow = allData[sheetRowNumber - 1];
      var candName = colName >= 0 ? String(candRow[colName]).toLowerCase().trim() : '';
      if (!bldgTarget || candName.indexOf(bldgTarget) !== -1 || bldgTarget.indexOf(candName) !== -1) {
        foundIndex = sheetRowNumber;
      }
    }

    // Match 2: By regCode
    if (foundIndex === -1 && regTarget && regTarget !== '-' && regTarget.indexOf('assess_') !== 0) {
      for (var r1 = 1; r1 < allData.length; r1++) {
        if ((colReg >= 0 && String(allData[r1][colReg]).trim().toLowerCase() === regTarget) || String(allData[r1][0]).trim().toLowerCase() === regTarget) {
          foundIndex = r1 + 1;
          break;
        }
      }
    }

    // Match 3: By prevRegCode
    if (foundIndex === -1 && prevRegTarget && prevRegTarget !== '-') {
      for (var r2 = 1; r2 < allData.length; r2++) {
        if ((colReg >= 0 && String(allData[r2][colReg]).trim().toLowerCase() === prevRegTarget) || String(allData[r2][0]).trim().toLowerCase() === prevRegTarget) {
          foundIndex = r2 + 1;
          break;
        }
      }
    }

    // Match 4: By buildingName
    if (foundIndex === -1 && bldgTarget && bldgTarget.length > 2) {
      for (var r3 = 1; r3 < allData.length; r3++) {
        var rowBldg = colName >= 0 ? String(allData[r3][colName]).trim().toLowerCase() : '';
        if (rowBldg && (rowBldg === bldgTarget || rowBldg.indexOf(bldgTarget) !== -1 || bldgTarget.indexOf(rowBldg) !== -1)) {
          foundIndex = r3 + 1;
          break;
        }
      }
    }
    
    if (foundIndex > 0) {
      if (action === 'delete') {
        sheet.deleteRow(foundIndex);
        return;
      } else {
        var updateValues = [];
        for (var cu = 0; cu < currentHeaders.length; cu++) {
          var hNameU = currentHeaders[cu];
          updateValues.push(rowData[hNameU] !== undefined ? rowData[hNameU] : "");
        }
        sheet.getRange(foundIndex, 1, 1, currentHeaders.length).setValues([updateValues]);
        return;
      }
    }
  }
  
  // Bila belum ada dan BUKAN delete, tambahkan baris baru (append)
  if (action !== 'delete') {
    var newRow = [];
    for (var c2 = 0; c2 < currentHeaders.length; c2++) {
      var hName2 = currentHeaders[c2];
      newRow.push(rowData[hName2] !== undefined ? rowData[hName2] : "");
    }
    sheet.appendRow(newRow);
  }
}

/**
 * Menulis seluruh tabel ke sheet dan menerapkan styling
 */
function writeTableToSheet(sheet, rows, headerBgColor) {
  sheet.clear();
  if (rows.length === 0) return;
  
  var headers = Object.keys(rows[0]);
  var tableData = [headers];
  
  for (var i = 0; i < rows.length; i++) {
    var row = [];
    for (var h = 0; h < headers.length; h++) {
      row.push(rows[i][headers[h]] !== undefined ? rows[i][headers[h]] : "");
    }
    tableData.push(row);
  }
  
  var numRows = tableData.length;
  var numCols = headers.length;
  
  var range = sheet.getRange(1, 1, numRows, numCols);
  range.setValues(tableData);
  
  // Style Header
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground(headerBgColor || "#0f172a");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  
  // Format border & alignment
  range.setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Membuat Sheet Ringkasan Rekapitulasi Statistik Per Kecamatan
 */
function createStatisticsSummarySheet(ss, allRows) {
  var summarySheet = getOrCreateSheet(ss, "00_RINGKASAN_KECAMATAN");
  summarySheet.clear();
  
  // Hitung statistik per kecamatan
  var stats = {};
  for (var i = 0; i < allRows.length; i++) {
    var row = allRows[i];
    var kec = row['Kecamatan'] || 'Lainnya';
    var kls = row['Klasifikasi Kerusakan'] || 'Rusak Ringan';
    var biaya = Number(row['Ajuan Biaya Rehab (Rp)']) || 0;
    
    if (!stats[kec]) {
      stats[kec] = { total: 0, ringan: 0, sedang: 0, berat: 0, sangatBerat: 0, totalBiaya: 0 };
    }
    stats[kec].total += 1;
    if (kls.indexOf('Ringan') >= 0) stats[kec].ringan += 1;
    else if (kls.indexOf('Sedang') >= 0) stats[kec].sedang += 1;
    else if (kls.indexOf('Sangat') >= 0) stats[kec].sangatBerat += 1;
    else if (kls.indexOf('Berat') >= 0) stats[kec].berat += 1;
    stats[kec].totalBiaya += biaya;
  }
  
  var summaryTable = [
    ["No", "Nama Kecamatan", "Total Gedung", "Rusak Ringan", "Rusak Sedang", "Rusak Berat", "Rusak Sangat Berat", "Total Usulan Biaya Rehab (Rp)"]
  ];
  
  var no = 1;
  var grandTotalGedung = 0;
  var grandTotalRingan = 0;
  var grandTotalSedang = 0;
  var grandTotalBerat = 0;
  var grandTotalSangatBerat = 0;
  var grandTotalBiaya = 0;
  
  var kecKeys = Object.keys(stats).sort();
  for (var k = 0; k < kecKeys.length; k++) {
    var kName = kecKeys[k];
    var st = stats[kName];
    summaryTable.push([
      no++,
      kName,
      st.total,
      st.ringan,
      st.sedang,
      st.berat,
      st.sangatBerat,
      st.totalBiaya
    ]);
    grandTotalGedung += st.total;
    grandTotalRingan += st.ringan;
    grandTotalSedang += st.sedang;
    grandTotalBerat += st.berat;
    grandTotalSangatBerat += st.sangatBerat;
    grandTotalBiaya += st.totalBiaya;
  }
  
  // Baris Total
  summaryTable.push([
    "TOTAL",
    "SEMUA KECAMATAN",
    grandTotalGedung,
    grandTotalRingan,
    grandTotalSedang,
    grandTotalBerat,
    grandTotalSangatBerat,
    grandTotalBiaya
  ]);
  
  var range = summarySheet.getRange(1, 1, summaryTable.length, summaryTable[0].length);
  range.setValues(summaryTable);
  
  var headerRange = summarySheet.getRange(1, 1, 1, summaryTable[0].length);
  headerRange.setBackground("#047857"); // Emerald Header
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  summarySheet.setFrozenRows(1);
  
  // Style Total Row
  var lastRow = summaryTable.length;
  var totalRange = summarySheet.getRange(lastRow, 1, 1, summaryTable[0].length);
  totalRange.setBackground("#f1f5f9");
  totalRange.setFontWeight("bold");
}

/**
 * Ekstraksi ID Folder Google Drive dari URL atau teks input
 */
function extractDriveFolderIdFromScript(input) {
  if (!input) return "";
  var str = ("" + input).trim();
  if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) {
    return str;
  }
  var fIndex = str.indexOf("folders/");
  if (fIndex !== -1) {
    var rest = str.substring(fIndex + 8);
    var endSlash = rest.indexOf("/");
    if (endSlash !== -1) rest = rest.substring(0, endSlash);
    var endQ = rest.indexOf("?");
    if (endQ !== -1) rest = rest.substring(0, endQ);
    return rest.trim();
  }
  var idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  return str.replace(/\\s+/g, '');
}

/**
 * Mencari folder induk di Google Drive:
 * 1. Coba melalui Google Drive ID (jika pengguna menyalin URL / ID)
 * 2. Coba melalui NAMA folder persis (misal 'Data-IKBG/CK' seperti di Google Drive pengguna)
 */
function findTargetDriveFolder(parentFolderInput) {
  if (!parentFolderInput) return null;
  var raw = ("" + parentFolderInput).trim();
  if (!raw) return null;

  // 1. Coba cari dengan ID (jika berupa ID alfanumerik panjang tanpa slash)
  var cleanId = extractDriveFolderIdFromScript(raw);
  if (cleanId && /^[a-zA-Z0-9_-]{15,}$/.test(cleanId) && cleanId.indexOf('/') === -1) {
    try {
      var folderById = DriveApp.getFolderById(cleanId);
      if (folderById) {
        Logger.log("Folder Google Drive ditemukan via ID: " + cleanId);
        return folderById;
      }
    } catch(eId) {
      Logger.log("getFolderById gagal untuk ID '" + cleanId + "': " + eId);
    }
  }

  // 2. Coba cari berdasarkan NAMA folder (misal: 'Data-IKBG/CK')
  try {
    var foldersByName = DriveApp.getFoldersByName(raw);
    if (foldersByName.hasNext()) {
      var folderByName = foldersByName.next();
      Logger.log("Folder Google Drive ditemukan via Nama: " + raw);
      return folderByName;
    }
  } catch(eName) {
    Logger.log("getFoldersByName gagal untuk nama '" + raw + "': " + eName);
  }

  // 3. Jika input memiliki pemisah slash (misal 'Data-IKBG/CK'), coba cari bagian terakhir atau pertama
  if (raw.indexOf('/') !== -1) {
    var parts = raw.split('/');
    for (var p = 0; p < parts.length; p++) {
      var seg = parts[p].trim();
      if (seg && seg.length >= 3) {
        try {
          var fSeg = DriveApp.getFoldersByName(seg);
          if (fSeg.hasNext()) {
            return fSeg.next();
          }
        } catch(eSeg) {}
      }
    }
  }

  return null;
}

/**
 * Menyimpan dokumentasi foto ke Google Drive dalam folder terstruktur per bangunan
 */
function savePhotosToGoogleDrive(photos, regCode, buildingName, parentFolderInput) {
  if (!photos || photos.length === 0) return "";
  try {
    var parentFolder = findTargetDriveFolder(parentFolderInput);
    
    // Jika folder induk kustom tidak ditemukan / tidak diisi, gunakan atau buat folder utama SIM-PKBG
    if (!parentFolder) {
      var defaultFolderName = "SIM-PKBG PUPR - Dokumentasi Foto Kerusakan";
      var rootFolders = DriveApp.getFoldersByName(defaultFolderName);
      if (rootFolders.hasNext()) {
        parentFolder = rootFolders.next();
      } else {
        parentFolder = DriveApp.createFolder(defaultFolderName);
        try { parentFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eShare) {}
      }
    }
    
    // Buat / dapatkan subfolder khusus untuk gedung terkait
    var safeBuilding = (buildingName || "Gedung").replace(/[^a-zA-Z0-9 _-]/g, "_").trim();
    var folderName = safeBuilding + (regCode ? (" - " + regCode) : "");
    var targetFolder = null;

    try {
      var subFolders = parentFolder.getFoldersByName(folderName);
      targetFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(folderName);
      try { targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eSub) {}
    } catch(eSubFolder) {
      Logger.log("Gagal membuat subfolder pada folder induk: " + eSubFolder + ", menggunakan fallback root...");
      try {
        var fallbackRootName = "SIM-PKBG PUPR - Dokumentasi Foto Kerusakan";
        var fRoots = DriveApp.getFoldersByName(fallbackRootName);
        var fRoot = fRoots.hasNext() ? fRoots.next() : DriveApp.createFolder(fallbackRootName);
        var fSubs = fRoot.getFoldersByName(folderName);
        targetFolder = fSubs.hasNext() ? fSubs.next() : fRoot.createFolder(folderName);
        try { targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eFb) {}
      } catch(eFbTotal) {
        targetFolder = parentFolder;
      }
    }
    if (!targetFolder) targetFolder = parentFolder;
    
    for (var i = 0; i < photos.length; i++) {
      try {
        var p = photos[i];
        var base64Data = p.dataBase64 || p.url || "";
        var decoded = null;
        var contentType = "image/jpeg";
        
        if (base64Data.indexOf("data:") === 0) {
          var parts = base64Data.split(",");
          if (parts.length > 1) {
            contentType = parts[0].split(":")[1].split(";")[0] || "image/jpeg";
            var cleanB64 = parts[1].replace(/[\\s\\r\\n]+/g, "").trim();
            decoded = Utilities.base64Decode(cleanB64);
          }
        } else if (base64Data.indexOf("http") === 0) {
          try {
            var resp = UrlFetchApp.fetch(base64Data, { muteHttpExceptions: true });
            if (resp.getResponseCode() === 200) {
              decoded = resp.getBlob().getBytes();
              contentType = resp.getBlob().getContentType() || "image/jpeg";
            }
          } catch(eFetch) {}
        } else if (base64Data.length > 50 && !/^\\s*http/.test(base64Data)) {
          try {
            decoded = Utilities.base64Decode(base64Data);
          } catch(eDec) {}
        }
        
        if (decoded && decoded.length > 0) {
          var safeLoc = (p.damageLocation || ("Foto_" + (i + 1))).replace(/[^a-zA-Z0-9 _-]/g, "_");
          
          // Tentukan ekstensi file secara dinamis sesuai tipe MIME gambar
          var ext = "jpg";
          var lowerType = (contentType || "").toLowerCase();
          if (lowerType.indexOf("png") !== -1) ext = "png";
          else if (lowerType.indexOf("webp") !== -1) ext = "webp";
          else if (lowerType.indexOf("gif") !== -1) ext = "gif";
          else if (lowerType.indexOf("bmp") !== -1) ext = "bmp";
          else if (lowerType.indexOf("svg") !== -1) ext = "svg";
          else if (lowerType.indexOf("avif") !== -1) ext = "avif";
          else if (lowerType.indexOf("tiff") !== -1 || lowerType.indexOf("tif") !== -1) ext = "tif";
          else if (lowerType.indexOf("heic") !== -1) ext = "heic";
          else if (lowerType.indexOf("heif") !== -1) ext = "heif";
          
          var fileName = ("0" + (i + 1)).slice(-2) + "_" + safeLoc + "." + ext;
          
          // Hapus file lama jika ada agar diperbarui dengan file baru
          try {
            var existingFiles = targetFolder.getFilesByName(fileName);
            while (existingFiles.hasNext()) {
              try {
                existingFiles.next().setTrashed(true);
              } catch(eTrash) {}
            }
          } catch(eScanFiles) {}
          
          // Buat file baru dari binary blob
          var blob = Utilities.newBlob(decoded, contentType, fileName);
          var newFile = targetFolder.createFile(blob);
          try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
        }
      } catch(ePhotoItem) {
        Logger.log("Gagal menyimpan foto ke-" + (i + 1) + ": " + ePhotoItem);
      }
    }
    return targetFolder ? targetFolder.getUrl() : "";
  } catch (err) {
    Logger.log("Error saving photos to Drive: " + err);
    return "";
  }
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'fetch_users' || action === 'users') {
    try {
      var userSheet = ss.getSheetByName("Daftar_Pengguna");
      var userList = [];
      if (userSheet && userSheet.getLastRow() > 1) {
        var rawData = userSheet.getDataRange().getValues();
        var headers = rawData[0];
        for (var i = 1; i < rawData.length; i++) {
          var obj = {};
          for (var h = 0; h < headers.length; h++) {
            obj[headers[h]] = rawData[i][h];
          }
          userList.push(obj);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        users: userList,
        totalUsers: userList.length
      })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Fetch all building assessments (Data Penilaian Kerusakan)
  // Otomatis satukan data dari 7 sheet kecamatan ke tab master rekapitulasi sebelum membaca
  if (action === 'fetch_assessments' || action === 'fetch_all' || action === 'consolidate' || action === 'data' || !action) {
    try {
      // 1. Jalankan konsolidasi 7 sheet kecamatan ke REKAP_SEMUA_KECAMATAN
      var consInfo = consolidateKecamatanSheetsToRekap(ss, "REKAP_SEMUA_KECAMATAN");
      
      // 2. Baca dari sheet rekapitulasi utama yang telah terkonsolidasi
      var targetSheet = ss.getSheetByName("REKAP_SEMUA_KECAMATAN") 
                     || ss.getSheetByName("Data_Penilaian_Kerusakan_PUPR")
                     || ss.getSheetByName("Data_Kerusakan_PUPR")
                     || ss.getSheetByName("Master_Rekapitulasi");
      
      var dataList = [];
      var seenCodes = {};

      if (targetSheet && targetSheet.getLastRow() > 1) {
        var rawData = targetSheet.getDataRange().getValues();
        var headers = rawData[0];
        for (var i = 1; i < rawData.length; i++) {
          var obj = {};
          var hasVal = false;
          for (var h = 0; h < headers.length; h++) {
            var val = rawData[i][h];
            if (val !== undefined && val !== null && val !== "") hasVal = true;
            obj[headers[h]] = rawData[i][h];
          }
          if (hasVal) {
            dataList.push(obj);
            var codeKey = (obj['No Registrasi'] || obj['ID'] || "").toString().trim();
            if (codeKey) seenCodes[codeKey] = true;
          }
        }
      }

      // Pastikan baris dari 7 sheet kecamatan yang belum terindeks ikut terbaca
      var allSheets = ss.getSheets();
      var excludedNames = ["Daftar_Pengguna", "Log_Akses_Pengguna", "00_RINGKASAN_KECAMATAN", "REKAP_SEMUA_KECAMATAN"];
      
      for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
        var curSheet = allSheets[sIdx];
        var sName = curSheet.getName();
        if (excludedNames.indexOf(sName) !== -1) continue;
        if (targetSheet && sName === targetSheet.getName()) continue;
        
        if (curSheet.getLastRow() > 1) {
          var sData = curSheet.getDataRange().getValues();
          var sHeaders = sData[0];
          for (var rIdx = 1; rIdx < sData.length; rIdx++) {
            var sObj = {};
            var sHasVal = false;
            for (var cIdx = 0; cIdx < sHeaders.length; cIdx++) {
              var sVal = sData[rIdx][cIdx];
              if (sVal !== undefined && sVal !== null && sVal !== "") sHasVal = true;
              sObj[sHeaders[cIdx]] = sData[rIdx][cIdx];
            }
            if (sHasVal) {
              var regCodeKey = (sObj['No Registrasi'] || sObj['ID'] || "").toString().trim();
              if (!regCodeKey || !seenCodes[regCodeKey]) {
                dataList.push(sObj);
                if (regCodeKey) seenCodes[regCodeKey] = true;
              }
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: dataList,
        totalRows: dataList.length,
        consolidatedSheets: consInfo ? consInfo.sourceSheets : [],
        masterSheet: targetSheet ? targetSheet.getName() : "REKAP_SEMUA_KECAMATAN"
      })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    app: "SIM-PKBG Penilaian Kerusakan Bangunan Gedung PUPR",
    features: "Multi-Sheet per Kecamatan, Master Rekap, Google Drive Photo Sync & Daftar Pengguna",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * =========================================================================
 * FUNGSI UJI COBA OTORISASI GOOGLE DRIVE & SPREADSHEET (JALANKAN SEKALI)
 * =========================================================================
 * Cara Pakai:
 * 1. Di bilah menu atas editor Apps Script, pilih fungsi 'testIzinAksesGoogleDrive'
 * 2. Klik tombol 'Jalankan' (Run)
 * 3. Jika muncul pop-up "Otorisasi Diperlukan" (Authorization Required):
 *    -> Klik 'Tinjau Izin' (Review permissions)
 *    -> Pilih akun Google Anda
 *    -> Klik 'Lanjutan' (Advanced)
 *    -> Klik 'Buka ... (tidak aman)' / 'Go to ... (unsafe)'
 *    -> Klik 'Izinkan' (Allow)
 * 4. Setelah itu, Web App Anda sudah 100% berhak membuat folder & mengunggah foto ke Google Drive!
 */
function testIzinAksesGoogleDrive() {
  var root = DriveApp.getRootFolder();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("SUKSES: Izin Google Drive & Spreadsheet telah aktif!");
  Logger.log("Nama Folder Utama Drive: " + root.getName());
  if (ss) {
    Logger.log("Nama Spreadsheet Terhubung: " + ss.getName());
  }
}

/**
 * =========================================================================
 * FUNGSI KONSOLIDASI: SATUKAN 7 SHEET KECAMATAN KE 1 SHEET REKAPITULASI UTAMA
 * =========================================================================
 */
function consolidateKecamatanSheetsToRekap(ss, targetRekapName) {
  var rekapName = targetRekapName || "REKAP_SEMUA_KECAMATAN";
  var allSheets = ss.getSheets();
  var excludedNames = [
    "Daftar_Pengguna",
    "Log_Akses_Pengguna",
    "00_RINGKASAN_KECAMATAN",
    rekapName,
    "Data_Penilaian_Kerusakan_PUPR",
    "SEMUA_DATA_GABUNGAN"
  ];
  
  var allRows = [];
  var seenKeys = {};
  var sourceSheetsFound = [];
  var masterHeaders = null;

  for (var s = 0; s < allSheets.length; s++) {
    var curSheet = allSheets[s];
    var sName = curSheet.getName();
    if (excludedNames.indexOf(sName) !== -1) continue;
    
    if (curSheet.getLastRow() > 1) {
      var data = curSheet.getDataRange().getValues();
      var headers = data[0];
      if (!masterHeaders && headers.length > 0) {
        masterHeaders = headers;
      }
      sourceSheetsFound.push(sName);

      for (var r = 1; r < data.length; r++) {
        var rowObj = {};
        var hasContent = false;
        for (var c = 0; c < headers.length; c++) {
          var val = data[r][c];
          if (val !== undefined && val !== null && String(val).trim() !== "") hasContent = true;
          rowObj[headers[c]] = val;
        }
        
        if (!hasContent) continue;
        var regVal = String(rowObj['No Registrasi'] || rowObj['ID'] || "").trim();
        // Lewati baris total atau subtotal kecamatan
        if (regVal.toUpperCase().indexOf('TOTAL') !== -1) continue;

        var bName = String(rowObj['Nama Bangunan'] || "").trim().toLowerCase();
        var kecVal = String(rowObj['Kecamatan'] || sName.replace(/^Kec\.\s*/i, '')).trim();
        rowObj['Kecamatan'] = kecVal;

        var key = regVal ? regVal.toUpperCase() : (bName + "|" + kecVal.toLowerCase());
        if (key && !seenKeys[key]) {
          seenKeys[key] = true;
          allRows.push(rowObj);
        }
      }
    }
  }

  // Tulis ke sheet REKAP_SEMUA_KECAMATAN
  var rekapSheet = getOrCreateSheet(ss, rekapName);
  if (allRows.length > 0) {
    writeTableToSheet(rekapSheet, allRows, "#0f172a");
  }

  // Juga perbarui Data_Penilaian_Kerusakan_PUPR untuk kompatibilitas tautan lama
  if (rekapName !== "Data_Penilaian_Kerusakan_PUPR") {
    var altSheet = getOrCreateSheet(ss, "Data_Penilaian_Kerusakan_PUPR");
    if (allRows.length > 0) {
      writeTableToSheet(altSheet, allRows, "#0f172a");
    }
  }

  // Perbarui lembar dashboard ringkasan statistik
  if (allRows.length > 0) {
    createStatisticsSummarySheet(ss, allRows);
  }

  return {
    sourceSheetCount: sourceSheetsFound.length,
    sourceSheets: sourceSheetsFound,
    totalConsolidatedRows: allRows.length,
    masterTabName: rekapName
  };
}

/**
 * Menu Spreadsheet Otomatis pada Google Sheets:
 * Memudahkan pengguna mengklik satu kali untuk menyatukan seluruh 7 sheet kecamatan ke sheet rekap
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('SIM-PKBG PUPR')
      .addItem('🔄 Satukan 7 Sheet Kecamatan ke Sheet Rekap (REKAP_SEMUA_KECAMATAN)', 'menuConsolidateSheets')
      .addItem('📊 Perbarui Ringkasan Statistik Kecamatan (00_RINGKASAN_KECAMATAN)', 'menuUpdateStats')
      .addToUi();
  } catch(e) {}
}

function menuConsolidateSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var res = consolidateKecamatanSheetsToRekap(ss, "REKAP_SEMUA_KECAMATAN");
  SpreadsheetApp.getUi().alert(
    "Konsolidasi Selesai!",
    "Berhasil menyatukan seluruh data dari " + res.sourceSheetCount + " sheet kecamatan ke dalam tab '" + res.masterTabName + "'.\\nTotal " + res.totalConsolidatedRows + " data bangunan sekarang siap dibaca oleh aplikasi web SIM-PKBG.",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuUpdateStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName("REKAP_SEMUA_KECAMATAN") || ss.getSheetByName("Data_Penilaian_Kerusakan_PUPR");
  if (masterSheet && masterSheet.getLastRow() > 1) {
    var rawData = masterSheet.getDataRange().getValues();
    var headers = rawData[0];
    var allRows = [];
    for (var i = 1; i < rawData.length; i++) {
      var obj = {};
      for (var h = 0; h < headers.length; h++) obj[headers[h]] = rawData[i][h];
      allRows.push(obj);
    }
    createStatisticsSummarySheet(ss, allRows);
    SpreadsheetApp.getUi().alert("Ringkasan statistik 00_RINGKASAN_KECAMATAN berhasil diperbarui!");
  }
}
`;
}

/**
 * Export assessments to Multi-Sheet Excel Workbook (.xlsx) with a dedicated tab for each Kecamatan
 */
export function exportAssessmentsToExcelMultiSheet(
  assessments: BuildingAssessment[],
  kecamatansList?: Kecamatan[]
): void {
  if (assessments.length === 0) return;

  const wb = XLSX.utils.book_new();

  // 1. Sheet 1: RINGKASAN REKAPITULASI KECAMATAN
  const grouped = groupAssessmentsByKecamatan(assessments);
  const summaryRows: any[] = [];
  
  let no = 1;
  let grandTotalGedung = 0;
  let grandTotalRingan = 0;
  let grandTotalSedang = 0;
  let grandTotalBerat = 0;
  let grandTotalSangatBerat = 0;
  let grandTotalBiaya = 0;
  let grandTotalLuas = 0;

  // Collect all known kecamatan names
  const allKecNamesSet = new Set<string>();
  if (kecamatansList) {
    kecamatansList.forEach((k) => allKecNamesSet.add(k.name));
  }
  Object.keys(grouped).forEach((k) => allKecNamesSet.add(k));
  const sortedKecNames = Array.from(allKecNamesSet).sort();

  for (const kecName of sortedKecNames) {
    const items = grouped[kecName] || [];
    const totalGedung = items.length;
    let ringan = 0;
    let sedang = 0;
    let berat = 0;
    let sangatBerat = 0;
    let totalBiaya = 0;
    let totalLuas = 0;

    for (const it of items) {
      if (it.damageClassification === 'Rusak Ringan') ringan++;
      else if (it.damageClassification === 'Rusak Sedang') sedang++;
      else if (it.damageClassification === 'Rusak Berat') berat++;
      else if (it.damageClassification === 'Rusak Sangat Berat') sangatBerat++;

      totalBiaya += it.roundedRehabCost || 0;
      totalLuas += it.totalFloorAreaM2 || 0;
    }

    summaryRows.push({
      'No': no++,
      'Nama Kecamatan': kecName,
      'Jumlah Gedung': totalGedung,
      'Rusak Ringan': ringan,
      'Rusak Sedang': sedang,
      'Rusak Berat': berat,
      'Rusak Sangat Berat': sangatBerat,
      'Total Luas Lantai (M2)': totalLuas,
      'Total Usulan Biaya Rehab (Rp)': totalBiaya,
      'Format Rupiah': formatRupiah(totalBiaya),
    });

    grandTotalGedung += totalGedung;
    grandTotalRingan += ringan;
    grandTotalSedang += sedang;
    grandTotalBerat += berat;
    grandTotalSangatBerat += sangatBerat;
    grandTotalBiaya += totalBiaya;
    grandTotalLuas += totalLuas;
  }

  // Add Grand Total Row to Summary
  summaryRows.push({
    'No': 'TOTAL',
    'Nama Kecamatan': 'SEMUA KECAMATAN',
    'Jumlah Gedung': grandTotalGedung,
    'Rusak Ringan': grandTotalRingan,
    'Rusak Sedang': grandTotalSedang,
    'Rusak Berat': grandTotalBerat,
    'Rusak Sangat Berat': grandTotalSangatBerat,
    'Total Luas Lantai (M2)': grandTotalLuas,
    'Total Usulan Biaya Rehab (Rp)': grandTotalBiaya,
    'Format Rupiah': formatRupiah(grandTotalBiaya),
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'REKAP_KECAMATAN');

  // 2. Sheet 2: MASTER GABUNGAN SEMUA DATA
  const allFormattedRows = assessments.map(formatAssessmentForGoogleSheet);
  const wsMaster = XLSX.utils.json_to_sheet(allFormattedRows);
  XLSX.utils.book_append_sheet(wb, wsMaster, 'SEMUA_DATA_GABUNGAN');

  // 3. Sheet 3..N: DEDICATED SHEET UNTUK SETIAP KECAMATAN
  for (const kecName of sortedKecNames) {
    const items = grouped[kecName] || [];
    const kecFormattedRows: Record<string, any>[] = items.map(formatAssessmentForGoogleSheet);
    
    // Add sub-total summary at the bottom of each Kecamatan sheet if data exists
    if (kecFormattedRows.length > 0) {
      const kecTotalBiaya = items.reduce((acc, curr) => acc + (curr.roundedRehabCost || 0), 0);
      const kecTotalLuas = items.reduce((acc, curr) => acc + (curr.totalFloorAreaM2 || 0), 0);

      kecFormattedRows.push({
        'No Registrasi': 'TOTAL KECAMATAN',
        'Nama Bangunan': `${items.length} Bangunan Terdata`,
        'Kategori / Fungsi Bangunan': '-',
        'Jenis Bencana': '-',
        'Tanggal Bencana': '-',
        'Tanggal Penilaian': '-',
        'Pengguna / Pemilik': '-',
        'Dinas Teknis': '-',
        'Kelas Bangunan': '-',
        'Kecamatan': kecName,
        'Desa / Kelurahan': '-',
        'Alamat Lengkap': '-',
        'Luas Lantai (M2)': kecTotalLuas,
        'Jumlah Tingkat': 0,
        'Tahun Dibangun': 0,
        'Tingkat Kerusakan (%)': 0,
        'Klasifikasi Kerusakan': '-',
        'HSBGN / M2 (Rp)': 0,
        'Biaya Perawatan / M2 (Rp)': 0,
        'Biaya Bongkaran / M2 (Rp)': 0,
        'Total Biaya / M2 (Rp)': 0,
        'Ajuan Biaya Rehab (Rp)': kecTotalBiaya,
        'Format Rupiah': formatRupiah(kecTotalBiaya),
        'Terbilang': '-',
        'Status Verifikasi': '-',
        'Diverifikasi Oleh': '-',
        'Tanggal Verifikasi': '-',
        'Catatan Verifikator': '-',
        'Jumlah Foto Kerusakan': 0,
        'Surveyor / Petugas': '-',
        'Kota Laporan': '-',
        'Jumlah Tim Analisis': 0,
        'Terakhir Diperbarui': '-',
      });
    }

    const wsKec = XLSX.utils.json_to_sheet(
      kecFormattedRows.length > 0 
        ? kecFormattedRows 
        : [{ 'Status': `Belum ada data gedung di Kecamatan ${kecName}` }]
    );
    const tabName = sanitizeSheetName(`Kec. ${kecName}`);
    XLSX.utils.book_append_sheet(wb, wsKec, tabName);
  }

  // Trigger File Download
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `SIM_PKBG_Multi_Sheet_Kecamatan_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export assessments to CSV file for Google Sheets / Excel import
 */
export function exportAssessmentsToCSV(assessments: BuildingAssessment[], customTitle?: string): void {
  if (assessments.length === 0) return;

  const rows = assessments.map(formatAssessmentForGoogleSheet);
  const headers = Object.keys(rows[0]);

  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCSV).join(','));

  for (const row of rows) {
    const values = headers.map((header) => escapeCSV(row[header as keyof typeof row]));
    csvLines.push(values.join(','));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n'); // Add BOM for Indonesian excel UTF-8
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute(
    'download',
    customTitle ? `${customTitle}_${dateStr}.csv` : `Penilaian_Kerusakan_Gedung_PUPR_${dateStr}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formats a UserActivityLog entry into tabular columns for Google Sheets & Excel
 */
export function formatActivityLogForGoogleSheet(log: UserActivityLog, index?: number) {
  const d = new Date(log.timestamp);
  const formattedWaktu = d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    'No': index !== undefined ? index + 1 : 1,
    'Waktu Akses': formattedWaktu,
    'Nama Pengguna': log.userName,
    'Email': log.userEmail,
    'Peran / Role': log.roleTitle,
    'Kategori Aktivitas': log.actionCategory,
    'Tindakan / Jenis Akses': log.actionDescription,
    'Objek / Dokumen Target': log.targetResource || '-',
    'Rincian / Keterangan': log.details || '-',
    'IP Address': log.ipAddress || '127.0.0.1 (Web Preview)',
    'Timestamp ISO': log.timestamp,
    'ID Log': log.id,
  };
}

/**
 * Directly stream a single activity log to Google Sheet
 */
export async function directSaveActivityLogToGoogleSheet(
  log: UserActivityLog,
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return { success: false, message: 'Webhook Google Sheet belum dikonfigurasi.' };
  }

  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
  const rowData = formatActivityLogForGoogleSheet(log);

  const payload: GoogleSheetRowPayload = {
    action: 'log_user_access',
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    logSheetName: config.logSheetName || 'Log_Akses_Pengguna',
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: spreadsheetId || undefined,
    data: rowData,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { success: true, message: 'Log akses tercatat di Google Sheet!' };
  } catch (err: any) {
    console.warn('Activity log direct save notice:', err?.message || err);
    return { success: false, message: err.message || 'Gagal menyimpan log ke Google Sheet' };
  }
}

/**
 * Sync multiple activity logs to the dedicated 'Log_Akses_Pengguna' sheet tab in Google Sheets
 */
export async function syncActivityLogsToGoogleSheet(
  logs: UserActivityLog[],
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; count: number }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return { success: false, message: 'Webhook Google Sheet belum dikonfigurasi.', count: 0 };
  }

  if (logs.length === 0) {
    return { success: false, message: 'Belum ada data log aktivitas untuk disinkronkan.', count: 0 };
  }

  const rows = logs.map((l, idx) => formatActivityLogForGoogleSheet(l, idx));
  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
  const logTab = config.logSheetName || 'Log_Akses_Pengguna';

  const payload: GoogleSheetRowPayload = {
    action: 'sync_activity_logs',
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    logSheetName: logTab,
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: spreadsheetId || undefined,
    data: rows,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: `Berhasil sinkronisasi ${logs.length} catatan log akses ke tab "${logTab}" di Google Sheet!`,
      count: logs.length,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal sinkronisasi log ke Google Sheet: ${err.message}`,
      count: 0,
    };
  }
}

/**
 * Export UserActivityLogs to Excel (.xlsx)
 */
export function exportActivityLogsToExcel(logs: UserActivityLog[]): void {
  if (logs.length === 0) return;

  const rows = logs.map((l, idx) => formatActivityLogForGoogleSheet(l, idx));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 22 }, // Waktu Akses
    { wch: 25 }, // Nama Pengguna
    { wch: 28 }, // Email
    { wch: 20 }, // Peran / Role
    { wch: 22 }, // Kategori Aktivitas
    { wch: 35 }, // Tindakan / Jenis Akses
    { wch: 35 }, // Objek / Dokumen Target
    { wch: 40 }, // Rincian / Keterangan
    { wch: 20 }, // IP Address
    { wch: 25 }, // Timestamp ISO
    { wch: 25 }, // ID Log
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Log_Akses_Pengguna');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Log_Akses_Pengguna_SIM_PKBG_${dateStr}.xlsx`);
}

/**
 * Export UserActivityLogs to CSV
 */
export function exportActivityLogsToCsv(logs: UserActivityLog[]): void {
  if (logs.length === 0) return;

  const rows = logs.map((l, idx) => formatActivityLogForGoogleSheet(l, idx));
  const headers = Object.keys(rows[0]);

  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCSV).join(','));

  for (const row of rows) {
    const values = headers.map((header) => escapeCSV(row[header as keyof typeof row]));
    csvLines.push(values.join(','));
  }

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `Log_Akses_Pengguna_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to get a value from a row object with multiple case-insensitive key candidate fallbacks
 */
export function getVal(rowObj: Record<string, any>, candidates: string[]): any {
  if (!rowObj) return '';
  const keys = Object.keys(rowObj);
  for (const cand of candidates) {
    if (rowObj[cand] !== undefined && String(rowObj[cand]).trim() !== '') return rowObj[cand];
  }
  for (const cand of candidates) {
    const candLower = cand.toLowerCase().trim();
    for (const k of keys) {
      if (k.toLowerCase().trim() === candLower && rowObj[k] !== undefined && String(rowObj[k]).trim() !== '') {
        return rowObj[k];
      }
    }
  }
  for (const cand of candidates) {
    const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of keys) {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (kNorm === candNorm && rowObj[k] !== undefined && String(rowObj[k]).trim() !== '') {
        return rowObj[k];
      }
    }
  }
  for (const cand of candidates) {
    const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (candNorm.length >= 3) {
      for (const k of keys) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (kNorm.includes(candNorm) && rowObj[k] !== undefined && String(rowObj[k]).trim() !== '') {
          return rowObj[k];
        }
      }
    }
  }
  return '';
}

/**
 * Flexible parser converting raw extracted row objects into BuildingAssessment instances
 */
export function parseExtractedRowsToAssessments(
  extractedRows: Array<{ rowObj: Record<string, any>; sheetRowNumber: number; sourceSheet?: string }>
): BuildingAssessment[] {

  const parseExcelDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '-' || trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'invalid date') {
        return new Date().toISOString().split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        const [, d, m, y] = dmy;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        const dObj = new Date(parsed);
        if (!isNaN(dObj.getTime())) {
          return dObj.toISOString().split('T')[0];
        }
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).trim().replace(/%/g, '').replace(/\s+/g, '');
    if (!str || str === '-') return 0;
    let normalized = str;
    if (normalized.includes(',') && normalized.includes('.')) {
      const lastComma = normalized.lastIndexOf(',');
      const lastDot = normalized.lastIndexOf('.');
      if (lastComma > lastDot) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const resolveKecamatan = (
    rawKec: string,
    buildingName = '',
    desaName = '',
    address = '',
    ownerAgency = ''
  ): { id: string; name: string } => {
    const cleanRaw = rawKec.trim();
    const combined = `${cleanRaw} ${buildingName} ${desaName} ${address} ${ownerAgency}`.toLowerCase();

    if (combined.includes('aesesa selatan') || (combined.includes('aesesa') && combined.includes('selatan'))) {
      return { id: 'kec_2', name: 'Aesesa Selatan' };
    }
    if (combined.includes('aesesa')) {
      return { id: 'kec_1', name: 'Aesesa' };
    }
    if (
      combined.includes('boawae') ||
      combined.includes('leguderu') ||
      combined.includes('pustu solo') ||
      combined.includes('raja') ||
      combined.includes('dhereisa') ||
      combined.includes('mulakoli') ||
      combined.includes('roga') ||
      combined.includes('kelewae') ||
      combined.includes('olakile')
    ) {
      return { id: 'kec_3', name: 'Boawae' };
    }
    if (
      combined.includes('mauponggo') ||
      combined.includes('lokalaba') ||
      combined.includes('sawu') ||
      combined.includes('aelapu') ||
      combined.includes('wutu')
    ) {
      return { id: 'kec_4', name: 'Mauponggo' };
    }
    if (
      combined.includes('nangaroro') ||
      combined.includes('degasau') ||
      combined.includes('woewoa') ||
      combined.includes('tonggorambang')
    ) {
      return { id: 'kec_5', name: 'Nangaroro' };
    }
    if (
      combined.includes('keo tengah') ||
      combined.includes('maundai') ||
      combined.includes('kotagana') ||
      combined.includes('kotawuji')
    ) {
      return { id: 'kec_6', name: 'Keo Tengah' };
    }
    if (
      combined.includes('wolowae') ||
      combined.includes('tendatoto') ||
      combined.includes('anakoli') ||
      combined.includes('dorenga')
    ) {
      return { id: 'kec_7', name: 'Wolowae' };
    }

    if (cleanRaw && cleanRaw.length > 1) {
      return { id: `kec_${cleanRaw.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: cleanRaw };
    }

    return { id: 'kec_3', name: 'Boawae' };
  };

  const results: BuildingAssessment[] = [];
  const seenCodes = new Set<string>();
  const seenSignatures = new Set<string>();

  const isRealRegCode = (str: string): boolean => {
    const clean = str.trim();
    if (!clean) return false;
    const lower = clean.toLowerCase();
    if (['-', '--', '0', 'n/a', 'na', 'none', 'null', 'undefined', 'invalid'].includes(lower)) return false;
    // Simple row numbers (1, 2, 3... 9999) are row serial numbers, not registration codes
    if (/^\d{1,4}$/.test(clean)) return false;
    return true;
  };

  extractedRows.forEach(({ rowObj, sheetRowNumber, sourceSheet }, index) => {
    const rawCodeCandidate = String(
      getVal(rowObj, ['No Registrasi', 'Nomor Registrasi', 'No Reg', 'Kode Registrasi', 'ID Registrasi', 'No. Reg', 'Kode']) || ''
    ).trim();

    const rawCode = isRealRegCode(rawCodeCandidate) ? rawCodeCandidate : '';

    let buildingName = String(
      getVal(rowObj, [
        'Nama Bangunan', 'Nama Gedung', 'Nama Objek', 'Nama Fasilitas',
        'Nama Pemilik', 'Nama Pemilik Rumah', 'Nama Pemilik Gedung',
        'Nama KK', 'Nama Kepala Keluarga', 'Nama Warga', 'Pemilik',
        'Penerima Bantuan', 'Nama Subjek', 'Nama Sarana', 'Bangunan', 'Nama'
      ]) || ''
    ).trim();

    let rawKec = String(getVal(rowObj, ['Kecamatan', 'Kec', 'Nama Kecamatan']) || '').trim();
    if (!rawKec && sourceSheet && sourceSheet.startsWith('Kec ')) {
      rawKec = sourceSheet.replace(/^Kec\s+/i, '');
    }

    const desaName = String(getVal(rowObj, ['Desa / Kelurahan', 'Desa', 'Kelurahan', 'Nama Desa', 'Kampung', 'Dusun']) || '').trim();
    const detailedAddress = String(getVal(rowObj, ['Alamat Lengkap', 'Alamat', 'Lokasi', 'RT/RW']) || '').trim();
    const ownerAgency = String(getVal(rowObj, ['Pengguna / Pemilik', 'Pemilik', 'Pengguna', 'Instansi', 'Pemilik / Pengelola', 'Nama KK', 'Kepala Keluarga']) || '');
    const namaPemilikRumah = String(getVal(rowObj, ['Nama Pemilik Rumah', 'Pemilik Rumah', 'Nama Pemilik', 'Nama KK', 'Nama Kepala Keluarga']) || '');
    const namaPemilikGedung = String(getVal(rowObj, ['Nama Pemilik Gedung', 'Pemilik Gedung']) || '');

    // Fallback: If buildingName is not yet set, construct a clear descriptive name
    if (!buildingName) {
      if (namaPemilikRumah) {
        buildingName = `Rumah ${namaPemilikRumah}`;
      } else if (namaPemilikGedung) {
        buildingName = namaPemilikGedung;
      } else if (ownerAgency) {
        buildingName = `Bangunan Milik ${ownerAgency}`;
      } else if (detailedAddress) {
        buildingName = `Bangunan di ${detailedAddress}`;
      } else if (desaName) {
        buildingName = `Bangunan Desa ${desaName} (Baris ${sheetRowNumber})`;
      } else if (rawCode) {
        buildingName = `Gedung ${rawCode}`;
      }
    }

    // Only skip if row is truly empty across all cells
    const hasAnyContent = Object.values(rowObj).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-'
    );
    if (!hasAnyContent) return;

    if (!buildingName) {
      buildingName = `Survei Bangunan Lapangan (Baris ${sheetRowNumber})`;
    }

    const kecInfo = resolveKecamatan(rawKec, buildingName, desaName, detailedAddress, ownerAgency);

    const totalFloorAreaM2 = parseNumber(getVal(rowObj, ['Luas Lantai (M2)', 'Luas Lantai', 'Luas (M2)', 'Luas', 'Luas Bangunan'])) || 0;
    const totalDamagePercent = parseNumber(getVal(rowObj, ['Tingkat Kerusakan (%)', 'Tingkat Kerusakan', '% Kerusakan', 'Persentase Kerusakan'])) || 0;
    const roundedRehabCost = parseNumber(getVal(rowObj, ['Ajuan Biaya Rehab (Rp)', 'Ajuan Biaya', 'Total Biaya', 'Estimasi Biaya', 'RAB'])) || 0;

    // Unique registration code and ID generation (Never drop survey rows, record all 98 items)
    let code = rawCode;
    if (code) {
      const codeUpper = code.toUpperCase();
      if (seenCodes.has(codeUpper)) {
        code = `${code}-${index + 1}`;
      }
      seenCodes.add(code.toUpperCase());
    } else {
      code = `REG-PUPR-2026-${String(index + 1).padStart(4, '0')}`;
    }

    const cleanSheet = (sourceSheet || 'sheet').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const id = `sheet_${cleanSheet}_r${sheetRowNumber}_i${index + 1}`;

    const numberOfFloors = parseNumber(getVal(rowObj, ['Jumlah Tingkat', 'Jumlah Lantai', 'Tingkat', 'Lantai'])) || 1;
    const yearBuilt = parseNumber(getVal(rowObj, ['Tahun Dibangun', 'Tahun Pembangunan', 'Tahun'])) || new Date().getFullYear();
    
    let damageClassification = getVal(rowObj, ['Klasifikasi Kerusakan', 'Klasifikasi', 'Kategori Kerusakan']) as any;
    if (!damageClassification || typeof damageClassification !== 'string') {
      damageClassification = totalDamagePercent > 45 ? 'Rusak Berat' : totalDamagePercent > 20 ? 'Rusak Sedang' : 'Rusak Ringan';
    }

    const hsbgnPerM2 = parseNumber(getVal(rowObj, ['HSBGN / M2 (Rp)', 'HSBGN / M2', 'HSBGN'])) || 0;
    const treatmentCostPerM2 = parseNumber(getVal(rowObj, ['Biaya Perawatan / M2 (Rp)', 'Biaya Perawatan'])) || 0;
    const demolitionCostPerM2 = parseNumber(getVal(rowObj, ['Biaya Bongkaran / M2 (Rp)', 'Biaya Bongkaran'])) || 0;
    const totalCostPerM2 = parseNumber(getVal(rowObj, ['Total Biaya / M2 (Rp)', 'Total Biaya / M2'])) || 0;
    const costTerbilang = String(getVal(rowObj, ['Terbilang']) || '');

    const verificationStatus = (getVal(rowObj, ['Status Verifikasi', 'Status']) as any) || 'Menunggu Verifikasi';
    const verifiedByRaw = getVal(rowObj, ['Diverifikasi Oleh', 'Verifikator']);
    const verifiedBy = verifiedByRaw && verifiedByRaw !== '-' ? String(verifiedByRaw) : undefined;
    const verificationNotesRaw = getVal(rowObj, ['Catatan Verifikator', 'Catatan']);
    const verificationNotes = verificationNotesRaw && verificationNotesRaw !== '-' ? String(verificationNotesRaw) : undefined;
    const driveFolderRaw = getVal(rowObj, ['Link Folder Foto Google Drive', 'Link Drive', 'Folder Foto']);
    const googleDriveFolderUrl = driveFolderRaw && driveFolderRaw !== '-' ? String(driveFolderRaw) : undefined;
    
    const backupDriveUrlRaw = getVal(rowObj, ['Link Folder G-Drive (Backup Foto)', 'Link Folder G-Drive']);
    const backupDriveUrl = backupDriveUrlRaw && backupDriveUrlRaw !== '-' ? String(backupDriveUrlRaw) : undefined;

    const disasterDate = parseExcelDate(getVal(rowObj, ['Tanggal Bencana', 'Tgl Bencana']));
    const assessmentDate = parseExcelDate(getVal(rowObj, ['Tanggal Penilaian', 'Tanggal Survei', 'Tgl Penilaian']));
    const lastUpdatedRaw = getVal(rowObj, ['Terakhir Diperbarui', 'Diperbarui Pada', 'Timestamp']);
    let lastUpdated = new Date().toISOString();
    if (lastUpdatedRaw && lastUpdatedRaw !== '-' && String(lastUpdatedRaw).trim() !== '') {
      const parsedTime = Date.parse(String(lastUpdatedRaw));
      if (!isNaN(parsedTime)) {
        const dObj = new Date(parsedTime);
        if (!isNaN(dObj.getTime())) {
          lastUpdated = dObj.toISOString();
        }
      }
    }

    // Match canonical desaId from name
    let matchedDesaId = '';
    if (desaName) {
      const cleanDesa = desaName.toLowerCase().replace(/^(desa|kelurahan)\s+/i, '').trim();
      const found = INITIAL_DESA.find(
        (d) => d.name.toLowerCase() === cleanDesa || d.name.toLowerCase() === desaName.toLowerCase()
      );
      if (found) matchedDesaId = found.id;
    }
    const desaId = matchedDesaId || `desa_${desaName.toLowerCase().replace(/\s+/g, '_') || 'umum'}`;
    const nikPemilik = String(getVal(rowObj, ['NIK Pemilik', 'NIK', 'NIK 16 Digit']) || '0');
    const noKkPemilik = String(getVal(rowObj, ['No KK Pemilik', 'No KK', 'Nomor KK', 'No. KK']) || '0');

    const headName = String(getVal(rowObj, ['Nama Kepala Dinas', 'Kepala Dinas', 'Kadis']) || '');
    const headNip = String(getVal(rowObj, ['NIP Kepala Dinas', 'NIP Kadis', 'NIP']) || '');
    const headRank = String(getVal(rowObj, ['Pangkat Kepala Dinas', 'Pangkat / Golongan', 'Pangkat']) || '');
    
    const rawTeam = String(getVal(rowObj, ['Tim Analisis', 'Tim Evaluasi', 'Tim Surveyor']) || '');
    const analysisTeam = rawTeam ? rawTeam.split(',').map(s => s.trim()).filter(Boolean) : [];

    const rawComponentsJson = getVal(rowObj, ['Rincian Komponen JSON', 'Komponen JSON', 'Rincian Komponen', 'Komponen']);
    let parsedComponents: any[] = [];
    if (rawComponentsJson && typeof rawComponentsJson === 'string' && rawComponentsJson.trim().startsWith('[')) {
      try {
        parsedComponents = JSON.parse(rawComponentsJson);
      } catch (e) {
        // Ignored
      }
    }

    const rawPhotosJson = getVal(rowObj, ['Foto JSON', 'Daftar Foto JSON', 'Photos JSON', 'Foto']);
    let parsedPhotos: any[] = [];
    if (rawPhotosJson && typeof rawPhotosJson === 'string' && rawPhotosJson.trim().startsWith('[')) {
      try {
        parsedPhotos = JSON.parse(rawPhotosJson);
      } catch (e) {
        // Ignored
      }
    }

    results.push({
      id,
      code,
      buildingName,
      buildingCategory: (getVal(rowObj, ['Kategori / Fungsi Bangunan', 'Kategori', 'Fungsi Bangunan']) as any) || 'Gedung Pemerintah',
      disasterType: (getVal(rowObj, ['Jenis Bencana', 'Bencana']) as any) || 'Gempa Bumi',
      disasterDate,
      assessmentDate,
      ownerAgency: ownerAgency || namaPemilikRumah || namaPemilikGedung,
      namaPemilikRumah: namaPemilikRumah || ownerAgency,
      namaPemilikGedung: namaPemilikGedung || ownerAgency,
      nikPemilik,
      noKkPemilik,
      responsibleDepartment: String(getVal(rowObj, ['Dinas Teknis', 'Dinas']) || 'Dinas Pekerjaan Umum dan Penataan Ruang'),
      buildingClass: (getVal(rowObj, ['Kelas Bangunan', 'Kelas']) as any) || 'Bangunan Sederhana',
      kecamatanId: kecInfo.id,
      kecamatanName: kecInfo.name,
      desaId,
      desaName,
      detailedAddress: String(getVal(rowObj, ['Alamat Lengkap', 'Alamat', 'Lokasi']) || ''),
      totalFloorAreaM2,
      numberOfFloors,
      yearBuilt,
      components: parsedComponents,
      totalDamagePercent,
      damageClassification,
      hsbgnPerM2,
      treatmentCostPerM2,
      demolitionPercent: 8,
      demolitionCostPerM2,
      totalCostPerM2,
      totalRehabCost: roundedRehabCost || (totalFloorAreaM2 * totalCostPerM2),
      roundedRehabCost,
      costTerbilang,
      photos: parsedPhotos,
      cityLocation: String(getVal(rowObj, ['Kota Laporan', 'Kota']) || 'Mbay'),
      reportDateStr: 'September 2026',
      headOfDepartment: {
        title: 'Kepala Dinas Pekerjaan Umum dan Penataan Ruang',
        subTitle: 'Kabupaten Nagekeo',
        rank: headRank,
        name: headName,
        nip: headNip,
      },
      analysisTeam,
      verificationStatus,
      verifiedBy,
      verificationNotes,
      targetSheetName: sourceSheet || `Kec. ${kecInfo.name}`,
      sourceSheet: sourceSheet,
      backupDriveUrl,
      googleSheetSynced: true,
      googleSheetSyncedAt: new Date().toISOString(),
      googleDriveFolderUrl,
      createdBy: 'surveyor_google_sheet',
      createdByName: String(getVal(rowObj, ['Surveyor / Petugas', 'Surveyor', 'Petugas']) || 'Surveyor Lapangan'),
      createdAt: disasterDate ? `${disasterDate}T08:00:00.000Z` : new Date().toISOString(),
      updatedAt: lastUpdated,
    });
  });

  return results;
}

/**
 * Triggers Google Apps Script consolidation of all 7 Kecamatan sheets into 1 Master Rekap sheet (REKAP_SEMUA_KECAMATAN).
 * If Webhook is not reachable but assessments are in memory, performs sync to REKAP_SEMUA_KECAMATAN.
 */
export async function consolidateSheetsInGoogleSheet(
  config: GoogleSheetConfig,
  assessments?: BuildingAssessment[]
): Promise<{ success: boolean; message: string; totalConsolidated?: number }> {
  const masterSheetName = config.sheetName || 'REKAP_SEMUA_KECAMATAN';
  const hasWebhook = Boolean(config.webhookUrl && config.webhookUrl.startsWith('http'));

  if (hasWebhook) {
    try {
      // 1. Send POST with action: 'consolidate_sheets'
      const payload: GoogleSheetRowPayload = {
        action: 'consolidate_sheets',
        sheetName: masterSheetName,
        timestamp: new Date().toISOString(),
      };

      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (postErr) {
        console.warn('POST consolidate_sheets note:', postErr);
      }

      // 2. Also call GET with action: 'consolidate' to trigger and get return details
      try {
        const getUrl = `${config.webhookUrl}${config.webhookUrl.includes('?') ? '&' : '?'}action=consolidate&_t=${Date.now()}`;
        const getRes = await fetch(getUrl, { cache: 'no-store' });
        if (getRes.ok) {
          const json = await getRes.json();
          if (json && (json.status === 'success' || json.data)) {
            const count = json.totalRows ?? (Array.isArray(json.data) ? json.data.length : undefined);
            return {
              success: true,
              message: `Berhasil menyatukan seluruh data 7 kecamatan ke sheet rekap "${masterSheetName}"! (${count !== undefined ? `${count} data gedung` : 'Selesai'})`,
              totalConsolidated: count,
            };
          }
        }
      } catch (getErr) {
        console.warn('GET consolidate note:', getErr);
      }

      return {
        success: true,
        message: `Perintah konsolidasi 7 sheet kecamatan ke tab "${masterSheetName}" berhasil dikirimkan ke Google Sheet!`,
      };
    } catch (err: any) {
      console.warn('Webhook consolidate error:', err);
    }
  }

  // Fallback: If we have current assessments in memory, push them to REKAP_SEMUA_KECAMATAN via syncAllToGoogleSheet
  if (assessments && assessments.length > 0 && hasWebhook) {
    const syncRes = await syncAllToGoogleSheet(assessments, {
      ...config,
      sheetName: masterSheetName,
      splitByKecamatan: true,
      includeMasterSummarySheet: true,
    });
    return {
      success: syncRes.success,
      message: syncRes.success
        ? `Berhasil menyatukan ${assessments.length} data ke sheet rekap "${masterSheetName}"!`
        : syncRes.message,
      totalConsolidated: syncRes.syncedCount,
    };
  }

  return {
    success: false,
    message: 'Webhook Google Sheet belum dikonfigurasi untuk menjalankan konsolidasi otomatis.',
  };
}

interface SheetAssessmentsCache {
  spreadsheetId: string;
  data: BuildingAssessment[];
  timestamp: number;
}
let memoryAssessmentsCache: SheetAssessmentsCache | null = null;
const CACHE_TTL_MS = 25000; // 25 seconds fast in-memory cache

/**
 * Reads all assessment data directly from Google Sheet starting from row A2 (the first data row).
 * Supports parallel multi-stream fetch & direct CSV export of multi-tab sheets.
 */
export async function fetchAssessmentsFromGoogleSheet(
  config: GoogleSheetConfig,
  forceRefresh = false
): Promise<{ success: boolean; data: BuildingAssessment[]; message: string; totalRows?: number }> {
  const hasSpreadsheet = Boolean(config.spreadsheetUrl && isConfiguredSheetUrl(config.spreadsheetUrl));
  const hasWebhook = Boolean(config.webhookUrl && config.webhookUrl.startsWith('http'));

  if (!hasSpreadsheet && !hasWebhook) {
    return {
      success: false,
      data: [],
      message: 'Tautan Google Sheet belum diatur atau Webhook URL belum terhubung.',
    };
  }

  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
  if (!spreadsheetId) {
    return {
      success: false,
      data: [],
      message: 'ID Spreadsheet Google Sheet tidak dapat ditemukan dari tautan.',
    };
  }

  // Fast In-Memory Cache Check: Return immediately if fetched within last 25s and not force-refreshing
  if (!forceRefresh && memoryAssessmentsCache && memoryAssessmentsCache.spreadsheetId === spreadsheetId) {
    const age = Date.now() - memoryAssessmentsCache.timestamp;
    if (age < CACHE_TTL_MS && memoryAssessmentsCache.data.length > 0) {
      return {
        success: true,
        data: memoryAssessmentsCache.data,
        totalRows: memoryAssessmentsCache.data.length,
        message: `Memuat instan ${memoryAssessmentsCache.data.length} data penilaian dari cache performa tinggi.`,
      };
    }
  }

  interface ExtractedRow {
    rowObj: Record<string, any>;
    sheetRowNumber: number;
    sourceSheet?: string;
  }
  const allExtractedRows: ExtractedRow[] = [];

  // Check if gid is present in URL
  const gidMatch = config.spreadsheetUrl.match(/[?#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '';
  const masterSheetName = config.sheetName || 'REKAP_SEMUA_KECAMATAN';

  const cacheBuster = Date.now();
  let successfulFetches = 0;
  let lastStatus = 0;

  // List of known Rekapitulasi / System sheets that must NEVER be read as individual survey rows
  const EXCLUDED_REKAP_SHEET_KEYWORDS = [
    'DATA_PENILAIAN_KERUSAKAN_PUPR',
    'DATA PENILAIAN KERUSAKAN PUPR',
    'DATA_PENILAIAN_KERUSAKAN',
    'DATA PENILAIAN KERUSAKAN',
    'DATA_KERUSAKAN_PUPR',
    'DATA KERUSAKAN PUPR',
    'REKAP_SEMUA_KECAMATAN',
    'REKAP SEMUA KECAMATAN',
    'REKAPITULASI',
    'REKAP',
    'DAFTAR_PENGGUNA',
    'LOG_AKSES_PENGGUNA',
    'DUKCAPIL',
    'REFERENSI',
    'SHEET_REKAP',
    'DATA_REKAP',
  ];

  const isExcludedRekapSheet = (name: string): boolean => {
    if (!name) return false;
    const clean = name.trim().toUpperCase().replace(/[\s_-]+/g, '_');
    const exactExcluded = [
      'DATA_PENILAIAN_KERUSAKAN_PUPR',
      'REKAP_SEMUA_KECAMATAN',
      'REKAPITULASI',
      'REKAP',
      'DAFTAR_PENGGUNA',
      'LOG_AKSES_PENGGUNA',
      'DUKCAPIL',
      'REFERENSI',
      'SHEET_REKAP',
      'DATA_REKAP',
    ];
    return exactExcluded.some((ex) => clean === ex || clean.startsWith(ex + '_') || clean.endsWith('_' + ex));
  };

  // Helper function to parse GViz JSON response into ExtractedRow[]
  const parseGvizResponseToRows = (rawText: string, sheetName: string): ExtractedRow[] => {
    if (!rawText || !rawText.includes('google.visualization.Query.setResponse')) return [];
    if (isExcludedRekapSheet(sheetName)) return [];

    try {
      const match = rawText.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
      if (!match || !match[1]) return [];
      const json = JSON.parse(match[1]);
      if (!json || json.status === 'error' || !json.table) return [];

      const cols = json.table.cols || [];
      const headers = cols.map((col: any, idx: number) => {
        return (col.label && String(col.label).trim()) || (col.id && String(col.id).trim()) || `kolom_${idx + 1}`;
      });

      // If sheet tab name itself is an excluded rekap sheet, reject
      if (isExcludedRekapSheet(sheetName)) {
        return [];
      }

      const rows = json.table.rows || [];
      const extracted: ExtractedRow[] = [];

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
    } catch (e) {
      return [];
    }
  };

  // Helper function to parse CSV text into ExtractedRow[]
  const parseCsvTextToRows = (csvText: string, sheetName: string): ExtractedRow[] => {
    if (!csvText || csvText.trim().length === 0) return [];
    if (isExcludedRekapSheet(sheetName)) return [];
    if (csvText.includes('google.visualization.Query.setResponse')) {
      return parseGvizResponseToRows(csvText, sheetName);
    }
    try {
      const workbook = XLSX.read(csvText, { type: 'string', raw: true });
      const firstSheetName = workbook.SheetNames[0];
      if (isExcludedRekapSheet(firstSheetName)) return [];
      const worksheet = workbook.Sheets[firstSheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!matrix || matrix.length === 0) return [];

      const headerKeywords = ['nama', 'bangunan', 'gedung', 'registrasi', 'kode', 'no', 'kecamatan', 'desa', 'kerusakan', 'biaya', 'alamat', 'luas', 'pemilik'];
      let headerRowIdx = 0;
      let maxKeywordMatches = 0;

      for (let r = 0; r < Math.min(matrix.length, 10); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        let matches = 0;
        for (const cell of row) {
          const str = String(cell || '').toLowerCase().trim();
          if (headerKeywords.some((kw) => str.includes(kw))) matches++;
        }
        if (matches > maxKeywordMatches) {
          maxKeywordMatches = matches;
          headerRowIdx = r;
        }
      }

      const rawHeaderRow = Array.isArray(matrix[headerRowIdx]) ? matrix[headerRowIdx] : [];
      const headers = rawHeaderRow.map((c, i) => String(c || '').trim() || `kolom_${i + 1}`);

      const rows: ExtractedRow[] = [];
      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        const hasContent = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim().length > 0 && String(cell).trim() !== '-');
        if (!hasContent) continue;

        const rowObj: Record<string, any> = {};
        for (let c = 0; c < Math.max(headers.length, row.length); c++) {
          const colName = headers[c] || `kolom_${c + 1}`;
          rowObj[colName] = row[c] !== undefined ? row[c] : '';
        }

        rows.push({
          rowObj,
          sheetRowNumber: r + 1,
          sourceSheet: sheetName,
        });
      }
      return rows;
    } catch {
      return [];
    }
  };

  // 7 Kecamatan definitions with comprehensive alias matching
  const kecamatanTabGroups: { name: string; aliases: string[] }[] = [
    {
      name: 'Aesesa',
      aliases: ['Kec. Aesesa', 'Aesesa', 'Kec Aesesa', 'AESESA', 'KEC. AESESA', 'KECAMATAN AESESA', 'Kecamatan Aesesa', 'Kec.Aesesa'],
    },
    {
      name: 'Aesesa Selatan',
      aliases: ['Kec. Aesesa Selatan', 'Aesesa Selatan', 'Kec Aesesa Selatan', 'AESESA SELATAN', 'KEC. AESESA SELATAN', 'KECAMATAN AESESA SELATAN', 'Kecamatan Aesesa Selatan', 'Kec.Aesesa Selatan', 'Aesesa-Selatan'],
    },
    {
      name: 'Boawae',
      aliases: ['Kec. Boawae', 'Boawae', 'Kec Boawae', 'BOAWAE', 'KEC. BOAWAE', 'KECAMATAN BOAWAE', 'Kecamatan Boawae', 'Kec.Boawae'],
    },
    {
      name: 'Mauponggo',
      aliases: ['Kec. Mauponggo', 'Mauponggo', 'Kec Mauponggo', 'MAUPONGGO', 'KEC. MAUPONGGO', 'KECAMATAN MAUPONGGO', 'Kecamatan Mauponggo', 'Kec.Mauponggo'],
    },
    {
      name: 'Nangaroro',
      aliases: ['Kec. Nangaroro', 'Nangaroro', 'Kec Nangaroro', 'NANGARORO', 'KEC. NANGARORO', 'KECAMATAN NANGARORO', 'Kecamatan Nangaroro', 'Kec.Nangaroro'],
    },
    {
      name: 'Keo Tengah',
      aliases: ['Kec. Keo Tengah', 'Keo Tengah', 'Kec Keo Tengah', 'KEO TENGAH', 'KEC. KEO TENGAH', 'KECAMATAN KEO TENGAH', 'Kecamatan Keo Tengah', 'Kec.Keo Tengah', 'Keo-Tengah'],
    },
    {
      name: 'Wolowae',
      aliases: ['Kec. Wolowae', 'Wolowae', 'Kec Wolowae', 'WOLOWAE', 'KEC. WOLOWAE', 'KECAMATAN WOLOWAE', 'Kecamatan Wolowae', 'Kec.Wolowae'],
    },
  ];

  try {
    // 1. Parallel Multi-stream Scan across all 7 Kecamatan tab groups (instant concurrent fetch)
    const kecamatanResults = await Promise.all(
      kecamatanTabGroups.map(async (group) => {
        // Priority 1: standard formatted name 'Kec. ' + group.name
        // Priority 2: plain name group.name
        // Priority 3: other alternative aliases only if needed
        const prioritizedAliases = [
          `Kec. ${group.name}`,
          group.name,
          ...group.aliases.filter((a) => a !== `Kec. ${group.name}` && a !== group.name),
        ];

        for (const alias of prioritizedAliases) {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(alias)}&_t=${cacheBuster}`;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(gvizUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            lastStatus = res.status;
            if (res.ok) {
              const text = await res.text();
              if (text && text.includes('google.visualization.Query.setResponse')) {
                const parsedRows = parseGvizResponseToRows(text, alias);
                if (parsedRows.length > 0) {
                  // Detect whether GViz defaulted to the multi-kecamatan Master Rekap tab
                  const distinctKecs = new Set<string>();
                  parsedRows.forEach((r) => {
                    const val = String(
                      getVal(r.rowObj, ['Kecamatan', 'Kec', 'Wilayah Kecamatan', 'Nama Kecamatan']) || ''
                    ).toLowerCase().trim();
                    if (val) {
                      for (const g of kecamatanTabGroups) {
                        if (val.includes(g.name.toLowerCase())) {
                          distinctKecs.add(g.name.toLowerCase());
                          break;
                        }
                      }
                    }
                  });

                  const isFallbackRekap = distinctKecs.size >= 3;
                  if (!isFallbackRekap) {
                    return { success: true, rows: parsedRows };
                  }
                }
              }
            }
          } catch {}
        }
        return { success: false, rows: [] };
      })
    );

    kecamatanResults.forEach((res) => {
      if (res.success && res.rows.length > 0) {
        allExtractedRows.push(...res.rows);
        successfulFetches++;
      }
    });

    // 2. If 0 rows were found from the 7 kecamatan tabs, check single-tab survey sheets (never rekap)
    if (allExtractedRows.length === 0) {
      const fallbackSheetNames = [
        'Form Responses 1',
        'Jawaban Formulir 1',
        'Sheet1',
        'Data',
      ].filter((name) => !isExcludedRekapSheet(name));

      for (const sheetName of Array.from(new Set(fallbackSheetNames))) {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&_t=${cacheBuster}`;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(gvizUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const text = await res.text();
            if (text && text.includes('google.visualization.Query.setResponse')) {
              const parsedRows = parseGvizResponseToRows(text, sheetName);
              if (parsedRows.length > 0) {
                allExtractedRows.push(...parsedRows);
                successfulFetches++;
                break;
              }
            }
          }
        } catch {}
      }
    }

    // 3. If GViz JSON returned nothing (e.g. sheet not public for JSON), fallback to CSV export
    if (allExtractedRows.length === 0) {
      const defaultUrl = gid
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${cacheBuster}`
        : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&_t=${cacheBuster}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(defaultUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const text = await res.text();
          if (text && !text.trim().startsWith('<!DOCTYPE') && !text.includes('<html')) {
            const parsed = parseCsvTextToRows(text, 'SheetUtama');
            if (parsed.length > 0) {
              allExtractedRows.push(...parsed);
              successfulFetches++;
            }
          }
        }
      } catch {}
    }

    // 4. If specific gid is in URL or no tabs were parsed, try gid / default sheet
    if (allExtractedRows.length === 0) {
      const fallbackUrls: string[] = [];
      if (gid) {
        fallbackUrls.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&_t=${cacheBuster}`);
        fallbackUrls.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_t=${cacheBuster}`);
      }
      fallbackUrls.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&_t=${cacheBuster}`);
      fallbackUrls.push(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&_t=${cacheBuster}`);

      for (const url of fallbackUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          lastStatus = res.status;
          if (res.ok) {
            const text = await res.text();
            if (text && !text.trim().startsWith('<!DOCTYPE') && !text.includes('<html')) {
              const parsedRows = parseCsvTextToRows(text, 'DefaultSheet');
              if (parsedRows.length > 0) {
                allExtractedRows.push(...parsedRows);
                successfulFetches++;
                break;
              }
            }
          }
        } catch {
          // Continue
        }
      }
    }

    if (successfulFetches === 0 && allExtractedRows.length === 0) {
      console.warn(`[GoogleSheetSync] Notice: Google Sheet tidak dapat diakses (${lastStatus ? `HTTP ${lastStatus}` : 'Koneksi dibatasi'}).`);
      return {
        success: false,
        data: [],
        message: `Spreadsheet belum dapat diakses (${lastStatus ? `HTTP ${lastStatus}` : 'Izin terbatas'}). Pastikan tautan disetel ke "Siapa saja yang memiliki link" (Viewer/Editor).`,
      };
    }

    if (allExtractedRows.length === 0) {
      return {
        success: true,
        data: [],
        message: 'Google Sheet kosong (tidak ada baris data di semua sheet).',
        totalRows: 0,
      };
    }

    // Deduplicate and parse all aggregated rows
    const parsedData = parseExtractedRowsToAssessments(allExtractedRows);

    // Save to high-speed in-memory cache
    memoryAssessmentsCache = {
      spreadsheetId,
      data: parsedData,
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: parsedData,
      totalRows: parsedData.length,
      message: `Berhasil memuat seluruh ${parsedData.length} data penilaian gedung secara cepat dari seluruh sheet Google Sheet!`,
    };
  } catch (err: any) {
    console.warn('fetchAssessmentsFromGoogleSheet notice:', err?.message || err);
    return {
      success: false,
      data: [],
      message: `Gagal membaca Google Sheet: ${err.message || 'Koneksi terputus'}`,
    };
  }
}

/**
 * Format UserAccount into row object for Google Sheet tab 'Daftar_Pengguna'
 */
export function formatUserForGoogleSheet(user: UserAccount): Record<string, any> {
  return {
    'ID Pengguna': user.id || '',
    'Nama Lengkap': user.name || '',
    'Email / Username': user.email || '',
    'Peran / Hak Akses': user.role || 'admin_user',
    'Instansi / SKPD': user.agency || '',
    'No Telepon': user.phone || '',
    'Status Akun': user.status || 'active',
    'Password Hash': user.password || '',
    'Terakhir Ubah Password': user.passwordLastChanged || '',
    'Link Folder G-Drive': user.driveFolderUrl || '',
    'Tanggal Terdaftar': user.createdAt || new Date().toISOString(),
  };
}

/**
 * Direct save a user account to Google Sheet
 */
export async function directSaveUserToGoogleSheet(
  user: UserAccount,
  config: GoogleSheetConfig,
  action: 'save_user' | 'delete_user' = 'save_user'
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return { success: false, message: 'Link Webhook Google Sheet belum dikonfigurasi.' };
  }

  const payload = {
    action,
    userSheetName: 'Daftar_Pengguna',
    userId: user.id,
    email: user.email,
    data: formatUserForGoogleSheet(user),
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl) || undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: `Akun "${user.name}" (${user.email}) tersimpan langsung di Google Sheet (Tab: Daftar_Pengguna)!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menyimpan user ke Google Sheet: ${err?.message || 'Koneksi gagal'}`,
    };
  }
}

/**
 * Sync all users to Google Sheet
 */
export async function syncAllUsersToGoogleSheet(
  users: UserAccount[],
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; count: number }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return { success: false, message: 'Link Webhook Google Sheet belum dikonfigurasi.', count: 0 };
  }

  const formattedUsers = users.map(formatUserForGoogleSheet);
  const payload = {
    action: 'sync_users',
    userSheetName: 'Daftar_Pengguna',
    data: formattedUsers,
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl) || undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(config.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: `Berhasil menyinkronkan seluruh ${users.length} akun pengguna ke Google Sheet (Tab: Daftar_Pengguna)!`,
      count: users.length,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menyinkronkan daftar pengguna ke Google Sheet: ${err?.message || 'Koneksi gagal'}`,
      count: 0,
    };
  }
}

/**
 * Fetch all registered users from Google Sheet
 */
export async function fetchUsersFromGoogleSheet(
  config: GoogleSheetConfig
): Promise<{ success: boolean; users: UserAccount[]; message: string }> {
  if (!config.webhookUrl && !config.spreadsheetUrl) {
    return { success: false, users: [], message: 'Integrasi Google Sheet belum dikonfigurasi.' };
  }

  // Method 1: Webhook POST or GET for JSON users
  if (config.webhookUrl && config.webhookUrl.startsWith('http')) {
    try {
      const getUrl = `${config.webhookUrl}${config.webhookUrl.includes('?') ? '&' : '?'}action=fetch_users&_t=${Date.now()}`;
      const res = await fetch(getUrl, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.users)) {
          const parsedUsers: UserAccount[] = json.users.map((r: any) => {
            const getVal = (keys: string[]) => {
              for (const k of keys) {
                if (r[k] !== undefined && r[k] !== null) return String(r[k]).trim();
              }
              return '';
            };
            const id = getVal(['ID Pengguna', 'id']) || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const name = getVal(['Nama Lengkap', 'Nama', 'name']) || 'Pengguna';
            const email = getVal(['Email / Username', 'Email', 'email']) || '';
            const role = (getVal(['Peran / Hak Akses', 'Peran', 'role']) as any) || 'admin_user';
            const agency = getVal(['Instansi / SKPD', 'Instansi', 'agency']) || 'Dinas PUPR';
            const phone = getVal(['No Telepon', 'Telepon', 'phone']) || '';
            const status = (getVal(['Status Akun', 'Status', 'status']) as any) || 'active';
            const password = getVal(['Password Hash', 'Password', 'password']) || '';
            const passwordLastChanged = getVal(['Terakhir Ubah Password', 'passwordLastChanged']) || new Date().toISOString();
            const driveFolderUrl = getVal(['Link Folder G-Drive', 'driveFolderUrl', 'Link G-Drive']) || undefined;
            const createdAt = getVal(['Tanggal Terdaftar', 'createdAt']) || new Date().toISOString();

            return { id, name, email, role, agency, phone, status, password, passwordLastChanged, driveFolderUrl, createdAt };
          }).filter((u: UserAccount) => u.email || u.name);

          if (parsedUsers.length > 0) {
            return {
              success: true,
              users: parsedUsers,
              message: `Berhasil mengambil ${parsedUsers.length} data pengguna dari Google Sheet Webhook!`,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Google Sheet Webhook fetchUsers notice:', e);
    }
  }

  // Method 2: CSV Export Fallback from Spreadsheet ID
  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
  if (!spreadsheetId) {
    return { success: false, users: [], message: 'Spreadsheet ID tidak valid.' };
  }

  const csvUrls = [
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Daftar_Pengguna&_t=${Date.now()}`,
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&_t=${Date.now()}`,
  ];

  for (const url of csvUrls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<!DOCTYPE') && !text.includes('<html')) {
          const workbook = XLSX.read(text, { type: 'string', raw: true });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (Array.isArray(jsonRows) && jsonRows.length > 0) {
            const parsedUsers: UserAccount[] = jsonRows.map((r) => {
              const getVal = (keys: string[]) => {
                for (const k of keys) {
                  if (r[k] !== undefined && r[k] !== null) return String(r[k]).trim();
                }
                return '';
              };
              const id = getVal(['ID Pengguna', 'id']) || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const name = getVal(['Nama Lengkap', 'Nama', 'name']) || 'Pengguna';
              const email = getVal(['Email / Username', 'Email', 'email']) || '';
              const role = (getVal(['Peran / Hak Akses', 'Peran', 'role']) as any) || 'admin_user';
              const agency = getVal(['Instansi / SKPD', 'Instansi', 'agency']) || 'Dinas PUPR';
              const phone = getVal(['No Telepon', 'Telepon', 'phone']) || '';
              const status = (getVal(['Status Akun', 'Status', 'status']) as any) || 'active';
              const password = getVal(['Password Hash', 'Password', 'password']) || '';
              const passwordLastChanged = getVal(['Terakhir Ubah Password', 'passwordLastChanged']) || new Date().toISOString();
              const driveFolderUrl = getVal(['Link Folder G-Drive', 'driveFolderUrl', 'Link G-Drive']) || undefined;
              const createdAt = getVal(['Tanggal Terdaftar', 'createdAt']) || new Date().toISOString();

              return { id, name, email, role, agency, phone, status, password, passwordLastChanged, driveFolderUrl, createdAt };
            }).filter((u) => u.email || u.name);

            if (parsedUsers.length > 0) {
              return {
                success: true,
                users: parsedUsers,
                message: `Berhasil membaca ${parsedUsers.length} data akun pengguna dari Google Sheet CSV!`,
              };
            }
          }
        }
      }
    } catch {}
  }

  return { success: false, users: [], message: 'Gagal membaca daftar pengguna dari Google Sheet.' };
}

