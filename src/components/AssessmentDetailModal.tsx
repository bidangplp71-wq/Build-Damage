import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { BuildingAssessment, BUILDING_CATEGORY_CONFIGS } from '../types';
import { formatRupiah, terbilang } from '../utils/puprCalculations';
import {
  Printer,
  FileSpreadsheet,
  X,
  Camera,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';
import { BuildingPhotoGallery } from './BuildingPhotoGallery';
import { syncAssessmentPhotosToDrive } from '../services/googleSheetsService';

interface Props {
  assessment: BuildingAssessment;
  onClose: () => void;
}

const safeNumber = (val: unknown, fallback = 0): number => {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
};

export const AssessmentDetailModal: React.FC<Props> = ({ assessment, onClose }) => {
  const { syncAssessmentToSheet, googleSheetConfig, logUserActivity, showToast } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [showSignatures, setShowSignatures] = useState(true);

  const hasPhotos = Boolean(assessment.photos && assessment.photos.length > 0);
  const [showPhotos, setShowPhotos] = useState(false);

  const handleSyncPhotosToDrive = async () => {
    if (!googleSheetConfig.webhookUrl) {
      showToast('Tentukan URL Webhook Google Apps Script terlebih dahulu di menu Integrasi Google Sheet', 'error');
      return;
    }
    setIsUploadingToDrive(true);
    try {
      const res = await syncAssessmentPhotosToDrive(assessment, googleSheetConfig);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast('Gagal mengunggah foto: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Manage body class for print isolation & scroll lock
  useEffect(() => {
    document.body.classList.add('pupr-modal-active');
    const safeTotalPercent = safeNumber(assessment.totalDamagePercent);
    logUserActivity(
      'VIEW_DETAIL',
      'Penilaian Kerusakan',
      `Membuka Rincian Penilaian: ${assessment.buildingName}`,
      assessment.code || assessment.buildingName,
      `Klasifikasi: ${assessment.damageClassification || 'Belum Diklasifikasi'} (${safeTotalPercent.toFixed(1)}%)`
    );
    return () => {
      document.body.classList.remove('pupr-modal-active');
    };
  }, [assessment.id]);

  const handlePrintWithoutPhotos = () => {
    setShowPhotos(false);
    logUserActivity(
      'PRINT_REPORT',
      'Pencetakan & Dokumen',
      `Mencetak Dokumen Laporan: ${assessment.buildingName} (Tanpa Foto)`,
      assessment.code || assessment.buildingName,
      `Kategori: ${assessment.buildingCategory} — Nilai Rehab: Rp ${safeNumber(assessment.roundedRehabCost).toLocaleString('id-ID')}`
    );
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handlePrintWithPhotos = () => {
    if (!hasPhotos) {
      showToast('Tidak ada foto dokumentasi kerusakan untuk dicetak.', 'info');
      setShowPhotos(false);
    } else {
      setShowPhotos(true);
    }
    logUserActivity(
      'PRINT_WITH_PHOTOS',
      'Pencetakan & Dokumen',
      `Mencetak Dokumen Laporan + Foto Visual: ${assessment.buildingName}`,
      assessment.code || assessment.buildingName,
      `Lampiran Foto: ${assessment.photos?.length || 0} Dokumentasi Visual Lapangan`
    );
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleSyncToSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAssessmentToSheet(assessment.id);
      showToast(res.message, res.success ? 'success' : 'error');
    } catch {
      showToast('Gagal sinkronisasi data ke Google Sheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const modalContent = (
    <div id="pupr-print-portal">
      <div className="modal-backdrop-wrap fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="modal-card-sheet bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-300 max-h-[95vh] flex flex-col overflow-hidden">
          {/* Top Control Bar (Hidden on print) */}
          <div className="no-print print-controls flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Dokumen Standar PUPR
              </span>
              <span className="font-mono text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                {assessment.code || 'Tanpa No. Registrasi'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle with Photos preview */}
              {hasPhotos ? (
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={showPhotos}
                    onChange={(e) => setShowPhotos(e.target.checked)}
                    className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    Sertakan Foto ({assessment.photos?.length})
                  </span>
                </label>
              ) : null}

              {/* Toggle Signatures */}
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Tampilkan TTD</span>
              </label>

              {/* ACTION 1: Cetak Tanpa Foto */}
              <button
                type="button"
                onClick={handlePrintWithoutPhotos}
                title="Cetak dokumen analisis PUPR tanpa foto dokumentasi"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors shadow-2xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Cetak Tanpa Foto</span>
              </button>

              {/* ACTION 2: Cetak Bersama Foto */}
              {hasPhotos ? (
                <button
                  type="button"
                  onClick={handlePrintWithPhotos}
                  title="Cetak dokumen analisis PUPR lengkap dengan foto dokumentasi kerusakan"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-slate-950" />
                  <Printer className="w-3.5 h-3.5 text-slate-950" />
                  <span>Cetak Bersama Foto</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePrintWithPhotos}
                  disabled
                  title="Belum ada foto yang diunggah"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Cetak Bersama Foto (0 Foto)</span>
                </button>
              )}

              {/* Sync to Google Sheet button */}
              <button
                type="button"
                onClick={handleSyncToSheet}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sinkron...' : 'Kirim Google Sheet'}</span>
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer ml-1"
                title="Tutup Pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Official PUPR Printable Document Area */}
          <div className="printable-content-area overflow-y-auto p-6 sm:p-10 font-sans text-slate-900 space-y-6">
            {/* Header Title */}
            <div className="text-center border-b-2 border-slate-900 pb-3 avoid-break">
              <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950">
                ANALISIS CEPAT TINGKAT KERUSAKAN PADA KOMPONEN BANGUNAN GEDUNG
              </h2>
              <h3 className="text-sm font-bold uppercase text-slate-800 mt-0.5 tracking-wider">
                DALAM RANGKA REHABILITASI PASCA BENCANA
              </h3>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Berdasarkan Pedoman Teknis Penilaian Kerusakan Bangunan Gedung Kementerian PUPR
              </p>
            </div>

            {/* Building Identification Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-x-8 gap-y-2 text-xs border border-slate-300 p-4 rounded-lg bg-slate-50/50 avoid-break print:p-3 print:gap-x-6">
              <div className="space-y-1.5">
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Nama Bangunan</span>
                  <span className="col-span-2 font-bold text-slate-950">: {assessment.buildingName}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Kategori / Fungsi</span>
                  <span className="col-span-2 font-bold text-slate-950 flex items-center gap-1.5">
                    : 
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                        BUILDING_CATEGORY_CONFIGS[assessment.buildingCategory || 'Gedung Pemerintah']?.badgeClass ||
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      {assessment.buildingCategory || 'Gedung Pemerintah'}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Tahun Dibangun</span>
                  <span className="col-span-2 font-medium text-slate-900">: {assessment.yearBuilt}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Luas Total Lantai</span>
                  <span className="col-span-2 font-bold text-slate-950">: {assessment.totalFloorAreaM2} M²</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Jumlah Tingkat</span>
                  <span className="col-span-2 font-medium text-slate-900">: {assessment.numberOfFloors} Lantai</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Dinas Teknis</span>
                  <span className="col-span-2 font-medium text-slate-900">: {assessment.responsibleDepartment}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">
                    {assessment.buildingCategory === 'Hunian Masyarakat' ? 'Nama Pemilik Rumah' : 'Nama Pemilik Gedung'}
                  </span>
                  <span className="col-span-2 font-bold text-slate-950">
                    : {assessment.buildingCategory === 'Hunian Masyarakat' ? (assessment.namaPemilikRumah || assessment.ownerAgency) : (assessment.namaPemilikGedung || assessment.ownerAgency)}
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Kelas Bangunan</span>
                  <span className="col-span-2 font-medium text-slate-900">: {assessment.buildingClass}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Lokasi Administratif</span>
                  <span className="col-span-2 font-bold text-slate-950">: Kec. {assessment.kecamatanName}, {assessment.desaName}</span>
                </div>
              </div>
            </div>

            {/* PUPR Table Assessment */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Tabel Komponen Bangunan (Standar PUPR)</span>
                <span>Nilai Tingkat Kerusakan: {safeNumber(assessment.totalDamagePercent).toFixed(2)}%</span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-300 w-10 text-center">No</th>
                      <th className="py-2 px-3 border-r border-slate-300">Komponen Bangunan</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Bobot Maks (%)</th>
                      <th className="py-2 px-3 border-r border-slate-300 text-center w-24">Tingkat Rusak (%)</th>
                      <th className="py-2 px-3 text-center w-28">Nilai Kerusakan (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!assessment.components || assessment.components.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                          Belum ada rincian komponen yang tersimpan.
                        </td>
                      </tr>
                    ) : (
                      assessment.components.map((c: any, index: number) => {
                        const weight = safeNumber(c?.bobotPercent ?? c?.weight ?? 0);
                        const damagePercent = safeNumber(c?.damagePercentInput ?? c?.damagePercent ?? 0);
                        const weightedDamage = safeNumber(
                          c?.calculatedScore ?? c?.weightedDamage ?? ((damagePercent * weight) / 100)
                        );
                        const compName = c?.subComponentName || c?.name || c?.componentName || `Komponen ${index + 1}`;
                        const groupName = c?.componentName && c?.componentName !== compName ? c?.componentName : null;

                        return (
                          <tr key={c?.id || index} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono text-slate-500">
                              {c?.componentNo || index + 1}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 font-medium text-slate-900">
                              {groupName ? (
                                <div>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{groupName}</span>
                                  <span>{compName}</span>
                                </div>
                              ) : (
                                <span>{compName}</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
                              {weight.toFixed(1)}%
                            </td>
                            <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono text-slate-700">
                              {damagePercent.toFixed(1)}%
                            </td>
                            <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-950 bg-slate-50/50">
                              {weightedDamage.toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-400 bg-slate-100 font-bold text-slate-950">
                    <tr>
                      <td colSpan={4} className="py-2 px-3 text-right border-r border-slate-300">
                        Total Tingkat Kerusakan Bangunan:
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-sm bg-amber-100 text-amber-950">
                        {safeNumber(assessment.totalDamagePercent).toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Analysis Conclusions & Cost Estimates Box */}
            <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/70 space-y-3 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Kesimpulan Analisis Hasil Pengamatan Lapangan
                </span>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-amber-500 text-slate-950">
                  Kategori: {assessment.damageClassification || 'Belum Diklasifikasi'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">HSBGN (Biaya Bangunan Baru / M²)</span>
                    <span className="font-mono font-semibold">{formatRupiah(safeNumber(assessment.hsbgnPerM2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tingkat Kerusakan Total</span>
                    <span className="font-mono font-semibold">{safeNumber(assessment.totalDamagePercent).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Biaya Penanganan / M²</span>
                    <span className="font-mono font-semibold">{formatRupiah(safeNumber(assessment.treatmentCostPerM2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Biaya Pembongkaran ({safeNumber(assessment.demolitionPercent, 8)}%) / M²</span>
                    <span className="font-mono font-semibold">{formatRupiah(safeNumber(assessment.demolitionCostPerM2))}</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Biaya Per M²</span>
                    <span className="font-mono font-semibold">{formatRupiah(safeNumber(assessment.totalCostPerM2))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Luas Total Bangunan</span>
                    <span className="font-mono font-semibold">{safeNumber(assessment.totalFloorAreaM2)} M²</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Estimasi Biaya Rehabilitasi:</span>
                    <span className="font-mono">{formatRupiah(safeNumber(assessment.totalRehabCost))}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-amber-950 bg-amber-100 p-1.5 rounded border border-amber-300">
                    <span>Dibulatkan Menjadi:</span>
                    <span className="font-mono text-sm">{formatRupiah(safeNumber(assessment.roundedRehabCost))}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 italic border-t border-slate-200 pt-2">
                Terbilang : {assessment.roundedRehabCost !== undefined ? `${terbilang(safeNumber(assessment.roundedRehabCost))} Rupiah` : (assessment.costTerbilang || '-')}
              </div>
            </div>

            {/* Visual Photos Documentation (Rendered ONLY when showPhotos is true) */}
            {showPhotos && hasPhotos && (
              <div className="border border-slate-300 p-4 rounded-xl space-y-3 bg-slate-50/70 avoid-break">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Dokumentasi Visual Kerusakan Fisik Bangunan ({assessment.photos?.length || 0} / 10 Foto)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    {googleSheetConfig.webhookUrl && (
                      <button
                        type="button"
                        onClick={handleSyncPhotosToDrive}
                        disabled={isUploadingToDrive}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                        title="Unggah atau perbarui arsip foto gedung ini langsung ke Google Drive"
                      >
                        <UploadCloud className={`w-3.5 h-3.5 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                        <span>{isUploadingToDrive ? 'Mengunggah...' : 'Kirim Foto ke Google Drive'}</span>
                      </button>
                    )}
                    {assessment.googleDriveFolderUrl && (
                      <a
                        href={assessment.googleDriveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                        title="Buka folder arsip foto gedung ini di Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Folder Google Drive</span>
                      </a>
                    )}
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      Dilengkapi keterangan bagian kerusakan untuk verifikasi
                    </span>
                  </div>
                </div>

                {/* Gallery Component */}
                <BuildingPhotoGallery
                  photos={assessment.photos || []}
                  buildingTitle={`${assessment.buildingName} (${assessment.code || 'Tanpa No. Reg'})`}
                  isEditable={false}
                />
              </div>
            )}

            {/* Signatures & Official Validation */}
            {showSignatures && (
              <div className="grid grid-cols-2 gap-8 text-xs pt-6 border-t border-slate-400 avoid-break print:grid-cols-2">
                {/* Left: Mengetahui / Menyetujui Kepala Dinas PUPR */}
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Mengetahui / Menyetujui,</p>
                  <p className="font-bold text-slate-950">{assessment.headOfDepartment?.title || 'Kepala Dinas Pekerjaan Umum dan Penataan Ruang'}</p>
                  {assessment.headOfDepartment?.subTitle && (
                    <p className="font-bold text-slate-950">{assessment.headOfDepartment.subTitle}</p>
                  )}
                  <div className="h-20 flex items-end">
                    <div>
                      <p className="font-bold underline text-slate-950">{assessment.headOfDepartment?.name || '-'}</p>
                      {assessment.headOfDepartment?.rank && (
                        <p className="text-[11px] text-slate-700 font-medium">{assessment.headOfDepartment.rank}</p>
                      )}
                      <p className="text-[11px] text-slate-700 font-mono">
                        {assessment.headOfDepartment?.nip ? `NIP. ${assessment.headOfDepartment.nip}` : 'NIP. -'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Tim Analisis PUPR */}
                <div className="space-y-1 text-left sm:text-right print:text-right">
                  <p className="text-slate-600 font-medium">
                    {assessment.cityLocation || 'Mbay'}, {assessment.reportDateStr || 'September 2026'}
                  </p>
                  <p className="font-bold text-slate-950">Tim Analisis Lapangan:</p>
                  <div className="space-y-2 pt-2 text-left sm:text-right print:text-right">
                    {assessment.analysisTeam && assessment.analysisTeam.length > 0 ? (
                      assessment.analysisTeam.map((teamMember, i) => (
                        <div key={i} className="flex items-center justify-between sm:justify-end print:justify-end gap-2 text-[11px]">
                          <span className="font-semibold text-slate-500">{i + 1}.</span>
                          <span className="font-semibold text-slate-800 underline">{teamMember}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Tim Penilai PUPR / Surveyor</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
