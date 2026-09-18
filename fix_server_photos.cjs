const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /photos: Array\.isArray\(assessment\.photos\) \? assessment\.photos\.map\(\(p: any, idx: number\) => \(\{\s*id: p\.id \|\| `photo_\$\{idx\}`,\s*caption: p\.caption \|\| '',\s*damageLocation: p\.damageLocation \|\| `Foto \$\{idx \+ 1\}`,\s*url: p\.url && \(p\.url\.startsWith\('http'\) \|\| p\.url\.startsWith\('\/uploads\/'\)\) \? p\.url : '',\s*\}\)\) : \[\],\s*savePhotosToDrive: false,/m;

const replace = `photos: Array.isArray(assessment.photos) ? assessment.photos.map((p: any, idx: number) => ({
        id: p.id || \`photo_\${idx}\`,
        caption: p.caption || '',
        damageLocation: p.damageLocation || \`Foto \${idx + 1}\`,
        url: p.url || '',
        dataBase64: p.dataBase64 || undefined,
      })) : [],
      savePhotosToDrive: action !== 'delete' && config.savePhotosToDrive !== false,
      driveFolderId: config.driveFolderId || undefined,`;

code = code.replace(regex, replace);
fs.writeFileSync('server.ts', code);
console.log('Done');
