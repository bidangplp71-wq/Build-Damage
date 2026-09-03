import React from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah } from '../utils/puprCalculations';
import { BuildingCategory, BUILDING_CATEGORY_CONFIGS } from '../types';
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
} from 'lucide-react';

export const DashboardAnalytics: React.FC = () => {
  const {
    assessments,
    kecamatans,
    desas,
    setActiveTab,
    setSelectedAssessmentForDetail,
    googleSheetConfig,
    syncAllToSheet,
    showToast,
  } = useApp();

  const totalBuildings = assessments.length;
  const totalCost = assessments.reduce((acc, curr) => acc + curr.roundedRehabCost, 0);

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
              onClick={() => setActiveTab('input_baru')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Input Penilaian Baru</span>
            </button>
            <button
              onClick={() => setActiveTab('penilaian')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-medium text-sm border border-slate-600 transition-all"
            >
              <span>Lihat Tabel Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
