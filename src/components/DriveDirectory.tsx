import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  HardDrive, 
  Loader2, 
  Save, 
  Building2, 
  MapPin, 
  Pencil, 
  PlusCircle, 
  Camera, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  X,
  Filter,
  ExternalLink,
  FolderCheck,
  FolderMinus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { BuildingAssessment } from '../types';

export const DriveDirectory: React.FC = () => {
  const { currentUser, assessments, updateAssessment, addAssessment, deleteAssessment, showToast } = useApp();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Secret PIN definition (never displayed to user)
  const SECRET_PIN = 'simpkbg2026';

  // Delete Modal & PIN State (Single Item)
  const [itemToDelete, setItemToDelete] = useState<BuildingAssessment | null>(null);
  const [deleteMode, setDeleteMode] = useState<'ALL_DATA' | 'DRIVE_LINK_ONLY'>('ALL_DATA');
  const [pinInput, setPinInput] = useState('');
  const [showPinMask, setShowPinMask] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch Selection & Batch Delete State
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [batchPinInput, setBatchPinInput] = useState('');
  const [showBatchPinMask, setShowBatchPinMask] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Dropdown states for adding link
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBuildingName, setManualBuildingName] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('ALL');
  const [driveFilter, setDriveFilter] = useState<'ALL' | 'HAS_LINK' | 'NO_LINK' | 'HAS_PHOTOS' | 'NO_PHOTOS'>('ALL');

  // Extract unique Kecamatan list from all assessments
  const uniqueKecamatanList = useMemo(() => {
    const setKec = new Set<string>();
    assessments.forEach(a => {
      if (a.kecamatanName && a.kecamatanName !== '-' && a.kecamatanName.trim() !== '') {
        setKec.add(a.kecamatanName.trim());
      }
    });
    return Array.from(setKec).sort();
  }, [assessments]);

  // Statistics calculation for all assessments
  const stats = useMemo(() => {
    let total = assessments.length;
    let withLink = 0;
    let withoutLink = 0;
    let totalPhotos = 0;

    assessments.forEach(a => {
      const driveUrl = a.backupDriveUrl || (a as any).googleDriveFolderUrl;
      if (driveUrl && driveUrl.trim() !== '') {
        withLink++;
      } else {
        withoutLink++;
      }
      if (a.photos) {
        totalPhotos += a.photos.length;
      }
    });

    return { total, withLink, withoutLink, totalPhotos };
  }, [assessments]);

  // Filter out ALL buildings for display in the directory table with search & filters
  const displayBuildings = useMemo(() => {
    let list = [...assessments];

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a => 
        (a.buildingName && a.buildingName.toLowerCase().includes(q)) ||
        (a.code && a.code.toLowerCase().includes(q)) ||
        (a.id && a.id.toLowerCase().includes(q)) ||
        (a.kecamatanName && a.kecamatanName.toLowerCase().includes(q)) ||
        (a.desaName && a.desaName.toLowerCase().includes(q)) ||
        (a.detailedAddress && a.detailedAddress.toLowerCase().includes(q)) ||
        (a.createdByName && a.createdByName.toLowerCase().includes(q))
      );
    }

    // Kecamatan filter
    if (selectedKecamatan !== 'ALL') {
      list = list.filter(a => a.kecamatanName === selectedKecamatan);
    }

    // Drive Link & Photo filter
    if (driveFilter === 'HAS_LINK') {
      list = list.filter(a => Boolean(a.backupDriveUrl || (a as any).googleDriveFolderUrl));
    } else if (driveFilter === 'NO_LINK') {
      list = list.filter(a => !Boolean(a.backupDriveUrl || (a as any).googleDriveFolderUrl));
    } else if (driveFilter === 'HAS_PHOTOS') {
      list = list.filter(a => a.photos && a.photos.length > 0);
    } else if (driveFilter === 'NO_PHOTOS') {
      list = list.filter(a => !a.photos || a.photos.length === 0);
    }

    return list.sort((a, b) => new Date(b.assessmentDate || b.createdAt).getTime() - new Date(a.assessmentDate || a.createdAt).getTime());
  }, [assessments, searchQuery, selectedKecamatan, driveFilter]);

  const handleSaveLinkNew = async () => {
    if (!newDriveUrl.includes('drive.google.com') && newDriveUrl.trim() !== '') {
      showToast('Harap masukkan tautan Google Drive yang valid', 'error');
      return;
    }

    if (isManualMode && !manualBuildingName.trim()) {
      showToast('Nama gedung wajib diisi jika menggunakan mode manual', 'error');
      return;
    }

    setIsAddingNew(true);

    if (isManualMode) {
      // Create a stub assessment
      const stubAssessment: BuildingAssessment = {
        id: `reg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        buildingName: manualBuildingName.trim(),
        backupDriveUrl: newDriveUrl.trim(),
        disasterType: 'Bencana Lainnya',
        disasterDate: new Date().toISOString().split('T')[0],
        assessmentDate: new Date().toISOString().split('T')[0],
        buildingCategory: 'Fasilitas Publik',
        yearBuilt: new Date().getFullYear(),
        ownerAgency: 'Belum Diatur (Input via Drive)',
        responsibleDepartment: 'Dinas Pekerjaan Umum dan Penataan Ruang',
        buildingClass: 'Bangunan Sederhana',
        totalFloorAreaM2: 0,
        numberOfFloors: 1,
        kecamatanId: '',
        kecamatanName: '-',
        desaId: '',
        desaName: '-',
        detailedAddress: '-',
        components: [],
        totalDamagePercent: 0,
        damageClassification: 'Rusak Ringan',
        hsbgnPerM2: 0,
        treatmentCostPerM2: 0,
        demolitionPercent: 8,
        demolitionCostPerM2: 0,
        totalCostPerM2: 0,
        totalRehabCost: 0,
        roundedRehabCost: 0,
        costTerbilang: 'Nol Rupiah',
        verificationStatus: 'Menunggu Verifikasi',
        photos: [],
        cityLocation: 'Nagekeo',
        reportDateStr: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        headOfDepartment: {
          title: 'Kepala Dinas Pekerjaan Umum dan Penataan Ruang',
          subTitle: 'Kabupaten Nagekeo',
          rank: 'Pembina Utama Muda (IV/c)',
          name: '-',
          nip: '-',
        },
        analysisTeam: ['Tim Lapangan PUPR'],
        googleSheetSynced: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.id,
        createdByName: currentUser.name,
      };

      const res = await addAssessment(stubAssessment);
      if (res.success) {
        showToast('Data gedung baru beserta tautan Drive berhasil ditambahkan!', 'success');
        resetForm();
      } else {
        showToast(res.message, 'error');
      }
    } else {
      // Update existing
      const res = await updateAssessment(selectedBuildingId, { backupDriveUrl: newDriveUrl.trim() });
      if (res.success) {
        showToast('Tautan Google Drive untuk gedung berhasil disimpan!', 'success');
        resetForm();
      } else {
        showToast(res.message, 'error');
      }
    }

    setIsAddingNew(false);
  };

  const handleUpdateInline = async (buildingId: string) => {
    if (!tempUrl.includes('drive.google.com') && tempUrl.trim() !== '') {
      showToast('Harap masukkan tautan Google Drive yang valid', 'error');
      return;
    }
    setIsSaving(true);
    const res = await updateAssessment(buildingId, { backupDriveUrl: tempUrl.trim() });
    if (res.success) {
      showToast('Tautan Google Drive berhasil diperbarui!', 'success');
      setEditingId(null);
    } else {
      showToast(res.message, 'error');
    }
    setIsSaving(false);
  };

  const resetForm = () => {
    setSelectedBuildingId('');
    setIsManualMode(false);
    setManualBuildingName('');
    setNewDriveUrl('');
  };

  const startEdit = (id: string, currentUrl: string) => {
    setEditingId(id);
    setTempUrl(currentUrl || '');
  };

  // Handle single item deletion with PIN verification
  const handleOpenDeleteModal = (building: BuildingAssessment) => {
    setItemToDelete(building);
    setDeleteMode('ALL_DATA');
    setPinInput('');
    setShowPinMask(false);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleteError('');

    if (pinInput.trim() !== SECRET_PIN) {
      setDeleteError('PIN otorisasi tidak valid atau salah.');
      showToast('PIN otorisasi salah. Penghapusan dibatalkan.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteMode === 'ALL_DATA') {
        const res = deleteAssessment(itemToDelete.id, true);
        if (res.success) {
          showToast(`Data gedung "${itemToDelete.buildingName}" berhasil dihapus.`, 'success');
          setSelectedRowIds(prev => {
            const next = new Set(prev);
            next.delete(itemToDelete.id);
            return next;
          });
          setItemToDelete(null);
          setPinInput('');
        } else {
          setDeleteError(res.message);
          showToast(res.message, 'error');
        }
      } else {
        const res = await updateAssessment(itemToDelete.id, { backupDriveUrl: '' });
        if (res.success) {
          showToast(`Tautan Google Drive untuk "${itemToDelete.buildingName}" berhasil dihapus.`, 'success');
          setItemToDelete(null);
          setPinInput('');
        } else {
          setDeleteError(res.message);
          showToast(res.message, 'error');
        }
      }
    } catch (err: any) {
      setDeleteError('Terjadi kesalahan saat menghapus: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle batch deletion with PIN verification
  const handleOpenBatchDeleteModal = () => {
    if (selectedRowIds.size === 0) {
      showToast('Pilih setidaknya satu gedung terlebih dahulu.', 'info');
      return;
    }
    setBatchPinInput('');
    setShowBatchPinMask(false);
    setBatchDeleteError('');
    setIsBatchDeleteModalOpen(true);
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedRowIds.size === 0) return;
    setBatchDeleteError('');

    if (batchPinInput.trim() !== SECRET_PIN) {
      setBatchDeleteError('PIN otorisasi tidak valid atau salah.');
      showToast('PIN otorisasi salah. Penghapusan massal dibatalkan.', 'error');
      return;
    }

    setIsBatchDeleting(true);
    try {
      let count = 0;
      const ids = Array.from(selectedRowIds);
      for (const id of ids) {
        const res = deleteAssessment(id, true);
        if (res.success) count++;
      }
      showToast(`Berhasil menghapus ${count} data gedung dari direktori.`, 'success');
      setSelectedRowIds(new Set());
      setIsBatchDeleteModalOpen(false);
      setBatchPinInput('');
    } catch (err: any) {
      setBatchDeleteError('Terjadi kesalahan saat memproses penghapusan massal: ' + err.message);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedRowIds.size === displayBuildings.length && displayBuildings.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(displayBuildings.map(b => b.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSetLink = !['admin_publik', 'admin_verifikator'].includes(currentUser.role);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-indigo-600" />
            Direktori Penyimpanan & Tautan Google Drive Gedung
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Menampilkan seluruh {assessments.length} data gedung terdaftar beserta direktori folder foto Google Drive.
          </p>
        </div>
      </div>

      {/* Ringkasan Statistik Direktori */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 font-semibold">Total Gedung</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <FolderCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">{stats.withLink}</div>
            <div className="text-xs text-slate-500 font-semibold">Memiliki Link G-Drive</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
            <FolderMinus className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-700">{stats.withoutLink}</div>
            <div className="text-xs text-slate-500 font-semibold">Belum Ada Link Drive</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-sky-50 rounded-xl text-sky-600 shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{stats.totalPhotos}</div>
            <div className="text-xs text-slate-500 font-semibold">Total Foto Sistem</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl shrink-0">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-bold text-slate-800">Penyimpanan Utama & Cadangan Google Drive</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Seluruh data gedung terdaftar ditampilkan secara transparan di direktori ini. Foto-foto yang diunggah otomatis terhubung dengan database aplikasi. Tautkan folder Google Drive gedung jika ingin menyimpan arsip dokumentasi beresolusi tinggi.
              </p>
            </div>
          </div>
        </div>
      </div>

      {canSetLink && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-5 sm:p-6 opacity-90 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 mb-5">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">Tambahkan Link G-Drive (Hanya Jika Diperlukan)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Pilih / Input Nama Gedung</label>
              <select
                value={isManualMode ? 'MANUAL' : selectedBuildingId}
                onChange={(e) => {
                  if (e.target.value === 'MANUAL') {
                    setIsManualMode(true);
                    setSelectedBuildingId('');
                  } else {
                    setIsManualMode(false);
                    setSelectedBuildingId(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium text-slate-700"
              >
                <option value="">-- Pilih Gedung Terdaftar --</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.buildingName} {a.desaName && a.desaName !== '-' ? `(${a.desaName})` : ''}
                  </option>
                ))}
                <option value="MANUAL" className="font-bold text-indigo-600">+ Input Nama Gedung Manual (Belum Terdaftar)</option>
              </select>

              {isManualMode && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={manualBuildingName}
                    onChange={(e) => setManualBuildingName(e.target.value)}
                    placeholder="Ketik nama gedung baru..."
                    className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium text-slate-700 shadow-sm"
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">Data gedung sementara akan dibuat. Anda bisa melengkapi form detailnya nanti di menu Data Gedung.</p>
                </div>
              )}
            </div>
            
            <div className="md:col-span-5">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Tautan / Link Google Drive</label>
              <input
                type="url"
                value={newDriveUrl}
                onChange={(e) => setNewDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium text-slate-700"
              />
            </div>
            
            <div className="md:col-span-2 flex items-start mt-7">
              <button
                onClick={handleSaveLinkNew}
                disabled={(isManualMode ? !manualBuildingName : !selectedBuildingId) || isAddingNew}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
              >
                {isAddingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Direktori Gedung dengan Fitur Pencarian & Filter Lengkap */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Control: Search & Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Direktori Seluruh Data Gedung ({displayBuildings.length} dari {assessments.length})
            </h3>
            
            <div className="flex items-center gap-2">
              {selectedRowIds.size > 0 && (
                <button
                  onClick={handleOpenBatchDeleteModal}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedRowIds.size} Terpilih)</span>
                </button>
              )}

              {(searchQuery || selectedKecamatan !== 'ALL' || driveFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedKecamatan('ALL');
                    setDriveFilter('ALL');
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset Filter Pencarian
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Input Pencarian Nama Gedung / Alamat / Kode */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari gedung, alamat, kode registrasi, atau desa..."
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white font-medium text-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Kecamatan */}
            <div className="sm:col-span-4 relative">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden md:block" />
                <select
                  value={selectedKecamatan}
                  onChange={(e) => setSelectedKecamatan(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white font-medium text-slate-800"
                >
                  <option value="ALL">Semua Kecamatan ({uniqueKecamatanList.length})</option>
                  {uniqueKecamatanList.map(kec => (
                    <option key={kec} value={kec}>
                      Kec. {kec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Status Link G-Drive */}
            <div className="sm:col-span-3">
              <select
                value={driveFilter}
                onChange={(e) => setDriveFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white font-medium text-slate-800"
              >
                <option value="ALL">Semua Status Link Drive</option>
                <option value="HAS_LINK">Memiliki Link Drive</option>
                <option value="NO_LINK">Belum Ada Link Drive</option>
                <option value="HAS_PHOTOS">Ada Foto Sistem</option>
                <option value="NO_PHOTOS">Tanpa Foto Sistem</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse relative min-w-[800px]">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="w-10 px-3 py-4 text-center">
                  <input 
                    type="checkbox" 
                    checked={displayBuildings.length > 0 && selectedRowIds.size === displayBuildings.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    title="Pilih semua data gedung yang tampil"
                  />
                </th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-5/12">Nama Gedung & Lokasi</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status Foto Sistem</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi & Direktori Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayBuildings.length > 0 ? displayBuildings.map((building) => {
                const photoCount = building.photos ? building.photos.length : 0;
                
                // Calculate valid vs error photos
                let validPhotosCount = 0;
                let errorPhotosCount = 0;
                
                if (building.photos) {
                  building.photos.forEach(p => {
                    if (p.url && p.url.length > 50) {
                      validPhotosCount++;
                    } else {
                      errorPhotosCount++;
                    }
                  });
                }
                
                const hasPhotos = photoCount > 0;
                const driveUrl = building.backupDriveUrl || (building as any).googleDriveFolderUrl;
                
                return (
                  <tr key={building.id} className={`hover:bg-slate-50 transition-colors ${selectedRowIds.has(building.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="w-10 px-3 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedRowIds.has(building.id)}
                        onChange={() => toggleSelectRow(building.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span>{building.buildingName}</span>
                        {building.code && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {building.code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{building.desaName !== '-' ? `${building.desaName}, ` : ''} {building.kecamatanName !== '-' ? `Kec. ${building.kecamatanName}` : 'Lokasi Belum Diatur'}</span>
                        {building.createdByName && (
                          <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-2">
                            Oleh: {building.createdByName}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {hasPhotos ? (
                        <div className="flex flex-col gap-1.5">
                          {validPhotosCount > 0 && (
                            <div className="inline-flex items-center w-max gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Camera className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-[11px] font-bold">{validPhotosCount} Foto Valid</span>
                            </div>
                          )}
                          
                          {errorPhotosCount > 0 && (
                            <div className="inline-flex items-center w-max gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="text-[11px] font-bold">{errorPhotosCount} Foto Error / Kosong!</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                          <Camera className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold">Belum Ada Foto Sistem</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      {editingId === building.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input 
                            type="url"
                            value={tempUrl}
                            onChange={(e) => setTempUrl(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="w-48 sm:w-64 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 bg-white"
                            autoFocus
                          />
                          <button 
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={() => handleUpdateInline(building.id)}
                            disabled={isSaving}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Simpan
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
                          {driveUrl ? (
                            <a 
                              href={driveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                              title="Buka folder Google Drive"
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Buka Folder</span>
                              <ExternalLink className="w-3 h-3 text-indigo-400" />
                            </a>
                          ) : (
                            <button disabled className="inline-flex items-center justify-center px-2.5 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium border border-slate-200 opacity-60 cursor-not-allowed">
                              Belum Ada Link
                            </button>
                          )}

                          {canSetLink && (
                            <button 
                              onClick={() => startEdit(building.id, driveUrl || '')}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors border bg-white text-slate-600 hover:bg-slate-100 border-slate-200 cursor-pointer"
                              title="Ubah tautan folder Google Drive"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">{driveUrl ? 'Edit Link' : 'Set Link'}</span>
                            </button>
                          )}

                          {/* Tombol Kasi Hapus */}
                          <button
                            onClick={() => handleOpenDeleteModal(building)}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border-rose-200 shadow-xs cursor-pointer active:scale-95"
                            title="Hapus data gedung atau link Drive (Otorisasi PIN)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-500 text-sm">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <div>Tidak ada data gedung yang sesuai dengan filter pencarian.</div>
                    {(searchQuery || selectedKecamatan !== 'ALL' || driveFilter !== 'ALL') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedKecamatan('ALL');
                          setDriveFilter('ALL');
                        }}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Reset semua filter pencarian
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KONFIRMASI HAPUS DENGAN OTORISASI PIN */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Data</h3>
                  <p className="text-xs text-slate-500">Direktori & Database Sistem</p>
                </div>
              </div>
              <button
                onClick={() => setItemToDelete(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Target Data Info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-sm text-slate-800">
                  {itemToDelete.buildingName}
                </div>
                <div className="text-slate-500 flex items-center gap-2">
                  <span className="font-mono bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                    {itemToDelete.code || itemToDelete.id}
                  </span>
                  <span>•</span>
                  <span>{itemToDelete.kecamatanName !== '-' ? `Kec. ${itemToDelete.kecamatanName}` : 'Nagekeo'}</span>
                </div>
              </div>

              {/* Delete Mode Option (If building has a Drive Link) */}
              {(itemToDelete.backupDriveUrl || (itemToDelete as any).googleDriveFolderUrl) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Pilih Tindakan Penghapusan
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      deleteMode === 'ALL_DATA'
                        ? 'border-rose-300 bg-rose-50/50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'ALL_DATA'}
                        onChange={() => setDeleteMode('ALL_DATA')}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-rose-700">Hapus Seluruh Data Gedung</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Menghapus data gedung beserta seluruh kalkulasi dan foto dari direktori & database.
                        </div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      deleteMode === 'DRIVE_LINK_ONLY'
                        ? 'border-indigo-300 bg-indigo-50/50 text-slate-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === 'DRIVE_LINK_ONLY'}
                        onChange={() => setDeleteMode('DRIVE_LINK_ONLY')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-indigo-700">Hapus Tautan Google Drive Saja</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Hanya mengosongkan link Google Drive tanpa menghapus data penilaian gedung.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* PIN Input Section (MASKED, NEVER DISPLAY THE PIN) */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    PIN Otorisasi Pengamanan
                  </span>
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPinMask ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setDeleteError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && pinInput.trim()) {
                        handleConfirmDelete();
                      }
                    }}
                    placeholder="Masukkan PIN otorisasi..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-medium tracking-wider bg-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinMask(!showPinMask)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPinMask ? 'Sembunyikan karakter' : 'Tampilkan karakter'}
                  >
                    {showPinMask ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Diperlukan PIN otorisasi pengamanan sistem untuk memproses tindakan ini.</span>
                </p>
              </div>

              {/* Error Alert */}
              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!pinInput.trim() || isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Memproses...' : 'Konfirmasi Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS MASSAL DENGAN OTORISASI PIN */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hapus Massal Gedung</h3>
                  <p className="text-xs text-slate-500">{selectedRowIds.size} gedung dipilih</p>
                </div>
              </div>
              <button
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Peringatan Tindakan Massal
                </div>
                <p className="text-rose-700 leading-relaxed">
                  Anda akan menghapus secara permanen <strong>{selectedRowIds.size} data gedung</strong> dari sistem dan direktori. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              {/* PIN Input Section (MASKED) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    PIN Otorisasi Pengamanan
                  </span>
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showBatchPinMask ? 'text' : 'password'}
                    value={batchPinInput}
                    onChange={(e) => {
                      setBatchPinInput(e.target.value);
                      setBatchDeleteError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && batchPinInput.trim()) {
                        handleConfirmBatchDelete();
                      }
                    }}
                    placeholder="Masukkan PIN otorisasi..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-medium tracking-wider bg-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowBatchPinMask(!showBatchPinMask)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showBatchPinMask ? 'Sembunyikan karakter' : 'Tampilkan karakter'}
                  >
                    {showBatchPinMask ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Diperlukan PIN otorisasi pengamanan sistem untuk memproses tindakan ini.</span>
                </p>
              </div>

              {/* Error Alert */}
              {batchDeleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{batchDeleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                disabled={isBatchDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={!batchPinInput.trim() || isBatchDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                {isBatchDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isBatchDeleting ? 'Menghapus...' : `Hapus ${selectedRowIds.size} Gedung`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

