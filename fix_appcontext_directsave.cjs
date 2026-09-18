const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target1 = `      directSaveToGoogleSheet(
        assessmentToSave,
        effectiveSheetConfig,
        'insert',
        undefined,
        assessmentToSave.targetSheetName || assessmentToSave.sourceSheet
      )
        .then((res) => {
          if (res.success) {
            setAssessments((prev) =>
              prev.map((a) =>
                a.id === assessmentToSave.id
                  ? { ...a, googleSheetSynced: true, googleSheetSyncedAt: new Date().toISOString() }
                  : a
              )
            );
          }
        })`;

const replace1 = `      directSaveToGoogleSheet(
        assessmentToSave,
        effectiveSheetConfig,
        'insert',
        undefined,
        assessmentToSave.targetSheetName || assessmentToSave.sourceSheet
      )
        .then((res: any) => {
          if (res.success) {
            setAssessments((prev) => {
              const newList = prev.map((a) => {
                if (a.id === assessmentToSave.id) {
                  return { 
                    ...a, 
                    googleSheetSynced: true, 
                    googleSheetSyncedAt: new Date().toISOString(),
                    // Override code/id if Apps Script returned a new one!
                    code: res.registrationCode || a.code,
                  };
                }
                return a;
              });
              try {
                localStorage.setItem('sipandu_assessments', JSON.stringify(newList));
              } catch {}
              return newList;
            });
          }
        })`;

code = code.replace(target1, replace1);

const target2 = `    if (hasGSheet) {
      directSaveToGoogleSheet(mergedData, effectiveSheetConfig, 'update', target?.code || target?.id).catch((e) =>
        console.error('Direct Google Sheet update error:', e)
      );
    }`;

const replace2 = `    if (hasGSheet) {
      directSaveToGoogleSheet(mergedData, effectiveSheetConfig, 'update', target?.code || target?.id).then((res: any) => {
        if (res.success && res.registrationCode) {
          setAssessments((prev) => {
            const newList = prev.map((a) => {
              if (a.id === id) {
                return { ...a, code: res.registrationCode };
              }
              return a;
            });
            try {
              localStorage.setItem('sipandu_assessments', JSON.stringify(newList));
            } catch {}
            return newList;
          });
        }
      }).catch((e) =>
        console.error('Direct Google Sheet update error:', e)
      );
    }`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
