import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Target,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react';

interface DataFulfillmentCardProps {
  compact?: boolean;
  className?: string;
  showCategoryBreakdown?: boolean;
}

export const DataFulfillmentCard: React.FC<DataFulfillmentCardProps> = ({
  compact = false,
  className = '',
  showCategoryBreakdown = false,
}) => {
  const {
    assessments,
    targetAssessmentCount,
    updateTargetAssessmentCount,
    currentUser,
    showToast,
    setActiveTab,
  } = useApp();

  const isSuperAdminOrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  // Modal / Inline Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [inputTarget, setInputTarget] = useState<number>(targetAssessmentCount);

  // Calculations
  const totalEntered = assessments.length;
  const target = targetAssessmentCount || 400;
  const rawPercentage = target > 0 ? (totalEntered / target) * 100 : 0;
  const percentage = Math.round(rawPercentage * 10) / 10;
  const remaining = Math.max(0, target - totalEntered);
  const isCompleted = totalEntered >= target;
  const isExceeded = totalEntered > target;
  const surplus = isExceeded ? totalEntered - target : 0;

  // Breakdown status
  const verifiedCount = assessments.filter((a) => a.verificationStatus === 'Terverifikasi').length;
  const pendingCount = assessments.filter((a) => a.verificationStatus === 'Menunggu Verifikasi').length;
  const revisionCount = assessments.filter((a) => a.verificationStatus === 'Perlu Revisi').length;

  const handleOpenEdit = () => {
    if (!isSuperAdminOrAdmin) {
      showToast('Hanya Super Admin yang memiliki wewenang mengubah target kuota pemenuhan data.', 'error');
      return;
    }
    setInputTarget(targetAssessmentCount);
    setIsEditModalOpen(true);
  };

  const handleSaveTarget = () => {
    if (isNaN(inputTarget) || inputTarget < 1) {
      showToast('Target kuota data harus berupa angka positif minimal 1!', 'error');
      return;
    }
    const res = updateTargetAssessmentCount(inputTarget);
    if (res.success) {
      showToast(res.message, 'success');
      setIsEditModalOpen(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  // Color & Badge based on percentage
  const getStatusTheme = () => {
    if (isCompleted) {
      return {
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        progressBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        label: isExceeded ? `Target Terlampaui (+${surplus} Data)` : 'Target 100% Terpenuhi',
      };
    }
    if (percentage >= 75) {
      return {
        badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        progressBar: 'bg-gradient-to-r from-sky-500 to-blue-500',
        textColor: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        label: 'Mendekati Target Pemenuhan',
      };
    }
    if (percentage >= 40) {
      return {
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        progressBar: 'bg-gradient-to-r from-amber-500 to-amber-400',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        label: 'Progres Pengumpulan Lapangan',
      };
    }
    return {
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      progressBar: 'bg-gradient-to-r from-rose-500 to-orange-400',
      textColor: 'text-rose-400',
      borderColor: 'border-rose-500/30',
      label: 'Tahap Awal Inventarisasi',
    };
  };

  const theme = getStatusTheme();

  if (compact) {
    return (
      <div className={`bg-slate-900 border border-slate-700/80 rounded-2xl p-4 text-white shadow-md relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Pemenuhan Target Data</h4>
              <span className="text-[10px] text-slate-400">Target: {target} Gedung</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${theme.badgeBg}`}>
              {percentage}%
            </span>
            {isSuperAdminOrAdmin && (
              <button
                onClick={handleOpenEdit}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                title="Ubah Target Kuota Data (Super Admin)"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800 my-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.progressBar}`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span>
            Masuk: <strong className="text-white">{totalEntered}</strong> / {target}
          </span>
          <span>
            {isCompleted ? (
              <strong className="text-emerald-400">Terpenuhi!</strong>
            ) : (
              <span>
                Sisa: <strong className="text-amber-400">{remaining}</strong> data
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-700/80 rounded-2xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden ${className}`}
      >
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Header Widget */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Target className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  Monitoring Pemenuhan Kuota Data Penilaian
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${theme.badgeBg}`}>
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {theme.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluasi progres pencapaian data gedung masuk terhadap target kuota yang ditetapkan oleh Super Admin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isSuperAdminOrAdmin ? (
              <button
                onClick={handleOpenEdit}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-600 hover:border-amber-400/50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                title="Atur jumlah target data yang dibutuhkan (bebas diubah oleh Super Admin)"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Ubah Target ({target})</span>
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Target Super Admin: {target}</span>
              </div>
            )}
          </div>
        </div>

        {/* Core Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-5 relative z-10">
          {/* Target Box */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Target Dibutuhkan</span>
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-amber-400">{target.toLocaleString('id-ID')}</span>
                <span className="text-xs text-slate-400 font-medium">Gedung</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isSuperAdminOrAdmin ? 'Dapat disesuaikan kapan saja' : 'Standar kuota resmi'}
              </span>
            </div>
          </div>

          {/* Realisasi Box */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Realisasi Masuk</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-white">{totalEntered.toLocaleString('id-ID')}</span>
                <span className="text-xs text-slate-400 font-medium">Gedung</span>
              </div>
              <span className="text-[10px] text-emerald-400/90 font-semibold mt-1 block">
                {verifiedCount} telah diverifikasi
              </span>
            </div>
          </div>

          {/* Persentase Box */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Persentase Capaian</span>
              <Sparkles className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-black ${theme.textColor}`}>{percentage}%</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isCompleted ? 'Target terpenuhi sempurna' : `${percentage}% dari target kuota`}
              </span>
            </div>
          </div>

          {/* Sisa Data Box */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Sisa Data Dibutuhkan</span>
              <AlertCircle className={`w-4 h-4 ${isCompleted ? 'text-emerald-400' : 'text-rose-400'}`} />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                {isCompleted ? (
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                    {isExceeded ? `+${surplus}` : '0'}
                  </span>
                ) : (
                  <span className="text-2xl sm:text-3xl font-black text-rose-400">{remaining.toLocaleString('id-ID')}</span>
                )}
                <span className="text-xs text-slate-400 font-medium">Gedung</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {isCompleted
                  ? isExceeded
                    ? `Melampaui target ${surplus} data`
                    : 'Target kuota telah tercapai'
                  : `Kurang ${remaining} data untuk memenuhi target`}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Dynamic Progress Bar */}
        <div className="space-y-2 relative z-10 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Progres Pemenuhan Kuota</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                {totalEntered} dari {target} data terkumpul
              </span>
            </span>
            <span className="font-extrabold text-white">{percentage}%</span>
          </div>

          <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${theme.progressBar} shadow-sm`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        </div>

        {/* Sub-status pills & Action link */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400 relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Terverifikasi: <strong className="text-slate-200">{verifiedCount}</strong>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>
                Menunggu Validasi: <strong className="text-slate-200">{pendingCount}</strong>
              </span>
            </span>
            {revisionCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>
                  Perlu Revisi: <strong className="text-rose-400">{revisionCount}</strong>
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('penilaian')}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Lihat Detail Tabel Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SUPER ADMIN TARGET CONFIGURATION MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 to-indigo-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Atur Target Kuota Data</h4>
                  <span className="text-[11px] text-amber-400 font-medium">Khusus Super Admin & Admin</span>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Tentukan jumlah kuota data gedung yang harus diinventarisasi oleh tim surveyor. Target ini bersifat fleksibel (bisa 400, 500, 1.000, atau sesuai kebutuhan daerah).
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  Jumlah Target Gedung (Unit)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={inputTarget || ''}
                    onChange={(e) => setInputTarget(parseInt(e.target.value, 10) || 0)}
                    placeholder="Contoh: 400"
                    className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl px-4 py-2.5 text-lg font-black text-amber-400 focus:outline-hidden focus:border-amber-500 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Gedung
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">Pilihan Preset Cepat:</span>
                <div className="flex flex-wrap gap-2">
                  {[200, 300, 400, 500, 750, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInputTarget(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        inputTarget === preset
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Preview Simulation */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">
                  Simulasi Capaian Saat Ini:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Data Masuk</span>
                    <strong className="text-white font-black">{totalEntered}</strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Prosentase</span>
                    <strong className="text-amber-400 font-black">
                      {inputTarget > 0 ? Math.round((totalEntered / inputTarget) * 1000) / 10 : 0}%
                    </strong>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Sisa Dibutuhkan</span>
                    <strong className="text-rose-400 font-black">
                      {Math.max(0, inputTarget - totalEntered)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-5 py-3.5 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setInputTarget(400)}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Kembalikan ke standar default 400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset 400</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTarget}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Simpan Target</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
