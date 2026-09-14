import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { BuildingAssessment, Kecamatan, Desa } from '../types';
import { formatRupiah, terbilang } from '../utils/puprCalculations';
import {
  Printer,
  X,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  FileText,
  Camera,
  Award,
  ChevronDown,
  Sparkles,
  Search,
  PenLine,
  RotateCcw,
  UserCheck,
  Check,
  Clock,
  AlertCircle,
  LayoutTemplate,
} from 'lucide-react';

interface Props {
  isOpen?: boolean;
  assessments: BuildingAssessment[];
  kecamatans: Kecamatan[];
  desas: Desa[];
  onClose: () => void;
  defaultKecamatanId?: string;
}

export const PortfolioRecapModal: React.FC<Props> = ({
  isOpen = true,
  assessments,
  kecamatans,
  desas,
  onClose,
  defaultKecamatanId = '',
}) => {
  const { logUserActivity, showToast } = useApp();

  // Filters & display options - Defaults to 'all' so ALL 205 records (verified & unverified) are loaded!
  const [selectedKecId, setSelectedKecId] = useState<string>(defaultKecamatanId);
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = useState<boolean>(true);
  const [includeVisualDossier, setIncludeVisualDossier] = useState<boolean>(true);
  const [includeSummaryTable, setIncludeSummaryTable] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includePhotos, setIncludePhotos] = useState<boolean>(true);

  // Sync defaultKecamatanId if passed from outside
  useEffect(() => {
    if (defaultKecamatanId && defaultKecamatanId !== 'all') {
      setSelectedKecId(defaultKecamatanId);
    } else if (defaultKecamatanId === 'all') {
      setSelectedKecId('');
    }
  }, [defaultKecamatanId]);

  // Overall counts for filter options
  const verifiedCount = useMemo(() => {
    return assessments.filter((a) => a.verificationStatus === 'Terverifikasi').length;
  }, [assessments]);

  const unverifiedCount = useMemo(() => {
    return assessments.filter((a) => a.verificationStatus !== 'Terverifikasi').length;
  }, [assessments]);

  // Signature Customization (Default kosong, tanpa data dummy)
  const [showSignatureEditor, setShowSignatureEditor] = useState<boolean>(false);
  const [signCity, setSignCity] = useState<string>('Mbay');
  const [signDate, setSignDate] = useState<string>(() => {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  });

  // Pihak 1: Penyusun & Tim Verifikator (Default Kosong)
  const [verifierTitle, setVerifierTitle] = useState<string>('Disusun dan Diverifikasi oleh:');
  const [verifierSubTitle, setVerifierSubTitle] = useState<string>('Tim Analisis & Verifikator Teknis Lapangan');
  const [verifierAgency, setVerifierAgency] = useState<string>('Dinas PUPR Kabupaten Nagekeo');
  const [verifierName, setVerifierName] = useState<string>('');
  const [verifierNip, setVerifierNip] = useState<string>('');
  const [verifierRank, setVerifierRank] = useState<string>('');
  const [verifierRole, setVerifierRole] = useState<string>('Petugas Penilai Bangunan Gedung');

  // Pihak 2: Pengesahan Kepala Dinas (Default Kosong, Tanpa Data Dummy)
  const [approverTitle, setApproverTitle] = useState<string>('Mengetahui & Mengesahkan:');
  const [approverPosition, setApproverPosition] = useState<string>('Kepala Dinas Pekerjaan Umum dan Penataan Ruang');
  const [approverAgency, setApproverAgency] = useState<string>('Kabupaten Nagekeo');
  const [approverName, setApproverName] = useState<string>('');
  const [approverNip, setApproverNip] = useState<string>('');
  const [approverRank, setApproverRank] = useState<string>('');

  const handleClearSignatures = () => {
    setApproverName('');
    setApproverNip('');
    setApproverRank('');
    setVerifierName('');
    setVerifierNip('');
    setVerifierRank('');
    showToast('Nama tanda tangan telah dikosongkan untuk tanda tangan basah.', 'info');
  };

  // Filtered dataset - Guaranteed to preserve and display both verified and unverified data
  const filteredData = useMemo(() => {
    return assessments.filter((item) => {
      // 1. Verification filter - DEFAULT 'all' ensures ALL 205 entries (both verified and unverified) are included
      if (selectedVerificationStatus !== 'all') {
        if (selectedVerificationStatus === 'Terverifikasi') {
          if (item.verificationStatus !== 'Terverifikasi') return false;
        } else if (selectedVerificationStatus === 'Belum Terverifikasi') {
          if (item.verificationStatus === 'Terverifikasi') return false;
        } else if (selectedVerificationStatus === 'Perlu Revisi') {
          if (item.verificationStatus !== 'Perlu Revisi') return false;
        }
      }

      // 2. Kecamatan filter
      if (selectedKecId && selectedKecId !== 'all') {
        const kecObj = kecamatans.find((k) => k.id === selectedKecId);
        const matchId = item.kecamatanId === selectedKecId;
        const matchName = kecObj && item.kecamatanName && (
          item.kecamatanName.toLowerCase().trim() === kecObj.name.toLowerCase().trim() ||
          item.kecamatanName.toLowerCase().includes(kecObj.name.toLowerCase().trim()) ||
          kecObj.name.toLowerCase().includes(item.kecamatanName.toLowerCase().trim())
        );
        if (!matchId && !matchName) {
          return false;
        }
      }

      // 3. Classification filter
      if (selectedClassification !== 'all') {
        const itemClass = (item.damageClassification || '').toLowerCase().trim();
        const selClass = selectedClassification.toLowerCase().trim();
        if (itemClass !== selClass) return false;
      }

      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = item.buildingName?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        const matchOwner = item.ownerAgency?.toLowerCase().includes(q) || item.namaPemilikRumah?.toLowerCase().includes(q) || item.namaPemilikGedung?.toLowerCase().includes(q);
        const matchDesa = item.desaName?.toLowerCase().includes(q);
        const matchKec = item.kecamatanName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchOwner && !matchDesa && !matchKec) return false;
      }

      return true;
    });
  }, [assessments, selectedKecId, selectedClassification, selectedVerificationStatus, searchTerm, kecamatans]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredData.length;
    let rrCount = 0;
    let rsCount = 0;
    let rbCount = 0;
    let trCount = 0;
    let totalCost = 0;
    let verifiedInFilter = 0;
    let unverifiedInFilter = 0;

    filteredData.forEach((item) => {
      const cost = Number(item.roundedRehabCost || item.rehabCostEstimate || 0);
      totalCost += Number.isFinite(cost) ? cost : 0;

      if (item.verificationStatus === 'Terverifikasi') {
        verifiedInFilter++;
      } else {
        unverifiedInFilter++;
      }

      if (item.damageClassification === 'Rusak Berat') rbCount++;
      else if (item.damageClassification === 'Rusak Sedang') rsCount++;
      else if (item.damageClassification === 'Rusak Ringan') rrCount++;
      else trCount++;
    });

    // Breakdown per kecamatan
    const kecBreakdown = kecamatans.map((kec) => {
      const itemsInKec = filteredData.filter(
        (i) => i.kecamatanId === kec.id || i.kecamatanName?.toLowerCase() === kec.name.toLowerCase()
      );
      const kecCost = itemsInKec.reduce(
        (sum, i) => sum + (Number(i.roundedRehabCost || i.rehabCostEstimate || 0)),
        0
      );
      return {
        kecamatan: kec.name,
        count: itemsInKec.length,
        rr: itemsInKec.filter((i) => i.damageClassification === 'Rusak Ringan').length,
        rs: itemsInKec.filter((i) => i.damageClassification === 'Rusak Sedang').length,
        rb: itemsInKec.filter((i) => i.damageClassification === 'Rusak Berat').length,
        cost: kecCost,
      };
    }).filter((k) => k.count > 0 || !selectedKecId);

    // Breakdown per building category
    const catMap = new Map<string, { count: number; cost: number }>();
    filteredData.forEach((i) => {
      const cat = i.buildingCategory || 'Lainnya';
      const existing = catMap.get(cat) || { count: 0, cost: 0 };
      existing.count += 1;
      existing.cost += Number(i.roundedRehabCost || i.rehabCostEstimate || 0);
      catMap.set(cat, existing);
    });

    return {
      total,
      rrCount,
      rsCount,
      rbCount,
      trCount,
      totalCost,
      verifiedInFilter,
      unverifiedInFilter,
      kecBreakdown,
      catBreakdown: Array.from(catMap.entries()).map(([cat, val]) => ({ category: cat, ...val })),
    };
  }, [filteredData, kecamatans, selectedKecId]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle body print isolation & orientation class
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('portfolio-modal-active');
    if (printOrientation === 'landscape') {
      document.body.classList.add('print-landscape');
      document.body.classList.remove('print-portrait');
    } else {
      document.body.classList.add('print-portrait');
      document.body.classList.remove('print-landscape');
    }

    return () => {
      document.body.classList.remove('portfolio-modal-active');
      document.body.classList.remove('print-landscape');
      document.body.classList.remove('print-portrait');
    };
  }, [isOpen, printOrientation]);

  // Log user activity once when modal is opened
  const hasLoggedOpenRef = React.useRef(false);
  useEffect(() => {
    if (isOpen && !hasLoggedOpenRef.current) {
      hasLoggedOpenRef.current = true;
      logUserActivity(
        'VIEW_PORTFOLIO',
        'Portofolio Rekapitulasi',
        `Membuka Portofolio Rekap: ${assessments.length} data bangunan (Terverifikasi & Belum Verifikasi)`,
        selectedKecId && selectedKecId !== 'all' ? `Kecamatan: ${kecamatans.find((k) => k.id === selectedKecId)?.name}` : 'Semua Kecamatan',
        `Format Portofolio Dossier A4 (${printOrientation.toUpperCase()})`
      );
    } else if (!isOpen) {
      hasLoggedOpenRef.current = false;
    }
  }, [isOpen, assessments.length, selectedKecId, kecamatans, printOrientation, logUserActivity]);

  const handlePrint = () => {
    logUserActivity(
      'PRINT_PORTFOLIO',
      'Pencetakan & Dokumen',
      `Mencetak Buku Portofolio Rekapitulasi (${filteredData.length} Bangunan) — Format ${printOrientation === 'landscape' ? 'Landscape (Mendatar)' : 'Portrait (Tegak)'}`,
      selectedKecId ? `Filter: ${kecamatans.find((k) => k.id === selectedKecId)?.name}` : 'Seluruh Kabupaten Nagekeo',
      `Format Portofolio Dossier A4 Terpadu (${printOrientation.toUpperCase()})`
    );
    showToast(`Menyiapkan cetakan format ${printOrientation === 'landscape' ? 'Landscape (Mendatar)' : 'Portrait (Tegak)'}...`, 'info');
    setTimeout(() => {
      window.print();
    }, 180);
  };

  const selectedKecName = useMemo(() => {
    if (!selectedKecId) return 'Seluruh Wilayah Kabupaten Nagekeo (7 Kecamatan)';
    return `Kecamatan ${kecamatans.find((k) => k.id === selectedKecId)?.name || selectedKecId}`;
  }, [selectedKecId, kecamatans]);

  const activeKecObj = kecamatans.find((k) => k.id === selectedKecId);

  // Today formatted
  const formattedToday = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const modalContent = (
    <div id="portfolio-print-portal">
      {/* DYNAMIC MEDIA PRINT ORIENTATION INJECTION */}
      <style>{`
        @media print {
          @page {
            size: A4 ${printOrientation} !important;
            margin: 8mm 10mm !important;
          }
        }
      `}</style>

      <div 
        className="modal-backdrop-wrap fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className={`modal-card-sheet bg-white rounded-3xl w-full ${printOrientation === 'landscape' ? 'max-w-[1400px]' : 'max-w-6xl'} shadow-2xl border border-slate-300 max-h-[96vh] flex flex-col overflow-hidden transition-all duration-200`}>
          
          {/* TOP TOOLBAR & CONTROLS (Hidden on Print) */}
          <div className="no-print print-controls flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-white">
                    Portofolio Rekapitulasi Penilaian Kerusakan Bangunan
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                    Standar PUPR
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-amber-300 border border-slate-700 uppercase">
                    {printOrientation === 'landscape' ? 'Mode Landscape' : 'Mode Portrait'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Dossier Eksekutif, Galeri Visual Dokumentasi, & Rekapitulasi Anggaran Pasca Bencana
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* ORIENTATION TOGGLE (Landscape vs Portrait) */}
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPrintOrientation('landscape')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printOrientation === 'landscape'
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Cetak format Landscape / Mendatar (Sangat direkomendasikan untuk tabel matriks data luas)"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 rotate-90" />
                  <span>Landscape</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOrientation('portrait')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printOrientation === 'portrait'
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Cetak format Portrait / Tegak"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  <span>Portrait</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md hover:shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / PDF ({printOrientation === 'landscape' ? 'Landscape' : 'Portrait'})</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Tutup Pratinjau Portofolio (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SECONDARY FILTER & CUSTOMIZER BAR (Hidden on Print) */}
          <div className="no-print print-controls px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Kecamatan Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Kecamatan:</span>
                <select
                  value={selectedKecId}
                  onChange={(e) => setSelectedKecId(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="">Semua 7 Kecamatan</option>
                  {kecamatans.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Verifikasi Filter (Menampilkan seluruh 205 data: terverifikasi & belum) */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Status:</span>
                <select
                  value={selectedVerificationStatus}
                  onChange={(e) => setSelectedVerificationStatus(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">Semua Status ({assessments.length} Data: Terverifikasi & Belum)</option>
                  <option value="Terverifikasi">Hanya Terverifikasi ({verifiedCount})</option>
                  <option value="Belum Terverifikasi">Belum Terverifikasi ({unverifiedCount})</option>
                </select>
              </div>

              {/* Tingkat Kerusakan Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Kerusakan:</span>
                <select
                  value={selectedClassification}
                  onChange={(e) => setSelectedClassification(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="all">Semua Tingkat</option>
                  <option value="Rusak Ringan">Rusak Ringan (RR)</option>
                  <option value="Rusak Sedang">Rusak Sedang (RS)</option>
                  <option value="Rusak Berat">Rusak Berat (RB)</option>
                  <option value="Tidak Rusak">Tidak Rusak</option>
                </select>
              </div>

              {/* Quick Search */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari gedung/pemilik..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-36"
                />
              </div>

              <span className="text-slate-400">|</span>
              <span className="font-bold text-slate-700">
                {filteredData.length} dari {assessments.length} Bangunan
              </span>

              {(selectedKecId || selectedClassification !== 'all' || selectedVerificationStatus !== 'all' || searchTerm.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKecId('');
                    setSelectedClassification('all');
                    setSelectedVerificationStatus('all');
                    setSearchTerm('');
                  }}
                  className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                  title="Tampilkan seluruh data"
                >
                  Reset Filter ({assessments.length} Data)
                </button>
              )}
            </div>

            {/* Layout Toggles */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(e) => setIncludeCover(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Sampul</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeExecutiveSummary}
                  onChange={(e) => setIncludeExecutiveSummary(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Ringkasan</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeVisualDossier}
                  onChange={(e) => setIncludeVisualDossier(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Galeri Kartu</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includePhotos}
                  onChange={(e) => setIncludePhotos(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Foto Visual</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeSummaryTable}
                  onChange={(e) => setIncludeSummaryTable(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Matriks Data</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Lembar TTD</span>
              </label>

              <span className="text-slate-300">|</span>

              {/* Signature Input & Customization Toggle */}
              <button
                type="button"
                onClick={() => setShowSignatureEditor(!showSignatureEditor)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  showSignatureEditor
                    ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400/30'
                    : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                }`}
                title="Input nama pejabat penandatangan atau kosongkan untuk TTD basah"
              >
                <PenLine className="w-3.5 h-3.5 text-amber-700" />
                <span>Atur Nama Tanda Tangan</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  approverName || verifierName ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {approverName || verifierName ? 'Terisi' : 'Kosong'}
                </span>
              </button>
            </div>
          </div>

          {/* SIGNATURE EDITOR PANEL (Hidden on print) */}
          {showSignatureEditor && (
            <div className="no-print bg-amber-50/95 border-b border-amber-200 px-6 py-4 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-amber-200/80">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                    <PenLine className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-amber-950">
                      Pengaturan Nama & Penandatangan Dokumen Portofolio
                    </h3>
                    <p className="text-[11px] text-amber-800">
                      Tanda tangan <strong>default kosong</strong> (format titik-titik rapi siap ditandatangani basah dan distempel manual). Ketik nama di bawah jika ingin mencetak dengan nama langsung.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearSignatures}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-700 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Kosongkan Semua (TTD Basah)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSignatureEditor(false)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Selesai</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Kolom 1: Pejabat Pengesah / Kepala Dinas */}
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                      Pihak 2: Pengesahan (Kepala Dinas)
                    </span>
                    {approverName ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Terisi
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Kosong
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Kepala Dinas / Pejabat:
                    </label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="Biarkan kosong jika TTD basah manual..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      NIP Pejabat:
                    </label>
                    <input
                      type="text"
                      value={approverNip}
                      onChange={(e) => setApproverNip(e.target.value)}
                      placeholder="Contoh: 19780101 200501 1 002"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Pangkat / Golongan:
                    </label>
                    <input
                      type="text"
                      value={approverRank}
                      onChange={(e) => setApproverRank(e.target.value)}
                      placeholder="Contoh: Pembina Tk. I (IV/b)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Jabatan Pengesah:
                    </label>
                    <input
                      type="text"
                      value={approverPosition}
                      onChange={(e) => setApproverPosition(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* Kolom 2: Tim Verifikator / Petugas Lapangan */}
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      Pihak 1: Penyusun (Tim Verifikator)
                    </span>
                    {verifierName ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Terisi
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Kosong
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Nama Ketua Tim / Petugas:
                    </label>
                    <input
                      type="text"
                      value={verifierName}
                      onChange={(e) => setVerifierName(e.target.value)}
                      placeholder="Biarkan kosong jika TTD basah manual..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      NIP Petugas (Opsional):
                    </label>
                    <input
                      type="text"
                      value={verifierNip}
                      onChange={(e) => setVerifierNip(e.target.value)}
                      placeholder="Kosong atau nomor NIP..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Pangkat / Golongan:
                    </label>
                    <input
                      type="text"
                      value={verifierRank}
                      onChange={(e) => setVerifierRank(e.target.value)}
                      placeholder="Contoh: Penata Muda (III/a)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Keterangan / Peran:
                    </label>
                    <input
                      type="text"
                      value={verifierRole}
                      onChange={(e) => setVerifierRole(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900"
                    />
                  </div>
                </div>

                {/* Kolom 3: Tempat & Tanggal Dokumen */}
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        Tempat & Tanggal Pelaporan
                      </span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Kota Pelaporan:
                      </label>
                      <input
                        type="text"
                        value={signCity}
                        onChange={(e) => setSignCity(e.target.value)}
                        placeholder="Mbay"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Tanggal Dokumen:
                      </label>
                      <input
                        type="text"
                        value={signDate}
                        onChange={(e) => setSignDate(e.target.value)}
                        placeholder="14 September 2026"
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                    💡 <strong>Status Dokumen:</strong> {approverName ? 'Dicetak dengan nama pejabat tertera.' : 'Siap ditandatangani basah dan distempel basah manual.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN PRINTABLE SCROLLABLE CANVAS */}
          <div className="printable-content-area flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 space-y-8">
            
            {/* ========================================================
                PAGE 1: SAMPUL / COVER PORTOFOLIO RESMI EKSEKUTIF
               ======================================================== */}
            {includeCover && (
              <div className={`portfolio-page bg-white rounded-2xl shadow-md border border-slate-200 text-slate-900 flex flex-col justify-between overflow-hidden relative ${printOrientation === 'landscape' ? 'p-2 sm:p-4' : ''}`}>
                {/* Decorative Top Accent Bar */}
                <div className="h-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 w-full" />

                {/* Inner Border Frame (Luxury Official Government Style) */}
                <div className={`portfolio-cover-inner border-4 border-double border-slate-900/80 rounded-xl flex-1 flex flex-col justify-between relative ${printOrientation === 'landscape' ? 'm-2 sm:m-4 p-4 sm:p-6' : 'm-6 sm:m-10 p-8'}`}>
                  
                  {/* Watermark Emblem in Background */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <Building2 className="w-96 h-96 text-slate-900" />
                  </div>

                  {/* Top: Kop Surat Portofolio */}
                  <div className="text-center space-y-2 relative z-10">
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 border-2 border-amber-400 flex items-center justify-center shadow-xs">
                        <Building2 className="w-9 h-9 text-amber-700" />
                      </div>
                    </div>
                    <h3 className="text-lg font-extrabold tracking-wider text-slate-900 uppercase">
                      Pemerintah Kabupaten Nagekeo
                    </h3>
                    <h4 className="text-base font-black tracking-wide text-amber-900 uppercase">
                      Dinas Pekerjaan Umum dan Penataan Ruang (PUPR)
                    </h4>
                    <p className="text-xs text-slate-600 font-medium">
                      Kompleks Perkantoran Civic Center, Mbay - Flores, Nusa Tenggara Timur
                    </p>
                    
                    {/* Double Divider Line */}
                    <div className="pt-2">
                      <div className="h-0.5 bg-slate-900 w-full mb-0.5" />
                      <div className="h-0.25 bg-slate-400 w-full" />
                    </div>
                  </div>

                  {/* Middle: Title & Document Identity */}
                  <div className={`text-center my-auto relative z-10 ${printOrientation === 'landscape' ? 'py-3 space-y-3' : 'py-10 space-y-6'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-black tracking-wider uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>Dokumen Portofolio Teknis & Rekapitulasi</span>
                    </div>

                    <div className="space-y-2">
                      <h1 className={`font-black text-slate-950 tracking-tight leading-tight uppercase font-serif ${printOrientation === 'landscape' ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
                        Portofolio Rekapitulasi Penilaian Kerusakan Bangunan Gedung
                      </h1>
                      <div className="w-24 h-1.5 bg-amber-500 mx-auto rounded-full" />
                      <p className={`text-slate-700 max-w-3xl mx-auto font-medium leading-relaxed ${printOrientation === 'landscape' ? 'text-xs line-clamp-2' : 'text-sm sm:text-base'}`}>
                        Laporan Terpadu Hasil Inventarisasi Fisik, Verifikasi Tingkat Kerusakan, Dokumentasi Visual Lapangan, dan Estimasi Kebutuhan Biaya Rehabilitasi / Rekonstruksi Pasca Bencana
                      </p>
                    </div>

                    <div className="inline-block px-4 py-1.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-700">
                      Pedoman Acuan: <strong className="text-slate-900">Peraturan Menteri PUPR No. 22/PRT/M/2018</strong>
                    </div>
                  </div>

                  {/* Bottom: Metadata Scope, Period & Classification */}
                  <div className={`relative z-10 border-t-2 border-slate-200 ${printOrientation === 'landscape' ? 'pt-3 mt-2' : 'pt-6 mt-4'}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Wilayah Sasaran</span>
                        <span className="text-xs font-black text-slate-900">{selectedKecName}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Jumlah Unit Gedung</span>
                        <span className="text-xs font-black text-amber-700">{filteredData.length} Unit Terdata</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Tanggal Portofolio</span>
                        <span className="text-xs font-black text-slate-900">{formattedToday}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="block text-[10px] font-bold uppercase text-slate-400">Sistem Informasi</span>
                        <span className="text-xs font-black text-slate-900">SIP-PKBG Nagekeo</span>
                      </div>
                    </div>

                    <div className="text-center pt-4 text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                      Dokumen Resmi Pemerintah Daerah &bull; Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Nagekeo
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ========================================================
                PAGE 2: RINGKASAN EKSEKUTIF & DASHBOARD STATISTIK
               ======================================================== */}
            {includeExecutiveSummary && (
              <div className="portfolio-page bg-white rounded-2xl shadow-md border border-slate-200 text-slate-900 p-8 space-y-6">
                {/* Section Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                        Bagian I &mdash; Ringkasan Eksekutif & Statistik Kerusakan
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Kompilasi Agregat Penilaian Kerusakan dan Analisis Kebutuhan Anggaran Rehabilitasi
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <span className="font-bold text-slate-800">Kabupaten Nagekeo</span> &bull; {formattedToday}
                  </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Bangunan</span>
                    <div className="text-2xl font-black text-slate-950">{stats.total} <span className="text-xs font-normal text-slate-500">Unit</span></div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {stats.verifiedInFilter} Terverifikasi &bull; {stats.unverifiedInFilter} Belum Diverifikasi
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Rusak Ringan (RR)</span>
                    <div className="text-2xl font-black text-emerald-900">{stats.rrCount} <span className="text-xs font-normal text-emerald-700">Unit</span></div>
                    <div className="text-[10px] font-bold text-emerald-700">
                      {stats.total > 0 ? ((stats.rrCount / stats.total) * 100).toFixed(1) : 0}% dari total
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Rusak Sedang (RS)</span>
                    <div className="text-2xl font-black text-amber-900">{stats.rsCount} <span className="text-xs font-normal text-amber-700">Unit</span></div>
                    <div className="text-[10px] font-bold text-amber-700">
                      {stats.total > 0 ? ((stats.rsCount / stats.total) * 100).toFixed(1) : 0}% dari total
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Rusak Berat (RB)</span>
                    <div className="text-2xl font-black text-rose-900">{stats.rbCount} <span className="text-xs font-normal text-rose-700">Unit</span></div>
                    <div className="text-[10px] font-bold text-rose-700">
                      {stats.total > 0 ? ((stats.rbCount / stats.total) * 100).toFixed(1) : 0}% dari total
                    </div>
                  </div>
                </div>

                {/* Total Budget Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Total Estimasi Kebutuhan Anggaran Biaya Rehabilitasi / Rekonstruksi
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                      {formatRupiah(stats.totalCost)}
                    </div>
                    <p className="text-[11px] text-slate-300 italic">
                      Terbilang: {terbilang(stats.totalCost)} Rupiah
                    </p>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-right text-xs">
                    <span className="block text-slate-300 font-medium">Berdasarkan Standar</span>
                    <span className="font-bold text-amber-400">Permen PUPR 22/2018</span>
                  </div>
                </div>

                {/* Breakdown per Kecamatan & Kategori */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Kecamatan Summary */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      Rekapitulasi Distribusi per Kecamatan
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2">Kecamatan</th>
                            <th className="p-2 text-center">Unit</th>
                            <th className="p-2 text-center">RR</th>
                            <th className="p-2 text-center">RS</th>
                            <th className="p-2 text-center">RB</th>
                            <th className="p-2 text-right">Kebutuhan Biaya</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.kecBreakdown.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-900">{row.kecamatan}</td>
                              <td className="p-2 text-center font-bold">{row.count}</td>
                              <td className="p-2 text-center text-emerald-700 font-semibold">{row.rr}</td>
                              <td className="p-2 text-center text-amber-700 font-semibold">{row.rs}</td>
                              <td className="p-2 text-center text-rose-700 font-semibold">{row.rb}</td>
                              <td className="p-2 text-right font-bold text-slate-900">{formatRupiah(row.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Kategori Bangunan Summary */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      Rekapitulasi per Kategori Bangunan
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2">Kategori Bangunan</th>
                            <th className="p-2 text-center">Unit</th>
                            <th className="p-2 text-right">Subtotal Biaya</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.catBreakdown.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-bold text-slate-900">{row.category}</td>
                              <td className="p-2 text-center font-bold">{row.count}</td>
                              <td className="p-2 text-right font-bold text-slate-900">{formatRupiah(row.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================
                PAGE 3+: GALERI PORTOFOLIO KARTU BANGUNAN (VISUAL DOSSIER)
               ======================================================== */}
            {includeVisualDossier && (
              <div className="space-y-6">
                <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      Bagian II &mdash; Galeri Portofolio Kartu Bangunan ({filteredData.length} Unit)
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Menampilkan rincian teknis per objek gedung lengkap dengan foto dokumentasi lapangan
                  </span>
                </div>

                {/* Grid of Portfolio Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredData.map((item, idx) => {
                    const photos = item.photos || [];
                    const cost = Number(item.roundedRehabCost || item.rehabCostEstimate || 0);
                    const damagePercent = Number(item.totalDamagePercent || 0);

                    // Badge classification styling
                    let badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    if (item.damageClassification === 'Rusak Berat') {
                      badgeBg = 'bg-rose-100 text-rose-900 border-rose-300';
                    } else if (item.damageClassification === 'Rusak Sedang') {
                      badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                    }

                    return (
                      <div
                        key={item.id || idx}
                        className="portfolio-card-item bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between"
                      >
                        {/* Top Card Header */}
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[11px] font-extrabold bg-slate-900 text-amber-400 px-2 py-0.5 rounded">
                                {item.code || `REG-${idx + 1}`}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                Unit #{idx + 1}
                              </span>
                              {item.verificationStatus === 'Terverifikasi' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Terverifikasi
                                </span>
                              ) : item.verificationStatus === 'Perlu Revisi' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <AlertCircle className="w-3 h-3" />
                                  Perlu Revisi
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  Belum Diverifikasi
                                </span>
                              )}
                            </div>
                            <h3 className="font-black text-sm text-slate-950 leading-snug">
                              {item.buildingName}
                            </h3>
                            <p className="text-[11px] text-slate-600">
                              Pemilik/Instansi: <strong>{item.ownerAgency || item.namaPemilikRumah || item.namaPemilikGedung || '-'}</strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black border ${badgeBg}`}>
                              {item.damageClassification || 'Tidak Rusak'}
                            </span>
                            <span className="block text-xs font-bold text-slate-700 mt-1">
                              {damagePercent.toFixed(1)}% Kerusakan
                            </span>
                          </div>
                        </div>

                        {/* Visual Photo Area */}
                        {includePhotos && (
                          <div className="p-4 bg-slate-100/50 border-b border-slate-200">
                            {photos.length > 0 ? (
                              <div className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {photos.slice(0, 2).map((photo, pIdx) => (
                                  <div key={pIdx} className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-200 aspect-video flex items-center justify-center">
                                    <img
                                      src={photo.url}
                                      alt={photo.caption || `Dokumentasi ${item.buildingName}`}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    {photo.caption && (
                                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 backdrop-blur-2xs text-white text-[10px] p-1.5 truncate">
                                        {photo.caption}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                                <Camera className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                                <span>Dokumentasi visual fisik terarsip pada berkas teknis dinas</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Card Technical Details Body */}
                        <div className="p-4 space-y-2.5 text-xs text-slate-700 flex-1">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-400 block font-semibold uppercase text-[9px]">Wilayah Administrasi</span>
                              <span className="font-bold text-slate-900">{item.kecamatanName} &bull; Desa {item.desaName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold uppercase text-[9px]">Kategori & Luas</span>
                              <span className="font-bold text-slate-900">{item.buildingCategory} &bull; {item.totalFloorAreaM2 || 0} m²</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold uppercase text-[9px]">Bencana & Tanggal</span>
                              <span className="font-medium text-slate-800">{item.disasterType || 'Bencana Alam'} ({item.disasterDate || item.assessmentDate || '-'})</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block font-semibold uppercase text-[9px]">Tim Surveyor Lapangan</span>
                              <span className="font-medium text-slate-800">{item.createdByName || 'Petugas Teknis PUPR'}</span>
                            </div>
                          </div>

                          {/* Detailed address if available */}
                          {item.detailedAddress && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <strong>Alamat:</strong> {item.detailedAddress}
                            </div>
                          )}
                        </div>

                        {/* Card Footer: Financial Valuation */}
                        <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">Estimasi Kebutuhan Rehabilitasi</span>
                            <span className="font-black text-sm text-white">{formatRupiah(cost)}</span>
                          </div>
                          <div className="text-right text-[10px] text-slate-300">
                            {item.numberOfFloors || 1} Lantai &bull; Bangunan {item.buildingClass || 'Gedung'}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                PAGE 4: MATRIKS REKAPITULASI DATA TERPADU
               ======================================================== */}
            {includeSummaryTable && (
              <div className="portfolio-page table-page bg-white rounded-2xl shadow-md border border-slate-200 text-slate-900 p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                        Bagian III &mdash; Matriks Rekapitulasi Data Terpadu
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Tabel Komparatif Seluruh Gedung Terdampak di Wilayah Sasaran (Format {printOrientation === 'landscape' ? 'Landscape' : 'Portrait'})
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700">
                    Total {filteredData.length} Gedung
                  </div>
                </div>

                {filteredData.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
                    <h3 className="text-base font-bold text-slate-900">Tidak ada data yang cocok dengan kriteria filter saat ini</h3>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Terdapat total {assessments.length} data tersimpan dalam sistem. Klik tombol di bawah untuk mereset filter dan menampilkan seluruh data (terverifikasi & belum terverifikasi).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKecId('');
                        setSelectedClassification('all');
                        setSelectedVerificationStatus('all');
                        setSearchTerm('');
                      }}
                      className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors cursor-pointer"
                    >
                      Tampilkan Seluruh {assessments.length} Data
                    </button>
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className={`w-full text-left ${printOrientation === 'landscape' ? 'text-[11px]' : 'text-[10px]'}`}>
                      <thead className="bg-slate-900 text-white font-bold">
                        <tr>
                          <th className="p-2 text-center w-8">No</th>
                          <th className="p-2">No. Registrasi</th>
                          <th className="p-2">Nama Bangunan</th>
                          <th className="p-2">Pemilik / Instansi</th>
                          <th className="p-2">Kecamatan</th>
                          <th className="p-2">Desa</th>
                          <th className="p-2 text-center">Status</th>
                          <th className="p-2 text-center">Kerusakan</th>
                          <th className="p-2 text-center">Klasifikasi</th>
                          <th className="p-2 text-right">Estimasi Biaya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredData.map((item, idx) => {
                          const cost = Number(item.roundedRehabCost || item.rehabCostEstimate || 0);
                          const pct = Number(item.totalDamagePercent || 0);

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-50">
                              <td className="p-2 text-center font-bold text-slate-600">{idx + 1}</td>
                              <td className="p-2 font-mono font-bold text-slate-800">{item.code || '-'}</td>
                              <td className="p-2 font-bold text-slate-950">{item.buildingName}</td>
                              <td className="p-2 text-slate-700">{item.ownerAgency || item.namaPemilikRumah || '-'}</td>
                              <td className="p-2 font-semibold text-slate-800">{item.kecamatanName}</td>
                              <td className="p-2 text-slate-700">{item.desaName}</td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.verificationStatus === 'Terverifikasi'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.verificationStatus === 'Perlu Revisi'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {item.verificationStatus || 'Belum'}
                                </span>
                              </td>
                              <td className="p-2 text-center font-bold text-slate-900">{pct.toFixed(1)}%</td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.damageClassification === 'Rusak Berat'
                                    ? 'bg-rose-100 text-rose-800'
                                    : item.damageClassification === 'Rusak Sedang'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {item.damageClassification || 'Tidak Rusak'}
                                </span>
                              </td>
                              <td className="p-2 text-right font-bold text-slate-950">{formatRupiah(cost)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[11px]">
                        <tr>
                          <td colSpan={7} className="p-2.5 text-right uppercase text-slate-700">Total Kebutuhan Anggaran:</td>
                          <td className="p-2.5 text-center text-slate-950">{filteredData.length} Unit</td>
                          <td className="p-2.5"></td>
                          <td className="p-2.5 text-right text-slate-950 text-xs">{formatRupiah(stats.totalCost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================
                PAGE 5: LEMBAR PENGESAHAN & TANDA TANGAN RESMI
               ======================================================== */}
            {includeSignatures && (
              <div className="portfolio-page bg-white rounded-2xl shadow-md border border-slate-200 text-slate-900 p-8 space-y-8">
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                        Bagian IV &mdash; Lembar Pengesahan Resmi Portofolio
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Legalisasi Hasil Rekapitulasi Penilaian Kerusakan Bangunan Gedung Pasca Bencana
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-700">
                    {signCity}, {signDate}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  <p>
                    Dokumen <strong>Buku Portofolio Rekapitulasi Penilaian Kerusakan Bangunan Gedung</strong> ini disusun berdasarkan hasil pengamatan visual, identifikasi kerusakan komponen struktur, arsitektur, dan utilitas bangunan gedung di lapangan sesuai kriteria teknis Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat No. 22/PRT/M/2018. Data ini sah dan dapat dipergunakan sebagai rujukan penetapan prioritas rehabilitasi dan rekonstruksi pemerintah daerah.
                  </p>
                </div>

                {/* Tanda Tangan Block */}
                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-12 text-xs">
                  {/* Pihak 1: Tim Verifikator Teknis */}
                  <div className="space-y-16 text-center">
                    <div>
                      <p className="font-semibold text-slate-600">{verifierTitle}</p>
                      <p className="font-bold text-slate-900">{verifierSubTitle}</p>
                      <p className="text-[11px] text-slate-500">{verifierAgency}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-56 h-0.5 bg-slate-900 mx-auto" />
                      {verifierName ? (
                        <>
                          <p className="font-bold text-slate-950 uppercase tracking-wide underline">
                            {verifierName}
                          </p>
                          {verifierRank && (
                            <p className="text-[10px] text-slate-700 font-medium">{verifierRank}</p>
                          )}
                          {verifierNip ? (
                            <p className="text-[10px] text-slate-700 font-mono">NIP. {verifierNip}</p>
                          ) : null}
                          {verifierRole && (
                            <p className="text-[10px] text-slate-500">{verifierRole}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-slate-700 tracking-wider">
                            (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono">
                            NIP. ....................................................
                          </p>
                          {verifierRole && (
                            <p className="text-[10px] text-slate-500">{verifierRole}</p>
                          )}
                          <div className="no-print pt-1">
                            <button
                              type="button"
                              onClick={() => setShowSignatureEditor(true)}
                              className="text-[10px] text-amber-700 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                            >
                              ✍️ Ketik Nama Verifikator
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pihak 2: Kepala Dinas PUPR */}
                  <div className="space-y-16 text-center">
                    <div>
                      <p className="font-semibold text-slate-600">{approverTitle}</p>
                      <p className="font-bold text-slate-900">{approverPosition}</p>
                      <p className="text-[11px] text-slate-500">{approverAgency}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="w-56 h-0.5 bg-slate-900 mx-auto" />
                      {approverName ? (
                        <>
                          <p className="font-bold text-slate-950 uppercase tracking-wide underline">
                            {approverName}
                          </p>
                          {approverRank && (
                            <p className="text-[10px] text-slate-700 font-medium">
                              {approverRank}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-700 font-mono">
                            {approverNip ? `NIP. ${approverNip}` : 'NIP. ....................................................'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-slate-700 tracking-wider">
                            (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono">
                            NIP. ....................................................
                          </p>
                          <div className="no-print pt-1">
                            <button
                              type="button"
                              onClick={() => setShowSignatureEditor(true)}
                              className="text-[10px] text-amber-700 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                            >
                              ✍️ Ketik Nama Kepala Dinas
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer seal notice */}
                <div className="pt-8 border-t border-slate-200 text-center text-[10px] text-slate-400">
                  Dicetak secara otomatis melalui Sistem Informasi Penilaian Kerusakan Bangunan Gedung (SIP-PKBG) &bull; Dinas PUPR Kabupaten Nagekeo
                </div>
              </div>
            )}

          </div>

          {/* BOTTOM CONTROL FOOTER (Hidden on Print) */}
          <div className="no-print print-controls px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="text-slate-600">
              Pratinjau portofolio siap cetak pada ukuran kertas <strong>A4 Portrait</strong> dengan kualitas dokumen resmi.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Portofolio Sekarang</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};
