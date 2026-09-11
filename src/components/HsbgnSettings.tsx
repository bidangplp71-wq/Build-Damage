import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BUILDING_CATEGORY_CONFIGS, BuildingCategory } from '../types';
import { Award, Save, RotateCcw, CheckCircle2, ShieldAlert, Building2, Sliders, Info, Target } from 'lucide-react';
import { DataFulfillmentCard } from './DataFulfillmentCard';

export const HsbgnSettings: React.FC = () => {
  const { currentUser, hsbgnConfigs, updateHsbgnConfig, resetHsbgnConfigs, showToast } = useApp();
  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  const [localConfigs, setLocalConfigs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.keys(BUILDING_CATEGORY_CONFIGS).forEach((cat) => {
      initial[cat] = hsbgnConfigs[cat as BuildingCategory] ?? BUILDING_CATEGORY_CONFIGS[cat as BuildingCategory].defaultHsbgn;
    });
    return initial;
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (catKey: string, val: number) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [catKey]: Math.max(0, val),
    }));
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Admin dan Super Admin yang dapat mengubah standar HSBGN daerah.', 'error');
      return;
    }
    Object.entries(localConfigs).forEach(([cat, val]) => {
      updateHsbgnConfig(cat as BuildingCategory, val);
    });
    setHasChanges(false);
    showToast('Standar HSBGN Daerah berhasil diperbarui dan diterapkan ke seluruh sistem!', 'success');
  };

  const handleReset = () => {
    if (!isAdmin) return;
    if (window.confirm('Reset seluruh standar HSBGN kembali ke default PUPR Nasional?')) {
      resetHsbgnConfigs();
      const defaultState: Record<string, number> = {};
      Object.keys(BUILDING_CATEGORY_CONFIGS).forEach((cat) => {
        defaultState[cat] = BUILDING_CATEGORY_CONFIGS[cat as BuildingCategory].defaultHsbgn;
      });
      setLocalConfigs(defaultState);
      setHasChanges(false);
      showToast('Standar HSBGN dikembalikan ke default PUPR Nasional.', 'success');
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" /> Konfigurasi Standar Daerah
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Pengaturan Harga Satuan HSBGN
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Sesuaikan Harga Satuan Bangunan Gedung Negara (HSBGN) per m² untuk setiap kategori bangunan sesuai Surat Keputusan (SK) Bupati/Wali Kota, standar teknis PUPR daerah, atau pembaruan kementerian terkait.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && hasChanges && (
              <button
                type="button"
                onClick={handleSaveAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg transition-all text-sm"
              >
                <Save className="w-4 h-4" /> Simpan Perubahan HSBGN
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset ke Default PUPR"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Default
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Target Pemenuhan Kuota Data Input Section */}
      <DataFulfillmentCard />

      {!isAdmin && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>Anda masuk sebagai <strong>Surveyor</strong>. Menu ini hanya dapat diubah oleh Admin atau Super Admin. Anda dapat melihat standar HSBGN yang sedang berlaku.</span>
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/85 text-amber-950 flex items-start gap-3 text-xs md:text-sm">
        <Info className="w-5 h-5 flex-shrink-0 text-amber-700 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold">Ketentuan Penggunaan HSBGN Daerah:</strong>
          <p className="text-amber-900 leading-relaxed">
            Perubahan nilai HSBGN di bawah ini akan langsung mengkalkulasi ulang estimasi Biaya Rehabilitasi (RAB) pada formulir penilaian baru maupun sinkronisasi laporan di seluruh perangkat sistem.
          </p>
        </div>
      </div>

      {/* HSBGN Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {(Object.keys(BUILDING_CATEGORY_CONFIGS) as BuildingCategory[]).map((catKey) => {
          const cfg = BUILDING_CATEGORY_CONFIGS[catKey];
          const defaultVal = cfg.defaultHsbgn;
          const currentVal = localConfigs[catKey] ?? defaultVal;
          const isModified = currentVal !== defaultVal;

          return (
            <div
              key={catKey}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                isModified ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.badgeClass}`}>
                      {cfg.shortLabel}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">{cfg.name}</h3>
                  </div>
                  {isModified && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                      Teralih Sesuai SK Daerah
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 line-clamp-2">
                  {cfg.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Standar Default PUPR:</span>
                  <span className="font-mono font-semibold text-slate-700">{formatRupiah(defaultVal)} / m²</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200/80 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Satuan HSBGN Aktif (Rp / m²)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 text-sm">Rp</span>
                    <input
                      type="number"
                      step={50000}
                      disabled={!isAdmin}
                      value={currentVal}
                      onChange={(e) => handleChange(catKey, Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-xl border text-sm font-bold font-mono ${
                        isAdmin
                          ? 'border-slate-300 text-slate-900 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
                          : 'border-slate-200 text-slate-600 bg-slate-100 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span>Terbilang / Nilai:</span>
                  <span className="font-mono text-amber-900 font-extrabold">{formatRupiah(currentVal)} / m²</span>
                </div>

                {isAdmin && isModified && (
                  <button
                    type="button"
                    onClick={() => handleChange(catKey, defaultVal)}
                    className="w-full text-center text-xs font-semibold text-amber-800 hover:text-amber-950 py-1 underline"
                  >
                    Kembalikan ke Default PUPR ({formatRupiah(defaultVal)})
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && hasChanges && (
        <div className="sticky bottom-6 z-20 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 text-white shadow-2xl border border-amber-500/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold flex-shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">Perubahan Standar HSBGN Belum Disimpan</div>
              <div className="text-xs text-slate-300">Simpan perubahan agar berlaku pada kalkulasi RAB seluruh modul peninjauan.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const initial: Record<string, number> = {};
                Object.keys(BUILDING_CATEGORY_CONFIGS).forEach((cat) => {
                  initial[cat] = hsbgnConfigs[cat as BuildingCategory] ?? BUILDING_CATEGORY_CONFIGS[cat as BuildingCategory].defaultHsbgn;
                });
                setLocalConfigs(initial);
                setHasChanges(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
