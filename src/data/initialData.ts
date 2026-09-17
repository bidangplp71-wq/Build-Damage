import { BuildingAssessment, Kecamatan, Desa, UserAccount, GoogleSheetConfig, DukcapilRecord } from '../types';
import { encryptPassword } from '../utils/security';

export const INITIAL_KECAMATAN: Kecamatan[] = [
  {
    id: 'kec_1',
    code: '53.16.01',
    name: 'Aesesa',
    capitalCity: 'Mbay',
    description: 'Pusat pemerintahan dan perdagangan kabupaten',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_2',
    code: '53.16.02',
    name: 'Aesesa Selatan',
    capitalCity: 'Danga',
    description: 'Wilayah perbukitan dan pemukiman agraris',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_3',
    code: '53.16.03',
    name: 'Boawae',
    capitalCity: 'Nangaroro Timur',
    description: 'Wilayah kaki gunung rawan aktivitas seismik',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_4',
    code: '53.16.04',
    name: 'Mauponggo',
    capitalCity: 'Ua',
    description: 'Pesisir selatan rawan abrasi & gempa',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_5',
    code: '53.16.05',
    name: 'Nangaroro',
    capitalCity: 'Nangaroro',
    description: 'Kawasan pesisir timur & jalur transportasi',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_6',
    code: '53.16.06',
    name: 'Keo Tengah',
    capitalCity: 'Maundai',
    description: 'Dataran tinggi dan lembah perbukitan',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'kec_7',
    code: '53.16.07',
    name: 'Wolowae',
    capitalCity: 'Dorenga',
    description: 'Kawasan perbatasan dan pesisir',
    createdAt: '2026-01-10T08:00:00Z',
  },
];

