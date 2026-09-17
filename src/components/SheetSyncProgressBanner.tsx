import React from 'react';
import { useApp } from '../context/AppContext';
import { RefreshCw, CheckCircle2, Database, Layers, ArrowRight } from 'lucide-react';

export const SheetSyncProgressBanner: React.FC = () => {
  const { sheetSyncProgress } = useApp();

  if (!sheetSyncProgress || !sheetSyncProgress.isLoading) {
    return null;
  }

  const {
    currentKecamatan,
    currentStep,
    totalSteps,
    percent,
    totalLoaded,
    loadedKecamatans,
    statusMessage,
  } = sheetSyncProgress;

  return (
    <div
      id="sheet-sync-progress-banner"
      className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300 shadow-2xl rounded-2xl bg-slate-900/95 text-white border border-blue-500/40 backdrop-blur-md overflow-hidden pointer-events-auto"
    >
      {/* Top Animated Progress Bar */}
      <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(5, percent)}%` }}
        />
      </div>

      <div className="p-4">
        {/* Header & Percentage */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-blue-400 uppercase tracking-wider">
                  Sinkronisasi Bertahap
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Step {currentStep}/{totalSteps}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-200 truncate mt-0.5">
                Membaca: <span className="text-white font-bold">{currentKecamatan ? `Kec. ${currentKecamatan}` : 'Menghubungkan...'}</span>
              </h4>
            </div>
          </div>
          <div className="text-right">
            <span className="text-lg font-black font-mono text-cyan-400">
              {percent}%
            </span>
            <div className="text-[10px] text-slate-400">
              {totalLoaded} gedung termuat
            </div>
          </div>
        </div>

        {/* Dynamic List of 7 Kecamatan Tabs */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-slate-800 text-[10px]">
          {loadedKecamatans.map((kec) => (
            <div
              key={kec.name}
              className={`px-2 py-1 rounded-lg flex items-center justify-between transition-all ${
                kec.status === 'completed'
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-medium'
                  : kec.status === 'loading'
                  ? 'bg-blue-950/80 border border-blue-500/50 text-blue-200 font-bold animate-pulse'
                  : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'
              }`}
            >
              <span className="truncate">{kec.name.replace('Kec. ', '')}</span>
              {kec.status === 'completed' ? (
                <span className="text-[9px] font-mono text-emerald-400 shrink-0 ml-1">
                  +{kec.count}
                </span>
              ) : kec.status === 'loading' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping shrink-0 ml-1" />
              ) : (
                <span className="text-[9px] text-slate-400 shrink-0 ml-1">-</span>
              )}
            </div>
          ))}
        </div>

        {/* Informative Status Footer */}
        <p className="text-[10px] text-slate-400 mt-2.5 flex items-center gap-1.5 truncate">
          <Database className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>{statusMessage || 'Membaca antrian Google Sheet secara aman...'}</span>
        </p>
      </div>
    </div>
  );
};
