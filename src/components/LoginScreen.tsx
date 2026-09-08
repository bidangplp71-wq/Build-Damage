import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { isConfiguredSheetUrl } from '../services/googleSheetsService';
import {
  Building2,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Database,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  X,
  Bell,
  Sparkles,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const {
    loginByNamePassword,
    showToast,
    googleSheetConfig,
    updateGoogleSheetConfig,
    fetchUsersFromSheet,
  } = useApp();

  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Emergency Google Sheet Config States
  const [showEmergencyConfig, setShowEmergencyConfig] = useState(false);
  const [spreadsheetUrlInput, setSpreadsheetUrlInput] = useState(googleSheetConfig.spreadsheetUrl || '');
  const [webhookUrlInput, setWebhookUrlInput] = useState(googleSheetConfig.webhookUrl || '');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Nama pengguna/email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await loginByNamePassword(nameInput.trim(), passwordInput);
      setLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Terjadi kesalahan saat memproses login.');
    }
  };

  const handleApplySheetConfig = async () => {
    if (!spreadsheetUrlInput.trim()) {
      setSyncStatus('error');
      setSyncMessage('Tautan Google Sheet tidak boleh kosong.');
      return;
    }

    if (!isConfiguredSheetUrl(spreadsheetUrlInput)) {
      setSyncStatus('error');
      setSyncMessage('Format Tautan Google Sheet tidak valid.');
      return;
    }

    setSyncLoading(true);
    setSyncStatus('idle');
    setSyncMessage('');

    try {
      // 1. Save config locally and upload to Cloud Firestore
      await updateGoogleSheetConfig({
        spreadsheetUrl: spreadsheetUrlInput.trim(),
        webhookUrl: webhookUrlInput.trim(),
      });

      // 2. Fetch users directly
      setTimeout(async () => {
        try {
          const res = await fetchUsersFromSheet();
          setSyncLoading(false);
          if (res.success) {
            setSyncStatus('success');
            setSyncMessage('Koneksi sukses! Pengaturan disimpan di Cloud Firestore. Seluruh pengguna lain di semua perangkat otomatis terhubung tanpa perlu menginput ulang!');
            showToast('Google Sheet berhasil dihubungkan & disimpan ke Cloud Firestore!', 'success');
          } else {
            setSyncStatus('error');
            setSyncMessage(res.message || 'Gagal membaca data dari Google Sheet. Silakan periksa izin akses sheet (Share as Anyone with link can view).');
          }
        } catch (err: any) {
          setSyncLoading(false);
          setSyncStatus('error');
          setSyncMessage(err?.message || 'Gagal menyinkronkan Google Sheet.');
        }
      }, 300);
    } catch (err: any) {
      setSyncLoading(false);
      setSyncStatus('error');
      setSyncMessage(err?.message || 'Gagal menyimpan konfigurasi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Tautan Sistem Tersinkronisasi (Bisa Dicopy oleh User/Admin) */}
        {googleSheetConfig.spreadsheetUrl && (
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl shadow-xl p-5 space-y-4 animate-in fade-in">
            <div className="flex flex-col items-center text-center space-y-1">
              <h3 className="text-xs font-bold text-amber-500 flex items-center justify-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                <span>Informasi Tautan Sistem (Update Konfigurasi)</span>
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Jika terdapat pembaruan data sistem, salin tautan di bawah ini<br/>untuk melakukan <strong>setting ulang Link 1 dan Link 2</strong>.
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1">Link 1: Spreadsheet URL</label>
                <div className="relative group">
                  <input 
                    readOnly 
                    value={googleSheetConfig.spreadsheetUrl}
                    className="w-full pl-3 pr-16 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-300 focus:outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(googleSheetConfig.spreadsheetUrl || '');
                      showToast('Link 1 berhasil disalin ke clipboard!', 'success');
                    }}
                    className="absolute inset-y-1 right-1 px-3 flex items-center text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 cursor-pointer transition-colors"
                  >
                    Salin
                  </button>
                </div>
              </div>
              
              {googleSheetConfig.webhookUrl && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Link 2: Webhook URL</label>
                  <div className="relative group">
                    <input 
                      readOnly 
                      value={googleSheetConfig.webhookUrl}
                      className="w-full pl-3 pr-16 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-300 focus:outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(googleSheetConfig.webhookUrl || '');
                        showToast('Link 2 berhasil disalin ke clipboard!', 'success');
                      }}
                      className="absolute inset-y-1 right-1 px-3 flex items-center text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 cursor-pointer transition-colors"
                    >
                      Salin
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            SIM-PKBG PUPR
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Sistem Informasi Penilaian Kerusakan Bangunan Gedung
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-amber-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Permen PUPR No. 22/PRT/M/2018 &bull; Kabupaten Nagekeo</span>
          </div>
        </div>

        {/* Informasi Pembaruan Sistem (Release Notes) - Disappears once configured */}
        {(!googleSheetConfig.spreadsheetUrl) && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-400/10 to-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-emerald-900/20">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 shadow-inner mt-0.5">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Informasi Pembaruan Sistem</h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Aplikasi telah diperbarui dengan sistem sinkronisasi terbaru. Jika sesi Anda berakhir atau telah <strong>log out</strong>, silakan login kembali.
                </p>
                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-emerald-500/20">
                  <p className="text-[11px] font-bold text-amber-400 mb-1">Bagi Pengguna Baru & Update Konfigurasi Tautan:</p>
                  <ul className="text-[10.5px] text-slate-300 leading-relaxed list-disc list-inside space-y-0.5 ml-0.5">
                    <li>Salin <strong>Link 1 (Spreadsheet)</strong> & <strong>Link 2 (Webhook)</strong> pada bagian informasi di atas.</li>
                    <li>Klik <strong>ikon gerigi (pengaturan)</strong> di sudut kanan atas pada kotak form login di bawah.</li>
                    <li>Tempelkan (paste) link yang telah disalin untuk menyetel ulang sinkronisasi sistem ke database.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative">
          
          {/* Header of Login with discreet settings gear icon */}
          <div className="border-b border-slate-800 pb-4 relative">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Autentikasi Akun Pengguna</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Masukkan nama pengguna, email, atau email-prefix (username) dan kata sandi Anda.
            </p>
            
            {/* Subtle, hidden settings button for Admin only to avoid confusing normal users */}
            <button
              type="button"
              onClick={() => {
                setSyncStatus('idle');
                setSyncMessage('');
                setShowEmergencyConfig(true);
              }}
              title="Konfigurasi Integrasi Google Sheet (Khusus Admin)"
              className="absolute top-0.5 right-0 p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-slate-800/60 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nama Pengguna / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="contoh: bidangplp71 atau email@contoh.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Masukkan kata sandi..."
                  className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMsg}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Memverifikasi Akses...' : 'Masuk Aplikasi'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          <p>Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Nagekeo</p>
          <p className="mt-1 text-[10px] text-slate-600">
            Sistem Terproteksi &bull; Enkripsi Sandi &bull; Validasi Akses Peran RBAC
          </p>
        </div>
      </div>

      {/* SYSTEM INTEGRATION DIALOG (MODAL OVERLAY - EXCLUSIVELY FOR SUPER ADMINS) */}
      {showEmergencyConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 relative space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            
            {/* Modal Title */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-sm font-bold text-white">Konfigurasi Cloud & Google Sheet</h3>
                  <p className="text-[10px] text-amber-400 font-medium">Menu Khusus Super Admin / Dinas PUPR</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmergencyConfig(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanatory text */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Konfigurasi ini digunakan untuk menautkan Google Sheet ke seluruh sistem SIM-PKBG. 
              <strong> Sekali disimpan, pengaturan ini otomatis tersimpan di Cloud Firestore sehingga seluruh perangkat pengguna otomatis terhubung tanpa perlu menginput ulang!</strong>
            </p>

            {/* Inputs Form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Tautan Google Sheet (Spreadsheet URL)
                </label>
                <input
                  type="text"
                  value={spreadsheetUrlInput}
                  onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Tautan Webhook Apps Script (Opsional)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Guna simpan data instan</span>
                </label>
                <input
                  type="text"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-700 font-medium"
                />
              </div>

              {syncMessage && (
                <div className={`p-3 rounded-lg text-[11px] flex items-start gap-2 leading-relaxed ${
                  syncStatus === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                  syncStatus === 'error' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                  'bg-slate-905 border border-slate-800 text-slate-400'
                }`}>
                  {syncStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span>{syncMessage}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmergencyConfig(false)}
                  className="flex-1 py-2 px-3 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={handleApplySheetConfig}
                  className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {syncLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyinkronkan...</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Simpan & Sinkron</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
