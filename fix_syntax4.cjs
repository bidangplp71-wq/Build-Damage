const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/\/\/ deleteDoc\(doc\(db, 'assessments', id\)\)\.catch\(\(err\) => \{\s*if \(isQuotaError\(err\)\) setIsFirestoreQuotaExceeded\(true\);\s*console\.warn\('Firebase assessment deletion error:', err\?\.message \|\| err\);\s*\}\);/g, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
