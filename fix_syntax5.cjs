const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/\/\/ deleteDoc\(doc\(db, 'assessments', id\)\)\.catch\(\(\) => \{\}\);/g, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
