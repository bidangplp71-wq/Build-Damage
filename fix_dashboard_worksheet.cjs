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

const target2 = `        {/* Welcome Section & Fast Actions */}`;

const replace2 = `        {/* Welcome Section & Fast Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Filter Berdasarkan Worksheet / Database</h2>
            <p className="text-xs text-slate-500">
              Menampilkan data, grafik, dan statistik hanya untuk worksheet yang dipilih.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="ALL">Semua Worksheet (Gabungan)</option>
              {googleSheetConfig.spreadsheetProfiles?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Welcome Section & Fast Actions */}`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/components/DashboardAnalytics.tsx', code);
console.log('Done');
