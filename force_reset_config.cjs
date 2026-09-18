const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() => {
    let initial = DEFAULT_GOOGLE_SHEET_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.spreadsheetProfiles) {
          parsed.spreadsheetProfiles = parsed.spreadsheetProfiles.filter((p) => p.id !== 'profile_primary_2026' || (p.spreadsheetUrl && p.spreadsheetUrl.trim() !== ''));
        }
        initial = { ...initial, ...parsed };
      }
    } catch {}`;

const replace = `  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() => {
    let initial = DEFAULT_GOOGLE_SHEET_CONFIG;
    try {
      if (!localStorage.getItem('hard_reset_config_v2')) {
        localStorage.removeItem(STORAGE_KEYS.GOOGLE_SHEET);
        localStorage.setItem('hard_reset_config_v2', 'true');
        return initial;
      }
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.spreadsheetProfiles) {
          parsed.spreadsheetProfiles = parsed.spreadsheetProfiles.filter((p) => p.id !== 'profile_primary_2026');
        }
        initial = { ...initial, ...parsed };
      }
    } catch {}`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
