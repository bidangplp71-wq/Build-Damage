import React, { useMemo, useState } from 'react';
import { BuildingAssessment, SpreadsheetProfile } from '../types';
import { X, Printer, FileSpreadsheet, LayoutList, Layers, ChevronDown, ChevronUp, MapPin, Building2, Wallet } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profiles: SpreadsheetProfile[];
  assessments: BuildingAssessment[];
}

export const GlobalSheetRecapModal: React.FC<Props> = ({
  isOpen,
  onClose,
  profiles,
  assessments,
}) => {
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});

  const toggleProfile = (id: string) => {
    setExpandedProfiles(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAll = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    profiles.forEach(p => {
      newExpanded[p.id] = expand;
    });
    setExpandedProfiles(newExpanded);
  };

  if (!isOpen) return null;

  // Calculate matrix data
  const matrixData = useMemo(() => {
    const mappedIds = new Set<string>();
    const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];

    const results = profiles.map(profile => {
      const profileAssessments = assessments.filter(a => {
        if (a.targetProfileId === profile.id || (!a.targetProfileId && defaultProfile && profile.id === defaultProfile.id)) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        return false;
      });
      
      let menunggu = 0;
      let terverifikasi = 0;
      let rb = 0;
      let rs = 0;
      let rr = 0;
      let tr = 0;
      let totalAnggaran = 0;

      const buildingDetails = profileAssessments.map(a => {
        const costPerM2 = (a.treatmentCostPerM2 || 0) + (a.demolitionCostPerM2 || 0);
        const totalCost = costPerM2 * (a.totalFloorAreaM2 || 0);
        totalAnggaran += totalCost;

        return {
          ...a,
          calculatedTotalCost: totalCost
        };
      });

      // Sort by verification status, then damage
      buildingDetails.sort((a, b) => {
        if (a.verificationStatus !== b.verificationStatus) {
           return a.verificationStatus === 'Terverifikasi' ? -1 : 1;
        }
        return (b.totalDamagePercent || 0) - (a.totalDamagePercent || 0);
      });

      profileAssessments.forEach(a => {
        if (a.verificationStatus === 'Terverifikasi') terverifikasi++;
        else menunggu++;

        switch (a.damageClassification) {
          case 'Rusak Berat': rb++; break;
          case 'Rusak Sedang': rs++; break;
          case 'Rusak Ringan': rr++; break;
          case 'Tidak Rusak': tr++; break;
        }
      });

      return {
        profile,
        total: profileAssessments.length,
        menunggu,
        terverifikasi,
        rb,
        rs,
        rr,
        tr,
        totalAnggaran,
        buildingDetails
      };
    });

    // Handle Unmapped Data
    const unmappedAssessments = assessments.filter(a => a.id && !mappedIds.has(a.id));
    if (unmappedAssessments.length > 0) {
      let menunggu = 0, terverifikasi = 0, rb = 0, rs = 0, rr = 0, tr = 0, totalAnggaran = 0;
      const buildingDetails = unmappedAssessments.map(a => {
        const costPerM2 = (a.treatmentCostPerM2 || 0) + (a.demolitionCostPerM2 || 0);
        const totalCost = costPerM2 * (a.totalFloorAreaM2 || 0);
        totalAnggaran += totalCost;
        return { ...a, calculatedTotalCost: totalCost };
      });
      
      buildingDetails.sort((a, b) => {
        if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === 'Terverifikasi' ? -1 : 1;
        return (b.totalDamagePercent || 0) - (a.totalDamagePercent || 0);
      });

      unmappedAssessments.forEach(a => {
        if (a.verificationStatus === 'Terverifikasi') terverifikasi++;
        else menunggu++;
        switch (a.damageClassification) {
          case 'Rusak Berat': rb++; break;
          case 'Rusak Sedang': rs++; break;
          case 'Rusak Ringan': rr++; break;
          case 'Tidak Rusak': tr++; break;
        }
      });

      results.push({
        profile: { id: 'unmapped', name: 'Data Tidak Terpetakan (Lainnya)', spreadsheetUrl: '' } as any,
        total: unmappedAssessments.length,
        menunggu, terverifikasi, rb, rs, rr, tr, totalAnggaran,
        buildingDetails
      });
    }

    return results;
  }, [profiles, assessments]);

  const totals = useMemo(() => {
    return matrixData.reduce((acc, curr) => ({
      total: acc.total + curr.total,
      menunggu: acc.menunggu + curr.menunggu,
      terverifikasi: acc.terverifikasi + curr.terverifikasi,
      rb: acc.rb + curr.rb,
      rs: acc.rs + curr.rs,
      rr: acc.rr + curr.rr,
      tr: acc.tr + curr.tr,
      totalAnggaran: acc.totalAnggaran + curr.totalAnggaran,
    }), { total: 0, menunggu: 0, terverifikasi: 0, rb: 0, rs: 0, rr: 0, tr: 0, totalAnggaran: 0 });
  }, [matrixData]);

  const handlePrint = () => {
    window.print();
  };

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 print:relative print:inset-auto print:z-auto print:p-0 print:bg-white print:block print:min-h-screen">
      <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl print:shadow-none print:max-w-none print:max-h-none print:rounded-none print:h-auto print:overflow-visible print:block">
        {/* Header - Hidden in Print */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Matriks Rekapitulasi & Daftar Bangunan Seluruh Sheet
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pantau jumlah data, rincian bangunan, tingkat kerusakan, dan anggaran dari setiap buku
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Buka Semua
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Tutup Semua
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all cursor-pointer ml-2"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible print:h-auto">
          {/* Print Header */}
          <div className="hidden print:block mb-8 text-center border-b-2 border-slate-900 pb-6">
            <h1 className="text-2xl font-black uppercase text-slate-900 mb-2">
              Laporan Rekapitulasi Data Survei Kerusakan
            </h1>
            <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">
              Matriks Data, Tingkat Kerusakan, & Anggaran (Berdasarkan Buku/Sheet)
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Dicetak pada: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden print:border-none print:rounded-none">
            <table className="w-full text-sm text-left print:text-[11px]">
              <thead className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                <tr>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 w-12 text-center">No</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300">Halaman / Buku Sheet</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-center text-blue-200 print:text-blue-800">Total Data</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-center text-emerald-200 print:text-emerald-800">Verifikasi</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-center text-rose-300 print:text-rose-700">RB</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-center text-amber-300 print:text-amber-700">RS</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-center text-emerald-300 print:text-emerald-700">RR</th>
                  <th className="px-4 py-3.5 font-bold border-r border-slate-700 print:border-slate-300 text-right text-indigo-200 print:text-indigo-800">Estimasi Anggaran (Rp)</th>
                  <th className="px-3 py-3.5 text-center print:hidden w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                {matrixData.map((row, idx) => {
                  const isExpanded = expandedProfiles[row.profile.id];
                  
                  return (
                    <React.Fragment key={row.profile.id}>
                      {/* Main Matrix Row */}
                      <tr 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer print:bg-transparent ${isExpanded ? 'bg-slate-50' : ''}`}
                        onClick={() => toggleProfile(row.profile.id)}
                      >
                        <td className="px-4 py-3 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                        <td className="px-4 py-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{row.profile.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[250px]">
                            ID: {row.profile.id}
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-center font-bold text-blue-700 bg-blue-50/30 print:bg-transparent">
                          {row.total.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-center bg-emerald-50/30 print:bg-transparent">
                          <span className="text-emerald-600 font-bold">{row.terverifikasi}</span>
                          <span className="text-slate-400 text-[10px] block mt-0.5">({row.menunggu} mnggu)</span>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-center">
                          {row.rb > 0 ? <span className="text-rose-600 font-bold">{row.rb}</span> : '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-center">
                          {row.rs > 0 ? <span className="text-amber-600 font-bold">{row.rs}</span> : '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-center">
                          {row.rr > 0 ? <span className="text-emerald-600 font-bold">{row.rr}</span> : '-'}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 text-right font-black text-slate-800 bg-indigo-50/30 print:bg-transparent">
                          {formatIDR(row.totalAnggaran)}
                        </td>
                        <td className="px-3 py-3 text-center print:hidden">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 print:bg-transparent print:table-row">
                          <td colSpan={9} className="p-0 border-b-2 border-slate-300 print:border-b print:border-slate-400">
                            <div className="p-4 sm:p-6 lg:pl-16">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                                Daftar Bangunan ({row.total})
                              </h4>
                              
                              {row.buildingDetails.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Belum ada data di sheet ini.</p>
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs print:shadow-none print:border-slate-300">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-700">
                                      <tr>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200 w-10 text-center">No</th>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200">Registrasi & Bangunan</th>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200 hidden sm:table-cell">Lokasi</th>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200 text-center">Status</th>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200 text-center">Kerusakan</th>
                                        <th className="px-3 py-2 font-bold border-r border-slate-200 text-right">Luas</th>
                                        <th className="px-3 py-2 font-bold text-right">Anggaran</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {row.buildingDetails.map((b, i) => (
                                        <tr key={b.id} className="hover:bg-slate-50 print:bg-transparent">
                                          <td className="px-3 py-2 border-r border-slate-200 text-center text-slate-500">{i + 1}</td>
                                          <td className="px-3 py-2 border-r border-slate-200">
                                            <div className="font-bold text-slate-900 truncate max-w-[200px]">{b.buildingName || 'Tanpa Nama'}</div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{b.code}</div>
                                          </td>
                                          <td className="px-3 py-2 border-r border-slate-200 hidden sm:table-cell">
                                            <div className="flex items-center gap-1 text-slate-700">
                                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                              <span className="truncate max-w-[150px]">{b.desaName}, {b.kecamatanName}</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 border-r border-slate-200 text-center">
                                            {b.verificationStatus === 'Terverifikasi' ? (
                                              <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase">Verif</span>
                                            ) : (
                                              <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">Mnggu</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 border-r border-slate-200 text-center">
                                            <div className="font-bold text-slate-800">
                                              {(b.totalDamagePercent || 0).toFixed(2)}%
                                            </div>
                                            <div className={`text-[10px] font-bold mt-0.5 ${
                                              b.damageClassification === 'Rusak Berat' ? 'text-rose-600' :
                                              b.damageClassification === 'Rusak Sedang' ? 'text-amber-600' :
                                              b.damageClassification === 'Rusak Ringan' ? 'text-emerald-600' : 'text-slate-500'
                                            }`}>
                                              {b.damageClassification}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap">
                                            {b.totalFloorAreaM2 || 0} m&sup2;
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                                            {formatIDR(b.calculatedTotalCost)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                
                {/* Fallback if no profiles exist */}
                {matrixData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Belum ada halaman/buku sheet yang terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-medium print:bg-slate-200 print:text-slate-900">
                <tr>
                  <td colSpan={2} className="px-4 py-4 font-black text-right border-r border-slate-700 print:border-slate-300">
                    TOTAL KESELURUHAN PORTFOLIO
                  </td>
                  <td className="px-4 py-4 font-black text-center text-blue-200 print:text-blue-900 border-r border-slate-700 print:border-slate-300">
                    {totals.total.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 font-black text-center text-emerald-300 print:text-emerald-800 border-r border-slate-700 print:border-slate-300">
                    {totals.terverifikasi.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 font-black text-center text-rose-400 print:text-rose-700 border-r border-slate-700 print:border-slate-300">
                    {totals.rb.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 font-black text-center text-amber-300 print:text-amber-700 border-r border-slate-700 print:border-slate-300">
                    {totals.rs.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 font-black text-center text-emerald-300 print:text-emerald-700 border-r border-slate-700 print:border-slate-300">
                    {totals.rr.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-4 font-black text-right text-amber-300 print:text-slate-900">
                    {formatIDR(totals.totalAnggaran)}
                  </td>
                  <td className="print:hidden border-l border-slate-700"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="mt-4 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 print:border-none print:bg-transparent">
            <strong className="text-slate-700">Petunjuk Cetak:</strong> Klik ikon <ChevronDown className="w-3 h-3 inline-block" /> pada tabel di atas untuk membuka daftar rinci bangunan per sheet sebelum mencetak. Baris yang terbuka akan ikut tercetak, baris yang tertutup hanya akan menampilkan rekap matriksnya saja.
          </div>
        </div>
      </div>
    </div>
  );
};
