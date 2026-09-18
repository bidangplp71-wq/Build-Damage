const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const targetBlock = `        // Fail-safe resilience: If incoming list has fewer items than existing,
        // keep existing un-fetched records so total count never suddenly drops from 207 to 11/45
        if (mergedList.length < prev.length) {
          prev.forEach((p) => {
            if (p.id && !incomingKeys.has(p.id) && (!p.code || !incomingKeys.has(p.code))) {
              mergedList.push(p);
            }
          });
        }`;

const replacementBlock = `        // Keep any un-fetched existing items only if they were NOT synced from Google Sheets.
        // Ghost duplicates from excluded sheets or deleted rows are purged.
        prev.forEach((p) => {
          if (p.id && !incomingKeys.has(p.id) && (!p.code || !incomingKeys.has(p.code))) {
            if (!p.googleSheetSynced) {
              mergedList.push(p);
            }
          }
        });`;

code = code.replace(targetBlock, replacementBlock);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
