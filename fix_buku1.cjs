const fs = require('fs');

const replaceInFile = (file, find, replace) => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.split(find).join(replace);
  fs.writeFileSync(file, content);
};

// SheetBookSelector.tsx
replaceInFile('src/components/SheetBookSelector.tsx', 
  `name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',`, 
  `name: 'Spreadsheet Kosong (Belum Diatur)',`);

// AssessmentTable.tsx
replaceInFile('src/components/AssessmentTable.tsx', 
  `name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026',`, 
  `name: 'Spreadsheet Kosong (Belum Diatur)',`);

console.log('Done');