export const INITIAL_DESA: Desa[] = [
  // Aesesa
  { id: 'desa_1', kecamatanId: 'kec_1', code: '53.16.01.1001', name: 'Danga', type: 'Kelurahan', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_2', kecamatanId: 'kec_1', code: '53.16.01.1002', name: 'Lape', type: 'Kelurahan', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_3', kecamatanId: 'kec_1', code: '53.16.01.2003', name: 'Nangadhero', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_4', kecamatanId: 'kec_1', code: '53.16.01.2004', name: 'Marapokot', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_5', kecamatanId: 'kec_1', code: '53.16.01.2005', name: 'Tedakisa', type: 'Desa', isPemekaran: true, notes: 'Hasil pemekaran desa', createdAt: '2026-02-15T09:00:00Z' },
  
  // Aesesa Selatan
  { id: 'desa_6', kecamatanId: 'kec_2', code: '53.16.02.2001', name: 'Lodaolo', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_7', kecamatanId: 'kec_2', code: '53.16.02.2002', name: 'Wajomara', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_8', kecamatanId: 'kec_2', code: '53.16.02.2003', name: 'Rendu Tutubhada', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },

  // Boawae
  { id: 'desa_9', kecamatanId: 'kec_3', code: '53.16.03.1001', name: 'Nangaroro Barat', type: 'Kelurahan', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_10', kecamatanId: 'kec_3', code: '53.16.03.2002', name: 'Raja', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_11', kecamatanId: 'kec_3', code: '53.16.03.2003', name: 'Dhereisa', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_12', kecamatanId: 'kec_3', code: '53.16.03.2004', name: 'Raja Selatan', type: 'Desa', isPemekaran: true, notes: 'Pemekaran Desa Raja', createdAt: '2026-03-01T10:00:00Z' },

  // Mauponggo
  { id: 'desa_13', kecamatanId: 'kec_4', code: '53.16.04.2001', name: 'Lokalaba', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_14', kecamatanId: 'kec_4', code: '53.16.04.2002', name: 'Sawu', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_15', kecamatanId: 'kec_4', code: '53.16.04.2003', name: 'Aelapu', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },

  // Nangaroro
  { id: 'desa_16', kecamatanId: 'kec_5', code: '53.16.05.1001', name: 'Nangaroro Kota', type: 'Kelurahan', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_17', kecamatanId: 'kec_5', code: '53.16.05.2002', name: 'Degasau', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  
  // Keo Tengah
  { id: 'desa_18', kecamatanId: 'kec_6', code: '53.16.06.2001', name: 'Maundai', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_19', kecamatanId: 'kec_6', code: '53.16.06.2002', name: 'Kotagana', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },

  // Wolowae
  { id: 'desa_20', kecamatanId: 'kec_7', code: '53.16.07.2001', name: 'Tendatoto', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
  { id: 'desa_21', kecamatanId: 'kec_7', code: '53.16.07.2002', name: 'Anakoli', type: 'Desa', createdAt: '2026-01-10T08:00:00Z' },
];

export const INITIAL_USERS: UserAccount[] = [
  // Super Admin: Exact 1 (Maksimal 1) - Pemegang Otoritas Penuh
  {
    id: 'user_super_admin',
    name: 'Vancy Djogo',
    email: 'bidangplp71@gmail.com',
    role: 'super_admin',
    agency: 'Dinas Pekerjaan Umum dan Penataan Ruang Kabupaten Nagekeo',
    phone: '081234567890',
    status: 'active',
    password: encryptPassword('simpkbg2026'),
    passwordLastChanged: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  // Admin Utama: Dibatasi 3 (sekarang 1 aktif)
  {
    id: 'user_admin_1',
    name: 'Admin Utama Dinas PUPR',
    email: 'admin.pupr@nagekeokab.go.id',
    role: 'admin',
    agency: 'Bidang Cipta Karya & Tata Ruang PUPR',
    phone: '081234567891',
    status: 'active',
    password: encryptPassword('adminpupr2026'),
    passwordLastChanged: '2026-01-05T08:30:00Z',
    createdAt: '2026-01-05T08:30:00Z',
  },
  // Admin Verifikator: Dibatasi 15 (sekarang 1 aktif)
  {
    id: 'user_verif_1',
    name: 'Tim Ahli TABG PUPR',
    email: 'verifikator.tabg@nagekeokab.go.id',
    role: 'admin_verifikator',
    agency: 'Tim Ahli Bangunan Gedung (TABG)',
    phone: '081234567893',
    status: 'active',
    password: encryptPassword('tabgpupr2026'),
    passwordLastChanged: '2026-01-10T10:00:00Z',
    createdAt: '2026-01-10T10:00:00Z',
  },
  // Admin User (Surveyor): Dibatasi 125 (sekarang 1 aktif)
  {
    id: 'user_surveyor_1',
    name: 'Petugas Surveyor Lapangan PUPR',
    email: 'surveyor.pupr@nagekeokab.go.id',
    role: 'admin_user',
    agency: 'Tim Reaksi Cepat Pascabencana PUPR',
    phone: '081398765431',
    status: 'active',
    password: encryptPassword('surveyor2026'),
    passwordLastChanged: '2026-01-15T07:45:00Z',
    createdAt: '2026-01-15T07:45:00Z',
  },
  // Admin Publik: Dibatasi 10 (sekarang 1 aktif)
  {
    id: 'user_publik_1',
    name: 'Akses Portal Publik & Tamu',
    email: 'publik@nagekeokab.go.id',
    role: 'admin_publik',
    agency: 'Masyarakat & Forum Relawan Terbuka',
    phone: '082155443322',
    status: 'active',
    password: encryptPassword('publik2026'),
    passwordLastChanged: '2026-01-20T10:00:00Z',
    createdAt: '2026-01-20T10:00:00Z',
  },
];

// Seluruh data dummy penilaian gedung dikosongkan (Dimulai dari kondisi bersih)
export const INITIAL_ASSESSMENTS: BuildingAssessment[] = [];

export const DEFAULT_GOOGLE_SHEET_CONFIG: GoogleSheetConfig = {
  spreadsheetUrl: (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SPREADSHEET_URL) || '',
  webhookUrl: (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_WEBHOOK_URL) || 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
  driveFolderId: 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
  savePhotosToDrive: true,
  sheetName: 'REKAP_SEMUA_KECAMATAN',
  logSheetName: 'Log_Akses_Pengguna',
  splitByKecamatan: true,
  includeMasterSummarySheet: true,
  autoSync: true,
  directSaveEnabled: true,
  onlyReadPopulatedCells: true,
  lastTestedAt: undefined,
  lastTestStatus: 'idle',
  lastTestMessage: 'Tautan Google Sheet dapat diatur oleh administrator dan otomatis tersinkron ke semua peran pengguna.',
  activeProfileId: 'profile_primary_2026',
  spreadsheetProfiles: [
    {
      id: 'profile_primary_2026',
      pageNumber: 1,
      name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
      spreadsheetUrl: '',
      webhookUrl: 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
      driveFolderId: 'https://drive.google.com/drive/folders/1xKF8SYvNY97A9-ga0B42z3jQTbcC_Tk5?usp=sharing',
      description: 'Spreadsheet dinas utama berisi 7 tab kecamatan dan log pengguna',
      capacityStatus: 'normal',
      estimatedRowCount: 0,
      maxCapacityRows: 200,
      createdAt: '2026-01-01T00:00:00Z',
      isDefault: true,
    },
    {
      id: 'profile_backup_new',
      pageNumber: 2,
      name: 'Buku 2: Spreadsheet Tahap Lanjutan / Pascabencana',
      spreadsheetUrl: '',
      webhookUrl: 'https://script.google.com/macros/s/AKfycbyAbubspPnACJi6KTODHJbVeAIppC6e72c8nAo__g8uc67GmY-wc1lOZWZkbLtieds/exec',
      description: 'Slot spreadsheet baru untuk arsip periode berikutnya tanpa harus menghapus spreadsheet lama',
      capacityStatus: 'normal',
      estimatedRowCount: 0,
      maxCapacityRows: 200,
      createdAt: '2026-09-14T00:00:00Z',
      isDefault: false,
    }
  ],
};

// Seluruh data dummy kependudukan (Dukcapil) dikosongkan (Dimulai dari kondisi bersih)
export const INITIAL_DUKCAPIL: DukcapilRecord[] = [];

// Dokumen Standar PUPR untuk Pemulihan Data: Pasar Aewoe Unit Satu (Kecamatan Mauponggo)
export const DEFAULT_PASAR_AEWOE_ASSESSMENT: BuildingAssessment = {
  id: 'assess_pasar_aewoe_unit_satu',
  code: 'REG-PUPR-2026-MAU-001',
  disasterType: 'Gempa Bumi',
  disasterDate: '2026-09-16',
  assessmentDate: '2026-09-16',
  buildingName: 'Pasar Aewoe Unit Satu',
  buildingCategory: 'Toko',
  yearBuilt: 2018,
  ownerAgency: 'Dinas Koperasi, UKM, Perindustrian dan Perdagangan Kab. Nagekeo',
  namaPemilikGedung: 'Pemerintah Daerah Kabupaten Nagekeo / Dinas Koperindag',
  responsibleDepartment: 'Dinas Pekerjaan Umum dan Penataan Ruang',
  buildingClass: 'Bangunan Sederhana',
  totalFloorAreaM2: 450,
  numberOfFloors: 1,
  kecamatanId: 'kec_4',
  kecamatanName: 'Mauponggo',
  desaId: 'desa_13',
  desaName: 'Aewoe',
  detailedAddress: 'Kompleks Pasar Rakyat Aewoe, Desa Aewoe, Kec. Mauponggo, Kabupaten Nagekeo',
  latitude: -8.8412,
  longitude: 121.2185,
  components: [
    { id: 'pondasi_1', componentNo: 1, componentName: 'Pondasi', subComponentName: 'Pondasi', bobotPercent: 7.00, kerusakanMaxPercent: 15.00, damagePercentInput: 20, calculatedScore: 1.4, notes: 'Retak rambut pada sloof dan penurunan setempat' },
    { id: 'struktur_kolom_balok', componentNo: 2, componentName: 'Struktur', subComponentName: 'Kolom & Balok', bobotPercent: 21.50, kerusakanMaxPercent: 30.00, damagePercentInput: 35, calculatedScore: 7.525, notes: 'Plesteran kolom terkelupas dan retak diagonal sedang' },
    { id: 'struktur_plesteran', componentNo: 2, componentName: 'Struktur', subComponentName: 'Plesteran', bobotPercent: 4.00, kerusakanMaxPercent: 100.00, damagePercentInput: 30, calculatedScore: 1.2, notes: 'Retak plesteran pada sambungan balok' },
    { id: 'atap_kuda_kuda', componentNo: 3, componentName: 'Atap', subComponentName: 'Kuda-kuda', bobotPercent: 5.00, kerusakanMaxPercent: 30.00, damagePercentInput: 25, calculatedScore: 1.25, notes: 'Pergeseran kedudukan kuda-kuda atap los pasar' },
    { id: 'atap_gording', componentNo: 3, componentName: 'Atap', subComponentName: 'Gording', bobotPercent: 4.50, kerusakanMaxPercent: 75.00, damagePercentInput: 30, calculatedScore: 1.35, notes: 'Lentur pada beberapa titik gording' },
    { id: 'atap_penutup', componentNo: 3, componentName: 'Atap', subComponentName: 'Penutup atap', bobotPercent: 2.00, kerusakanMaxPercent: 100.00, damagePercentInput: 40, calculatedScore: 0.8, notes: 'Lembaran seng lepas dan bocor' },
    { id: 'langit_rangka', componentNo: 4, componentName: 'Langit-langit', subComponentName: 'Rangka langit-langit', bobotPercent: 3.00, kerusakanMaxPercent: 100.00, damagePercentInput: 25, calculatedScore: 0.75, notes: 'Rangka plafon beberapa petak kendor' },
    { id: 'langit_penutup', componentNo: 4, componentName: 'Langit-langit', subComponentName: 'Penutup Langit-langit', bobotPercent: 4.00, kerusakanMaxPercent: 100.00, damagePercentInput: 45, calculatedScore: 1.8, notes: 'Plafon runtuh sebagian akibat gempa' },
    { id: 'dinding_bata', componentNo: 5, componentName: 'Dinding', subComponentName: 'Batu bata / Bataco', bobotPercent: 7.00, kerusakanMaxPercent: 50.00, damagePercentInput: 35, calculatedScore: 2.45, notes: 'Dinding pembatas kios retak tembus' },
    { id: 'dinding_plesteran', componentNo: 5, componentName: 'Dinding', subComponentName: 'Plesteran', bobotPercent: 3.00, kerusakanMaxPercent: 100.00, damagePercentInput: 40, calculatedScore: 1.2, notes: 'Plesteran rontok di sudut dinding' },
    { id: 'dinding_kaca', componentNo: 5, componentName: 'Dinding', subComponentName: 'Kaca', bobotPercent: 2.50, kerusakanMaxPercent: 100.00, damagePercentInput: 15, calculatedScore: 0.375, notes: 'Kaca ventilasi pecah' },
    { id: 'dinding_pintu', componentNo: 5, componentName: 'Dinding', subComponentName: 'Pintu', bobotPercent: 3.00, kerusakanMaxPercent: 100.00, damagePercentInput: 30, calculatedScore: 0.9, notes: 'Rolling door macet akibat pergeseran kosen' },
    { id: 'dinding_kosen', componentNo: 5, componentName: 'Dinding', subComponentName: 'Kosen', bobotPercent: 3.00, kerusakanMaxPercent: 100.00, damagePercentInput: 25, calculatedScore: 0.75, notes: 'Kosen bergeser dari dudukan' },
    { id: 'lantai_penutup', componentNo: 6, componentName: 'Lantai', subComponentName: 'Penutup lantai', bobotPercent: 10.50, kerusakanMaxPercent: 100.00, damagePercentInput: 30, calculatedScore: 3.15, notes: 'Lantai retak dan amblas sebagian' },
    { id: 'utilitas_listrik', componentNo: 7, componentName: 'Utilitas', subComponentName: 'Instalasi Listrik', bobotPercent: 4.00, kerusakanMaxPercent: 100.00, damagePercentInput: 35, calculatedScore: 1.4, notes: 'Kabel terputus dan fitting lampu jatuh' },
    { id: 'utilitas_air', componentNo: 7, componentName: 'Utilitas', subComponentName: 'Instalasi Air', bobotPercent: 3.00, kerusakanMaxPercent: 100.00, damagePercentInput: 30, calculatedScore: 0.9, notes: 'Pipa distribusi air los pasar bocor' },
    { id: 'utilitas_drainase', componentNo: 7, componentName: 'Utilitas', subComponentName: 'Drainase Limbah', bobotPercent: 1.00, kerusakanMaxPercent: 100.00, damagePercentInput: 25, calculatedScore: 0.25, notes: 'Saluran tertimbun runtuhan plesteran' },
    { id: 'finishing_struktur', componentNo: 8, componentName: 'Finishing', subComponentName: 'Cat Struktur', bobotPercent: 1.00, kerusakanMaxPercent: 100.00, damagePercentInput: 30, calculatedScore: 0.3, notes: 'Cat kusam dan mengelupas' },
    { id: 'finishing_langit', componentNo: 8, componentName: 'Finishing', subComponentName: 'Cat Langit-langit', bobotPercent: 1.00, kerusakanMaxPercent: 100.00, damagePercentInput: 40, calculatedScore: 0.4, notes: 'Tercemar noda air dan mengelupas' },
    { id: 'finishing_dinding', componentNo: 8, componentName: 'Finishing', subComponentName: 'Cat Dinding', bobotPercent: 2.00, kerusakanMaxPercent: 100.00, damagePercentInput: 40, calculatedScore: 0.8, notes: 'Cat dinding rontok' },
    { id: 'finishing_kosen_pintu', componentNo: 8, componentName: 'Finishing', subComponentName: 'Cat Kosen & Pintu', bobotPercent: 1.00, kerusakanMaxPercent: 100.00, damagePercentInput: 25, calculatedScore: 0.25, notes: 'Goresan dan cat memudar' }
  ],
  totalDamagePercent: 32.2,
  damageClassification: 'Rusak Sedang',
  hsbgnPerM2: 5650000,
  treatmentCostPerM2: 1819300,
  demolitionPercent: 8,
  demolitionCostPerM2: 145544,
  totalCostPerM2: 1964844,
  totalRehabCost: 884179800,
  roundedRehabCost: 884180000,
  costTerbilang: 'Delapan Ratus Delapan Puluh Empat Juta Seratus Delapan Puluh Ribu Rupiah',
  photos: [
    {
      id: 'photo_aewoe_1',
      url: '',
      damageLocation: 'Kios & Los Utama Pasar Aewoe',
      caption: 'Kondisi kerusakan dinding pembatas kios dan retak plesteran akibat gempa',
      takenAt: '2026-09-16T09:30:00Z'
    },
    {
      id: 'photo_aewoe_2',
      url: '',
      damageLocation: 'Rangka Atap & Plafon Los Pasar',
      caption: 'Pergeseran kuda-kuda dan sebagian plafon runtuh di area los tengah',
      takenAt: '2026-09-16T09:35:00Z'
    }
  ],
  cityLocation: 'Mbay',
  reportDateStr: 'September 2026',
  headOfDepartment: {
    title: 'Kepala Dinas Pekerjaan Umum dan Penataan Ruang',
    subTitle: 'Kabupaten Nagekeo',
    rank: 'Pembina Utama Muda (IV/c)',
    name: 'Vancy Djogo, ST., MT.',
    nip: '19750815 200003 1 005'
  },
  analysisTeam: [
    'Markus Dapa, ST. (Ketua Tim Teknis)',
    'Dominikus Ndapa, ST. (Ahli Struktur)',
    'Theresia Wea, ST. (Ahli Arsitektur)'
  ],
  verificationStatus: 'Terverifikasi',
  verifiedBy: 'Vancy Djogo (Super Admin)',
  verifiedAt: '2026-09-16T14:00:00Z',
  verificationNotes: 'Telah dilakukan verifikasi teknis kerusakan tingkat sedang pada struktur los pasar dan kios rakyat.',
  googleSheetSynced: false,
  targetSheetName: 'Kec. Mauponggo',
  sourceSheet: 'Kec. Mauponggo',
  createdBy: 'user_super_admin',
  createdByName: 'Vancy Djogo',
  createdAt: '2026-09-16T09:00:00Z',
  updatedAt: '2026-09-16T14:00:00Z'
};
