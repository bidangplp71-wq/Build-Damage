const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target1 = `  // Real-time listener for shared Google Sheet configuration across all roles & devices
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) return;
    /* removed google sheet onSnapshot 2 */
    return () => unsubscribe();
  }, [db, isFirestoreQuotaExceeded]);`;

code = code.replace(target1, '');

// Also check lines around 909-940 for unsubscribeFirestore
const target2 = `  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;
    if (db && !isFirestoreQuotaExceeded) {
      try {
        /* removed google sheet onSnapshot */
      } catch (e) {
        console.warn('Real-time listener setup catch:', e);
      }
    }
    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [db, isFirestoreQuotaExceeded]);`;

const regex2 = /\/\/ Real-time listener for shared Google Sheet configuration[\s\S]*?\}, \[db, isFirestoreQuotaExceeded\]\);/g;

code = code.replace(regex2, '');

const regex3 = /useEffect\(\(\) => \{\s*let unsubscribeFirestore: \(\(\) => void\) \| undefined;\s*if \(db && !isFirestoreQuotaExceeded\) \{\s*try \{\s*\/\* removed google sheet onSnapshot \*\/\s*\} catch \(e\) \{\s*console\.warn\('Real-time listener setup catch:', e\);\s*\}\s*\}\s*return \(\) => \{\s*if \(unsubscribeFirestore\) unsubscribeFirestore\(\);\s*\};\s*\}, \[db, isFirestoreQuotaExceeded\]\);/g;

code = code.replace(regex3, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
