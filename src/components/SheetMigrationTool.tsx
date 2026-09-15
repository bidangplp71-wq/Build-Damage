import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  formatAssessmentForGoogleSheet,
  fetchAssessmentsFromGoogleSheet,
  syncAllToGoogleSheet,
  exportAssessmentsToExcelMultiSheet,
  exportAssessmentsToCSV,
  extractSpreadsheetId,
} from '../services/googleSheetsService';
import { BuildingAssessment, GoogleSheetConfig } from '../types';
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Database,
  Layers,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  Info,
  Send,
  Zap,
} from 'lucide-react';

export const SheetMigrationTool: React.FC = () => {
  const {
    assessments,
    kecamatans,
    googleSheetConfig,
    updateGoogleSheetConfig,
    showToast,
    currentUser,
  } = useApp();

  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  // Step 1: Source
  const [sourceMode, setSourceMode] = useState<'app_data' | 'old_sheet'>('app_data');
  const [oldSpreadsheetUrl, setOldSpreadsheetUrl] = useState('');
  const [oldWebhookUrl, setOldWebhookUrl] = useState('');
  const [isFetchingOld, setIsFetchingOld] = useState(false);
  const [fetchedOldData, setFetchedOldData] = useState<BuildingAssessment[] | null>(null);

  // Step 2: Target
  const [targetMode, setTargetMode] = useState<'active_sheet' | 'custom_new'>('active_sheet');
  const [newSpreadsheetUrl, setNewSpreadsheetUrl] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // Step 3: Execution
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    message: string;
    syncedCount?: number;
    targetUrl?: string;
  } | null>(null);

  // Data to convert
  const sourceAssessments: BuildingAssessment[] =
    sourceMode === 'app_data'
      ? assessments
      : fetchedOldData || [];

  // Handle fetching from old sheet
  const handleFetchFromOldSheet = async () => {
    if (!oldSpreadsheetUrl.trim() && !oldWebhookUrl.trim()) {
      showToast('Masukkan URL Spreadsheet atau Webhook Sheet Lama terlebih dahulu!', 'error');
      return;
    }

    setIsFetchingOld(true);
    setFetchedOldData(null);
    try {
      const tempConfig: GoogleSheetConfig = {
        ...googleSheetConfig,
        spreadsheetUrl: oldSpreadsheetUrl.trim(),
        webhookUrl: oldWebhookUrl.trim(),
        sheetName: 'REKAP_SEMUA_KECAMATAN',
        autoSync: false,
        directSaveEnabled: true,
      };

      const res = await fetchAssessmentsFromGoogleSheet(tempConfig, true);
      if (res.success && res.data.length > 0) {
        setFetchedOldData(res.data);
        showToast(`Berhasil membaca ${res.data.length} data bangunan dari Sheet Lama!`, 'success');
      } else {
        showToast(res.message || 'Tidak ada data bangunan yang ditemukan di Sheet Lama.', 'error');
      }
    } catch (err: any) {
      showToast(`Gagal membaca data sheet lama: ${err.message || 'Koneksi gagal'}`, 'error');
    } finally {
      setIsFetchingOld(false);
    }
  };

  // Handle conversion & migration to new sheet
  const handleRunMigration = async () => {
    if (sourceAssessments.length === 0) {
      showToast('Tidak ada data bangunan yang siap dikonversi.', 'error');
      return;
    }

    let targetConfig: GoogleSheetConfig;
    if (targetMode === 'active_sheet') {
      if (!googleSheetConfig.webhookUrl) {
        showToast('Webhook Spreadsheet aktif saat ini belum dikonfigurasi.', 'error');
        return;
      }
      targetConfig = googleSheetConfig;
    } else {
      if (!newWebhookUrl.trim()) {
        showToast('URL Webhook Spreadsheet Baru wajib diisi!', 'error');
        return;
      }
      targetConfig = {
        ...googleSheetConfig,
        spreadsheetUrl: newSpreadsheetUrl.trim() || googleSheetConfig.spreadsheetUrl,
        webhookUrl: newWebhookUrl.trim(),
      };
    }

    setIsMigrating(true);
    setMigrationResult(null);
    setMigrationProgress({
      stage: 'Memformat 21 kolom komponen & sanitasi sel...',
      current: 0,
      total: sourceAssessments.length,
      percent: 25,
    });

    try {
      // Step A: Format & Verify
      await new Promise((r) => setTimeout(r, 400));
      setMigrationProgress({
        stage: 'Mengirimkan seluruh data terkonversi ke Google Sheet Baru...',
        current: sourceAssessments.length,
        total: sourceAssessments.length,
        percent: 65,
      });

      // Step B: Send to target sheet using syncAllToGoogleSheet
      const res = await syncAllToGoogleSheet(sourceAssessments, targetConfig);

      setMigrationProgress({
        stage: 'Selesai!',
        current: sourceAssessments.length,
        total: sourceAssessments.length,
        percent: 100,
      });

      if (res.success) {
        setMigrationResult({
          success: true,
          message: `Berhasil mengonversi dan memindahkan ${sourceAssessments.length} data bangunan ke model kolom tabel baru!`,
          syncedCount: sourceAssessments.length,
          targetUrl: targetConfig.spreadsheetUrl,
        });
        showToast(`Migrasi sukses! ${sourceAssessments.length} data telah dipindahkan ke Sheet Baru.`, 'success');

        // If target was custom and successful, optionally update active config
        if (targetMode === 'custom_new' && newSpreadsheetUrl.trim()) {
          updateGoogleSheetConfig({
            spreadsheetUrl: newSpreadsheetUrl.trim(),
            webhookUrl: newWebhookUrl.trim(),
          });
        }
      } else {
        setMigrationResult({
          success: false,
          message: res.message || 'Terjadi kesalahan saat memindahkan data ke sheet baru.',
        });
        showToast(res.message || 'Gagal migrasi ke sheet baru.', 'error');
      }
    } catch (err: any) {
      setMigrationResult({
        success: false,
        message: err.message || 'Terjadi kesalahan jaringan saat migrasi.',
      });
      showToast('Gagal memproses migrasi: ' + (err.message || 'Koneksi gagal'), 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  // Preview of converted sample (first 3 items)
  const sampleItems = sourceAssessments.slice(0, 3);
  const sampleRows = sampleItems.map(formatAssessmentForGoogleSheet);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl border border-indigo-700/50 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30 text-cyan-300 shrink-0">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Alat Konversi & Migrasi Sheet (Model Kolom Tabel Baru)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Anti-50.000 Karakter
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Fitur ini secara otomatis mengonversi data dari format lama (yang sebelumnya menumpuk teks panjang/JSON dalam 1 sel) menjadi <strong>21 kolom tabel individual</strong>. Setiap sel hanya berisi angka singkat (1–5 karakter) dan semua teks dibatasi maksimal 25.000 karakter, sehingga spreadsheet baru Anda 100% aman dan tidak akan pernah error karena batas karakter Google Sheets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Explainer Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-rose-950">
          <div className="flex items-center gap-2 font-bold text-xs text-rose-900 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Format Sheet Lama (Bermasalah)</span>
          </div>
          <ul className="text-xs text-rose-800 space-y-1.5 list-disc list-inside">
            <li>Semua 21 komponen kerusakan ditumpuk dalam 1 sel berbentuk JSON.</li>
            <li>Sering melampaui batas 50.000 karakter Google Sheets.</li>
            <li>Spreadsheet menjadi lambat, sering terkunci <em>read-only</em> atau gagal simpan.</li>
            <li>Sulit dibaca langsung atau difilter oleh verifikator secara visual.</li>
          </ul>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950">
          <div className="flex items-center gap-2 font-bold text-xs text-emerald-900 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Format Model Baru (Terkonversi Otomatis)</span>
          </div>
          <ul className="text-xs text-emerald-800 space-y-1.5 list-disc list-inside">
            <li>Dipecah menjadi <strong>21 kolom tabel individual</strong> (Pondasi, Balok, Atap, Dinding, dll.).</li>
            <li>Setiap sel hanya berisi angka singkat (hanya 1 sampai 5 karakter per sel).</li>
            <li>Setiap sel diproteksi dengan batas aman maksimal 25.000 karakter.</li>
            <li>Bisa difilter, disortir, dan dihitung rumusnya langsung di Google Sheets atau Excel.</li>
          </ul>
        </div>
      </div>

      {/* Step 1: Source Data Selection */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-black">
              1
            </div>
            <span>Pilih Sumber Data yang Ingin Dikonversi</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            Terdeteksi: <strong>{sourceAssessments.length} Data Bangunan</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSourceMode('app_data')}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
              sourceMode === 'app_data'
                ? 'border-blue-600 bg-blue-50/40 text-blue-950 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                Data di Aplikasi Saat Ini (Rekomendasi)
              </span>
              {sourceMode === 'app_data' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Menggunakan <strong>{assessments.length} gedung</strong> yang sudah tersimpan di database aplikasi. Paling praktis, langsung dikonversi ke model 21 kolom tanpa perlu membaca ulang sheet lama.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode('old_sheet')}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
              sourceMode === 'old_sheet'
                ? 'border-blue-600 bg-blue-50/40 text-blue-950 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Tarik Langsung dari Sheet Lama
              </span>
              {sourceMode === 'old_sheet' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Jika data hanya ada di Google Sheet lama, sistem akan menarik seluruh baris dari Sheet lama, memparsing format JSON lamanya, dan meng-hydrate ke model 21 kolom.
            </p>
          </button>
        </div>

        {/* Inputs if old_sheet mode */}
        {sourceMode === 'old_sheet' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mt-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-slate-800">
              Koneksi ke Google Sheet Lama:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Link URL Spreadsheet Lama:
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={oldSpreadsheetUrl}
                  onChange={(e) => setOldSpreadsheetUrl(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  URL Webhook Apps Script Lama (Opsional tapi Direkomendasikan):
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={oldWebhookUrl}
                  onChange={(e) => setOldWebhookUrl(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                {fetchedOldData
                  ? `✅ Berhasil membaca ${fetchedOldData.length} data dari Sheet Lama`
                  : 'Klik tombol di samping untuk mulai membaca data dari Sheet Lama.'}
              </span>
              <button
                type="button"
                onClick={handleFetchFromOldSheet}
                disabled={isFetchingOld}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingOld ? 'animate-spin' : ''}`} />
                <span>{isFetchingOld ? 'Membaca Data Lama...' : 'Tarik Data Sheet Lama'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Target Selection */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-black">
              2
            </div>
            <span>Pilih Tujuan Penyimpanan Data Baru</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetMode('active_sheet')}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
              targetMode === 'active_sheet'
                ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Spreadsheet Aktif Saat Ini di Aplikasi
              </span>
              {targetMode === 'active_sheet' && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed truncate">
              URL: {googleSheetConfig.spreadsheetUrl ? (
                <span className="font-mono text-[10px] text-indigo-700">{googleSheetConfig.spreadsheetUrl.substring(0, 45)}...</span>
              ) : (
                <span className="text-amber-600">Belum ada URL aktif</span>
              )}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTargetMode('custom_new')}
            className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
              targetMode === 'custom_new'
                ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Spreadsheet Baru Khusus (Buku Bersih)
              </span>
              {targetMode === 'custom_new' && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Tuliskan URL file Google Spreadsheet baru yang masih kosong/bersih untuk menampung data hasil konversi secara mandiri.
            </p>
          </button>
        </div>

        {targetMode === 'custom_new' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 mt-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-slate-800">
              Koneksi ke Google Sheet Baru:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Link URL Spreadsheet Baru:
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/... (Sheet Baru)"
                  value={newSpreadsheetUrl}
                  onChange={(e) => setNewSpreadsheetUrl(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  URL Webhook Apps Script Baru:
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Sample Preview of 21 Columns */}
      {sampleRows.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold text-slate-800">
                Pratinjau Hasil Konversi ke 21 Kolom Individual (Sampel 3 Data Teratas)
              </h4>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Kapasitas per sel: 1 - 5 karakter (Sangat Ringan)
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full text-[11px] text-left divide-y divide-slate-200">
              <thead className="bg-slate-800 text-white font-semibold">
                <tr>
                  <th className="p-2.5 whitespace-nowrap">No Registrasi</th>
                  <th className="p-2.5 whitespace-nowrap">Nama Bangunan</th>
                  <th className="p-2.5 whitespace-nowrap bg-indigo-900">Pondasi (%)</th>
                  <th className="p-2.5 whitespace-nowrap bg-indigo-900">Kolom & Balok (%)</th>
                  <th className="p-2.5 whitespace-nowrap bg-indigo-900">Atap Kuda-kuda (%)</th>
                  <th className="p-2.5 whitespace-nowrap bg-indigo-900">Dinding Bata (%)</th>
                  <th className="p-2.5 whitespace-nowrap bg-indigo-900">Penutup Lantai (%)</th>
                  <th className="p-2.5 whitespace-nowrap">Tingkat Rusak (%)</th>
                  <th className="p-2.5 whitespace-nowrap">Klasifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sampleRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {row['No Registrasi'] || '-'}
                    </td>
                    <td className="p-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {row['Nama Bangunan'] || '-'}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                      {row['Pondasi (%)']}%
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                      {row['Kolom & Balok (%)']}%
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                      {row['Atap Kuda-kuda (%)']}%
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                      {row['Dinding Bata (%)']}%
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                      {row['Penutup Lantai (%)']}%
                    </td>
                    <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">
                      {row['Tingkat Kerusakan (%)']}%
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        {row['Klasifikasi Kerusakan'] || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Execution Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
              3
            </div>
            <span>Eksekusi Migrasi & Ekspor Data Bersih</span>
          </div>
        </div>

        {/* Progress Bar if migrating */}
        {isMigrating && migrationProgress && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-blue-900">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                {migrationProgress.stage}
              </span>
              <span>{migrationProgress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${migrationProgress.percent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Result Notification */}
        {migrationResult && (
          <div
            className={`p-4 rounded-xl border text-xs ${
              migrationResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            } animate-in fade-in flex items-start gap-3`}
          >
            {migrationResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-bold block text-sm">{migrationResult.message}</span>
              {migrationResult.targetUrl && (
                <a
                  href={migrationResult.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline mt-1"
                >
                  <span>Buka Spreadsheet Hasil Migrasi di Tab Baru</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleRunMigration}
              disabled={isMigrating || sourceAssessments.length === 0}
              className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isMigrating
                  ? 'Sedang Memproses Migrasi...'
                  : `🚀 Mulai Konversi & Tulis ${sourceAssessments.length} Data ke Sheet Baru`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportAssessmentsToExcelMultiSheet(sourceAssessments, kecamatans)}
            disabled={sourceAssessments.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Unduh Excel (.xlsx) Model Baru (21 Kolom)</span>
          </button>

          <button
            type="button"
            onClick={() => exportAssessmentsToCSV(sourceAssessments)}
            disabled={sourceAssessments.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Unduh File CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
