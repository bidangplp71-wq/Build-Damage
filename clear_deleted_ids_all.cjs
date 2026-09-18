const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `const syncAllProfiles = async (options?: { forceRefresh?: boolean; showToastAlert?: boolean }): Promise<{ success: boolean; message: string; count?: number; countPerProfile?: Record<string, number> }> => {`;
const replace = `const syncAllProfiles = async (options?: { forceRefresh?: boolean; showToastAlert?: boolean }): Promise<{ success: boolean; message: string; count?: number; countPerProfile?: Record<string, number> }> => {
    // Clear deleted IDs to start fresh as requested
    deletedAssessmentIds.current.clear();
    try { localStorage.removeItem(STORAGE_KEYS.DELETED_ASSESSMENTS); } catch {}
`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
