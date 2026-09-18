const fs = require('fs');

const replaceInFile = (file, find, replace) => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.split(find).join(replace);
  fs.writeFileSync(file, content);
};

// SheetBookSelector.tsx
replaceInFile('src/components/SheetBookSelector.tsx', 
  `id: 'profile_primary_2026',`, 
  `id: 'default_placeholder',`);
replaceInFile('src/components/SheetBookSelector.tsx', 
  `|| 'profile_primary_2026'`, 
  `|| ''`);

// AssessmentTable.tsx
replaceInFile('src/components/AssessmentTable.tsx', 
  `id: 'profile_primary_2026',`, 
  `id: 'default_placeholder',`);
replaceInFile('src/components/AssessmentTable.tsx', 
  `useState<string>('profile_primary_2026')`, 
  `useState<string>('')`);
replaceInFile('src/components/AssessmentTable.tsx', 
  `|| 'profile_primary_2026'`, 
  `|| ''`);
replaceInFile('src/components/AssessmentTable.tsx', 
  `'profile_primary_2026'`, 
  `''`);

// GoogleSheetIntegration.tsx
replaceInFile('src/components/GoogleSheetIntegration.tsx', 
  `id: 'profile_primary_2026',`, 
  `id: 'default_placeholder',`);

console.log('Done');
