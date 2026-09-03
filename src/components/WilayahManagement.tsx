import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Kecamatan, Desa } from '../types';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  Building,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const WilayahManagement: React.FC = () => {
  const {
    kecamatans,
    desas,
    assessments,
    currentUser,
    addKecamatan,
    updateKecamatan,
    deleteKecamatan,
    addDesa,
    updateDesa,
    deleteDesa,
    showToast,
  } = useApp();

  const [selectedKecamatanId, setSelectedKecamatanId] = useState<string>(kecamatans[0]?.id || '');
  const [searchDesa, setSearchDesa] = useState('');

  // Modal: Tambah / Edit Kecamatan
  const [isKecModalOpen, setIsKecModalOpen] = useState(false);
  const [editingKec, setEditingKec] = useState<Kecamatan | null>(null);
  const [kecCode, setKecCode] = useState('');
  const [kecName, setKecName] = useState('');
  const [kecCapital, setKecCapital] = useState('');
  const [kecDesc, setKecDesc] = useState('');

  // Modal: Tambah / Edit Desa
  const [isDesaModalOpen, setIsDesaModalOpen] = useState(false);
  const [editingDesa, setEditingDesa] = useState<Desa | null>(null);
  const [desaKecId, setDesaKecId] = useState(selectedKecamatanId);
  const [desaCode, setDesaCode] = useState('');
  const [desaName, setDesaName] = useState('');
  const [desaType, setDesaType] = useState<'Desa' | 'Kelurahan'>('Desa');
  const [desaIsPemekaran, setDesaIsPemekaran] = useState(false);
  const [desaNotes, setDesaNotes] = useState('');

  // Filtered desas
  const activeKecamatan = kecamatans.find((k) => k.id === selectedKecamatanId);
  const filteredDesas = desas
    .filter((d) => (selectedKecamatanId ? d.kecamatanId === selectedKecamatanId : true))
    .filter((d) => {
      if (!searchDesa) return true;
      const q = searchDesa.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q);
    });

  // Open modal for new Kecamatan
  const handleOpenAddKec = () => {
    setEditingKec(null);
    setKecCode(`53.16.0${kecamatans.length + 1}`);
    setKecName('');
    setKecCapital('');
    setKecDesc('');
    setIsKecModalOpen(true);
  };

  // Open modal for editing Kecamatan
  const handleOpenEditKec = (kec: Kecamatan) => {
    setEditingKec(kec);
    setKecCode(kec.code);
    setKecName(kec.name);
    setKecCapital(kec.capitalCity || '');
    setKecDesc(kec.description || '');
    setIsKecModalOpen(true);
  };

  // Save Kecamatan
  const handleSaveKec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kecName.trim() || !kecCode.trim()) {
      showToast('Nama dan Kode Kecamatan wajib diisi', 'error');
      return;
    }

    if (editingKec) {
      const res = updateKecamatan(editingKec.id, {
        code: kecCode.trim(),
        name: kecName.trim(),
        capitalCity: kecCapital.trim(),
        description: kecDesc.trim(),
      });
      showToast(res.message, res.success ? 'success' : 'error');
    } else {
      const res = addKecamatan({
        code: kecCode.trim(),
        name: kecName.trim(),
        capitalCity: kecCapital.trim(),
        description: kecDesc.trim(),
      });
      showToast(res.message, res.success ? 'success' : 'error');
    }

    setIsKecModalOpen(false);
  };

  // Open modal for new Desa
  const handleOpenAddDesa = (isPemekaran: boolean = false) => {
    setEditingDesa(null);
    setDesaKecId(selectedKecamatanId || kecamatans[0]?.id || '');
    const activeKec = kecamatans.find((k) => k.id === (selectedKecamatanId || kecamatans[0]?.id));
    const kecNumber = activeKec?.code.split('.').pop() || '01';
    const nextNum = desas.filter((d) => d.kecamatanId === activeKec?.id).length + 2001;
    setDesaCode(`53.16.${kecNumber}.${nextNum}`);
    setDesaName('');
    setDesaType('Desa');
    setDesaIsPemekaran(isPemekaran);
    setDesaNotes(
      isPemekaran
        ? 'Pemekaran wilayah desa baru pasca penetapan peraturan daerah'
        : 'Desa definitif yang didaftarkan ke sistem karena sebelumnya belum tercatat'
    );
    setIsDesaModalOpen(true);
  };

  // Open modal for editing Desa
  const handleOpenEditDesa = (desa: Desa) => {
    setEditingDesa(desa);
    setDesaKecId(desa.kecamatanId);
    setDesaCode(desa.code);
    setDesaName(desa.name);
    setDesaType(desa.type);
    setDesaIsPemekaran(Boolean(desa.isPemekaran));
    setDesaNotes(desa.notes || '');
    setIsDesaModalOpen(true);
  };

  // Save Desa
  const handleSaveDesa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desaName.trim() || !desaCode.trim()) {
      showToast('Nama dan Kode Desa wajib diisi', 'error');
      return;
    }

    if (editingDesa) {
      const res = updateDesa(editingDesa.id, {
        kecamatanId: desaKecId,
        code: desaCode.trim(),
        name: desaName.trim(),
        type: desaType,
        isPemekaran: desaIsPemekaran,
        notes: desaNotes.trim(),
      });
      showToast(res.message, res.success ? 'success' : 'error');
    } else {
      const res = addDesa({
        kecamatanId: desaKecId,
        code: desaCode.trim(),
        name: desaName.trim(),
        type: desaType,
        isPemekaran: desaIsPemekaran,
        notes: desaNotes.trim(),
      });
      showToast(res.message, res.success ? 'success' : 'error');
    }

    setIsDesaModalOpen(false);
  };

  const canManageWilayah = currentUser.role !== 'admin_publik';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            <span>Master Wilayah Administrasi & Pendaftaran Desa Baru</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Daftar resmi Kecamatan dan Desa/Kelurahan. Jika terdapat desa atau kecamatan yang belum terdaftar atau merupakan hasil pemekaran wilayah, dapat ditambahkan langsung.
          </p>
        </div>

        {canManageWilayah ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenAddKec}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Kecamatan</span>
            </button>
            <button
              onClick={() => handleOpenAddDesa(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Desa (Belum Terdaftar)</span>
            </button>
            <button
              onClick={() => handleOpenAddDesa(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Desa Pemekaran</span>
            </button>
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>Mode Baca (Publik Tamu)</span>
          </div>
        )}
      </div>

      {/* Grid Layout: Left Kecamatan List, Right Village List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Kecamatan Navigator */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Daftar Kecamatan ({kecamatans.length})
              </h3>
              <span className="text-[11px] text-slate-400">Pilih untuk filter desa</span>
            </div>

            <div className="space-y-2">
              {kecamatans.map((kec) => {
                const isSelected = kec.id === selectedKecamatanId;
                const desaCount = desas.filter((d) => d.kecamatanId === kec.id).length;
                const buildingCount = assessments.filter((a) => a.kecamatanId === kec.id).length;

                return (
                  <div
                    key={kec.id}
                    onClick={() => setSelectedKecamatanId(kec.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        <span>Kec. {kec.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">{kec.code}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{desaCount} Desa/Kelurahan</span>
                      <span>{buildingCount} Gedung Rusak</span>
                    </div>

                    {canManageWilayah && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2 text-[11px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditKec(kec);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          Edit
                        </button>
                        <span className="text-slate-300">&bull;</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const res = deleteKecamatan(kec.id);
                            showToast(res.message, res.success ? 'success' : 'error');
                          }}
                          className="text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Desa List for Selected Kecamatan */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Daftar Desa & Kelurahan di Kecamatan {activeKecamatan?.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                    {filteredDesas.length} Terdaftar
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap desa terikat langsung ke kecamatan induknya.
                </p>
              </div>

              {/* Search Desa & Add Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchDesa}
                    onChange={(e) => setSearchDesa(e.target.value)}
                    placeholder="Cari desa atau kelurahan..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>
                {canManageWilayah && (
                  <button
                    onClick={() => handleOpenAddDesa(false)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                    title="Tambah Desa Baru di Kecamatan Ini"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Desa</span>
                  </button>
                )}
              </div>
            </div>

            {/* Village Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {filteredDesas.map((desa) => {
                const buildingCount = assessments.filter((a) => a.desaId === desa.id).length;

                return (
                  <div
                    key={desa.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              desa.type === 'Kelurahan'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {desa.type}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{desa.name}</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                          Kode: {desa.code}
                        </div>
                      </div>

                      {desa.isPemekaran && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Pemekaran</span>
                        </span>
                      )}
                    </div>

                    {desa.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-2 bg-white p-2 rounded-lg border border-slate-200/60">
                        {desa.notes}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between text-slate-500 border-t border-slate-200/60 pt-2 text-[11px]">
                      <span>{buildingCount} Gedung Dinilai</span>

                      {canManageWilayah && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditDesa(desa)}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            Edit
                          </button>
                          <span className="text-slate-300">&bull;</span>
                          <button
                            onClick={() => {
                              const res = deleteDesa(desa.id);
                              showToast(res.message, res.success ? 'success' : 'error');
                            }}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredDesas.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                  Tidak ada desa atau kelurahan yang sesuai di kecamatan ini.
                  {canManageWilayah && (
                    <div className="mt-2">
                      <button
                        onClick={handleOpenAddDesa}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        + Tambah Desa Baru Sekarang
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tambah / Edit Kecamatan */}
      {isKecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingKec ? 'Edit Data Kecamatan' : 'Tambah Kecamatan Baru (Pemekaran)'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Informasi wilayah tingkat kecamatan sebagai induk pengelompokan desa
            </p>

            <form onSubmit={handleSaveKec} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Kecamatan (Kemendagri)</label>
                <input
                  type="text"
                  value={kecCode}
                  onChange={(e) => setKecCode(e.target.value)}
                  placeholder="Contoh: 53.16.08"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kecamatan</label>
                <input
                  type="text"
                  value={kecName}
                  onChange={(e) => setKecName(e.target.value)}
                  placeholder="Contoh: Wolowae Timur"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ibukota Kecamatan</label>
                <input
                  type="text"
                  value={kecCapital}
                  onChange={(e) => setKecCapital(e.target.value)}
                  placeholder="Contoh: Dorenga Baru"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Dasar Hukum</label>
                <textarea
                  rows={2}
                  value={kecDesc}
                  onChange={(e) => setKecDesc(e.target.value)}
                  placeholder="Contoh: Pemekaran Kecamatan berdasarkan Perda No. 4 Tahun 2026"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsKecModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
                >
                  Simpan Kecamatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah / Edit Desa */}
      {isDesaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingDesa ? 'Edit Data Desa/Kelurahan' : 'Tambah Desa / Kelurahan Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Mendukung penambahan desa pemekaran untuk pembaruan data kewilayahan
            </p>

            <form onSubmit={handleSaveDesa} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kecamatan Induk</label>
                <select
                  value={desaKecId}
                  onChange={(e) => setDesaKecId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold bg-white"
                >
                  {kecamatans.map((k) => (
                    <option key={k.id} value={k.id}>
                      Kec. {k.name} ({k.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe Wilayah</label>
                  <select
                    value={desaType}
                    onChange={(e) => setDesaType(e.target.value as 'Desa' | 'Kelurahan')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Desa">Desa</option>
                    <option value="Kelurahan">Kelurahan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Desa</label>
                  <input
                    type="text"
                    value={desaCode}
                    onChange={(e) => setDesaCode(e.target.value)}
                    placeholder="53.16.01.2006"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Desa / Kelurahan</label>
                <input
                  type="text"
                  value={desaName}
                  onChange={(e) => setDesaName(e.target.value)}
                  placeholder="Contoh: Tedakisa Timur"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pemkCheck"
                  checked={desaIsPemekaran}
                  onChange={(e) => setDesaIsPemekaran(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="pemkCheck" className="font-semibold text-slate-800 cursor-pointer">
                  Tandai sebagai Wilayah Pemekaran Baru
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan Pemekaran</label>
                <textarea
                  rows={2}
                  value={desaNotes}
                  onChange={(e) => setDesaNotes(e.target.value)}
                  placeholder="Contoh: Hasil pemekaran Desa Tedakisa berdasarkan SK Bupati 2026"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDesaModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl"
                >
                  Simpan Desa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
