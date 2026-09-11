import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah } from '../utils/puprCalculations';
import { BuildingCategory, BUILDING_CATEGORY_CONFIGS } from '../types';
import { detectAllDuplicateGroups } from '../utils/duplicateDetector';
import {
  Building,
  AlertTriangle,
  Coins,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  Flame,
  Waves,
  Mountain,
  Wind,
  ShieldCheck,
  Activity,
  MapPin,
  Home,
  Users,
  GraduationCap,
  Briefcase,
  Store,
  ShoppingBag,
  ShoppingCart,
  Landmark,
  Copy,
  Zap,
  Terminal,
  RefreshCw,
  X,
  ShieldAlert,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const DashboardAnalytics: React.FC = () => {
  const {
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

  const totalBuildings = assessments.length;
  const totalCost = assessments.reduce((acc, curr) => acc + curr.roundedRehabCost, 0);

  // Python Fast Analytics Engine State
  const [isPythonLoading, setIsPythonLoading] = useState(false);
  const [pythonResult, setPythonResult] = useState<any | null>(null);

  const runPythonAnalytics = async () => {
    if (assessments.length === 0) {
      showToast('Belum ada data gedung untuk dianalisis oleh Python Engine.', 'info');
      return;
    }
    setIsPythonLoading(true);
    try {
      const res = await fetch('/api/analytics/python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments }),
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setPythonResult(data);
        showToast(`⚡ Analisis data Python selesai dalam ${data.executionTimeMs} ms!`, 'success');
      } else {
        showToast('Gagal memproses analisis: ' + (data.message || 'Error internal'), 'error');
      }
    } catch (err: any) {
      showToast('Gagal menghubungi Python Engine di server: ' + err.message, 'error');
    } finally {
      setIsPythonLoading(false);
    }
  };

  // Duplicates detection
  const duplicateGroups = useMemo(() => {
    let ignored: string[] = [];
    try {
      const saved = localStorage.getItem('sipandu_ignored_duplicates');
      if (saved) ignored = JSON.parse(saved);
    } catch {}
    return detectAllDuplicateGroups(assessments, ignored);
  }, [assessments]);

  const lightDamage = assessments.filter((a) => a.damageClassification === 'Rusak Ringan').length;
  const moderateDamage = assessments.filter((a) => a.damageClassification === 'Rusak Sedang').length;
  const heavyDamage = assessments.filter(
    (a) => a.damageClassification === 'Rusak Berat' || a.damageClassification === 'Rusak Sangat Berat'
  ).length;

  const verifiedCount = assessments.filter((a) => a.verificationStatus === 'Terverifikasi').length;
  const pendingCount = assessments.filter((a) => a.verificationStatus === 'Menunggu Verifikasi').length;
  const gsheetSyncedCount = assessments.filter((a) => a.googleSheetSynced).length;

  // Breakdown by Disaster Type
  const disasterCounts: Record<string, number> = {};
  assessments.forEach((a) => {
    disasterCounts[a.disasterType] = (disasterCounts[a.disasterType] || 0) + 1;
  });

  // Breakdown by Building Category
  const categoryData = (Object.keys(BUILDING_CATEGORY_CONFIGS) as BuildingCategory[]).map((catKey) => {
    const cfg = BUILDING_CATEGORY_CONFIGS[catKey];
    const list = assessments.filter((a) => (a.buildingCategory || 'Gedung Pemerintah') === catKey);
    const cost = list.reduce((acc, curr) => acc + curr.roundedRehabCost, 0);
    return {
      category: catKey,
      config: cfg,
      count: list.length,
      totalCost: cost,
      percentOfTotal: totalBuildings > 0 ? Math.round((list.length / totalBuildings) * 100) : 0,
      ringan: list.filter((a) => a.damageClassification === 'Rusak Ringan').length,
      sedang: list.filter((a) => a.damageClassification === 'Rusak Sedang').length,
      berat: list.filter(
        (a) => a.damageClassification === 'Rusak Berat' || a.damageClassification === 'Rusak Sangat Berat'
      ).length,
    };
  });

  // Breakdown by Kecamatan
  const kecamatanData = kecamatans.map((kec) => {
    const list = assessments.filter((a) => a.kecamatanId === kec.id);
    const cost = list.reduce((acc, curr) => acc + curr.roundedRehabCost, 0);
    return {
      kecamatan: kec,
      count: list.length,
      totalCost: cost,
      ringan: list.filter((a) => a.damageClassification === 'Rusak Ringan').length,
      sedang: list.filter((a) => a.damageClassification === 'Rusak Sedang').length,
      berat: list.filter((a) => a.damageClassification === 'Rusak Berat' || a.damageClassification === 'Rusak Sangat Berat').length,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Trigger */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                PUPR Standar Permen No. 22/PRT/M/2018
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Google Sheet & Firebase Protected
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Dashboard Analisis Kerusakan Gedung
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Pemantauan real-time inventarisasi kerusakan bangunan, estimasi RAB rehabilitasi, serta validasi status per kecamatan dan desa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runPythonAnalytics}
              disabled={isPythonLoading || assessments.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm shadow-lg shadow-teal-900/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
              title="Eksekusi analisis data statistik & pemodelan kerentanan komponen struktur dengan Python Engine"
            >
              <Zap className={`w-4 h-4 text-amber-300 ${isPythonLoading ? 'animate-spin' : ''}`} />
              <span>{isPythonLoading ? 'Memproses Python...' : 'Analisis Cepat Python'}</span>
            </button>
            <button
              onClick={() => setActiveTab('input_baru')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Input Penilaian Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('penilaian')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-medium text-sm border border-slate-600 transition-all cursor-pointer"
            >
              <span>Lihat Tabel Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DUPLICATE DETECTION PROACTIVE ALERT BANNER ON DASHBOARD */}
      {duplicateGroups.length > 0 && (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'admin_verifikator') && (
        <div className="bg-amber-50 border-2 border-amber-400/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-amber-950">
                  Perhatian: Terdeteksi {duplicateGroups.length} Kelompok Data Survei Ganda
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                  Perlu Ditinjau
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                Ada survei yang diinput 2 kali atau lebih oleh surveyor (kesamaan nama gedung, kode registrasi, atau lokasi & pemilik).
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('penilaian')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Audit di Tabel Data &rarr;</span>
          </button>
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gedung */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Gedung Disurvei
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalBuildings}</span>
            <span className="text-xs text-slate-500">Unit Gedung</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span>Terverifikasi: <strong className="text-slate-800">{verifiedCount}</strong></span>
            <span>Menunggu: <strong className="text-amber-600">{pendingCount}</strong></span>
          </div>
        </div>

        {/* Total Estimasi RAB */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimasi Total Biaya Rehab
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex flex-col">
            <span className="text-2xl font-black text-slate-900 truncate">
              {formatRupiah(totalCost)}
            </span>
            <span className="text-xs text-slate-500 mt-0.5">HSBGN & Bongkaran 8%</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span>Rata-rata:</span>
            <strong className="text-slate-800">
              {totalBuildings > 0 ? formatRupiah(Math.round(totalCost / totalBuildings)) : 'Rp 0'}
            </strong>
          </div>
        </div>

        {/* Klasifikasi Kerusakan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tingkat Kerusakan
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Ringan (&lt;30%):
              </span>
              <strong className="text-slate-800 font-semibold">{lightDamage} unit</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-700 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Sedang (30-45%):
              </span>
              <strong className="text-slate-800 font-semibold">{moderateDamage} unit</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-rose-700 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Berat (&gt;45%):
              </span>
              <strong className="text-slate-800 font-semibold">{heavyDamage} unit</strong>
            </div>
          </div>
        </div>

        {/* Google Sheet Sync */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Integrasi Google Sheet
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{gsheetSyncedCount}</span>
            <span className="text-xs text-slate-500">/ {totalBuildings} Tersinkron</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
            <span className="truncate max-w-[130px]">{googleSheetConfig.sheetName}</span>
            <button
              onClick={() => setActiveTab('google_sheet')}
              className="text-emerald-700 font-semibold hover:underline"
            >
              Pengaturan &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* PYTHON HIGH-SPEED ANALYTICS ENGINE BANNER & INSIGHTS */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white border border-emerald-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg shadow-emerald-500/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-300" />
                  Python 3.10 Fast Engine
                </span>
                {pythonResult && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    ⚡ Waktu Komputasi: {pythonResult.executionTimeMs} ms
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-400/20 text-blue-300 border border-blue-400/30">
                  Permen PUPR No. 22/2018
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tight text-white mt-1">
                Mesin Analisis Data Berkecepatan Tinggi (Python Engine)
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
                Mengolah seluruh data survei gedung secara instan menggunakan komputasi statistik Python untuk menghitung indeks kerentanan komponen struktur, sebaran biaya, dan matriks prioritas penanganan (P1, P2, P3).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={runPythonAnalytics}
              disabled={isPythonLoading || assessments.length === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isPythonLoading ? 'animate-spin' : ''}`} />
              <span>{isPythonLoading ? 'Menghitung...' : pythonResult ? 'Hitung Ulang Python' : 'Jalankan Analisis Python'}</span>
            </button>
          </div>
        </div>

        {/* Python Analytics Results Display */}
        {pythonResult ? (
          <div className="mt-5 space-y-5">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Rata-rata Kerusakan</span>
                <span className="text-xl font-extrabold text-white mt-1 block">
                  {pythonResult.summary?.averageDamagePercent || 0}%
                </span>
                <span className="text-[10px] text-slate-400">Tingkat degradasi fisik</span>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Rata-rata Biaya / Gedung</span>
                <span className="text-xl font-extrabold text-amber-300 mt-1 block truncate">
                  {formatRupiah(pythonResult.summary?.meanCost || 0)}
                </span>
                <span className="text-[10px] text-slate-400">Mean alokasi per unit</span>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Standar Deviasi Biaya</span>
                <span className="text-xl font-extrabold text-blue-300 mt-1 block truncate">
                  {formatRupiah(pythonResult.summary?.standardDeviationCost || 0)}
                </span>
                <span className="text-[10px] text-slate-400">Variansi sebaran anggaran</span>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60">
                <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider block">Prioritas P1 Mendesak</span>
                <span className="text-xl font-extrabold text-rose-400 mt-1 block">
                  {pythonResult.priorityRankings?.P1_Mendesak || 0} Gedung
                </span>
                <span className="text-[10px] text-rose-300 font-medium">Bahaya keruntuhan struktur</span>
              </div>
            </div>

            {/* Recommendations & Component Vulnerability */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Recommendations */}
              <div className="lg:col-span-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Rekomendasi Algoritmik Permen PUPR</span>
                </h4>
                <div className="space-y-2 text-xs text-slate-200">
                  {pythonResult.recommendations?.map((rec: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Component Vulnerability Index */}
              <div className="lg:col-span-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Indeks Kerentanan Komponen Teknis (PUPR)</span>
                </h4>
                <div className="space-y-2">
                  {pythonResult.componentVulnerability?.slice(0, 5).map((comp: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <span>{comp.component}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                            {comp.category}
                          </span>
                        </span>
                        <span className="font-bold text-amber-400">
                          Indeks: {comp.vulnerabilityIndex}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            comp.category === 'Struktur' ? 'bg-rose-500' : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.min(100, comp.vulnerabilityIndex * 3)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Priority Buildings */}
            {pythonResult.topPriorityBuildings?.length > 0 && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Daftar Gedung Prioritas Paling Kritis (Urutan Skor Urgensi Python)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Diurutkan berdasarkan skor risiko struktural tertinggi</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {pythonResult.topPriorityBuildings.slice(0, 6).map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        const target = assessments.find((a) => a.id === b.id);
                        if (target) {
                          setSelectedAssessmentForDetail(target);
                          setActiveTab('penilaian');
                        }
                      }}
                      className="bg-slate-900/80 hover:bg-slate-900 p-3 rounded-xl border border-slate-700/70 hover:border-amber-400/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Skor: {b.urgencyScore}
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-amber-400 flex items-center gap-0.5">
                          Detail <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                      <h5 className="font-bold text-white text-sm truncate group-hover:text-amber-300 transition-colors">
                        {b.buildingName}
                      </h5>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        Kec. {b.kecamatan} • {b.category}
                      </p>
                      <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-800">
                        <span className="text-slate-300">Kerusakan: <strong className="text-rose-400">{b.damagePercent}%</strong></span>
                        <span className="font-bold text-amber-400">{formatRupiah(b.rehabCost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Klik tombol <strong>"Jalankan Analisis Python"</strong> untuk memproses seluruh {totalBuildings} data survei dengan algoritma machine calculation Python dalam hitungan milidetik.
              </span>
            </div>
            <button
              onClick={runPythonAnalytics}
              disabled={isPythonLoading || assessments.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer disabled:opacity-50"
            >
              Mulai Analisis Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Building Categories Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-amber-600" />
              <span>Rekapitulasi Kerusakan Berdasarkan Kategori & Fungsi Bangunan</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klasifikasi 8 kategori bangunan sesuai standar PUPR & acuan biaya HSBGN
            </p>
          </div>
          <button
            onClick={() => setActiveTab('tabel_data')}
            className="text-xs font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Lihat di Tabel Lengkap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {categoryData.map((item) => {
            const renderIcon = () => {
              switch (item.config.iconName) {
                case 'Home':
                  return <Home className="w-4 h-4" />;
                case 'Users':
                  return <Users className="w-4 h-4" />;
                case 'GraduationCap':
                  return <GraduationCap className="w-4 h-4" />;
                case 'Briefcase':
                  return <Briefcase className="w-4 h-4" />;
                case 'Store':
                  return <Store className="w-4 h-4" />;
                case 'ShoppingBag':
                  return <ShoppingBag className="w-4 h-4" />;
                case 'ShoppingCart':
                  return <ShoppingCart className="w-4 h-4" />;
                default:
                  return <Landmark className="w-4 h-4" />;
              }
            };

            return (
              <div
                key={item.category}
                onClick={() => setActiveTab('tabel_data')}
                className="p-4 rounded-xl border border-slate-200/80 hover:border-amber-400 bg-slate-50/40 hover:bg-amber-50/20 transition-all cursor-pointer flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-2xs">
                      {renderIcon()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs leading-snug group-hover:text-amber-900 transition-colors">
                        {item.config.shortLabel}
                      </h4>
                      <span className="text-[10px] text-slate-500">
                        {item.percentOfTotal}% dari total
                      </span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-slate-900">
                    {item.count}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] border-t border-slate-200/60 pt-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Estimasi Biaya:</span>
                    <strong className="text-slate-900 font-bold">
                      {item.totalCost > 0 ? formatRupiah(item.totalCost) : 'Rp 0'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Kerusakan:</span>
                    <span className="space-x-1 font-medium">
                      <span className="text-emerald-700">{item.ringan}R</span>
                      <span>&bull;</span>
                      <span className="text-amber-700">{item.sedang}S</span>
                      <span>&bull;</span>
                      <span className="text-rose-700">{item.berat}B</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics Grid: Per-Kecamatan & Jenis Bencana */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sebaran Data Per Kecamatan */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sebaran Kerusakan Per Kecamatan
              </h3>
              <p className="text-xs text-slate-500">
                Data terdistribusi ke desa/kelurahan (termasuk wilayah pemekaran baru)
              </p>
            </div>
            <button
              onClick={() => setActiveTab('wilayah')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Kelola Wilayah</span>
              <MapPin className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-2.5 px-3">Kecamatan</th>
                  <th className="py-2.5 px-2 text-center">Jml Gedung</th>
                  <th className="py-2.5 px-2 text-center">Ringan</th>
                  <th className="py-2.5 px-2 text-center">Sedang</th>
                  <th className="py-2.5 px-2 text-center">Berat</th>
                  <th className="py-2.5 px-3 text-right">Estimasi Biaya Rehab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {kecamatanData.map((item) => (
                  <tr key={item.kecamatan.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <span>Kec. {item.kecamatan.name}</span>
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-slate-800">
                      {item.count}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                        {item.ringan}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        {item.sedang}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium">
                        {item.berat}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-900">
                      {formatRupiah(item.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Jenis Bencana & Tindakan Cepat */}
        <div className="space-y-6">
          {/* Bencana Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Sebaran Berdasarkan Bencana
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Gempa bumi, banjir, longsor, dan bencana alam lainnya
            </p>

            <div className="space-y-3">
              {Object.entries(disasterCounts).map(([type, count]) => {
                const percent = Math.round((count / (totalBuildings || 1)) * 100);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{type}</span>
                      <span className="text-slate-500">{count} gedung ({percent}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}

              {Object.keys(disasterCounts).length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Belum ada data bencana terinput
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Shortcut */}
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 mb-2 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Aksi Singkat Pengelolaan</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <button
                onClick={() => setActiveTab('input_baru')}
                className="p-3 rounded-xl bg-white border border-indigo-100 shadow-xs hover:border-indigo-300 font-semibold text-slate-800 text-left transition-all"
              >
                + Form PUPR Cepat
              </button>
              <button
                onClick={() => setActiveTab('wilayah')}
                className="p-3 rounded-xl bg-white border border-indigo-100 shadow-xs hover:border-indigo-300 font-semibold text-slate-800 text-left transition-all"
              >
                + Pemekaran Desa
              </button>
              <button
                onClick={() => setActiveTab('google_sheet')}
                className="p-3 rounded-xl bg-white border border-indigo-100 shadow-xs hover:border-indigo-300 font-semibold text-slate-800 text-left transition-all"
              >
                Sync Google Sheet
              </button>
              <button
                onClick={() => setActiveTab('manajemen_user')}
                className="p-3 rounded-xl bg-white border border-indigo-100 shadow-xs hover:border-indigo-300 font-semibold text-slate-800 text-left transition-all"
              >
                Cek Kuota Peran
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
