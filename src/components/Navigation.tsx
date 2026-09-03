import React from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_LIMITS, ROLE_NAV_CONFIGS, UserRole } from '../types';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  MapPin,
  Users,
  FileSpreadsheet,
  ShieldAlert,
  Building2,
  ShieldCheck,
  ChevronDown,
  X,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Search,
  Lock,
  LogOut,
} from 'lucide-react';

interface NavigationProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    activeTab,
    setActiveTab,
    assessments,
    dukcapilRecords,
    currentUser,
    switchUserRole,
    getUserCountsByRole,
    setSelectedAssessmentForEdit,
    logout,
  } = useApp();

  const [roleMenuOpen, setRoleMenuOpen] = React.useState(false);

  const pendingVerificationCount = assessments.filter(
    (a) => a.verificationStatus === 'Menunggu Verifikasi'
  ).length;

  const myAssessmentsCount = assessments.filter(
    (a) => a.createdBy === currentUser.id
  ).length;

  const roleCounts = getUserCountsByRole();
  const currentRoleConfig = ROLE_LIMITS[currentUser.role];
  const navConfig = ROLE_NAV_CONFIGS[currentUser.role];

  // Configure tabs strictly tailored to each role
  const getTabsForRole = () => {
    switch (currentUser.role) {
      case 'admin_user':
        // Surveyor: Focused exclusively on Form Input & Own Survey Entries
        return [
          {
            id: 'input_baru',
            label: 'Formulir Survei Bangunan',
            desc: 'Input kerusakan cepat standar PUPR',
            icon: PlusCircle,
            badge: null,
            highlight: true,
          },
          {
            id: 'penilaian',
            label: 'Riwayat Survei Saya',
            desc: 'Daftar data yang telah Anda kirim',
            icon: ClipboardList,
            badge: myAssessmentsCount || assessments.length,
            badgeLabel: 'gedung',
          },
        ];

      case 'admin_verifikator':
        // Verifikator: Focused on Technical Verification & Audit
        return [
          {
            id: 'penilaian',
            label: 'Verifikasi & Validasi Data',
            desc: 'Audit foto visual & persetujuan teknis',
            icon: ClipboardList,
            badge: pendingVerificationCount,
            badgeLabel: 'antrean',
            highlight: true,
          },
          {
            id: 'dashboard',
            label: 'Dashboard Ringkasan Bencana',
            desc: 'Statistik & estimasi biaya per wilayah',
            icon: LayoutDashboard,
            badge: null,
          },
        ];

      case 'admin_publik':
        // Publik: Focused on Public Dashboard and Lookup
        return [
          {
            id: 'dashboard',
            label: 'Dashboard Informasi Publik',
            desc: 'Rekapitulasi bencana & kerusakan daerah',
            icon: LayoutDashboard,
            badge: null,
          },
          {
            id: 'penilaian',
            label: 'Pencarian Status Bangunan',
            desc: 'Informasi status kerusakan pasca bencana',
            icon: Search,
            badge: assessments.length,
            badgeLabel: 'data',
          },
        ];

      case 'super_admin':
      case 'admin':
      default:
        // Super Admin & Admin: Full Access to all 8 modules
        return [
          {
            id: 'dashboard',
            label: 'Dashboard & Analitik',
            desc: 'Ringkasan bencana & biaya',
            icon: LayoutDashboard,
            badge: null,
          },
          {
            id: 'penilaian',
            label: 'Data Penilaian Gedung',
            desc: 'Tabel, filter, cetak & ekspor',
            icon: ClipboardList,
            badge: assessments.length,
          },
          {
            id: 'input_baru',
            label: 'Form Penilaian Cepat',
            desc: 'Input kerusakan standar PUPR',
            icon: PlusCircle,
            badge: null,
            highlight: true,
          },
          {
            id: 'wilayah',
            label: 'Kecamatan & Desa',
            desc: 'Pemekaran & batas wilayah',
            icon: MapPin,
            badge: null,
          },
          {
            id: 'dukcapil',
            label: 'Data Dukcapil (Kependudukan)',
            desc: 'Lookup NIK/KK, Excel, PDF & GSheet',
            icon: UserCheck,
            badge: dukcapilRecords.length,
            badgeLabel: 'jiwa',
          },
          {
            id: 'manajemen_user',
            label: 'Pengguna & Kuota',
            desc: 'RBAC Super Admin s/d Publik',
            icon: Users,
            badge: null,
          },
          {
            id: 'google_sheet',
            label: 'Penyimpanan Google Sheet',
            desc: 'Tersimpan otomatis multi-sheet',
            icon: FileSpreadsheet,
            badge: assessments.filter((a) => a.googleSheetSynced).length,
            badgeLabel: 'tersimpan',
          },
          {
            id: 'firebase_shield',
            label: 'Firebase Shield',
            desc: 'Firestore rules & proteksi',
            icon: ShieldAlert,
            badge: null,
          },
        ];
    }
  };

  const tabs = getTabsForRole();

  const handleSelectTab = (tabId: string) => {
    if (tabId === 'input_baru') {
      setSelectedAssessmentForEdit(null);
    }
    setActiveTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 border border-amber-300/40">
            <Building2 className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PUPR No. 22/2018
              </span>
            </div>
            <h1 className="text-sm font-bold text-white tracking-tight mt-0.5">
              SIM-PKBG PUPR
            </h1>
            <p className="text-[10px] text-slate-400">Penilaian Pasca Bencana</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Role Context Notification Bar */}
      <div className="px-3 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peran Pengguna</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentRoleConfig.badgeColor}`}>
            {currentRoleConfig.title}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 leading-tight line-clamp-2">
          {navConfig?.roleSubtitle || currentRoleConfig.description}
        </p>
      </div>

      {/* Quick Action Button based on Role */}
      <div className="p-3 border-b border-slate-800/80">
        {currentUser.role === 'admin_user' && (
          <button
            onClick={() => handleSelectTab('input_baru')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ Input Survei Bangunan</span>
          </button>
        )}

        {currentUser.role === 'admin_verifikator' && (
          <button
            onClick={() => handleSelectTab('penilaian')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-slate-950" />
            <span>Verifikasi Survei ({pendingVerificationCount})</span>
          </button>
        )}

        {currentUser.role === 'admin_publik' && (
          <button
            onClick={() => handleSelectTab('penilaian')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-sky-500/10 cursor-pointer"
          >
            <Search className="w-4 h-4 text-slate-950" />
            <span>Cari Status Gedung</span>
          </button>
        )}

        {(currentUser.role === 'super_admin' || currentUser.role === 'admin') && (
          <button
            onClick={() => handleSelectTab('input_baru')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ Input Penilaian Baru</span>
          </button>
        )}
      </div>

      {/* Vertical Tabs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>{currentUser.role === 'super_admin' || currentUser.role === 'admin' ? 'Menu Navigasi Lengkap' : 'Menu Utama Peran'}</span>
          <span className="text-[10px] font-mono text-slate-500">{tabs.length} Menu</span>
        </div>

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'input_baru' && activeTab === 'tambah') ||
            (tab.id === 'manajemen_user' && activeTab === 'users') ||
            (tab.id === 'google_sheet' && activeTab === 'googlesheets') ||
            (tab.id === 'firebase_shield' && activeTab === 'firebase');

          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left group cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'
                  }`}
                />
                <div className="truncate">
                  <div className="truncate">{tab.label}</div>
                  <div
                    className={`text-[10px] truncate font-normal ${
                      isActive ? 'text-slate-900/80' : 'text-slate-400'
                    }`}
                  >
                    {tab.desc}
                  </div>
                </div>
              </div>

              {tab.badge !== null && tab.badge !== undefined && (
                <span
                  className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                    isActive
                      ? 'bg-slate-950 text-amber-300'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Account & Session Management at Bottom of Rail */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <div className="rounded-xl bg-slate-800/90 border border-slate-700/80 p-2.5 space-y-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-amber-400 font-medium truncate">
                {currentRoleConfig.title}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Sesi Aman</span>
            </span>
            <button
              onClick={() => logout()}
              className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-[11px] transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* System Badges */}
        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3 h-3" />
            <span>Firebase Protected</span>
          </span>
          <span className="flex items-center gap-1 text-emerald-300">
            <CheckCircle2 className="w-3 h-3" />
            <span>Google Sheet Synced</span>
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Vertical Tab Rail */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-30 shadow-xl">
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
