const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheetsService.ts', 'utf8');

const target = `    // Only skip if row is truly empty across all cells
    const hasAnyContent = Object.values(rowObj).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-'
    );
    if (!hasAnyContent) return;`;

const replacement = `    // Prevent "ghost rows": Only skip if row is truly empty OR if it lacks any meaningful identifier (e.g. only has a pre-filled auto-ID formula)
    const hasAnyContent = Object.values(rowObj).some(
      (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-'
    );
    const hasMeaningfulContent = Boolean(buildingName || desaName || detailedAddress || ownerAgency || namaPemilikRumah || namaPemilikGedung);
    
    if (!hasAnyContent || !hasMeaningfulContent) return;`;

code = code.split(target).join(replacement);
fs.writeFileSync('src/services/googleSheetsService.ts', code);
