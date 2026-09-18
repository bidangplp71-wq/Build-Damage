const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const profileListBlock = `const profilesList = (googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 0)
      ? googleSheetConfig.spreadsheetProfiles
      : [
          {
            id: 'profile_primary_2026',
            pageNumber: 1,
            name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
            spreadsheetUrl: googleSheetConfig.spreadsheetUrl || '',
            isDefault: true,
          },
        ];`;

const newProfileListBlock = `const profilesList = googleSheetConfig.spreadsheetProfiles || [];`;

code = code.replace(profileListBlock, newProfileListBlock);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
