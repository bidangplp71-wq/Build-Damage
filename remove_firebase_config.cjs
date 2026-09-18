const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const regex = /getDoc\(doc\(db, 'system_configs', 'google_sheet'\)\)\.then\(\(snap\) => \{[\s\S]*?console\.warn\('Firebase google sheet config fetch deferred:', err\?\.message \|\| err\);\s*\}\),/m;

code = code.replace(regex, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
