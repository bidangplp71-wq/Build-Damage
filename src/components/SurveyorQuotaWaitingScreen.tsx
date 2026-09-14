import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  LogOut,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';
import { SessionQuotaStatus } from '../types';

interface SurveyorQuotaWaitingScreenProps {
  quotaStatus: SessionQuotaStatus;
  onRetry: () => Promise<void>;
  onLogout: () => void;
}

export const SurveyorQuotaWaitingScreen: React.FC<SurveyorQuotaWaitingScreenProps> = ({
  quotaStatus,
  onRetry,
  onLogout,
}) => {
  const { currentUser } = useApp();
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Auto-retry countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleCheckSlot();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCheckSlot = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
      setCountdown(10);
    }
  };

  const activeCount = quotaStatus.activeSurveyors || 15;
  const maxQuota = quotaStatus.maxSurveyorQuota || 15;
  const percent = Math.min(100, Math.round((activeCount / maxQuota) * 100));

  return (
    <div
      id="surveyor-quota-waiting-screen"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden"
    >
      {/* Background Decorative Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
        {/* Header Icon & Branding */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Users className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
                <span>Antrean Akses Surveyor</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Proteksi Kuota Sheet
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sistem Penilaian Kerusakan Gedung Pasca Bencana
              </p>
            </div>
          </div>

          <button
            id="btn-quota-waiting-logout"
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            title="Keluar / Ganti Akun"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Ganti Akun</span>
          </button>
        </div>

        {/* User Info Pill */}
        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-blue-400 font-bold text-sm font-mono">
              {currentUser?.name?.slice(0, 2).toUpperCase() || 'SV'}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>{currentUser?.name || 'Surveyor Kabnagekeo'}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {currentUser?.email || 'surveyor'}
                </span>
              </div>
              <div className="text-[11px] text-amber-400 font-medium">
                Status: Menunggu Slot Kosong Tersedia
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kapasitas Slot</div>
            <div className="text-sm font-black font-mono text-amber-300">
              {activeCount} / {maxQuota} Terisi
            </div>
          </div>
        </div>

        {/* Progress & Slot Meter */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Kuota Aktif Bersamaan:
            </span>
            <span className="font-bold font-mono text-amber-400">100% Penuh ({activeCount} Surveyor)</span>
          </div>

          <div className="h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-xs text-slate-300 space-y-2.5 mb-6">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-200">
                Mengapa Akses Dibatasi Maksimal {maxQuota} Pengguna Bersamaan?
              </p>
              <p className="text-slate-300 leading-relaxed text-[11.5px]">
                Untuk menjaga kuota Google Sheet API tidak habis (*Resource Exhausted*) serta mencegah bentrok penulisan saat banyak surveyor menginput serentak, sistem mengalokasikan antrean giliran secara tertib.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-500/20 text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Hak prioritas akses penuh dialokasikan untuk <strong>Super Admin</strong>, <strong>Admin Utama</strong>, dan <strong>Verifikator</strong>.
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3">
          <button
            id="btn-manual-check-slot"
            onClick={handleCheckSlot}
            disabled={checking}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 active:scale-[0.99] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memeriksa Ketersediaan Slot...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Cek Ketersediaan Slot Sekarang</span>
              </>
            )}
          </button>

          <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5 font-mono">
            <Clock className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Pemeriksaan otomatis dalam: <strong className="text-cyan-300 font-bold">{countdown} detik</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
