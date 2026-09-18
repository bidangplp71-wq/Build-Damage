const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const regex = /if \(db && !isFirestoreQuotaExceeded\) \{\s*\/\/ setDoc\([\s\S]*?\}\);/g;
// actually the above one is not commented yet because it was multiline `setDoc(` not `setDoc(doc(db, 'assessments'`

const regex2 = /if \(db && !isFirestoreQuotaExceeded\) \{\s*setDoc\(\s*doc\(db, 'assessments'[\s\S]*?\}\);\s*\}/g;

code = code.replace(regex2, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
