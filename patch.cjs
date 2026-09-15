const fs = require('fs');
let code = fs.readFileSync('src/components/SheetBookSelector.tsx', 'utf8');

const targetReturn = `  return (
    <div className="w-full space-y-3">`;
const replacementReturn = `  return (
    <div className="w-full space-y-3">
      <div className="print:hidden space-y-3">`;

const targetEnd = `      )}

      {showGlobalRecapModal && (`;
const replacementEnd = `      )}
      </div>

      {showGlobalRecapModal && (`;

code = code.replace(targetReturn, replacementReturn).replace(targetEnd, replacementEnd);
fs.writeFileSync('src/components/SheetBookSelector.tsx', code);
console.log('patched SheetBookSelector');
