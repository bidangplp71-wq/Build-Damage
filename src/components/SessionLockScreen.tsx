import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_LIMITS } from '../types';
import { Lock, KeyRound, ShieldAlert, CheckCircle2, UserCheck } from 'lucide-react';

export const SessionLockScreen: React.FC = () => {
  const { currentUser, isSessionLocked, unlockSession, showToast, switchUserRole } = useApp();
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isSessionLocked) return null;

  const roleConfig = ROLE_LIMITS[currentUser.role];

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMsg('Silakan masukkan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      const res = unlockSession(passwordInput);
      setLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        setPasswordInput('');
      } else {
        setErrorMsg(res.message);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in-95 duration-200">
        {/* User Avatar & Lock Badge */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold text-2xl shadow-xl shadow-amber-500/20">
          {currentUser.name.charAt(0)}
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 border-2 border-amber-500 flex items-center justify-center text-amber-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-1">Sesi Terkunci Otomatis</h2>
          <p className="text-xs text-slate-400">
            Tidak ada aktifitas terdeteksi selama 15 menit. Masukkan kata sandi untuk melanjutkan sesi Anda.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-left">
          <div className="text-xs font-bold text-white">{currentUser.name}</div>
          <div className="text-[11px] text-amber-400 font-medium">{roleConfig.title}</div>
          <div className="text-[10px] text-slate-400 truncate">{currentUser.email}</div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kata Sandi Akun
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Masukkan kata sandi..."
                className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Membuka Kunci...' : 'Buka Kunci Sesi'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
