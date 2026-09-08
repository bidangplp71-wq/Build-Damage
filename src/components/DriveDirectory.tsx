import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HardDrive, ExternalLink, Link as LinkIcon, ShieldCheck, User as UserIcon, Loader2, Save, ArrowUpRight } from 'lucide-react';
import { UserAccount } from '../types';

export const DriveDirectory: React.FC = () => {
  const { currentUser, users, updateUser, syncUsersToGoogleSheet, showToast } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [driveUrl, setDriveUrl] = useState(currentUser.driveFolderUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  // Filter out surveyors for admin view
  const surveyors = users.filter((u) => u.role === 'surveyor_lapangan' && u.status === 'active');

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.includes('drive.google.com') && driveUrl.trim() !== '') {
      showToast('Harap masukkan tautan Google Drive yang valid', 'error');
      return;
    }
    
    setIsSaving(true);
    
    // Update local user data
    const res = updateUser(currentUser.id, { driveFolderUrl: driveUrl.trim() });
    
    if (res.success) {
      // Sync up to G-Sheet
      await syncUsersToGoogleSheet();
      showToast('Tautan Google Drive berhasil disimpan dan disinkronisasikan!', 'success');
      setIsEditing(false);
    } else {
      showToast(res.message, 'error');
    }
    
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-indigo-600" />
            Direktori G-Drive Surveyor
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manajemen tautan folder Google Drive untuk backup dan upload foto lapangan.
          </p>
        </div>
      </div>

      {/* Surveyor Input Section (Accessible by All Roles to set their own if needed, but mainly for Surveyors) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl shrink-0">
              <HardDrive className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tautan Folder G-Drive Saya</h3>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                  Bagikan tautan (link) ke folder Google Drive khusus Anda. Admin dapat mengakses folder ini jika membutuhkan file asli, foto yang gagal terunggah, atau lampiran tambahan lainnya. 
                  Pastikan akses link telah diubah menjadi <strong>"Siapa saja yang memiliki link (Pelihat/Editor)"</strong>.
                </p>
              </div>

              {!isEditing ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                      <LinkIcon className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Tautan Saat Ini</p>
                      {currentUser.driveFolderUrl ? (
                        <a 
                          href={currentUser.driveFolderUrl}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 truncate block hover:underline"
                        >
                          {currentUser.driveFolderUrl}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 italic">Belum ada tautan yang disetel.</span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="shrink-0 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-lg transition-colors shadow-sm"
                  >
                    {currentUser.driveFolderUrl ? 'Ubah Tautan' : 'Tambahkan Tautan'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveLink} className="space-y-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">URL / Link Folder G-Drive</label>
                    <input 
                      type="url"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{isSaving ? 'Menyimpan...' : 'Simpan & Sinkronkan'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin View: List of all Surveyors' Drive Links */}
      {(currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'verifikator') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-slate-500" />
              Direktori Tautan Surveyor ({surveyors.length} Akun)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Surveyor & Instansi</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tautan Google Drive (Backup)</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {surveyors.length > 0 ? surveyors.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{user.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        {user.agency}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {user.driveFolderUrl ? (
                        <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-lg max-w-sm">
                          <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {user.driveFolderUrl}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
                          Belum Diatur
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {user.driveFolderUrl ? (
                        <a 
                          href={user.driveFolderUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                        >
                          <span>Buka Folder</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button disabled className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold border border-slate-200 opacity-50 cursor-not-allowed">
                          Buka Folder
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500 text-sm">
                      Belum ada surveyor lapangan yang terdaftar aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
