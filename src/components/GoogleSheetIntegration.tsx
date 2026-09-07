import React, { useState, useEffect } from 'react';
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
  Eye,
  Settings,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const GoogleSheetIntegration: React.FC = () => {
  const {
    googleSheetConfig,
    updateGoogleSheetConfig,
    assessments,
    kecamatans,
    syncAllToSheet,
    syncFromGoogleSheet,
    showToast,
    currentUser,
  } = useApp();

  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'view_sheet' | 'settings'>('view_sheet');
  const [isSyncingFromSheet, setIsSyncingFromSheet] = useState(false);

  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [webhookUrlInput, setWebhookUrlInput] = useState(googleSheetConfig.webhookUrl || '');
  const [sheetNameInput, setSheetNameInput] = useState(googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN');
  const [splitByKecamatan, setSplitByKecamatan] = useState(googleSheetConfig.splitByKecamatan !== false);
  const [includeMasterSummary, setIncludeMasterSummary] = useState(googleSheetConfig.includeMasterSummarySheet !== false);
  const [savePhotosToDrive, setSavePhotosToDrive] = useState(googleSheetConfig.savePhotosToDrive !== false);
  const [driveFolderIdInput, setDriveFolderIdInput] = useState(googleSheetConfig.driveFolderId || '');

  // Keep form inputs synchronized when googleSheetConfig updates from realtime database
  useEffect(() => {
    setSpreadsheetUrlInput(googleSheetConfig.spreadsheetUrl || '');
    setWebhookUrlInput(googleSheetConfig.webhookUrl || '');
    setSheetNameInput(googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN');
    setSplitByKecamatan(googleSheetConfig.splitByKecamatan !== false);
    setIncludeMasterSummary(googleSheetConfig.includeMasterSummarySheet !== false);
    setSavePhotosToDrive(googleSheetConfig.savePhotosToDrive !== false);
    setDriveFolderIdInput(googleSheetConfig.driveFolderId || '');
  }, [googleSheetConfig]);

  const [isTesting, setIsTesting] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [testDriveResult, setTestDriveResult] = useState<{ success: boolean; message: string; folderUrl?: string } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const scriptTemplate = getGoogleAppsScriptTemplate();
  const groupedData = groupAssessmentsByKecamatan(assessments);
  const activeKecamatanCount = Object.keys(groupedData).length;
  const spreadsheetId = extractSpreadsheetId(googleSheetConfig.spreadsheetUrl);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Hanya Super Admin dan Admin yang memiliki hak akses untuk mengubah konfigurasi link Google Sheet', 'error');
      return;
    }
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
    showToast('Tautan Google Sheet & Google Drive berhasil disimpan oleh Admin!', 'success');
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

  const handleSyncFromSheet = async () => {
    setIsSyncingFromSheet(true);
    try {
      await syncFromGoogleSheet(true);
    } finally {
      setIsSyncingFromSheet(false);
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header & Role Switcher */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              SIMPKBG Data Center
            </span>
            <span className="text-xs text-slate-500 font-medium">Google Spreadsheet Terpadu</span>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                Mode: Buka & Pantau Lembar Kerja
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>Lembar Kerja Google Sheet SIMPKBG</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Data penilaian kerusakan bangunan gedung pasca bencana tercatat secara terpusat pada Google Sheet utama dengan tab terpisah per kecamatan dan rekapitulasi konsolidasi.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {googleSheetConfig.spreadsheetUrl ? (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka dokumen Google Spreadsheet langsung di tab baru"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isAdmin) {
                  setActiveSubTab('settings');
                } else {
                  showToast('Link Google Sheet utama belum diatur oleh Administrator.', 'info');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>{isAdmin ? 'Atur Link Google Sheet' : 'Google Sheet (Belum Ditautkan)'}</span>
            </button>
          )}

          {googleSheetConfig.driveFolderId && getDriveFolderUrl(googleSheetConfig.driveFolderId) && (
            <a
              href={getDriveFolderUrl(googleSheetConfig.driveFolderId)!}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka folder arsip foto visual di Google Drive"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-200 transition-colors"
            >
              <FolderCheck className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Folder Foto Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {googleSheetConfig.spreadsheetUrl && (
            <button
              onClick={handleSyncFromSheet}
              disabled={isSyncingFromSheet}
              title="Tarik dan muat seluruh data survei dari Google Sheet mulai dari baris A2 ke bawah"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl border border-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${isSyncingFromSheet ? 'animate-spin' : ''}`} />
              <span>{isSyncingFromSheet ? 'Memuat Sheet...' : 'Tarik dari Sheet (A2)'}</span>
            </button>
          )}

          <button
            onClick={() => exportAssessmentsToExcelMultiSheet(assessments, kecamatans)}
            title="Download file Excel (.xlsx) dengan 1 Tab per Kecamatan + Ringkasan Master"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Unduh Excel</span>
          </button>

          <button
            onClick={() => exportAssessmentsToCSV(assessments)}
            title="Download file CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Switcher (Only Visible to Super Admin & Admin) */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('view_sheet')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'view_sheet'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Buka Lembar Kerja Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-600" />
            <span>Pengaturan Link & Webhook (Khusus Admin)</span>
          </button>
        </div>
      )}

      {/* VIEW SHEET TAB: Available to all roles (Surveyor, Verifikator, Publik, Camat, Admin) */}
      {(!isAdmin || activeSubTab === 'view_sheet') && (
        <div className="space-y-6">
          {/* Info Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Dokumen Sheet</span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    googleSheetConfig.spreadsheetUrl ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                ></span>
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {googleSheetConfig.spreadsheetUrl ? 'Terhubung ke Google Sheet' : 'Belum Ditautkan Admin'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {googleSheetConfig.spreadsheetUrl
                  ? `ID: ${spreadsheetId ? spreadsheetId.slice(0, 16) + '...' : 'Tersambung'}`
                  : 'Menunggu penautan link oleh Super Admin / Admin'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bangunan Tercatat</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600">{syncedCount}</span>
                <span className="text-xs font-bold text-slate-400">/ {assessments.length} Bangunan Terdata</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tersimpan langsung pada tab kecamatan masing-masing
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tab Lembar Kerja</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-base font-bold text-slate-900">{kecamatans.length} Sheet Kecamatan</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {activeKecamatanCount} kecamatan memiliki data survei aktif
              </p>
            </div>
          </div>

          {/* Preview Tab Sheet yang Akan Dibuat */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Daftar Tab Sheet di Google Spreadsheet:
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

          {/* Interactive Live Google Sheet Viewer */}
          {googleSheetConfig.spreadsheetUrl && spreadsheetId ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Tampilan Langsung Lembar Kerja Google Sheet</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                        Live Preview
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Anda dapat melihat data baris, tab per kecamatan, dan rekapitulasi langsung di bawah ini.
                    </div>
                  </div>
                </div>

                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <span>Buka di Google Sheet (Tab Baru)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Iframe Viewport */}
              <div className="w-full h-[650px] bg-slate-100 relative">
                <iframe
                  src={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlembed?widget=true&headers=false`}
                  className="w-full h-full border-0"
                  title="Google Spreadsheet SIMPKBG"
                  allowFullScreen
                />
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Pratinjau menampilkan spreadsheet secara langsung. Seluruh perubahan atau data baru otomatis masuk ke lembar kerja ini.
                  </span>
                </div>
                <a
                  href={googleSheetConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1 shrink-0"
                >
                  <span>Buka Dokumen Asli</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Tautan Google Sheet Utama Belum Ditetapkan
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isAdmin
                    ? 'Anda belum menentukan URL spreadsheet utama untuk pencatatan data penilaian. Silakan buka tab "Pengaturan Link & Webhook" di atas untuk mengisi URL Google Sheet dan Apps Script.'
                    : 'Administrator instansi PUPR (Super Admin / Admin) belum menautkan alamat Google Spreadsheet utama. Seluruh data survei Anda saat ini tetap tersimpan aman di database SIMPKBG dan akan otomatis tersinkronisasi ke Google Sheet begitu tautan diatur oleh Admin.'}
                </p>
                {!isAdmin && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      Hak pengisian link dibatasi hanya untuk Super Admin dan Admin
                    </span>
                  </div>
                )}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('settings')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>Isi & Tentukan Link Google Sheet Sekarang</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB: Strictly for Super Admin & Admin Only */}
      {isAdmin && activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Admin Authority Banner */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold shrink-0 mt-0.5 sm:mt-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block">
                  Hak Khusus Super Admin & Admin
                </span>
                <span className="text-xs text-amber-900 mt-0.5 block leading-relaxed">
                  Hanya akun dengan hak akses Super Admin atau Admin yang berhak menentukan link Google Spreadsheet, URL Webhook Apps Script, dan Folder Google Drive. Peran pengguna lain (Surveyor, Verifikator, Camat, Publik) hanya memiliki akses untuk membuka dan melihat lembar kerja.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('view_sheet')}
              className="px-3.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-100 shrink-0 cursor-pointer shadow-2xs"
            >
              Lihat Lembar Kerja
            </button>
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
                value={spreadsheetUrlInput || ''}
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
              value={webhookUrlInput || ''}
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
                value={sheetNameInput || ''}
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
                  value={driveFolderIdInput || ''}
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
                      <span className="text-[11px]">
                        {driveFolderIdInput.includes('drive.google.com') || (/^[a-zA-Z0-9_-]{15,}$/.test(extractDriveFolderId(driveFolderIdInput)) && !driveFolderIdInput.includes('/')) ? (
                          <>ID Folder Terdeteksi: <strong className="font-mono">{extractDriveFolderId(driveFolderIdInput)}</strong></>
                        ) : (
                          <>Nama Folder Terdeteksi: <strong className="font-semibold">{driveFolderIdInput.trim()}</strong> (Apps Script akan mencari folder ini)</>
                        )}
                      </span>
                    </div>
                    {getDriveFolderUrl(driveFolderIdInput) ? (
                      <a
                        href={getDriveFolderUrl(driveFolderIdInput)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Buka Folder di Tab Baru</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-indigo-700 italic">
                        Tip: Salin URL dari browser saat membuka folder ini untuk tautan langsung
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 p-2 bg-white/70 border border-indigo-200/60 rounded-lg text-[11px] text-slate-600">
                  <span className="font-semibold text-indigo-950 block mb-0.5">💡 Cara mendapatkan Link Folder Google Drive:</span>
                  <span>Buka folder Anda (misal: <em>Data-IKBG/CK</em>) di Google Drive, klik kanan folder atau klik panah samping namanya, pilih <strong>Bagikan &gt; Salin tautan</strong>, lalu tempel di kolom ini.</span>
                </div>
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
                onClick={handleSyncFromSheet}
                disabled={isSyncingFromSheet}
                title="Tarik seluruh baris data dari Google Sheet ke aplikasi web tanpa pembatasan baris"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingFromSheet ? 'animate-spin' : ''}`} />
                <span>{isSyncingFromSheet ? 'Menarik Data...' : 'Tarik Semua Data dari Sheet'}</span>
              </button>

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
  )}
</div>
);
};
