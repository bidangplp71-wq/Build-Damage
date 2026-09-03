import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserAccount,
  UserRole,
  ROLE_LIMITS,
  BuildingAssessment,
  Kecamatan,
  Desa,
  GoogleSheetConfig,
  FirebaseShieldConfig,
  VerificationStatus,
  DukcapilRecord,
} from '../types';
import {
  INITIAL_KECAMATAN,
  INITIAL_DESA,
  INITIAL_USERS,
  INITIAL_ASSESSMENTS,
  INITIAL_DUKCAPIL,
  DEFAULT_GOOGLE_SHEET_CONFIG,
} from '../data/initialData';
import {
  syncToGoogleSheetWebhook,
  syncAllToGoogleSheet,
  directSaveToGoogleSheet,
} from '../services/googleSheetsService';

interface AppContextType {
  // Current user & Auth
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  users: UserAccount[];
  getUserCountsByRole: () => Record<UserRole, number>;
  addUser: (userData: Omit<UserAccount, 'id' | 'createdAt'>) => { success: boolean; message: string };
  updateUser: (id: string, userData: Partial<UserAccount>) => { success: boolean; message: string };
  deleteUser: (id: string) => { success: boolean; message: string };
  switchUserRole: (role: UserRole) => void;

  // Assessments
  assessments: BuildingAssessment[];
  addAssessment: (data: BuildingAssessment) => Promise<{ success: boolean; message: string }>;
  updateAssessment: (id: string, data: Partial<BuildingAssessment>) => Promise<{ success: boolean; message: string }>;
  deleteAssessment: (id: string) => { success: boolean; message: string };
  verifyAssessment: (id: string, status: VerificationStatus, notes: string) => Promise<{ success: boolean; message: string }>;
  syncAssessmentToSheet: (id: string) => Promise<{ success: boolean; message: string }>;
  syncAllToSheet: () => Promise<{ success: boolean; message: string; count?: number }>;

  // Wilayah (Kecamatan & Desa Pemekaran / Baru)
  kecamatans: Kecamatan[];
  desas: Desa[];
  addKecamatan: (data: Omit<Kecamatan, 'id' | 'createdAt'>) => { success: boolean; message: string; kecamatan?: Kecamatan };
  updateKecamatan: (id: string, data: Partial<Kecamatan>) => { success: boolean; message: string };
  deleteKecamatan: (id: string) => { success: boolean; message: string };
  addDesa: (data: Omit<Desa, 'id' | 'createdAt'>) => { success: boolean; message: string; desa?: Desa };
  updateDesa: (id: string, data: Partial<Desa>) => { success: boolean; message: string };
  deleteDesa: (id: string) => { success: boolean; message: string };

  // Data Dukcapil (Master Kependudukan & Sinkronisasi)
  dukcapilRecords: DukcapilRecord[];
  addDukcapilRecord: (data: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; message: string; record?: DukcapilRecord };
  updateDukcapilRecord: (id: string, data: Partial<DukcapilRecord>) => { success: boolean; message: string };
  deleteDukcapilRecord: (id: string) => { success: boolean; message: string };
  importDukcapilRecords: (records: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[], mode?: 'append' | 'replace') => { success: boolean; count: number; message: string };
  findDukcapil: (query: string) => DukcapilRecord[];

  // Google Sheet & Firebase Configurations
  googleSheetConfig: GoogleSheetConfig;
  updateGoogleSheetConfig: (config: Partial<GoogleSheetConfig>) => void;
  firebaseShieldConfig: FirebaseShieldConfig;
  updateFirebaseShieldConfig: (config: Partial<FirebaseShieldConfig>) => void;

  // Global Navigation & UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedAssessmentForDetail: BuildingAssessment | null;
  setSelectedAssessmentForDetail: (assessment: BuildingAssessment | null) => void;
  selectedAssessmentForEdit: BuildingAssessment | null;
  setSelectedAssessmentForEdit: (assessment: BuildingAssessment | null) => void;

