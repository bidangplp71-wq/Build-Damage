/**
 * Types and interfaces for Sistem Informasi Penilaian Kerusakan Gedung Pasca Bencana (Standar PUPR)
 */

export type UserRole = 
  | 'super_admin'       // Max 1
  | 'admin'             // Max 3
  | 'admin_user'        // Max 100
  | 'admin_publik'      // Max 10
  | 'admin_verifikator';// Max 15

export interface RoleLimit {
  role: UserRole;
  title: string;
  max: number;
  description: string;
  badgeColor: string;
}

export const ROLE_LIMITS: Record<UserRole, RoleLimit> = {
  super_admin: {
    role: 'super_admin',
    title: 'Super Admin',
    max: 1,
    description: 'Pemegang hak akses penuh sistem, konfigurasi HSBGN, Google Sheet, dan manajemen kuota pengguna.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  admin: {
    role: 'admin',
    title: 'Admin Utama',
    max: 3,
    description: 'Pengelola operasional data bencana, pemekaran desa & kecamatan, dan ekspor pelaporan.',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  },
  admin_verifikator: {
    role: 'admin_verifikator',
    title: 'Admin Verifikator',
    max: 15,
    description: 'Tim teknis/ahli yang memvalidasi, memeriksa foto, memberi catatan kelayakan, dan menyetujui hasil survei lapangan.',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  admin_user: {
    role: 'admin_user',
    title: 'Admin User (Surveyor OPD)',
    max: 100,
    description: 'Petugas lapangan dan perwakilan unit kerja yang menginput penilaian cepat fisik bangunan pasca bencana.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  admin_publik: {
    role: 'admin_publik',
    title: 'Admin Publik',
    max: 10,
    description: 'Fasilitator laporan awal masyarakat dan penghubung publik untuk pemetaan cepat dampak bencana.',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-200'
  }
};

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  agency: string; // Dinas/Instansi
  phone: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export type DisasterType = 
  | 'Gempa Bumi'
  | 'Banjir'
  | 'Tanah Longsor'
  | 'Angin Puting Beliung'
  | 'Tsunami'
  | 'Kebakaran'
  | 'Likuefaksi'
  | 'Erupsi Gunung Api'
  | 'Bencana Lainnya';

export type BuildingClass = 
  | 'Bangunan Tidak Sederhana'
  | 'Bangunan Sederhana'
  | 'Bangunan Khusus';

export type BuildingCategory = 
  | 'Hunian Masyarakat'
  | 'Fasilitas Publik'
  | 'Sekolah'
  | 'Perkantoran Swasta'
  | 'Toko'
  | 'Minimarket'
  | 'Supermarket'
  | 'Gedung Pemerintah';

export interface BuildingCategoryConfig {
  id: BuildingCategory;
  name: string;
  shortLabel: string;
  description: string;
  defaultHsbgn: number;
  typicalClass: BuildingClass;
  occupancyLabel: string;
  occupancyPlaceholder: string;
  inspectionTips: string;
  badgeClass: string;
  bgLightClass: string;
  iconName: string;
}

export const BUILDING_CATEGORY_CONFIGS: Record<BuildingCategory, BuildingCategoryConfig> = {
  'Hunian Masyarakat': {
    id: 'Hunian Masyarakat',
    name: 'Hunian Masyarakat (Rumah Tinggal)',
    shortLabel: 'Hunian Warga',
    description: 'Rumah tinggal tunggal, rumah deret, perumahan swadaya masyarakat, dan tempat tinggal keluarga.',
    defaultHsbgn: 3500000,
    typicalClass: 'Bangunan Sederhana',
    occupancyLabel: 'Kepala Keluarga / Pemilik Rumah',
    occupancyPlaceholder: 'Contoh: Keluarga Bpk. Markus Dapa / Ibu Maria',
    inspectionTips: 'Periksa kekokohan pondasi batu kali/sloof, kolom praktis sudut, ring balk pengikat, dinding bata/batako, kuda-kuda kayu/baja ringan, serta sanitasi septictank.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    bgLightClass: 'bg-emerald-50/70',
    iconName: 'Home',
  },
  'Fasilitas Publik': {
    id: 'Fasilitas Publik',
    name: 'Fasilitas Publik & Sosial',
    shortLabel: 'Publik / Fasos',
    description: 'Balai pertemuan warga, puskesmas/posyandu, tempat ibadah (masjid/gereja/pura), dan fasilitas umum serbaguna.',
    defaultHsbgn: 5200000,
    typicalClass: 'Bangunan Sederhana',
    occupancyLabel: 'Pengelola / Instansi / Lembaga Publik',
    occupancyPlaceholder: 'Contoh: Pengurus DKM / Majelis Jemaat / Puskesmas Pembantu',
    inspectionTips: 'Periksa bentang ruang aula, kapasitas evakuasi pintu keluar, ramp disabilitas, plafon ruangan luas, sanitasi toilet umum, dan instalasi penangkal petir.',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    bgLightClass: 'bg-cyan-50/70',
    iconName: 'Users',
  },
  'Sekolah': {
    id: 'Sekolah',
    name: 'Sekolah & Sarana Pendidikan',
    shortLabel: 'Sekolah / Kampus',
    description: 'Gedung ruang kelas, laboratorium, perpustakaan, kantor guru, PAUD, SD, SMP, SMA/SMK, dan perguruan tinggi.',
    defaultHsbgn: 4500000,
    typicalClass: 'Bangunan Sederhana',
    occupancyLabel: 'Satuan Pendidikan / Yayasan Pengelola',
    occupancyPlaceholder: 'Contoh: SDN 01 Danga / Yayasan Pendidikan Nusa Bakti',
    inspectionTips: 'Prioritaskan keselamatan anak didik: periksa kolom portal ruang kelas, langit-langit/plafon gantung yang rentan runtuh, dinding sekat kelas, koridor evakuasi, dan tangga bertingkat.',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    bgLightClass: 'bg-blue-50/70',
    iconName: 'GraduationCap',
  },
  'Perkantoran Swasta': {
    id: 'Perkantoran Swasta',
    name: 'Perkantoran Swasta & Bisnis',
    shortLabel: 'Kantor Swasta',
    description: 'Gedung kantor swasta, ruko kantor konsultan/notaris, kantor perbankan/koperasi swasta, dan badan usaha.',
    defaultHsbgn: 6200000,
    typicalClass: 'Bangunan Tidak Sederhana',
    occupancyLabel: 'Badan Usaha / Perusahaan Pengelola',
    occupancyPlaceholder: 'Contoh: PT Flores Mitra Konsultan / Koperasi Simpan Pinjam',
    inspectionTips: 'Periksa partisi gypsum interior, instalasi jaringan data & kelistrikan tersembunyi, fasade kaca/ACP, sistem proteksi kebakaran APAR, dan stabilitas mezanin/lantai kerja.',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    bgLightClass: 'bg-indigo-50/70',
    iconName: 'Briefcase',
  },
  'Toko': {
    id: 'Toko',
    name: 'Toko & Ruko Komersial',
    shortLabel: 'Toko / Ruko',
    description: 'Toko kelontong, ruko bahan bangunan, toko busana, warung makan semi-permanen/permanen, dan tempat usaha dagang perorangan.',
    defaultHsbgn: 4000000,
    typicalClass: 'Bangunan Sederhana',
    occupancyLabel: 'Nama Pemilik Toko / Usaha',
    occupancyPlaceholder: 'Contoh: Toko Sembako Rejeki Jaya / Bpk. Hendra Wijaya',
    inspectionTips: 'Periksa bukaan pintu rolling door/folding gate (rawan macet pasca gempa), kekakuan kolom lantai 1 karena ketiadaan dinding (efek soft-story), area gudang penyimpanan, dan mezanin barang dagangan.',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    bgLightClass: 'bg-amber-50/70',
    iconName: 'Store',
  },
  'Minimarket': {
    id: 'Minimarket',
    name: 'Minimarket & Retail Modern',
    shortLabel: 'Minimarket',
    description: 'Minimarket waralaba (Indomaret, Alfamart, Alfamidi), minimarket lokal mandiri, dan outlet ritel modern berpendingin.',
    defaultHsbgn: 4800000,
    typicalClass: 'Bangunan Sederhana',
    occupancyLabel: 'Pengelola / Waralaba / Pemilik Gerai',
    occupancyPlaceholder: 'Contoh: PT Sumber Alfaria Trijaya / Minimarket Danga Mart',
    inspectionTips: 'Periksa instalasi kelistrikan pendingin (chiller/freezer), pintu kaca geser otomatis tempered, lantai granit komersial yang retak atau meletup (popping), kanopi depan, dan ruang genset darurat.',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
    bgLightClass: 'bg-orange-50/70',
    iconName: 'ShoppingBag',
  },
  'Supermarket': {
    id: 'Supermarket',
    name: 'Supermarket, Swalayan & Pusat Belanja',
    shortLabel: 'Supermarket / Mall',
    description: 'Supermarket skala menengah/besar, toserba swalayan komersial, department store, dan sentra belanja modern.',
    defaultHsbgn: 6800000,
    typicalClass: 'Bangunan Tidak Sederhana',
    occupancyLabel: 'Manajemen Pengelola Swalayan / Supermarket',
    occupancyPlaceholder: 'Contoh: PT Swalayan Central Mbay / Manajemen Plaza Flores',
    inspectionTips: 'Fokus pada bentang lebar balok/baja struktur atap, instalasi MEP sentral (chiller HVAC, sprinkler pemadam otomatis, pompa hidran), lantai beban berat, ramp eskalator/lift, dan zona loading dock barang.',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    bgLightClass: 'bg-rose-50/70',
    iconName: 'ShoppingCart',
  },
  'Gedung Pemerintah': {
    id: 'Gedung Pemerintah',
    name: 'Gedung Pemerintah & Instansi Negara',
    shortLabel: 'Pemerintah (BGN)',
    description: 'Kantor dinas pemerintah (OPD), kantor bupati/walikota, kantor camat/desa, balai perizinan, dan gedung milik negara.',
    defaultHsbgn: 7700000,
    typicalClass: 'Bangunan Tidak Sederhana',
    occupancyLabel: 'Pengguna Bangunan Gedung Negara (OPD/Instansi)',
    occupancyPlaceholder: 'Contoh: Dinas Pekerjaan Umum dan Penataan Ruang',
    inspectionTips: 'Standar HSBGN BGN Nasional: evaluasi elemen arsitektural dinas, ruang sidang/rapat, ruang arsip penting negara, serta proteksi dokumen kedinasan.',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    bgLightClass: 'bg-purple-50/70',
    iconName: 'Landmark',
  },
};

export type DamageClassification = 
  | 'Rusak Ringan'
  | 'Rusak Sedang'
  | 'Rusak Berat'
  | 'Rusak Sangat Berat';

export type VerificationStatus = 
  | 'Menunggu Verifikasi'
  | 'Terverifikasi'
  | 'Perlu Revisi'
  | 'Ditolak';

export interface PUPRSubComponentConfig {
  id: string;
  componentNo: number;
  componentName: string;
  subComponentName: string;
  bobotPercent: number;        // Bobot terhadap seluruh bangunan (%)
  kerusakanMaxPercent: number; // Kerusakan maksimum (%)
}

export interface SubComponentAssessment extends PUPRSubComponentConfig {
  damagePercentInput: number;  // Tingkat kerusakan teramati (0 - 100%)
  calculatedScore: number;     // Nilai = (damagePercentInput / 100) * bobotPercent
  notes?: string;
}

export interface BuildingPhoto {
  id: string;
  url: string;
  caption: string;
  damageLocation?: string; // Bagian / komponen kerusakan fisik yang difoto (e.g. Kolom, Dinding, Atap, Pondasi, dll)
  subComponentName?: string;
  takenAt?: string;
}

export const STANDARD_DAMAGE_LOCATIONS = [
  'Tampak Depan Bangunan',
  'Tampak Kiri Bangunan',
  'Tampak Kanan Bangunan',
  'Tampak Belakang Bangunan',
  'Pondasi / Sloof',
  'Struktur - Kolom Praktis / Utama',
  'Struktur - Balok / Ring Balk',
  'Arsitektur - Dinding / Plesteran',
  'Atap - Kuda-Kuda / Rangka Atap',
  'Atap - Penutup Atap / Seng / Genteng',
  'Plafon & Rangka Langit-Langit',
  'Lantai & Keramik Lantai',
  'Pintu, Jendela & Kusen',
  'Instalasi Listrik & Penerangan',
  'Sanitasi, Air Bersih & Drainase',
  'Kerusakan Lainnya / Bagian Khusus',
] as const;

export type StandardDamageLocation = typeof STANDARD_DAMAGE_LOCATIONS[number];

export interface BuildingAssessment {
  id: string;
  code?: string; // Optional / dapat dikosongkan (e.g. REG-PUPR-2026-001 atau kosong jika belum terdaftar)
  disasterType: DisasterType;
  disasterDate: string;
  assessmentDate: string;
  buildingName: string;
  buildingCategory: BuildingCategory; // Hunian, Publik, Sekolah, Kantor Swasta, Toko, Minimarket, Supermarket, Gedung Pemerintah
  yearBuilt: number;
  ownerAgency: string; // Pengguna / Pengelola Bangunan Gedung (Umum / Kompatibilitas)
  namaPemilikRumah?: string; // Khusus kategori Hunian Masyarakat (Pemilik Rumah Tinggal / Kepala Keluarga)
  namaPemilikGedung?: string; // Khusus kategori Non-Hunian (Pemilik Fisik Gedung / Instansi / Pengelola)
  nikPemilik?: string; // NIK 16 digit jika hunian masyarakat / terhubung Dukcapil
  noKkPemilik?: string; // No KK 16 digit jika terhubung Dukcapil
  responsibleDepartment: string; // e.g. Dinas Pekerjaan Umum dan Penataan Ruang
  buildingClass: BuildingClass;
  totalFloorAreaM2: number;
  numberOfFloors: number;
  kecamatanId: string;
  kecamatanName: string;
  desaId: string;
  desaName: string;
  detailedAddress: string;
  latitude?: number;
  longitude?: number;
  
  // Scoring
  components: SubComponentAssessment[];
  totalDamagePercent: number; // Sum of calculated scores
  damageClassification: DamageClassification;
  
  // Cost estimation (RAB PUPR)
  hsbgnPerM2: number; // Harga Satuan Tertinggi Bangunan Gedung Negara
  treatmentCostPerM2: number; // Nilai Perawatan = totalDamagePercent * HSBGN
  demolitionPercent: number; // default 8%
  demolitionCostPerM2: number; // demolitionPercent * treatmentCostPerM2
  totalCostPerM2: number; // treatmentCostPerM2 + demolitionCostPerM2
  totalRehabCost: number; // totalFloorAreaM2 * totalCostPerM2
  roundedRehabCost: number; // dibulatkan
  costTerbilang: string; // Terbilang Rupiah
  
  // Visual Evidence (Maksimal 10 Foto Kerusakan dengan Keterangan Bagian)
  photos: BuildingPhoto[];
  
  // Signatures & Analysis Team
  cityLocation: string; // e.g. "Seba", "Kupang", "Nagekeo"
  reportDateStr: string; // e.g. "Agustus 2026"
  headOfDepartment: {
    title: string; // e.g. "Kepala Dinas Pekerjaan Umum dan Penataan Ruang"
    subTitle: string; // e.g. "Kabupaten ..."
    rank: string; // e.g. "Pembina Utama Muda (IV/c)"
    name: string;
    nip: string;
  };
  analysisTeam: string[]; // Tim Analisis 1 to 6
  
  // Verification
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  
  // Google Sheets Synchronization
  googleSheetSynced: boolean;
  googleSheetSyncedAt?: string;
  googleSheetRowId?: string;

  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Kecamatan {
  id: string;
  code: string;
  name: string;
  capitalCity?: string;
  description?: string;
  createdAt: string;
}

export interface Desa {
  id: string;
  kecamatanId: string;
  code: string;
  name: string;
  type: 'Desa' | 'Kelurahan';
  isPemekaran?: boolean;
  notes?: string;
  createdAt: string;
}

export interface GoogleSheetConfig {
  spreadsheetUrl?: string;
  webhookUrl: string;
  sheetName: string;
  splitByKecamatan?: boolean; // Fitur: Setiap Kecamatan memiliki Tab Sheet tersendiri
  includeMasterSummarySheet?: boolean; // Tetap sertakan Sheet Rekap Gabungan Semua Kecamatan
  autoSync: boolean;
  directSaveEnabled: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'error';
  lastTestMessage?: string;
}

export interface FirebaseShieldConfig {
  enabled: boolean;
  projectName: string;
  environment: 'production' | 'staging' | 'demo-shielded';
  enforceRbac: boolean;
  statusText: string;
}

export interface DukcapilRecord {
  id: string;
  nik: string; // 16 digit NIK
  noKk: string; // 16 digit No. KK
  namaLengkap: string;
  jenisKelamin: 'L' | 'P';
  tempatLahir?: string;
  tanggalLahir?: string;
  usia?: number;
  agama?: string;
  pekerjaan?: string;
  statusHubungan: 'Kepala Keluarga' | 'Istri' | 'Anak' | 'Famili Lain' | 'Lainnya';
  alamat: string;
  rt: string;
  rw: string;
  desaName: string;
  kecamatanName: string;
  kabupatenName?: string;
  sumberData?: 'Manual' | 'Import Excel/CSV' | 'Import PDF/Text' | 'Sinkron GSheet';
  createdAt: string;
  updatedAt: string;
}

