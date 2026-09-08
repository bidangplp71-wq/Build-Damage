import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HardDrive, Loader2, Save, Building2, MapPin, Pencil, Search, PlusCircle } from 'lucide-react';

export const DriveDirectory: React.FC = () => {
  const { currentUser, assessments, updateAssessment, showToast } = useApp();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Dropdown states for surveyors
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Filter out buildings for the table
  const displayBuildings = useMemo(() => {
    let list = assessments;
    // If not admin/verifikator/publik, show only my buildings OR buildings that have a link
    if (!['super_admin', 'admin', 'admin_verifikator', 'admin_publik'].includes(currentUser.role)) {
      list = assessments.filter(a => 
        (a as any).createdBy === currentUser.id || 
        (a as any).author === currentUser.name ||
        (a as any).createdByName === currentUser.name ||
        a.backupDriveUrl
      );
    }
    return list.sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }, [assessments, currentUser]);

  const handleSaveLink = async (buildingId: string, url: string, isFromForm = false) => {
    if (!url.includes('drive.google.com') && url.trim() !== '') {
      showToast('Harap masukkan tautan Google Drive yang valid', 'error');
      return;
    }
    
    if (isFromForm) {
      setIsAddingNew(true);
    } else {
      setIsSaving(true);
    }
    
    // Update local assessment data
    const res = await updateAssessment(buildingId, { backupDriveUrl: url.trim() });
    
    if (res.success) {
      showToast('Tautan Google Drive untuk gedung berhasil disimpan!', 'success');
      if (isFromForm) {
        setSelectedBuildingId('');
        setNewDriveUrl('');
      } else {
        setEditingId(null);
      }
    } else {
      showToast(res.message, 'error');
    }
    
    if (isFromForm) setIsAddingNew(false);
    else setIsSaving(false);
  };

  const startEdit = (id: string, currentUrl: string) => {
    setEditingId(id);
    setTempUrl(currentUrl || '');
  };

  // Only allow setting link for surveyor/admin (not read-only roles)
  const canSetLink = !['admin_publik', 'admin_verifikator'].includes(currentUser.role);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-indigo-600" />
            Direktori Drive Backup Gedung
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manajemen tautan folder Google Drive untuk foto-foto lapangan per gedung yang disurvei.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl shrink-0">
              <HardDrive className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-bold text-slate-800">Petunjuk Penggunaan Tautan Drive per Gedung</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Setiap data gedung kini memiliki kolom <strong>Tautan Google Drive</strong> masing-masing. Surveyor dapat memasukkan link folder Drive yang berisi foto-foto asli dari gedung yang bersangkutan. Hal ini sangat berguna jika sistem gagal mengunggah foto karena ukuran file terlalu besar. Pastikan hak akses folder Drive diatur menjadi <strong>"Siapa saja yang memiliki link (Pelihat)"</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {canSetLink && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800">Tambahkan Link G-Drive ke Gedung</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Pilih Nama Gedung / Fasilitas</label>
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium text-slate-700"
              >
                <option value="">-- Pilih Gedung --</option>
                {assessments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.buildingName} {a.desaName ? `(${a.desaName})` : ''}
                  </option>
                ))}
              </select>
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
            
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={() => handleSaveLink(selectedBuildingId, newDriveUrl, true)}
                disabled={!selectedBuildingId || isAddingNew}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-colors"
              >
                {isAddingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              {['super_admin', 'admin', 'admin_verifikator', 'admin_publik'].includes(currentUser.role) 
                ? 'Daftar Seluruh Data Gedung & Backup Drive'
                : 'Daftar Gedung Saya & Gedung Lain (Ber-Link)'}
            </h3>
          </div>
          <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
            Total Data Tampil: {displayBuildings.length}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse relative min-w-[800px]">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/3">Nama Gedung / Fasilitas</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tautan Google Drive (Backup)</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayBuildings.length > 0 ? displayBuildings.map((building) => (
                <tr key={building.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-800">{building.buildingName}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {building.desaName}, Kec. {building.kecamatanName}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {editingId === building.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="url"
                          value={tempUrl}
                          onChange={(e) => setTempUrl(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 bg-white"
                          autoFocus
                        />
                      </div>
                    ) : (
                      building.backupDriveUrl ? (
                        <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-lg max-w-sm">
                          <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {building.backupDriveUrl}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
                          Belum Diatur
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {editingId === building.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg text-xs font-bold transition-colors"
                        >
                          Batal
                        </button>
                        <button 
                          onClick={() => handleSaveLink(building.id, tempUrl, false)}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Simpan
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        {canSetLink && (
                          <button 
                            onClick={() => startEdit(building.id, building.backupDriveUrl || '')}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors border border-slate-200"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Set Link</span>
                          </button>
                        )}
                        
                        {building.backupDriveUrl ? (
                          <a 
                            href={building.backupDriveUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>Buka Folder</span>
                          </a>
                        ) : (
                          <button disabled className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold border border-slate-200 opacity-50 cursor-not-allowed">
                            Belum Ada
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-slate-500 text-sm">
                    <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    Belum ada data penilaian gedung yang sesuai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
