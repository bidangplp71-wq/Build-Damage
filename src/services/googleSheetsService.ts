import { BuildingAssessment, GoogleSheetConfig } from '../types';
import { formatRupiah } from '../utils/puprCalculations';

export interface GoogleSheetRowPayload {
  action: 'insert' | 'update' | 'delete' | 'sync_all' | 'ping';
  sheetName: string;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  registrationCode?: string;
  data: Record<string, any> | Record<string, any>[];
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
 * Formats assessment data into tabular row columns for Google Sheets
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
    'Surveyor / Petugas': item.createdByName,
    'Kota Laporan': item.cityLocation,
    'Jumlah Tim Analisis': item.analysisTeam.length,
    'Terakhir Diperbarui': new Date(item.updatedAt).toLocaleString('id-ID'),
  };
}

/**
 * Directly save assessment data to Google Sheet via Webhook endpoint
 */
export async function directSaveToGoogleSheet(
  assessment: BuildingAssessment,
  config: GoogleSheetConfig,
  action: 'insert' | 'update' | 'delete' = 'insert'
): Promise<{ success: boolean; message: string }> {
  if (!config.webhookUrl || !config.webhookUrl.startsWith('http')) {
    return {
      success: false,
      message: 'Link / URL Webhook Google Sheet belum dikonfigurasi.',
    };
  }

  const rowData = formatAssessmentForGoogleSheet(assessment);
  const spreadsheetId = extractSpreadsheetId(config.spreadsheetUrl);

  const payload: GoogleSheetRowPayload = {
    action,
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    spreadsheetUrl: config.spreadsheetUrl,
    spreadsheetId: spreadsheetId || undefined,
    registrationCode: assessment.code,
    data: rowData,
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

    return {
      success: true,
      message: `Data gedung "${assessment.buildingName}" langsung tersimpan di Google Sheet!`,
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
 * Backward compatibility alias for direct saving
 */
export const syncToGoogleSheetWebhook = directSaveToGoogleSheet;

/**
 * Sync multiple assessments to Google Sheet
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
  const payload: GoogleSheetRowPayload = {
    action: 'sync_all',
    sheetName: config.sheetName || 'Data_Kerusakan_PUPR',
    data: rows,
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

    return {
      success: true,
      message: `Berhasil sinkronisasi ${assessments.length} data penilaian ke Google Sheet!`,
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
 * Generates ready-to-use Google Apps Script code for the user to paste in Google Sheet
 */
export function getGoogleAppsScriptTemplate(): string {
  return `/**
 * GOOGLE APPS SCRIPT PENYIMPANAN LANGSUNG GEDUNG PUPR
 * Cara Pasang:
 * 1. Buka file Google Sheet Anda
 * 2. Klik menu 'Ekstensi' > 'Apps Script'
 * 3. Hapus seluruh kode bawaan, lalu paste kode ini
 * 4. Klik tombol 'Terapkan' (Deploy) > 'Deployment baru' (New Deployment)
 * 5. Pilih jenis: 'Aplikasi Web' (Web App)
 * 6. Setel 'Akses' (Who has access): 'Siapa saja' (Anyone)
 * 7. Salin URL Aplikasi Web yang diberikan, lalu paste ke SIM-PKBG PUPR
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var json = JSON.parse(rawData);
    var sheetName = json.sheetName || "Data_Kerusakan_PUPR";
    
    // Buka spreadsheet aktif atau melalui ID spreadsheet yang ditentukan
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
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    var rowsToProcess = [];
    if (Array.isArray(json.data)) {
      rowsToProcess = json.data;
    } else if (json.data) {
      rowsToProcess = [json.data];
    }
    
    if (rowsToProcess.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = Object.keys(rowsToProcess[0]);
    
    // Inisialisasi Header bila sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }
    
    var action = json.action || 'insert';
    var regCode = json.registrationCode;
    
    // Jika aksi adalah update dan kode registrasi ditemukan, update baris terkait
    if (action === 'update' && regCode && sheet.getLastRow() > 1) {
      var allData = sheet.getDataRange().getValues();
      var foundRowIndex = -1;
      for (var r = 1; r < allData.length; r++) {
        if (allData[r][0] == regCode) {
          foundRowIndex = r + 1; // 1-indexed
          break;
        }
      }
      
      if (foundRowIndex > 0) {
        var updateRow = [];
        for (var h = 0; h < headers.length; h++) {
          updateRow.push(rowsToProcess[0][headers[h]] !== undefined ? rowsToProcess[0][headers[h]] : "");
        }
        sheet.getRange(foundRowIndex, 1, 1, headers.length).setValues([updateRow]);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Data baris " + regCode + " berhasil diperbarui langsung di Google Sheet",
          action: "update"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Default: Tambah baris baru secara langsung (insert)
    for (var i = 0; i < rowsToProcess.length; i++) {
      var row = [];
      for (var h = 0; h < headers.length; h++) {
        row.push(rowsToProcess[i][headers[h]] !== undefined ? rowsToProcess[i][headers[h]] : "");
      }
      sheet.appendRow(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Data langsung tersimpan di Google Sheet!",
      insertedCount: rowsToProcess.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    app: "SIM-PKBG Penilaian Kerusakan Gedung PUPR",
    description: "Endpoint Penyimpanan Langsung Google Sheet Aktif",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
}

/**
 * Export assessments to CSV file for Google Sheets / Excel import
 */
export function exportAssessmentsToCSV(assessments: BuildingAssessment[]): void {
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
  link.setAttribute(
    'download',
    `Penilaian_Kerusakan_Gedung_PUPR_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
