const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

// The logic to extract and display messages can be helpful.

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
