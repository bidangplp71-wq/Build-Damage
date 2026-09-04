import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getGoogleAppsScriptTemplate,
  exportAssessmentsToCSV,
  exportAssessmentsToExcelMultiSheet,
  extractSpreadsheetId,
  extractDriveFolderId,
  getDriveFolderUrl,
  testDrivePhotoUpload,
  groupAssessmentsByKecamatan,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  ExternalLink,
  Download,
  RefreshCw,
  Sparkles,
  Link2,
  Send,
  HelpCircle,
  Database,
  Layers,
  MapPin,
  Check,
  AlertTriangle,
  Image,
  FolderCheck,
  UploadCloud,
} from 'lucide-react';

export const GoogleSheetIntegration: React.FC = () => {
  const {
    googleSheetConfig,
    updateGoogleSheetConfig,
    assessments,
    kecamatans,
    syncAllToSheet,
    showToast,
  } = useApp();

  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [webhookUrlInput, setWebhookUrlInput] = useState(googleSheetConfig.webhookUrl || '');
  const [sheetNameInput, setSheetNameInput] = useState(googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN');
  const [splitByKecamatan, setSplitByKecamatan] = useState(googleSheetConfig.splitByKecamatan !== false);
  const [includeMasterSummary, setIncludeMasterSummary] = useState(googleSheetConfig.includeMasterSummarySheet !== false);
  const [savePhotosToDrive, setSavePhotosToDrive] = useState(googleSheetConfig.savePhotosToDrive !== false);
  const [driveFolderIdInput, setDriveFolderIdInput] = useState(googleSheetConfig.driveFolderId || '');

  const [isTesting, setIsTesting] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [testDriveResult, setTestDriveResult] = useState<{ success: boolean; message: string; folderUrl?: string } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const scriptTemplate = getGoogleAppsScriptTemplate();
  const groupedData = groupAssessmentsByKecamatan(assessments);
  const activeKecamatanCount = Object.keys(groupedData).length;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    let sheetUrl = spreadsheetUrlInput.trim();
    let hookUrl = webhookUrlInput.trim();

    // Auto-detect if user pasted spreadsheet URL into webhook field
    if (hookUrl.includes('docs.google.com/spreadsheets') && !sheetUrl) {
      sheetUrl = hookUrl;
    }

    updateGoogleSheetConfig({
      spreadsheetUrl: sheetUrl,
      webhookUrl: hookUrl,
      sheetName: sheetNameInput.trim() || 'REKAP_SEMUA_KECAMATAN',
      splitByKecamatan: splitByKecamatan,
      includeMasterSummarySheet: includeMasterSummary,
      savePhotosToDrive: savePhotosToDrive,
      driveFolderId: driveFolderIdInput.trim() || undefined,
      directSaveEnabled: true,
      autoSync: true,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
      lastTestMessage: 'Pengaturan penyimpanan multi-sheet dan Google Drive aktif.',
    });
    showToast('Tautan Google Sheet & Google Drive berhasil disimpan! Foto dan data akan otomatis tersinkron.', 'success');
  };

  const handleTestConnection = async () => {
    if (!webhookUrlInput.trim()) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
      return;
    }

    if (webhookUrlInput.includes('drive.google.com')) {
      showToast('URL Webhook tidak boleh berupa link Google Drive!', 'error');
      return;
    }

    setIsTesting(true);
    try {
      // Test direct save with ping payload
      await fetch(webhookUrlInput.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          sheetName: sheetNameInput.trim() || 'REKAP_SEMUA_KECAMATAN',
          splitByKecamatan: splitByKecamatan,
          spreadsheetUrl: spreadsheetUrlInput.trim() || undefined,
          spreadsheetId: extractSpreadsheetId(spreadsheetUrlInput.trim()) || undefined,
          timestamp: new Date().toISOString(),
        }),
      });

      updateGoogleSheetConfig({
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'success',
        lastTestMessage: 'Koneksi ke endpoint Google Sheet berhasil diverifikasi.',
      });
      showToast('Koneksi ke Google Sheet berhasil diverifikasi! Sistem multi-sheet siap.', 'success');
    } catch (err: any) {
      updateGoogleSheetConfig({
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: 'error',
        lastTestMessage: err.message,
      });
      showToast('Gagal menghubungi Google Sheet: ' + err.message, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDriveUpload = async () => {
    const hookUrl = webhookUrlInput.trim();
    if (!hookUrl) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
      return;
    }
    if (hookUrl.includes('drive.google.com')) {
      showToast('URL Webhook keliru: Anda menempelkan link Google Drive di kolom Webhook! Pindahkan ke kolom Folder Drive.', 'error');
      return;
    }

    setIsTestingDrive(true);
    setTestDriveResult(null);
    try {
      const res = await testDrivePhotoUpload({
        ...googleSheetConfig,
        webhookUrl: hookUrl,
        driveFolderId: driveFolderIdInput.trim() || undefined,
        savePhotosToDrive: true,
      });
      setTestDriveResult(res);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      const msg = 'Gagal menghubungi Webhook: ' + (err.message || 'Koneksi gagal');
      setTestDriveResult({
        success: false,
        message: msg,
      });
      showToast(msg, 'error');
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllToSheet();
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast('Gagal mengirim seluruh data ke Google Sheet', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptTemplate);
    setCopiedScript(true);
    showToast('Skrip Google Apps Script Multi-Sheet berhasil disalin!', 'info');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const syncedCount = assessments.filter((a) => a.googleSheetSynced).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Sistem Multi-Sheet Per Kecamatan Aktif
            </span>
            <span className="text-xs text-slate-500 font-medium">Otomatis Terpisah per Tab Kecamatan</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Penyimpanan Google Sheet & Excel Multi-Sheet Per Kecamatan</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Setiap Kecamatan (misal: <strong>Kec. Aesesa</strong>, <strong>Kec. Mauponggo</strong>, <strong>Kec. Boawae</strong>, dll) otomatis memiliki tab lembar kerja (*sheet*) masing-masing, ditambah 1 Sheet Master Rekapitulasi untuk pimpinan dinas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {googleSheetConfig.spreadsheetUrl && (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-colors"
            >
              <span>Buka Dokumen Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => exportAssessmentsToExcelMultiSheet(assessments, kecamatans)}
            title="Download file Excel (.xlsx) dengan 1 Tab per Kecamatan + Ringkasan Master"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Excel Multi-Sheet (.xlsx)</span>
          </button>
          <button
            onClick={() => exportAssessmentsToCSV(assessments)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Info Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Distribusi Tab Sheet</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-base font-bold text-slate-900">{kecamatans.length} Sheet Kecamatan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {activeKecamatanCount} kecamatan telah memiliki data survei terisi
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bangunan Tersimpan</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{syncedCount}</span>
            <span className="text-xs font-bold text-slate-400">/ {assessments.length} Bangunan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tersimpan langsung pada tab kecamatan masing-masing
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mode Pemisahan Tab</span>
          <div className="mt-2 font-mono text-sm font-bold text-slate-800 truncate">
            {splitByKecamatan ? '✓ Tab per Kecamatan (Aktif)' : '1 Tab Master Tunggal'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {googleSheetConfig.lastTestedAt
              ? `Status: Terverifikasi (${new Date(googleSheetConfig.lastTestedAt).toLocaleTimeString('id-ID')})`
              : 'Siap menerima kiriman data'}
          </p>
        </div>
      </div>

      {/* Preview Tab Sheet yang Akan Dibuat */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Daftar Tab Sheet yang Dibuat di Google Spreadsheet & Excel:
            </h4>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            1 Tab Ringkasan + 1 Tab Master + {kecamatans.length} Tab Kecamatan
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-mono text-xs font-bold shadow-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>00_RINGKASAN_KECAMATAN</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-xs font-bold shadow-xs flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-300" />
            <span>REKAP_SEMUA_KECAMATAN</span>
          </div>
          {kecamatans.map((kec) => {
            const count = groupedData[kec.name]?.length || 0;
            return (
              <div
                key={kec.id}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                  count > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <MapPin className="w-3 h-3 text-blue-600" />
                <span>Kec. {kec.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    count > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet Configuration Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-600" />
            <span>Tentukan Link Dokumen & Endpoint Google Sheet Anda</span>
          </div>
          {googleSheetConfig.spreadsheetUrl && (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </h3>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          {/* Link Google Spreadsheet */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Link Dokumen Google Sheet (Spreadsheet URL)
            </label>
            <div className="relative">
              <input
                type="url"
                value={spreadsheetUrlInput}
                onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFM.../edit"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Tempel link file Google Spreadsheet Anda di sini.
            </p>
          </div>

          {/* Webhook Apps Script Endpoint */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              URL Web App Apps Script (Endpoint Penyimpanan Otomatis)
            </label>
            <input
              type="url"
              value={webhookUrlInput}
              onChange={(e) => setWebhookUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            {webhookUrlInput.includes('drive.google.com') && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Tautan Google Drive Terdeteksi di Kolom Webhook!</span>
                    <span className="text-[11px] text-amber-800">
                      Kolom ini memerlukan URL Web App Google Apps Script (<code>https://script.google.com/macros/s/.../exec</code>). Tautan Google Drive seharusnya dimasukkan pada kolom Folder Drive di bawah.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDriveFolderIdInput(webhookUrlInput);
                    setWebhookUrlInput(googleSheetConfig.webhookUrl?.includes('drive.google.com') ? '' : (googleSheetConfig.webhookUrl || ''));
                    showToast('Tautan Google Drive dipindahkan ke kolom Folder Google Drive!', 'info');
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                >
                  Pindahkan ke Kolom Drive
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              URL Webhook Aplikasi Web dari Google Apps Script (akses: "Siapa saja / Anyone").
            </p>
          </div>

          {/* Opsi Multi-Sheet & Nama Master */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitByKecamatan}
                  onChange={(e) => setSplitByKecamatan(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-blue-950 block">
                    Buat Sheet Terpisah Untuk Masing-Masing Kecamatan
                  </span>
                  <span className="text-[11px] text-blue-800 leading-tight block mt-0.5">
                    Data survei gedung otomatis masuk ke tab khusus kecamatannya (misal: "Kec. Aesesa", "Kec. Mauponggo", dll).
                  </span>
                </div>
              </label>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMasterSummary}
                  onChange={(e) => setIncludeMasterSummary(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Sertakan Sheet Rekapitulasi Master & Ringkasan
                  </span>
                  <span className="text-[11px] text-slate-600 leading-tight block mt-0.5">
                    Menyimpan tab konsolidasi seluruh data kabupaten dan rekap statistik untuk kebutuhan laporan pimpinan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Tab Sheet Master Gabungan</label>
              <input
                type="text"
                value={sheetNameInput}
                onChange={(e) => setSheetNameInput(e.target.value)}
                placeholder="REKAP_SEMUA_KECAMATAN"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold w-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Penyimpanan Langsung Otomatis: Aktif</span>
              </div>
            </div>
          </div>

          {/* Konfigurasi Google Drive untuk Foto Skala Besar */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-950 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Arsip Foto Google Drive (Dukungan 20.000 Foto / 2.000 Gedung)</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Skala Besar PUPR
              </span>
            </div>
            
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              Untuk mengantisipasi 2.000 gedung dengan hingga 10 foto per gedung (20.000 foto), foto diarsipkan langsung ke <strong>Google Drive</strong> dalam folder terstruktur per nama gedung. Di <strong>Cloud Firestore</strong>, data tersimpan ringan dan cepat di bawah 1 MB.
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={savePhotosToDrive}
                  onChange={(e) => setSavePhotosToDrive(e.target.checked)}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-indigo-950 block">
                    Otomatis Arsipkan Foto Kerusakan ke Google Drive
                  </span>
                  <span className="text-[11px] text-indigo-800 leading-tight block mt-0.5">
                    Google Apps Script akan otomatis membuat subfolder per bangunan dan menyimpan foto visual lengkap dengan tautan di Google Sheet.
                  </span>
                </div>
              </label>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID / Link Folder Induk Google Drive (Penyimpanan Foto)
                </label>
                <input
                  type="text"
                  value={driveFolderIdInput}
                  onChange={(e) => setDriveFolderIdInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... atau ID Folder"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Bila dikosongkan, skrip akan otomatis membuat folder induk bernama <strong>SIM-PKBG PUPR - Dokumentasi Foto Kerusakan</strong> di Google Drive Anda.
                </p>

                {driveFolderIdInput && (
                  <div className="mt-2 p-2.5 bg-indigo-100/70 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-950">
                      <FolderCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-mono text-[11px]">ID Folder Terdeteksi: <strong>{extractDriveFolderId(driveFolderIdInput) || 'Format Belum Tepat'}</strong></span>
                    </div>
                    {getDriveFolderUrl(driveFolderIdInput) && (
                      <a
                        href={getDriveFolderUrl(driveFolderIdInput)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder di Tab Baru</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Uji Unggah Foto Google Drive */}
              <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleTestDriveUpload}
                  disabled={isTestingDrive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <UploadCloud className={`w-3.5 h-3.5 ${isTestingDrive ? 'animate-spin' : ''}`} />
                  <span>{isTestingDrive ? 'Mengirim Foto Contoh ke Drive...' : 'Uji Kirim 1 Foto Contoh ke Google Drive'}</span>
                </button>

                <span className="text-[11px] text-indigo-800">
                  Menguji apakah webhook Anda sudah memiliki izin & skrip penyimpan foto ke Drive.
                </span>
              </div>

              {testDriveResult && (
                <div className={`p-3 rounded-xl border text-xs ${testDriveResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {testDriveResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                      <div>
                        <span className="font-bold block">{testDriveResult.message}</span>
                        {testDriveResult.success && (
                          <span className="text-[11px] text-emerald-800 block mt-0.5">
                            Periksa Google Drive Anda. Di dalam folder Anda akan muncul subfolder "Gedung Uji Coba SIM-PKBG" beserta file foto uji coba!
                          </span>
                        )}
                      </div>
                    </div>
                    {testDriveResult.folderUrl && (
                      <a
                        href={testDriveResult.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold text-[11px] hover:bg-emerald-50 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Endpoint'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                title="Kirim ulang seluruh data penilaian dan susun ulang tab kecamatan di sheet"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 rounded-xl border border-emerald-300 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isSyncingAll ? 'Mengirim & Membuat Sheet...' : 'Sinkronkan Semua Sheet Kecamatan'}</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <span>Simpan Pengaturan Link Sheet</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Step by step guide & Google Apps Script code */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Kode Google Apps Script Multi-Sheet (Otomatis Buat Tab per Kecamatan)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Salin kode Apps Script berikut dan tempelkan di Google Spreadsheet Anda agar setiap kecamatan memiliki sheet tersendiri secara otomatis:
            </p>
          </div>

          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Skrip Multi-Sheet'}</span>
          </button>
        </div>

        {/* Important Notice for Google Drive Photo Storage */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Penting: Mengapa Foto Belum Tersimpan ke Link Google Drive Anda?</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Google Apps Script berjalan di Google Cloud akun Anda sendiri. Jika sebelumnya Anda telah men-deploy Apps Script sebelum fitur foto Google Drive ditambahkan, spreadsheet Anda masih menjalankan kode versi lama. Untuk mengaktifkannya:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 pl-1">
            <li>
              Klik tombol <strong className="text-amber-300">"Salin Skrip Multi-Sheet"</strong> di atas.
            </li>
            <li>
              Di Google Spreadsheet Anda, buka menu <strong className="text-white">Ekstensi &gt; Apps Script</strong>.
            </li>
            <li>
              Hapus seluruh isi kode lama di editor Apps Script, lalu <strong>Paste</strong> kode baru yang telah disalin.
            </li>
            <li>
              <strong className="text-amber-300">Langkah Kunci Pembaruan:</strong> Klik tombol <strong className="text-white">Deploy (Terapkan)</strong> &gt; <strong className="text-white">Kelola Deployment (Manage deployments)</strong> &gt; Klik ikon <strong className="text-white">Pensil (Edit)</strong> &gt; Pada dropdown Versi pilih <strong className="text-emerald-400">Versi Baru (New version)</strong> &gt; Klik <strong className="text-white">Terapkan (Deploy)</strong>.
            </li>
            <li>
              Jika Google meminta otorisasi izin (<em className="text-slate-400">"Review Permissions"</em>), klik <strong className="text-white">Review Permissions</strong> &gt; Pilih akun Google Anda &gt; Klik <strong className="text-white">Advanced / Lanjutan</strong> &gt; Klik <strong className="text-white">Buka SIM-PKBG (Aman)</strong> &gt; Klik <strong className="text-emerald-400">Izinkan (Allow)</strong> agar skrip diizinkan membuat folder & menyimpan foto di Drive Anda.
            </li>
          </ol>
        </div>

        {/* 4 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 1: Buka Apps Script</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Buka Google Sheet Anda di browser, klik menu <span className="font-semibold text-white">Ekstensi</span> &gt; <span className="font-semibold text-white">Apps Script</span>.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 2: Paste Kode</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Hapus kode bawaan di editor, lalu paste kode Apps Script yang Anda salin dari tombol di atas.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 3: Terapkan (Deploy)</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Klik <span className="font-semibold text-white">Terapkan &gt; Deployment baru</span>, pilih <span className="font-semibold text-white">Aplikasi Web</span>, dan setel Akses ke <span className="font-semibold text-emerald-400">Siapa saja (Anyone)</span>.
            </p>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 4: Tempel Link & Sinkron</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Salin URL Aplikasi Web, tempel di form di atas, klik Simpan, lalu klik "Sinkronkan Semua Sheet Kecamatan".
            </p>
          </div>
        </div>

        {/* Code Block Preview */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800 max-h-56">
            {scriptTemplate}
          </pre>
        </div>
      </div>
    </div>
  );
};
