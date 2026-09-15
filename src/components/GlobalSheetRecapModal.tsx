import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BuildingAssessment, SpreadsheetProfile } from '../types';
import { useApp } from '../context/AppContext';
import {
  X,
  Printer,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

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
  const { syncAllProfiles, sheetSyncProgress } = useApp();
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Manage body class for print isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('rekap-matrix-modal-active');
    } else {
      document.body.classList.remove('rekap-matrix-modal-active');
    }
    return () => {
      document.body.classList.remove('rekap-matrix-modal-active');
    };
  }, [isOpen]);

  // If opened and multiple profiles are configured but data is only in one profile or missing, trigger a silent sync
  useEffect(() => {
    if (isOpen && profiles.length > 1 && syncAllProfiles) {
      const populatedProfilesCount = profiles.filter((p) =>
        assessments.some((a) => a.targetProfileId === p.id)
      ).length;
      if (populatedProfilesCount <= 1 && assessments.length < 200) {
        syncAllProfiles({ forceRefresh: false, showToastAlert: false }).catch(() => {});
      }
    }
  }, [isOpen, profiles.length]);

  const toggleProfile = (id: string) => {
    setExpandedProfiles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    profiles.forEach((p) => {
      newExpanded[p.id] = expand;
    });
    newExpanded['unmapped'] = expand;
    setExpandedProfiles(newExpanded);
  };

  const handleManualSync = async () => {
    if (!syncAllProfiles) return;
    setIsManualSyncing(true);
    try {
      await syncAllProfiles({ forceRefresh: true, showToastAlert: true });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Calculate matrix data with intelligent mapping
  const matrixData = useMemo(() => {
    const mappedIds = new Set<string>();
    const defaultProfile = profiles.find((p) => p.isDefault) || profiles[0];

    const results = profiles.map((profile) => {
      const profileAssessments = assessments.filter((a) => {
        // 1. Direct ID match
        if (a.targetProfileId && a.targetProfileId === profile.id) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        // 2. Direct Name match
        if (a.targetProfileName && a.targetProfileName.toLowerCase() === profile.name.toLowerCase()) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        // 3. Match by sheetName if provided
        if (profile.sheetName && (a as any).sourceSheet && (a as any).sourceSheet.toLowerCase() === profile.sheetName.toLowerCase()) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        // 4. Match by spreadsheet URL if provided on assessment
        if (profile.spreadsheetUrl && (a as any).spreadsheetUrl && (a as any).spreadsheetUrl === profile.spreadsheetUrl) {
          if (a.id) mappedIds.add(a.id);
          return true;
        }
        // 5. Fallback for primary/default profile when targetProfileId is absent
        if (!a.targetProfileId && !a.targetProfileName && defaultProfile && profile.id === defaultProfile.id) {
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

      const buildingDetails = profileAssessments.map((a) => {
        const costPerM2 = (a.treatmentCostPerM2 || 0) + (a.demolitionCostPerM2 || 0);
        const totalCost = costPerM2 * (a.totalFloorAreaM2 || 0);
        totalAnggaran += totalCost;

        return {
          ...a,
          calculatedTotalCost: totalCost,
        };
      });

      buildingDetails.sort((a, b) => {
        if (a.verificationStatus !== b.verificationStatus) {
          return a.verificationStatus === 'Terverifikasi' ? -1 : 1;
        }
        return (b.totalDamagePercent || 0) - (a.totalDamagePercent || 0);
      });

      profileAssessments.forEach((a) => {
        if (a.verificationStatus === 'Terverifikasi') terverifikasi++;
        else menunggu++;

        switch (a.damageClassification) {
          case 'Rusak Berat':
            rb++;
            break;
          case 'Rusak Sedang':
            rs++;
            break;
          case 'Rusak Ringan':
            rr++;
            break;
          case 'Tidak Rusak':
            tr++;
            break;
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
        buildingDetails,
      };
    });

    // Handle any unmapped records (e.g. historical 207 records that haven't been tagged yet)
    const unmappedAssessments = assessments.filter((a) => a.id && !mappedIds.has(a.id));
    if (unmappedAssessments.length > 0) {
      let menunggu = 0,
        terverifikasi = 0,
        rb = 0,
        rs = 0,
        rr = 0,
        tr = 0,
        totalAnggaran = 0;
      const buildingDetails = unmappedAssessments.map((a) => {
        const costPerM2 = (a.treatmentCostPerM2 || 0) + (a.demolitionCostPerM2 || 0);
        const totalCost = costPerM2 * (a.totalFloorAreaM2 || 0);
        totalAnggaran += totalCost;
        return { ...a, calculatedTotalCost: totalCost };
      });

      buildingDetails.sort((a, b) => {
        if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === 'Terverifikasi' ? -1 : 1;
        return (b.totalDamagePercent || 0) - (a.totalDamagePercent || 0);
      });

      unmappedAssessments.forEach((a) => {
        if (a.verificationStatus === 'Terverifikasi') terverifikasi++;
        else menunggu++;
        switch (a.damageClassification) {
          case 'Rusak Berat':
            rb++;
            break;
          case 'Rusak Sedang':
            rs++;
            break;
          case 'Rusak Ringan':
            rr++;
            break;
          case 'Tidak Rusak':
            tr++;
            break;
        }
      });

      results.push({
        profile: {
          id: 'unmapped',
          name: 'Data Terverifikasi / Sheet Tambahan',
          spreadsheetUrl: '',
        } as any,
        total: unmappedAssessments.length,
        menunggu,
        terverifikasi,
        rb,
        rs,
        rr,
        tr,
        totalAnggaran,
        buildingDetails,
      });
    }

    return results;
  }, [profiles, assessments]);

  const totals = useMemo(() => {
    return matrixData.reduce(
      (acc, curr) => ({
        total: acc.total + curr.total,
        menunggu: acc.menunggu + curr.menunggu,
        terverifikasi: acc.terverifikasi + curr.terverifikasi,
        rb: acc.rb + curr.rb,
        rs: acc.rs + curr.rs,
        rr: acc.rr + curr.rr,
        tr: acc.tr + curr.tr,
        totalAnggaran: acc.totalAnggaran + curr.totalAnggaran,
      }),
      { total: 0, menunggu: 0, terverifikasi: 0, rb: 0, rs: 0, rr: 0, tr: 0, totalAnggaran: 0 }
    );
  }, [matrixData]);

  const handlePrint = () => {
    window.print();
  };

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div id="rekap-matrix-print-portal">
      {/* Media Print Style Isolation: Guarantees ONLY the matrix report prints in clean landscape */}
      <style type="text/css">
        {`
          @media print {
            @page {
              size: ${printOrientation} !important;
              margin: 8mm 10mm !important;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }
            /* Strictly hide the main application and all non-print modal elements */
            #root,
            body > #root,
            header,
            nav,
            aside,
            .no-print,
            .print-controls,
            .print\\:hidden {
              display: none !important;
              visibility: hidden !important;
              height: 0 !important;
              max-height: 0 !important;
              overflow: hidden !important;
            }
            /* Render ONLY the clean report portal */
            #rekap-matrix-print-portal {
              display: block !important;
              position: static !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              box-shadow: none !important;
              border: none !important;
              overflow: visible !important;
            }
            #rekap-matrix-print-portal .modal-backdrop-wrap {
              position: static !important;
              inset: auto !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              display: block !important;
              overflow: visible !important;
            }
            #rekap-matrix-print-portal .modal-card-sheet {
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              display: block !important;
              overflow: visible !important;
              background: #ffffff !important;
            }
            #rekap-matrix-print-portal .printable-content-area {
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              display: block !important;
            }
            /* Matrix table crisp print borders */
            .print-matrix-table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto !important;
            }
            .print-matrix-table th,
            .print-matrix-table td {
              border: 1px solid #475569 !important;
              padding: 4px 6px !important;
              font-size: 10px !important;
              color: #000000 !important;
            }
            .print-matrix-table thead {
              display: table-header-group !important;
              background-color: #f1f5f9 !important;
            }
            .print-matrix-table tfoot {
              display: table-footer-group !important;
              background-color: #e2e8f0 !important;
              font-weight: bold !important;
            }
          }
        `}
      </style>

      {/* Modal Backdrop & Container */}
      <div
        className="modal-backdrop-wrap fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`modal-card-sheet bg-white rounded-3xl w-full ${
            printOrientation === 'landscape' ? 'max-w-[1400px]' : 'max-w-6xl'
          } shadow-2xl border border-slate-300 max-h-[96vh] flex flex-col overflow-hidden transition-all duration-200`}
        >
          {/* TOP TOOLBAR & CONTROLS (Hidden on Print) */}
          <div className="no-print print-controls flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-white">
                    Matriks Rekapitulasi & Daftar Bangunan Seluruh Sheet
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    {profiles.length} Buku Sheet Terdaftar
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Total {totals.total} bangunan ({totals.terverifikasi} terverifikasi, {totals.menunggu} menunggu) &bull; Estimasi Anggaran {formatIDR(totals.totalAnggaran)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Sync All Sheets Button */}
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isManualSyncing || sheetSyncProgress.isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                title="Baca dan perbarui data dari seluruh worksheet Google Sheet secara serentak"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || sheetSyncProgress.isLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
                <span>{isManualSyncing || sheetSyncProgress.isLoading ? 'Membaca Sheet...' : `Sinkronkan ${profiles.length} Sheet`}</span>
              </button>

              {/* Orientation Selector */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printOrientation === 'landscape' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Landscape
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    printOrientation === 'portrait' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Portrait
                </button>
              </div>

              {/* Expand / Collapse All */}
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Buka Detail
              </button>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Tutup Detail
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Matriks ({printOrientation.toUpperCase()})</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sync Progress Alert (Hidden on Print) */}
          {(isManualSyncing || sheetSyncProgress.isLoading) && (
            <div className="no-print bg-indigo-50 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-900">
              <div className="flex items-center gap-2 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>{sheetSyncProgress.statusMessage || 'Sedang membaca seluruh halaman Google Sheet...'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-indigo-700">{sheetSyncProgress.percent || 50}%</span>
                <div className="w-24 h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${sheetSyncProgress.percent || 50}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SCROLLABLE / PRINTABLE CONTENT AREA */}
          <div className="printable-content-area p-6 overflow-y-auto flex-1 bg-white">
            {/* OFFICIAL PRINT HEADER (Only visible during print) */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="text-left">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-800">
                    PEMERINTAH KABUPATEN NAGEKEO
                  </p>
                  <p className="text-[13px] font-black uppercase tracking-wider text-slate-950">
                    DINAS PEKERJAAN UMUM DAN PENATAAN RUANG (PUPR)
                  </p>
                  <p className="text-[9px] text-slate-600">
                    Sistem Informasi Penilaian Kerusakan Bangunan Gedung (SIM-PKBG) &bull; Format Rekapitulasi Matriks
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 border border-slate-700 text-[9px] font-bold uppercase text-slate-800">
                    MODE: {printOrientation.toUpperCase()}
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1">
                    Dicetak: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}
                  </p>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-slate-300">
                <h1 className="text-base font-black uppercase text-slate-950 tracking-wide">
                  LAPORAN MATRIKS REKAPITULASI DATA SURVEI KERUSAKAN BANGUNAN
                </h1>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  KONSOLIDASI SELURUH BUKU WORKSHEET ({profiles.length} HALAMAN SHEET AKTIF)
                </p>
              </div>
            </div>

            {/* MATRIX TABLE */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs print:border-none print:rounded-none print:shadow-none">
              <table className="print-matrix-table w-full text-sm text-left print:text-[10px]">
                <thead className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-950">
                  <tr>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 w-10 text-center">No</th>
                    <th className="px-4 py-3 font-bold border-r border-slate-700 print:border-slate-400">Halaman / Buku Sheet</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-blue-200 print:text-slate-900">Total Data</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-emerald-200 print:text-slate-900">Terverifikasi</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-amber-200 print:text-slate-900">Menunggu</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-rose-300 print:text-slate-900">RB</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-amber-300 print:text-slate-900">RS</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-emerald-300 print:text-slate-900">RR</th>
                    <th className="px-3 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-center text-slate-300 print:text-slate-900">TR</th>
                    <th className="px-4 py-3 font-bold border-r border-slate-700 print:border-slate-400 text-right text-indigo-200 print:text-slate-900">Estimasi Anggaran</th>
                    <th className="px-3 py-3 text-center print:hidden w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                  {matrixData.map((row, idx) => {
                    const isExpanded = expandedProfiles[row.profile.id];

                    return (
                      <React.Fragment key={row.profile.id}>
                        {/* Main Matrix Summary Row */}
                        <tr
                          className={`hover:bg-slate-50 transition-colors cursor-pointer print:bg-transparent ${
                            isExpanded ? 'bg-slate-50' : ''
                          }`}
                          onClick={() => toggleProfile(row.profile.id)}
                        >
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold">{idx + 1}</td>
                          <td className="px-4 py-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900">{row.profile.name}</div>
                            {row.profile.spreadsheetUrl && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[280px] print:hidden">
                                {row.profile.spreadsheetUrl}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-black text-blue-700 bg-blue-50/40 print:bg-transparent print:text-slate-950">
                            {row.total.toLocaleString('id-ID')}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/40 print:bg-transparent print:text-slate-950">
                            {row.terverifikasi}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-amber-700 bg-amber-50/40 print:bg-transparent print:text-slate-950">
                            {row.menunggu}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-rose-700">
                            {row.rb > 0 ? row.rb : '-'}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-amber-700">
                            {row.rs > 0 ? row.rs : '-'}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-emerald-700">
                            {row.rr > 0 ? row.rr : '-'}
                          </td>
                          <td className="px-3 py-3 border-r border-slate-200 text-center font-bold text-slate-500">
                            {row.tr > 0 ? row.tr : '-'}
                          </td>
                          <td className="px-4 py-3 border-r border-slate-200 text-right font-black text-slate-900 bg-indigo-50/40 print:bg-transparent">
                            {formatIDR(row.totalAnggaran)}
                          </td>
                          <td className="px-3 py-3 text-center print:hidden">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </td>
                        </tr>

                        {/* Expanded Details Sub-Table (if opened) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/60 print:bg-transparent print:table-row">
                            <td colSpan={11} className="p-0 border-b-2 border-slate-300 print:border-b print:border-slate-400">
                              <div className="p-4 sm:p-6 lg:pl-12">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-indigo-600 print:text-slate-900" />
                                    <span>Rincian Bangunan: {row.profile.name} ({row.total} unit)</span>
                                  </h4>
                                </div>

                                {row.buildingDetails.length === 0 ? (
                                  <p className="text-xs text-slate-500 italic">Belum ada baris data pada worksheet ini.</p>
                                ) : (
                                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs print:shadow-none print:border-slate-400">
                                    <table className="w-full text-xs text-left print:text-[9px]">
                                      <thead className="bg-slate-100 text-slate-800 print:bg-slate-200">
                                        <tr>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400 w-10 text-center">No</th>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400">Kode & Nama Bangunan</th>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400">Wilayah</th>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400 text-center">Status</th>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400 text-center">Kerusakan</th>
                                          <th className="px-3 py-2 font-bold border-r border-slate-200 print:border-slate-400 text-right">Luas</th>
                                          <th className="px-3 py-2 font-bold text-right">Estimasi Anggaran</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                                        {row.buildingDetails.map((b, i) => (
                                          <tr key={b.id || i} className="hover:bg-slate-50 print:bg-transparent">
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400 text-center text-slate-500 font-bold">{i + 1}</td>
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400">
                                              <div className="font-bold text-slate-900 truncate max-w-[220px]">{b.buildingName || 'Tanpa Nama'}</div>
                                              <div className="text-[10px] text-slate-500 font-mono">{b.code}</div>
                                            </td>
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400">
                                              <div className="text-slate-700 truncate max-w-[160px]">
                                                {b.desaName ? `${b.desaName}, ` : ''}{b.kecamatanName}
                                              </div>
                                            </td>
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400 text-center">
                                              {b.verificationStatus === 'Terverifikasi' ? (
                                                <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase print:bg-transparent print:text-slate-950">
                                                  Terverifikasi
                                                </span>
                                              ) : (
                                                <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 text-[9px] font-bold uppercase print:bg-transparent print:text-slate-950">
                                                  Menunggu
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400 text-center">
                                              <span className="font-bold text-slate-900">{(b.totalDamagePercent || 0).toFixed(1)}%</span>
                                              <span className="text-[9px] text-slate-600 block">{b.damageClassification}</span>
                                            </td>
                                            <td className="px-3 py-1.5 border-r border-slate-200 print:border-slate-400 text-right whitespace-nowrap">
                                              {b.totalFloorAreaM2 || 0} m&sup2;
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-bold text-slate-900 whitespace-nowrap">
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

                  {matrixData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                        Belum ada halaman/buku sheet yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* GRAND TOTAL TFOOT */}
                <tfoot className="bg-slate-900 text-white font-medium print:bg-slate-200 print:text-slate-950">
                  <tr>
                    <td colSpan={2} className="px-4 py-3.5 font-black text-right border-r border-slate-700 print:border-slate-400">
                      TOTAL KUMULATIF SELURUH SHEET
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-blue-200 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.total.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-emerald-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.terverifikasi.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-amber-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.menunggu.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-rose-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.rb.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-amber-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.rs.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-emerald-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.rr.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3.5 font-black text-center text-slate-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {totals.tr.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 font-black text-right text-amber-300 print:text-slate-950 border-r border-slate-700 print:border-slate-400">
                      {formatIDR(totals.totalAnggaran)}
                    </td>
                    <td className="print:hidden border-l border-slate-700"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* OFFICIAL SIGNOFF BLOCK (Only visible during print) */}
            <div className="hidden print:block mt-8 pt-4 border-t border-slate-300">
              <div className="flex justify-between items-start text-[10px] text-slate-800">
                <div>
                  <p className="font-bold">Keterangan:</p>
                  <p>RB: Rusak Berat &bull; RS: Rusak Sedang &bull; RR: Rusak Ringan &bull; TR: Tidak Rusak</p>
                  <p className="text-slate-500 mt-1">Dicetak dari Sistem Informasi Manajemen SIM-PKBG Nagekeo</p>
                </div>
                <div className="text-center w-56">
                  <p>Mbay, {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</p>
                  <p className="font-bold mt-1">Kepala Dinas Pekerjaan Umum</p>
                  <p className="font-bold">dan Penataan Ruang</p>
                  <div className="h-14"></div>
                  <p className="font-bold underline uppercase">(........................................................)</p>
                  <p className="font-mono text-[9px]">NIP. ....................................................</p>
                </div>
              </div>
            </div>

            {/* User Guidance Note on Screen (Hidden on Print) */}
            <div className="no-print mt-4 text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-2">
              <span className="font-bold text-slate-700 shrink-0">💡 Petunjuk Cetak:</span>
              <span>
                Hasil cetak sudah diisolasi dalam format <strong>{printOrientation.toUpperCase()}</strong> dan hanya memuat tabel matriks rekapitulasi serta daftar bangunan yang sedang Anda buka detailnya. Klik nama baris untuk membuka/menutup rincian sebelum mencetak.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
