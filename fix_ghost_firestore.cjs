const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target1 = `        // Persist synced items directly into Firestore database
        if (db && !isFirestoreQuotaExceeded && mergedList.length > 0) {
          mergedList.forEach((item) => {
            const clean = prepareAssessmentForFirestore(item);
            
          });
        }`;

const target2 = `        // Sync mergedList and Purge ghost duplicates from Firestore
        if (db && !isFirestoreQuotaExceeded && mergedList.length > 0) {
          mergedList.forEach((item) => {
            const clean = prepareAssessmentForFirestore(item);
            
          });
          
          ghostIdsToPurge.forEach((id) => {
            
          });
        }`;

code = code.replace(target1, '');
code = code.replace(target2, '');

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
