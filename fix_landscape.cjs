const fs = require('fs');
let code = fs.readFileSync('src/components/GlobalSheetRecapModal.tsx', 'utf8');

const targetReturn = `  return (
    <div className="fixed inset-0 z-[100]`;

const replacementReturn = `  return (
    <>
      <style type="text/css">
        {\`
          @media print {
            @page {
              size: landscape !important;
              margin: 10mm !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background-color: white !important;
            }
            /* Hide the main app layout elements during print */
            body > #root > div > .print\\\\:hidden,
            header, nav, aside {
              display: none !important;
            }
          }
        \`}
      </style>
    <div className="fixed inset-0 z-[100]`;

code = code.replace(targetReturn, replacementReturn);
fs.writeFileSync('src/components/GlobalSheetRecapModal.tsx', code);
console.log('Fixed landscape mode');
