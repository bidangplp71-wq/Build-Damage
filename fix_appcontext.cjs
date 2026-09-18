const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

// Remove getDocs for assessments
const getDocsRegex = /getDocs\(collection\(db, 'assessments'\)\)\.then\(async \(snapshot\) => \{[\s\S]*?console\.warn\('Firebase assessments fetch offline\/deferred:', err\?\.message \|\| err\);\n      \}\),/m;
code = code.replace(getDocsRegex, '');

// Remove onSnapshot for assessments
const onSnapshotRegex = /\/\/ Real-time listener for incoming building assessments and deletions from Firebase Firestore\s+useEffect\(\(\) => \{\s+if \(\!db \|\| isFirestoreQuotaExceeded\) return;\s+const knownIds[\s\S]*?return \(\) => unsubscribe\(\);\s+\}, \[db\]\);/m;
code = code.replace(onSnapshotRegex, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
