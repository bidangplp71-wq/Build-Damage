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
      // 1. Save config locally
      await updateGoogleSheetConfig({
        spreadsheetUrl: spreadsheetUrlInput.trim(),
        webhookUrl: webhookUrlInput.trim(),
      });

      // 2. Fetch users directly
      // Since updateGoogleSheetConfig updates state asynchronously, we temporarily pass the new values inside local storage 
      // or directly rely on context if it handles it.
      // fetchUsersFromSheet uses googleSheetConfig from context. Let's make sure it's synced.
      // To guarantee instant fetch with entered credentials, let's call it after updating.
      // Since fetchUsersFromSheet is an async action in context, we wait a tiny moment or fetch directly
      setTimeout(async () => {
        try {
          const res = await fetchUsersFromSheet();
          setSyncLoading(false);
          if (res.success) {
            setSyncStatus('success');
            setSyncMessage(res.message || 'Berhasil menghubungkan Google Sheet & menyinkronkan akun pengguna!');
            showToast('Google Sheet berhasil dihubungkan!', 'success');
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

      <div className="w-full max-w-md relative z-10 space-y-6">
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

        {/* Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Autentikasi Akun Pengguna</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Masukkan nama pengguna, email, atau email-prefix (username) dan kata sandi Anda.
            </p>
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

          {/* Emergency Bypass / Config Options */}
          <div className="border-t border-slate-800 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setShowEmergencyConfig(!showEmergencyConfig)}
              className="w-full py-2 px-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-between transition-colors font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                <span>Integrasi Google Sheet (Mode Penyelamatan)</span>
              </div>
              <Settings className={`w-3.5 h-3.5 transition-transform ${showEmergencyConfig ? 'rotate-90 text-amber-500' : ''}`} />
            </button>

            {showEmergencyConfig && (
              <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  ⚠️ <strong>Info Limit Firestore:</strong> Jika akun baru Anda belum terbaca di perangkat ini, harap tempel Tautan Google Sheet Anda di bawah ini untuk mengaktifkan sinkronisasi tim langsung ke browser ini.
                </p>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Tautan Google Sheet (Spreadsheet URL)
                    </label>
                    <input
                      type="text"
                      value={spreadsheetUrlInput}
                      onChange={(e) => setSpreadsheetUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                      <span>Tautan Webhook Apps Script (Opsional)</span>
                      <span className="text-[9px] text-slate-600 font-normal">Untuk simpan langsung</span>
                    </label>
                    <input
                      type="text"
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-700"
                    />
                  </div>

                  {syncMessage && (
                    <div className={`p-2 rounded-lg text-[10px] flex items-start gap-1.5 leading-relaxed ${
                      syncStatus === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                      syncStatus === 'error' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                      'bg-slate-900 border border-slate-800 text-slate-400'
                    }`}>
                      {syncStatus === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400 mt-0.5" />}
                      <span>{syncMessage}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={syncLoading}
                    onClick={handleApplySheetConfig}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-600 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    {syncLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyinkronkan Akun...</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Hubungkan & Sinkronkan Akun</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          <p>Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Nagekeo</p>
          <p className="mt-1 text-[10px] text-slate-600">
            Sistem Terproteksi &bull; Enkripsi Sandi &bull; Validasi Akses Peran RBAC
          </p>
        </div>
      </div>
    </div>
  );
};
