const fs = require('fs');
let code = fs.readFileSync('src/utils/offlineSync.ts', 'utf-8');

// The user wants to start from scratch without ghost data.
// Let's clear outbox queue on window load or provide a mechanism.
// Or just let the UI wipe it if it's there. Actually, the user can wipe application data.

console.log('offlineSync checked');
