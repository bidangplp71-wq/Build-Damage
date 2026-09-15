const fs = require('fs');
let code = fs.readFileSync('src/components/AssessmentForm.tsx', 'utf8');

const target = `      targetSheetName: targetSheetName.trim() || \`Kec. \${currentKec?.name || 'Aesesa'}\`,
      sourceSheet: targetSheetName.trim() || \`Kec. \${currentKec?.name || 'Aesesa'}\`,
      targetProfileId: targetProfileId || 
        ? (selectedAssessmentForEdit?.targetProfileId || googleSheetConfig.activeProfileId || googleSheetConfig.spreadsheetProfiles?.[0]?.id)
        : (googleSheetConfig.activeProfileId || googleSheetConfig.spreadsheetProfiles?.[0]?.id),
      targetProfileName: isEditMode
        ? (selectedAssessmentForEdit?.targetProfileName || googleSheetConfig.spreadsheetProfiles?.find((p) => p.id === googleSheetConfig.activeProfileId)?.name)
        : googleSheetConfig.spreadsheetProfiles?.find((p) => p.id === googleSheetConfig.activeProfileId)?.name,
      latitude,`;

const replacement = `      targetSheetName: targetSheetName.trim() || \`Kec. \${currentKec?.name || 'Aesesa'}\`,
      sourceSheet: targetSheetName.trim() || \`Kec. \${currentKec?.name || 'Aesesa'}\`,
      targetProfileId: targetProfileId || googleSheetConfig.activeProfileId || googleSheetConfig.spreadsheetProfiles?.[0]?.id,
      targetProfileName: googleSheetConfig.spreadsheetProfiles?.find((p) => p.id === (targetProfileId || googleSheetConfig.activeProfileId))?.name,
      latitude,`;

code = code.split(target).join(replacement);
fs.writeFileSync('src/components/AssessmentForm.tsx', code);
