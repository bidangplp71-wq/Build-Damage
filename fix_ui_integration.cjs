const fs = require('fs');
let code = fs.readFileSync('src/components/GoogleSheetIntegration.tsx', 'utf-8');

code = code.replace(/Tambah Halaman Sheet/g, 'Tambah Worksheet (Kecamatan/Verifikasi)');
code = code.replace(/Daftar Halaman Buku \/ Arsip Spreadsheet/g, 'Daftar Worksheet Database (Hub, Kecamatan, Verifikasi)');
code = code.replace(/Pusat Kontrol Integrasi Data/g, 'Pusat Kontrol Database Multi-Worksheet');

fs.writeFileSync('src/components/GoogleSheetIntegration.tsx', code);
console.log('Done');
