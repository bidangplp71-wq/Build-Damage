import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, ROLE_LIMITS } from '../types';
import {
  exportActivityLogsToExcel,
  exportActivityLogsToCsv,
} from '../services/googleSheetsService';
import {
  Activity,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Printer,
  FileEdit,
  LogIn,
  LogOut,
  SlidersHorizontal,
  ExternalLink,
  CheckCircle2,
  Clock,
  Laptop,
} from 'lucide-react';

export const UserActivityLogView: React.FC = () => {
  const {
    activityLogs,
    syncActivityLogsToSheet,
    clearActivityLogs,
    googleSheetConfig,
    showToast,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchQuery =
        !searchQuery ||
        log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actionDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.targetResource && log.targetResource.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRole = selectedRole === 'all' || log.userRole === selectedRole;
      const matchCategory = selectedCategory === 'all' || log.actionCategory === selectedCategory;

      return matchQuery && matchRole && matchCategory;
    });
  }, [activityLogs, searchQuery, selectedRole, selectedCategory]);

  // Statistics
  const authCount = activityLogs.filter((l) => l.actionCategory === 'Autentikasi').length;
  const assessmentCount = activityLogs.filter((l) => l.actionCategory === 'Penilaian Kerusakan').length;
  const printCount = activityLogs.filter((l) => l.actionCategory === 'Pencetakan & Dokumen').length;
  const sheetSyncCount = activityLogs.filter((l) => l.actionCategory === 'Integrasi Google Sheet').length;

  const handleSyncToGoogleSheet = async () => {
    if (!googleSheetConfig.webhookUrl || !googleSheetConfig.webhookUrl.startsWith('http')) {
      showToast('Webhook Google Sheet belum dikonfigurasi. Silakan atur di menu Penyimpanan Google Sheet.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      await syncActivityLogsToSheet();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportExcel = () => {
    if (activityLogs.length === 0) {
      showToast('Belum ada log aktivitas untuk diekspor.', 'info');
      return;
    }
    exportActivityLogsToExcel(activityLogs);
    showToast('File Excel Log Akses Pengguna berhasil diunduh.', 'success');
  };

  const handleExportCsv = () => {
    if (activityLogs.length === 0) {
      showToast('Belum ada log aktivitas untuk diekspor.', 'info');
      return;
    }
    exportActivityLogsToCsv(activityLogs);
    showToast('File CSV Log Akses Pengguna berhasil diunduh.', 'success');
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'admin_verifikator':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'admin_user':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'admin_publik':
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Autentikasi':
        return <LogIn className="w-3.5 h-3.5 text-blue-600" />;
      case 'Penilaian Kerusakan':
        return <FileEdit className="w-3.5 h-3.5 text-amber-600" />;
      case 'Pencetakan & Dokumen':
        return <Printer className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Integrasi Google Sheet':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Analitik Akses & Audit Trail Pengguna
            </h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Pencatatan real-time aktivitas sistem: nama pengguna, peran (User Role), akses yang dilakukan,
            pencetakan dokumen, dan sinkronisasi ke tab <span className="font-semibold text-slate-700 font-mono">Log_Akses_Pengguna</span> di Google Sheet.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleSyncToGoogleSheet}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron ke Google Sheet'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Excel</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {activityLogs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Bersihkan seluruh riwayat log aktivitas pengguna di perangkat ini?')) {
                  clearActivityLogs();
                }
              }}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200"
              title="Bersihkan Log Aktivitas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Akses Tercatat</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{activityLogs.length}</p>
          <span className="text-[11px] text-slate-400">Semua aktivitas sistem</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Sesi Autentikasi</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{authCount}</p>
          <span className="text-[11px] text-blue-600 font-medium">Login & ganti peran</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Aktivitas Penilaian</span>
            <FileEdit className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{assessmentCount}</p>
          <span className="text-[11px] text-amber-600 font-medium">Input, ubah, validasi</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Cetak Laporan</span>
            <Printer className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{printCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Cetak fisik & PDF</span>
        </div>
      </div>

      {/* Google Sheet Sync Notice Box */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950">
              Integrasi Log Aktivitas ke Google Sheet (Tab: {googleSheetConfig.logSheetName || 'Log_Akses_Pengguna'})
            </h4>
            <p className="text-emerald-800 mt-0.5">
              Setiap kali pengguna login, menginput penilaian, atau mencetak laporan, sistem otomatis mencatat role, nama, dan detail akses ke Google Sheet.
            </p>
          </div>
        </div>

        {googleSheetConfig.spreadsheetUrl && (
          <a
            href={googleSheetConfig.spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-900 font-bold rounded-xl border border-emerald-300 hover:bg-emerald-100 transition-colors shrink-0 shadow-2xs"
          >
            <span>Buka Google Sheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, email, tindakan..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter Role */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Peran:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
            >
              <option value="all">Semua Peran</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin Utama</option>
              <option value="admin_verifikator">Verifikator TABG</option>
              <option value="admin_user">Surveyor Lapangan</option>
              <option value="admin_publik">Publik / Tamu</option>
            </select>
          </div>

          {/* Filter Category */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Kategori:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
            >
              <option value="all">Semua Kategori</option>
              <option value="Autentikasi">Autentikasi</option>
              <option value="Penilaian Kerusakan">Penilaian Kerusakan</option>
              <option value="Pencetakan & Dokumen">Pencetakan & Dokumen</option>
              <option value="Integrasi Google Sheet">Integrasi Google Sheet</option>
              <option value="Sistem & Pengguna">Sistem & Pengguna</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-sm text-slate-900">
              Riwayat Akses Terkini ({filteredLogs.length} dari {activityLogs.length} Aktivitas)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Waktu disinkronkan otomatis</span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-800 text-sm">Belum Ada Catatan Log</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Aktivitas pengguna seperti login, pengisian formulir survei bangunan, dan pencetakan laporan akan dicatat secara otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Waktu Akses</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Peran (Role)</th>
                  <th className="py-3 px-4">Aktivitas / Aksi</th>
                  <th className="py-3 px-4">Objek & Keterangan</th>
                  <th className="py-3 px-4">Perangkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formatDate(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.userName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.userEmail}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(
                          log.userRole
                        )}`}
                      >
                        {log.roleTitle}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        {getCategoryIcon(log.actionCategory)}
                        <span>{log.actionDescription}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{log.actionCategory}</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {log.targetResource && (
                        <div className="font-semibold text-slate-800 text-[11px] truncate">
                          {log.targetResource}
                        </div>
                      )}
                      {log.details && (
                        <div className="text-[11px] text-slate-500 truncate">{log.details}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[10px]">
                      <div className="flex items-center gap-1">
                        <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{log.deviceInfo ? 'Browser Web' : 'Sistem'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
