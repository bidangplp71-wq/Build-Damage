const fs = require('fs');
let code = fs.readFileSync('src/utils/offlineSync.ts', 'utf-8');

const regex = /\/\/ 1\. Sync to Cloud Firestore directly[\s\S]*?\/\/ 2\. Also sync to Express backend if fullstack/m;
code = code.replace(regex, '// 1. Sync to Express backend if fullstack');

fs.writeFileSync('src/utils/offlineSync.ts', code);
console.log('Done');
