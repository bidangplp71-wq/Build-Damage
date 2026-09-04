import * as XLSX from 'xlsx';
import { BuildingAssessment, GoogleSheetConfig, Kecamatan, UserActivityLog } from '../types';
import { formatRupiah } from '../utils/puprCalculations';

export interface GoogleSheetRowPayload {
  action: 'insert' | 'update' | 'delete' | 'sync_all' | 'ping' | 'sync_activity_logs' | 'log_user_access' | 'test_drive';
  sheetName: string;
  logSheetName?: string;
  kecamatanSheetName?: string;
  splitByKecamatan?: boolean;
  includeMasterSummary?: boolean;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  registrationCode?: string;
  data: Record<string, any> | Record<string, any>[];
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
  return str.replace(/^https?:\/\/[^\/]+\//, '').split('?')[0].replace(/^folders\//, '').replace(/\/+$/, '').trim();
}

/**
 * Returns full Google Drive folder URL from a folder ID or URL
 */
export function getDriveFolderUrl(idOrUrl?: string): string {
  if (!idOrUrl) return '';
  const id = extractDriveFolderId(idOrUrl);
  return id ? `https://drive.google.com/drive/folders/${id}` : '';
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
  return {
    'No Registrasi': item.code,
    'Nama Bangunan': item.buildingName,
    'Kategori / Fungsi Bangunan': item.buildingCategory || 'Gedung Pemerintah',
    'Jenis Bencana': item.disasterType,
    'Tanggal Bencana': item.disasterDate,
    'Tanggal Penilaian': item.assessmentDate,
    'Pengguna / Pemilik': item.ownerAgency,
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
    'Status Verifikasi': item.verificationStatus,
    'Diverifikasi Oleh': item.verifiedBy || '-',
    'Tanggal Verifikasi': item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString('id-ID') : '-',
    'Catatan Verifikator': item.verificationNotes || '-',
    'Jumlah Foto Kerusakan': item.photos ? item.photos.length : 0,
    'Link Folder Foto Google Drive': item.googleDriveFolderUrl || (item.photos && item.photos.length > 0 ? '(Tersimpan di Google Drive)' : '-'),
    'Surveyor / Petugas': item.createdByName,
    'Kota Laporan': item.cityLocation,
    'Jumlah Tim Analisis': item.analysisTeam ? item.analysisTeam.length : 0,
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
  action: 'insert' | 'update' | 'delete' = 'insert'
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

  const rowData = formatAssessmentForGoogleSheet(assessment);
  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);
  const kecSheetName = sanitizeSheetName(`Kec. ${assessment.kecamatanName || 'Lainnya'}`);
  const cleanFolderId = extractDriveFolderId(config.driveFolderId);

  const payload: GoogleSheetRowPayload = {
    action,
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    kecamatanSheetName: kecSheetName,
    splitByKecamatan: config.splitByKecamatan !== false,
    includeMasterSummary: config.includeMasterSummarySheet !== false,
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: spreadsheetId || undefined,
    registrationCode: assessment.code,
    data: rowData,
    photos: assessment.photos ? assessment.photos.map((p, idx) => ({
      id: p.id || `photo_${idx}`,
      caption: p.caption || '',
      damageLocation: p.damageLocation || `Foto ${idx + 1}`,
      url: p.url,
      dataBase64: p.url && p.url.startsWith('data:') ? p.url : undefined,
    })) : [],
    savePhotosToDrive: config.savePhotosToDrive !== false,
    driveFolderId: cleanFolderId || undefined,
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

    const destination = config.splitByKecamatan !== false 
      ? `tab "${kecSheetName}" & Master Sheet` 
      : `tab "${config.sheetName || 'Data_Kerusakan_PUPR'}"`;

    const folderUrl = cleanFolderId ? `https://drive.google.com/drive/folders/${cleanFolderId}` : undefined;

    return {
      success: true,
      message: `Data gedung "${assessment.buildingName}" langsung tersimpan di Google Sheet (${destination}) & foto dikirim ke Google Drive!`,
      folderUrl,
    };
  } catch (err: any) {
    console.error('Error saving directly to Google Sheet:', err);
    return {
      success: false,
      message: `Gagal menyimpan langsung ke Google Sheet: ${err.message || 'Koneksi terputus'}`,
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
    driveFolderId: cleanFolderId || undefined,
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
    var masterSheetName = json.sheetName || "REKAP_SEMUA_KECAMATAN";
    
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

    // ACTION 3: INSERT / UPDATE SINGLE ROW (LANGSUNG DARI FORMULIR SURVEI)
    var rowData = json.data;
    if (!rowData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Data baris kosong" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var regCode = json.registrationCode || (rowData['No Registrasi'] || "");
    var kecamatanName = rowData['Kecamatan'] || "Lainnya";
    var kecTabName = json.kecamatanSheetName || ("Kec. " + kecamatanName);

    // SIMPAN DOKUMENTASI FOTO KE GOOGLE DRIVE (Folder per Bangunan)
    if (json.photos && json.photos.length > 0 && json.savePhotosToDrive !== false) {
      var driveFolderUrl = savePhotosToGoogleDrive(json.photos, regCode, rowData['Nama Bangunan'], json.driveFolderId);
      if (driveFolderUrl) {
        rowData['Link Folder Foto Google Drive'] = driveFolderUrl;
      }
    }
    
    // A. Tulis ke Sheet Khusus Kecamatan Terkait
    if (splitByKecamatan) {
      var targetKecSheet = getOrCreateSheet(ss, kecTabName);
      saveOrUpdateRow(targetKecSheet, rowData, regCode, action, "#1e3a8a");
    }
    
    // B. Tulis juga ke Master Sheet Rekap Semua
    var targetMasterSheet = getOrCreateSheet(ss, masterSheetName);
    saveOrUpdateRow(targetMasterSheet, rowData, regCode, action, "#0f172a");
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data langsung tersimpan di Tab '" + kecTabName + "', Master Sheet & Arsip Foto Google Drive!",
      registrationCode: regCode,
      targetTab: kecTabName,
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
 * Mendapatkan sheet berdasarkan nama atau membuatnya baru bila belum ada
 */
function getOrCreateSheet(ss, name) {
  var cleanName = name.replace(/[:\\\\/?*\\[\\]]/g, '').trim().substring(0, 30);
  var sheet = ss.getSheetByName(cleanName);
  if (!sheet) {
    sheet = ss.insertSheet(cleanName);
  }
  return sheet;
}

/**
 * Menyimpan, memperbarui, atau menghapus satu baris data pada sheet tertentu
 */
function saveOrUpdateRow(sheet, rowData, regCode, action, headerBgColor) {
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
  
  // Baca header yang sudah ada di sheet untuk menyelaraskan urutan kolom
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Cek apakah data dengan No Registrasi ini sudah ada (untuk update/delete)
  if (regCode && sheet.getLastRow() > 1) {
    var allData = sheet.getDataRange().getValues();
    var foundIndex = -1;
    for (var r = 1; r < allData.length; r++) {
      if (String(allData[r][0]).trim() === String(regCode).trim()) {
        foundIndex = r + 1; // 1-indexed
        break;
      }
    }
    
    if (foundIndex > 0) {
      if (action === 'delete') {
        sheet.deleteRow(foundIndex);
        return;
      } else {
        var updateValues = [];
        for (var c = 0; c < currentHeaders.length; c++) {
          var hName = currentHeaders[c];
          updateValues.push(rowData[hName] !== undefined ? rowData[hName] : "");
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
  var m1 = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return m1[1];
  var m2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  return str.replace(/^https?:\/\/[^\/]+\//, '').split('?')[0].replace(/^folders\//, '').replace(/\/+$/, '').trim();
}

/**
 * Menyimpan dokumentasi foto ke Google Drive dalam folder terstruktur per bangunan
 */
function savePhotosToGoogleDrive(photos, regCode, buildingName, parentFolderId) {
  if (!photos || photos.length === 0) return "";
  try {
    var parentFolder = null;
    var cleanId = extractDriveFolderIdFromScript(parentFolderId);
    
    if (cleanId) {
      try {
        parentFolder = DriveApp.getFolderById(cleanId);
      } catch(errFolder) {
        Logger.log("Folder kustom dengan ID '" + cleanId + "' tidak ditemukan atau belum diberi izin: " + errFolder);
      }
    }
    
    // Jika folder induk tidak ditemukan / tidak diisi, gunakan atau buat folder utama SIM-PKBG
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
    var safeBuilding = (buildingName || "Gedung").replace(/[:\\\\/?*\\[\\]]/g, "_").trim();
    var folderName = safeBuilding + (regCode ? (" - " + regCode) : "");
    var subFolders = parentFolder.getFoldersByName(folderName);
    var targetFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(folderName);
    try { targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eSub) {}
    
    for (var i = 0; i < photos.length; i++) {
      var p = photos[i];
      var base64Data = p.dataBase64 || p.url || "";
      var decoded = null;
      var contentType = "image/jpeg";
      
      if (base64Data.indexOf("data:") === 0) {
        var parts = base64Data.split(",");
        if (parts.length > 1) {
          contentType = parts[0].split(":")[1].split(";")[0] || "image/jpeg";
          decoded = Utilities.base64Decode(parts[1]);
        }
      } else if (base64Data.indexOf("http") === 0) {
        try {
          var resp = UrlFetchApp.fetch(base64Data, { muteHttpExceptions: true });
          if (resp.getResponseCode() === 200) {
            decoded = resp.getBlob().getBytes();
            contentType = resp.getBlob().getContentType() || "image/jpeg";
          }
        } catch(eFetch) {}
      } else if (base64Data.length > 50 && !/^\s*http/.test(base64Data)) {
        try {
          decoded = Utilities.base64Decode(base64Data);
        } catch(eDec) {}
      }
      
      if (decoded) {
        var safeLoc = (p.damageLocation || ("Foto_" + (i + 1))).replace(/[:\\\\/?*\\[\\]]/g, "_");
        var fileName = ("0" + (i + 1)).slice(-2) + "_" + safeLoc + ".jpg";
        var existingFiles = targetFolder.getFilesByName(fileName);
        if (existingFiles.hasNext()) {
          var file = existingFiles.next();
          file.setContent(decoded);
          try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
        } else {
          var blob = Utilities.newBlob(decoded, contentType, fileName);
          var newFile = targetFolder.createFile(blob);
          try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
        }
      }
    }
    return targetFolder.getUrl();
  } catch (err) {
    Logger.log("Error saving photos to Drive: " + err);
    return "";
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    app: "SIM-PKBG Penilaian Kerusakan Bangunan Gedung PUPR",
    features: "Multi-Sheet per Kecamatan, Master Rekap & Auto-Sync",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
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
    console.error('Error saving activity log to Google Sheet:', err);
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

