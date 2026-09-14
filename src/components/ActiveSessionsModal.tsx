import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveSessionsModal: React.FC<ActiveSessionsModalProps> = ({ isOpen, onClose }) => {
  const { sessionQuotaStatus, activeSessionsList, refreshActiveSessions } = useApp();
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshActiveSessions();
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
      const interval = setInterval(handleRefresh, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeSurveyors = sessionQuotaStatus?.activeSurveyors || 1;
  const maxSurveyorQuota = sessionQuotaStatus?.maxSurveyorQuota || 15;
  const activePriorityUsers = sessionQuotaStatus?.activePriorityUsers || 0;
  const availableSlots = Math.max(0, maxSurveyorQuota - activeSurveyors);
  const percentFilled = Math.min(100, Math.round((activeSurveyors / maxSurveyorQuota) * 100));

  const now = Date.now();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                <span>Status Kuota & Pengguna Aktif</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  Live Monitor
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Informasi perangkat & surveyor yang sedang membuka aplikasi bersamaan (Cloudflare & Multi-Device)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-slate-50">
          {/* Quota Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Surveyor Active */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Surveyor Aktif (Slot)
              </div>
              <div className="text-2xl font-black font-mono text-blue-600 mt-1">
                {activeSurveyors}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {maxSurveyorQuota}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {availableSlots > 0 ? (
                  <span className="text-emerald-600 font-medium">{availableSlots} slot kosong tersedia</span>
                ) : (
                  <span className="text-rose-600 font-bold">Kuota Penuh</span>
                )}
              </div>
            </div>

            {/* Admin / Verifikator Active */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Admin & Verifikator
              </div>
              <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
                {activePriorityUsers}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Akses prioritas tanpa kuota</div>
            </div>

            {/* Quota Percentage */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Kapasitas Terpakai
              </div>
              <div className="text-2xl font-black font-mono text-slate-800 mt-1">
                {percentFilled}%
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full transition-all duration-300 ${
                    percentFilled >= 100
                      ? 'bg-rose-500'
                      : percentFilled > 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${percentFilled}%` }}
                />
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Proteksi Kuota Bersama:</strong> Akun bersama seperti <strong>Kabnagekeo</strong> dapat dibuka oleh banyak surveyor di berbagai perangkat secara bersamaan hingga maksimal <strong>15 surveyor aktif</strong>. Jika pengguna menutup browser atau tidak aktif selama 3 menit, slotnya otomatis dibebaskan ke pengguna lain.
            </div>
          </div>

          {/* Active Sessions List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span>Daftar Perangkat / Sesi yang Sedang Membuka</span>
                <span className="text-[11px] font-mono px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-bold">
                  {activeSessionsList.length || activeSurveyors}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {activeSessionsList.length === 0 ? (
              <div className="p-4 bg-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs bg-blue-100 text-blue-700 border border-blue-300">
                    1
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <span>Perangkat Anda (Sesi Aktif)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Slot Surveyor
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Online terhubung ke sistem</span>
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {activeSessionsList.map((s, idx) => {
                  const secAgo = s.lastHeartbeat ? Math.max(0, Math.round((now - s.lastHeartbeat) / 1000)) : 0;
                  return (
                    <div key={s.sessionId || idx} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            s.isPriority
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              : 'bg-blue-100 text-blue-700 border border-blue-300'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{s.userName || 'Surveyor'}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                s.isPriority
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {s.isPriority ? 'Akses Prioritas' : 'Slot Surveyor'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Peran: <strong className="text-slate-600">{s.role}</strong></span>
                            <span>•</span>
                            <span>Aktif sejak: {s.loginAt ? new Date(s.loginAt).toLocaleTimeString('id-ID') : '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Online {secAgo > 0 ? `(${secAgo}s lalu)` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Sinkronisasi otomatis (Firestore / Cloudflare). Terakhir: <strong className="text-slate-700">{lastUpdated || '-'}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
