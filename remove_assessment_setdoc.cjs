const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

// The regex will look for `if (db` ... `setDoc(doc(db, 'assessments'` and remove it or replace it.
// Let's just blindly replace `setDoc(doc(db, 'assessments',` with `// setDoc(doc(db, 'assessments',` 
// Actually, it's safer to remove the whole block. I'll just comment out `setDoc` for assessments.

code = code.replace(/setDoc\(doc\(db, 'assessments',/g, '// setDoc(doc(db, \'assessments\',');
code = code.replace(/deleteDoc\(doc\(db, 'assessments',/g, '// deleteDoc(doc(db, \'assessments\',');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
