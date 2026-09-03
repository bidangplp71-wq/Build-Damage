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
          subtitle: 'Data penilaian gedung langsung tercatat otomatis ke spreadsheet tanpa perlu sinkronisasi manual',
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

          {/* User Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-left transition-all"
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
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-800 mb-2">
                  <p className="text-xs font-bold text-white">Ganti Peran Pengguna (RBAC)</p>
                  <p className="text-[10px] text-slate-400">Pilih role untuk menguji pembatasan kuota dan wewenang:</p>
                </div>

                <div className="space-y-1">
                  {(Object.keys(ROLE_LIMITS) as UserRole[]).map((roleKey) => {
                    const limit = ROLE_LIMITS[roleKey];
                    const count = roleCounts[roleKey] || 0;
                    const isCurrent = currentUser.role === roleKey;

                    return (
                      <button
                        key={roleKey}
                        onClick={() => {
                          switchUserRole(roleKey);
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          isCurrent
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-slate-950' : 'bg-amber-400'}`}></span>
                          <span>{limit.title}</span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isCurrent
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {count}/{limit.max}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 px-2 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aturan kuota & peran terlindungi</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
