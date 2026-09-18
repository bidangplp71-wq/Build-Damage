const fs = require('fs');

try {
  fs.unlinkSync('assessments.json');
} catch {}

console.log('Done');
