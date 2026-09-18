const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const regex1 = /unsubscribeFirestore = onSnapshot\(\s*\/\* doc\(db, 'system_configs', 'google_sheet'\) \*\/ null as any,[\s\S]*?\n\s*\);/g;
code = code.replace(regex1, '/* removed google sheet onSnapshot */');

const regex2 = /const unsubscribe = onSnapshot\(\s*\/\* doc\(db, 'system_configs', 'google_sheet'\) \*\/ null as any,[\s\S]*?\n\s*\);/g;
code = code.replace(regex2, '/* removed google sheet onSnapshot 2 */');

const regex3 = /setDoc\(\/\* doc\(db, 'system_configs', 'google_sheet'\) \*\/ null as any, JSON\.parse\(JSON\.stringify\(updated\)\), \{ merge: true \}\)\.catch\([\s\S]*?\n\s*\);/g;
code = code.replace(regex3, '/* removed google sheet setDoc */');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
