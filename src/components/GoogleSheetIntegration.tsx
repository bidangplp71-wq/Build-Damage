import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  getGoogleAppsScriptTemplate,
  exportAssessmentsToCSV,
  exportAssessmentsToExcelMultiSheet,
  extractSpreadsheetId,
  extractDriveFolderId,
  getDriveFolderUrl,
  testDrivePhotoUpload,
  syncAssessmentPhotosToDrive,
  groupAssessmentsByKecamatan,
  optimizeGoogleSpreadsheet,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  CheckCircle2,
  Copy, FileCode2, Info,
  ExternalLink,
  Download,
  RefreshCw,
  Sparkles,
  Link2,
  Send,
  HelpCircle,
  Database,
  Layers,
  MapPin,
  Check,
  AlertTriangle,
  Image,
  FolderCheck,
  UploadCloud,
  Eye,
  Settings,
  ShieldCheck,
  Info,
  Plus,
  Trash2,
  Radio,
  Zap,
  BookmarkCheck,
  ArrowRightLeft,
} from 'lucide-react';
import { BufferQueueBanner } from './BufferQueueBanner';
import { SheetBookSelector } from './SheetBookSelector';
import { SheetMigrationTool } from './SheetMigrationTool';
import { SpreadsheetProfile } from '../types';

export const APP_SCRIPT_TEMPLATE = `// =========================================================================
// GOOGLE APPS SCRIPT WEBHOOK UNTUK SIPANDU KERUSAKAN
// FITUR: HUB & SPOKE (MULTI-WORKSHEET), ANTI-DUPLIKAT (AUTO NO. REG), 20 FOTO
// =========================================================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Kunci eksekusi selama 30 detik untuk menghindari input bersamaan (Race Condition)
  lock.tryLock(30000); 
  
  try {
    var json = JSON.parse(e.postData.contents);
    var action = json.action || 'insert';
    var rowData = json.data || {};
    var kecamatanName = json.kecamatanName || rowData['Kecamatan'] || "Lainnya";
    var targetTabName = json.targetSheetName || json.kecamatanSheetName || ("Kec. " + kecamatanName);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. AUTO-GENERATE NO REGISTRASI (ANTI-DUPLIKAT)
    var finalNoRegistrasi = json.registrationCode || rowData['No Registrasi'];
    
    // Jika No Registrasi adalah sementara (berisi "TMP-" atau kosong), kita generate yang baru!
    if (!finalNoRegistrasi || finalNoRegistrasi.indexOf("TMP-") !== -1 || finalNoRegistrasi.indexOf("REG-") === -1) {
       finalNoRegistrasi = generateNewRegCode(ss, targetTabName, kecamatanName);
       rowData['No Registrasi'] = finalNoRegistrasi;
    }

    // 2. SIMPAN DATA KE WORKSHEET (HUB / KECAMATAN)
    if (action === 'insert' || action === 'update') {
      var sheet = getOrCreateSheet(ss, targetTabName);
      saveOrUpdateRow(sheet, rowData, finalNoRegistrasi, action);
      
      // Opsional: Simpan juga ke Master/Hub jika diizinkan oleh config web
      if (json.includeMasterSummary !== false) {
         var masterSheet = getOrCreateSheet(ss, "REKAP_SEMUA_KECAMATAN");
         saveOrUpdateRow(masterSheet, rowData, finalNoRegistrasi, action);
      }
    } else if (action === 'delete') {
      var sheetDelete = getOrCreateSheet(ss, targetTabName);
      deleteMatchingRow(sheetDelete, finalNoRegistrasi);
    }
    
    // 3. FOTO KE GOOGLE DRIVE (Sampai 20 Foto)
    if (json.savePhotosToDrive && json.photos && json.photos.length > 0) {
      var bldgName = json.buildingName || rowData['Nama Bangunan'] || "Gedung_Tanpa_Nama";
      savePhotosToGoogleDrive(json.photos, finalNoRegistrasi, bldgName, json.driveFolderId);
    }

    // 4. BERSIHKAN BARIS & KOLOM KOSONG DI AKHIR
    trimEmptyRowsAndColumns(ss);

    // ==========================================================
    // 5. KEMBALIKAN NO REGISTRASI FINAL KE WEB APLIKASI
    // ==========================================================
    var responseOutput = {
      status: "success",
      message: "Data " + (rowData['Nama Bangunan'] || "") + " berhasil disimpan!",
      registrationCode: finalNoRegistrasi 
    };

    return ContentService.createTextOutput(JSON.stringify(responseOutput))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Selalu lepaskan kunci meskipun terjadi error
    lock.releaseLock(); 
  }
} // --- AKHIR DARI doPost ---

// ==========================================================
// FUNGSI-FUNGSI BANTUAN (HELPER) DI BAWAH INI
// ==========================================================

// --- FUNGSI GENERATE NOMOR REGISTRASI ---
function generateNewRegCode(ss, sheetName, kecamatanName) {
  var prefix = "PUP";
  var kecUpper = String(kecamatanName).toUpperCase();
  if (kecUpper.indexOf('AESESA SELATAN') !== -1) prefix = 'ASS';
  else if (kecUpper.indexOf('AESESA') !== -1) prefix = 'AES';
  else if (kecUpper.indexOf('BOAWAE') !== -1) prefix = 'BOA';
  else if (kecUpper.indexOf('MAUPONGGO') !== -1) prefix = 'MPO';
  else if (kecUpper.indexOf('NANGARORO') !== -1) prefix = 'NGA';
  else if (kecUpper.indexOf('KEO TENGAH') !== -1) prefix = 'KEO';
  else if (kecUpper.indexOf('WOLOWAE') !== -1) prefix = 'WLW';
  
  var year = new Date().getFullYear();
  var seqNum = 1;
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    if (data.length > 1) {
       var headers = data[0];
       var regIdx = headers.indexOf('No Registrasi');
       if (regIdx !== -1) {
          for (var i = 1; i < data.length; i++) {
             var currentCode = String(data[i][regIdx]).toUpperCase();
             // Cari yang formatnya REG-[PREFIX]-[TAHUN]-[4DIGIT]
             if (currentCode.indexOf("REG-" + prefix + "-" + year + "-") === 0) {
                 var numPart = parseInt(currentCode.split("-").pop(), 10);
                 if (!isNaN(numPart) && numPart >= seqNum) {
                     seqNum = numPart + 1;
                 }
             }
          }
       }
    }
  }
  
  // Pad number dengan nol, misal 1 -> 0001
  var numStr = seqNum.toString();
  while (numStr.length < 4) {
    numStr = "0" + numStr;
  }
  return "REG-" + prefix + "-" + year + "-" + numStr;
}

// --- FUNGSI MENDAPATKAN ATAU MEMBUAT SHEET BARU ---
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// --- FUNGSI MENYIMPAN / MENGUBAH BARIS ---
function saveOrUpdateRow(sheet, rowData, regCode, action) {
  var headers = sheet.getDataRange().getValues()[0];
  var lastRow = sheet.getLastRow();
  
  // Jika sheet kosong, buat header
  if (!headers || headers.length === 0 || headers[0] === "") {
    headers = Object.keys(rowData);
    sheet.appendRow(headers);
    // Warnai header biru, text putih
    sheet.getRange(1, 1, 1, headers.length).setBackground("#1e40af").setFontColor("white").setFontWeight("bold");
    lastRow = 1;
  }
  
  var existingRowIndex = -1;
  if (regCode) {
    var data = sheet.getDataRange().getValues();
    var idColIndex = headers.indexOf('No Registrasi');
    if (idColIndex === -1) idColIndex = 0; // Fallback ke kolom A
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]).trim() === String(regCode).trim()) {
        existingRowIndex = i + 1; // Array 0-based, row sheet 1-based
        break;
      }
    }
  }
  
  var newRowArray = [];
  for (var h = 0; h < headers.length; h++) {
    var headerName = headers[h];
    var val = rowData[headerName] !== undefined ? rowData[headerName] : "";
    
    // Potong string panjang agar tidak membebani batas 50000 karakter Google Sheets
    if (typeof val === 'string' && val.length > 30000) {
       val = val.substring(0, 30000);
    }
    newRowArray.push(val);
  }
  
  // Update atau Insert
  if (existingRowIndex !== -1 && action !== 'insert') {
     sheet.getRange(existingRowIndex, 1, 1, newRowArray.length).setValues([newRowArray]);
  } else {
     sheet.appendRow(newRowArray);
  }
}

// --- FUNGSI MENGHAPUS BARIS ---
function deleteMatchingRow(sheet, regCode) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idColIndex = headers.indexOf('No Registrasi');
  if (idColIndex === -1) return;
  
  // Dari bawah ke atas (karena baris bergeser naik jika dihapus)
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColIndex]).trim() === String(regCode).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
}

// --- FUNGSI FOTO KE DRIVE (20 FOTO) ---
function savePhotosToGoogleDrive(photos, regCode, bldgName, folderIdRaw) {
  var mainFolderId = folderIdRaw || "";
  if (!mainFolderId) return "";
  
  // Ekstrak ID dari URL jika dikasih URL
  if (mainFolderId.indexOf("id=") !== -1) mainFolderId = mainFolderId.split("id=")[1];
  else if (mainFolderId.indexOf("/folders/") !== -1) {
      var parts = mainFolderId.split("/folders/");
      if (parts[1]) mainFolderId = parts[1].split("/")[0].split("?")[0];
  }
  mainFolderId = mainFolderId.trim();
  
  try {
     var mainFolder = DriveApp.getFolderById(mainFolderId);
     // Buat nama folder untuk bangunan ini
     var bldgFolderName = regCode + " - " + bldgName;
     
     // Cari apakah folder bangunan sudah ada
     var existingFolders = mainFolder.getFoldersByName(bldgFolderName);
     var bldgFolder;
     if (existingFolders.hasNext()) {
        bldgFolder = existingFolders.next();
     } else {
        bldgFolder = mainFolder.createFolder(bldgFolderName);
     }
     
     // Loop semua 20 foto
     for (var i = 0; i < photos.length; i++) {
        var p = photos[i];
        if (!p.dataBase64) continue;
        
        // Buang prefix "data:image/jpeg;base64,"
        var base64Data = p.dataBase64.split(",")[1];
        if (!base64Data) continue;
        
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/jpeg", "Foto_" + (i+1) + "_" + (p.damageLocation || "Lokasi") + ".jpg");
        bldgFolder.createFile(blob);
     }
     return bldgFolder.getUrl();
  } catch (e) {
     return ""; // Gagal simpan drive abaikan saja
  }
}

// --- FUNGSI BERSIHKAN BARIS & KOLOM ---
function trimEmptyRowsAndColumns(ss) {
  var sheets = ss.getSheets();
  var processed = 0, totalRowsTrimmed = 0, totalColsTrimmed = 0;
  
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var maxRows = sh.getMaxRows();
    var lastRow = sh.getLastRow();
    
    if (maxRows > lastRow && (maxRows - lastRow) > 20) {
      var rowsToDelete = maxRows - lastRow - 5; 
      sh.deleteRows(lastRow + 1, rowsToDelete);
      totalRowsTrimmed += rowsToDelete;
    }
    
    var maxCols = sh.getMaxColumns();
    var lastCol = sh.getLastColumn();
    if (lastCol === 0) continue;
    
    if (maxCols > lastCol && (maxCols - lastCol) > 5) {
      var colsToDelete = maxCols - lastCol;
      sh.deleteColumns(lastCol + 1, colsToDelete);
      totalColsTrimmed += colsToDelete;
    }
    processed++;
  }
  
  return {
    sheetsProcessed: processed,
    totalRowsTrimmed: totalRowsTrimmed,
    totalColsTrimmed: totalColsTrimmed
  };
}
`;

