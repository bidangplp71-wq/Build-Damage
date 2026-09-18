const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `        // The authoritative dataset from the 7 kecamatan sheets
        const incomingKeys = new Set<string>();
        const deduplicatedSheetItems: BuildingAssessment[] = [];
        
        sheetItems.forEach((item) => {
          if (!item.id || !item.code) return;
          if (incomingKeys.has(item.id) || incomingKeys.has(item.code)) {
            return;
          }
          incomingKeys.add(item.id);
          incomingKeys.add(item.code);
          deduplicatedSheetItems.push(item);
        });`;

const replace = `        // The authoritative dataset from the configured sheets
        const incomingKeys = new Set<string>();
        const deduplicatedSheetItems: BuildingAssessment[] = [];
        const itemMap = new Map<string, BuildingAssessment>();
        
        sheetItems.forEach((item) => {
          if (!item.id || !item.code) return;
          const key = item.id;
          const existing = itemMap.get(key);
          if (!existing) {
            itemMap.set(key, item);
          } else {
            if (item.verificationStatus === 'Terverifikasi' && existing.verificationStatus !== 'Terverifikasi') {
              itemMap.set(key, item);
            } else if (item.verificationStatus === existing.verificationStatus) {
              const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
              const existTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              if (itemTime > existTime) {
                itemMap.set(key, item);
              }
            }
          }
        });
        
        itemMap.forEach((item) => {
          incomingKeys.add(item.id!);
          if (item.code) incomingKeys.add(item.code);
          deduplicatedSheetItems.push(item);
        });`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
