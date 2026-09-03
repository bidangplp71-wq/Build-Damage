import React from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_LIMITS, UserRole } from '../types';
import {
  Menu,
  ShieldCheck,
  Database,
  ChevronDown,
  Building2,
  ExternalLink,
  PlusCircle,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileNav }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    switchUserRole,
    getUserCountsByRole,
    syncAllToSheet,
    showToast,
    setSelectedAssessmentForEdit,
    googleSheetConfig,
    logout,
  } = useApp();

  const [roleDropdownOpen, setRoleDropdownOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const roleCounts = getUserCountsByRole();
  const currentRoleConfig = ROLE_LIMITS[currentUser.role];

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllToSheet();
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast('Gagal sinkronisasi Google Sheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const getTabInfo = () => {
    // If in role-specific mode, give contextual tab titles
    if (currentUser.role === 'admin_user' && (activeTab === 'input_baru' || activeTab === 'tambah')) {
      return {
        title: 'Formulir Survei Bangunan Lapangan (PUPR)',
        subtitle: 'Mode Surveyor: Pengisian cepat 8 komponen fisik pasca bencana, tersimpan langsung ke Google Sheet',
      };
    }
    if (currentUser.role === 'admin_verifikator' && activeTab === 'penilaian') {
      return {
        title: 'Verifikasi & Validasi Hasil Survei (TABG PUPR)',
        subtitle: 'Mode Verifikator: Periksa bukti visual foto kerusakan, validasi komponen, dan berikan persetujuan teknis',
      };
    }
    if (currentUser.role === 'admin_publik') {
      return {
        title: activeTab === 'dashboard' ? 'Portal Informasi & Statistik Bencana' : 'Pencarian Status Bangunan Publik',
        subtitle: 'Mode Publik: Rekapitulasi kerusakan wilayah & keterbukaan data pasca bencana daerah',
      };
    }

    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Dashboard & Analitik Kerusakan Gedung',
          subtitle: 'Statistik bencana, agregasi tingkat kerusakan, estimasi total biaya rehab (RAB) PUPR',
        };
      case 'penilaian':
        return {
          title: 'Data & Riwayat Penilaian Gedung',
          subtitle: 'Pencarian, filter kecamatan/desa, validasi teknis, cetak formulir & ekspor CSV',
        };
      case 'input_baru':
      case 'tambah':
        return {
          title: 'Formulir Penilaian Cepat Kerusakan (PUPR)',
          subtitle: 'Evaluasi 8 komponen & 21 sub-komponen bangunan, perhitungan otomatis RAB & tingkat kerusakan',
        };
      case 'wilayah':
        return {
          title: 'Manajemen Wilayah (Kecamatan & Desa)',
          subtitle: 'Pengelolaan hierarki wilayah dan dukungan pemekaran desa/kecamatan baru',
        };
      case 'dukcapil':
        return {
          title: 'Data Dukcapil (Kependudukan)',
          subtitle: 'Lookup NIK/KK, Excel, PDF & GSheet',
        };
      case 'manajemen_user':
      case 'users':
        return {
          title: 'Manajemen Pengguna & Kuota Hak Akses',
          subtitle: 'RBAC: Super Admin (1), Admin (3), Verifikator (15), Surveyor (100), Publik (10)',
        };
      case 'google_sheet':
      case 'googlesheets':
        return {
          title: 'Penyimpanan Langsung Google Sheet',
          subtitle: 'Data penilaian gedung langsung tercatat otomatis multi-sheet per kecamatan tanpa perlu sinkronisasi manual',
        };
      case 'firebase_shield':
      case 'firebase':
        return {
          title: 'Keamanan & Proteksi Firebase Firestore',
          subtitle: 'Pengawasan aturan keamanan (rules) dan validasi data berbasis peran',
        };
      default:
        return {
          title: 'SIM-PKBG Kerusakan Gedung Pasca Bencana',
          subtitle: 'Pedoman Teknis PUPR No. 22/PRT/M/2018',
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Mobile Drawer Toggle + Tab Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileNav}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors shrink-0"
            title="Buka Navigasi Tab Vertikal"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
              {tabInfo.title}
            </h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">
              {tabInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Quick actions & User Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Add button on header if not already in input form */}
          {activeTab !== 'input_baru' && activeTab !== 'tambah' && (
            <button
              onClick={() => {
                setSelectedAssessmentForEdit(null);
                setActiveTab('input_baru');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Input Baru</span>
            </button>
          )}

          {/* Direct Google Sheet Link & Status */}
          {googleSheetConfig.spreadsheetUrl ? (
            <a
              href={googleSheetConfig.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka dokumen Google Spreadsheet di tab baru"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Buka Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-600" />
            </a>
          ) : (
            <button
              onClick={() => setActiveTab('google_sheet')}
              title="Atur link Google Sheet untuk penyimpanan langsung"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Atur Link Sheet</span>
            </button>
          )}

          {/* User Account Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-indigo-600 font-semibold truncate">
                  {currentRoleConfig.title}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-amber-400 font-medium truncate">{currentRoleConfig.title}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
                    Hak akses aktif sesuai fungsi akun terdaftar.
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sesi Aman</span>
                  </div>
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      logout();
                    }}
                    className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-xs transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
