import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, CheckCircle2, Database, Building2, Layers, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export const SheetSyncProgressBanner: React.FC = () => {
  const { sheetSyncProgress } = useApp();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCompletedBanner, setShowCompletedBanner] = useState(false);
  const [lastFinishedCount, setLastFinishedCount] = useState<number>(0);

  // Trigger completion state and lingering countdown when loading finishes
  useEffect(() => {
    if (!sheetSyncProgress) return;

    if (sheetSyncProgress.isLoading) {
      setIsDismissed(false);
      setShowCompletedBanner(false);
    } else if (sheetSyncProgress.percent >= 100 || (!sheetSyncProgress.isLoading && sheetSyncProgress.totalLoaded > 0 && sheetSyncProgress.currentStep > 0)) {
      setLastFinishedCount(sheetSyncProgress.totalLoaded);
      setShowCompletedBanner(true);
      const timer = setTimeout(() => {
        setShowCompletedBanner(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [sheetSyncProgress?.isLoading, sheetSyncProgress?.percent, sheetSyncProgress?.totalLoaded, sheetSyncProgress?.currentStep]);

  if (isDismissed) {
    return null;
  }

  const isActuallyLoading = Boolean(sheetSyncProgress && sheetSyncProgress.isLoading);

  if (!isActuallyLoading && !showCompletedBanner) {
    return null;
  }

  const {
    currentKecamatan = '',
    currentStep = 1,
    totalSteps = 7,
    percent = 10,
    totalLoaded = 0,
    loadedKecamatans = [],
    statusMessage = '',
  } = sheetSyncProgress || {};

  return (
    <aside
      id="sheet-sync-progress-banner"
      aria-label="Pemberitahuan Pemuatan Data"
      className="fixed bottom-5 right-4 sm:right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300 shadow-2xl rounded-2xl bg-slate-900/95 text-white border border-cyan-500/40 backdrop-blur-xl overflow-hidden pointer-events-auto transition-all"
      style={{
        boxShadow: isActuallyLoading
          ? '0 12px 35px -4px rgba(6, 182, 212, 0.3), 0 0 15px rgba(59, 130, 246, 0.2)'
          : '0 12px 35px -4px rgba(16, 185, 129, 0.3)',
      }}
    >
      {/* Top Animated Gradient Flow Line */}
      <div className="w-full bg-slate-800/80 h-1.5 overflow-hidden relative">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            isActuallyLoading
              ? 'bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400 animate-pulse'
              : 'bg-gradient-to-r from-emerald-500 to-teal-400'
          }`}
          style={{ width: `${Math.max(8, Math.min(100, isActuallyLoading ? percent : 100))}%` }}
        />
        {isActuallyLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
        )}
      </div>

      <div className="p-4">
        {/* Header & Controls */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Animated Icon Avatar */}
            <div className="relative shrink-0">
              <div
                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                  isActuallyLoading
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {isActuallyLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
                )}
              </div>
              {isActuallyLoading && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isActuallyLoading
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                  }`}
                >
                  {isActuallyLoading ? 'Memuat Data Sistem' : 'Pemuatan Selesai'}
                </span>
                {isActuallyLoading && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Step {currentStep}/{totalSteps}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white truncate mt-1">
                {isActuallyLoading
                  ? (currentKecamatan ? `Membaca: Kec. ${currentKecamatan}` : 'Menghubungkan Data...')
                  : `Seluruh ${lastFinishedCount || totalLoaded} Data Gedung Siap!`}
              </h4>
            </div>
          </div>

          {/* Right percentage counter & toggles */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <span
                className={`text-base sm:text-lg font-black font-mono leading-none ${
                  isActuallyLoading ? 'text-cyan-400' : 'text-emerald-400'
                }`}
              >
                {isActuallyLoading ? `${Math.min(99, percent)}%` : '100%'}
              </span>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                {totalLoaded || lastFinishedCount} data
              </div>
            </div>

            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Sembunyikan rincian' : 'Tampilkan rincian'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Rincian 7 Kecamatan */}
        {isExpanded && loadedKecamatans && loadedKecamatans.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] animate-in fade-in duration-200">
            {loadedKecamatans.map((kec) => (
              <div
                key={kec.name}
                className={`px-2 py-1 rounded-lg flex items-center justify-between transition-all ${
                  kec.status === 'completed'
                    ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-medium'
                    : kec.status === 'loading'
                    ? 'bg-cyan-950/80 border border-cyan-500/60 text-cyan-200 font-bold animate-pulse shadow-sm'
                    : 'bg-slate-800/60 border border-slate-700/40 text-slate-400'
                }`}
              >
                <span className="truncate">{kec.name.replace('Kec. ', '')}</span>
                {kec.status === 'completed' ? (
                  <span className="text-[9px] font-mono text-emerald-400 shrink-0 ml-1">
                    +{kec.count}
                  </span>
                ) : kec.status === 'loading' ? (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0 ml-1" />
                ) : (
                  <span className="text-[9px] text-slate-500 shrink-0 ml-1">-</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status Message Footer */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5 truncate">
            {isActuallyLoading ? (
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="truncate text-slate-300">
              {statusMessage || (isActuallyLoading ? 'Menyinkronkan data Google Sheet & server...' : 'Seluruh data tersinkronisasi sempurna!')}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 shrink-0 font-mono ml-2">SIM-PKBG</span>
        </div>
      </div>
    </aside>
  );
};

