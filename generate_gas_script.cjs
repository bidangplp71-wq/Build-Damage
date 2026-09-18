const fs = require('fs');

const gasCode = `// =========================================================================
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

let code = fs.readFileSync('src/components/GoogleSheetIntegration.tsx', 'utf-8');

// Kita tambahkan tombol dan Modal untuk melihat kode ini di GoogleSheetIntegration.tsx

const targetButton = `<button
                  type="button"
                  onClick={() => setIsAddingProfile(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Worksheet (Kecamatan/Verifikasi)
                </button>`;

const insertButton = `{/* Tombol Generator Script */}
                <button
                  type="button"
                  onClick={() => setShowScriptModal(true)}
                  className="w-full sm:w-auto px-4 py-2 border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  <FileCode2 className="w-4 h-4" />
                  Lihat Script AppScript
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingProfile(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Worksheet (Kecamatan/Verifikasi)
                </button>`;

code = code.replace(targetButton, insertButton);

const modalStateTarget = `const [isAddingProfile, setIsAddingProfile] = useState(false);`;
const modalStateInsert = `const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);`;
code = code.replace(modalStateTarget, modalStateInsert);

const importTarget = `Copy,`;
const importInsert = `Copy, FileCode2, Info,`;
code = code.replace(importTarget, importInsert);

const endComponentTarget = `export const GoogleSheetIntegration: React.FC = () => {`;
// Kita tidak perlu inject script text panjang ke react file, kita bisa buat constant di atasnya

const fullScriptString = `export const APP_SCRIPT_TEMPLATE = \`${gasCode}\`;

export const GoogleSheetIntegration: React.FC = () => {`;
code = code.replace(endComponentTarget, fullScriptString);

const renderModalTarget = `{isAddingProfile && (`;
const renderModalInsert = `{showScriptModal && (
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

      {isAddingProfile && (`;

code = code.replace(renderModalTarget, renderModalInsert);

fs.writeFileSync('src/components/GoogleSheetIntegration.tsx', code);
console.log('Script injection complete!');
