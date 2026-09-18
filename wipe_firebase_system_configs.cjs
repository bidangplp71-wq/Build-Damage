const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/const unsubConfig = onSnapshot\(doc\(db, 'system_configs', 'google_sheet'\)[\s\S]*?return \(\) => unsubConfig\(\);/m, '');
code = code.replace(/const unsubConfig = onSnapshot\(\s*doc\(db, 'system_configs', 'google_sheet'\)[\s\S]*?return \(\) => unsubConfig\(\);/m, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
