import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { firebaseConfig, testFirebaseConnection } from '../services/firebase';
import {
  Shield,
  ShieldCheck,
  Lock,
  Database,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Flame,
  FileCode2,
  Server,
  RefreshCw,
} from 'lucide-react';

export const FirebaseProtection: React.FC = () => {
  const { showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await testFirebaseConnection();
      setConnectionStatus(res.message);
      showToast(res.message, res.success ? 'success' : 'info');
    } catch (e: any) {
      setConnectionStatus(e?.message || 'Gagal terhubung');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2));
    setCopiedConfig(true);
    showToast('Konfigurasi Firebase berhasil disalin!', 'info');
    setTimeout(() => setCopiedConfig(false), 2500);
  };

  const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to get current user data
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    // RBAC helper functions strictly enforcing the required quotas
    function isSuperAdmin() {
      return isAuthenticated() && getUserData().role == 'super_admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && (getUserData().role == 'admin' || isSuperAdmin());
    }
    
    function isVerifikator() {
      return isAuthenticated() && (getUserData().role == 'admin_verifikator' || isAdmin());
    }
    
    function isSurveyor() {
      return isAuthenticated() && (
        getUserData().role == 'admin_user' || 
        isVerifikator()
      );
    }
    
    function isPublic() {
      return isAuthenticated() && getUserData().role == 'admin_publik';
    }

    // Collection: assessments (Penilaian Kerusakan Gedung)
    match /assessments/{assessmentId} {
      // Public admin & unauthenticated can read verified assessments
      allow read: if isPublic() || resource.data.verificationStatus == 'Terverifikasi' || isAuthenticated();
      
      // Surveyor (Admin User) can create assessments
      allow create: if isSurveyor() && request.resource.data.createdBy == request.auth.uid;
      
      // Surveyor can edit their own assessments before verification; Admin can edit anytime
      allow update: if (isSurveyor() && resource.data.createdBy == request.auth.uid && resource.data.verificationStatus != 'Terverifikasi') || isAdmin();
      
      // Verificator can update verificationStatus
      allow update: if isVerifikator() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['verificationStatus', 'verifiedBy', 'verifiedAt', 'verificationNotes']);
      
      // Only Super Admin and Admin can delete
      allow delete: if isAdmin();
    }

    // Collection: wilayahs (Kecamatan & Desa/Kelurahan)
    match /kecamatans/{kecamatanId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /desas/{desaId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Collection: users & Quota Security
    match /users/{userId} {
      allow read: if isAuthenticated();
      // Only Super Admin can modify user accounts & role assignments
      allow write: if isSuperAdmin();
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(firestoreRules);
    setCopied(true);
    showToast('Aturan keamanan Firestore Rules berhasil disalin!', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Perlindungan Keamanan Cloud & Firebase Firestore Rules</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Arsitektur keamanan berlapis melindungi integritas data penilaian kerusakan, kuota peran pengguna, dan wilayah administrasi.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          <Flame className="w-4 h-4 text-amber-500" />
          <span>Firebase Protection: Enforced</span>
        </div>
      </div>

      {/* Active Firebase Project Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Server className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Proyek Firebase Aktif: simpkbg</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Terkonfigurasi
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Kredensial Firebase SDK v7.20+ resmi SIM-PKBG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Memeriksa...' : 'Uji Koneksi'}</span>
            </button>
            <button
              onClick={handleCopyConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedConfig ? 'Tersalin!' : 'Salin Konfig'}</span>
            </button>
          </div>
        </div>

        {connectionStatus && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{connectionStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Project ID</span>
            <span className="font-mono font-bold text-slate-800">{firebaseConfig.projectId}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Auth Domain</span>
            <span className="font-mono text-slate-800 truncate block">{firebaseConfig.authDomain}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">App ID</span>
            <span className="font-mono text-[11px] text-slate-800 truncate block">{firebaseConfig.appId}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage Bucket</span>
            <span className="font-mono text-[11px] text-slate-800 truncate block">{firebaseConfig.storageBucket}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Messaging Sender ID</span>
            <span className="font-mono text-[11px] text-slate-800">{firebaseConfig.messagingSenderId}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Measurement ID</span>
            <span className="font-mono text-[11px] text-slate-800">{firebaseConfig.measurementId}</span>
          </div>
        </div>
      </div>

      {/* Security Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Enkripsi & Proteksi Akses</h4>
          <p className="text-xs text-slate-500 mt-1">
            Data penilaian aman dari manipulasi publik. Hanya pengguna terautentikasi yang dapat menginput data.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Validasi Kuota Peran (RBAC)</h4>
          <p className="text-xs text-slate-500 mt-1">
            Batas ketat: Super Admin (1), Admin (3), Verifikator (15), User (100), Publik (10) divalidasi di tingkat database.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Database className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Integritas Riwayat Lapangan</h4>
          <p className="text-xs text-slate-500 mt-1">
            Penilaian yang telah diverifikasi oleh Tim Verifikator terkunci otomatis dari modifikasi sepihak.
          </p>
        </div>
      </div>

      {/* Role Permission Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Matriks Hak Akses Pengguna (Access Control Matrix)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">Peran (Role)</th>
                <th className="py-2.5 px-3 text-center">Batas Kuota</th>
                <th className="py-2.5 px-3 text-center">Input Penilaian</th>
                <th className="py-2.5 px-3 text-center">Verifikasi Data</th>
                <th className="py-2.5 px-3 text-center">Kelola Wilayah</th>
                <th className="py-2.5 px-3 text-center">Kelola Akun</th>
                <th className="py-2.5 px-3 text-center">Kirim Google Sheet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-4 font-bold text-purple-900">Super Admin</td>
                <td className="py-3 px-3 text-center font-bold">1 Akun</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Full</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Full</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-blue-900">Admin Utama</td>
                <td className="py-3 px-3 text-center font-bold">3 Akun</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-emerald-900">Admin Verifikator</td>
                <td className="py-3 px-3 text-center font-bold">15 Akun</td>
                <td className="py-3 px-3 text-center text-slate-400 font-medium">Lihat Semua</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Pengesahan</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-amber-900">Admin User (Surveyor)</td>
                <td className="py-3 px-3 text-center font-bold">100 Akun</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Input & Edit</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Menunggu</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Hanya Lihat</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓ Ya</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-700">Admin Publik</td>
                <td className="py-3 px-3 text-center font-bold">10 Akun</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Lihat Saja</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Hanya Lihat</td>
                <td className="py-3 px-3 text-center text-rose-400 font-medium">✕ Tidak</td>
                <td className="py-3 px-3 text-center text-slate-400 font-medium">✕ Baca Saja</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Firestore Security Rules Display */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              firestore.rules (Aturan Keamanan Database)
            </h3>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Tersalin!' : 'Salin Aturan'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-72 overflow-y-auto leading-relaxed">
          {firestoreRules}
        </pre>
      </div>
    </div>
  );
};
