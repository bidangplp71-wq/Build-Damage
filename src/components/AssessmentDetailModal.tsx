import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BuildingAssessment, BUILDING_CATEGORY_CONFIGS } from '../types';
import { formatRupiah } from '../utils/puprCalculations';
import {
  Printer,
  FileSpreadsheet,
  X,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  Camera,
  Layers,
  ZoomIn,
} from 'lucide-react';
import { BuildingPhotoGallery } from './BuildingPhotoGallery';

interface Props {
  assessment: BuildingAssessment;
  onClose: () => void;
}

export const AssessmentDetailModal: React.FC<Props> = ({ assessment, onClose }) => {
  const { syncAssessmentToSheet, showToast } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSignatures, setShowSignatures] = useState(true);

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 print:absolute print:inset-0 print:bg-transparent print:p-0 print:block print:overflow-visible">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-300 max-h-[95vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-none print:max-h-none print:block print:overflow-visible print:absolute print:top-0 print:left-0 print:w-full">
        {/* Top Control Bar (Hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Dokumen Standar PUPR
            </span>
            <span className="font-mono text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
              {assessment.code || 'Tanpa No. Registrasi'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Signatures */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                checked={showSignatures} 
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span>Tampilkan TTD</span>
            </label>

            {/* Sync to Google Sheet button */}
            <button
              onClick={handleSyncToSheet}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sinkron...' : 'Kirim Google Sheet'}</span>
            </button>

            {/* Print button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Formulir (PDF)</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official PUPR Printable Document Area */}
        <div className="overflow-y-auto p-6 sm:p-10 font-sans text-slate-900 space-y-6 print:overflow-visible print:h-auto print:p-0">
          {/* Header Title */}
          <div className="text-center border-b-2 border-slate-900 pb-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs border border-slate-300 p-4 rounded-lg bg-slate-50/50">
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
                  {assessment.buildingCategory === 'Hunian Masyarakat'
                    ? 'Nama Pemilik Rumah'
                    : 'Nama Pemilik Gedung'}
                </span>
                <span className="col-span-2 font-bold text-slate-950">
                  : {assessment.buildingCategory === 'Hunian Masyarakat'
                      ? (assessment.namaPemilikRumah || assessment.ownerAgency)
                      : (assessment.namaPemilikGedung || assessment.ownerAgency)}
                </span>
              </div>
              {(assessment.nikPemilik || assessment.noKkPemilik) && (
                <div className="grid grid-cols-3">
                  <span className="font-semibold text-slate-600">Identitas NIK / KK</span>
                  <span className="col-span-2 font-mono text-slate-800">
                    : {assessment.nikPemilik ? `NIK: ${assessment.nikPemilik}` : ''}
                    {assessment.nikPemilik && assessment.noKkPemilik ? ' | ' : ''}
                    {assessment.noKkPemilik ? `KK: ${assessment.noKkPemilik}` : ''}
                  </span>
                </div>
              )}
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

          {/* Table of Components & Scoring (Exact CSV Format) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-900 border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900">
                  <th className="border border-slate-900 py-1.5 px-2 text-center w-8">NO</th>
                  <th className="border border-slate-900 py-1.5 px-2">KOMPONEN BANGUNAN</th>
                  <th className="border border-slate-900 py-1.5 px-2">SUB KOMPONEN BANGUNAN</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center">BOBOT (%)</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center">MAX KERUSAKAN (%)</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-center">BOBOT INPUT (%)</th>
                  <th className="border border-slate-900 py-1.5 px-2 text-right">NILAI (%)</th>
                </tr>
              </thead>
              <tbody>
                {assessment.components.map((c, idx) => {
                  const isNewGroup =
                    idx === 0 || c.componentNo !== assessment.components[idx - 1].componentNo;

                  return (
                    <tr key={c.id} className="border-b border-slate-400">
                      <td className="border border-slate-900 py-1 px-2 text-center font-bold">
                        {isNewGroup ? c.componentNo : ''}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-semibold">
                        {isNewGroup ? c.componentName : ''}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-medium text-slate-900">
                        {c.subComponentName}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                        {c.bobotPercent.toFixed(2)}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                        {c.kerusakanMaxPercent.toFixed(2)}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold">
                        {c.damagePercentInput.toFixed(2)}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold">
                        {c.calculatedScore.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-xs">
                  <td colSpan={3} className="border border-slate-900 py-2 px-3 uppercase text-slate-900">
                    NILAI TINGKAT KERUSAKAN (%)
                  </td>
                  <td className="border border-slate-900 py-2 px-2 text-center font-mono">100,00</td>
                  <td className="border border-slate-900"></td>
                  <td className="border border-slate-900"></td>
                  <td className="border border-slate-900 py-2 px-2 text-right font-mono text-sm text-slate-950">
                    {assessment.totalDamagePercent.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Kesimpulan & RAB Calculation (Exact Layout from CSV) */}
          <div className="border border-slate-900 p-4 rounded-lg space-y-3 bg-white text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold uppercase tracking-wider text-slate-950">
                KESIMPULAN ANALISIS HASIL PENGAMATAN LAPANGAN
              </span>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                <span>RINGAN: &lt; 30%</span>
                <span>SEDANG: 30% s/d 45%</span>
                <span>BERAT: &gt; 45% s/d 65%</span>
              </div>
            </div>

            <div className="space-y-1.5 font-sans">
              <div className="grid grid-cols-12">
                <span className="col-span-1 font-bold">A</span>
                <span className="col-span-5 font-semibold">Jenis perawatan</span>
                <span className="col-span-6 font-bold text-slate-950">: = {assessment.damageClassification}</span>
              </div>

              <div className="grid grid-cols-12">
                <span className="col-span-1 font-bold">B</span>
                <span className="col-span-5 font-semibold">Tingkat (%) Kerusakan</span>
                <span className="col-span-6 font-mono font-bold text-slate-950">
                  : = {assessment.totalDamagePercent.toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-12">
                <span className="col-span-1 font-bold">C</span>
                <span className="col-span-5 font-semibold">Luas Total Bangunan</span>
                <span className="col-span-6 font-bold text-slate-950">
                  : = {assessment.totalFloorAreaM2} M²
                </span>
              </div>

              <div className="grid grid-cols-12">
                <span className="col-span-1 font-bold">D</span>
                <span className="col-span-11 font-semibold">
                  Harga Satuan tertinggi bangunan Gedung Negara ({assessment.buildingClass})
                </span>
              </div>

              <div className="grid grid-cols-12 pl-6 text-slate-700">
                <span className="col-span-6">Nilai Perawatan / M² Bangunan = {assessment.totalDamagePercent.toFixed(2)}% x {formatRupiah(assessment.hsbgnPerM2)}</span>
                <span className="col-span-6 font-mono font-bold text-slate-900">: = {formatRupiah(assessment.treatmentCostPerM2)}</span>
              </div>

              <div className="grid grid-cols-12 pl-6 text-slate-700">
                <span className="col-span-6">Biaya bongkaran/perapihan diambil {assessment.demolitionPercent}% x {formatRupiah(assessment.treatmentCostPerM2)}</span>
                <span className="col-span-6 font-mono font-bold text-slate-900">: = {formatRupiah(assessment.demolitionCostPerM2)}</span>
              </div>

              <div className="grid grid-cols-12 pl-6 text-slate-900 font-semibold border-t border-slate-200 pt-1">
                <span className="col-span-6">Subtotal Biaya Per M² Bangunan</span>
                <span className="col-span-6 font-mono font-bold">: = {formatRupiah(assessment.totalCostPerM2)}</span>
              </div>

              <div className="grid grid-cols-12 pl-6 text-slate-950 font-bold border-t border-slate-400 pt-1">
                <span className="col-span-6">Ajuan Biaya Pekerjaan Rehabilitasi ({assessment.totalFloorAreaM2} M² x {formatRupiah(assessment.totalCostPerM2)})</span>
                <span className="col-span-6 font-mono text-sm">: = {formatRupiah(assessment.totalRehabCost)}</span>
              </div>

              <div className="grid grid-cols-12 pl-6 text-slate-950 font-black bg-amber-50 p-2 rounded-lg border border-amber-200">
                <span className="col-span-6 uppercase">Dibulatkan Menjadi</span>
                <span className="col-span-6 font-mono text-base text-amber-950">: = {formatRupiah(assessment.roundedRehabCost)}</span>
              </div>

              <div className="pl-6 pt-1 italic font-semibold text-slate-800">
                Terbilang : {assessment.costTerbilang}
              </div>
            </div>
          </div>

          {/* Visual Photos Documentation (Up to 10 photos with damage location & click to zoom) */}
          {assessment.photos && assessment.photos.length > 0 && (
            <div className="border border-slate-300 p-4 rounded-xl space-y-3 bg-slate-50/70">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Dokumentasi Visual Kerusakan Fisik Bangunan ({assessment.photos.length} / 10 Foto)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Dilengkapi keterangan bagian kerusakan untuk verifikasi
                </span>
              </div>

              {/* Gallery Component */}
              <BuildingPhotoGallery
                photos={assessment.photos}
                buildingTitle={`${assessment.buildingName} (${assessment.code || 'Tanpa No. Reg'})`}
                isEditable={false}
              />
            </div>
          )}

          {/* Signatures & Official Validation (Exact CSV Structure) */}
          {showSignatures && (
            <div className="grid grid-cols-2 gap-8 text-xs pt-6 border-t border-slate-400">
              {/* Left: Mengetahui / Menyetujui Kepala Dinas PUPR */}
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">Mengetahui / Menyetujui,</p>
                <p className="font-bold text-slate-950">{assessment.headOfDepartment.title}</p>
                <p className="font-bold text-slate-950">{assessment.headOfDepartment.subTitle}</p>
                <div className="h-20 flex items-end">
                  <div>
                    <p className="font-bold underline text-slate-950">{assessment.headOfDepartment.name}</p>
                    <p className="text-[11px] text-slate-700 font-medium">{assessment.headOfDepartment.rank}</p>
                    <p className="text-[11px] text-slate-700 font-mono">NIP. {assessment.headOfDepartment.nip}</p>
                  </div>
                </div>
              </div>

              {/* Right: Tim Analisis PUPR */}
              <div className="space-y-1 text-left sm:text-right">
                <p className="text-slate-600 font-medium">
                  {assessment.cityLocation}, {assessment.reportDateStr}
                </p>
                <p className="font-bold text-slate-950">Tim Analisis Lapangan:</p>
                <div className="space-y-2 pt-2 text-left sm:text-right">
                  {assessment.analysisTeam.map((teamMember, i) => (
                    <div key={i} className="flex items-center justify-between sm:justify-end gap-2 text-[11px]">
                      <span className="font-semibold text-slate-500">{i + 1}.</span>
                      <span className="font-semibold text-slate-800 underline">{teamMember}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
