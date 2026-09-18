const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const regex1 = /const unsubscribe = onSnapshot\(\s*doc\(db, 'system_configs', 'google_sheet'\)[\s\S]*?return \(\) => unsubscribe\(\);\s*\}, \[db\]\);/g;
code = code.replace(regex1, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
