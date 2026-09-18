const fs = require('fs');
let code = fs.readFileSync('src/services/googleSheetsService.ts', 'utf-8');

const target = `      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData && proxyData.success === false) {
          const errMsg = proxyData.message || '';
          if (errMsg.includes('grown too large') || errMsg.includes('cannot be modified')) {
            return {
              success: false,
              message: \`Peringatan Google Sheet: Dokumen Spreadsheet "\${config.spreadsheetUrl.slice(-15)}" penuh / melebihi kapasitas ("The document cannot be modified. Perhaps it has grown too large?"). Silakan hapus baris kosong di tab Google Sheet atau ganti dengan Google Sheet baru di menu Pengaturan.\`,
            };
          }
          return {
            success: false,
            message: \`Peringatan Google Sheet: \${errMsg}\`,
          };
        }
      }`;

const replace = `      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData && proxyData.success === false) {
          const errMsg = proxyData.message || '';
          if (errMsg.includes('grown too large') || errMsg.includes('cannot be modified')) {
            return {
              success: false,
              message: \`Peringatan Google Sheet: Dokumen Spreadsheet "\${config.spreadsheetUrl.slice(-15)}" penuh / melebihi kapasitas ("The document cannot be modified. Perhaps it has grown too large?"). Silakan hapus baris kosong di tab Google Sheet atau ganti dengan Google Sheet baru di menu Pengaturan.\`,
            };
          }
          return {
            success: false,
            message: \`Peringatan Google Sheet: \${errMsg}\`,
          };
        }
        
        // If it succeeded, we return immediately.
        // Also extract registrationCode if returned by the Apps Script
        return {
          success: true,
          message: proxyData.message || \`Data gedung "\${assessment.buildingName}" berhasil disinkronkan ke Google Sheet!\`,
          registrationCode: proxyData.registrationCode,
          folderUrl: cleanFolderId ? \`https://drive.google.com/drive/folders/\${cleanFolderId}\` : undefined,
        };
      }`;

code = code.replace(target, replace);
fs.writeFileSync('src/services/googleSheetsService.ts', code);
console.log('Done');
