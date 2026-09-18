const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `      // Deduplicate fetched items first (prioritize the first encountered valid item)
      allFetchedItems.forEach((item) => {
        if (!item.id || !item.code) return;
        if (incomingKeys.has(item.id) || incomingKeys.has(item.code)) {
          return; // Skip duplicates within the fetched payload
        }
        incomingKeys.add(item.id);
        incomingKeys.add(item.code);
        deduplicatedFetchedItems.push(item);
      });`;

const replace = `      // Deduplicate fetched items (prioritize the one that is 'Terverifikasi' or most recently updated)
      const itemMap = new Map<string, BuildingAssessment>();
      allFetchedItems.forEach((item) => {
        if (!item.id || !item.code) return;
        const key = item.id;
        const existing = itemMap.get(key);
        if (!existing) {
          itemMap.set(key, item);
        } else {
          // If the new one is 'Terverifikasi' and existing is not, prefer the new one
          if (item.verificationStatus === 'Terverifikasi' && existing.verificationStatus !== 'Terverifikasi') {
            itemMap.set(key, item);
          } else if (item.verificationStatus === existing.verificationStatus) {
            // Or if it was updated more recently
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
        deduplicatedFetchedItems.push(item);
      });`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
