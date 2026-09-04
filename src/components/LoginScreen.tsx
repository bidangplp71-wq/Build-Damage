import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { INITIAL_USERS } from '../data/initialData';
import { ROLE_LIMITS, UserRole } from '../types';
import {
  Building2,
  Lock,
  User,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Info,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { loginByNamePassword, showToast } = useApp();
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !passwordInput.trim()) {
      setErrorMsg('Nama pengguna/email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      const res = loginByNamePassword(nameInput.trim(), passwordInput);
      setLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        setErrorMsg(res.message);
      }
    }, 250);
  };

  const handleQuickDemo = (name: string, pass: string) => {
    setNameInput(name);
    setPasswordInput(pass);
    setErrorMsg('');
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
              Masukkan nama pengguna, email, dan kata sandi sesuai peran fungsional Anda.
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
                  placeholder="contoh: Vancy Djogo atau email@contoh.com"
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

          {/* Quick Demo Accounts Helper */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Contoh Akun Pengguna Terdaftar (Klik untuk uji cepat):</span>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {INITIAL_USERS.map((u) => {
                const roleConf = ROLE_LIMITS[u.role];
                let defaultPass = 'simpkbg2026';
                if (u.role === 'admin') defaultPass = 'adminpupr2026';
                if (u.role === 'admin_verifikator') defaultPass = 'tabgpupr2026';
                if (u.role === 'admin_user') defaultPass = 'surveyor2026';
                if (u.role === 'admin_publik') defaultPass = 'publik2026';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemo(u.name, defaultPass)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate group-hover:text-amber-400 transition-colors">
                        {u.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {u.email}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 border border-slate-800 shrink-0 font-medium">
                      {roleConf.title}
                    </span>
                  </button>
                );
              })}
            </div>
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
