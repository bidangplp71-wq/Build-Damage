import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserAccount,
  UserRole,
  ROLE_LIMITS,
  ROLE_NAV_CONFIGS,
  BuildingAssessment,
  Kecamatan,
  Desa,
  GoogleSheetConfig,
  FirebaseShieldConfig,
  VerificationStatus,
  DukcapilRecord,
  UserActivityLog,
  ActivityActionType,
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
  syncActivityLogsToGoogleSheet,
  directSaveActivityLogToGoogleSheet,
} from '../services/googleSheetsService';
import {
  encryptPassword,
  verifyPassword,
  canManageUserPassword,
  canViewUserPassword,
} from '../utils/security';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';

interface AppContextType {
  // Current user & Auth
  isLoggedIn: boolean;
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount) => void;
  users: UserAccount[];
  getUserCountsByRole: () => Record<UserRole, number>;
  addUser: (userData: Omit<UserAccount, 'id' | 'createdAt'> & { plainPassword?: string }) => { success: boolean; message: string };
  updateUser: (id: string, userData: Partial<UserAccount> & { plainPassword?: string }) => { success: boolean; message: string };
  updateUserPassword: (targetUserId: string, newPlainPassword: string) => { success: boolean; message: string };
  loginWithPassword: (user: UserAccount, passwordInput: string) => { success: boolean; message: string };
  loginByEmailPassword: (emailInput: string, passwordInput: string) => { success: boolean; message: string };
  loginByNamePassword: (nameInput: string, passwordInput: string) => { success: boolean; message: string };
  logout: () => void;
  canCurrentUserManagePassword: (targetRole: UserRole) => boolean;
  canCurrentUserViewPassword: (targetRole: UserRole) => boolean;
  deleteUser: (id: string) => { success: boolean; message: string };
  switchUserRole: (role: UserRole) => void;

  // Session Inactivity Lock
  isSessionLocked: boolean;
  lockSession: () => void;
  unlockSession: (passwordInput: string) => { success: boolean; message: string };

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
  addKecamatan: (data: Omit<Kecamatan, 'id' | 'createdAt'>) => { success: boolean; message: string; kecamatan?: Kecamatan; data?: Kecamatan };
  updateKecamatan: (id: string, data: Partial<Kecamatan>) => { success: boolean; message: string };
  deleteKecamatan: (id: string) => { success: boolean; message: string };
  addDesa: (data: Omit<Desa, 'id' | 'createdAt'>) => { success: boolean; message: string; desa?: Desa; data?: Desa };
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

  // User Access & Activity Audit Trail Analytics
  activityLogs: UserActivityLog[];
  logUserActivity: (
    action: ActivityActionType,
    actionCategory: 'Autentikasi' | 'Penilaian Kerusakan' | 'Pencetakan & Dokumen' | 'Integrasi Google Sheet' | 'Sistem & Pengguna',
    actionDescription: string,
    targetResource?: string,
    details?: string
  ) => void;
  syncActivityLogsToSheet: () => Promise<{ success: boolean; message: string; count?: number }>;
  clearActivityLogs: () => void;

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
  AUTH: 'sipandu_pupr_auth_v3',
  USERS: 'sipandu_pupr_users_v3',
  ASSESSMENTS: 'sipandu_pupr_assessments_v3',
  KECAMATAN: 'sipandu_pupr_kecamatan_v3',
  DESA: 'sipandu_pupr_desa_v3',
  DUKCAPIL: 'sipandu_pupr_dukcapil_v3',
  GOOGLE_SHEET: 'sipandu_pupr_gsheet_v3',
  FIREBASE: 'sipandu_pupr_firebase_v3',
  ACTIVITY_LOGS: 'sipandu_pupr_activity_logs_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize users with guaranteed encrypted passwords
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!saved) return INITIAL_USERS;
      const parsed: UserAccount[] = JSON.parse(saved);
      // Ensure all users have valid encrypted passwords, especially Super Admin ('simpkbg2026')
      return parsed.map((u) => {
        if (u.role === 'super_admin' && (!u.password || u.password === '')) {
          return { ...u, password: encryptPassword('simpkbg2026') };
        }
        if (!u.password) {
          const init = INITIAL_USERS.find((initU) => initU.role === u.role);
          return { ...u, password: init?.password || encryptPassword(u.role + '2026') };
        }
        return u;
      });
    } catch {
      return INITIAL_USERS;
    }
  });

  // Initialize current user & persistent session
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        return parsed.isLoggedIn === true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        if (parsed.userId) {
          const found = users.find((u) => u.id === parsed.userId);
          if (found) return found;
        }
      }
    } catch {
      // ignore
    }
    return users[0] || INITIAL_USERS[0];
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

  // UI state initialized based on user role
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedAssessmentForDetail, setSelectedAssessmentForDetail] = useState<BuildingAssessment | null>(null);
  const [selectedAssessmentForEdit, setSelectedAssessmentForEdit] = useState<BuildingAssessment | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // User Activity & Access Logs (Audit Trail Analytics)
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
      if (saved) return JSON.parse(saved);
      return [
        {
          id: 'log_init_1',
          userId: 'user_super_admin',
          userName: 'Vancy Djogo',
          userEmail: 'bidangplp71@gmail.com',
          userRole: 'super_admin',
          roleTitle: 'Super Admin',
          action: 'LOGIN',
          actionCategory: 'Autentikasi',
          actionDescription: 'Autentikasi login berhasil ke sistem',
          details: 'Login dengan otoritas penuh Super Administrator',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          ipAddress: '127.0.0.1 (Web Preview)',
        },
        {
          id: 'log_init_2',
          userId: 'user_super_admin',
          userName: 'Vancy Djogo',
          userEmail: 'bidangplp71@gmail.com',
          userRole: 'super_admin',
          roleTitle: 'Super Admin',
          action: 'VIEW_ASSESSMENT',
          actionCategory: 'Penilaian Kerusakan',
          actionDescription: 'Membuka pratinjau dan analisis teknis kerusakan gedung',
          targetResource: 'Modul Penilaian PUPR',
          details: 'Pemeriksaan standar formulir Permen PUPR No. 22/PRT/M/2018',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          ipAddress: '127.0.0.1 (Web Preview)',
        },
      ];
    } catch {
      return [];
    }
  });

  // Sync to local storage

  const isInitialLoad = React.useRef(true);
  
  // Load from Firebase ONCE on mount
  useEffect(() => {
    if (!db) {
      isInitialLoad.current = false;
      return;
    }
    
    Promise.allSettled([
      getDocs(collection(db, 'users')).then((snapshot) => {
        if (!snapshot.empty) {
          setUsers(snapshot.docs.map((d) => d.data() as UserAccount));
        } else {
          // If empty, seed with INITIAL_USERS
          INITIAL_USERS.forEach((u) => {
            const cleanU = JSON.parse(JSON.stringify(u));
            setDoc(doc(db, 'users', cleanU.id), cleanU).catch(() => {});
          });
        }
      }).catch((err) => {
        console.warn('Firebase users fetch offline/deferred:', err?.message || err);
      }),

      getDocs(collection(db, 'assessments')).then((snapshot) => {
        if (!snapshot.empty) {
          setAssessments(snapshot.docs.map((d) => d.data() as BuildingAssessment));
        } else {
          INITIAL_ASSESSMENTS.forEach((a) => {
            const cleanA = JSON.parse(JSON.stringify(a));
            setDoc(doc(db, 'assessments', cleanA.id), cleanA).catch(() => {});
          });
        }
      }).catch((err) => {
        console.warn('Firebase assessments fetch offline/deferred:', err?.message || err);
      }),

      getDocs(collection(db, 'activity_logs')).then((snapshot) => {
        if (!snapshot.empty) {
          const remoteLogs = snapshot.docs.map((d) => d.data() as UserActivityLog);
          remoteLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivityLogs(remoteLogs);
        }
      }).catch((err) => {
        console.warn('Firebase activity logs fetch offline/deferred:', err?.message || err);
      }),
    ]).finally(() => {
      // Mark initial load finished after initial checks have settled
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(activityLogs));
    } catch (e) {
      console.warn('LocalStorage activity logs save notice:', e);
    }
  }, [activityLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('LocalStorage users save notice:', e);
    }
    if (db && !isInitialLoad.current) {
      users.forEach((user) => {
        const cleanUser = JSON.parse(JSON.stringify(user));
        setDoc(doc(db, 'users', cleanUser.id), cleanUser).catch(() => {});
      });
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
    } catch (e) {
      console.warn('LocalStorage assessments save exceeded quota, saving lightweight references:', e);
      try {
        // Fallback: strip heavy base64 strings if local storage quota exceeded
        const lightweight = assessments.map((a) => ({
          ...a,
          photos: a.photos.map((p) => ({
            ...p,
            url: p.url && (p.url.startsWith('http') || p.url.length < 500) ? p.url : '',
          })),
        }));
        localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
      } catch (err2) {
        console.warn('LocalStorage secondary fallback notice:', err2);
      }
    }

    if (db && !isInitialLoad.current) {
      assessments.forEach((a) => {
        // Strip undefined fields for Firebase
        const cleanA = JSON.parse(JSON.stringify(a));
        setDoc(doc(db, 'assessments', cleanA.id), cleanA).catch(() => {});
      });
    }
  }, [assessments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.KECAMATAN, JSON.stringify(kecamatans));
    } catch (e) {
      console.warn('LocalStorage kecamatan save notice:', e);
    }
  }, [kecamatans]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DESA, JSON.stringify(desas));
    } catch (e) {
      console.warn('LocalStorage desa save notice:', e);
    }
  }, [desas]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DUKCAPIL, JSON.stringify(dukcapilRecords));
    } catch (e) {
      console.warn('LocalStorage dukcapil save notice:', e);
    }
  }, [dukcapilRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(googleSheetConfig));
    } catch (e) {
      console.warn('LocalStorage google sheet save notice:', e);
    }
  }, [googleSheetConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FIREBASE, JSON.stringify(firebaseShieldConfig));
    } catch (e) {
      console.warn('LocalStorage firebase save notice:', e);
    }
  }, [firebaseShieldConfig]);

  useEffect(() => {
    try {
      if (isLoggedIn && currentUser) {
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify({ isLoggedIn: true, userId: currentUser.id }));
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    } catch (e) {
      console.warn('LocalStorage auth save notice:', e);
    }
  }, [isLoggedIn, currentUser]);

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

  // Add User with strict quota check and password assignment
  const addUser = (userData: Omit<UserAccount, 'id' | 'createdAt'> & { plainPassword?: string }) => {
    // Admin cannot create Admin or Super Admin
    if (currentUser.role !== 'super_admin' && (userData.role === 'super_admin' || userData.role === 'admin')) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Super Administrator yang berhak membuat akun Admin atau Super Admin.',
      };
    }

    const roleLimit = ROLE_LIMITS[userData.role];
    const currentCount = users.filter((u) => u.role === userData.role).length;

    if (currentCount >= roleLimit.max) {
      return {
        success: false,
        message: `Batas kuota untuk peran ${roleLimit.title} telah tercapai (Maksimal ${roleLimit.max} akun)!`,
      };
    }

    // Determine password
    let passwordToStore: string;
    if (userData.plainPassword && userData.plainPassword.trim()) {
      passwordToStore = encryptPassword(userData.plainPassword.trim());
    } else if (userData.role === 'super_admin') {
      passwordToStore = encryptPassword('simpkbg2026');
    } else if (userData.role === 'admin') {
      passwordToStore = encryptPassword('adminpupr2026');
    } else {
      passwordToStore = encryptPassword(`${userData.role.replace('admin_', '')}2026`);
    }

    const { plainPassword, ...restData } = userData;

    const newUser: UserAccount = {
      ...restData,
      password: passwordToStore,
      passwordLastChanged: new Date().toISOString(),
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    return {
      success: true,
      message: `Akun pengguna ${newUser.name} (${roleLimit.title}) berhasil ditambahkan dengan kata sandi terenkripsi.`,
    };
  };

  const updateUser = (id: string, userData: Partial<UserAccount> & { plainPassword?: string }) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Pengguna tidak ditemukan.' };

    // Role modification permission
    if (userData.role && userData.role !== target.role) {
      if (currentUser.role !== 'super_admin') {
        return {
          success: false,
          message: 'Akses ditolak: Hanya Super Administrator yang berhak mengubah tingkatan peran akun.',
        };
      }
      const roleLimit = ROLE_LIMITS[userData.role];
      const countOther = users.filter((u) => u.role === userData.role && u.id !== id).length;
      if (countOther >= roleLimit.max) {
        return {
          success: false,
          message: `Tidak dapat mengubah peran. Kuota ${roleLimit.title} sudah penuh (Maksimal ${roleLimit.max})!`,
        };
      }
    }

    // Password modification permission
    if (userData.plainPassword && userData.plainPassword.trim()) {
      if (!canManageUserPassword(currentUser.role, target.role)) {
        return {
          success: false,
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah kata sandi akun peran ini.',
        };
      }
      userData.password = encryptPassword(userData.plainPassword.trim());
      userData.passwordLastChanged = new Date().toISOString();
    }

    const { plainPassword, ...restData } = userData;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, ...restData };
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
      message: 'Data pengguna dan keamanan akun berhasil diperbarui.',
    };
  };

  // Dedicated Password Update Method
  const updateUserPassword = (targetUserId: string, newPlainPassword: string) => {
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return { success: false, message: 'Pengguna tidak ditemukan.' };

    if (!canManageUserPassword(currentUser.role, target.role)) {
      return {
        success: false,
        message: 'Akses ditolak: Kata sandi Admin/Super Admin hanya dapat diubah oleh Super Administrator.',
      };
    }

    if (!newPlainPassword || newPlainPassword.trim().length < 4) {
      return { success: false, message: 'Kata sandi minimal 4 karakter.' };
    }

    const encrypted = encryptPassword(newPlainPassword.trim());
    const now = new Date().toISOString();

    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, password: encrypted, passwordLastChanged: now } : u))
    );

    if (currentUser.id === targetUserId) {
      setCurrentUser((prev) => ({ ...prev, password: encrypted, passwordLastChanged: now }));
    }

    return {
      success: true,
      message: `Kata sandi untuk ${target.name} (${ROLE_LIMITS[target.role].title}) berhasil diperbarui dan dienkripsi.`,
    };
  };

  // User Activity & Access Logger (Analytics & Audit Trail)
  const logUserActivity = (
    action: ActivityActionType,
    actionCategory: 'Autentikasi' | 'Penilaian Kerusakan' | 'Pencetakan & Dokumen' | 'Integrasi Google Sheet' | 'Sistem & Pengguna',
    actionDescription: string,
    targetResource?: string,
    details?: string
  ) => {
    const activeUser = currentUser || users[0];
    const newLog: UserActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: activeUser?.id || 'guest',
      userName: activeUser?.name || 'Pengguna',
      userEmail: activeUser?.email || '-',
      userRole: activeUser?.role || 'admin_publik',
      roleTitle: ROLE_LIMITS[activeUser?.role || 'admin_publik']?.title || 'Pengguna',
      action,
      actionCategory,
      actionDescription,
      targetResource,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1 (Web Preview)',
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : undefined,
    };

    setActivityLogs((prev) => [newLog, ...prev.slice(0, 499)]);

    if (db) {
      const cleanLog = JSON.parse(JSON.stringify(newLog));
      setDoc(doc(db, 'activity_logs', cleanLog.id), cleanLog).catch(() => {});
    }

    if (googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http') && googleSheetConfig.directSaveEnabled) {
      directSaveActivityLogToGoogleSheet(newLog, googleSheetConfig).catch(console.error);
    }
  };

  const syncActivityLogsToSheet = async () => {
    const res = await syncActivityLogsToGoogleSheet(activityLogs, googleSheetConfig);
    if (res.success) {
      showToast(res.message, 'success');
      logUserActivity(
        'SYNC_GOOGLE_SHEET',
        'Integrasi Google Sheet',
        `Sinkronisasi ${res.count} Catatan Log Akses Pengguna ke Google Sheet`,
        `Tab: ${googleSheetConfig.logSheetName || 'Log_Akses_Pengguna'}`,
        'Tercatat di Google Spreadsheet'
      );
    } else {
      showToast(res.message, 'error');
    }
    return res;
  };

  const clearActivityLogs = () => {
    setActivityLogs([]);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
    showToast('Riwayat log aktivitas telah dibersihkan.', 'info');
  };

  // Authenticate user with password
  const loginWithPassword = (user: UserAccount, passwordInput: string) => {
    const isMatched = verifyPassword(passwordInput, user.password);
    if (!isMatched) {
      return {
        success: false,
        message: 'Kata sandi tidak sesuai! Silakan periksa kembali kata sandi yang Anda masukkan.',
      };
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    setIsSessionLocked(false);
    setSelectedAssessmentForEdit(null);
    const targetTab = ROLE_NAV_CONFIGS[user.role]?.defaultTab || 'dashboard';
    setActiveTab(targetTab);

    logUserActivity(
      'LOGIN',
      'Autentikasi',
      `Login Berhasil via Kredensial Peran: ${ROLE_LIMITS[user.role].title}`,
      user.name,
      `Email: ${user.email} (${ROLE_LIMITS[user.role].title})`
    );

    return {
      success: true,
      message: `Autentikasi berhasil. Selamat datang, ${user.name} (${ROLE_LIMITS[user.role].title})!`,
    };
  };

  const loginByEmailPassword = (emailInput: string, passwordInput: string) => {
    const email = emailInput.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === email);

    if (!user) {
      return {
        success: false,
        message: 'Email belum terdaftar di sistem. Akses ditolak!',
      };
    }

    const isMatched = verifyPassword(passwordInput, user.password);
    if (!isMatched) {
      return {
        success: false,
        message: 'Kata sandi tidak sesuai! Silakan periksa kembali.',
      };
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    setIsSessionLocked(false);
    setSelectedAssessmentForEdit(null);
    const targetTab = ROLE_NAV_CONFIGS[user.role]?.defaultTab || 'dashboard';
    setActiveTab(targetTab);

    logUserActivity(
      'LOGIN',
      'Autentikasi',
      `Login Berhasil via Email: ${user.email}`,
      user.name,
      `Peran: ${ROLE_LIMITS[user.role].title}`
    );

    return {
      success: true,
      message: `Autentikasi berhasil. Selamat datang, ${user.name} (${ROLE_LIMITS[user.role].title})!`,
    };
  };

  const loginByNamePassword = (nameInput: string, passwordInput: string) => {
    const query = nameInput.trim().toLowerCase();
    
    // First try exact match on email or name
    let user = users.find((u) => u.name.toLowerCase() === query || u.email.toLowerCase() === query);
    
    // If not found, try partial match on name
    if (!user) {
      user = users.find((u) => u.name.toLowerCase().includes(query));
    }

    if (!user) {
      return {
        success: false,
        message: 'Nama pengguna atau email belum terdaftar di sistem. Akses ditolak!',
      };
    }

    const isMatched = verifyPassword(passwordInput, user.password);
    if (!isMatched) {
      return {
        success: false,
        message: 'Kata sandi tidak sesuai! Silakan periksa kembali.',
      };
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    setIsSessionLocked(false);
    setSelectedAssessmentForEdit(null);
    const targetTab = ROLE_NAV_CONFIGS[user.role]?.defaultTab || 'dashboard';
    setActiveTab(targetTab);

    logUserActivity(
      'LOGIN',
      'Autentikasi',
      `Login Berhasil via Nama Pengguna: ${user.name}`,
      user.email,
      `Peran: ${ROLE_LIMITS[user.role].title}`
    );

    return {
      success: true,
      message: `Autentikasi berhasil. Selamat datang, ${user.name} (${ROLE_LIMITS[user.role].title})!`,
    };
  };

  const logout = () => {
    logUserActivity(
      'LOGOUT',
      'Autentikasi',
      `Pengguna Keluar (Logout) dari Sistem`,
      currentUser.name,
      `Peran: ${ROLE_LIMITS[currentUser.role]?.title || currentUser.role}`
    );
    setIsLoggedIn(false);
    showToast('Anda telah keluar dari sesi.', 'info');
  };

  // Session Inactivity Lock State & Methods (15 minutes standard timeout)
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  const lockSession = () => {
    setIsSessionLocked(true);
  };

  const unlockSession = (passwordInput: string) => {
    const isMatched = verifyPassword(passwordInput, currentUser.password);
    if (!isMatched) {
      return {
        success: false,
        message: 'Kata sandi tidak sesuai! Sesi gagal dibuka.',
      };
    }
    setIsSessionLocked(false);
    return {
      success: true,
      message: `Sesi ${currentUser.name} berhasil dibuka kembali.`,
    };
  };

  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (isSessionLocked) return;
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setIsSessionLocked(true);
      }, 15 * 60 * 1000); // 15 minutes standard inactivity timeout
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isSessionLocked, currentUser.id]);

  const canCurrentUserManagePassword = (targetRole: UserRole) => {
    return canManageUserPassword(currentUser.role, targetRole);
  };

  const canCurrentUserViewPassword = (targetRole: UserRole) => {
    return canViewUserPassword(currentUser.role, targetRole);
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

    if (db) { import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'users', id))).catch(() => {}); }
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
      setSelectedAssessmentForEdit(null);
      const targetTab = ROLE_NAV_CONFIGS[role]?.defaultTab || 'dashboard';
      setActiveTab(targetTab);
      showToast(`Beralih ke peran: ${ROLE_LIMITS[role].title} (${existing.name}) — Tampilan disesuaikan`, 'info');
      logUserActivity(
        'SWITCH_ROLE',
        'Sistem & Pengguna',
        `Beralih ke Peran: ${ROLE_LIMITS[role].title}`,
        existing.name,
        `Akun ID: ${existing.id}`
      );
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

    logUserActivity(
      'CREATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Input Penilaian Baru: ${data.buildingName}`,
      data.code || data.buildingName,
      `Klasifikasi: ${data.damageClassification} (${Number(data.totalDamagePercent ?? 0).toFixed(1)}%) — Biaya: Rp ${Number(data.roundedRehabCost ?? 0).toLocaleString('id-ID')}`
    );

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
    logUserActivity(
      'UPDATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Memperbarui Data Penilaian: ${target?.buildingName || id}`,
      target?.code || id,
      'Pembaruan data kerusakan atau pengesahan tim lapangan'
    );

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
    logUserActivity(
      'DELETE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Menghapus Data Penilaian Gedung: ${target?.buildingName || id}`,
      target?.code || id,
      `Dihapus oleh ${currentUser.name} (${ROLE_LIMITS[currentUser.role]?.title})`
    );

    if (target && googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http')) {
      directSaveToGoogleSheet(target, googleSheetConfig, 'delete').catch((e) =>
        console.error('Direct Google Sheet delete error:', e)
      );
    }

    if (db) { import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'assessments', id))).catch(() => {}); }
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

    const target = assessments.find((a) => a.id === id);
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

    logUserActivity(
      'VERIFY_ASSESSMENT',
      'Penilaian Kerusakan',
      `Verifikasi Teknis [${status}]: ${target?.buildingName || id}`,
      target?.code || id,
      `Catatan Verifikasi: ${notes || 'Tanpa catatan khusus'}`
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
      logUserActivity(
        'SYNC_GOOGLE_SHEET',
        'Integrasi Google Sheet',
        `Sinkronisasi Single Data ke Google Sheet: ${target.buildingName}`,
        target.code || target.id,
        result.message
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
      logUserActivity(
        'SYNC_GOOGLE_SHEET',
        'Integrasi Google Sheet',
        `Sinkronisasi Masal ${assessments.length} Data Gedung ke Google Sheet`,
        'Semua Kecamatan & Master Rekap',
        result.message
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
    return { success: true, message: `Kecamatan ${newKec.name} berhasil ditambahkan.`, kecamatan: newKec, data: newKec };
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
    return { success: true, message: `${newDesa.type} ${newDesa.name} berhasil didaftarkan.`, desa: newDesa, data: newDesa };
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
        isLoggedIn,
        currentUser,
        setCurrentUser,
        users,
        getUserCountsByRole,
        addUser,
        updateUser,
        updateUserPassword,
        loginWithPassword,
        loginByEmailPassword,
        loginByNamePassword,
        logout,
        canCurrentUserManagePassword,
        canCurrentUserViewPassword,
        deleteUser,
        switchUserRole,

        isSessionLocked,
        lockSession,
        unlockSession,

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

        activityLogs,
        logUserActivity,
        syncActivityLogsToSheet,
        clearActivityLogs,

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