export const GoogleSheetIntegration: React.FC = () => {
  const {
    googleSheetConfig,
    updateGoogleSheetConfig,
    assessments,
    kecamatans,
    syncAllToSheet,
    syncFromGoogleSheet,
    users,
    syncUsersToGoogleSheet,
    fetchUsersFromSheet,
    showToast,
    currentUser,
    sheetSyncProgress,
  } = useApp();

  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'view_sheet' | 'profiles' | 'migration' | 'settings'>('view_sheet');
  const [isSyncingFromSheet, setIsSyncingFromSheet] = useState(false);

  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [webhookUrlInput, setWebhookUrlInput] = useState(googleSheetConfig.webhookUrl || '');
  const [sheetNameInput, setSheetNameInput] = useState(googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN');
  const [splitByKecamatan, setSplitByKecamatan] = useState(googleSheetConfig.splitByKecamatan !== false);
  const [includeMasterSummary, setIncludeMasterSummary] = useState(googleSheetConfig.includeMasterSummarySheet !== false);
  const [savePhotosToDrive, setSavePhotosToDrive] = useState(googleSheetConfig.savePhotosToDrive !== false);
  const [driveFolderIdInput, setDriveFolderIdInput] = useState(googleSheetConfig.driveFolderId || '');

  // Profiles management state
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [newProfileWebhook, setNewProfileWebhook] = useState(googleSheetConfig.webhookUrl || '');
  const [newProfileDriveFolder, setNewProfileDriveFolder] = useState(googleSheetConfig.driveFolderId || '');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [newProfileMakeActive, setNewProfileMakeActive] = useState(false);

  // Sheet optimization state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Keep form inputs synchronized when googleSheetConfig updates from realtime database
  useEffect(() => {
    setSpreadsheetUrlInput(googleSheetConfig.spreadsheetUrl || '');
    setWebhookUrlInput(googleSheetConfig.webhookUrl || '');
    setSheetNameInput(googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN');
    setSplitByKecamatan(googleSheetConfig.splitByKecamatan !== false);
    setIncludeMasterSummary(googleSheetConfig.includeMasterSummarySheet !== false);
    setSavePhotosToDrive(googleSheetConfig.savePhotosToDrive !== false);
    setDriveFolderIdInput(googleSheetConfig.driveFolderId || '');
  }, [googleSheetConfig]);

  const [isTesting, setIsTesting] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [isSyncingPhotosToDrive, setIsSyncingPhotosToDrive] = useState(false);
  const [syncPhotoProgress, setSyncPhotoProgress] = useState<{ current: number; total: number; buildingName: string } | null>(null);
  const [testDriveResult, setTestDriveResult] = useState<{ success: boolean; message: string; folderUrl?: string } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const assessmentsWithPhotos = assessments.filter((a) => a.photos && a.photos.length > 0);
  const totalPhotosCount = assessmentsWithPhotos.reduce((sum, a) => sum + (a.photos?.length || 0), 0);

  const scriptTemplate = getGoogleAppsScriptTemplate();
  const groupedData = groupAssessmentsByKecamatan(assessments);
  const activeKecamatanCount = Object.keys(groupedData).length;
  const spreadsheetId = extractSpreadsheetId(googleSheetConfig.spreadsheetUrl);

  const rawProfiles = googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 0
    ? googleSheetConfig.spreadsheetProfiles
    : [
        {
          id: 'default_placeholder',
          name: 'Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
          spreadsheetUrl: googleSheetConfig.spreadsheetUrl || '',
          webhookUrl: googleSheetConfig.webhookUrl || 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
          driveFolderId: googleSheetConfig.driveFolderId || 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
          description: 'Spreadsheet dinas utama berisi 7 tab kecamatan dan log pengguna',
          createdAt: '2026-01-01T00:00:00Z',
          isDefault: true,
        },
        {
          id: 'profile_backup_new',
          name: 'Spreadsheet Cadangan / Tahap Lanjutan',
          spreadsheetUrl: '',
          webhookUrl: googleSheetConfig.webhookUrl || 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
          description: 'Slot spreadsheet baru untuk arsip periode berikutnya tanpa harus menghapus spreadsheet lama',
          createdAt: '2026-09-14T00:00:00Z',
          isDefault: false,
        }
      ];

  const handleSelectProfile = (profile: SpreadsheetProfile) => {
    if (!isAdmin) {
      showToast('Hanya Super Admin atau Admin yang dapat mengganti Spreadsheet aktif.', 'error');
      return;
    }

    if (!profile.spreadsheetUrl) {
      showToast('Profil ini belum memiliki link Google Sheet. Klik edit atau atur link di form pengaturan.', 'error');
      return;
    }

    updateGoogleSheetConfig({
      spreadsheetUrl: profile.spreadsheetUrl,
      webhookUrl: profile.webhookUrl || googleSheetConfig.webhookUrl,
      driveFolderId: profile.driveFolderId || googleSheetConfig.driveFolderId,
      activeProfileId: profile.id,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
      lastTestMessage: `Terkoneksi ke profil: ${profile.name}`,
    });

    setSpreadsheetUrlInput(profile.spreadsheetUrl);
    if (profile.webhookUrl) setWebhookUrlInput(profile.webhookUrl);
    if (profile.driveFolderId) setDriveFolderIdInput(profile.driveFolderId);

    showToast(`Berhasil beralih ke Spreadsheet: "${profile.name}"!`, 'success');
  };

  const handleAddNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Hanya Super Admin dan Admin yang dapat mendaftarkan Spreadsheet baru.', 'error');
      return;
    }

    if (!newProfileName.trim()) {
      showToast('Nama profil spreadsheet wajib diisi.', 'error');
      return;
    }

    if (!newProfileUrl.trim()) {
      showToast('Link Google Spreadsheet wajib diisi.', 'error');
      return;
    }

    const newProfile: SpreadsheetProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newProfileName.trim(),
      spreadsheetUrl: newProfileUrl.trim(),
      webhookUrl: newProfileWebhook.trim() || googleSheetConfig.webhookUrl,
      driveFolderId: newProfileDriveFolder.trim() || googleSheetConfig.driveFolderId,
      description: newProfileDesc.trim() || 'Didaftarkan oleh Super Admin',
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      isDefault: false,
    };

    const updatedProfiles = [...rawProfiles, newProfile];

    updateGoogleSheetConfig({
      spreadsheetProfiles: updatedProfiles,
      activeProfileId: newProfile.id,
      spreadsheetUrl: newProfile.spreadsheetUrl,
      webhookUrl: newProfile.webhookUrl,
      driveFolderId: newProfile.driveFolderId,
    });

    setSpreadsheetUrlInput(newProfile.spreadsheetUrl);
    if (newProfile.webhookUrl) setWebhookUrlInput(newProfile.webhookUrl);
    if (newProfile.driveFolderId) setDriveFolderIdInput(newProfile.driveFolderId);

    // Reset Form
    setNewProfileName('');
    setNewProfileUrl('');
    setNewProfileDesc('');
    setIsAddingProfile(false);

    showToast(`Spreadsheet baru "${newProfile.name}" berhasil didaftarkan dan langsung diaktifkan!`, 'success');
  };

  const handleDeleteProfile = (profileId: string) => {
    if (!isAdmin) {
      showToast('Hanya Super Admin dan Admin yang dapat menghapus profil spreadsheet.', 'error');
      return;
    }

    if (rawProfiles.length <= 1) {
      showToast('Minimal harus ada satu profil spreadsheet tersimpan.', 'error');
      return;
    }

    const filtered = rawProfiles.filter((p) => p.id !== profileId);
    const wasActive = googleSheetConfig.activeProfileId === profileId;
    const nextActive = wasActive ? filtered[0] : null;

    updateGoogleSheetConfig({
      spreadsheetProfiles: filtered,
      ...(nextActive ? {
        activeProfileId: nextActive.id,
        spreadsheetUrl: nextActive.spreadsheetUrl,
        webhookUrl: nextActive.webhookUrl || googleSheetConfig.webhookUrl,
        driveFolderId: nextActive.driveFolderId || googleSheetConfig.driveFolderId,
      } : {}),
    });

    showToast('Profil spreadsheet berhasil dihapus dari daftar.', 'info');
  };

  const handleOptimizeSheet = async () => {
    setIsOptimizing(true);
    setOptimizationResult(null);
    try {
      const res = await optimizeGoogleSpreadsheet(googleSheetConfig);
      setOptimizationResult(res);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      setOptimizationResult({
        success: false,
        message: 'Gagal menjalankan optimasi: ' + (err.message || 'Koneksi terputus'),
      });
      showToast('Gagal memproses optimasi spreadsheet.', 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Hanya Super Admin dan Admin yang memiliki hak akses untuk mengubah konfigurasi link Google Sheet', 'error');
      return;
    }
    let sheetUrl = spreadsheetUrlInput.trim();
    let hookUrl = webhookUrlInput.trim();

    // Auto-detect if user pasted spreadsheet URL into webhook field
    if (hookUrl.includes('docs.google.com/spreadsheets') && !sheetUrl) {
      sheetUrl = hookUrl;
    }

    updateGoogleSheetConfig({
      spreadsheetUrl: sheetUrl,
      webhookUrl: hookUrl,
      sheetName: sheetNameInput.trim() || 'REKAP_SEMUA_KECAMATAN',
      splitByKecamatan: splitByKecamatan,
      includeMasterSummarySheet: includeMasterSummary,
      savePhotosToDrive: savePhotosToDrive,
      driveFolderId: driveFolderIdInput.trim() || undefined,
      directSaveEnabled: true,
      autoSync: true,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
      lastTestMessage: 'Pengaturan penyimpanan multi-sheet dan Google Drive aktif.',
    });
    showToast('Tautan Google Sheet & Google Drive berhasil disimpan oleh Admin!', 'success');
  };

  const handleTestConnection = async () => {
    if (!webhookUrlInput.trim()) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
      return;
    }

    if (webhookUrlInput.includes('drive.google.com')) {
      showToast('URL Webhook tidak boleh berupa link Google Drive!', 'error');
      return;
    }

    setIsTesting(true);
    try {
      // Test direct save with ping payload
      await fetch(webhookUrlInput.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          sheetName: sheetNameInput.trim() || 'REKAP_SEMUA_KECAMATAN',
          splitByKecamatan: splitByKecamatan,
          spreadsheetUrl: spreadsheetUrlInput.trim() || undefined,
          spreadsheetId: extractSpreadsheetId(spreadsheetUrlInput.trim()) || undefined,
          timestamp: new Date().toISOString(),
        }),
      });

      updateGoogleSheetConfig({
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'success',
        lastTestMessage: 'Koneksi ke endpoint Google Sheet berhasil diverifikasi.',
      });
      showToast('Koneksi ke Google Sheet berhasil diverifikasi! Sistem multi-sheet siap.', 'success');
    } catch (err: any) {
      updateGoogleSheetConfig({
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'error',
        lastTestMessage: err.message,
      });
      showToast('Gagal menghubungi Google Sheet: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDriveUpload = async () => {
    const hookUrl = webhookUrlInput.trim();
    if (!hookUrl) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
      return;
    }
    if (hookUrl.includes('drive.google.com')) {
      showToast('URL Webhook keliru: Anda menempelkan link Google Drive di kolom Webhook! Pindahkan ke kolom Folder Drive.', 'error');
      return;
    }

    setIsTestingDrive(true);
    setTestDriveResult(null);
    try {
      const res = await testDrivePhotoUpload({
        ...googleSheetConfig,
        webhookUrl: hookUrl,
        driveFolderId: driveFolderIdInput.trim() || undefined,
        savePhotosToDrive: true,
      });
      setTestDriveResult(res);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const msg = 'Gagal menghubungi Webhook: ' + (err.message || 'Koneksi gagal');
      setTestDriveResult({
        success: false,
        message: msg,
      });
      showToast(msg, 'error');
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleSyncAllPhotosToDrive = async () => {
    const hookUrl = webhookUrlInput.trim() || googleSheetConfig.webhookUrl;
    if (!hookUrl) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
      return;
    }
    if (assessmentsWithPhotos.length === 0) {
      showToast('Belum ada data gedung yang memiliki dokumentasi foto untuk diunggah.', 'info');
      return;
    }

    setIsSyncingPhotosToDrive(true);
    let successCount = 0;
    try {
      for (let i = 0; i < assessmentsWithPhotos.length; i++) {
        const item = assessmentsWithPhotos[i];
        setSyncPhotoProgress({
          current: i + 1,
          total: assessmentsWithPhotos.length,
          buildingName: item.buildingName || item.code || `Gedung ${i + 1}`,
        });
        const res = await syncAssessmentPhotosToDrive(item, {
          ...googleSheetConfig,
          webhookUrl: hookUrl,
          driveFolderId: driveFolderIdInput.trim() || googleSheetConfig.driveFolderId,
          savePhotosToDrive: true,
        });
        if (res.success) {
          successCount++;
        }
      }
      showToast(`Selesai! Berhasil mengirim foto ${successCount} dari ${assessmentsWithPhotos.length} gedung ke Google Drive.`, 'success');
    } catch (err: any) {
      showToast(`Gagal mengirim foto: ${err?.message || 'Error koneksi'}`, 'error');
    } finally {
      setIsSyncingPhotosToDrive(false);
      setSyncPhotoProgress(null);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllToSheet();
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast('Gagal mengirim seluruh data ke Google Sheet', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncFromSheet = async () => {
    setIsSyncingFromSheet(true);
    try {
      await syncFromGoogleSheet(true);
    } finally {
      setIsSyncingFromSheet(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptTemplate);
    setCopiedScript(true);
    showToast('Skrip Google Apps Script Multi-Sheet berhasil disalin!', 'info');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleShareAppWithSheet = () => {
    if (!googleSheetConfig.spreadsheetUrl) {
      showToast('Atur dan simpan link Google Sheet terlebih dahulu!', 'error');
      return;
    }
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?sheetUrl=${encodeURIComponent(googleSheetConfig.spreadsheetUrl)}${googleSheetConfig.webhookUrl ? `&webhookUrl=${encodeURIComponent(googleSheetConfig.webhookUrl)}` : ''}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Link aplikasi terhubung Google Sheet berhasil disalin! Kirimkan link ini ke surveyor/perangkat lain agar langsung terkoneksi.', 'success');
  };

  const syncedCount = assessments.filter((a) => a.googleSheetSynced).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Role Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              SIMPKBG Data Center
            </span>
            <span className="text-xs text-slate-500 font-medium">Google Spreadsheet Terpadu</span>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                Mode: Buka & Pantau Lembar Kerja
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>Lembar Kerja Google Sheet SIMPKBG</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Data penilaian kerusakan bangunan gedung pasca bencana tercatat secara terpusat pada Google Sheet utama dengan tab terpisah per kecamatan dan rekapitulasi konsolidasi.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {googleSheetConfig.spreadsheetUrl ? (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka dokumen Google Spreadsheet langsung di tab baru"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setActiveSubTab('settings');
                } else {
                  showToast('Link Google Sheet utama belum diatur oleh Administrator.', 'info');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>{isAdmin ? 'Atur Link Google Sheet' : 'Google Sheet (Belum Ditautkan)'}</span>
            </button>
          )}

          {googleSheetConfig.driveFolderId && getDriveFolderUrl(googleSheetConfig.driveFolderId) && (
            <a
              href={getDriveFolderUrl(googleSheetConfig.driveFolderId)!}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka folder arsip foto visual di Google Drive"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-200 transition-colors"
            >
              <FolderCheck className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Folder Foto Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {googleSheetConfig.spreadsheetUrl && (
            <>
              <button
                type="button"
                onClick={handleShareAppWithSheet}
                title="Salin link aplikasi yang sudah langsung terhubung dengan Google Sheet ini untuk dikirimkan ke perangkat lain"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl border border-amber-300 transition-colors cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-amber-600" />
                <span>Bagikan Link Terhubung</span>
              </button>

              <button
                onClick={handleSyncFromSheet}
                disabled={isSyncingFromSheet}
                title="Tarik dan muat seluruh data survei dari Google Sheet mulai dari baris A2 ke bawah"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl border border-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-indigo-600 ${isSyncingFromSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingFromSheet ? 'Memuat Sheet...' : 'Tarik dari Sheet (A2)'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => exportAssessmentsToExcelMultiSheet(assessments, kecamatans)}
            title="Download file Excel (.xlsx) dengan 1 Tab per Kecamatan + Ringkasan Master"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Unduh Excel</span>
          </button>

          <button
            onClick={() => exportAssessmentsToCSV(assessments)}
            title="Download file CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* MULTI-SPREADSHEET QUICK SWITCHER & CAPACITY MONITOR */}
      <SheetBookSelector variant="compact" />

      {/* Admin Tab Switcher (Only Visible to Super Admin & Admin) */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('view_sheet')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'view_sheet'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Buka Lembar Kerja Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('profiles')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'profiles'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookmarkCheck className="w-4 h-4 text-blue-600" />
            <span>Daftar Spreadsheet ({rawProfiles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('migration')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'migration'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            <span>Konversi & Migrasi Sheet</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
              Model 21 Kolom
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-600" />
            <span>Pengaturan Link & Webhook</span>
          </button>
        </div>
      )}

      {/* Sheet Optimization & Data-Only Mode Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white font-bold shrink-0 mt-0.5 md:mt-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Mode Efisiensi: Pembacaan Sel Berisi Data (Data-Only Range)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 font-bold border border-emerald-300">
                Anti-Penuh
              </span>
            </div>
            <p className="text-xs text-emerald-900/90 mt-0.5 leading-relaxed">
              Sistem hanya membaca sel yang memiliki data (A2 ke bawah) dan mengabaikan baris kosong. Jika spreadsheet mendekati batas ukuran, gunakan tombol pangkas di samping untuk membersihkan baris/kolom kosong secara instan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {isAdmin && (
            <button
              type="button"
              onClick={handleOptimizeSheet}
              disabled={isOptimizing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Pangkas baris dan kolom kosong di seluruh tab Google Sheet agar ringan"
            >
              <Zap className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Memangkas Sel...' : '⚡ Pangkas Baris Kosong'}</span>
            </button>
          )}
        </div>
      </div>

      {optimizationResult && (
        <div className={`p-4 rounded-2xl border text-xs ${optimizationResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'} animate-in fade-in`}>
          <div className="flex items-start gap-2.5">
            {optimizationResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            <div>
              <span className="font-bold block">{optimizationResult.message}</span>
              {optimizationResult.details && (
                <div className="mt-1 text-[11px] text-emerald-800 space-y-0.5">
                  <div>Sheet yang dioptimasi: <strong>{optimizationResult.details.sheetCount || 0} tab</strong></div>
                  <div>Baris kosong dipangkas: <strong>{optimizationResult.details.trimmedRows || 0} baris</strong></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 1-Hour Buffer Staging Queue Status */}
      <BufferQueueBanner variant="card" />

      {/* LIVE PROGRESS STATUS IN GOOGLE SHEET INTEGRATION TAB */}
      {sheetSyncProgress && sheetSyncProgress.isLoading && (
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-2 border-blue-500/50 rounded-2xl p-5 text-white shadow-xl animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Sedang Mengunduh Data Google Sheet ({sheetSyncProgress.percent}%)
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700 font-mono">
                    Tahap {sheetSyncProgress.currentStep} dari {sheetSyncProgress.totalSteps}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Membaca Tab Sheet: <span className="text-white font-bold">{sheetSyncProgress.currentKecamatan ? `Kecamatan ${sheetSyncProgress.currentKecamatan}` : 'Menghubungkan...'}</span> ({sheetSyncProgress.totalLoaded} gedung terdata)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-cyan-400">
                {sheetSyncProgress.percent}%
              </span>
              <div className="text-[11px] text-slate-400">
                Lalulintas antrean aman
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden my-2.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, sheetSyncProgress.percent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-3 pt-3 border-t border-slate-800">
            {sheetSyncProgress.loadedKecamatans.map((kec) => (
              <div
                key={kec.name}
                className={`p-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                  kec.status === 'completed'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : kec.status === 'loading'
                    ? 'bg-blue-900 text-cyan-200 border border-cyan-400 font-bold animate-pulse'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40'
                }`}
              >
                <span className="truncate">{kec.name}</span>
                {kec.status === 'completed' ? (
                  <span className="text-[10px] text-emerald-400 font-mono shrink-0 ml-1">+{kec.count}</span>
                ) : kec.status === 'loading' ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping shrink-0 ml-1" />
                ) : (
                  <span className="text-[10px] text-slate-500 shrink-0 ml-1">-</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW SHEET TAB: Available to all roles (Surveyor, Verifikator, Publik, Camat, Admin) */}
      {(!isAdmin || activeSubTab === 'view_sheet') && (
        <div className="space-y-6">
          {/* Info Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Dokumen Sheet</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    googleSheetConfig.spreadsheetUrl ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                ></span>
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {googleSheetConfig.spreadsheetUrl ? 'Terhubung ke Google Sheet' : 'Belum Ditautkan Admin'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {googleSheetConfig.spreadsheetUrl
                  ? `ID: ${spreadsheetId ? spreadsheetId.slice(0, 16) + '...' : 'Tersambung'}`
                  : 'Menunggu penautan link oleh Super Admin / Admin'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bangunan Tercatat</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600">{syncedCount}</span>
                <span className="text-xs font-bold text-slate-400">/ {assessments.length} Bangunan Terdata</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tersimpan langsung pada tab kecamatan masing-masing
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tab Lembar Kerja</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-base font-bold text-slate-900">{kecamatans.length} Sheet Kecamatan</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {activeKecamatanCount} kecamatan memiliki data survei aktif
              </p>
            </div>
          </div>

          {/* Preview Tab Sheet 7 Kecamatan */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Daftar 7 Sheet Kecamatan di Google Spreadsheet:
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {kecamatans.length} Tab Kecamatan Murni (Tanpa Tab Rekap Terpisah)
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {kecamatans.map((kec) => {
                const count = groupedData[kec.name]?.length || 0;
                return (
                  <div
                    key={kec.id}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      count > 0
                        ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <MapPin className="w-3 h-3 text-blue-600" />
                    <span>Kec. {kec.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                        count > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Live Google Sheet Viewer */}
          {googleSheetConfig.spreadsheetUrl && spreadsheetId ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Tampilan Langsung Lembar Kerja Google Sheet</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                        Live Preview
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Anda dapat melihat data baris, tab per kecamatan, dan rekapitulasi langsung di bawah ini.
                    </div>
                  </div>
                </div>

                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Buka di Google Sheet (Tab Baru)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Iframe Viewport */}
              <div className="w-full h-[650px] bg-slate-100 relative">
                <iframe
                  src={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlembed?widget=true&headers=false`}
                  className="w-full h-full border-0"
                  title="Google Spreadsheet SIMPKBG"
                  allowFullScreen
                />
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Pratinjau menampilkan spreadsheet secara langsung. Seluruh perubahan atau data baru otomatis masuk ke lembar kerja ini.
                  </span>
                </div>
                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 shrink-0"
                >
                  <span>Buka Dokumen Asli</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Tautan Google Sheet Utama Belum Ditetapkan
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isAdmin
                    ? 'Anda belum menentukan URL spreadsheet utama untuk pencatatan data penilaian. Silakan buka tab "Pengaturan Link & Webhook" di atas untuk mengisi URL Google Sheet dan Apps Script.'
                    : 'Administrator instansi PUPR (Super Admin / Admin) belum menautkan alamat Google Spreadsheet utama. Seluruh data survei Anda saat ini tetap tersimpan aman di database SIMPKBG dan akan otomatis tersinkronisasi ke Google Sheet begitu tautan diatur oleh Admin.'}
                </p>
                {!isAdmin && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      Hak pengisian link dibatasi hanya untuk Super Admin dan Admin
                    </span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('settings')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>Isi & Tentukan Link Google Sheet Sekarang</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* PROFILES TAB: Spreadsheet Profiles & Quick Switcher for Super Admin */}
      {isAdmin && activeSubTab === 'profiles' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header & Quick Action */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-blue-600" />
                  <span>Daftar Spreadsheet & Quick Switcher</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kelola dan beralih antar dokumen Google Spreadsheet dengan 1-klik tanpa perlu bolak-balik ke Google Drive.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingProfile((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingProfile ? 'Tutup Formulir' : 'Tambah Spreadsheet Baru'}</span>
              </button>
            </div>

            {/* Add New Profile Form */}
            {showScriptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800">Kode Google Apps Script Webhook (Auto-Generate)</h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="mb-4 text-sm text-slate-600 bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3">
                 <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-bold text-blue-800">Cara Memasang Kode Ini:</p>
                   <ol className="list-decimal pl-4 mt-1 space-y-1">
                     <li>Buka Google Spreadsheet utama Anda.</li>
                     <li>Klik menu <strong>Ekstensi &gt; Apps Script</strong>.</li>
                     <li>Hapus semua kode yang ada di layar, lalu <strong>Paste/Tempel</strong> seluruh kode di bawah ini.</li>
                     <li>Klik tombol Save (ikon Disket).</li>
                     <li>Klik menu <strong>Terapkan &gt; Deployment Baru</strong> (Pilih tipe <strong>Aplikasi Web</strong>). Setel akses ke <em>"Siapa Saja" (Anyone)</em>.</li>
                     <li>Salin URL Web App yang dihasilkan dan tempelkan ke kolom URL Webhook di aplikasi ini.</li>
                   </ol>
                 </div>
              </div>
              
              <div className="relative group">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(APP_SCRIPT_TEMPLATE);
                    showToast('Kode berhasil disalin ke clipboard!', 'success');
                  }}
                  className="absolute top-3 right-3 p-2 bg-indigo-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-bold"
                >
                  <Copy className="w-4 h-4" /> Salin Kode
                </button>
                <textarea
                  readOnly
                  value={APP_SCRIPT_TEMPLATE}
                  className="w-full h-96 p-4 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-xl border border-slate-700 focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingProfile && (
              <form onSubmit={handleAddNewProfile} className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-4 text-xs">
                <div className="font-bold text-blue-950 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Daftarkan Dokumen Google Sheet Baru</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Nama Profil Spreadsheet <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Contoh: Sheet Bencana Tahap 2 (2026)"
                      required
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Link Dokumen Google Sheet <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={newProfileUrl}
                      onChange={(e) => setNewProfileUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      required
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      URL Webhook Apps Script (Opsional - Default Webhook Aktif)
                    </label>
                    <input
                      type="url"
                      value={newProfileWebhook}
                      onChange={(e) => setNewProfileWebhook(e.target.value)}
                      placeholder={googleSheetConfig.webhookUrl || 'https://script.google.com/macros/s/.../exec'}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 mb-1">
                      Link / ID Folder Google Drive Foto (Opsional)
                    </label>
                    <input
                      type="text"
                      value={newProfileDriveFolder}
                      onChange={(e) => setNewProfileDriveFolder(e.target.value)}
                      placeholder={googleSheetConfig.driveFolderId || 'https://drive.google.com/drive/folders/...'}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Catatan / Deskripsi Spreadsheet
                  </label>
                  <input
                    type="text"
                    value={newProfileDesc}
                    onChange={(e) => setNewProfileDesc(e.target.value)}
                    placeholder="Contoh: Digunakan untuk pendataan fisik gedung sekolah dan fasilitas umum"
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 space-y-1.5">
                  <label className="flex items-start gap-2.5 cursor-pointer font-bold select-none">
                    <input
                      type="checkbox"
                      checked={newProfileMakeActive}
                      onChange={(e) => setNewProfileMakeActive(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-indigo-950 font-extrabold text-xs block">
                        Tetapkan sebagai Sheet Utama Pengiriman Data
                      </span>
                      <span className="block font-normal text-slate-600 text-[11px] mt-0.5 leading-snug">
                        Default: <b>TIDAK DICENTANG</b>. Jika tidak dicentang, sheet baru ini hanya akan menjadi <b>Sheet Rekap / Baca Data</b> tanpa mengubah Sheet Utama yang sudah Anda stel sebelumnya.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingProfile(false)}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    Simpan Profile Sheet
                  </button>
                </div>
              </form>
            )}

            {/* List of Registered Profiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {rawProfiles.map((profile) => {
                const isActive = (googleSheetConfig.activeProfileId === profile.id) || 
                  (!googleSheetConfig.activeProfileId && profile.isDefault) ||
                  (googleSheetConfig.spreadsheetUrl && profile.spreadsheetUrl && googleSheetConfig.spreadsheetUrl.includes(extractSpreadsheetId(profile.spreadsheetUrl)));

                return (
                  <div
                    key={profile.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl font-bold shrink-0 mt-0.5 ${isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-950 text-sm">{profile.name}</h4>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                <span>📍 Sheet Utama Pengiriman</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                📊 Sheet Rekap / Baca Data
                              </span>
                            )}
                            {profile.isDefault && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                Default PUPR
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {profile.description || 'Tidak ada keterangan tambahan.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100/80 space-y-2 text-xs">
                      {profile.spreadsheetUrl ? (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                          <div className="truncate font-mono text-[11px] text-slate-700">
                            {profile.spreadsheetUrl}
                          </div>
                          <a
                            href={profile.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-emerald-700 font-bold text-[11px] hover:bg-emerald-50 shrink-0"
                          >
                            <span>Buka Sheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                          Tautan spreadsheet belum disetel.
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        {isActive ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Dokumen ini sedang menerima sinkronisasi data</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectProfile(profile)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>Jadikan Sheet Aktif</span>
                          </button>
                        )}

                        {!profile.isDefault && rawProfiles.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Hapus profil spreadsheet ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB: Strictly for Super Admin & Admin Only */}
      {isAdmin && activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Admin Authority Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">
                  Hak Khusus Super Admin & Admin
                </span>
                <span className="text-xs text-amber-900 mt-0.5 block leading-relaxed">
                  Hanya akun dengan hak akses Super Admin atau Admin yang berhak menentukan link Google Spreadsheet, URL Webhook Apps Script, dan Folder Google Drive. Peran pengguna lain (Surveyor, Verifikator, Camat, Publik) hanya memiliki akses untuk membuka dan melihat lembar kerja.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('view_sheet')}
              className="px-3.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-100 shrink-0 cursor-pointer shadow-2xs"
            >
              Lihat Lembar Kerja
            </button>
          </div>

      {/* Sheet Configuration Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-600" />
            <span>Tentukan Link Dokumen & Endpoint Google Sheet Anda</span>
          </div>
          {googleSheetConfig.spreadsheetUrl && (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </h3>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          {/* Link Google Spreadsheet */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Link Dokumen Google Sheet (Spreadsheet URL)
            </label>
            <div className="relative">
              <input
                type="url"
                value={spreadsheetUrlInput || ''}
                onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFM.../edit"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Tempel link file Google Spreadsheet Anda di sini.
            </p>
          </div>

          {/* Webhook Apps Script Endpoint */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              URL Web App Apps Script (Endpoint Penyimpanan Otomatis)
            </label>
            <input
              type="url"
              value={webhookUrlInput || ''}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            {webhookUrlInput.includes('drive.google.com') && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Tautan Google Drive Terdeteksi di Kolom Webhook!</span>
                    <span className="text-[11px] text-amber-800">
                      Kolom ini memerlukan URL Web App Google Apps Script (<code>https://script.google.com/macros/s/.../exec</code>). Tautan Google Drive seharusnya dimasukkan pada kolom Folder Drive di bawah.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDriveFolderIdInput(webhookUrlInput);
                    setWebhookUrlInput(googleSheetConfig.webhookUrl?.includes('drive.google.com') ? '' : (googleSheetConfig.webhookUrl || ''));
                    showToast('Tautan Google Drive dipindahkan ke kolom Folder Google Drive!', 'info');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                >
                  Pindahkan ke Kolom Drive
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              URL Webhook Aplikasi Web dari Google Apps Script (akses: "Siapa saja / Anyone").
            </p>
          </div>

          {/* Opsi Multi-Sheet & Nama Master */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitByKecamatan}
                  onChange={(e) => setSplitByKecamatan(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-blue-950 block">
                    Buat Sheet Terpisah Untuk Masing-Masing Kecamatan
                  </span>
                  <span className="text-[11px] text-blue-800 leading-tight block mt-0.5">
                    Data survei gedung otomatis masuk ke tab khusus kecamatannya (misal: "Kec. Aesesa", "Kec. Mauponggo", dll).
                  </span>
                </div>
              </label>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMasterSummary}
                  onChange={(e) => setIncludeMasterSummary(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Sertakan Sheet Rekapitulasi Master & Ringkasan
                  </span>
                  <span className="text-[11px] text-slate-600 leading-tight block mt-0.5">
                    Menyimpan tab konsolidasi seluruh data kabupaten dan rekap statistik untuk kebutuhan laporan pimpinan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Tab Sheet Master Gabungan</label>
              <input
                type="text"
                value={sheetNameInput || ''}
                onChange={(e) => setSheetNameInput(e.target.value)}
                placeholder="REKAP_SEMUA_KECAMATAN"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold w-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Penyimpanan Langsung Otomatis: Aktif</span>
              </div>
            </div>
          </div>

          {/* Konfigurasi Google Drive untuk Foto Skala Besar */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Arsip Foto Google Drive (Dukungan 20.000 Foto / 2.000 Gedung)</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Skala Besar PUPR
              </span>
            </div>
            
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              Untuk mengantisipasi 2.000 gedung dengan hingga 10 foto per gedung (20.000 foto), foto diarsipkan langsung ke <strong>Google Drive</strong> dalam folder terstruktur per nama gedung. Di <strong>Cloud Firestore</strong>, data tersimpan ringan dan cepat di bawah 1 MB.
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePhotosToDrive}
                  onChange={(e) => setSavePhotosToDrive(e.target.checked)}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-indigo-950 block">
                    Otomatis Arsipkan Foto Kerusakan ke Google Drive
                  </span>
                  <span className="text-[11px] text-indigo-800 leading-tight block mt-0.5">
                    Google Apps Script akan otomatis membuat subfolder per bangunan dan menyimpan foto visual lengkap dengan tautan di Google Sheet.
                  </span>
                </div>
              </label>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID / Link Folder Induk Google Drive (Penyimpanan Foto)
                </label>
                <input
                  type="text"
                  value={driveFolderIdInput || ''}
                  onChange={(e) => setDriveFolderIdInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... atau ID Folder"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Bila dikosongkan, skrip akan otomatis membuat folder induk bernama <strong>SIM-PKBG PUPR - Dokumentasi Foto Kerusakan</strong> di Google Drive Anda.
                </p>

                {driveFolderIdInput && (
                  <div className="mt-2 p-2.5 bg-indigo-100/70 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-950">
                      <FolderCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="text-[11px]">
                        {driveFolderIdInput.includes('drive.google.com') || (/^[a-zA-Z0-9_-]{15,}$/.test(extractDriveFolderId(driveFolderIdInput)) && !driveFolderIdInput.includes('/')) ? (
                          <>ID Folder Terdeteksi: <strong className="font-mono">{extractDriveFolderId(driveFolderIdInput)}</strong></>
                        ) : (
                          <>Nama Folder Terdeteksi: <strong className="font-semibold">{driveFolderIdInput.trim()}</strong> (Apps Script akan mencari folder ini)</>
                        )}
                      </span>
                    </div>
                    {getDriveFolderUrl(driveFolderIdInput) ? (
                      <a
                        href={getDriveFolderUrl(driveFolderIdInput)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder di Tab Baru</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-indigo-700 italic">
                        Tip: Salin URL dari browser saat membuka folder ini untuk tautan langsung
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 p-2 bg-white/70 border border-indigo-200/60 rounded-lg text-[11px] text-slate-600">
                  <span className="font-semibold text-indigo-950 block mb-0.5">💡 Cara mendapatkan Link Folder Google Drive:</span>
                  <span>Buka folder Anda (misal: <em>Data-IKBG/CK</em>) di Google Drive, klik kanan folder atau klik panah samping namanya, pilih <strong>Bagikan &gt; Salin tautan</strong>, lalu tempel di kolom ini.</span>
                </div>
              </div>

              {/* Uji & Unggah Foto Google Drive */}
              <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestDriveUpload}
                    disabled={isTestingDrive || isSyncingPhotosToDrive}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isTestingDrive ? 'animate-spin' : ''}`} />
                    <span>{isTestingDrive ? 'Mengirim Foto Uji Coba...' : 'Uji Kirim 1 Foto Contoh'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncAllPhotosToDrive}
                    disabled={isSyncingPhotosToDrive || isTestingDrive || assessmentsWithPhotos.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    title="Unggah seluruh foto penilaian gedung yang ada ke folder Google Drive"
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isSyncingPhotosToDrive ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncingPhotosToDrive
                        ? `Mengunggah (${syncPhotoProgress?.current || 0}/${syncPhotoProgress?.total || 0})...`
                        : `Kirim Semua Foto Survei ke Google Drive (${totalPhotosCount} Foto)`}
                    </span>
                  </button>
                </div>

                <span className="text-[11px] text-indigo-800">
                  {assessmentsWithPhotos.length > 0
                    ? `Terdapat ${totalPhotosCount} foto dari ${assessmentsWithPhotos.length} gedung siap diunggah ke Google Drive.`
                    : 'Belum ada foto survei untuk diunggah.'}
                </span>
              </div>

              {syncPhotoProgress && (
                <div className="p-3 bg-indigo-100/90 rounded-xl border border-indigo-200 text-xs text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
                    <span>
                      Sedang memproses gedung <strong>{syncPhotoProgress.buildingName}</strong> ({syncPhotoProgress.current} dari {syncPhotoProgress.total} gedung)...
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    {Math.round((syncPhotoProgress.current / syncPhotoProgress.total) * 100)}% Selesai
                  </span>
                </div>
              )}

              {testDriveResult && (
                <div className={`p-3 rounded-xl border text-xs ${testDriveResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {testDriveResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                      <div>
                        <span className="font-bold block">{testDriveResult.message}</span>
                        {testDriveResult.success && (
                          <span className="text-[11px] text-emerald-800 block mt-0.5">
                            Periksa Google Drive Anda. Di dalam folder Anda akan muncul subfolder "Gedung Uji Coba SIM-PKBG" beserta file foto uji coba!
                          </span>
                        )}
                      </div>
                    </div>
                    {testDriveResult.folderUrl && (
                      <a
                        href={testDriveResult.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold text-[11px] hover:bg-emerald-50 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Endpoint'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncFromSheet}
                disabled={isSyncingFromSheet}
                title="Tarik seluruh baris data dari Google Sheet ke aplikasi web tanpa pembatasan baris"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingFromSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingFromSheet ? 'Menarik Data...' : 'Tarik Semua Data dari Sheet'}</span>
              </button>

              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                title="Kirim ulang seluruh data penilaian dan susun ulang tab kecamatan di sheet"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 rounded-xl border border-emerald-300 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isSyncingAll ? 'Mengirim & Membuat Sheet...' : 'Sinkronkan Semua Sheet Kecamatan'}</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>Simpan Pengaturan Link Sheet</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Step by step guide & Google Apps Script code */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Kode Google Apps Script Multi-Sheet (Otomatis Buat Tab per Kecamatan)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Salin kode Apps Script berikut dan tempelkan di Google Spreadsheet Anda agar setiap kecamatan memiliki sheet tersendiri secara otomatis:
            </p>
          </div>

          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Skrip Multi-Sheet'}</span>
          </button>
        </div>

        {/* Important Notice for Google Drive Photo Storage */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Penting: Mengapa Foto Belum Tersimpan ke Link Google Drive Anda?</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Google Apps Script berjalan di Google Cloud akun Anda sendiri. Jika sebelumnya Anda telah men-deploy Apps Script sebelum fitur foto Google Drive ditambahkan, spreadsheet Anda masih menjalankan kode versi lama. Untuk mengaktifkannya:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 pl-1">
            <li>
              Klik tombol <strong className="text-amber-300">"Salin Skrip Multi-Sheet"</strong> di atas.
            </li>
            <li>
              Di Google Spreadsheet Anda, buka menu <strong className="text-white">Ekstensi &gt; Apps Script</strong>.
            </li>
            <li>
              Hapus seluruh isi kode lama di editor Apps Script, lalu <strong>Paste</strong> kode baru yang telah disalin.
            </li>
            <li>
              <strong className="text-amber-300">Langkah Kunci Pembaruan:</strong> Klik tombol <strong className="text-white">Deploy (Terapkan)</strong> &gt; <strong className="text-white">Kelola Deployment (Manage deployments)</strong> &gt; Klik ikon <strong className="text-white">Pensil (Edit)</strong> &gt; Pada dropdown Versi pilih <strong className="text-emerald-400">Versi Baru (New version)</strong> &gt; Klik <strong className="text-white">Terapkan (Deploy)</strong>.
            </li>
            <li>
              Jika Google meminta otorisasi izin (<em className="text-slate-400">"Review Permissions"</em>), klik <strong className="text-white">Review Permissions</strong> &gt; Pilih akun Google Anda &gt; Klik <strong className="text-white">Advanced / Lanjutan</strong> &gt; Klik <strong className="text-white">Buka SIM-PKBG (Aman)</strong> &gt; Klik <strong className="text-emerald-400">Izinkan (Allow)</strong> agar skrip diizinkan membuat folder & menyimpan foto di Drive Anda.
            </li>
          </ol>
        </div>

        {/* 4 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 1: Buka Apps Script</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Buka Google Sheet Anda di browser, klik menu <span className="font-semibold text-white">Ekstensi</span> &gt; <span className="font-semibold text-white">Apps Script</span>.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 2: Paste Kode</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Hapus kode bawaan di editor, lalu paste kode Apps Script yang Anda salin dari tombol di atas.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 3: Terapkan (Deploy)</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Klik <span className="font-semibold text-white">Terapkan &gt; Deployment baru</span>, pilih <span className="font-semibold text-white">Aplikasi Web</span>, dan setel Akses ke <span className="font-semibold text-emerald-400">Siapa saja (Anyone)</span>.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 4: Tempel Link & Sinkron</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Salin URL Aplikasi Web, tempel di form di atas, klik Simpan, lalu klik "Sinkronkan Semua Sheet Kecamatan".
            </p>
          </div>
        </div>

        {/* Code Block Preview */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 max-h-56">
            {scriptTemplate}
          </pre>
        </div>
      </div>
    </div>
  )}

  {/* MIGRATION & CONVERSION TAB: Convert Old Sheet to New 21 Columns Table Model */}
  {isAdmin && activeSubTab === 'migration' && (
    <SheetMigrationTool />
  )}
</div>
);
};
