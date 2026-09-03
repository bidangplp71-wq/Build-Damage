import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserAccount, ROLE_LIMITS } from '../types';
import { decryptPassword } from '../utils/security';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  X,
  Sparkles,
  Info,
  UserCheck,
} from 'lucide-react';

interface PasswordAuthModalProps {
  isOpen: boolean;
  targetUser: UserAccount | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
}) => {
  const { loginWithPassword, currentUser, showToast } = useApp();
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !targetUser) return null;

  const roleConfig = ROLE_LIMITS[targetUser.role];
  const isTargetSuperAdmin = targetUser.role === 'super_admin';
  const isTargetAdmin = targetUser.role === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setErrorMsg('Silakan masukkan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      const result = loginWithPassword(targetUser, passwordInput);
      setLoading(false);

      if (result.success) {
        showToast(result.message, 'success');
        setPasswordInput('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(result.message);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header with Security Badge */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-800 bg-gradient-to-b from-slate-800/80 to-slate-900">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shrink-0 ${
                isTargetSuperAdmin
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                  : isTargetAdmin
                  ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                  : 'bg-slate-700 text-white'
              }`}
            >
              {targetUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-tight">{targetUser.name}</h3>
                {isTargetSuperAdmin && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Otoritas Penuh
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-400 font-medium">{roleConfig.title}</p>
              <p className="text-[11px] text-slate-400 truncate max-w-[260px]">{targetUser.email}</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Security Notice Box */}
          <div
            className={`p-3 rounded-xl border text-xs leading-relaxed ${
              isTargetSuperAdmin
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : isTargetAdmin
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  isTargetSuperAdmin ? 'text-amber-400' : 'text-indigo-400'
                }`}
              />
              <div className="space-y-1">
                <div className="font-semibold text-white text-xs">
                  {isTargetSuperAdmin
                    ? 'Verifikasi Super Administrator'
                    : isTargetAdmin
                    ? 'Verifikasi Kata Sandi Admin Utama'
                    : 'Autentikasi Akun Terenkripsi'}
                </div>
                <div className="text-[11px] text-slate-300">
                  {isTargetSuperAdmin && (
                    <span>
                      Untuk masuk ke akun Super Admin, masukkan kata sandi sistem (Default:{' '}
                      <code className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 font-mono font-bold rounded">
                        simpkbg2026
                      </code>
                      ).
                    </span>
                  )}
                  {isTargetAdmin && (
                    <span>
                      Kata sandi Admin dibuat khusus oleh Super Admin. Kata sandi tersimpan aman
                      secara terenkripsi.
                    </span>
                  )}
                  {!isTargetSuperAdmin && !isTargetAdmin && (
                    <span>
                      Kata sandi untuk peran {roleConfig.title} dikelola oleh Admin / Super Admin.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Password Input Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Masukkan Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Ketik kata sandi akun..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'Sembunyikan' : 'Tampilkan sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Helper for Demo / Authorized Roles */}
          {currentUser.role === 'super_admin' && (
            <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Otoritas Super Admin:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const plain = decryptPassword(targetUser.password || '');
                  setPasswordInput(plain);
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
              >
                Isi Otomatis Sandi
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Memverifikasi...' : 'Masuk Sesi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
