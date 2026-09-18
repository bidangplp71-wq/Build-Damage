const fs = require('fs');
let code = fs.readFileSync('src/data/initialData.ts', 'utf-8');

code = code.replace(/spreadsheetProfiles: \[[\s\S]*\}\s*\],/, 'spreadsheetProfiles: [],');

fs.writeFileSync('src/data/initialData.ts', code);
console.log('Done');
