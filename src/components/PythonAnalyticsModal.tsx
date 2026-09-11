import React, { useState } from 'react';
import { PythonAnalyticsResult, PriorityBuilding } from '../utils/pythonAnalyticsEngine';
import { formatRupiah } from '../utils/puprCalculations';
import { BuildingAssessment } from '../types';
import {
  X,
  Zap,
  Terminal,
  ShieldAlert,
  AlertTriangle,
  Building,
  CheckCircle2,
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
  MapPin,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PythonAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PythonAnalyticsResult | null;
  assessments: BuildingAssessment[];
  onSelectBuilding: (assessment: BuildingAssessment) => void;
  onRecompute: () => void;
  isLoading: boolean;
}

export const PythonAnalyticsModal: React.FC<PythonAnalyticsModalProps> = ({
  isOpen,
  onClose,
  result,
  assessments,
  onSelectBuilding,
  onRecompute,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'prioritas' | 'komponen' | 'wilayah'>('ringkasan');
  const [searchKecamatan, setSearchKecamatan] = useState('');

  if (!isOpen || !result) return null;

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Ringkasan Eksekutif
      const summaryData = [
        ['SIPANDU PUPR - LAPORAN ANALISIS DATA STATISTIK PYTHON'],
        ['Dasar Standar', 'Permen PUPR No. 22/PRT/M/2018'],
        ['Waktu Komputasi', `${result.executionTimeMs} ms`],
        ['Engine', result.engine],
        ['Total Gedung Disurvei', result.totalBuildings],
        ['Total Estimasi RAB Rehab', result.summary.totalCost],
        ['Rata-rata Biaya per Gedung', result.summary.meanCost],
        ['Median Biaya', result.summary.medianCost],
        ['Standar Deviasi Biaya', result.summary.standardDeviationCost],
        ['Rata-rata Tingkat Kerusakan', `${result.summary.averageDamagePercent}%`],
        ['Jumlah Rusak Ringan', result.summary.damageCounts['Rusak Ringan']],
        ['Jumlah Rusak Sedang', result.summary.damageCounts['Rusak Sedang']],
        ['Jumlah Rusak Berat', result.summary.damageCounts['Rusak Berat']],
        ['Prioritas P1 (Mendesak/Kritis)', result.priorityRankings.P1_Mendesak],
        ['Prioritas P2 (Rehabilitasi Sedang)', result.priorityRankings.P2_Rehabilitasi],
        ['Prioritas P3 (Perawatan Rutin)', result.priorityRankings.P3_Pemeliharaan],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

      // Sheet 2: Daftar Prioritas Gedung
      const priorityRows = result.topPriorityBuildings.map((b, idx) => ({
        Ranking: idx + 1,
        'Kode Registrasi': b.code,
        'Nama Gedung': b.buildingName,
        Kategori: b.category,
        Kecamatan: b.kecamatan,
        Desa: b.desa,
        'Klasifikasi Kerusakan': b.damageClassification,
        'Kerusakan Fisik (%)': b.damagePercent,
        'Skor Urgensi (PUPR)': b.urgencyScore,
        'Tingkat Prioritas': b.priorityLabel,
        'Estimasi Biaya Rehab (Rp)': b.rehabCost,
      }));
      const wsPriority = XLSX.utils.json_to_sheet(priorityRows);
      XLSX.utils.book_append_sheet(wb, wsPriority, 'Prioritas Gedung (P1-P3)');

      // Sheet 3: Kerentanan Komponen
      const compRows = result.componentVulnerability.map((c) => ({
        Komponen: c.component,
        Kategori: c.category,
        'Rata-rata Kerusakan (%)': c.averageDamage,
        'Bobot PUPR': c.weight,
        'Indeks Kerentanan': c.vulnerabilityIndex,
      }));
      const wsComp = XLSX.utils.json_to_sheet(compRows);
      XLSX.utils.book_append_sheet(wb, wsComp, 'Kerentanan Komponen');

      // Sheet 4: Rekap Wilayah
      const kecRows = Object.entries(result.kecamatanStats).map(([kec, stat]: [string, any]) => ({
        Kecamatan: kec,
        'Jumlah Gedung': stat.buildingCount,
        'Total Estimasi Biaya (Rp)': stat.totalCost,
        'Rata-rata Kerusakan (%)': stat.averageDamage,
        'Rusak Berat': stat.heavyDamageCount,
        'Rusak Sedang': stat.moderateDamageCount,
        'Rusak Ringan': stat.lightDamageCount,
      }));
      const wsKec = XLSX.utils.json_to_sheet(kecRows);
      XLSX.utils.book_append_sheet(wb, wsKec, 'Rekap per Kecamatan');

      XLSX.writeFile(wb, `Analisis_Python_PUPR_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      alert('Gagal mengekspor data: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Laporan Hasil Analisis Komputasi Python
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-300" />
                  {result.executionTimeMs} ms
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pemodelan statistik dan indeks prioritas rekonstruksi berbasis Permen PUPR No. 22/PRT/M/2018
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Unduh Lembar Excel Lengkap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cetak Laporan"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-950/60 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ringkasan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ringkasan'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Ringkasan & Rekomendasi
            </button>
            <button
              onClick={() => setActiveTab('prioritas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'prioritas'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>Matriks Prioritas (P1-P3)</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[10px]">
                {result.priorityRankings.P1_Mendesak} P1
              </span>
            </button>
            <button
              onClick={() => setActiveTab('komponen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'komponen'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Kerentanan Komponen
            </button>
            <button
              onClick={() => setActiveTab('wilayah')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'wilayah'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Sebaran Kecamatan
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRecompute}
              disabled={isLoading}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Menghitung...' : 'Hitung Ulang'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-900">
          {/* TAB 1: RINGKASAN & REKOMENDASI */}
          {activeTab === 'ringkasan' && (
            <div className="space-y-6">
              {/* Executive Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Total Bangunan</span>
                  <span className="text-2xl font-black text-white mt-1 block">{result.totalBuildings}</span>
                  <span className="text-[11px] text-slate-400">Unit gedung disurvei</span>
                </div>
                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Estimasi Total RAB</span>
                  <span className="text-xl font-black text-amber-400 mt-1 block truncate">
                    {formatRupiah(result.summary.totalCost)}
                  </span>
                  <span className="text-[11px] text-slate-400">HSBGN & 8% Bongkaran</span>
                </div>
                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Rata-rata / Gedung</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block truncate">
                    {formatRupiah(result.summary.meanCost)}
                  </span>
                  <span className="text-[11px] text-slate-400">Mean alokasi rehabilitasi</span>
                </div>
                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
                  <span className="text-xs text-slate-400 uppercase font-semibold block">Tingkat Kerusakan</span>
                  <span className="text-2xl font-black text-rose-400 mt-1 block">
                    {result.summary.averageDamagePercent}%
                  </span>
                  <span className="text-[11px] text-slate-400">Rata-rata degradasi fisik</span>
                </div>
              </div>

              {/* Priority Ratio Banner */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Matriks Prioritas Penanganan PUPR:
                  </span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      P1 Mendesak: {result.priorityRankings.P1_Mendesak} Unit
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      P2 Rehabilitasi: {result.priorityRankings.P2_Rehabilitasi} Unit
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      P3 Pemeliharaan: {result.priorityRankings.P3_Pemeliharaan} Unit
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('prioritas')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  Lihat Daftar Gedung P1 &rarr;
                </button>
              </div>

              {/* Recommendations */}
              <div className="bg-slate-800/60 p-5 rounded-xl border border-slate-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Rekomendasi Algoritma Teknis (Permen PUPR)</span>
                </h4>
                <div className="space-y-2.5">
                  {result.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-700/60 text-xs text-slate-200"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <p className="leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIKS PRIORITAS GEDUNG (P1-P3) */}
          {activeTab === 'prioritas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Daftar Gedung Berdasarkan Urutan Prioritas Urgensi (PUPR)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Skor urgensi dihitung dari bobot kerusakan komponen struktur utama (60%) + kerusakan menyeluruh (40%) + faktor fungsi fasilitas umum.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                {result.topPriorityBuildings.map((b: PriorityBuilding, idx: number) => (
                  <div
                    key={b.id}
                    className="p-4 hover:bg-slate-900/90 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.priorityCode === 'P1_Mendesak'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : b.priorityCode === 'P2_Rehabilitasi'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {b.priorityLabel}
                          </span>
                          <span className="text-[11px] font-bold text-amber-400">
                            Skor Urgensi: {b.urgencyScore}
                          </span>
                        </div>
                        <h5 className="font-bold text-white text-sm mt-1">{b.buildingName}</h5>
                        <p className="text-xs text-slate-400">
                          {b.category} • Kec. {b.kecamatan} {b.desa ? `• Desa ${b.desa}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-xs text-rose-400 font-bold block">
                          Kerusakan: {b.damagePercent}% ({b.damageClassification})
                        </span>
                        <span className="text-xs font-extrabold text-amber-300 block">
                          {formatRupiah(b.rehabCost)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const target = assessments.find((a) => a.id === b.id);
                          if (target) {
                            onClose();
                            onSelectBuilding(target);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>Detail</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: KERENTANAN KOMPONEN */}
          {activeTab === 'komponen' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Indeks Kerentanan Komponen Struktur, Arsitektur & Utilitas</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Menunjukkan elemen fisik bangunan yang paling sering mengalami kerusakan parah di lapangan berdasarkan bobot Permen PUPR.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.componentVulnerability.map((comp) => (
                  <div
                    key={comp.component}
                    className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-white text-sm">{comp.component}</h5>
                        <span className="text-[10px] text-slate-400">
                          Kategori: <strong className="text-slate-200">{comp.category}</strong> (Bobot: {comp.weight * 100}%)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-amber-400 block">
                          Indeks: {comp.vulnerabilityIndex}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Rata-rata: {comp.averageDamage}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          comp.category === 'Struktur'
                            ? 'bg-rose-500'
                            : comp.category === 'Arsitektur'
                            ? 'bg-amber-400'
                            : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.min(100, comp.vulnerabilityIndex * 3.5)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SEBARAN WILAYAH */}
          {activeTab === 'wilayah' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Sebaran Agregat Kerusakan & Anggaran per Kecamatan</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data dikelompokkan berdasarkan wilayah kecamatan untuk prioritas bantuan rehabilitasi daerah.
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="Cari kecamatan..."
                  value={searchKecamatan}
                  onChange={(e) => setSearchKecamatan(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(result.kecamatanStats)
                  .filter(([k]) => k.toLowerCase().includes(searchKecamatan.toLowerCase()))
                  .sort((a, b) => (b[1] as any).totalCost - (a[1] as any).totalCost)
                  .map(([kec, stat]: [string, any]) => (
                    <div
                      key={kec}
                      className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-white text-sm">Kec. {kec}</h5>
                        <span className="text-xs font-extrabold text-amber-400">
                          {stat.buildingCount} Gedung
                        </span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Total RAB: <strong className="text-emerald-400">{formatRupiah(stat.totalCost)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                        <span>Rata-rata: {stat.averageDamage}%</span>
                        <span className="text-rose-400 font-semibold">{stat.heavyDamageCount} Berat</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>
              Engine: <strong className="text-slate-200">{result.engine}</strong> • {result.totalBuildings} unit terproses
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
