import React, { useState, useMemo, useEffect } from 'react';
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
  detectAllDuplicateGroups,
  getDuplicateIdsMap,
  DuplicateGroup,
} from '../utils/duplicateDetector';
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
  AlertTriangle,
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
  Copy,
  Folder,
  MessageSquare,
  Edit3,
  Sparkles,
  Lock,
  BookOpen,
  ArrowRightLeft,
} from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';
import { DuplicateAuditModal } from './DuplicateAuditModal';
import { DataFulfillmentCard } from './DataFulfillmentCard';
import { PortfolioRecapModal } from './PortfolioRecapModal';
import { BufferQueueBanner } from './BufferQueueBanner';
import { SheetBookSelector } from './SheetBookSelector';

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
    syncFromGoogleSheet,
    consolidateAndSyncSheets,
    sheetSyncProgress,
  } = useApp();

  const [isConsolidating, setIsConsolidating] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedKecamatanId, setSelectedKecamatanId] = useState('');
  const [selectedDesaId, setSelectedDesaId] = useState('');
  const [selectedDisaster, setSelectedDisaster] = useState('');
  const [selectedClassification, setSelectedClassification] = useState('');
  const [selectedVerification, setSelectedVerification] = useState('');
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>('ALL');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Portfolio Recap Modal State
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);

  // Recently submitted assessment highlight & toast
  const [recentlySubmittedId, setRecentlySubmittedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const justSubmitted = sessionStorage.getItem('sipandu_just_submitted_id');
      if (justSubmitted) {
        setRecentlySubmittedId(justSubmitted);
        sessionStorage.removeItem('sipandu_just_submitted_id');
        // Clear filters so new entry is 100% visible at the top immediately
        setSearchTerm('');
        setSelectedCategory('');
        setSelectedKecamatanId('');
        setSelectedDesaId('');
        setSelectedClassification('');
        setSelectedVerification('');
        setShowOnlyDuplicates(false);
        setCurrentPage(1);

        const timer = setTimeout(() => {
          setRecentlySubmittedId(null);
        }, 15000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [assessments.length]);

  // Pagination State - defaults to 200 so 179+ rows display all at once
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sipandu_table_page_size');
      if (saved) {
        const num = Number(saved);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch {}
    return 200;
  });

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

  // Duplicate detection & audit states
  const [showDuplicateAuditModal, setShowDuplicateAuditModal] = useState(false);
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [ignoredDuplicatePairs, setIgnoredDuplicatePairs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sipandu_ignored_duplicates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleIgnoreDuplicatePair = (idAOrPairKey: string, idB?: string) => {
    setIgnoredDuplicatePairs((prev) => {
      const keysToAdd: string[] = [];
      if (idB) {
        keysToAdd.push(`${idAOrPairKey}:::${idB}`);
        keysToAdd.push(`${idB}:::${idAOrPairKey}`);
        keysToAdd.push([idAOrPairKey, idB].sort().join(':::'));
        keysToAdd.push(idAOrPairKey);
        keysToAdd.push(idB);
      } else {
        keysToAdd.push(idAOrPairKey);
      }
      const updated = Array.from(new Set([...prev, ...keysToAdd]));
      try {
        localStorage.setItem('sipandu_ignored_duplicates', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearIgnoredDuplicates = () => {
    setIgnoredDuplicatePairs([]);
    try {
      localStorage.removeItem('sipandu_ignored_duplicates');
    } catch {}
    showToast('Daftar duplikasi yang diabaikan telah dibersihkan', 'info');
  };

  // Detect all duplicate groups
  const duplicateGroups = useMemo(() => {
    return detectAllDuplicateGroups(assessments, ignoredDuplicatePairs);
  }, [assessments, ignoredDuplicatePairs]);

  // Map of assessmentId -> info for fast lookup
  const duplicateMap = useMemo(() => {
    return getDuplicateIdsMap(duplicateGroups);
  }, [duplicateGroups]);

  const pendingVerificationCount = useMemo(() => {
    return assessments.filter((a) => a.verificationStatus === 'Menunggu Verifikasi').length;
  }, [assessments]);

  const needsRevisionCount = useMemo(() => {
    return assessments.filter((a) => a.verificationStatus === 'Perlu Revisi').length;
  }, [assessments]);

  const [itemToViewNotes, setItemToViewNotes] = useState<BuildingAssessment | null>(null);

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

  // Filtered Assessments with flexible matching and newest-first sort
  const filteredAssessments = useMemo(() => {
    const selKec = selectedKecamatanId ? kecamatans.find((k) => k.id === selectedKecamatanId) : undefined;
    const selDesa = selectedDesaId ? desas.find((d) => d.id === selectedDesaId) : undefined;

    return assessments
      .filter((item) => {
        // Duplicate only filter
        if (showOnlyDuplicates && !duplicateMap.has(item.id)) {
          return false;
        }

        // Search matches across all key fields
        if (searchTerm) {
          const q = searchTerm.toLowerCase().trim();
          const match =
            (item.buildingName && item.buildingName.toLowerCase().includes(q)) ||
            (item.code && item.code.toLowerCase().includes(q)) ||
            (item.ownerAgency && item.ownerAgency.toLowerCase().includes(q)) ||
            (item.namaPemilikRumah && item.namaPemilikRumah.toLowerCase().includes(q)) ||
            (item.namaPemilikGedung && item.namaPemilikGedung.toLowerCase().includes(q)) ||
            (item.nikPemilik && item.nikPemilik.includes(q)) ||
            (item.kecamatanName && item.kecamatanName.toLowerCase().includes(q)) ||
            (item.desaName && item.desaName.toLowerCase().includes(q)) ||
            (item.detailedAddress && item.detailedAddress.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Category (case-insensitive and tolerant)
        if (selectedCategory) {
          const cat = (item.buildingCategory || 'Gedung Pemerintah').toLowerCase();
          if (cat !== selectedCategory.toLowerCase()) return false;
        }

        // Kecamatan (match ID or name)
        if (selectedKecamatanId) {
          const matchKecId = item.kecamatanId === selectedKecamatanId;
          const matchKecName = selKec && item.kecamatanName && item.kecamatanName.toLowerCase().trim() === selKec.name.toLowerCase().trim();
          if (!matchKecId && !matchKecName) return false;
        }

        // Desa (match ID or name)
        if (selectedDesaId) {
          const matchDesaId = item.desaId === selectedDesaId;
          const matchDesaName = selDesa && item.desaName && item.desaName.toLowerCase().trim() === selDesa.name.toLowerCase().trim();
          if (!matchDesaId && !matchDesaName) return false;
        }

        // Disaster
        if (selectedDisaster && item.disasterType !== selectedDisaster) {
          return false;
        }

        // Damage Classification (case-insensitive)
        if (selectedClassification) {
          const currentClass = (item.damageClassification || '').toLowerCase().trim();
          if (currentClass !== selectedClassification.toLowerCase().trim()) return false;
        }

        // Verification Status
        if (selectedVerification && item.verificationStatus !== selectedVerification) {
          return false;
        }

        // Spreadsheet Profile Filter (Daftar Halaman Buku)
        if (selectedProfileFilter && selectedProfileFilter !== 'ALL') {
          const itemProfileId = item.targetProfileId || (googleSheetConfig.spreadsheetProfiles?.[0]?.id || 'profile_primary_2026');
          if (itemProfileId !== selectedProfileFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort newest first so all incoming data is instantly visible at the top
        const tA = new Date(a.updatedAt || a.createdAt || a.assessmentDate || 0).getTime();
        const tB = new Date(b.updatedAt || b.createdAt || b.assessmentDate || 0).getTime();
        return tB - tA;
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
    selectedProfileFilter,
    googleSheetConfig.spreadsheetProfiles,
    showOnlyDuplicates,
    duplicateMap,
    kecamatans,
    desas,
  ]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAssessments.length / pageSize) || 1;
  const paginatedAssessments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssessments.slice(start, start + pageSize);
  }, [filteredAssessments, currentPage, pageSize]);

  // Batch Selection for Multi-Sheet Move
  const pageRowIds = useMemo(() => paginatedAssessments.map((a) => a.id), [paginatedAssessments]);
  const isAllPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIds.includes(id));
  const isSomePageSelected = pageRowIds.some((id) => selectedRowIds.includes(id)) && !isAllPageSelected;

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedRowIds((prev) => prev.filter((id) => !pageRowIds.includes(id)));
    } else {
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...pageRowIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Refresh Action - Pull fresh records from Google Sheet starting from row A2
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (googleSheetConfig.spreadsheetUrl) {
        await syncFromGoogleSheet(true);
      } else {
        showToast('Data berhasil diperbarui (Refresh selesai)', 'info');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Consolidate 7 kecamatan sheets into single master Rekap sheet
  const handleConsolidateSheets = async () => {
    setIsConsolidating(true);
    try {
      await consolidateAndSyncSheets();
    } finally {
      setIsConsolidating(false);
    }
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
        return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
      case 'Ditolak':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1-Hour Buffer Staging Queue Status Banner */}
      <BufferQueueBanner variant="card" />

      {/* Surveyor / Admin Revision Notification Banner */}
      {needsRevisionCount > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
              <AlertCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-rose-950">
                  {currentUser.role === 'admin_user' 
                    ? `Perhatian Surveyor: ${needsRevisionCount} Data Penilaian Memerlukan Perbaikan / Revisi` 
                    : `Informasi Verifikasi: ${needsRevisionCount} Data Survei Berstatus 'Perlu Revisi Lapangan'`}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 font-extrabold text-[10px]">
                  Tindakan Diperlukan
                </span>
              </div>
              <p className="text-rose-800 text-[11px] mt-0.5 leading-relaxed">
                {currentUser.role === 'admin_user'
                  ? 'Admin Verifikator telah memeriksa dan menyematkan catatan perbaikan teknis. Silakan buka data bertanda "Perlu Revisi" dan perbaiki sesuai instruksi.'
                  : 'Surveyor dapat melihat catatan teknis yang diberikan untuk mengedit dan mengirimkan kembali data survei.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedVerification(selectedVerification === 'Perlu Revisi' ? '' : 'Perlu Revisi');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
              selectedVerification === 'Perlu Revisi'
                ? 'bg-slate-900 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              {selectedVerification === 'Perlu Revisi' ? 'Tampilkan Semua Data' : `Filter Perlu Revisi (${needsRevisionCount})`}
            </span>
          </button>
        </div>
      )}

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

      {/* DUPLICATE DETECTION PROACTIVE ALERT BANNER */}
      {duplicateGroups.length > 0 && (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'admin_verifikator') && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md border border-amber-300/80 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 font-black shadow-xs">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm text-slate-950">
                  Peringatan Duplikasi Data: Terdeteksi {duplicateGroups.length} Kelompok / Pasang Survei Ganda
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-300 font-bold text-[10px]">
                  {duplicateGroups.reduce((acc, g) => acc + g.items.length, 0)} Total Survei Terduplikasi
                </span>
              </div>
              <p className="text-xs text-amber-950/90 font-medium mt-0.5">
                Terdapat entri survei dengan nama, kode, atau pemilik & lokasi yang sama persis / sangat serupa. Admin dapat memeriksa dan menghapus data input ganda agar rekapitulasi data tidak terhitung dobel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => {
                setShowOnlyDuplicates(!showOnlyDuplicates);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                showOnlyDuplicates
                  ? 'bg-white text-slate-950 border border-slate-300'
                  : 'bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 border border-slate-950/30'
              }`}
            >
              {showOnlyDuplicates ? 'Tampilkan Semua Data' : 'Filter Data Ganda'}
            </button>
            <button
              onClick={() => setShowDuplicateAuditModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-400 font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Audit & Bersihkan ({duplicateGroups.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MULTI-SPREADSHEET "DAFTAR HALAMAN BUKU" QUICK SWITCHER & CAPACITY MONITOR */}
      <SheetBookSelector
        variant="compact"
        selectedViewProfileId={selectedProfileFilter}
        onSelectViewProfile={(pId) => {
          setSelectedProfileFilter(pId);
          setCurrentPage(1);
        }}
        selectedAssessmentIds={selectedRowIds}
        onMovedSuccess={() => {
          setSelectedRowIds([]);
        }}
      />

      {/* PEMENUHAN TARGET DATA QUOTA PROGRESS (COMPACT) */}
      <DataFulfillmentCard compact />

      {/* LIVE GOOGLE SHEET PROGRESS STATUS BAR */}
      {sheetSyncProgress && sheetSyncProgress.isLoading && (
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-2 border-blue-500/50 rounded-2xl p-4 text-white shadow-lg animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Proses Membaca Google Sheet ({sheetSyncProgress.percent}%)
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700 font-mono">
                    Tahap {sheetSyncProgress.currentStep} dari {sheetSyncProgress.totalSteps}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sedang membaca: <span className="text-white font-bold">{sheetSyncProgress.currentKecamatan ? `Kecamatan ${sheetSyncProgress.currentKecamatan}` : 'Menghubungkan...'}</span> ({sheetSyncProgress.totalLoaded} gedung terdeteksi)
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-cyan-400">
                {sheetSyncProgress.percent}%
              </span>
            </div>
          </div>

          {/* Progress Bar Line */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden my-2 border border-slate-700">
            <div
              className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, sheetSyncProgress.percent)}%` }}
            />
          </div>

          {/* Step badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 mt-2.5 pt-2 border-t border-slate-800 text-[11px]">
            {sheetSyncProgress.loadedKecamatans.map((kec) => (
              <div
                key={kec.name}
                className={`px-2 py-1 rounded-lg flex items-center justify-between text-xs transition-colors ${
                  kec.status === 'completed'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : kec.status === 'loading'
                    ? 'bg-blue-900 text-cyan-200 border border-cyan-400 font-bold animate-pulse'
                    : 'bg-slate-800/60 text-slate-400 border border-slate-700/40'
                }`}
              >
                <span className="truncate">{kec.name}</span>
                {kec.status === 'completed' ? (
                  <span className="text-[10px] text-emerald-400 font-mono shrink-0 ml-1">+{kec.count}</span>
                ) : kec.status === 'loading' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping shrink-0 ml-1" />
                ) : (
                  <span className="text-[10px] text-slate-500 shrink-0 ml-1">-</span>
                )}
              </div>
            ))}
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
            {duplicateGroups.length > 0 && (
              <span
                onClick={() => setShowDuplicateAuditModal(true)}
                className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300 flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition-colors"
                title="Klik untuk membuka audit data ganda"
              >
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{duplicateGroups.length} Ganda</span>
              </span>
            )}
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
          {/* Audit Data Ganda button for Admin */}
          {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
            <button
              onClick={() => setShowDuplicateAuditModal(true)}
              title="Audit dan kelola data survei yang diinput ganda"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                duplicateGroups.length > 0
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${duplicateGroups.length > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
              <span>Audit Data Ganda ({duplicateGroups.length})</span>
            </button>
          )}

          {/* Quick toggle: Tampilkan Semua Sekaligus */}
          <button
            onClick={() => {
              const isShowingAll = pageSize >= filteredAssessments.length && pageSize >= 200;
              const newSize = isShowingAll ? 25 : Math.max(filteredAssessments.length, 500);
              setPageSize(newSize);
              setCurrentPage(1);
              try {
                localStorage.setItem('sipandu_table_page_size', String(newSize));
              } catch {}
            }}
            title="Tampilkan seluruh data penilaian secara langsung tanpa terpecah halaman"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer shadow-2xs ${
              pageSize >= filteredAssessments.length && pageSize >= 100
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{pageSize >= filteredAssessments.length && pageSize >= 100 ? `Tampil Sekaligus (${filteredAssessments.length})` : 'Tampilkan Sekaligus'}</span>
          </button>

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

          {/* Cetak Portofolio Rekapitulasi Resmi */}
          <button
            onClick={() => setShowPortfolioModal(true)}
            title="Cetak Buku Rekapitulasi Portofolio Penilaian Kerusakan Bangunan format A4 Resmi"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl border border-amber-500 shadow-2xs transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-950" />
            <Printer className="w-3.5 h-3.5 text-amber-950" />
            <span>Cetak Portofolio Rekap</span>
          </button>

          {/* Direct Google Sheet button */}
          {googleSheetConfig.spreadsheetUrl && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => syncFromGoogleSheet(true, true)}
                disabled={isRefreshing || isConsolidating}
                title="Tarik seluruh data survei langsung dari ke-7 Sheet Kecamatan"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Tarik dari 7 Sheet</span>
              </button>
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
            </div>
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
            selectedVerification ||
            selectedCategory ||
            showOnlyDuplicates) && (
            <button
              onClick={handleResetFilter}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Active Data Count Banner & Recently Submitted Notification */}
      {recentlySubmittedId && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-emerald-950">
                ✓ Penilaian Baru Berhasil Masuk Sekali Input!
              </h4>
              <p className="text-xs text-emerald-800 font-medium">
                Data penilaian langsung tersimpan permanen dan ditandai pada baris tabel di bawah.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRecentlySubmittedId(null)}
            className="p-1.5 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-lg cursor-pointer"
            title="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Total Data Sistem:{' '}
            <strong className="text-slate-900 font-bold font-mono">{assessments.length}</strong> Bangunan
          </span>
          {filteredAssessments.length !== assessments.length && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold text-[11px]">
              Menampilkan {filteredAssessments.length} data tersaring
            </span>
          )}
        </div>
        {filteredAssessments.length !== assessments.length && (
          <button
            onClick={handleResetFilter}
            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
          >
            Tampilkan Semua Data ({assessments.length})
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50 uppercase tracking-wider">
                <th className="py-3 px-2 text-center w-8">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomePageSelected;
                    }}
                    onChange={toggleSelectAllPage}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Pilih seluruh baris pada halaman ini untuk dipindahkan ke volume sheet lain"
                  />
                </th>
                <th className="py-3 px-2 text-center w-10">No</th>
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
                const isRecentlySubmitted = item.id === recentlySubmittedId;
                const isSelectedRow = selectedRowIds.includes(item.id);
                const isVerified = item.verificationStatus === 'Terverifikasi';
                const canEdit =
                  !isVerified &&
                  (currentUser.role === 'super_admin' ||
                    currentUser.role === 'admin' ||
                    currentUser.role === 'admin_user' ||
                    currentUser.id === item.createdBy);
                const canDelete =
                  !isVerified &&
                  (currentUser.role === 'super_admin' ||
                    currentUser.role === 'admin' ||
                    currentUser.role === 'admin_verifikator');
                const canVerify =
                  currentUser.role === 'super_admin' ||
                  currentUser.role === 'admin' ||
                  currentUser.role === 'admin_verifikator';

                return (
                  <tr
                    key={item.id}
                    className={
                      isSelectedRow
                        ? 'bg-blue-50/90 border-l-4 border-blue-600 transition-colors'
                        : isRecentlySubmitted
                        ? 'bg-emerald-50/90 border-2 border-emerald-500 shadow-sm transition-colors'
                        : 'hover:bg-slate-50/75 transition-colors'
                    }
                  >
                    {/* Selection Checkbox */}
                    <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelectedRow}
                        onChange={() => toggleSelectRow(item.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Pilih data untuk dipindahkan antar sheet"
                      />
                    </td>

                    {/* Row No */}
                    <td className="py-3 px-2 text-center text-slate-400 font-medium">
                      {rowNo}
                    </td>

                    {/* Building Name & Code */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900">{item.buildingName}</span>
                        {isRecentlySubmitted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-xs animate-pulse">
                            <Check className="w-3 h-3" /> Baru Masuk
                          </span>
                        )}
                        {item.targetProfileName && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-bold">
                            <BookOpen className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[110px]">{item.targetProfileName}</span>
                          </span>
                        )}
                        {duplicateMap.has(item.id) && (
                          <button
                            type="button"
                            onClick={() => setShowDuplicateAuditModal(true)}
                            title={`Peringatan: Data ini terdeteksi ganda (${duplicateMap.get(item.id)!.group.reason}). Klik untuk audit.`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Ganda ({duplicateMap.get(item.id)!.count}x)</span>
                          </button>
                        )}
                      </div>
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
                        <span className="text-slate-600 truncate max-w-[170px]" title={item.buildingCategory === 'Hunian Masyarakat' ? `Pemilik Rumah: ${item.namaPemilikRumah || item.ownerAgency || '-'}` : `Kepemilikan: ${item.namaPemilikGedung && item.namaPemilikGedung !== '0' ? item.namaPemilikGedung : (item.ownerAgency && item.ownerAgency !== '0') ? item.ownerAgency : 'Pemerintah'}`}>
                          {item.buildingCategory === 'Hunian Masyarakat' ? 'Pemilik: ' : 'Kepemilikan: '}
                          <strong>
                            {item.buildingCategory === 'Hunian Masyarakat'
                              ? (item.namaPemilikRumah || item.ownerAgency || '-')
                              : ((item.namaPemilikGedung && item.namaPemilikGedung !== '0')
                                  ? item.namaPemilikGedung
                                  : (item.ownerAgency && item.ownerAgency !== '0')
                                    ? item.ownerAgency
                                    : 'Pemerintah')}
                          </strong>
                        </span>
                      </div>

                      {/* Catatan Perbaikan Admin Box if Status is Perlu Revisi */}
                      {item.verificationStatus === 'Perlu Revisi' && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-left shadow-2xs space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-800">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />
                              Catatan Perbaikan Verifikator:
                            </span>
                            {item.verifiedBy && (
                              <span className="text-[10px] text-rose-700 font-semibold bg-rose-100/80 px-1.5 py-0.5 rounded">
                                Oleh: {item.verifiedBy.split(' ')[0]}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-rose-900 leading-snug whitespace-pre-wrap">
                            "{item.verificationNotes || 'Mohon periksa kembali isian komponen kerusakan, luas lantai, atau dokumentasi foto visual.'}"
                          </p>
                          <div className="flex items-center gap-2 pt-1 border-t border-rose-200/80">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAssessmentForEdit(item);
                                  setActiveTab('input_baru');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] shadow-xs cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Periksa & Edit Data Sekarang &rarr;</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setItemToViewNotes(item)}
                              className="text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                            >
                              Detail Catatan
                            </button>
                          </div>
                        </div>
                      )}
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
                      <div className="mt-1">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-semibold"
                          title={`Asal Tab Google Sheet: ${item.sourceSheet || (`Kec. ` + item.kecamatanName)}${item.sheetRowNumber ? ` (Baris ke-${item.sheetRowNumber})` : ''}`}
                        >
                          <FileSpreadsheet className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate max-w-[130px]">{item.sourceSheet || `Kec. ${item.kecamatanName}`}</span>
                          {item.sheetRowNumber && (
                            <span className="font-mono text-blue-700 bg-blue-100/70 px-1 rounded text-[9px]">
                              #{item.sheetRowNumber}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Floor Area */}
                    <td className="py-3 px-3 text-center font-medium text-slate-800">
                      {item.totalFloorAreaM2} m²
                    </td>

                    {/* Damage % and Badge */}
                    <td className="py-3 px-3 text-center">
                      <div className="font-bold text-sm text-slate-900 font-mono">
                        {Number(item.totalDamagePercent ?? 0).toFixed(3)}%
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
                      <div className="text-[10px] text-amber-800 font-semibold">
                        HSBGN: {formatRupiah(item.hsbgnPerM2 || 0)} / m²
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Biaya Total: {formatRupiah(item.totalCostPerM2)} / m²
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
                      {item.verificationNotes && (
                        <button
                          type="button"
                          onClick={() => setItemToViewNotes(item)}
                          className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[9px] font-bold transition-colors cursor-pointer"
                          title="Lihat Catatan Verifikator"
                        >
                          <MessageSquare className="w-2.5 h-2.5 text-rose-600" />
                          <span>Catatan</span>
                        </button>
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
                        {(() => {
                          let validCount = 0;
                          let errorCount = 0;
                          if (item.photos && item.photos.length > 0) {
                            item.photos.forEach(p => {
                              if (p.url && p.url.length > 50) validCount++;
                              else errorCount++;
                            });
                          }
                          const totalCount = validCount + errorCount;
                          
                          if (totalCount > 0) {
                            return (
                              <button
                                onClick={() => {
                                  setPhotoViewerAssessment(item);
                                  setPhotoViewerInitialIndex(0);
                                }}
                                title={errorCount > 0 ? `Ada ${errorCount} Foto Error/Kosong! Klik untuk melihat.` : `Lihat ${totalCount} Foto Visual Kerusakan`}
                                className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer ${errorCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse hover:bg-rose-100' : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'}`}
                              >
                                {errorCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Camera className="w-3.5 h-3.5 text-amber-600" />}
                                <span>{totalCount}</span>
                              </button>
                            );
                          } else if (item.googleDriveFolderUrl) {
                            return (
                              <a
                                href={item.googleDriveFolderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Buka Folder Dokumentasi Foto Gedung di Google Drive"
                                className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                              >
                                <Folder className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Drive</span>
                              </a>
                            );
                          } else {
                            return (
                              <span
                                title="Belum ada foto visual"
                                className="p-1.5 rounded-lg bg-slate-50 text-slate-300 border border-slate-100 flex items-center justify-center cursor-not-allowed"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </span>
                            );
                          }
                        })()}

                        {/* Edit Button or Locked Indicator (Hidden for Public) */}
                        {currentUser.role !== 'admin_publik' && (
                          isVerified ? (
                            <button
                              type="button"
                              disabled
                              title="Data penilaian telah diverifikasi secara resmi dan terkunci dari perubahan."
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 text-[10px] font-bold cursor-not-allowed opacity-90 shadow-2xs"
                            >
                              <Lock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Terkunci</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (!canEdit) {
                                  showToast(
                                    'Akses ditolak: Anda tidak memiliki izin untuk mengedit data ini.',
                                    'error'
                                  );
                                  return;
                                }
                                setSelectedAssessmentForEdit(item);
                                setActiveTab('input_baru');
                              }}
                              title={
                                item.verificationStatus === 'Perlu Revisi'
                                  ? 'PERLU REVISI: Klik untuk memeriksa catatan dan memperbaiki data survei ini'
                                  : 'Edit Penilaian'
                              }
                              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                item.verificationStatus === 'Perlu Revisi'
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white font-bold ring-2 ring-rose-300 ring-offset-1 text-[10px] shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {item.verificationStatus === 'Perlu Revisi' && <span>Perbaiki</span>}
                            </button>
                          )
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

                        {/* Quick Move to Sheet Button */}
                        {(currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'admin_verifikator') && (
                          <button
                            onClick={() => {
                              setSelectedRowIds([item.id]);
                            }}
                            title="Pindahkan data ini ke Halaman / Buku Sheet Lain"
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
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
                  <td colSpan={11} className="py-12 text-center text-slate-400">
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
              value={pageSize >= filteredAssessments.length && pageSize >= 200 ? 1000 : pageSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
                try {
                  localStorage.setItem('sipandu_table_page_size', String(val));
                } catch {}
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-700"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value={200}>200 Baris</option>
              <option value={1000}>Tampilkan Semua Sekaligus ({filteredAssessments.length} Data)</option>
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
              <strong className="text-slate-900">"{itemToDelete.buildingName}"</strong> ({itemToDelete.code})? Data ini akan dihapus permanen dari web dan baris Google Sheet ({itemToDelete.sourceSheet || itemToDelete.targetSheetName || `Kec. ${itemToDelete.kecamatanName}`}). Tindakan ini tidak dapat dibatalkan.
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Catatan Verifikator / Tim Ahli Struktur:
                  </label>
                  <span className={`text-[11px] font-medium ${verifyNotesInput.length >= 25000 ? 'text-rose-600 font-bold' : verifyNotesInput.length >= 20000 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {verifyNotesInput.length.toLocaleString('id-ID')} / 25.000 karakter
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={25000}
                  value={verifyNotesInput}
                  onChange={(e) => setVerifyNotesInput(e.target.value)}
                  placeholder={
                    verifyStatusChoice === 'Perlu Revisi'
                      ? 'Tuliskan catatan detail bagian apa yang perlu diperiksa atau diperbaiki oleh surveyor...'
                      : 'Contoh: Perhitungan kerusakan komponen kolom dan gording telah sesuai. Disetujui untuk pengajuan rehabilitasi TA 2026.'
                  }
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 ${
                    verifyNotesInput.length >= 25000 
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30' 
                      : 'border-slate-200 focus:ring-amber-500'
                  }`}
                ></textarea>
                {verifyNotesInput.length >= 25000 && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                    Maksimal 25.000 karakter tercapai demi menjaga keamanan batas sel Google Sheets.
                  </p>
                )}
              </div>

              {/* Quick Preset Feedback Templates for Perlu Revisi */}
              {verifyStatusChoice === 'Perlu Revisi' && (
                <div className="space-y-1.5 bg-rose-50/70 border border-rose-200 p-3 rounded-xl">
                  <div className="flex items-center justify-between text-[11px] font-bold text-rose-900">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-rose-600" />
                      Pilih Cepat Petunjuk Perbaikan untuk Surveyor:
                    </span>
                    <span className="text-[10px] text-rose-600 font-normal">Klik untuk menyisipkan</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Foto visual kerusakan belum jelas / kurang lengkap, mohon ambil foto sudut pandang lain.',
                      'Periksa kembali persentase kerusakan komponen struktur (kolom, balok, atau pondasi).',
                      'Periksa kembali kesesuaian luas total lantai (m²) dan jumlah lantai gedung.',
                      'Lengkapi data NIK / No. KK / identitas pemilik bangunan.',
                      'Sesuaikan klasifikasi tingkat kerusakan dan perkiraan HSBGN yang dipilih.',
                    ].map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => {
                          setVerifyNotesInput((prev) =>
                            prev ? `${prev.trim()}\n• ${tpl}` : `• ${tpl}`
                          );
                        }}
                        className="text-[10px] bg-white hover:bg-rose-100 text-rose-800 px-2 py-1 rounded-md border border-rose-200 font-medium transition-colors text-left shadow-2xs cursor-pointer"
                      >
                        + {tpl.slice(0, 48)}...
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-rose-800 mt-1 italic">
                    Catatan ini akan langsung ditampilkan ke surveyor di halaman tabel dan formulir edit mereka.
                  </p>
                </div>
              )}
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

      {/* Modal: View Revision / Verification Notes Dialog */}
      {itemToViewNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-600" />
                <span>Catatan Verifikasi & Instruksi Perbaikan</span>
              </h3>
              <button
                onClick={() => setItemToViewNotes(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{itemToViewNotes.buildingName}</div>
                <div className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-700">{itemToViewNotes.code || 'Tanpa Kode'}</span>
                  <span>&bull;</span>
                  <span>Kec. {itemToViewNotes.kecamatanName}, {itemToViewNotes.desaName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/80 border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Status Validasi</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${getVerificationBadge(itemToViewNotes.verificationStatus)}`}>
                    {itemToViewNotes.verificationStatus}
                  </span>
                </div>
                {itemToViewNotes.verifiedBy && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Verifikator</span>
                    <span className="font-bold text-slate-800 text-xs">{itemToViewNotes.verifiedBy}</span>
                    {itemToViewNotes.verifiedAt && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(itemToViewNotes.verifiedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Isi Catatan / Petunjuk Perbaikan dari Verifikator:
                </label>
                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-slate-900 whitespace-pre-wrap leading-relaxed font-medium">
                  {itemToViewNotes.verificationNotes || 'Tidak ada catatan teks yang disertakan.'}
                </div>
              </div>

              {itemToViewNotes.verificationStatus === 'Perlu Revisi' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 space-y-1">
                  <span className="font-bold block flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Langkah Perbaikan untuk Petugas Surveyor:</span>
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-900">
                    Buka tombol perbaiki di bawah, sesuaikan isian formulir sesuai catatan di atas, lalu simpan formulir agar data otomatis diajukan kembali ke antrean verifikasi.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setItemToViewNotes(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
              {(currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'admin_user') && (
                <button
                  onClick={() => {
                    const item = itemToViewNotes;
                    setItemToViewNotes(null);
                    setSelectedAssessmentForEdit(item);
                    setActiveTab('input_baru');
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Buka Formulir untuk Memperbaiki Data</span>
                </button>
              )}
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
          googleDriveFolderUrl={photoViewerAssessment.googleDriveFolderUrl}
          assessmentId={photoViewerAssessment.id}
          onClose={() => setPhotoViewerAssessment(null)}
        />
      )}

      {/* MODAL AUDIT DATA GANDA (ADMIN / SUPER ADMIN) */}
      <DuplicateAuditModal
        isOpen={showDuplicateAuditModal}
        onClose={() => setShowDuplicateAuditModal(false)}
        duplicateGroups={duplicateGroups}
        onDeleteAssessment={(id) => {
          const res = deleteAssessment(id);
          if (res.success) {
            showToast('Satu data ganda berhasil dihapus', 'success');
          } else {
            showToast(res.message, 'error');
          }
        }}
        onViewDetail={(item) => {
          setSelectedAssessmentForDetail(item);
        }}
        onIgnorePair={handleIgnoreDuplicatePair}
        onClearIgnored={handleClearIgnoredDuplicates}
      />

      {/* MODAL CETAK BUKU PORTOFOLIO REKAPITULASI RESMI A4 */}
      {showPortfolioModal && (
        <PortfolioRecapModal
          isOpen={showPortfolioModal}
          onClose={() => setShowPortfolioModal(false)}
          assessments={assessments}
          kecamatans={kecamatans}
          desas={desas}
        />
      )}
    </div>
  );
};
