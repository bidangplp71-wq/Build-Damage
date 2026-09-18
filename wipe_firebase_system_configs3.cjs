const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

code = code.replace(/doc\(db, 'system_configs', 'google_sheet'\)/g, "/* doc(db, 'system_configs', 'google_sheet') */ null as any");

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
