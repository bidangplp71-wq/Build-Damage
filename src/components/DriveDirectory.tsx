import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { HardDrive, Loader2, Save, Building2, MapPin, Pencil, PlusCircle, Link as LinkIcon, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BuildingAssessment } from '../types';

export const DriveDirectory: React.FC = () => {
  const { currentUser, assessments, updateAssessment, addAssessment, showToast } = useApp();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Dropdown states for surveyors
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBuildingName, setManualBuildingName] = useState('');
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
        disasterType: 'Lainnya',
        disasterDate: new Date().toISOString().split('T')[0],
        assessmentDate: new Date().toISOString().split('T')[0],
        buildingCategory: 'Fasilitas Umum Lainnya',
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
        createdAt: new Date().toISOString(),
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
            Gunakan fitur ini untuk menautkan folder Google Drive foto gedung agar data foto mudah dibuka, disimpan, dan dibagikan ke seluruh tim.
          </p>
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
                Foto-foto yang Anda upload disimpan secara otomatis di database aplikasi dan browser cache. Apabila kuota Firestore tercapai atau Anda memiliki dokumentasi foto resolusi tinggi, tautkan link Folder Google Drive di bawah ini agar semua foto gedung dapat langsung dibuka dan diakses dengan cepat.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed font-semibold text-indigo-700">
                Tautan Google Drive yang Anda masukkan di sini akan otomatis muncul pada laporan cetak dan dapat diklik oleh semua pengguna/admin.
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              {['super_admin', 'admin', 'admin_verifikator', 'admin_publik'].includes(currentUser.role) 
                ? 'Daftar Seluruh Data Gedung'
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
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status Foto Sistem</th>
                <th className="px-5 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tautan G-Drive Backup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayBuildings.length > 0 ? displayBuildings.map((building) => {
                const photoCount = building.photos ? building.photos.length : 0;
                
                // Calculate error photos vs valid photos
                // A photo is considered error/empty if url is missing, undefined, or too short to be a valid base64 or URL
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
                
                return (
                  <tr key={building.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-800">{building.buildingName}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {building.desaName !== '-' ? `${building.desaName}, ` : ''} 
                        {building.kecamatanName !== '-' ? `Kec. ${building.kecamatanName}` : 'Lokasi Belum Diatur'}
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
                          
                          {errorPhotosCount > 0 && !building.backupDriveUrl && (
                            <div className="text-[9px] text-rose-500 font-medium">
                              Harap isi link G-Drive di sebelah kanan!
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
                            className="w-48 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium text-slate-800 bg-white"
                            autoFocus
                          />
                          <button 
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Batal
                          </button>
                          <button 
                            onClick={() => handleUpdateInline(building.id)}
                            disabled={isSaving}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${errorPhotosCount > 0 && !building.backupDriveUrl ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-300' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'}`}
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
                              Belum Ada Link
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }) : (
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
