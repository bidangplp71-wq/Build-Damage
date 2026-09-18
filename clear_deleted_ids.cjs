const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `const syncFromGoogleSheet = async (showToastAlert = false, forceRefresh?: boolean): Promise<{ success: boolean; message: string; count?: number }> => {`;
const replace = `const syncFromGoogleSheet = async (showToastAlert = false, forceRefresh?: boolean): Promise<{ success: boolean; message: string; count?: number }> => {
    // Clear deleted IDs to start fresh as requested
    deletedAssessmentIds.current.clear();
    try { localStorage.removeItem(STORAGE_KEYS.DELETED_ASSESSMENTS); } catch {}
`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
