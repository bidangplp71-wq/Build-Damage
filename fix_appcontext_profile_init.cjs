const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      if (saved) {
        initial = { ...initial, ...JSON.parse(saved) };
      }
    } catch {}`;

const replace = `    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.spreadsheetProfiles) {
          parsed.spreadsheetProfiles = parsed.spreadsheetProfiles.filter((p) => p.id !== 'profile_primary_2026' || (p.spreadsheetUrl && p.spreadsheetUrl.trim() !== ''));
        }
        initial = { ...initial, ...parsed };
      }
    } catch {}`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
