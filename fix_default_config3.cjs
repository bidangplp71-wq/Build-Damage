const fs = require('fs');
let code = fs.readFileSync('src/data/initialData.ts', 'utf-8');

const target = `  activeProfileId: 'profile_primary_2026',
  spreadsheetProfiles: [
    {
      id: 'profile_primary_2026',
      pageNumber: 1,
      name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
      spreadsheetUrl: '',
      webhookUrl: 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
      driveFolderId: 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
      description: 'Spreadsheet dinas utama berisi 7 tab kecamatan dan log pengguna',
      capacityStatus: 'normal',
      estimatedRowCount: 0,
      maxCapacityRows: 200,
      createdAt: '2026-01-01T00:00:00Z',
      isDefault: true,
    }
  ],
};`;

const replace = `  activeProfileId: undefined,
  spreadsheetProfiles: [],
};`;

code = code.replace(target, replace);
fs.writeFileSync('src/data/initialData.ts', code);
console.log('Done');
