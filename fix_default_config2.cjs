const fs = require('fs');
let code = fs.readFileSync('src/data/initialData.ts', 'utf-8');

const regex = /activeProfileId: 'profile_primary_2026',[\s\S]*isDefault: true,\s*\}\s*\]/m;

code = code.replace(regex, `activeProfileId: undefined,
  spreadsheetProfiles: []`);

fs.writeFileSync('src/data/initialData.ts', code);
console.log('Done');
