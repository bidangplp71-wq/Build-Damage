import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Building2,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Calculator,
  Camera,
  MapPin,
  Users,
  Award,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileText,
  Printer,
  Compass,
  Info,
} from 'lucide-react';
import { BuildingCategory, BUILDING_CATEGORY_CONFIGS } from '../types';

interface AssessmentInputGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySampleData?: (sample: {
    category: BuildingCategory;
    buildingName: string;
    ownerAgency: string;
    totalFloorAreaM2: number;
    numberOfFloors: number;
    yearBuilt: number;
    hsbgnPerM2: number;
    disasterType: any;
    sampleScores: Record<string, number>;
  }) => void;
}

type GuideTab = 'overview' | 'kategori_nik' | 'wilayah_desa' | 'komponen_bobot' | 'hsbgn_biaya' | 'foto_pengesahan' | 'google_sheet';

export const AssessmentInputGuideModal: React.FC<AssessmentInputGuideModalProps> = ({
  isOpen,
  onClose,
  onApplySampleData,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('overview');
  const [searchKeyword, setSearchKeyword] = useState('');

  if (!isOpen) return null;

  const handleApplySchoolCase = () => {
    if (onApplySampleData) {
      onApplySampleData({
        category: 'Sekolah / Sarana Pendidikan',
        buildingName: 'SDK St. Santa Theresia Raterunu',
        ownerAgency: 'Yayasan Persekolahan Umat Katolik / Dinas PPO',
        totalFloorAreaM2: 480,
        numberOfFloors: 1,
        yearBuilt: 2012,
        hsbgnPerM2: 5200000,
        disasterType: 'Gempa Bumi',
        sampleScores: {
          'Pondasi': 15.0,
          'Kolom': 35.0,
          'Balok': 30.0,
          'Dinding Pengisi': 45.0,
          'Rangka Atap': 25.0,
          'Penutup Atap': 30.0,
          'Lantai': 20.0,
          'Pintu & Jendela': 25.0,
          'Instalasi Listrik': 15.0,
          'Finishing / Pengecatan': 40.0,
        },
      });
      onClose();
    }
  };

  const tabs = [
    { id: 'overview', label: '1. Alur & Prinsip', icon: Compass },
    { id: 'kategori_nik', label: '2. Kategori & NIK/KK', icon: Building2 },
    { id: 'wilayah_desa', label: '3. Wilayah & Desa', icon: MapPin },
    { id: 'komponen_bobot', label: '4. Komponen Kerusakan', icon: Calculator },
    { id: 'hsbgn_biaya', label: '5. HSBGN & Biaya Rehab', icon: Award },
    { id: 'foto_pengesahan', label: '6. Foto & Pengesahan', icon: Camera },
    { id: 'google_sheet', label: '7. Google Sheet Terpadu', icon: FileSpreadsheet },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl my-auto max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Panduan Penginputan Lengkap Penilaian Gedung</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  Pedoman PUPR
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Instruksi teknis pengisian survei kerusakan cepat pasca bencana & sinkronisasi Google Sheet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors cursor-pointer"
              title="Cetak panduan ini"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Panduan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto shrink-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as GuideTab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800 text-xs sm:text-sm leading-relaxed">

          {/* TAB 1: ALUR & PRINSIP */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-500 text-slate-950 rounded-xl mt-0.5">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      Prinsip Dasar Penilaian Cepat Kerusakan Bangunan PUPR
                    </h4>
                    <p className="text-slate-700 text-xs sm:text-sm mt-1">
                      Penilaian kerusakan dilakukan untuk menetapkan tingkat kelayakan fungsi struktur gedung pasca bencana
                      (Gempa Bumi, Banjir, Tanah Longsor, Angin Puting Beliung, Kebakaran) serta menentukan estimasi kebutuhan biaya
                      rehabilitasi/rekonstruksi menggunakan <strong>Harga Satuan Bangunan Gedung Negara (HSBGN)</strong> setempat.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    1
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Penginputan Lapangan (Surveyor)</h5>
                  <p className="text-slate-600 text-xs">
                    Surveyor mengidentifikasi lokasi gedung, kategori fungsi, luas lantai, mendokumentasikan foto visual,
                    serta memberikan penilaian persentase kerusakan tiap sub-komponen fisik.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-sm">
                    2
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Kalkulasi Otomatis PUPR</h5>
                  <p className="text-slate-600 text-xs">
                    Sistem secara instan menghitung pembobotan (Pondasi 12%, Struktur 28%, Atap 16%, Dinding 14%, Lantai 10%, Utilitas 10%, Finishing 10%),
                    klasifikasi kerusakan (Ringan/Sedang/Berat), dan nilai rupiah biaya rehabilitasi.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-sm">
                    3
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Penyimpanan & Sheet Otomatis</h5>
                  <p className="text-slate-600 text-xs">
                    Data otomatis disimpan ke basis data cloud Firebase dan diteruskan ke Google Sheet per tab kecamatan
                    secara langsung tanpa perlu input ulang secara manual.
                  </p>
                </div>
              </div>

              {/* ACTION QUICK SAMPLE */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-slate-50 to-amber-50 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      Ingin Menguji Form dengan Contoh Kasus Nyata?
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs">
                    Gunakan data survei nyata gedung sekolah (SDK St. Santa Theresia Raterunu) untuk mencoba alur form secara instan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplySchoolCase}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Terapkan Contoh SDK Santa Theresia</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: KATEGORI & ATURAN NIK/KK */}
          {activeTab === 'kategori_nik' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  Aturan Pengisian Nama Pemilik & NIK/KK Sesuai Kategori Gedung
                </h4>
                <p className="text-blue-800 text-xs mt-1">
                  Perhatikan perbedaan mendasar antara <strong>Hunian Masyarakat (Rumah Tinggal)</strong> dengan
                  <strong> Fasilitas Non-Hunian (Gedung Pemerintah, Sekolah, Ibadah, Kesehatan)</strong>:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      1. Kategori Hunian Masyarakat
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">Rumah Tinggal</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Nama Pemilik Rumah:</strong> Wajib diisi nama kepala keluarga / pemilik sertifikat.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>NIK & No. KK:</strong> Wajib diisi 16 digit angka KTP/KK (dapat dicari via pencarian Dukcapil otomatis di form).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>HSBGN Acuan:</strong> Standar rumah sederhana Rp 2.500.000 - Rp 3.500.000 / m².</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      2. Kategori Fasilitas Non-Hunian
                    </span>
                    <span className="text-[11px] font-bold text-amber-700">Sekolah / Kantor / Puskesmas</span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>Nama Pemilik Gedung / Instansi:</strong> Diisi nama institusi/yayasan/dinas, atau cukup angka <strong>0</strong> jika tidak terikat perseorangan.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>NIK & No. KK Di-Nol-kan:</strong> Sesuai SOP PUPR, untuk gedung publik non-hunian, kolom NIK dan No. KK <strong>cukup diisi angka 0</strong> (sistem otomatis mengisikan 0 saat kategori non-hunian dipilih).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span><strong>HSBGN Acuan:</strong> Rp 4.500.000 - Rp 6.500.000 / m² sesuai standar Permen PUPR.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WILAYAH & PEMEKARAN DESA */}
          {activeTab === 'wilayah_desa' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  Hierarki Wilayah & Penambahan Desa Baru / Pemekaran
                </h4>
                <p className="text-slate-600 text-xs mt-1">
                  Setiap gedung harus terpetakan ke dalam Kecamatan dan Desa yang valid agar masuk ke lembar kerja
                  rekapitulasi spreadsheet per wilayah.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    A
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Pilih Kecamatan Terlebih Dahulu</h5>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Memilih kecamatan akan otomatis memfilter daftar desa/kelurahan yang tersedia pada dropdown berikutnya.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    B
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Jika Desa Belum Ada / Pemekaran Baru</h5>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Klik tombol <strong>"+ Tambah Desa Baru"</strong> atau <strong>"+ Pemekaran Desa"</strong> tepat di sebelah dropdown Desa.
                      Ketikkan nama desa baru, sistem akan langsung mendaftarkannya dan menyimpannya ke database cloud untuk digunakan oleh surveyor lain.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    C
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Alamat Rinci & Koordinat GPS</h5>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Isi nama jalan, RT/RW, dan patokan lokasi (contoh: <em>"Jl. Trans Flores KM 12, Samping Lapangan Sepak Bola"</em>).
                      Koordinat GPS latitude/longitude dapat diambil otomatis melalui tombol deteksi lokasi di gawai surveyor.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KOMPONEN KERUSAKAN & BOBOT */}
          {activeTab === 'komponen_bobot' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    Tabel 7 Komponen Utama Standar Penilaian Kerusakan Cepat PUPR
                  </h4>
                  <span className="text-xs font-bold text-slate-600">Total Bobot: 100%</span>
                </div>
                <p className="text-slate-600 text-xs mt-1">
                  Masing-masing komponen memiliki sub-komponen teknis. Persentase kerusakan diisi dengan angka 0 - 100%
                  dengan ketelitian hingga <strong>3 digit desimal (contoh: 34.250%)</strong>.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-bold">
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Komponen Bangunan</th>
                      <th className="p-2.5 text-center">Bobot Standar</th>
                      <th className="p-2.5">Sub-Komponen yang Dinilai</th>
                      <th className="p-2.5">Kriteria Rusak Ringan vs Berat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-bold">1</td>
                      <td className="p-2.5 font-bold text-slate-900">Pondasi</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">12%</td>
                      <td className="p-2.5">Pondasi Batu Kali / Plat / Tiang Pancang</td>
                      <td className="p-2.5">Penurunan &lt;2cm (Ringan), Patah/miring struktur (Berat)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2.5 font-bold">2</td>
                      <td className="p-2.5 font-bold text-slate-900">Struktur Utama</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">28%</td>
                      <td className="p-2.5">Kolom, Balok Sloof, Ringbalk, Pelat Lantai</td>
                      <td className="p-2.5">Retak rambut plesteran (Ringan), Tulangan tekuk/beton hancur (Berat)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">3</td>
                      <td className="p-2.5 font-bold text-slate-900">Atap</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">16%</td>
                      <td className="p-2.5">Kuda-kuda/Gording, Penutup Seng/Genteng, Talang</td>
                      <td className="p-2.5">Bocor lokal (Ringan), Rangka patah / atap terangkat (Berat)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2.5 font-bold">4</td>
                      <td className="p-2.5 font-bold text-slate-900">Dinding & Partisi</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">14%</td>
                      <td className="p-2.5">Pasangan Bata/Batako, Plesteran, Kusen & Pintu</td>
                      <td className="p-2.5">Retak non-struktural (Ringan), Dinding roboh/terlepas (Berat)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">5</td>
                      <td className="p-2.5 font-bold text-slate-900">Lantai</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">10%</td>
                      <td className="p-2.5">Rabat Beton, Keramik / Tegel, Screed</td>
                      <td className="p-2.5">Keramik terangkat (Ringan), Amblas / patah tanah (Berat)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2.5 font-bold">6</td>
                      <td className="p-2.5 font-bold text-slate-900">Utilitas</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">10%</td>
                      <td className="p-2.5">Instalasi Listrik, Pipa Air Bersih/Kotor, Sanitasi</td>
                      <td className="p-2.5">Kran/fitting putus (Ringan), Jaringan utama hancur (Berat)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">7</td>
                      <td className="p-2.5 font-bold text-slate-900">Finishing</td>
                      <td className="p-2.5 text-center font-mono font-bold text-indigo-700">10%</td>
                      <td className="p-2.5">Pengecatan, Plafond Gypsum/Kalsiboard, Kaca</td>
                      <td className="p-2.5">Cat mengelupas (Ringan), Plafond runtuh total (Berat)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: HSBGN & BIAYA REHAB */}
          {activeTab === 'hsbgn_biaya' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 space-y-2">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Tingkat 1</div>
                  <h5 className="font-bold text-emerald-950 text-sm">Rusak Ringan (RR)</h5>
                  <div className="text-xl font-black text-emerald-700">≤ 30.000%</div>
                  <p className="text-xs text-slate-600">
                    Bangunan aman dihuni, perbaikan bersifat kosmetik atau perkuatan lokal minor tanpa merubah struktur utama.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50/50 space-y-2">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wide">Tingkat 2</div>
                  <h5 className="font-bold text-amber-950 text-sm">Rusak Sedang (RS)</h5>
                  <div className="text-xl font-black text-amber-700">30.001% - 45.000%</div>
                  <p className="text-xs text-slate-600">
                    Struktur utama mengalami retak geser/deformasi yang membutuhkan penyuntikan epoxy, penambahan kolom praktis, atau perbaikan atap parsial.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border-2 border-red-300 bg-red-50/50 space-y-2">
                  <div className="text-xs font-bold text-red-800 uppercase tracking-wide">Tingkat 3</div>
                  <h5 className="font-bold text-red-950 text-sm">Rusak Berat (RB)</h5>
                  <div className="text-xl font-black text-red-700">&gt; 45.000%</div>
                  <p className="text-xs text-slate-600">
                    Struktur utama runtuh atau miring membahayakan jiwa. Direkomendasikan rekonstruksi ulang atau pembongkaran total.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <h5 className="font-bold text-slate-900 text-xs sm:text-sm">Rumus Baku Perhitungan Biaya Rehabilitasi PUPR:</h5>
                <div className="font-mono bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-800 space-y-1">
                  <div>1. Biaya Penanganan / m² = % Total Kerusakan × Nilai HSBGN / m²</div>
                  <div>2. Biaya Pembongkaran / m² = % Pembongkaran (Standar 10%) × Biaya Penanganan</div>
                  <div>3. Biaya Total / m² = Biaya Penanganan / m² + Biaya Pembongkaran / m²</div>
                  <div className="text-indigo-700 font-bold">4. Total Biaya Ajuan Rehab = Luas Total Lantai (m²) × Biaya Total / m²</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: FOTO & PENGESAHAN */}
          {activeTab === 'foto_pengesahan' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-600" />
                    Ketentuan Dokumentasi Foto Lapangan
                  </h5>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">1</span>
                      <span><strong>Foto Tampak Depan Keseluruhan:</strong> Menampakkan fasad gedung secara utuh dan papan nama jika ada.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">2</span>
                      <span><strong>Foto Detail Komponen Rusak:</strong> Foto jarak dekat retak kolom, balok, rangka atap patah, atau dinding terlepas dengan keterangan jelas.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">3</span>
                      <span><strong>Kompresi Otomatis:</strong> Gambar otomatis dikompresi agar hemat bandwidth dan cepat terunggah saat di lapangan.</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Tim Analisis & Pejabat Pengesahan
                  </h5>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">1</span>
                      <span><strong>Nama Pejabat PUPR:</strong> Diisi nama Kepala Dinas PUPR, NIP, dan pangkat/golongan untuk kolom tanda tangan laporan resmi.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">2</span>
                      <span><strong>Tim Analisis Lapangan:</strong> Masukkan nama anggota tim penilai (surveyor, koordinator teknis, perwakilan BPBD).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0">3</span>
                      <span><strong>Tombol Tambah Cepat:</strong> Klik <em>"+ Tambah Saya ke Tim"</em> untuk langsung memasukkan identitas akun yang sedang aktif.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: GOOGLE SHEET */}
          {activeTab === 'google_sheet' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  Penyimpanan Langsung Google Sheet Tanpa Perlu Sinkronisasi Ulang
                </h4>
                <p className="text-emerald-800 text-xs mt-1">
                  Kini semua role (Super Admin, Admin, Admin Verifikator, Admin User/Surveyor, dan Admin Publik) dapat
                  langsung membuka dan memantau lembar spreadsheet secara bersamaan.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                  <div className="font-bold text-slate-900">Otomatis Terpisah Berdasarkan Kecamatan</div>
                  <p className="text-slate-600">
                    Data yang disimpan langsung masuk ke tab Sheet nama kecamatan (contoh: tab <code>Kec. Aesesa</code>,
                    <code>Kec. Boawae</code>, <code>Kec. Mauponggo</code>) serta tab <code>Master_Rekapitulasi</code>.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                  <div className="font-bold text-slate-900">Sinkronisasi Real-Time Antar Role</div>
                  <p className="text-slate-600">
                    Jika Super Admin menghapus data bangunan atau mengubah tautan sheet, perubahan tersebut langsung
                    berlaku seketika di semua gawai surveyor dan verifikator tanpa harus refresh browser.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                  <div className="font-bold text-slate-900">Bagaimana jika Link Google Sheet Belum Ditetapkan?</div>
                  <p className="text-slate-600">
                    Administrator cukup mengklik tombol <strong>"Tentukan Link Sheet"</strong> pada banner Google Sheet,
                    lalu buat lembar kerja baru di <code>https://sheets.new</code> dan tempelkan tautannya. Tautan tersebut
                    otomatis tersinkronisasi ke seluruh surveyor.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            SIMPKBG BANGUNAN GEDUNG PUPR &bull; Pedoman Teknis Cepat Penilaian Pasca Bencana
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleApplySchoolCase}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Terapkan Kasus Nyata</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center whitespace-nowrap"
            >
              Tutup Panduan
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
