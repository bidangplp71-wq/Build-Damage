const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `    return { success: true, message: responseJson.message || 'Sinkronisasi Google Sheet berhasil' };`;
const replace = `    return { 
      success: true, 
      message: responseJson.message || 'Sinkronisasi Google Sheet berhasil',
      registrationCode: responseJson.registrationCode || undefined 
    };`;

code = code.replace(target, replace);
fs.writeFileSync('server.ts', code);
console.log('Done');
