import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SpreadsheetProfile, SheetCapacityStatus, BuildingAssessment } from '../types';
import {
  BookOpen,
  BookmarkCheck,
  Plus,
  ExternalLink,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Info,
  Edit2,
  Trash2,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface SheetBookSelectorProps {
  /** Mode: 'compact' (for table top toolbar), 'full' (for Google Sheet tab), or 'selector-only' */
  variant?: 'compact' | 'full' | 'inline-filter';
  /** Optional callback when a profile is selected for view/filter */
  onSelectViewProfile?: (profileId: string | 'ALL') => void;
  /** Currently active filter profile ID */
  selectedViewProfileId?: string;
  /** List of selected assessment IDs for batch move (if available) */
  selectedAssessmentIds?: string[];
  /** Callback after moving data */
  onMovedSuccess?: () => void;
  /** Disable new profile creation */
  hideAddButton?: boolean;
}

export const SheetBookSelector: React.FC<SheetBookSelectorProps> = ({
  variant = 'compact',
  onSelectViewProfile,
  selectedViewProfileId = 'ALL',
  selectedAssessmentIds = [],
  onMovedSuccess,
  hideAddButton = false,
}) => {
  const {
    googleSheetConfig,
    updateGoogleSheetConfig,
    currentUser,
    showToast,
    assessments,
    updateAssessment,
    logUserActivity,
  } = useApp();

  const isAdmin = currentUser.role === 'super_admin' || currentUser.role === 'admin';
  const isVerifikator = currentUser.role === 'admin_verifikator';
  const canManageSheets = isAdmin;

  // Profiles list with fallback
  const profiles: SpreadsheetProfile[] = (googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 0)
    ? googleSheetConfig.spreadsheetProfiles
    : [
        {
          id: 'profile_primary_2026',
          pageNumber: 1,
          name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
          spreadsheetUrl: googleSheetConfig.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/12FNcCcnpg5QfyXeCTjM9pWfN8iSW9SpKVquRK8qZo2g/edit?usp=sharing',
          webhookUrl: googleSheetConfig.webhookUrl,
          driveFolderId: googleSheetConfig.driveFolderId,
          description: 'Spreadsheet dinas utama berisi 7 tab kecamatan dan log pengguna',
          capacityStatus: 'normal',
          estimatedRowCount: assessments.length || 207,
          maxCapacityRows: 2000,
          createdAt: '2026-01-01T00:00:00Z',
          isDefault: true,
        },
      ];

  const activeProfileId = googleSheetConfig.activeProfileId || profiles[0]?.id;
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  // Modal / Form state for Add New Sheet
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newWebhook, setNewWebhook] = useState(googleSheetConfig.webhookUrl || '');
  const [newDriveFolder, setNewDriveFolder] = useState(googleSheetConfig.driveFolderId || '');
  const [newDesc, setNewDesc] = useState('');
  const [newMaxCapacity, setNewMaxCapacity] = useState<number>(2000);

  // Modal state for Move Data
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetMoveProfileId, setTargetMoveProfileId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  // Modal state for Edit Profile Status / Capacity
  const [editingProfile, setEditingProfile] = useState<SpreadsheetProfile | null>(null);

  // Count assessments per profile
  const profileItemCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      counts[p.id] = 0;
    });
    // Default profile gets unassigned assessments
    const defaultId = profiles[0]?.id || 'profile_primary_2026';
    assessments.forEach((a) => {
      const pid = a.targetProfileId || defaultId;
      counts[pid] = (counts[pid] || 0) + 1;
    });
    return counts;
  }, [assessments, profiles]);

  // Set Global Active Profile (Admin/Super Admin only - propagates to all users)
  const handleSetActiveGlobal = (profile: SpreadsheetProfile) => {
    if (!isAdmin) {
      showToast('Hanya Super Admin & Admin yang dapat menetapkan Spreadsheet Aktif Global.', 'error');
      return;
    }

    if (!profile.spreadsheetUrl) {
      showToast('Spreadsheet ini belum memiliki URL Google Sheet. Silakan lengkapi tautan terlebih dahulu.', 'error');
      return;
    }

    const updated = {
      ...googleSheetConfig,
      activeProfileId: profile.id,
      spreadsheetUrl: profile.spreadsheetUrl,
      webhookUrl: profile.webhookUrl || googleSheetConfig.webhookUrl,
      driveFolderId: profile.driveFolderId || googleSheetConfig.driveFolderId,
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success' as const,
      lastTestMessage: `Terkoneksi ke halaman: ${profile.name}`,
    };

    updateGoogleSheetConfig(updated);
    logUserActivity(
      'SYNC_GOOGLE_SHEET',
      'Integrasi Google Sheet',
      `Super Admin ${currentUser.name} mengaktifkan ${profile.name} untuk seluruh pengguna sistem`,
      profile.name,
      `URL: ${profile.spreadsheetUrl}`
    );

    showToast(`✓ Berhasil! "${profile.name}" kini aktif untuk seluruh Surveyor dan Pengguna sistem!`, 'success');
  };

  // Add New Profile / Sheet Volume
  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Akses ditolak: Hanya Super Admin dan Admin yang dapat menambah Halaman Sheet baru.', 'error');
      return;
    }

    if (!newName.trim() || !newUrl.trim()) {
      showToast('Nama Halaman dan URL Google Sheet wajib diisi.', 'error');
      return;
    }

    const nextPageNumber = profiles.length + 1;
    const newProfile: SpreadsheetProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: nextPageNumber,
      name: newName.trim().startsWith('Buku') || newName.trim().startsWith('Halaman') ? newName.trim() : `Halaman ${nextPageNumber}: ${newName.trim()}`,
      spreadsheetUrl: newUrl.trim(),
      webhookUrl: newWebhook.trim() || googleSheetConfig.webhookUrl,
      driveFolderId: newDriveFolder.trim() || googleSheetConfig.driveFolderId,
      description: newDesc.trim() || 'Halaman arsip baru diatur oleh Administrator',
      capacityStatus: 'normal',
      estimatedRowCount: 0,
      maxCapacityRows: newMaxCapacity || 2000,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      isDefault: false,
    };

    const updatedProfiles = [...profiles, newProfile];

    // Automatically set as active so user doesn't have to double-click
    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
      activeProfileId: newProfile.id,
      spreadsheetUrl: newProfile.spreadsheetUrl,
      webhookUrl: newProfile.webhookUrl,
      driveFolderId: newProfile.driveFolderId,
    });

    logUserActivity(
      'SYNC_GOOGLE_SHEET',
      'Integrasi Google Sheet',
      `Menambahkan Halaman/Buku Spreadsheet Baru: ${newProfile.name}`,
      newProfile.name,
      `Kapasitas Maksimal: ${newProfile.maxCapacityRows} baris`
    );

    // Reset Form
    setNewName('');
    setNewUrl('');
    setNewDesc('');
    setShowAddModal(false);

    showToast(`✓ Halaman Sheet Baru "${newProfile.name}" berhasil dibuat dan langsung diaktifkan untuk semua pengguna!`, 'success');
  };

  // Move Assessments to Another Profile (Batch or Single)
  const handleMoveAssessments = async () => {
    if (!targetMoveProfileId) {
      showToast('Pilih halaman sheet tujuan terlebih dahulu.', 'error');
      return;
    }

    const targetProfile = profiles.find((p) => p.id === targetMoveProfileId);
    if (!targetProfile) {
      showToast('Halaman sheet tujuan tidak valid.', 'error');
      return;
    }

    setIsMoving(true);
    try {
      const idsToMove = selectedAssessmentIds.length > 0
        ? selectedAssessmentIds
        : [];

      if (idsToMove.length === 0) {
        showToast('Tidak ada data yang dipilih untuk dipindahkan.', 'info');
        setIsMoving(false);
        return;
      }

      // Update all selected assessments
      for (const id of idsToMove) {
        await updateAssessment(id, {
          targetProfileId: targetProfile.id,
          targetProfileName: targetProfile.name,
        });
      }

      logUserActivity(
        'UPDATE_ASSESSMENT',
        'Penilaian Kerusakan',
        `Memindahkan ${idsToMove.length} data survei ke ${targetProfile.name}`,
        targetProfile.name,
        `Dipindahkan oleh ${currentUser.name}`
      );

      showToast(`✓ Berhasil memindahkan ${idsToMove.length} data gedung ke "${targetProfile.name}"!`, 'success');
      setShowMoveModal(false);
      if (onMovedSuccess) onMovedSuccess();
    } catch (err: any) {
      showToast(`Gagal memindahkan data: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setIsMoving(false);
    }
  };

  // Update Profile Capacity Status
  const handleSaveProfileStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !isAdmin) return;

    const updatedProfiles = profiles.map((p) => (p.id === editingProfile.id ? editingProfile : p));
    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: updatedProfiles,
    });

    logUserActivity(
      'SYNC_GOOGLE_SHEET',
      'Integrasi Google Sheet',
      `Memperbarui status kapasitas sheet: ${editingProfile.name} -> ${editingProfile.capacityStatus}`,
      editingProfile.name,
      `Kapasitas Max: ${editingProfile.maxCapacityRows}`
    );

    showToast(`✓ Pengaturan status & kapasitas "${editingProfile.name}" berhasil disimpan.`, 'success');
    setEditingProfile(null);
  };

  // Delete Profile
  const handleDeleteProfile = (profileId: string) => {
    if (!isAdmin) {
      showToast('Hanya Super Admin dan Admin yang dapat menghapus profil spreadsheet.', 'error');
      return;
    }

    if (profiles.length <= 1) {
      showToast('Minimal harus ada satu halaman spreadsheet tersimpan.', 'error');
      return;
    }

    const filtered = profiles.filter((p) => p.id !== profileId);
    const wasActive = googleSheetConfig.activeProfileId === profileId;
    const nextActive = wasActive ? filtered[0] : null;

    updateGoogleSheetConfig({
      ...googleSheetConfig,
      spreadsheetProfiles: filtered,
      ...(nextActive ? {
        activeProfileId: nextActive.id,
        spreadsheetUrl: nextActive.spreadsheetUrl,
        webhookUrl: nextActive.webhookUrl || googleSheetConfig.webhookUrl,
        driveFolderId: nextActive.driveFolderId || googleSheetConfig.driveFolderId,
      } : {}),
    });

    showToast('Halaman spreadsheet berhasil dihapus dari daftar buku.', 'info');
  };

  // Status Badge UI helper
  const renderStatusBadge = (status?: SheetCapacityStatus, rowCount: number = 0, maxRows: number = 2000) => {
    const isOverCapacity = rowCount >= maxRows || status === 'full';
    const isNearCapacity = (rowCount / maxRows >= 0.8) || status === 'warning';

    if (isOverCapacity) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black uppercase tracking-wider animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          <span>⚠️ Penuh (Pindah Halaman)</span>
        </span>
      );
    }
    if (isNearCapacity) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Mendekati Penuh ({Math.round((rowCount / maxRows) * 100)}%)</span>
        </span>
      );
    }
    if (status === 'archived') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-semibold">
          <Layers className="w-3 h-3 text-slate-500" />
          <span>Arsip Lama</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>Kapasitas Aman ({rowCount}/{maxRows})</span>
      </span>
    );
  };

  return (
    <div className="w-full space-y-3">
      {/* Active Sheet Banner with Capacity Alert */}
      {activeProfile && (activeProfile.capacityStatus === 'full' || (profileItemCounts[activeProfile.id] || 0) >= (activeProfile.maxCapacityRows || 2000)) && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-rose-900">
                Pemberitahuan Kapasitas: Halaman Aktif Penuh!
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                Dokumen <strong>{activeProfile.name}</strong> telah mencapai batas kapasitas maksimal. 
                {isAdmin ? ' Silakan buat atau pilih Halaman Sheet Baru di bawah untuk melanjutkan input data.' : ' Hubungi Super Admin / Admin untuk mengaktifkan Halaman Sheet berikutnya.'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buka Halaman Baru</span>
            </button>
          )}
        </div>
      )}

      {/* Main Flexbox Container: "Daftar Halaman Buku / Arsip Sheet" */}
      <div className="bg-slate-50/90 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Daftar Halaman Buku / Arsip Spreadsheet
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                  {profiles.length} Halaman Tersedia
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isAdmin
                  ? 'Klik halaman untuk melihat data atau atur Sheet Aktif Global agar seluruh Surveyor & Tim Verifikator otomatis mengikutinya.'
                  : 'Pilih halaman di bawah untuk memfilter atau memeriksa data pada volume sheet tertentu.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter "Semua Halaman" */}
            {onSelectViewProfile && (
              <button
                type="button"
                onClick={() => onSelectViewProfile('ALL')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedViewProfileId === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Semua Halaman ({assessments.length})</span>
              </button>
            )}

            {/* Batch Move Data Action Button */}
            {selectedAssessmentIds.length > 0 && (isAdmin || isVerifikator) && (
              <button
                type="button"
                onClick={() => setShowMoveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs animate-pulse cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Pindahkan {selectedAssessmentIds.length} Data Terpilih</span>
              </button>
            )}

            {/* Add New Sheet Button for Super Admin/Admin */}
            {isAdmin && !hideAddButton && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Buka Halaman Google Sheet baru untuk periode survei berikutnya"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Halaman Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable / Wrapping Flexbox of Sheet Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((profile, idx) => {
            const isGloballyActive = profile.id === activeProfileId;
            const isCurrentlyFiltered = selectedViewProfileId === profile.id;
            const rowCount = profileItemCounts[profile.id] || 0;
            const maxRows = profile.maxCapacityRows || 2000;
            const pct = Math.min(100, Math.round((rowCount / maxRows) * 100));

            return (
              <div
                key={profile.id}
                className={`relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isGloballyActive
                    ? 'bg-white border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                    : isCurrentlyFiltered
                    ? 'bg-white border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white shadow-2xs'
                }`}
              >
                <div>
                  {/* Top Bar inside Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                          isGloballyActive
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {profile.pageNumber || idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {profile.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isGloballyActive ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Aktif Global (Semua User)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              Halaman Arsip #{profile.pageNumber || idx + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {profile.spreadsheetUrl && (
                      <a
                        href={profile.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                        title="Buka dokumen di tab Google Sheets baru"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Description if any */}
                  {profile.description && (
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {profile.description}
                    </p>
                  )}

                  {/* Capacity Bar & Status */}
                  <div className="mt-3 space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-600">
                        Data Terisi: <strong>{rowCount}</strong> / {maxRows}
                      </span>
                      <span className="font-bold text-slate-700">{pct}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 95
                            ? 'bg-rose-500'
                            : pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>

                    <div className="pt-0.5 flex items-center justify-between">
                      {renderStatusBadge(profile.capacityStatus, rowCount, maxRows)}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setEditingProfile(profile)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                          Ubah Status
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                  {/* View/Filter this profile button */}
                  {onSelectViewProfile && (
                    <button
                      type="button"
                      onClick={() => onSelectViewProfile(profile.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        isCurrentlyFiltered
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{isCurrentlyFiltered ? 'Sedang Dilihat' : 'Lihat Data'}</span>
                    </button>
                  )}

                  {/* Set Active Global Button for Super Admin / Admin */}
                  {isAdmin && (
                    <>
                      {isGloballyActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tujuan Utama</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetActiveGlobal(profile)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                          title="Setel halaman ini agar otomatis menjadi tujuan simpan seluruh user"
                        >
                          <BookmarkCheck className="w-3 h-3" />
                          <span>Jadikan Aktif</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: Tambah Halaman / Sheet Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Tambah Halaman / Buku Spreadsheet Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Buka volume sheet baru saat sheet sebelumnya penuh atau untuk arsip periode baru.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Nama Halaman / Buku <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`Contoh: Halaman ${profiles.length + 1}: Survei Lanjutan Tahap 2`}
                  required
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Tautan / URL Google Sheet <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  required
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Estimasi Kapasitas Maksimal (Baris)
                  </label>
                  <input
                    type="number"
                    value={newMaxCapacity}
                    onChange={(e) => setNewMaxCapacity(Number(e.target.value) || 2000)}
                    min={100}
                    max={10000}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Endpoint Webhook (Apps Script)
                  </label>
                  <input
                    type="url"
                    value={newWebhook}
                    onChange={(e) => setNewWebhook(e.target.value)}
                    placeholder={googleSheetConfig.webhookUrl}
                    className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Catatan / Keterangan Halaman
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  placeholder="Keterangan peruntukan sheet ini..."
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                >
                  Simpan & Aktifkan untuk Semua User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pindahkan Data ke Halaman Lain */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Pindahkan Data ke Halaman Sheet Lain
                  </h3>
                  <p className="text-xs text-slate-500">
                    Memindahkan <strong>{selectedAssessmentIds.length} data</strong> yang dipilih ke volume sheet lain.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Pilih Halaman / Sheet Tujuan:
                </label>
                <div className="space-y-2">
                  {profiles.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        targetMoveProfileId === p.id
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="targetProfileRadio"
                          value={p.id}
                          checked={targetMoveProfileId === p.id}
                          onChange={() => setTargetMoveProfileId(p.id)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            Saat ini memuat {profileItemCounts[p.id] || 0} data
                          </div>
                        </div>
                      </div>
                      {p.id === activeProfileId && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                          Aktif
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  disabled={isMoving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleMoveAssessments}
                  disabled={isMoving || !targetMoveProfileId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isMoving ? 'Memindahkan...' : 'Konfirmasi Pindahkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ubah Status & Kapasitas Profile */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Ubah Status & Kapasitas Sheet
                  </h3>
                  <p className="text-xs text-slate-500">{editingProfile.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfileStatus} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Nama Halaman / Profil
                </label>
                <input
                  type="text"
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Status Kapasitas
                </label>
                <select
                  value={editingProfile.capacityStatus || 'normal'}
                  onChange={(e) => setEditingProfile({ ...editingProfile, capacityStatus: e.target.value as SheetCapacityStatus })}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">🟢 Normal / Aman (Siap Input)</option>
                  <option value="warning">🟡 Mendekati Penuh (&gt;80%)</option>
                  <option value="full">🔴 Penuh (Pindah ke Sheet Baru)</option>
                  <option value="archived">🗄️ Arsip Selesai / Terkunci</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Batas Kapasitas Maksimal (Baris)
                </label>
                <input
                  type="number"
                  value={editingProfile.maxCapacityRows || 2000}
                  onChange={(e) => setEditingProfile({ ...editingProfile, maxCapacityRows: Number(e.target.value) || 2000 })}
                  min={100}
                  max={20000}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Catatan Kapasitas
                </label>
                <input
                  type="text"
                  value={editingProfile.capacityNote || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, capacityNote: e.target.value })}
                  placeholder="Contoh: Sudah selesai survei 2026, ditutup untuk input baru"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-300 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {!editingProfile.isDefault && profiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteProfile(editingProfile.id);
                      setEditingProfile(null);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Halaman</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
