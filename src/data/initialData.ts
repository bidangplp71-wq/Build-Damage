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
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1yZ7K8jN4XoP_ContohSheetGedungPUPR/edit',
  webhookUrl: 'https://script.google.com/macros/s/AKfycbx_ContohGoogleSheetScriptUrl_PUPR/exec',
  sheetName: 'Data_Penilaian_Kerusakan_PUPR',
  logSheetName: 'Log_Akses_Pengguna',
  autoSync: true,
  directSaveEnabled: true,
  lastTestedAt: '2026-08-25T10:00:00Z',
  lastTestStatus: 'success',
  lastTestMessage: 'Koneksi penyimpanan langsung ke Google Sheet aktif dan siap menerima data.',
};

// Seluruh data dummy kependudukan (Dukcapil) dikosongkan (Dimulai dari kondisi bersih)
export const INITIAL_DUKCAPIL: DukcapilRecord[] = [];
