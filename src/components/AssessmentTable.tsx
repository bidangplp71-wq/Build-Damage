import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BuildingAssessment,
  DisasterType,
  DamageClassification,
  VerificationStatus,
  BuildingCategory,
  BUILDING_CATEGORY_CONFIGS,
} from '../types';
import { formatRupiah } from '../utils/puprCalculations';
import { exportAssessmentsToCSV, exportAssessmentsToExcelMultiSheet } from '../services/googleSheetsService';
import {
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpDown,
  Download,
  Building,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Camera,
  Layers,
  ZoomIn,
} from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

export const AssessmentTable: React.FC = () => {
  const {
    assessments,
    kecamatans,
    desas,
    currentUser,
    deleteAssessment,
    verifyAssessment,
    syncAssessmentToSheet,
    setSelectedAssessmentForDetail,
    setSelectedAssessmentForEdit,
    setActiveTab,
    showToast,
    googleSheetConfig,
  } = useApp();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedKecamatanId, setSelectedKecamatanId] = useState('');
  const [selectedDesaId, setSelectedDesaId] = useState('');
  const [selectedDisaster, setSelectedDisaster] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('');
  const [selectedVerification, setSelectedVerification] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete modal confirmation
  const [itemToDelete, setItemToDelete] = useState<BuildingAssessment | null>(null);

  // Verification modal
  const [itemToVerify, setItemToVerify] = useState<BuildingAssessment | null>(null);
  const [verifyStatusChoice, setVerifyStatusChoice] = useState<VerificationStatus>('Terverifikasi');
  const [verifyNotesInput, setVerifyNotesInput] = useState('');

  // Photo viewer lightbox state
  const [photoViewerAssessment, setPhotoViewerAssessment] = useState<BuildingAssessment | null>(null);
  const [photoViewerInitialIndex, setPhotoViewerInitialIndex] = useState(0);

  // Syncing state per ID
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const pendingVerificationCount = useMemo(() => {
    return assessments.filter((a) => a.verificationStatus === 'Menunggu Verifikasi').length;
  }, [assessments]);

  // Desas filtered by selected Kecamatan
  const availableDesas = useMemo(() => {
    if (!selectedKecamatanId) return [];
    return desas.filter((d) => d.kecamatanId === selectedKecamatanId);
  }, [desas, selectedKecamatanId]);

  // Handle Kecamatan change (resets desa if not in that kecamatan)
  const handleKecamatanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedKecamatanId(e.target.value);
    setSelectedDesaId('');
    setCurrentPage(1);
  };

  // Filtered Assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((item) => {
      // Search matches
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match =
          item.buildingName.toLowerCase().includes(q) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          item.ownerAgency.toLowerCase().includes(q) ||
          (item.namaPemilikRumah && item.namaPemilikRumah.toLowerCase().includes(q)) ||
          (item.namaPemilikGedung && item.namaPemilikGedung.toLowerCase().includes(q)) ||
          (item.nikPemilik && item.nikPemilik.includes(q)) ||
          item.kecamatanName.toLowerCase().includes(q) ||
          item.desaName.toLowerCase().includes(q) ||
          item.detailedAddress.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Category
      if (selectedCategory && item.buildingCategory !== selectedCategory) {
        return false;
      }

      // Kecamatan
      if (selectedKecamatanId && item.kecamatanId !== selectedKecamatanId) {
        return false;
      }

      // Desa
      if (selectedDesaId && item.desaId !== selectedDesaId) {
        return false;
      }

      // Disaster
      if (selectedDisaster && item.disasterType !== selectedDisaster) {
        return false;
      }

      // Damage Classification
      if (selectedClassification && item.damageClassification !== selectedClassification) {
        return false;
      }

      // Verification Status
      if (selectedVerification && item.verificationStatus !== selectedVerification) {
        return false;
      }

      return true;
    });
  }, [
    assessments,
    searchTerm,
    selectedCategory,
    selectedKecamatanId,
    selectedDesaId,
    selectedDisaster,
    selectedClassification,
    selectedVerification,
  ]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAssessments.length / pageSize) || 1;
  const paginatedAssessments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssessments.slice(start, start + pageSize);
  }, [filteredAssessments, currentPage, pageSize]);

  // Refresh Action
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Data berhasil diperbarui (Refresh selesai)', 'info');
    }, 400);
  };

  // Reset Filters
  const handleResetFilter = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedKecamatanId('');
    setSelectedDesaId('');
    setSelectedDisaster('');
    setSelectedClassification('');
    setSelectedVerification('');
    setCurrentPage(1);
    showToast('Semua filter dikembalikan ke awal', 'info');
  };

  // Delete Action
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const res = deleteAssessment(itemToDelete.id);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
    setItemToDelete(null);
  };

  // Verify Action
  const handleConfirmVerify = async () => {
    if (!itemToVerify) return;
    const res = await verifyAssessment(itemToVerify.id, verifyStatusChoice, verifyNotesInput);
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
    setItemToVerify(null);
    setVerifyNotesInput('');
  };

  // Individual Sync to Google Sheet
  const handleSyncSingle = async (item: BuildingAssessment) => {
    setSyncingId(item.id);
    try {
      const res = await syncAssessmentToSheet(item.id);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast('Gagal sinkronisasi data ke Google Sheet', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  // Badges styling
  const getClassificationBadge = (cls: DamageClassification) => {
    switch (cls) {
      case 'Rusak Ringan':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Rusak Sedang':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Rusak Berat':
      case 'Rusak Sangat Berat':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'Terverifikasi':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'Menunggu Verifikasi':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'Perlu Revisi':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'Ditolak':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Role-Specific Context Banner */}
      {currentUser.role === 'admin_verifikator' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Mode Tim Ahli Verifikator (TABG PUPR)</span>
              <p className="text-slate-600 text-[11px] mt-0.5">
                Periksa bukti visual foto lapangan, validasi kelayakan teknis 8 komponen, dan tetapkan status verifikasi pada tombol ikon perisai (<span className="font-bold text-amber-800">Aksi &gt; Validasi</span>).
              </p>
            </div>
          </div>
          {pendingVerificationCount > 0 && (
            <button
              onClick={() => {
                setSelectedVerification('Menunggu Verifikasi');
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              Tampilkan Antrean ({pendingVerificationCount})
            </button>
          )}
        </div>
      )}

      {currentUser.role === 'admin_publik' && (
        <div className="bg-sky-50 border border-sky-300 rounded-2xl p-3.5 flex items-center gap-3 text-xs shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900">Portal Informasi & Keterbukaan Publik</span>
            <p className="text-slate-600 text-[11px] mt-0.5">
              Cari dan telusuri status klasifikasi kerusakan gedung pasca bencana secara transparan. Klik tombol mata untuk melihat formulir penilaian resmi & cetak laporan.
            </p>
          </div>
        </div>
      )}

      {/* Header Bar: Title, Count, and Global Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>
              {currentUser.role === 'admin_verifikator'
                ? 'Verifikasi & Data Penilaian Kerusakan Gedung'
                : currentUser.role === 'admin_publik'
                ? 'Pencarian Status Kerusakan Bangunan'
                : 'Daftar Penilaian Kerusakan Gedung'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              {filteredAssessments.length} Data
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentUser.role === 'admin_verifikator'
              ? 'Audit foto lapangan, verifikasi data teknis & status persetujuan bencana'
              : currentUser.role === 'admin_publik'
              ? 'Informasi resmi klasifikasi kerusakan bangunan standar Permen PUPR No. 22/2018'
              : 'Kelola, perbarui, cetak formulir resmi PUPR, dan sinkronkan data ke Google Sheet'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            title="Muat ulang tabel"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Export to Excel Multi-Sheet per Kecamatan */}
          <button
            onClick={() => exportAssessmentsToExcelMultiSheet(filteredAssessments, kecamatans)}
            title="Download file Excel (.xlsx) dengan 1 Tab per Kecamatan + Ringkasan Master"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-xl border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Excel Multi-Sheet</span>
          </button>

          {/* Export to CSV */}
          <button
            onClick={() => exportAssessmentsToCSV(filteredAssessments)}
            title="Download file CSV untuk Google Sheet / Excel"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {/* Direct Google Sheet button */}
          {googleSheetConfig.spreadsheetUrl && (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka dokumen Google Spreadsheet langsung di tab baru"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 rounded-xl border border-emerald-300 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-700" />
            </a>
          )}

          {/* Add New Assessment (Hidden for Public) */}
          {currentUser.role !== 'admin_publik' && (
            <button
              onClick={() => {
                setSelectedAssessmentForEdit(null);
                setActiveTab('input_baru');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors ml-auto sm:ml-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Input Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Category Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => {
            setSelectedCategory('');
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            !selectedCategory
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Semua Kategori</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${!selectedCategory ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {assessments.length}
          </span>
        </button>

        {(Object.keys(BUILDING_CATEGORY_CONFIGS) as BuildingCategory[]).map((catKey) => {
          const cfg = BUILDING_CATEGORY_CONFIGS[catKey];
          const count = assessments.filter((a) => (a.buildingCategory || 'Gedung Pemerintah') === catKey).length;
          const isSelected = selectedCategory === catKey;

          return (
            <button
              key={catKey}
              type="button"
              onClick={() => {
                setSelectedCategory(catKey);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{cfg.shortLabel}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isSelected ? 'bg-amber-600/30 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari gedung, kode, pemilik, alamat..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-slate-50/50"
            />
          </div>

          {/* Filter Kecamatan */}
          <div>
            <select
              value={selectedKecamatanId}
              onChange={handleKecamatanChange}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="">Semua Kecamatan ({kecamatans.length})</option>
              {kecamatans.map((kec) => (
                <option key={kec.id} value={kec.id}>
                  Kec. {kec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Desa (Dependent on selected Kecamatan) */}
          <div>
            <select
              value={selectedDesaId}
              onChange={(e) => {
                setSelectedDesaId(e.target.value);
                setCurrentPage(1);
              }}
              disabled={!selectedKecamatanId}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-slate-50/50 font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {selectedKecamatanId
                  ? `Pilih Desa / Kelurahan (${availableDesas.length})`
                  : 'Pilih Kecamatan Dahulu'}
              </option>
              {availableDesas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.type} {d.name} {d.isPemekaran ? '(Pemekaran)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Tingkat Kerusakan */}
          <div>
            <select
              value={selectedClassification}
              onChange={(e) => {
                setSelectedClassification(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="">Semua Tingkat Kerusakan</option>
              <option value="Rusak Ringan">Rusak Ringan (&lt;30%)</option>
              <option value="Rusak Sedang">Rusak Sedang (30% - 45%)</option>
              <option value="Rusak Berat">Rusak Berat (&gt;45% - 65%)</option>
              <option value="Rusak Sangat Berat">Rusak Sangat Berat / Hancur (&gt;65%)</option>
            </select>
          </div>
        </div>

        {/* Second Row of Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Category */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="">Semua Kategori Bangunan</option>
              {(Object.keys(BUILDING_CATEGORY_CONFIGS) as BuildingCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {BUILDING_CATEGORY_CONFIGS[cat].name}
                </option>
              ))}
            </select>

            {/* Filter Disaster */}
            <select
              value={selectedDisaster}
              onChange={(e) => {
                setSelectedDisaster(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="">Semua Jenis Bencana</option>
              <option value="Gempa Bumi">Gempa Bumi</option>
              <option value="Banjir">Banjir</option>
              <option value="Tanah Longsor">Tanah Longsor</option>
              <option value="Angin Puting Beliung">Angin Puting Beliung</option>
              <option value="Tsunami">Tsunami</option>
              <option value="Kebakaran">Kebakaran</option>
              <option value="Likuefaksi">Likuefaksi</option>
              <option value="Erupsi Gunung Api">Erupsi Gunung Api</option>
              <option value="Bencana Lainnya">Bencana Lainnya</option>
            </select>

            {/* Filter Verification Status */}
            <select
              value={selectedVerification}
              onChange={(e) => {
                setSelectedVerification(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value="">Semua Status Validasi</option>
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              <option value="Terverifikasi">Terverifikasi</option>
              <option value="Perlu Revisi">Perlu Revisi</option>
              <option value="Ditolak">Ditolak</option>
            </select>
          </div>

          {(searchTerm ||
            selectedKecamatanId ||
            selectedDesaId ||
            selectedDisaster ||
            selectedClassification ||
            selectedVerification) && (
            <button
              onClick={handleResetFilter}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3">Kode & Nama Bangunan</th>
                <th className="py-3 px-3">Bencana</th>
                <th className="py-3 px-3">Wilayah (Kec/Desa)</th>
                <th className="py-3 px-3 text-center">Luas (M2)</th>
                <th className="py-3 px-3 text-center">Kerusakan (%)</th>
                <th className="py-3 px-3 text-right">Ajuan RAB Rehab</th>
                <th className="py-3 px-3 text-center">Validasi</th>
                <th className="py-3 px-3 text-center">Google Sheet</th>
                <th className="py-3 px-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedAssessments.map((item, index) => {
                const rowNo = (currentPage - 1) * pageSize + index + 1;
                const canEdit =
                  currentUser.role === 'super_admin' ||
                  currentUser.role === 'admin' ||
                  currentUser.id === item.createdBy;
                const canDelete =
                  currentUser.role === 'super_admin' || currentUser.role === 'admin';
                const canVerify =
                  currentUser.role === 'super_admin' ||
                  currentUser.role === 'admin_verifikator';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                    {/* Row No */}
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">
                      {rowNo}
                    </td>

                    {/* Building Name & Code */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.buildingName}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-1">
                        {item.code ? (
                          <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {item.code}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            Tanpa No. Reg
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            BUILDING_CATEGORY_CONFIGS[item.buildingCategory || 'Gedung Pemerintah']?.badgeClass ||
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {BUILDING_CATEGORY_CONFIGS[item.buildingCategory || 'Gedung Pemerintah']?.shortLabel ||
                            item.buildingCategory ||
                            'Gedung Pemerintah'}
                        </span>
                        <span>&bull;</span>
                        <span className="text-slate-600 truncate max-w-[150px]" title={item.buildingCategory === 'Hunian Masyarakat' ? `Pemilik Rumah: ${item.namaPemilikRumah || item.ownerAgency}` : `Pemilik Gedung: ${item.namaPemilikGedung || item.ownerAgency}`}>
                          {item.buildingCategory === 'Hunian Masyarakat' ? 'Pemilik: ' : 'Pengelola: '}
                          <strong>{item.buildingCategory === 'Hunian Masyarakat' ? (item.namaPemilikRumah || item.ownerAgency) : (item.namaPemilikGedung || item.ownerAgency)}</strong>
                        </span>
                      </div>
                    </td>

                    {/* Disaster Type */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium text-[11px] border border-slate-200">
                        {item.disasterType}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.disasterDate}
                      </div>
                    </td>

                    {/* Wilayah */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">
                        Kec. {item.kecamatanName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.desaName}
                      </div>
                    </td>

                    {/* Floor Area */}
                    <td className="py-3 px-3 text-center font-medium text-slate-800">
                      {item.totalFloorAreaM2} m²
                    </td>

                    {/* Damage % and Badge */}
                    <td className="py-3 px-3 text-center">
                      <div className="font-bold text-sm text-slate-900">
                        {item.totalDamagePercent.toFixed(2)}%
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${getClassificationBadge(
                          item.damageClassification
                        )}`}
                      >
                        {item.damageClassification}
                      </span>
                    </td>

                    {/* Rehab Cost */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-bold text-slate-900">
                        {formatRupiah(item.roundedRehabCost)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatRupiah(item.totalCostPerM2)} / m²
                      </div>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getVerificationBadge(
                          item.verificationStatus
                        )}`}
                      >
                        {item.verificationStatus}
                      </span>
                      {item.verifiedBy && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[90px] mx-auto mt-0.5">
                          oleh {item.verifiedBy.split(' ')[0]}
                        </div>
                      )}
                    </td>

                    {/* Google Sheet Storage Status */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleSyncSingle(item)}
                        disabled={syncingId === item.id}
                        title={
                          item.googleSheetSynced
                            ? 'Tersimpan langsung di tautan Google Sheet. Klik untuk kirim pembaruan ulang.'
                            : 'Kirim data ini ke Google Sheet sekarang'
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all shadow-2xs ${
                          item.googleSheetSynced
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <FileSpreadsheet
                          className={`w-3 h-3 shrink-0 ${
                            syncingId === item.id ? 'animate-spin text-emerald-600' : 'text-emerald-600'
                          }`}
                        />
                        <span>{item.googleSheetSynced ? 'Tersimpan' : 'Kirim'}</span>
                      </button>
                    </td>

                    {/* Actions Column */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Detail / View Report button */}
                        <button
                          onClick={() => setSelectedAssessmentForDetail(item)}
                          title="Lihat Formulir Penilaian Cepat PUPR & Cetak"
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Photo Viewer Button */}
                        {item.photos && item.photos.length > 0 ? (
                          <button
                            onClick={() => {
                              setPhotoViewerAssessment(item);
                              setPhotoViewerInitialIndex(0);
                            }}
                            title={`Lihat ${item.photos.length} Foto Visual Kerusakan Gedung`}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-600" />
                            <span>{item.photos.length}</span>
                          </button>
                        ) : (
                          <span
                            title="Belum ada foto visual"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-300 border border-slate-100 flex items-center justify-center cursor-not-allowed"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </span>
                        )}

                        {/* Edit Button (Hidden for Public) */}
                        {currentUser.role !== 'admin_publik' && (
                          <button
                            onClick={() => {
                              if (!canEdit) {
                                showToast(
                                  'Akses ditolak: Anda hanya dapat mengedit survei yang Anda buat, kecuali Super Admin/Admin.',
                                  'error'
                                );
                                return;
                              }
                              setSelectedAssessmentForEdit(item);
                              setActiveTab('input_baru');
                            }}
                            title="Edit Penilaian"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Update / Verify Button */}
                        {canVerify && (
                          <button
                            onClick={() => {
                              setItemToVerify(item);
                              setVerifyStatusChoice(item.verificationStatus);
                              setVerifyNotesInput(item.verificationNotes || '');
                            }}
                            title="Update Status Validasi Teknis"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Button (Super Admin & Admin Only) */}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                            }}
                            title="Hapus Data"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedAssessments.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Building className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">Tidak ada data penilaian yang cocok</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Coba ubah kata kunci pencarian atau sesuaikan pilihan filter kecamatan dan desa.
                    </p>
                    <button
                      onClick={handleResetFilter}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Bersihkan Semua Filter
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value={5}>5 Baris</option>
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
            </select>
            <span className="text-slate-400">&bull;</span>
            <span>
              Menampilkan{' '}
              <strong className="text-slate-800">
                {filteredAssessments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              -{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, filteredAssessments.length)}
              </strong>{' '}
              dari <strong className="text-slate-800">{filteredAssessments.length}</strong> data
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800">
              Halaman {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Delete Confirmation */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Penilaian</h3>
            <p className="text-xs text-slate-600 mt-2">
              Apakah Anda yakin ingin menghapus data penilaian gedung{' '}
              <strong className="text-slate-900">"{itemToDelete.buildingName}"</strong> ({itemToDelete.code})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors"
              >
                Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Verification / Update Validation */}
      {itemToVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>Validasi Teknis Penilaian PUPR</span>
              </h3>
              <button
                onClick={() => setItemToVerify(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900">{itemToVerify.buildingName}</div>
                <div className="text-slate-500 mt-0.5">
                  Kec. {itemToVerify.kecamatanName} &bull; {itemToVerify.desaName} &bull; Kerusakan:{' '}
                  <strong className="text-slate-800">{itemToVerify.totalDamagePercent}% ({itemToVerify.damageClassification})</strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Verifikasi:</label>
                <select
                  value={verifyStatusChoice}
                  onChange={(e) => setVerifyStatusChoice(e.target.value as VerificationStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Terverifikasi">Terverifikasi (Disetujui Standar PUPR)</option>
                  <option value="Menunggu Verifikasi">Menunggu Verifikasi Tambahan</option>
                  <option value="Perlu Revisi">Perlu Revisi Lapangan</option>
                  <option value="Ditolak">Ditolak (Tidak Memenuhi Kriteria)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Verifikator / Tim Ahli Struktur:
                </label>
                <textarea
                  rows={3}
                  value={verifyNotesInput}
                  onChange={(e) => setVerifyNotesInput(e.target.value)}
                  placeholder="Contoh: Perhitungan kerusakan komponen kolom dan gording telah sesuai. Disetujui untuk pengajuan rehabilitasi TA 2026."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setItemToVerify(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmVerify}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
              >
                Simpan Validasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoomable Photo Lightbox Viewer */}
      {photoViewerAssessment && photoViewerAssessment.photos && photoViewerAssessment.photos.length > 0 && (
        <PhotoViewerModal
          photos={photoViewerAssessment.photos}
          initialIndex={photoViewerInitialIndex}
          buildingTitle={`${photoViewerAssessment.buildingName} (${photoViewerAssessment.code || 'Tanpa No. Reg'})`}
          onClose={() => setPhotoViewerAssessment(null)}
        />
      )}
    </div>
  );
};
