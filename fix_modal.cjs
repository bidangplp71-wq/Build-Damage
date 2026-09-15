const fs = require('fs');
let code = fs.readFileSync('src/components/GlobalSheetRecapModal.tsx', 'utf8');

const target1 = `  // Calculate matrix data
  const matrixData = useMemo(() => {
    return profiles.map(profile => {
      const profileAssessments = assessments.filter(a => a.targetProfileId === profile.id || (!a.targetProfileId && profile.isDefault));
      
      let menunggu = 0;`;

const replacement1 = `  // Calculate matrix data
  const matrixData = useMemo(() => {
    const mappedIds = new Set<string>();
    const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];

    const results = profiles.map(profile => {
      const profileAssessments = assessments.filter(a => {
        if (a.targetProfileId === profile.id || (!a.targetProfileId && defaultProfile && profile.id === defaultProfile.id)) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        return false;
      });
      
      let menunggu = 0;`;

let code1 = code.replace(target1, replacement1);

const target2 = `      return {
        profile,
        total: profileAssessments.length,
        menunggu,
        terverifikasi,
        rb,
        rs,
        rr,
        tr,
        totalAnggaran,
        buildingDetails
      };
    });
  }, [profiles, assessments]);`;

const replacement2 = `      return {
        profile,
        total: profileAssessments.length,
        menunggu,
        terverifikasi,
        rb,
        rs,
        rr,
        tr,
        totalAnggaran,
        buildingDetails
      };
    });

    // Handle Unmapped Data
    const unmappedAssessments = assessments.filter(a => a.id && !mappedIds.has(a.id));
    if (unmappedAssessments.length > 0) {
      let menunggu = 0, terverifikasi = 0, rb = 0, rs = 0, rr = 0, tr = 0, totalAnggaran = 0;
      const buildingDetails = unmappedAssessments.map(a => {
        const costPerM2 = (a.treatmentCostPerM2 || 0) + (a.demolitionCostPerM2 || 0);
        const totalCost = costPerM2 * (a.totalFloorAreaM2 || 0);
        totalAnggaran += totalCost;
        return { ...a, calculatedTotalCost: totalCost };
      });
      
      buildingDetails.sort((a, b) => {
        if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === 'Terverifikasi' ? -1 : 1;
        return (b.totalDamagePercent || 0) - (a.totalDamagePercent || 0);
      });

      unmappedAssessments.forEach(a => {
        if (a.verificationStatus === 'Terverifikasi') terverifikasi++;
        else menunggu++;
        switch (a.damageClassification) {
          case 'Rusak Berat': rb++; break;
          case 'Rusak Sedang': rs++; break;
          case 'Rusak Ringan': rr++; break;
          case 'Tidak Rusak': tr++; break;
        }
      });

      results.push({
        profile: { id: 'unmapped', name: 'Data Tidak Terpetakan (Lainnya)', spreadsheetUrl: '' } as any,
        total: unmappedAssessments.length,
        menunggu, terverifikasi, rb, rs, rr, tr, totalAnggaran,
        buildingDetails
      });
    }

    return results;
  }, [profiles, assessments]);`;

code1 = code1.replace(target2, replacement2);

// Fix Print Overlap
const target3 = `className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:p-0 print:bg-white print:block"`;
const replacement3 = `className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:relative print:inset-auto print:z-auto print:p-0 print:bg-white print:block print:min-h-screen"`;
code1 = code1.replace(target3, replacement3);

const target4 = `className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl print:shadow-none print:max-w-none print:max-h-none print:rounded-none"`;
const replacement4 = `className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:h-auto print:overflow-visible print:block"`;
code1 = code1.replace(target4, replacement4);

const target5 = `className="p-6 overflow-y-auto print:p-0 print:overflow-visible"`;
const replacement5 = `className="p-6 overflow-y-auto print:p-0 print:overflow-visible print:h-auto"`;
code1 = code1.replace(target5, replacement5);

fs.writeFileSync('src/components/GlobalSheetRecapModal.tsx', code1);
console.log('Fixed Modal');
