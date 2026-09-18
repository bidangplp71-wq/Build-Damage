const fs = require('fs');

let code = fs.readFileSync('src/components/GoogleSheetIntegration.tsx', 'utf-8');

const triggerFunctionText = `

// ==========================================================
// FUNGSI OTOMATIS: PEMINDAH DATA KECAMATAN (JAM 12 MALAM)
// ==========================================================
function pindahkanDataKecamatanOtomatis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName("REKAP_SEMUA_KECAMATAN") || ss.getSheets()[0];
  if (!masterSheet || masterSheet.getLastRow() <= 1) return;
  
  var data = masterSheet.getDataRange().getValues();
  var headers = data[0];
  var kecIdx = headers.indexOf('Kecamatan');
  var regIdx = headers.indexOf('No Registrasi');
  
  if (kecIdx === -1) kecIdx = headers.indexOf('Nama Kecamatan');
  if (kecIdx === -1) return;
  
  for (var i = 1; i < data.length; i++) {
    var rowVal = data[i];
    var kecName = String(rowVal[kecIdx] || "").trim();
    if (!kecName) continue;
    
    var regCode = regIdx !== -1 ? String(rowVal[regIdx] || "").trim() : "";
    var targetTabName = "Kec. " + kecName;
    
    var rowData = {};
    for (var h = 0; h < headers.length; h++) {
      rowData[headers[h]] = rowVal[h];
    }
    
    var targetSheet = getOrCreateSheet(ss, targetTabName);
    saveOrUpdateRow(targetSheet, rowData, regCode, 'update');
  }
  
  trimEmptyRowsAndColumns(ss);
  Logger.log("Selesai memindahkan data otomatis ke masing-masing sheet kecamatan.");
}
`;

// Insert before export const GoogleSheetIntegration
code = code.replace("return {\n    sheetsProcessed: processed,\n    totalRowsTrimmed: totalRowsTrimmed,\n    totalColsTrimmed: totalColsTrimmed\n  };\n};", "return {\n    sheetsProcessed: processed,\n    totalRowsTrimmed: totalRowsTrimmed,\n    totalColsTrimmed: totalColsTrimmed\n  };\n}\n" + triggerFunctionText + "`;");

fs.writeFileSync('src/components/GoogleSheetIntegration.tsx', code);
console.log('AppScript template updated with pindahkanDataKecamatanOtomatis');
