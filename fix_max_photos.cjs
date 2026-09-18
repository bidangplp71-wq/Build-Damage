const fs = require('fs');
let code = fs.readFileSync('src/components/AssessmentForm.tsx', 'utf-8');

// The maximum number of photos allowed
// Replace `const MAX_BUILDING_PHOTOS = 4;` with `const MAX_BUILDING_PHOTOS = 20;`
code = code.replace(/const MAX_BUILDING_PHOTOS = 4;/g, 'const MAX_BUILDING_PHOTOS = 20;');
code = code.replace(/Maksimal 4 foto/g, 'Maksimal 20 foto');
code = code.replace(/Maksimal \{MAX_BUILDING_PHOTOS\} foto visual per satu bangunan gedung\/rumah\. Foto disimpan aman di Firebase Cloud Storage \& Firestore\./g, 
  'Maksimal {MAX_BUILDING_PHOTOS} foto visual per satu bangunan gedung/rumah. Foto diupload langsung ke Google Drive.');

fs.writeFileSync('src/components/AssessmentForm.tsx', code);
console.log('Done');
