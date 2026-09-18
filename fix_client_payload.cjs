const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheetsService.ts', 'utf-8');

const regex = /assessment: hydratedAssessment,/g;
code = code.replace(regex, 'assessment: { ...hydratedAssessment, photos: preparedPhotos },');

fs.writeFileSync('src/services/googleSheetsService.ts', code);
console.log('Done');
