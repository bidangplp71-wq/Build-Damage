import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Database,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Zap,
  ShieldCheck,
  Building2,
  Trash2,
} from 'lucide-react';
import { BufferQueueStatus, BufferQueueItem } from '../types';

interface BufferQueueBannerProps {
  variant?: 'inline' | 'floating' | 'card';
  compact?: boolean;
}

export const BufferQueueBanner: React.FC<BufferQueueBannerProps> = ({
  variant = 'inline',
  compact = false,
}) => {
  const { showToast, logUserActivity, googleSheetConfig } = useApp();
  const [status, setStatus] = useState<BufferQueueStatus>({
    enabled: true,
    pendingCount: 0,
    items: [],
    nextRunTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    isProcessing: false,
    statusMessage: 'Antrean sementara aktif (Sinkronisasi berkala 1 jam).',
  });
  const [isProcessingManual, setIsProcessingManual] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('Memuat...');

  // Fetch status from server API
  const fetchBufferStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/buffer-queue');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatus((prev) => ({
            ...prev,
            enabled: data.enabled !== false,
            pendingCount: data.pendingCount || 0,
            items: data.items || [],
            nextRunTime: data.nextRunTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            lastProcessedTime: data.lastProcessedTime,
          }));
        }
      }
    } catch (err) {
      // Non-blocking fallback
    }
  }, []);

  // Poll status periodically
  useEffect(() => {
    fetchBufferStatus();
    const interval = setInterval(fetchBufferStatus, 20000); // 20s
    return () => clearInterval(interval);
  }, [fetchBufferStatus]);

  // Compute countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      if (!status.nextRunTime) {
        setTimeRemainingStr('1 jam berikutnya');
        return;
      }
      const target = new Date(status.nextRunTime).getTime();
      const now = Date.now();
      const diffMs = target - now;

      if (diffMs <= 0) {
        setTimeRemainingStr('Sedang memproses batch...');
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeRemainingStr(`${minutes} m ${seconds < 10 ? '0' : ''}${seconds} d lagi`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [status.nextRunTime]);

  // Handle manual trigger
  const handleProcessNow = async () => {
    setIsProcessingManual(true);
    try {
      const res = await fetch('/api/buffer-queue/process', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          showToast(
            data.message || `Berhasil memindahkan ${data.processedCount || 0} data dari antrean sementara ke sheet utama!`,
            'success'
          );
          logUserActivity(
            'SYNC_GOOGLE_SHEET',
            'Integrasi Google Sheet',
            `Eksekusi Manual Pemindahan Antrean Sementara ke 7 Sheet Kecamatan (${data.processedCount || 0} gedung)`,
            'Antrean_Data_Masuk',
            'Dipindahkan ke sheet masing-masing kecamatan'
          );
          await fetchBufferStatus();
        } else {
          showToast(data.message || 'Gagal memproses antrean', 'error');
        }
      } else {
        showToast('Gagal menghubungi server antrean', 'error');
      }
    } catch (err: any) {
      showToast('Terjadi kesalahan saat memproses antrean: ' + err.message, 'error');
    } finally {
      setIsProcessingManual(false);
    }
  };

  const pendingItems = status.items.filter(
    (item) => item.status === 'pending_transfer' || !item.status
  );

  // If compact inline and no pending items, return minimal badge
  if (compact && pendingItems.length === 0) {
    return (
      <div
        id="buffer-queue-compact-indicator"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs border border-slate-200"
        title="Sistem penyangga aktif: Data baru ditampung sementara lalu diperbarui tiap 1 jam ke sheet kecamatan"
      >
        <Clock className="w-3.5 h-3.5 text-blue-600" />
        <span className="font-medium">Antrean 1 Jam:</span>
        <span className="font-semibold text-emerald-700">0 Data Baru</span>
        <span className="text-[10px] text-slate-400 font-mono">({timeRemainingStr})</span>
      </div>
    );
  }

  // Floating variant for instant notifications
  if (variant === 'floating') {
    if (pendingItems.length === 0) return null;

    return (
      <div
        id="buffer-queue-floating-toast"
        className="fixed bottom-6 left-6 z-40 max-w-sm bg-slate-900 text-white rounded-2xl shadow-2xl border border-blue-500/40 p-3.5 backdrop-blur-md animate-in slide-in-from-bottom-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
              <Layers className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  Sheet Penampung Sementara
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-extrabold font-mono">
                  {pendingItems.length}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Auto-update tiap 1 jam: <span className="font-mono text-cyan-300">{timeRemainingStr}</span>
              </p>
            </div>
          </div>
          <button
            id="btn-process-buffer-floating"
            onClick={handleProcessNow}
            disabled={isProcessingManual}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 shrink-0"
          >
            {isProcessingManual ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>Proses</span>
          </button>
        </div>
      </div>
    );
  }

  // Card / Inline Variant
  return (
    <div
      id="buffer-queue-banner"
      className={`rounded-2xl border transition-all ${
        pendingItems.length > 0
          ? 'bg-gradient-to-r from-blue-900/90 via-slate-900/95 to-slate-900 text-white border-blue-500/40 shadow-lg'
          : 'bg-slate-900/90 text-white border-slate-700/60'
      } p-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Info */}
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              pendingItems.length > 0
                ? 'bg-blue-600/30 text-cyan-400 border border-blue-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sistem Penampungan Sementara (Buffer 1 Jam)
              </span>

              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                  pendingItems.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {pendingItems.length > 0
                  ? `${pendingItems.length} Data Menunggu Transfer`
                  : '0 Antrean (Semua Data Masuk Langsung ke Sistem)'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {pendingItems.length > 0
                ? 'Terdapat data survei yang siap dialihkan ke 7 sheet kecamatan secara otomatis setiap 1 jam atau tekan "Proses Sekarang".'
                : 'Data yang diinput surveyor langsung masuk dan tersimpan di database sistem utama (Tabel Penilaian). Tidak ada data yang tersangkut/tertahan.'}
            </p>
          </div>
        </div>

        {/* Right Timer & Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              Jadwal Batch Otomatis
            </div>
            <div className="text-xs font-bold font-mono text-cyan-300">{timeRemainingStr}</div>
          </div>

          <button
            id="btn-process-buffer-manual"
            onClick={handleProcessNow}
            disabled={isProcessingManual || pendingItems.length === 0}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              pendingItems.length > 0
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 cursor-pointer'
                : 'bg-slate-800/90 text-slate-400 cursor-default border border-slate-700'
            }`}
            title={
              pendingItems.length > 0
                ? 'Klik untuk langsung memindahkan seluruh data antrean ke 7 sheet kecamatan tanpa menunggu 1 jam'
                : 'Antrean kosong (0 entri). Seluruh data surveyor telah langsung masuk dan tersimpan di Tabel Penilaian sistem.'
            }
          >
            {isProcessingManual ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memindahkan...</span>
              </>
            ) : pendingItems.length > 0 ? (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Proses Sekarang</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Antrean Kosong</span>
              </>
            )}
          </button>

          {status.items.length > 0 && (
            <button
              id="btn-toggle-buffer-items"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700"
              title="Lihat rincian data dalam antrean sementara"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Table for items currently in buffer queue */}
      {isExpanded && status.items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              Daftar Riwayat Antrean Sementara ({status.items.length} entri)
            </h5>
            <span className="text-[10px] text-slate-400">
              Terakhir diproses: {status.lastProcessedTime ? new Date(status.lastProcessedTime).toLocaleTimeString('id-ID') : '-'}
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/50 text-xs">
            {status.items.map((it, idx) => {
              const isPending = it.status === 'pending_transfer' || !it.status;
              return (
                <div key={it.id || idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isPending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5">
                        <span>{it.buildingName || 'Nama Gedung'}</span>
                        {it.registrationCode && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                            {it.registrationCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Kec. {it.kecamatanName || '-'}, Desa {it.desaName || '-'} • Oleh: {it.submittedBy || 'Surveyor'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isPending
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                      }`}
                    >
                      {isPending ? '⏳ Menunggu Batch 1 Jam' : '✓ Ditransfer'}
                    </span>
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(it.submittedAt).toLocaleTimeString('id-ID')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
