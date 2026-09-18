const fs = require('fs');
let code = fs.readFileSync('src/data/initialData.ts', 'utf-8');

const regex = /activeProfileId: 'profile_primary_2026',\s*spreadsheetProfiles: \[\s*\{\s*id: 'profile_primary_2026',\s*pageNumber: 1,\s*name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 \(Nagekeo\)',\s*spreadsheetUrl: \(typeof import\.meta !== 'undefined' && \(import\.meta as any\)\.env && \(import\.meta as any\)\.env\.VITE_SPREADSHEET_URL\) \|\| '',\s*isDefault: true,\s*\},\s*\],/g;

code = code.replace(regex, `activeProfileId: undefined,
  spreadsheetProfiles: [],`);

fs.writeFileSync('src/data/initialData.ts', code);
console.log('Done');
