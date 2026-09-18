const fs = require('fs');
let code = fs.readFileSync('src/data/initialData.ts', 'utf-8');

code = code.replace(/activeProfileId: 'profile_primary_2026',/, 'activeProfileId: undefined,');

fs.writeFileSync('src/data/initialData.ts', code);
console.log('Done');