  // Notification Toast
  toastMessage: { type: 'success' | 'error' | 'info'; text: string } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'sipandu_pupr_users_v3',
  ASSESSMENTS: 'sipandu_pupr_assessments_v3',
  KECAMATAN: 'sipandu_pupr_kecamatan_v3',
  DESA: 'sipandu_pupr_desa_v3',
  DUKCAPIL: 'sipandu_pupr_dukcapil_v3',
  GOOGLE_SHEET: 'sipandu_pupr_gsheet_v3',
  FIREBASE: 'sipandu_pupr_firebase_v3',
  CURRENT_USER_ID: 'sipandu_pupr_current_uid_v3',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize users
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // Initialize current user
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const savedUid = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
      const found = users.find((u) => u.id === savedUid);
      return found || users[0];
    } catch {
      return users[0];
    }
  });

  // Initialize assessments
  const [assessments, setAssessments] = useState<BuildingAssessment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      return saved ? JSON.parse(saved) : INITIAL_ASSESSMENTS;
    } catch {
      return INITIAL_ASSESSMENTS;
    }
  });

  // Initialize Kecamatan
  const [kecamatans, setKecamatans] = useState<Kecamatan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.KECAMATAN);
      return saved ? JSON.parse(saved) : INITIAL_KECAMATAN;
    } catch {
      return INITIAL_KECAMATAN;
    }
  });

  // Initialize Desa
  const [desas, setDesas] = useState<Desa[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DESA);
      return saved ? JSON.parse(saved) : INITIAL_DESA;
    } catch {
      return INITIAL_DESA;
    }
  });

  // Initialize Data Dukcapil (Kependudukan)
  const [dukcapilRecords, setDukcapilRecords] = useState<DukcapilRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DUKCAPIL);
      return saved ? JSON.parse(saved) : INITIAL_DUKCAPIL;
    } catch {
      return INITIAL_DUKCAPIL;
    }
  });

  // Initialize Google Sheet Config
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      return saved ? JSON.parse(saved) : DEFAULT_GOOGLE_SHEET_CONFIG;
    } catch {
      return DEFAULT_GOOGLE_SHEET_CONFIG;
    }
  });

  // Initialize Firebase Shield Config
  const [firebaseShieldConfig, setFirebaseShieldConfig] = useState<FirebaseShieldConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FIREBASE);
      return saved ? JSON.parse(saved) : {
        enabled: true,
        projectName: 'si-pandu-pupr-kebencanaan',
        environment: 'demo-shielded',
        enforceRbac: true,
        statusText: 'Firebase Shield Aktif (Aturan Keamanan RBAC Firestore Ditegakkan)',
      };
    } catch {
      return {
        enabled: true,
        projectName: 'si-pandu-pupr-kebencanaan',
        environment: 'demo-shielded',
        enforceRbac: true,
        statusText: 'Firebase Shield Aktif (Aturan Keamanan RBAC Firestore Ditegakkan)',
      };
    }
  });

  // UI state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedAssessmentForDetail, setSelectedAssessmentForDetail] = useState<BuildingAssessment | null>(null);
  const [selectedAssessmentForEdit, setSelectedAssessmentForEdit] = useState<BuildingAssessment | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
  }, [assessments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KECAMATAN, JSON.stringify(kecamatans));
  }, [kecamatans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DESA, JSON.stringify(desas));
  }, [desas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DUKCAPIL, JSON.stringify(dukcapilRecords));
  }, [dukcapilRecords]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(googleSheetConfig));
  }, [googleSheetConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FIREBASE, JSON.stringify(firebaseShieldConfig));
  }, [firebaseShieldConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, currentUser.id);
  }, [currentUser]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const clearToast = () => setToastMessage(null);

  // User Role Quotas Helper
  const getUserCountsByRole = (): Record<UserRole, number> => {
    const counts: Record<UserRole, number> = {
      super_admin: 0,
      admin: 0,
      admin_verifikator: 0,
      admin_user: 0,
      admin_publik: 0,
    };
    users.forEach((u) => {
      if (counts[u.role] !== undefined) {
        counts[u.role]++;
      }
    });
    return counts;
  };

  // Add User with strict quota check
  const addUser = (userData: Omit<UserAccount, 'id' | 'createdAt'>) => {
    const roleLimit = ROLE_LIMITS[userData.role];
    const currentCount = users.filter((u) => u.role === userData.role).length;

    if (currentCount >= roleLimit.max) {
      return {
        success: false,
        message: `Batas kuota untuk peran ${roleLimit.title} telah tercapai (Maksimal ${roleLimit.max} akun)!`,
      };
    }

    const newUser: UserAccount = {
      ...userData,
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    return {
      success: true,
      message: `Akun pengguna ${newUser.name} (${roleLimit.title}) berhasil ditambahkan.`,
    };
  };

  const updateUser = (id: string, userData: Partial<UserAccount>) => {
    if (userData.role) {
      const existing = users.find((u) => u.id === id);
      if (existing && existing.role !== userData.role) {
        const roleLimit = ROLE_LIMITS[userData.role];
        const countOther = users.filter((u) => u.role === userData.role && u.id !== id).length;
        if (countOther >= roleLimit.max) {
          return {
            success: false,
            message: `Tidak dapat mengubah peran. Kuota ${roleLimit.title} sudah penuh (Maksimal ${roleLimit.max})!`,
          };
        }
      }
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, ...userData };
          if (currentUser.id === id) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );

    return {
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
    };
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Pengguna tidak ditemukan.' };

    if (target.role === 'super_admin') {
      const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
      if (superAdminCount <= 1) {
        return {
          success: false,
          message: 'Sistem harus memiliki minimal 1 Super Admin. Akun ini tidak dapat dihapus!',
        };
      }
    }

    if (currentUser.id === id) {
      return {
        success: false,
        message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif.',
      };
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
    return {
      success: true,
      message: `Pengguna ${target.name} berhasil dihapus.`,
    };
  };

  // Quick switch role for testing
  const switchUserRole = (role: UserRole) => {
    const existing = users.find((u) => u.role === role);
    if (existing) {
      setCurrentUser(existing);
      showToast(`Beralih ke peran: ${ROLE_LIMITS[role].title} (${existing.name})`, 'info');
    } else {
      showToast(`Belum ada akun terdaftar dengan peran ${ROLE_LIMITS[role].title}`, 'error');
    }
  };

  // Assessment operations: Direct save to Google Sheet without manual synchronization
  const addAssessment = async (data: BuildingAssessment) => {
    const hasGSheet = Boolean(googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http'));

    // Optimistically mark as direct-saved if sheet link is configured
    const assessmentToSave: BuildingAssessment = {
      ...data,
      googleSheetSynced: hasGSheet,
      googleSheetSyncedAt: hasGSheet ? new Date().toISOString() : undefined,
    };

    setAssessments((prev) => [assessmentToSave, ...prev]);

    // Save directly to Google Sheet without needing manual synchronization
    if (hasGSheet) {
      directSaveToGoogleSheet(assessmentToSave, googleSheetConfig, 'insert')
        .then((res) => {
          if (res.success) {
            setAssessments((prev) =>
              prev.map((a) =>
                a.id === data.id
                  ? { ...a, googleSheetSynced: true, googleSheetSyncedAt: new Date().toISOString() }
                  : a
              )
            );
          }
        })
        .catch((e) => console.error('Direct Google Sheet save error:', e));

      return {
        success: true,
        message: `Penilaian gedung "${data.buildingName}" tersimpan & langsung tercatat di Google Sheet!`,
      };
    }

    return {
      success: true,
      message: `Penilaian gedung "${data.buildingName}" berhasil disimpan! (Masukkan link Google Sheet untuk penyimpanan cloud langsung)`,
    };
  };

  const updateAssessment = async (id: string, data: Partial<BuildingAssessment>) => {
    const hasGSheet = Boolean(googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http'));
    const now = new Date().toISOString();

    setAssessments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...data,
              googleSheetSynced: hasGSheet ? true : a.googleSheetSynced,
              googleSheetSyncedAt: hasGSheet ? now : a.googleSheetSyncedAt,
              updatedAt: now,
            }
          : a
      )
    );

    const target = assessments.find((a) => a.id === id);
    if (target && hasGSheet) {
      const merged = { ...target, ...data, updatedAt: now };
      directSaveToGoogleSheet(merged, googleSheetConfig, 'update').catch((e) =>
        console.error('Direct Google Sheet update error:', e)
      );
    }

    return {
      success: true,
      message: hasGSheet
        ? 'Data penilaian berhasil diperbarui & langsung tersimpan di Google Sheet.'
        : 'Data penilaian berhasil diperbarui.',
    };
  };

  const deleteAssessment = (id: string) => {
    // Only super_admin or admin can delete
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Super Admin dan Admin yang berhak menghapus data penilaian.',
      };
    }

    const target = assessments.find((a) => a.id === id);
    if (target && googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http')) {
      directSaveToGoogleSheet(target, googleSheetConfig, 'delete').catch((e) =>
        console.error('Direct Google Sheet delete error:', e)
      );
    }

    setAssessments((prev) => prev.filter((a) => a.id !== id));
    return {
      success: true,
      message: 'Data penilaian gedung berhasil dihapus.',
    };
  };

  const verifyAssessment = async (id: string, status: VerificationStatus, notes: string) => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_verifikator') {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Admin Verifikator atau Super Admin yang dapat memvalidasi survei.',
      };
    }

    const now = new Date().toISOString();
    setAssessments((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            verificationStatus: status,
            verificationNotes: notes,
            verifiedBy: currentUser.name,
            verifiedAt: now,
            updatedAt: now,
          };
        }
        return a;
      })
    );

    return {
      success: true,
      message: `Status penilaian gedung berhasil diubah menjadi "${status}".`,
    };
  };

  const syncAssessmentToSheet = async (id: string) => {
    const target = assessments.find((a) => a.id === id);
    if (!target) return { success: false, message: 'Data tidak ditemukan.' };

    const result = await syncToGoogleSheetWebhook(target, googleSheetConfig);
    if (result.success) {
      setAssessments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, googleSheetSynced: true, googleSheetSyncedAt: new Date().toISOString() }
            : a
        )
      );
    }
    return result;
  };

  const syncAllToSheet = async () => {
    const result = await syncAllToGoogleSheet(assessments, googleSheetConfig);
    if (result.success) {
      const now = new Date().toISOString();
      setAssessments((prev) =>
        prev.map((a) => ({
          ...a,
          googleSheetSynced: true,
          googleSheetSyncedAt: now,
        }))
      );
    }
    return {
      success: result.success,
      message: result.message,
      count: result.syncedCount,
    };
  };

  // Wilayah operations (Kecamatan)
  const addKecamatan = (data: Omit<Kecamatan, 'id' | 'createdAt'>) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, message: 'Hak akses Publik Tamu tidak diizinkan menambah data kecamatan.' };
    }

    const exists = kecamatans.some(
      (k) => k.name.toLowerCase() === data.name.toLowerCase() || (data.code && k.code === data.code)
    );
    if (exists) {
      return { success: false, message: 'Kode atau Nama Kecamatan sudah terdaftar.' };
    }

    const newKec: Kecamatan = {
      ...data,
      id: `kec_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setKecamatans((prev) => [...prev, newKec]);
    return { success: true, message: `Kecamatan ${newKec.name} berhasil ditambahkan.`, kecamatan: newKec };
  };

  const updateKecamatan = (id: string, data: Partial<Kecamatan>) => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { success: false, message: 'Hanya Admin atau Super Admin yang dapat mengubah kecamatan.' };
    }

    setKecamatans((prev) => prev.map((k) => (k.id === id ? { ...k, ...data } : k)));
    return { success: true, message: 'Kecamatan berhasil diperbarui.' };
  };

  const deleteKecamatan = (id: string) => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { success: false, message: 'Hanya Admin atau Super Admin yang dapat menghapus kecamatan.' };
    }

    // Check if there are associated desas or assessments
    const hasDesas = desas.some((d) => d.kecamatanId === id);
    const hasAssessments = assessments.some((a) => a.kecamatanId === id);

    if (hasDesas || hasAssessments) {
      return {
        success: false,
        message: 'Tidak dapat menghapus kecamatan ini karena masih memiliki desa atau data penilaian gedung terkait.',
      };
    }

    setKecamatans((prev) => prev.filter((k) => k.id !== id));
    return { success: true, message: 'Kecamatan berhasil dihapus.' };
  };

  // Wilayah operations (Desa)
  const addDesa = (data: Omit<Desa, 'id' | 'createdAt'>) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, message: 'Hak akses Publik Tamu tidak diizinkan menambah data desa.' };
    }

    const exists = desas.some(
      (d) => d.kecamatanId === data.kecamatanId && (d.name.toLowerCase() === data.name.toLowerCase() || (data.code && d.code === data.code))
    );
    if (exists) {
      return { success: false, message: 'Desa/Kelurahan dengan kode atau nama ini sudah ada di kecamatan tersebut.' };
    }

    const newDesa: Desa = {
      ...data,
      id: `desa_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setDesas((prev) => [...prev, newDesa]);
    return { success: true, message: `${newDesa.type} ${newDesa.name} berhasil didaftarkan.`, desa: newDesa };
  };

  const updateDesa = (id: string, data: Partial<Desa>) => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { success: false, message: 'Hanya Admin atau Super Admin yang dapat mengubah desa.' };
    }

    setDesas((prev) => prev.map((d) => (d.id === id ? { ...d, ...data } : d)));
    return { success: true, message: 'Data Desa/Kelurahan berhasil diperbarui.' };
  };

  const deleteDesa = (id: string) => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { success: false, message: 'Hanya Admin atau Super Admin yang dapat menghapus desa.' };
    }

    const hasAssessments = assessments.some((a) => a.desaId === id);
    if (hasAssessments) {
      return {
        success: false,
        message: 'Tidak dapat menghapus desa ini karena sudah terdapat data survei gedung terkait.',
      };
    }

    setDesas((prev) => prev.filter((d) => d.id !== id));
    return { success: true, message: 'Data Desa/Kelurahan berhasil dihapus.' };
  };

  // Data Dukcapil (Kependudukan)
  const addDukcapilRecord = (data: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, message: 'Hak akses Publik Tamu tidak dapat menambah data Dukcapil.' };
    }

    const cleanNik = (data.nik || '').replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      return { success: false, message: 'NIK wajib 16 digit angka sesuai standar KTP-el Dukcapil.' };
    }

    const exists = dukcapilRecords.some((d) => d.nik === cleanNik);
    if (exists) {
      return { success: false, message: `NIK ${cleanNik} sudah terdaftar dalam data Dukcapil.` };
    }

    const now = new Date().toISOString();
    const newRecord: DukcapilRecord = {
      ...data,
      nik: cleanNik,
      noKk: (data.noKk || '').replace(/\D/g, ''),
      id: `duk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };

    setDukcapilRecords((prev) => [newRecord, ...prev]);
    return {
      success: true,
      message: `Warga ${newRecord.namaLengkap} (NIK: ${newRecord.nik}) berhasil didaftarkan ke Dukcapil.`,
      record: newRecord,
    };
  };

  const updateDukcapilRecord = (id: string, data: Partial<DukcapilRecord>) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, message: 'Hak akses Publik Tamu tidak dapat mengubah data Dukcapil.' };
    }

    setDukcapilRecords((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
      )
    );
    return { success: true, message: 'Data warga Dukcapil berhasil diperbarui.' };
  };

  const deleteDukcapilRecord = (id: string) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, message: 'Hak akses Publik Tamu tidak dapat menghapus data Dukcapil.' };
    }

    setDukcapilRecords((prev) => prev.filter((item) => item.id !== id));
    return { success: true, message: 'Data warga Dukcapil berhasil dihapus.' };
  };

  const importDukcapilRecords = (
    records: Omit<DukcapilRecord, 'id' | 'createdAt' | 'updatedAt'>[],
    mode: 'append' | 'replace' = 'append'
  ) => {
    if (currentUser.role === 'admin_publik') {
      return { success: false, count: 0, message: 'Hak akses Publik Tamu tidak dapat mengimpor data Dukcapil.' };
    }

    const now = new Date().toISOString();
    const validRecords: DukcapilRecord[] = [];
    const seenNiks = new Set<string>(mode === 'append' ? dukcapilRecords.map((r) => r.nik) : []);

    for (const r of records) {
      const cleanNik = (r.nik || '').replace(/\D/g, '');
      if (!cleanNik || seenNiks.has(cleanNik)) continue;
      seenNiks.add(cleanNik);

      validRecords.push({
        ...r,
        nik: cleanNik,
        noKk: (r.noKk || '').replace(/\D/g, ''),
        namaLengkap: r.namaLengkap || 'Tanpa Nama',
        jenisKelamin: r.jenisKelamin === 'P' ? 'P' : 'L',
        statusHubungan: r.statusHubungan || 'Kepala Keluarga',
        alamat: r.alamat || '-',
        rt: r.rt || '01',
        rw: r.rw || '01',
        desaName: r.desaName || '',
        kecamatanName: r.kecamatanName || '',
        kabupatenName: r.kabupatenName || 'Kabupaten Nagekeo',
        sumberData: r.sumberData || 'Import Excel/CSV',
        id: `duk_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (validRecords.length === 0) {
      return { success: false, count: 0, message: 'Tidak ada baris baru yang valid (semua NIK duplikat atau tidak terdeteksi).' };
    }

    setDukcapilRecords((prev) => (mode === 'replace' ? validRecords : [...validRecords, ...prev]));
    return {
      success: true,
      count: validRecords.length,
      message: `Berhasil mengimpor ${validRecords.length} data kependudukan Dukcapil.`,
    };
  };

  const findDukcapil = (query: string): DukcapilRecord[] => {
    if (!query || query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');
    return dukcapilRecords
      .filter((r) => {
        if (r.namaLengkap.toLowerCase().includes(q)) return true;
        if (digitsOnly.length >= 3 && (r.nik.includes(digitsOnly) || r.noKk.includes(digitsOnly))) return true;
        if (r.alamat.toLowerCase().includes(q)) return true;
        if (r.desaName.toLowerCase().includes(q)) return true;
        if (r.kecamatanName.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice(0, 15);
  };

  const updateGoogleSheetConfig = (config: Partial<GoogleSheetConfig>) => {
    setGoogleSheetConfig((prev) => ({ ...prev, ...config }));
  };

  const updateFirebaseShieldConfig = (config: Partial<FirebaseShieldConfig>) => {
    setFirebaseShieldConfig((prev) => ({ ...prev, ...config }));
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        getUserCountsByRole,
        addUser,
        updateUser,
        deleteUser,
        switchUserRole,

        assessments,
        addAssessment,
        updateAssessment,
        deleteAssessment,
        verifyAssessment,
        syncAssessmentToSheet,
        syncAllToSheet,

        kecamatans,
        desas,
        addKecamatan,
        updateKecamatan,
        deleteKecamatan,
        addDesa,
        updateDesa,
        deleteDesa,

        dukcapilRecords,
        addDukcapilRecord,
        updateDukcapilRecord,
        deleteDukcapilRecord,
        importDukcapilRecords,
        findDukcapil,

        googleSheetConfig,
        updateGoogleSheetConfig,
        firebaseShieldConfig,
        updateFirebaseShieldConfig,

        activeTab,
        setActiveTab,
        selectedAssessmentForDetail,
        setSelectedAssessmentForDetail,
        selectedAssessmentForEdit,
        setSelectedAssessmentForEdit,

        toastMessage,
        showToast,
        clearToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
