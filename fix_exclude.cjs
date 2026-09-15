const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheetsService.ts', 'utf8');

const targetExclude = `  const isExcludedRekapSheet = (name: string): boolean => {
    if (!name) return true;
    const clean = name.trim().toUpperCase().replace(/[\\s_-]+/g, '_');
    // Reject any sheet that does not start with Kec / KEC
    if (!name.trim().toLowerCase().startsWith('kec')) return true;
    // Reject summary/rekap sheets explicitly`;

const replacementExclude = `  const isExcludedRekapSheet = (name: string): boolean => {
    if (!name) return true;
    const clean = name.trim().toUpperCase().replace(/[\\s_-]+/g, '_');
    // Reject summary/rekap sheets explicitly`;

code = code.replace(targetExclude, replacementExclude);
fs.writeFileSync('src/services/googleSheetsService.ts', code);
console.log('Fixed exclusion');
