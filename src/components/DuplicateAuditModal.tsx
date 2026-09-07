import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BuildingAssessment } from '../types';
import { DuplicateGroup } from '../utils/duplicateDetector';
import { formatRupiah } from '../utils/puprCalculations';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
  MapPin,
  Camera,
  Check,
  Info,
  ExternalLink,
} from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

interface DuplicateAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateGroup[];
  onIgnorePair?: (idA: string, idB: string) => void;
}

export const DuplicateAuditModal: React.FC<DuplicateAuditModalProps> = ({
  isOpen,
  onClose,
  duplicateGroups,
  onIgnorePair,
}) => {
  const {
    deleteAssessment,
    purgeAllDuplicates,
    setSelectedAssessmentForDetail,
    setSelectedAssessmentForEdit,
    setActiveTab,
    showToast,
    currentUser,
  } = useApp();

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [itemToDelete, setItemToDelete] = useState<BuildingAssessment | null>(null);
  const [showPurgeAllConfirm, setShowPurgeAllConfirm] = useState(false);
  const [photoViewerAssessment, setPhotoViewerAssessment] = useState<BuildingAssessment | null>(null);

  if (!isOpen) return null;

  const currentGroup: DuplicateGroup | undefined = duplicateGroups[activeGroupIndex] || duplicateGroups[0];

  const totalDuplicateRecords = duplicateGroups.reduce((acc, g) => acc + g.items.length, 0);

  const handleDelete = (item: BuildingAssessment) => {
    const res = deleteAssessment(item.id);
    showToast(res.message, res.success ? 'success' : 'error');
    setItemToDelete(null);
  };

  const handlePurgeAll = () => {
    const res = purgeAllDuplicates();
    showToast(res.message, res.success ? 'success' : 'error');
    setShowPurgeAllConfirm(false);
    if (res.success) {
      onClose();
    }
  };

  const handleEdit = (item: BuildingAssessment) => {
    setSelectedAssessmentForEdit(item);
    onClose();
    setActiveTab('input_baru');
  };

  const handleViewDetail = (item: BuildingAssessment) => {
    setSelectedAssessmentForDetail(item);
  };

  const handleIgnoreGroup = () => {
    if (!currentGroup || !onIgnorePair) return;
    for (let i = 0; i < currentGroup.items.length; i++) {
      for (let j = i + 1; j < currentGroup.items.length; j++) {
        onIgnorePair(currentGroup.items[i].id, currentGroup.items[j].id);
      }
    }
    showToast('Kelompok data ini ditandai sebagai data sah (Bukan duplikat).', 'info');
    if (activeGroupIndex >= duplicateGroups.length - 1) {
      setActiveGroupIndex(Math.max(0, duplicateGroups.length - 2));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <AlertTriangle className="w-6 h-6 text-amber-100 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Audit & Verifikasi Data Ganda (Duplikat)</h2>
              <p className="text-xs text-amber-100 font-medium">
                Pemeriksaan Survei Gedung yang Terindikasi Diinput Berulang Kali oleh Surveyor
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            {duplicateGroups.length > 0 && (currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
              <button
                onClick={() => setShowPurgeAllConfirm(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer border border-rose-400/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Semua Duplikat</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {duplicateGroups.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Semua Data Bersih & Valid!</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Tidak ditemukan adanya survei ganda atau data yang diinput lebih dari satu kali di seluruh kecamatan dan desa.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
            >
              Tutup Panel
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* Sidebar Clusters List */}
            <div className="w-full lg:w-80 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Kluster Duplikat ({duplicateGroups.length})
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                  {totalDuplicateRecords} Data
                </span>
              </div>

              <div className="space-y-2 flex-1">
                {duplicateGroups.map((group, idx) => {
                  const isActive = idx === activeGroupIndex;
                  const firstItem = group.items[0];
                  return (
                    <button
                      key={group.groupId}
                      onClick={() => setActiveGroupIndex(idx)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-amber-50 border-amber-400 shadow-sm ring-2 ring-amber-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm text-slate-900 line-clamp-1">
                          {firstItem.buildingName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            group.matchScore === 100
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {group.items.length}x Input
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 line-clamp-1 mb-2">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>
                          {firstItem.desaName || 'Desa'}, {firstItem.kecamatanName || 'Kecamatan'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-600">
                        <span>Skor: {group.matchScore}%</span>
                        <span className="font-semibold text-amber-700">
                          {group.highestReason === 'EXACT_NAME_AND_LOCATION'
                            ? 'Identik 100%'
                            : group.highestReason === 'SAME_NIK'
                            ? 'NIK Sama'
                            : 'Kemiripan Nama'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Comparison Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col">
              {currentGroup && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md border border-amber-200">
                          Kluster {activeGroupIndex + 1} dari {duplicateGroups.length}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">
                          {currentGroup.items[0]?.buildingName}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500">
                        {currentGroup.items.length} catatan survei dengan nama & lokasi yang sama. Bandingkan detail di bawah untuk menentukan data yang valid.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleIgnoreGroup}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors flex items-center gap-1.5"
                        title="Tandai data ini bukan duplikat jika memang merupakan bangunan berbeda"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Tandai Sah (Bukan Duplikat)
                      </button>
                    </div>
                  </div>

                  {/* Side-by-side Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    {currentGroup.items.map((item, index) => {
                      const isFirstCreated = index === 0;
                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                            isFirstCreated
                              ? 'bg-slate-50/70 border-slate-300'
                              : 'bg-amber-50/30 border-amber-200 ring-1 ring-amber-300/40'
                          }`}
                        >
                          <div>
                            {/* Card Header & Badge */}
                            <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-slate-200">
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white mb-1.5">
                                  {isFirstCreated ? '📝 Data Entri #1 (Awal)' : `🔁 Data Entri #${index + 1} (Duplikat)`}
                                </span>
                                <div className="text-xs font-semibold text-slate-600">
                                  ID / Kode: <span className="font-mono text-slate-900">{item.code || item.id}</span>
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  item.verificationStatus === 'Terverifikasi'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : item.verificationStatus === 'Perlu Revisi'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                {item.verificationStatus}
                              </span>
                            </div>

                            {/* Key Fields */}
                            <div className="space-y-2.5 text-xs text-slate-700 mb-4">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Nama Gedung & Kategori</div>
                                <div className="font-bold text-sm text-slate-900">{item.buildingName}</div>
                                <div className="text-slate-600 font-medium">{item.buildingCategory}</div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Pemilik / Pengelola</div>
                                  <div className="font-semibold text-slate-900 truncate">
                                    {item.namaPemilikRumah || item.namaPemilikGedung || item.ownerAgency || '-'}
                                  </div>
                                  {item.nikPemilik && (
                                    <div className="text-[11px] font-mono text-slate-500">NIK: {item.nikPemilik}</div>
                                  )}
                                </div>

                                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Lokasi Wilayah</div>
                                  <div className="font-semibold text-slate-900 truncate">
                                    {item.desaName || 'Desa'}, {item.kecamatanName || 'Kecamatan'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">{item.detailedAddress || '-'}</div>
                                </div>
                              </div>

                              {/* Damage & Cost Calculation */}
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Kerusakan Fisik</div>
                                  <div className="font-bold text-slate-900 text-sm">
                                    {Number(item.totalDamagePercent ?? 0).toFixed(2)}%{' '}
                                    <span className="text-xs font-normal text-slate-600">({item.damageClassification})</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] uppercase font-bold text-slate-400">Estimasi RAB</div>
                                  <div className="font-bold text-emerald-700 text-sm">
                                    {formatRupiah(item.roundedRehabCost || item.totalRehabCost || 0)}
                                  </div>
                                </div>
                              </div>

                              {/* Surveyor & Input Timestamp */}
                              <div className="bg-slate-100/80 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{item.createdByName || 'Surveyor'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                  <span>
                                    {new Date(item.createdAt).toLocaleDateString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </div>

                              {/* Photos Preview */}
                              <div>
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                                  <span className="flex items-center gap-1">
                                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                                    Foto Dokumentasi ({item.photos?.length || 0} Foto)
                                  </span>
                                  {item.photos && item.photos.length > 0 && (
                                    <button
                                      onClick={() => setPhotoViewerAssessment(item)}
                                      className="text-amber-700 hover:text-amber-800 font-semibold"
                                    >
                                      Buka Galeri Foto
                                    </button>
                                  )}
                                </div>

                                {item.photos && item.photos.length > 0 ? (
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {item.photos.slice(0, 4).map((p, pIdx) => (
                                      <div
                                        key={p.id || pIdx}
                                        onClick={() => setPhotoViewerAssessment(item)}
                                        className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer group"
                                      >
                                        <img
                                          src={p.url}
                                          alt={p.caption || 'Foto'}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-2.5 rounded-lg border border-dashed border-slate-200 text-center text-slate-400 text-[11px]">
                                    Belum ada foto yang diunggah
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetail(item)}
                              className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detail
                            </button>

                            <button
                              onClick={() => handleEdit(item)}
                              className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit
                            </button>

                            {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
                              <button
                                onClick={() => setItemToDelete(item)}
                                className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1 shadow-2xs"
                                title="Hapus catatan duplikat ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              Tip: Jika kedua survei merupakan bangunan fisik yang sama, hapus salah satu duplikat untuk menjaga keakuratan rekapitulasi data dan total anggaran bencana.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors shrink-0"
          >
            Selesai Memeriksa
          </button>
        </div>
      </div>

      {/* Purge All Duplicates Confirmation Modal */}
      {showPurgeAllConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Bersihkan Semua ({totalDuplicateRecords - duplicateGroups.length}) Data Survei Duplikat?
            </h3>
            <div className="text-sm text-slate-600 space-y-2 mb-5">
              <p>
                Sistem akan secara otomatis memeriksa <strong>{duplicateGroups.length} kluster data ganda</strong> dan melakukan:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                <li><strong>Mempertahankan 1 data utama</strong> per gedung (diprioritaskan data yang sudah diverifikasi, foto paling lengkap, atau input terbaru).</li>
                <li><strong>Menghapus permanen salinan duplikat</strong> di penyimpanan lokal, Firestore, dan cache foto.</li>
                <li>Data yang dihapus <strong>tidak akan pernah muncul kembali</strong> saat refresh halaman atau membuka link ulang.</li>
              </ul>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowPurgeAllConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handlePurgeAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Bersihkan Semua Duplikat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Data Survei Duplikat?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Anda akan menghapus data survei <strong>"{itemToDelete.buildingName}"</strong> ({itemToDelete.desaName}, {itemToDelete.kecamatanName}) yang diinput oleh <strong>{itemToDelete.createdByName}</strong>.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(itemToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-md"
              >
                Ya, Hapus Duplikat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoViewerAssessment && (
        <PhotoViewerModal
          isOpen={Boolean(photoViewerAssessment)}
          onClose={() => setPhotoViewerAssessment(null)}
          photos={photoViewerAssessment.photos || []}
          initialIndex={0}
          buildingName={photoViewerAssessment.buildingName}
          damageClassification={photoViewerAssessment.damageClassification}
          totalDamagePercent={photoViewerAssessment.totalDamagePercent}
          assessmentId={photoViewerAssessment.id}
        />
      )}
    </div>
  );
};
