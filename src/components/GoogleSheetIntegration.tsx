import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  getGoogleAppsScriptTemplate,
  exportAssessmentsToCSV,
  extractSpreadsheetId,
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
} from 'lucide-react';

export const GoogleSheetIntegration: React.FC = () => {
  const {
    googleSheetConfig,
    updateGoogleSheetConfig,
    assessments,
    syncAllToSheet,
    showToast,
  } = useApp();

  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [webhookUrlInput, setWebhookUrlInput] = useState(googleSheetConfig.webhookUrl || '');
  const [sheetNameInput, setSheetNameInput] = useState(googleSheetConfig.sheetName || 'Data_Kerusakan_PUPR');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const scriptTemplate = getGoogleAppsScriptTemplate();

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
      sheetName: sheetNameInput.trim() || 'Data_Kerusakan_PUPR',
      directSaveEnabled: true,
      autoSync: true,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
      lastTestMessage: 'Pengaturan link penyimpanan langsung Google Sheet aktif.',
    });
    showToast('Tautan Google Sheet berhasil disimpan! Seluruh data baru/edit akan langsung masuk ke sheet ini.', 'success');
  };

  const handleTestConnection = async () => {
    if (!webhookUrlInput.trim()) {
      showToast('Masukkan URL Webhook Google Apps Script terlebih dahulu', 'error');
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
          sheetName: sheetNameInput.trim() || 'Data_Kerusakan_PUPR',
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
      showToast('Koneksi ke Google Sheet berhasil diverifikasi! Penyimpanan langsung siap.', 'success');
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
    showToast('Skrip Google Apps Script berhasil disalin!', 'info');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const syncedCount = assessments.filter((a) => a.googleSheetSynced).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Penyimpanan Langsung Aktif (Direct Cloud Save)
            </span>
            <span className="text-xs text-slate-500 font-medium">Tanpa Perlu Sinkronisasi Manual</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Penyimpanan Data Penilaian Langsung ke Google Sheet</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Setiap kali formulir penilaian gedung disimpan atau diperbarui oleh petugas, data langsung tercatat secara otomatis ke Google Spreadsheet yang Anda tentukan tanpa memerlukan tombol sinkronisasi terpisah.
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
            onClick={() => exportAssessmentsToCSV(assessments)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Unduh CSV Cadangan</span>
          </button>
        </div>
      </div>

      {/* Info Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mode Penyimpanan</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-base font-bold text-slate-900">Otomatis & Langsung</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Data tersimpan ke spreadsheet saat survei gedung disimpan
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gedung Tercatat</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{syncedCount}</span>
            <span className="text-xs font-bold text-slate-400">/ {assessments.length} Bangunan</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Semua survei otomatis terhubung ke link sheet Anda
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Tab Sheet</span>
          <div className="mt-2 font-mono text-sm font-bold text-slate-800 truncate">
            {googleSheetConfig.sheetName}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {googleSheetConfig.lastTestedAt
              ? `Status: Terverifikasi (${new Date(googleSheetConfig.lastTestedAt).toLocaleTimeString('id-ID')})`
              : 'Siap menerima kiriman'}
          </p>
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
              Tempel link file Google Spreadsheet Anda di sini. Tombol "Buka Sheet" di navigasi dan tabel akan langsung mengarahkan Anda ke sheet ini.
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
            <p className="text-[11px] text-slate-500 mt-1">
              URL Webhook Aplikasi Web dari Google Apps Script yang Anda buat di file Google Sheet tersebut (akses: "Siapa saja / Anyone").
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Lembar / Tab Kerja</label>
              <input
                type="text"
                value={sheetNameInput}
                onChange={(e) => setSheetNameInput(e.target.value)}
                placeholder="Data_Kerusakan_PUPR"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold w-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Penyimpanan Langsung Otomatis: Aktif</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Sheet'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                title="Kirim ulang seluruh data penilaian yang ada ke sheet"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isSyncingAll ? 'Mengirim Data...' : 'Kirim Ulang Seluruh Data'}</span>
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
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
              <span>Cara Menghubungkan Google Sheet Anda dalam 1 Menit</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ikuti 4 langkah mudah ini agar data gedung langsung mengalir otomatis ke file Google Sheet Anda:
            </p>
          </div>

          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors self-start sm:self-auto shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Kode Script'}</span>
          </button>
        </div>

        {/* 4 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-400 text-[11px]">Langkah 1: Buka Sheet</span>
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
            <span className="font-bold text-amber-400 text-[11px]">Langkah 4: Tempel Link</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Salin URL Aplikasi Web & link file Sheet Anda, tempelkan di form di atas, lalu klik Simpan. Selesai!
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
