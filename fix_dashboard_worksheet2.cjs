const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardAnalytics.tsx', 'utf-8');

const target1 = `  const {
    assessments,
    kecamatans,
    desas,
    currentUser,
    setActiveTab,
    setSelectedAssessmentForDetail,
    googleSheetConfig,
    syncAllToSheet,
    showToast,
  } = useApp();

  const totalBuildings = assessments.length;`;

const replace1 = `  const {
    assessments: allAssessments,
    kecamatans,
    desas,
    currentUser,
    setActiveTab,
    setSelectedAssessmentForDetail,
    googleSheetConfig,
    syncAllToSheet,
    showToast,
  } = useApp();

  const [selectedProfileId, setSelectedProfileId] = useState<string>('ALL');

  const assessments = useMemo(() => {
    if (selectedProfileId === 'ALL') return allAssessments;
    return allAssessments.filter(a => a.targetProfileId === selectedProfileId);
  }, [allAssessments, selectedProfileId]);

  const totalBuildings = assessments.length;`;

code = code.replace(target1, replace1);

const target2 = `  return (
    <div className="space-y-6">`;

const replace2 = `  return (
    <div className="space-y-6">
      {/* Worksheet Filter Control */}
      {googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Tampilan Data Berdasarkan Worksheet</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Filter semua grafik dan statistik di bawah ini sesuai Worksheet (Kecamatan/Verifikasi) yang dipilih.</p>
            </div>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full sm:w-72 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">Semua Worksheet (Gabungan)</option>
              {googleSheetConfig.spreadsheetProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/components/DashboardAnalytics.tsx', code);
console.log('Done');
