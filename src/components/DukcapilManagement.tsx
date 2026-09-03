import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DukcapilRecord } from '../types';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Edit2,
  UserCheck,
  Home,
  MapPin,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const DukcapilManagement: React.FC = () => {
  const {
    dukcapilRecords,
    addDukcapilRecord,
    updateDukcapilRecord,
    deleteDukcapilRecord,
    importDukcapilRecords,
    kecamatans,
    desas,
    showToast,
    setActiveTab,
  } = useApp();

  // Active view tab
  const [subTab, setSubTab] = useState<'daftar' | 'tambah' | 'import'>('daftar');

  // Search and filter in daftar
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterHubungan, setFilterHubungan] = useState('');

  // Single record modal (add / edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNik, setFormNik] = useState('');
  const [formNoKk, setFormNoKk] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJk, setFormJk] = useState<'L' | 'P'>('L');
  const [formTempatLahir, setFormTempatLahir] = useState('');
  const [formTanggalLahir, setFormTanggalLahir] = useState('');
  const [formPekerjaan, setFormPekerjaan] = useState('');
  const [formStatusHubungan, setFormStatusHubungan] = useState<DukcapilRecord['statusHubungan']>('Kepala Keluarga');
  const [formAlamat, setFormAlamat] = useState('');
  const [formRt, setFormRt] = useState('01');
  const [formRw, setFormRw] = useState('01');
  const [formKecamatan, setFormKecamatan] = useState(kecamatans[0]?.name || '');
  const [formDesa, setFormDesa] = useState(desas[0]?.name || '');

  // Import states
  const [importMethod, setImportMethod] = useState<'file' | 'paste' | 'gsheet'>('file');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isParsing, setIsParsing] = useState(false);

  // Filtered desas for selected kecamatan in form
  const availableDesasForForm = useMemo(() => {
    const selectedKec = kecamatans.find((k) => k.name.toLowerCase() === formKecamatan.toLowerCase());
    if (!selectedKec) return desas;
    return desas.filter((d) => d.kecamatanId === selectedKec.id);
  }, [formKecamatan, kecamatans, desas]);

  // Statistics
  const totalWarga = dukcapilRecords.length;
  const uniqueKkCount = useMemo(() => {
    const kks = new Set(dukcapilRecords.map((r) => r.noKk).filter(Boolean));
    return kks.size;
  }, [dukcapilRecords]);

  const uniqueDesaCount = useMemo(() => {
    const ds = new Set(dukcapilRecords.map((r) => r.desaName).filter(Boolean));
    return ds.size;
  }, [dukcapilRecords]);

  // Filtered records for table
  const filteredRecords = useMemo(() => {
    return dukcapilRecords.filter((rec) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const digits = q.replace(/\D/g, '');
        const matchNama = rec.namaLengkap.toLowerCase().includes(q);
        const matchAlamat = rec.alamat.toLowerCase().includes(q);
        const matchNik = digits.length >= 3 && rec.nik.includes(digits);
        const matchKk = digits.length >= 3 && rec.noKk.includes(digits);
        if (!matchNama && !matchAlamat && !matchNik && !matchKk) return false;
      }
      if (filterKecamatan && rec.kecamatanName.toLowerCase() !== filterKecamatan.toLowerCase()) {
        return false;
      }
      if (filterDesa && rec.desaName.toLowerCase() !== filterDesa.toLowerCase()) {
        return false;
      }
      if (filterHubungan && rec.statusHubungan !== filterHubungan) {
        return false;
      }
      return true;
    });
  }, [dukcapilRecords, searchQuery, filterKecamatan, filterDesa, filterHubungan]);

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormNik('');
    setFormNoKk('');
    setFormNama('');
    setFormJk('L');
    setFormTempatLahir('');
    setFormTanggalLahir('');
    setFormPekerjaan('');
    setFormStatusHubungan('Kepala Keluarga');
    setFormAlamat('');
    setFormRt('01');
    setFormRw('01');
    setFormKecamatan(kecamatans[0]?.name || '');
    setFormDesa(desas[0]?.name || '');
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (rec: DukcapilRecord) => {
    setEditingId(rec.id);
    setFormNik(rec.nik);
    setFormNoKk(rec.noKk);
    setFormNama(rec.namaLengkap);
    setFormJk(rec.jenisKelamin);
    setFormTempatLahir(rec.tempatLahir || '');
    setFormTanggalLahir(rec.tanggalLahir || '');
    setFormPekerjaan(rec.pekerjaan || '');
    setFormStatusHubungan(rec.statusHubungan);
    setFormAlamat(rec.alamat);
    setFormRt(rec.rt || '01');
    setFormRw(rec.rw || '01');
    setFormKecamatan(rec.kecamatanName);
    setFormDesa(rec.desaName);
    setIsModalOpen(true);
  };

  // Save single record
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNik = formNik.replace(/\D/g, '');
    const cleanKk = formNoKk.replace(/\D/g, '');

    if (cleanNik.length !== 16) {
      showToast('NIK wajib 16 digit angka.', 'error');
      return;
    }
    if (!formNama.trim()) {
      showToast('Nama lengkap wajib diisi.', 'error');
      return;
    }

    if (editingId) {
      const res = updateDukcapilRecord(editingId, {
        nik: cleanNik,
        noKk: cleanKk,
        namaLengkap: formNama.trim(),
        jenisKelamin: formJk,
        tempatLahir: formTempatLahir.trim(),
        tanggalLahir: formTanggalLahir,
        pekerjaan: formPekerjaan.trim(),
        statusHubungan: formStatusHubungan,
        alamat: formAlamat.trim(),
        rt: formRt.trim(),
        rw: formRw.trim(),
        kecamatanName: formKecamatan.trim(),
        desaName: formDesa.trim(),
      });
      showToast(res.message, res.success ? 'success' : 'error');
    } else {
      const res = addDukcapilRecord({
        nik: cleanNik,
        noKk: cleanKk,
        namaLengkap: formNama.trim(),
        jenisKelamin: formJk,
        tempatLahir: formTempatLahir.trim(),
        tanggalLahir: formTanggalLahir,
        pekerjaan: formPekerjaan.trim(),
        statusHubungan: formStatusHubungan,
        alamat: formAlamat.trim(),
        rt: formRt.trim(),
        rw: formRw.trim(),
        kecamatanName: formKecamatan.trim(),
        desaName: formDesa.trim(),
        sumberData: 'Manual',
      });
      showToast(res.message, res.success ? 'success' : 'error');
    }

    setIsModalOpen(false);
  };

  // Delete record
  const handleDeleteRecord = (id: string, nama: string) => {
    if (confirm(`Hapus data warga "${nama}" dari database kependudukan Dukcapil?`)) {
      const res = deleteDukcapilRecord(id);
      showToast(res.message, res.success ? 'success' : 'error');
    }
  };

  // Parse Excel / CSV File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      const parsed = extractRecordsFromRawObjects(jsonData, 'Import Excel/CSV');
      setParsedPreview(parsed);
      showToast(`Berhasil membaca ${parsed.length} baris data dari file "${file.name}".`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Gagal membaca file Excel/CSV. Pastikan format file valid.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Smart table parsing from pasted text (e.g. copied from PDF table, Word, or tab-delimited text)
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      showToast('Silakan tempel (paste) teks tabel kependudukan terlebih dahulu.', 'error');
      return;
    }

    setIsParsing(true);
    const lines = pastedText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const extracted: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    lines.forEach((line) => {
      // Split by tab or semicolon or multiple spaces
      const tokens = line.split(/\t|;|,/).map((t) => t.trim());

      // Attempt regex to find 16-digit numbers in line
      const sixteenDigits = line.match(/\b\d{16}\b/g) || [];
      const nik = sixteenDigits[0] || (tokens[0]?.replace(/\D/g, '').length === 16 ? tokens[0].replace(/\D/g, '') : '');
      const noKk = sixteenDigits[1] || (tokens[1]?.replace(/\D/g, '').length === 16 ? tokens[1].replace(/\D/g, '') : '');

      // Identify name (non-numeric token with at least 3 characters)
      let nama = '';
      const nameCandidate = tokens.find((tok) => tok.length >= 3 && !/^\d+$/.test(tok) && !/^(l|p|laki|perempuan)$/i.test(tok));
      if (nameCandidate) {
        nama = nameCandidate;
      } else {
        // Fallback: strip digits and take first word block
        const cleaned = line.replace(/\d{16}/g, '').replace(/[\t;,]/g, ' ').trim();
        nama = cleaned.slice(0, 30) || 'Warga Terdata';
      }

      // Identify gender
      const hasP = /\b(p|perempuan|wanita)\b/i.test(line);
      const jk = hasP ? 'P' : 'L';

      if (nik) {
        extracted.push({
          nik,
          noKk: noKk || nik,
          namaLengkap: nama,
          jenisKelamin: jk,
          statusHubungan: 'Kepala Keluarga',
          alamat: tokens[4] || 'Alamat Terdata',
          rt: tokens[5]?.replace(/\D/g, '').slice(0, 2) || '01',
          rw: tokens[6]?.replace(/\D/g, '').slice(0, 2) || '01',
          desaName: tokens[7] || desas[0]?.name || 'Danga',
          kecamatanName: tokens[8] || kecamatans[0]?.name || 'Aesesa',
          sumberData: 'Import PDF/Text',
        });
      }
    });

    setParsedPreview(extracted);
    setIsParsing(false);
    if (extracted.length > 0) {
      showToast(`Cerdas mendeteksi ${extracted.length} data NIK & nama warga dari teks yang disalin.`, 'success');
    } else {
      showToast('Tidak dapat mendeteksi NIK 16 digit pada teks yang ditempel. Periksa format teks.', 'error');
    }
  };

  // Helper to map object keys from Excel/CSV
  const extractRecordsFromRawObjects = (
    rows: Record<string, unknown>[],
    source: DukcapilRecord['sumberData']
  ): Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[] => {
    const list: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    rows.forEach((row) => {
      // Find key for NIK
      const nikKey = Object.keys(row).find((k) => /nik|ktp|nomor_induk/i.test(k));
      const rawNik = String(row[nikKey || ''] || '').replace(/\D/g, '');

      // Find key for KK
      const kkKey = Object.keys(row).find((k) => /kk|kartu_keluarga|no_kk/i.test(k));
      const rawKk = String(row[kkKey || ''] || '').replace(/\D/g, '');

      // Find key for Nama
      const nameKey = Object.keys(row).find((k) => /nama|name|penduduk/i.test(k));
      const nama = String(row[nameKey || ''] || '').trim();

      // Find key for JK
      const jkKey = Object.keys(row).find((k) => /jk|gender|kelamin/i.test(k));
      const rawJk = String(row[jkKey || ''] || '').toUpperCase();
      const jk: 'L' | 'P' = rawJk.startsWith('P') || rawJk === 'WANITA' ? 'P' : 'L';

      // Find address
      const addrKey = Object.keys(row).find((k) => /alamat|address|jalan/i.test(k));
      const alamat = String(row[addrKey || ''] || '-').trim();

      // Find RT / RW
      const rtKey = Object.keys(row).find((k) => /\brt\b/i.test(k));
      const rwKey = Object.keys(row).find((k) => /\brw\b/i.test(k));
      const rt = String(row[rtKey || ''] || '01').replace(/\D/g, '').slice(0, 2) || '01';
      const rw = String(row[rwKey || ''] || '01').replace(/\D/g, '').slice(0, 2) || '01';

      // Find Desa & Kecamatan
      const desaKey = Object.keys(row).find((k) => /desa|kelurahan/i.test(k));
      const kecKey = Object.keys(row).find((k) => /kecamatan|distrik/i.test(k));
      const desaName = String(row[desaKey || ''] || desas[0]?.name || '').trim();
      const kecamatanName = String(row[kecKey || ''] || kecamatans[0]?.name || '').trim();

      if (rawNik.length === 16 && nama) {
        list.push({
          nik: rawNik,
          noKk: rawKk.length === 16 ? rawKk : rawNik,
          namaLengkap: nama,
          jenisKelamin: jk,
          statusHubungan: 'Kepala Keluarga',
          alamat,
          rt,
          rw,
          desaName: desaName || 'Danga',
          kecamatanName: kecamatanName || 'Aesesa',
          sumberData: source,
        });
      }
    });

    return list;
  };

  // Sync from Google Sheet via published CSV or webhook
  const handleSyncGsheet = async () => {
    if (!gsheetUrl.trim()) {
      showToast('Masukkan URL Google Spreadsheet atau URL publikasi CSV.', 'error');
      return;
    }

    setIsParsing(true);
    try {
      // Normalize URL: if it's an edit link, convert to gviz / export csv
      let fetchUrl = gsheetUrl.trim();
      if (fetchUrl.includes('docs.google.com/spreadsheets') && !fetchUrl.includes('export?format=csv')) {
        const match = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        }
      }

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

      const parsed = extractRecordsFromRawObjects(jsonData, 'Sinkron GSheet');
      setParsedPreview(parsed);
      showToast(`Berhasil membaca ${parsed.length} data warga dari Google Sheet.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunduh data Google Sheet. Pastikan tautan dibagikan secara publik (Siapa saja yang memiliki link).', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Commit imported records
  const handleCommitImport = () => {
    if (parsedPreview.length === 0) {
      showToast('Belum ada data hasil parsing untuk diimpor.', 'error');
      return;
    }

    const res = importDukcapilRecords(parsedPreview, importMode);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      setParsedPreview([]);
      setImportFile(null);
      setPastedText('');
      setSubTab('daftar');
    }
  };

  // Download CSV export of Dukcapil
  const handleExportCsv = () => {
    if (dukcapilRecords.length === 0) {
      showToast('Tidak ada data Dukcapil untuk diekspor.', 'error');
      return;
    }

    const headers = [
      'NIK',
      'NO_KK',
      'NAMA_LENGKAP',
      'JENIS_KELAMIN',
      'STATUS_HUBUNGAN',
      'ALAMAT',
      'RT',
      'RW',
      'DESA_KELURAHAN',
      'KECAMATAN',
      'KABUPATEN',
      'PEKERJAAN',
      'SUMBER_DATA',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.nik}"`,
      `"${r.noKk}"`,
      `"${r.namaLengkap}"`,
      `"${r.jenisKelamin}"`,
      `"${r.statusHubungan}"`,
      `"${r.alamat.replace(/"/g, '""')}"`,
      `"${r.rt}"`,
      `"${r.rw}"`,
      `"${r.desaName}"`,
      `"${r.kecamatanName}"`,
      `"${r.kabupatenName || 'Kabupaten Nagekeo'}"`,
      `"${r.pekerjaan || '-'}"`,
      `"${r.sumberData || 'Manual'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DATA_DUKCAPIL_MASTER_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Berhasil mengekspor ${filteredRecords.length} data kependudukan ke CSV.`, 'success');
  };

  // Download Sample Template CSV
  const handleDownloadSampleTemplate = () => {
    const headers = ['NIK', 'NO_KK', 'NAMA_LENGKAP', 'JENIS_KELAMIN', 'ALAMAT', 'RT', 'RW', 'DESA', 'KECAMATAN'];
    const sampleRows = [
      ['5316011504780001', '5316012301050012', 'Markus Dapa', 'L', 'Jl. Trans Flores Km. 4', '04', '02', 'Danga', 'Aesesa'],
      ['5316015206820002', '5316012301050012', 'Maria Goreti Wea', 'P', 'Jl. Trans Flores Km. 4', '04', '02', 'Danga', 'Aesesa'],
      ['5316030508750004', '5316031405060021', 'Dominikus Ndapa', 'L', 'Dusun Raja Tengah', '03', '01', 'Raja', 'Boawae'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...sampleRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'TEMPLATE_IMPORT_DUKCAPIL.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Template CSV berhasil diunduh.', 'info');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Master Data Kependudukan Dukcapil & Auto-Lookup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Integrasi & Sinkronisasi Data Kependudukan (Dukcapil)
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Kelola database NIK 16-digit, No. Kartu Keluarga (KK), nama warga, dan alamat domisili. 
            Mendukung impor multi-format (Excel, CSV, tabel PDF salinan, atau Google Sheet) sehingga surveyor dapat 
            mencari nama warga secara langsung dengan pengisian otomatis di formulir penilaian hunian masyarakat.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={() => {
                setActiveTab('input_baru');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Uji Cari di Form Penilaian</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Warga Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Warga Terdata</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalWarga.toLocaleString('id-ID')} Jiwa</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Memiliki NIK 16 digit terverifikasi</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kepala Keluarga (KK Unik)</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{uniqueKkCount.toLocaleString('id-ID')} KK</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Basis nomor Kartu Keluarga</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Home className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cakupan Wilayah</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{uniqueDesaCount} Desa / Kelurahan</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tersebar di {kecamatans.length} Kecamatan</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-2 flex flex-wrap gap-2">
        <button
          onClick={() => setSubTab('daftar')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            subTab === 'daftar'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Daftar Warga Terdaftar ({filteredRecords.length})</span>
        </button>

        <button
          onClick={() => setSubTab('import')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
            subTab === 'import'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Sinkron & Import Multi-Format (Excel / PDF / GSheet)</span>
        </button>

        <button
          onClick={handleOpenAdd}
          className="ml-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>+ Input Data Warga Baru</span>
        </button>
      </div>

      {/* SUBTAB 1: DAFTAR WARGA (TABEL) */}
      {subTab === 'daftar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          {/* Filter and Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Nama / NIK / No. KK / Alamat..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Filter Kecamatan */}
            <div>
              <select
                value={filterKecamatan}
                onChange={(e) => {
                  setFilterKecamatan(e.target.value);
                  setFilterDesa('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
              >
                <option value="">Semua Kecamatan</option>
                {kecamatans.map((k) => (
                  <option key={k.id} value={k.name}>
                    Kec. {k.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Desa */}
            <div>
              <select
                value={filterDesa}
                onChange={(e) => setFilterDesa(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
              >
                <option value="">Semua Desa / Kelurahan</option>
                {desas
                  .filter((d) => {
                    if (!filterKecamatan) return true;
                    const matchedKec = kecamatans.find((k) => k.name.toLowerCase() === filterKecamatan.toLowerCase());
                    return matchedKec ? d.kecamatanId === matchedKec.id : true;
                  })
                  .map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.type} {d.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Action Export Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">No</th>
                  <th className="py-3 px-3.5">NIK (KTP-el) & No. KK</th>
                  <th className="py-3 px-3.5">Nama Lengkap & Status</th>
                  <th className="py-3 px-3.5">JK / Usia</th>
                  <th className="py-3 px-3.5">Alamat / RT / RW</th>
                  <th className="py-3 px-3.5">Desa & Kecamatan</th>
                  <th className="py-3 px-3.5">Sumber Data</th>
                  <th className="py-3 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((rec, idx) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{rec.nik}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">KK: {rec.noKk}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{rec.namaLengkap}</div>
                        <div className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {rec.statusHubungan}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                          }`}
                        >
                          {rec.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'}
                        </span>
                        {rec.usia && <div className="text-[10px] text-slate-500 mt-0.5">{rec.usia} Thn</div>}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-slate-800 font-medium">{rec.alamat}</div>
                        <div className="text-[10px] text-slate-500">
                          RT {rec.rt || '01'} / RW {rec.rw || '01'}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-800">{rec.desaName}</div>
                        <div className="text-[10px] text-slate-500">Kec. {rec.kecamatanName}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                          {rec.sumberData || 'Manual'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(rec)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                            title="Ubah Data Warga"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(rec.id, rec.namaLengkap)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors"
                            title="Hapus Data Warga"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Users className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-700">Tidak ada data warga yang sesuai</p>
                        <p className="text-xs text-slate-400">
                          Ubah kata kunci pencarian atau klik "+ Tambah Warga Baru" untuk mendaftarkan data warga baru.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: IMPORT MULTI-FORMAT */}
      {subTab === 'import' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>Impor Data Kependudukan Multi-Format</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Impor data Dukcapil dari file Excel (.xlsx, .xls), file CSV (.csv), salin-tempel dari format tabel PDF, atau sinkronisasi langsung dari Google Spreadsheet.
            </p>
          </div>

          {/* Import Method Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setImportMethod('file')}
              className={`p-4 rounded-xl border text-left transition-all ${
                importMethod === 'file'
                  ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 mb-2 ${importMethod === 'file' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <div className="font-bold text-xs text-slate-900">File Excel / CSV</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Unggah berkas .xlsx, .xls, atau .csv dari komputer</div>
            </button>

            <button
              type="button"
              onClick={() => setImportMethod('paste')}
              className={`p-4 rounded-xl border text-left transition-all ${
                importMethod === 'paste'
                  ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileText className={`w-5 h-5 mb-2 ${importMethod === 'paste' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <div className="font-bold text-xs text-slate-900">Salin dari Tabel PDF / Dokumen</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Salin (Ctrl+C) teks tabel dari PDF lalu tempel (Ctrl+V)</div>
            </button>

            <button
              type="button"
              onClick={() => setImportMethod('gsheet')}
              className={`p-4 rounded-xl border text-left transition-all ${
                importMethod === 'gsheet'
                  ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className={`w-5 h-5 mb-2 ${importMethod === 'gsheet' ? 'text-indigo-600' : 'text-slate-500'}`} />
              <div className="font-bold text-xs text-slate-900">Sinkron Google Sheet</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Tautkan link Google Spreadsheet publik data Dukcapil</div>
            </button>
          </div>

          {/* METHOD 1: FILE UPLOAD */}
          {importMethod === 'file' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-indigo-50/20 transition-all">
                <input
                  type="file"
                  id="dukcapilFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="dukcapilFileInput" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Klik untuk memilih berkas Excel atau CSV
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Mendukung format kolom standar Dukcapil: NIK, No KK, Nama Lengkap, JK, Alamat, RT, RW, Desa, Kecamatan.
                  </p>
                  {importFile && (
                    <div className="inline-block mt-2 px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-mono text-xs font-bold">
                      {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </label>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Format kolom yang didukung otomatis: NIK, NO_KK, NAMA, JK, ALAMAT, RT, RW, DESA, KECAMATAN</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Contoh Template CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* METHOD 2: PASTE FROM PDF TABLE */}
          {importMethod === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-xs text-slate-700 mb-1.5">
                  Tempel (Paste) Teks Tabel Salinan dari PDF atau Word:
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Contoh baris tabel yang dapat ditempel (tab-separated atau spasi):\n5316011504780001\t5316012301050012\tMarkus Dapa\tL\tJl. Trans Flores Km. 4\t04\t02\tDanga\tAesesa\n5316030508750004\t5316031405060021\tDominikus Ndapa\tL\tDusun Raja Tengah\t03\t01\tRaja\tBoawae`}
                  className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Algoritma kami otomatis membedah NIK 16-digit, No. KK, nama lengkap, jenis kelamin, dan alamat.
                </p>
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  disabled={isParsing || !pastedText.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ekstraksi Teks Tabel</span>
                </button>
              </div>
            </div>
          )}

          {/* METHOD 3: GOOGLE SHEET SYNC */}
          {importMethod === 'gsheet' && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-xs text-slate-700 mb-1.5">
                  URL Google Spreadsheet Data Kependudukan:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={gsheetUrl}
                    onChange={(e) => setGsheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1xxxxxx/edit"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSyncGsheet}
                    disabled={isParsing || !gsheetUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isParsing ? 'animate-spin' : ''}`} />
                    <span>Ambil Data Sheet</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Petunjuk Google Sheet:</strong> Pastikan spreadsheet diatur dengan izin "Siapa saja yang memiliki tautan dapat melihat" (Anyone with the link can view).
                </span>
              </div>
            </div>
          )}

          {/* PREVIEW TABLE OF PARSED DATA */}
          {parsedPreview.length > 0 && (
            <div className="border border-indigo-100 bg-indigo-50/20 rounded-2xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pratinjau {parsedPreview.length} Data Terbaca</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Periksa sampel data sebelum disimpan ke database kependudukan utama.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-indigo-600"
                    />
                    <span>Tambahkan ke Data Lama</span>
                  </label>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-rose-600"
                    />
                    <span>Ganti Seluruh Data</span>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">No</th>
                      <th className="py-2 px-3">NIK</th>
                      <th className="py-2 px-3">No. KK</th>
                      <th className="py-2 px-3">Nama Lengkap</th>
                      <th className="py-2 px-3">JK</th>
                      <th className="py-2 px-3">Alamat</th>
                      <th className="py-2 px-3">Desa</th>
                      <th className="py-2 px-3">Kecamatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.nik}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{item.noKk}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{item.namaLengkap}</td>
                        <td className="py-2 px-3">{item.jenisKelamin}</td>
                        <td className="py-2 px-3 text-slate-700">{item.alamat}</td>
                        <td className="py-2 px-3 font-medium">{item.desaName}</td>
                        <td className="py-2 px-3 font-medium">{item.kecamatanName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setParsedPreview([])}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan {parsedPreview.length} Data ke Dukcapil</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: TAMBAH / UBAH WARGA DUKCAPIL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingId ? 'Ubah Data Kependudukan' : 'Pendaftaran Warga Baru ke Dukcapil'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standar NIK 16 digit & nomor Kartu Keluarga (KK) untuk validasi hunian
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NIK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK (Nomor Induk Kependudukan) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 5316011504780001"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>Wajib 16 digit angka</span>
                    <span className={formNik.length === 16 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {formNik.length}/16
                    </span>
                  </div>
                </div>

                {/* No KK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Kartu Keluarga (No. KK)
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={formNoKk}
                    onChange={(e) => setFormNoKk(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 5316012301050012"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <div className="flex justify-end text-[10px] text-slate-400 mt-0.5">
                    <span>{formNoKk.length}/16</span>
                  </div>
                </div>

                {/* Nama Lengkap */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lengkap Warga <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Markus Dapa / Maria Goreti"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Jenis Kelamin */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formJk}
                    onChange={(e) => setFormJk(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="L">Laki-Laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                {/* Status Hubungan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status dalam Keluarga</label>
                  <select
                    value={formStatusHubungan}
                    onChange={(e) => setFormStatusHubungan(e.target.value as DukcapilRecord['statusHubungan'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Kepala Keluarga">Kepala Keluarga</option>
                    <option value="Istri">Istri</option>
                    <option value="Anak">Anak</option>
                    <option value="Famili Lain">Famili Lain</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Pekerjaan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pekerjaan</label>
                  <input
                    type="text"
                    value={formPekerjaan}
                    onChange={(e) => setFormPekerjaan(e.target.value)}
                    placeholder="Contoh: Petani / Guru / Wiraswasta"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                {/* Tanggal Lahir */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={formTanggalLahir}
                    onChange={(e) => setFormTanggalLahir(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                {/* Kecamatan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kecamatan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formKecamatan}
                    onChange={(e) => {
                      setFormKecamatan(e.target.value);
                      const matchingKec = kecamatans.find((k) => k.name === e.target.value);
                      if (matchingKec) {
                        const firstDesa = desas.find((d) => d.kecamatanId === matchingKec.id);
                        if (firstDesa) setFormDesa(firstDesa.name);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {kecamatans.map((k) => (
                      <option key={k.id} value={k.name}>
                        Kec. {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desa */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Desa / Kelurahan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDesa}
                    onChange={(e) => setFormDesa(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {availableDesasForForm.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.type} {d.name} {d.isPemekaran ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alamat Lengkap */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Lengkap / Dusun / Jalan
                  </label>
                  <input
                    type="text"
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    placeholder="Contoh: Jl. Trans Flores Km. 4 Kompleks Pasar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                {/* RT & RW */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RT</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formRt}
                    onChange={(e) => setFormRt(e.target.value)}
                    placeholder="01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RW</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formRw}
                    onChange={(e) => setFormRw(e.target.value)}
                    placeholder="01"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingId ? 'Simpan Perubahan' : 'Daftarkan Warga'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
