const fs = require('fs');
let code = fs.readFileSync('src/components/GlobalSheetRecapModal.tsx', 'utf8');

const targetEnd = `    </div>
  );
};`;

const replacementEnd = `    </div>
    </>
  );
};`;

code = code.replace(targetEnd, replacementEnd);
fs.writeFileSync('src/components/GlobalSheetRecapModal.tsx', code);
console.log('Fixed end tag');
