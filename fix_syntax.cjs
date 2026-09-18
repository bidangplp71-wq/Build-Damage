const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/\/\/ setDoc\(doc\(db, 'assessments', cleanA\.id\), cleanA, \{ merge: true \}\)\.catch\(\(err\) => \{\s*if \(isQuotaError\(err\)\) setIsFirestoreQuotaExceeded\(true\);\s*console\.warn\('Firebase assessment save notice:', err\?\.message \|\| err\);\s*\}\);/g, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
