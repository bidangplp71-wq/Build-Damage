import React, { useState } from 'react';
import {
  RotateCcw,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Archive,
  Layers,
  ShieldCheck,
  Eye,
  X,
  FileText,
  Calendar,
  MapPin,
  User,
  Sparkles,
  Database,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BuildingAssessment } from '../types';
import { isArchiveAssessment, isArchiveSource } from '../utils/duplicateDetector';

interface DataRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAssessment?: (item: BuildingAssessment) => void;
}

export const DataRecoveryModal: React.FC<DataRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSelectAssessment,
}) => {
  const {
    assessments,
    restoreAndRecoverAllAssessments,
    restoreDeletedAssessment,
    getDeletedAssessmentIds,
    syncFromGoogleSheet,
    googleSheetConfig,
  } = useApp();

  const [isRecovering, setIsRecovering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recent' | 'all' | 'trash'>('recent');
  const [searchKeyword, setSearchKeyword] = useState('');

  if (!isOpen) return null;

  const deletedIds = getDeletedAssessmentIds();

  // Categorize assessments
  const activeAssessments = assessments.filter((a) => !isArchiveAssessment(a) && !isArchiveSource(a.sourceSheet));
  const archiveAssessments = assessments.filter((a) => isArchiveAssessment(a) || isArchiveSource(a.sourceSheet));

  // Find records from yesterday or last 48 hours
  const now = Date.now();
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
  const recentAssessments = assessments.filter((a) => {
    const updatedTime = new Date(a.updatedAt || 0).getTime();
    const createdTime = new Date(a.createdAt || 0).getTime();
    const surveyTime = a.disasterDate ? new Date(a.disasterDate).getTime() : 0;
    return updatedTime >= fortyEightHoursAgo || createdTime >= fortyEightHoursAgo || surveyTime >= fortyEightHoursAgo;
  });

  const handleRunFullRecovery = async () => {
    setIsRecovering(true);
    setRecoveryResult(null);
    try {
      const res = await restoreAndRecoverAllAssessments();
      if (res.success) {
        setRecoveryResult(res.message);
      }
    } catch (err: any) {
      setRecoveryResult(`Gagal memulihkan: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromGoogleSheet(true, true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter list based on keyword
  const getFilteredList = () => {
    let list: BuildingAssessment[] = [];
    if (activeTab === 'recent') {
      list = recentAssessments.length > 0 ? recentAssessments : assessments.slice(0, 30);
    } else if (activeTab === 'all') {
      list = assessments;
    }

    if (!searchKeyword.trim()) return list;
    const kw = searchKeyword.toLowerCase();
    return list.filter(
      (a) =>
        a.buildingName.toLowerCase().includes(kw) ||
        (a.code && a.code.toLowerCase().includes(kw)) ||
        (a.kecamatanName && a.kecamatanName.toLowerCase().includes(kw)) ||
        (a.desaName && a.desaName.toLowerCase().includes(kw)) ||
        (a.nikPemilik && a.nikPemilik.includes(kw)) ||
        (a.createdByName && a.createdByName.toLowerCase().includes(kw))
    );
  };

  const filteredItems = getFilteredList();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Pusat Pemulihan & Pemeriksaan Data</h2>
              <p className="text-xs text-blue-200">
                Pulihkan data input kemarin, periksa sheet aktif, dan pastikan tidak ada data yang tersembunyi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Stats Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sheet Aktif
            </div>
            <div className="text-xl font-black text-slate-800 mt-1">{activeAssessments.length}</div>
            <div className="text-[10px] text-slate-400">7 Kecamatan Utama</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-blue-500" />
              Input Kemarin / Baru
            </div>
            <div className="text-xl font-black text-blue-700 mt-1">{recentAssessments.length}</div>
            <div className="text-[10px] text-blue-500 font-medium">Dalam 48 jam terakhir</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Archive className="w-3 h-3 text-amber-500" />
              Data Lama / Arsip
            </div>
            <div className="text-xl font-black text-amber-700 mt-1">{archiveAssessments.length}</div>
            <div className="text-[10px] text-slate-400">Tersimpan aman</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-indigo-500" />
              Total Seluruh Data
            </div>
            <div className="text-xl font-black text-indigo-700 mt-1">{assessments.length}</div>
            <div className="text-[10px] text-slate-400">Tersinkron di sistem</div>
          </div>
        </div>

        {/* Action Banner */}
        <div className="px-6 py-3 bg-blue-50/70 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-blue-950 font-medium max-w-xl">
            <strong>Tidak ada data yang dihapus!</strong> Jika input kemarin belum muncul di Sheet Aktif, klik tombol di sebelah kanan untuk menyelaraskan kembali dari seluruh penyimpanan lokal, server, dan Google Sheet tanpa jeda cache.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunFullRecovery}
              disabled={isRecovering}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRecovering ? 'animate-spin' : ''}`} />
              <span>{isRecovering ? 'Memulihkan Data...' : '⚡ Pulihkan Seluruh Data'}</span>
            </button>

            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : '🔄 Tarik Ulang Google Sheet'}</span>
            </button>
          </div>
        </div>

        {recoveryResult && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{recoveryResult}</span>
          </div>
        )}

        {/* Navigation Tabs & Search */}
        <div className="px-6 pt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'recent'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Input Kemarin & Terbaru ({recentAssessments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Semua Data ({assessments.length})</span>
            </button>

            {deletedIds.length > 0 && (
              <button
                onClick={() => setActiveTab('trash')}
                className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'trash'
                    ? 'border-rose-600 text-rose-600 bg-rose-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tempat Sampah / Ditekan ({deletedIds.length})</span>
              </button>
            )}
          </div>

          {activeTab !== 'trash' && (
            <div className="relative pb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari gedung, kode, pemilik..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-56"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto min-h-[250px]">
          {activeTab === 'trash' ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 font-medium">
                Daftar ID data yang sebelumnya pernah ditekan atau dihapus di peramban ini. Klik &quot;Kembalikan&quot; jika salah satunya adalah data yang ingin dipulihkan:
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {deletedIds.map((id) => (
                  <div key={id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-mono font-medium text-slate-700">{id}</span>
                    </div>
                    <button
                      onClick={() => restoreDeletedAssessment(id)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Kembalikan</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-700">Tidak ada data ditemukan</div>
              <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Silakan klik tombol &quot;Pulihkan Seluruh Data&quot; di atas untuk menarik kembali data dari seluruh penyimpanan cadangan dan Google Sheet.
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Nama Gedung / Bangunan</th>
                    <th className="py-2.5 px-3">No. Registrasi</th>
                    <th className="py-2.5 px-3">Wilayah</th>
                    <th className="py-2.5 px-3">Status Sheet</th>
                    <th className="py-2.5 px-3">Waktu Masuk</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const isArch = isArchiveAssessment(item) || isArchiveSource(item.sourceSheet);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.buildingName}</span>
                            {item.verificationStatus === 'Terverifikasi' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            )}
                          </div>
                          {(item.namaPemilikRumah || item.namaPemilikGedung || item.ownerAgency) && (
                            <div className="text-[10px] text-slate-500 font-normal">
                              Pemilik: {item.namaPemilikRumah || item.namaPemilikGedung || item.ownerAgency}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                          {item.code || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.kecamatanName || '-'}
                          {item.desaName ? `, ${item.desaName}` : ''}
                        </td>
                        <td className="py-2 px-3">
                          {isArch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Archive className="w-2.5 h-2.5" />
                              Arsip
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Aktif ({item.sourceSheet || item.targetSheetName || 'Kecamatan'})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500">
                          {item.updatedAt
                            ? new Date(item.updatedAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              onSelectAssessment?.(item);
                              onClose();
                            }}
                            className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Sistem mencatat seluruh masukan data surveyor secara permanen dan otomatis menyelaraskannya ke seluruh sheet kecamatan.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
