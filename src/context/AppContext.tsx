import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
  DataNotification,
} from '../types';
import { playNotificationChime } from '../utils/sound';
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
  fetchAssessmentsFromGoogleSheet,
  isConfiguredSheetUrl,
} from '../services/googleSheetsService';
import {
  encryptPassword,
  verifyPassword,
  canManageUserPassword,
  canViewUserPassword,
} from '../utils/security';
import { db, isQuotaError, FIRESTORE_DATABASE_CONSOLE_URL, pauseFirestoreNetwork } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { savePhotosLocally, deletePhotosByAssessmentIdLocally } from '../utils/photoStorage';
import { hydrateAssessmentPhotos } from '../utils/imageCompressor';
import { detectAllDuplicateGroups } from '../utils/duplicateDetector';
import { generateNextRegistrationCode } from '../utils/registrationCodeGenerator';

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
  purgeAllDuplicates: () => { success: boolean; count: number; message: string };
  verifyAssessment: (id: string, status: VerificationStatus, notes: string) => Promise<{ success: boolean; message: string }>;
  syncAssessmentToSheet: (id: string) => Promise<{ success: boolean; message: string }>;
  syncAllToSheet: () => Promise<{ success: boolean; message: string; count?: number }>;
  syncFromGoogleSheet: (showToastAlert?: boolean) => Promise<{ success: boolean; message: string; count?: number }>;

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
  isFirestoreQuotaExceeded: boolean;
  firestoreConsoleUrl: string;

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

  // Real-time Incoming Data Notifications
  notifications: DataNotification[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  latestIncomingData: DataNotification | null;
  clearLatestIncomingData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH: 'sipandu_pupr_auth_v3',
  USERS: 'sipandu_pupr_users_v3',
  ASSESSMENTS: 'sipandu_pupr_assessments_v3',
  DELETED_ASSESSMENTS: 'sipandu_pupr_deleted_assessments_v3',
  KECAMATAN: 'sipandu_pupr_kecamatan_v3',
  DESA: 'sipandu_pupr_desa_v3',
  DUKCAPIL: 'sipandu_pupr_dukcapil_v3',
  GOOGLE_SHEET: 'sipandu_pupr_gsheet_v3',
  FIREBASE: 'sipandu_pupr_firebase_v3',
  ACTIVITY_LOGS: 'sipandu_pupr_activity_logs_v1',
  NOTIFICATIONS: 'sipandu_pupr_notifications_v1',
  DELETED_USERS: 'sipandu_pupr_deleted_users_v3',
};

// Safe helper to read persisted deleted User IDs across refreshes & sessions
function getStoredDeletedUserIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function persistDeletedUserId(id: string) {
  if (!id) return;
  try {
    const current = getStoredDeletedUserIds();
    current.add(id);
    localStorage.setItem(STORAGE_KEYS.DELETED_USERS, JSON.stringify(Array.from(current)));
  } catch {}
}

// Safe helper to read persisted deleted IDs across refreshes & sessions
function getStoredDeletedAssessmentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_ASSESSMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function persistDeletedAssessmentId(id: string) {
  if (!id) return;
  try {
    const current = getStoredDeletedAssessmentIds();
    current.add(id);
    localStorage.setItem(STORAGE_KEYS.DELETED_ASSESSMENTS, JSON.stringify(Array.from(current)));
  } catch {}
}

function persistDeletedAssessmentIdsBatch(ids: string[]) {
  if (!ids || ids.length === 0) return;
  try {
    const current = getStoredDeletedAssessmentIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(STORAGE_KEYS.DELETED_ASSESSMENTS, JSON.stringify(Array.from(current)));
  } catch {}
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize users with guaranteed encrypted passwords and robust persistence
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const deletedUserIds = getStoredDeletedUserIds();
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      let list: UserAccount[] = [];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          list = parsed;
        }
      }

      const userMap = new Map<string, UserAccount>();
      // 1. Initial base accounts
      INITIAL_USERS.forEach((u) => {
        if (!deletedUserIds.has(u.id)) {
          userMap.set(u.id, u);
        }
      });
      // 2. Persisted local accounts (includes all newly registered users)
      list.forEach((u) => {
        if (u && u.id && !deletedUserIds.has(u.id)) {
          userMap.set(u.id, u);
        }
      });

      return Array.from(userMap.values()).map((u) => {
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

  // Initialize assessments with persistent deleted IDs filtered out and deduplicated
  const [assessments, setAssessments] = useState<BuildingAssessment[]>(() => {
    try {
      const deletedIds = getStoredDeletedAssessmentIds();
      const saved = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      if (!saved) return INITIAL_ASSESSMENTS.filter((a) => !deletedIds.has(a.id));
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_ASSESSMENTS.filter((a) => !deletedIds.has(a.id));

      // Filter out deleted IDs and deduplicate by id
      const map = new Map<string, BuildingAssessment>();
      parsed.forEach((item: BuildingAssessment) => {
        if (item && item.id && !deletedIds.has(item.id)) {
          const existing = map.get(item.id);
          if (!existing || new Date(item.updatedAt || item.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
            map.set(item.id, item);
          }
        }
      });
      return Array.from(map.values());
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

  // Track Firebase Firestore Quota Exhaustion (Spark Free Tier limit protection)
  const [isFirestoreQuotaExceeded, setIsFirestoreQuotaExceeded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sipandu_pupr_quota_exceeded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isFirestoreQuotaExceeded) {
        localStorage.setItem('sipandu_pupr_quota_exceeded', 'true');
        pauseFirestoreNetwork().catch(() => {});
      }
    } catch {}
  }, [isFirestoreQuotaExceeded]);

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

  // Real-time Incoming Data Notifications State
  const [notifications, setNotifications] = useState<DataNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) return JSON.parse(saved);
      return [];
    } catch {
      return [];
    }
  });

  const [latestIncomingData, setLatestIncomingData] = useState<DataNotification | null>(null);

  const unreadNotificationCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {
      console.warn('LocalStorage notifications save notice:', e);
    }
  }, [notifications]);

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const clearLatestIncomingData = () => {
    setLatestIncomingData(null);
  };

  // Sync to local storage

  // Track IDs of assessments deleted across all sessions to prevent accidental resurrection
  const deletedAssessmentIds = useRef<Set<string>>(getStoredDeletedAssessmentIds());
  const isInitialLoad = useRef(true);
  
  // Load from Firebase ONCE on mount with Quota Protection and Deleted IDs Filtering
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) {
      isInitialLoad.current = false;
      return;
    }
    
    Promise.allSettled([
      getDocs(collection(db, 'users')).then((snapshot) => {
        const deletedUserIds = getStoredDeletedUserIds();
        if (!snapshot.empty) {
          const remoteUsers = snapshot.docs
            .map((d) => d.data() as UserAccount)
            .filter((u) => u && u.id && !deletedUserIds.has(u.id));

          setUsers((prev) => {
            const userMap = new Map<string, UserAccount>();
            // Keep all local users (including newly registered users)
            prev.forEach((u) => {
              if (u && u.id && !deletedUserIds.has(u.id)) {
                userMap.set(u.id, u);
              }
            });
            // Merge remote users (overwriting / updating if exists or adding if new)
            remoteUsers.forEach((r) => {
              const existing = userMap.get(r.id);
              if (!existing) {
                userMap.set(r.id, r);
              } else {
                userMap.set(r.id, { ...existing, ...r });
              }
            });
            const merged = Array.from(userMap.values());
            try {
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
            } catch {}

            return merged;
          });
        }
      }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase users fetch offline/deferred:', err?.message || err);
      }),

      getDocs(collection(db, 'assessments')).then(async (snapshot) => {
        if (!snapshot.empty) {
          const storedDeleted = getStoredDeletedAssessmentIds();
          
          // Filter out deleted IDs and deduplicate by id
          const map = new Map<string, BuildingAssessment>();
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as BuildingAssessment;
            if (data && data.id && !storedDeleted.has(data.id) && !storedDeleted.has(docSnap.id)) {
              const existing = map.get(data.id);
              if (!existing || new Date(data.updatedAt || data.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
                map.set(data.id, data);
              }
            }
          });

          const uniqueRemote = Array.from(map.values());
          const hydrated = await Promise.all(uniqueRemote.map(hydrateAssessmentPhotos));
          setAssessments((prev) => {
            // Merge with existing local assessments, prioritizing hydrated remote docs but keeping local non-deleted ones
            const mergedMap = new Map<string, BuildingAssessment>();
            prev.filter((p) => !storedDeleted.has(p.id)).forEach((p) => mergedMap.set(p.id, p));
            hydrated.forEach((h) => mergedMap.set(h.id, h));
            const mergedList = Array.from(mergedMap.values());
            try {
              const lightweight = mergedList.map((a) => ({
                ...a,
                photos: a.photos?.map((p) => ({
                  ...p,
                  url: p.url && (p.url.startsWith('http') || p.url.length < 300) ? p.url : '',
                })) || [],
              }));
              localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
            } catch {}
            return mergedList;
          });
        }
      }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase assessments fetch offline/deferred:', err?.message || err);
      }),

      getDoc(doc(db, 'system_configs', 'google_sheet')).then((snap) => {
        if (snap.exists()) {
          const remoteConfig = snap.data() as GoogleSheetConfig;
          setGoogleSheetConfig(remoteConfig);
          try {
            localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(remoteConfig));
          } catch {}
        }
      }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase google sheet config fetch deferred:', err?.message || err);
      }),

      getDocs(collection(db, 'activity_logs')).then((snapshot) => {
        if (!snapshot.empty) {
          const remoteLogs = snapshot.docs.map((d) => d.data() as UserActivityLog);
          remoteLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivityLogs(remoteLogs);
        }
      }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase activity logs fetch offline/deferred:', err?.message || err);
      }),
    ]).finally(() => {
      // Mark initial load finished after initial checks have settled
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
    });
  }, [isFirestoreQuotaExceeded]);

  // Real-time listener for incoming building assessments and deletions from Firebase Firestore
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) return;

    const knownIds = new Set<string>();
    assessments.forEach((a) => knownIds.add(a.id));
    let initialSnapshotSettled = false;

    const unsubscribe = onSnapshot(
      collection(db, 'assessments'),
      (snapshot) => {
        const storedDeleted = getStoredDeletedAssessmentIds();

        if (!initialSnapshotSettled) {
          const currentRemoteDocs = snapshot.docs
            .map((d) => d.data() as BuildingAssessment)
            .filter((d) => d && d.id && !storedDeleted.has(d.id));
          const currentRemoteIds = new Set(currentRemoteDocs.map((d) => d.id));
          currentRemoteIds.forEach((id) => knownIds.add(id));
          initialSnapshotSettled = true;

          // If there are remote documents in Firestore, purge any local items deleted remotely
          if (snapshot.docs.length > 0) {
            setAssessments((prev) => {
              const cleanPrev = prev.filter((a) => !storedDeleted.has(a.id) && currentRemoteIds.has(a.id));
              const localIds = new Set(cleanPrev.map((a) => a.id));
              const additions = currentRemoteDocs.filter((r) => !localIds.has(r.id));
              const result = [...additions, ...cleanPrev];
              try {
                localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(result));
              } catch {}
              return result;
            });
          }
          return;
        }

        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          const docData = change.doc.data() as BuildingAssessment;

          if (change.type === 'removed') {
            const removedId = docId;
            knownIds.delete(removedId);
            deletedAssessmentIds.current.add(removedId);
            persistDeletedAssessmentId(removedId);
            deletePhotosByAssessmentIdLocally(removedId);
            setAssessments((prev) => {
              const next = prev.filter((a) => a.id !== removedId);
              try {
                localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (change.type === 'modified') {
            if (docData && docData.id && !storedDeleted.has(docData.id) && !storedDeleted.has(docId)) {
              setAssessments((prev) => {
                const next = prev.map((a) => (a.id === docData.id ? docData : a));
                try {
                  localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          } else if (change.type === 'added') {
            if (
              docData &&
              docData.id &&
              !storedDeleted.has(docData.id) &&
              !storedDeleted.has(docId) &&
              !knownIds.has(docData.id) &&
              !deletedAssessmentIds.current.has(docData.id)
            ) {
              knownIds.add(docData.id);

              const newNotif: DataNotification = {
                id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                title: 'Data Masuk: Penilaian Gedung Baru',
                message: `Data survei "${docData.buildingName}" (${docData.kecamatanName || 'Kecamatan'}) baru saja masuk ke sistem.`,
                buildingName: docData.buildingName,
                kecamatan: docData.kecamatanName,
                desa: docData.desaName,
                damageClassification: docData.damageClassification,
                totalDamagePercent: docData.totalDamagePercent,
                rehabCost: docData.roundedRehabCost,
                assessmentId: docData.id,
                timestamp: new Date().toISOString(),
                isRead: false,
                surveyorName: docData.createdByName || 'Surveyor Lapangan',
              };

              setNotifications((prev) => [newNotif, ...prev]);
              setLatestIncomingData(newNotif);
              playNotificationChime();
              showToast(
                `🔔 Data Masuk: ${docData.buildingName} - ${docData.damageClassification || 'Tercatat'}`,
                'info'
              );

              setAssessments((prev) => {
                if (prev.some((a) => a.id === docData.id)) return prev;
                const next = [docData, ...prev];
                try {
                  localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          }
        });
      },
      (error) => {
        if (isQuotaError(error)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firestore real-time assessment listener deferred:', error?.message || error);
      }
    );

    return () => unsubscribe();
  }, [db, isFirestoreQuotaExceeded]);

  // Real-time listener for users from Firebase Firestore
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) return;

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const deletedUserIds = getStoredDeletedUserIds();
        const remoteUsers = snapshot.docs
          .map((d) => d.data() as UserAccount)
          .filter((u) => u && u.id && !deletedUserIds.has(u.id));

        if (remoteUsers.length > 0) {
          setUsers((prev) => {
            const userMap = new Map<string, UserAccount>();
            // Keep local users first
            prev.forEach((u) => {
              if (u && u.id && !deletedUserIds.has(u.id)) {
                userMap.set(u.id, u);
              }
            });
            // Merge remote users
            remoteUsers.forEach((r) => {
              const existing = userMap.get(r.id);
              if (!existing) {
                userMap.set(r.id, r);
              } else {
                userMap.set(r.id, { ...existing, ...r });
              }
            });
            const merged = Array.from(userMap.values());
            try {
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      },
      (error) => {
        if (isQuotaError(error)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firestore users real-time listener deferred:', error?.message || error);
      }
    );

    return () => unsubscribe();
  }, [db, isFirestoreQuotaExceeded]);

  // Real-time listener for shared Google Sheet configuration across all roles & devices
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) return;
    const unsubscribe = onSnapshot(
      doc(db, 'system_configs', 'google_sheet'),
      (snap) => {
        if (snap.exists()) {
          const remoteConfig = snap.data() as GoogleSheetConfig;
          setGoogleSheetConfig(remoteConfig);
          try {
            localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(remoteConfig));
          } catch {}
        }
      },
      (error) => {
        if (isQuotaError(error)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firestore google_sheet real-time listener deferred:', error?.message || error);
      }
    );
    return () => unsubscribe();
  }, [db, isFirestoreQuotaExceeded]);

  // Instant Cross-Tab Synchronization (same browser across tabs and role switches)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('sipandu_pupr_sync_channel');
        channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'DELETE_ASSESSMENT' && payload?.id) {
            deletedAssessmentIds.current.add(payload.id);
            setAssessments((prev) => prev.filter((a) => a.id !== payload.id));
          } else if (type === 'PURGE_DUPLICATES' && payload?.ids) {
            const idsToDelete = payload.ids as string[];
            idsToDelete.forEach((id) => deletedAssessmentIds.current.add(id));
            const toDeleteSet = new Set(idsToDelete);
            setAssessments((prev) => prev.filter((a) => !toDeleteSet.has(a.id)));
          } else if (type === 'UPDATE_GOOGLE_SHEET' && payload?.config) {
            setGoogleSheetConfig(payload.config);
          } else if (type === 'ADD_USER' && payload?.user) {
            setUsers((prev) => {
              if (prev.some((u) => u.id === payload.user.id)) return prev;
              const next = [...prev, payload.user];
              try {
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (type === 'UPDATE_USER' && payload?.user) {
            setUsers((prev) => {
              const next = prev.map((u) => (u.id === payload.user.id ? payload.user : u));
              try {
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
              } catch {}
              return next;
            });
          } else if (type === 'DELETE_USER' && payload?.id) {
            setUsers((prev) => {
              const next = prev.filter((u) => u.id !== payload.id);
              try {
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
              } catch {}
              return next;
            });
          }
        };
      }
    } catch {}

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ASSESSMENTS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setAssessments(parsed);
          }
        } catch {}
      } else if (e.key === STORAGE_KEYS.USERS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setUsers(parsed);
          }
        } catch {}
      } else if (e.key === STORAGE_KEYS.GOOGLE_SHEET && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setGoogleSheetConfig(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
    };
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
  }, [users]);

  useEffect(() => {
    // Persist photos to IndexedDB cache
    assessments.forEach((a) => {
      if (a.photos && a.photos.length > 0) {
        savePhotosLocally(a.photos, a.id).catch(() => {});
      }
    });

    try {
      // ALWAYS save lightweight assessments to localStorage to prevent filling up the 5MB quota
      // which would block other critical saves like Users and Activity Logs.
      const lightweight = assessments.map((a) => ({
        ...a,
        photos: a.photos.map((p) => ({
          ...p,
          url: p.url && (p.url.startsWith('http') || p.url.length < 300) ? p.url : '',
        })),
      }));
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
    } catch (e) {
      console.warn('LocalStorage lightweight assessments save notice:', e);
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
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => {
      const next = [...prev, newUser];
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'ADD_USER', payload: { user: newUser } });
        ch.close();
      }
    } catch {}

    if (db && !isFirestoreQuotaExceeded) {
      const cleanU = JSON.parse(JSON.stringify(newUser));
      setDoc(doc(db, 'users', cleanU.id), cleanU).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase setDoc user failed:', err);
      });
    }

    return {
      success: true,
      message: `Akun pengguna ${newUser.name} (${roleLimit.title}) berhasil didaftarkan dan disimpan permanen.`,
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

    const updatedUserObj = { ...target, ...restData };
    if (db && !isFirestoreQuotaExceeded) {
      const cleanU = JSON.parse(JSON.stringify(updatedUserObj));
      setDoc(doc(db, 'users', id), cleanU, { merge: true }).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
      });
    }

    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, ...restData };
          if (currentUser.id === id) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'UPDATE_USER', payload: { user: updatedUserObj } });
        ch.close();
      }
    } catch {}

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

    if (db && !isFirestoreQuotaExceeded) {
      setDoc(doc(db, 'users', targetUserId), { password: encrypted, passwordLastChanged: now }, { merge: true }).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
      });
    }

    const updatedObj = { ...target, password: encrypted, passwordLastChanged: now };

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === targetUserId ? updatedObj : u));
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'UPDATE_USER', payload: { user: updatedObj } });
        ch.close();
      }
    } catch {}

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

    // Only record major audit actions to Firestore to conserve quota
    const isMajorAuditAction = ['LOGIN', 'CREATE_ASSESSMENT', 'DELETE_ASSESSMENT', 'VERIFY_ASSESSMENT'].includes(action);
    if (db && isMajorAuditAction && !isFirestoreQuotaExceeded) {
      const cleanLog = JSON.parse(JSON.stringify(newLog));
      setDoc(doc(db, 'activity_logs', cleanLog.id), cleanLog).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
      });
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

    persistDeletedUserId(id);

    if (db && !isFirestoreQuotaExceeded) {
      deleteDoc(doc(db, 'users', id)).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
      });
    }

    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'DELETE_USER', payload: { id } });
        ch.close();
      }
    } catch {}

    return {
      success: true,
      message: `Pengguna ${target.name} berhasil dihapus secara permanen.`,
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

    if (db && !isFirestoreQuotaExceeded) {
      const cleanA = JSON.parse(JSON.stringify(assessmentToSave));
      setDoc(doc(db, 'assessments', cleanA.id), cleanA).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase assessment save notice:', err?.message || err);
      });
    }

    // Real-time notification when new building data enters the system
    const newNotif: DataNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: 'Data Masuk: Penilaian Gedung Baru',
      message: `Penilaian gedung "${data.buildingName}" (${data.kecamatanName || 'Kecamatan'}) berhasil dicatat ke sistem.`,
      buildingName: data.buildingName,
      kecamatan: data.kecamatanName,
      desa: data.desaName,
      damageClassification: data.damageClassification,
      totalDamagePercent: data.totalDamagePercent,
      rehabCost: data.roundedRehabCost,
      assessmentId: data.id,
      timestamp: new Date().toISOString(),
      isRead: false,
      surveyorName: data.createdByName || currentUser.name,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setLatestIncomingData(newNotif);
    playNotificationChime();

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
    const target = assessments.find((a) => a.id === id);
    const updatedCode = data.code || target?.code || target?.id || id;

    setAssessments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...data,
              code: updatedCode,
              googleSheetSynced: hasGSheet ? true : a.googleSheetSynced,
              googleSheetSyncedAt: hasGSheet ? now : a.googleSheetSyncedAt,
              updatedAt: now,
            }
          : a
      )
    );

    if (db && target && !isFirestoreQuotaExceeded) {
      const merged = { ...target, ...data, code: updatedCode, updatedAt: now };
      const cleanA = JSON.parse(JSON.stringify(merged));
      setDoc(doc(db, 'assessments', id), cleanA, { merge: true }).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase assessment update notice:', err?.message || err);
      });
    }

    logUserActivity(
      'UPDATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Memperbarui Data Penilaian: ${target?.buildingName || id}`,
      updatedCode,
      'Pembaruan data kerusakan atau pengesahan tim lapangan'
    );

    if (target && hasGSheet) {
      const merged = { ...target, ...data, code: updatedCode, updatedAt: now };
      directSaveToGoogleSheet(merged, googleSheetConfig, 'update').catch((e) =>
        console.error('Direct Google Sheet update error:', e)
      );
    }

    return {
      success: true,
      message: hasGSheet
        ? 'Data penilaian berhasil diperbarui & langsung memperbarui baris di Google Sheet.'
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

    // Persist deleted ID immediately so it can NEVER be resurrected on page refresh / link re-entry
    deletedAssessmentIds.current.add(id);
    persistDeletedAssessmentId(id);
    deletePhotosByAssessmentIdLocally(id);

    if (db && !isFirestoreQuotaExceeded) {
      deleteDoc(doc(db, 'assessments', id)).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase assessment deletion error:', err?.message || err);
      });
    }

    const updated = assessments.filter((a) => a.id !== id);
    setAssessments(updated);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'DELETE_ASSESSMENT', payload: { id } });
        ch.close();
      }
    } catch {}

    return {
      success: true,
      message: 'Data penilaian gedung berhasil dihapus permanen di semua akun & perangkat.',
    };
  };

  // Mass cleanup of all duplicate entries: retains the most complete/verified survey in each cluster
  const purgeAllDuplicates = (): { success: boolean; count: number; message: string } => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return {
        success: false,
        count: 0,
        message: 'Akses ditolak: Hanya Super Admin dan Admin yang berhak menghapus data survei ganda.',
      };
    }

    const duplicateGroups = detectAllDuplicateGroups(assessments);
    if (duplicateGroups.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Tidak ditemukan data ganda / duplikat. Seluruh data survei sudah bersih!',
      };
    }

    const idsToDelete: string[] = [];

    duplicateGroups.forEach((group) => {
      // Rank items in cluster: prefer verified, then highest photo count, then latest timestamp
      const sorted = [...group.items].sort((a, b) => {
        const aVer = a.verificationStatus === 'Terverifikasi' ? 1 : 0;
        const bVer = b.verificationStatus === 'Terverifikasi' ? 1 : 0;
        if (aVer !== bVer) return bVer - aVer;

        const aPhotos = a.photos?.length || 0;
        const bPhotos = b.photos?.length || 0;
        if (aPhotos !== bPhotos) return bPhotos - aPhotos;

        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      // Keep index 0 (primary/master record), mark index 1..n for deletion
      for (let i = 1; i < sorted.length; i++) {
        idsToDelete.push(sorted[i].id);
      }
    });

    if (idsToDelete.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Semua survei sudah unik dan tidak ada duplikat tambahan untuk dibersihkan.',
      };
    }

    // Persist deleted IDs batch
    persistDeletedAssessmentIdsBatch(idsToDelete);
    idsToDelete.forEach((id) => {
      deletedAssessmentIds.current.add(id);
      deletePhotosByAssessmentIdLocally(id);
      if (db && !isFirestoreQuotaExceeded) {
        deleteDoc(doc(db, 'assessments', id)).catch(() => {});
      }
    });

    const toDeleteSet = new Set(idsToDelete);
    const updated = assessments.filter((a) => !toDeleteSet.has(a.id));
    setAssessments(updated);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
        ch.postMessage({ type: 'PURGE_DUPLICATES', payload: { ids: idsToDelete } });
        ch.close();
      }
    } catch {}

    logUserActivity(
      'DELETE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Pembersihan Otomatis Data Ganda: Menghapus ${idsToDelete.length} survei duplikat`,
      `${duplicateGroups.length} kluster`,
      `Dibersihkan secara tuntas oleh ${currentUser.name}`
    );

    return {
      success: true,
      count: idsToDelete.length,
      message: `Berhasil membersihkan ${idsToDelete.length} data survei ganda dari ${duplicateGroups.length} kluster! Data primer paling lengkap tetap aman tersimpan.`,
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

    if (db && !isFirestoreQuotaExceeded) {
      setDoc(
        doc(db, 'assessments', id),
        {
          verificationStatus: status,
          verificationNotes: notes,
          verifiedBy: currentUser.name,
          verifiedAt: now,
          updatedAt: now,
        },
        { merge: true }
      ).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase assessment verification save notice:', err?.message || err);
      });
    }

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

  /**
   * Pull and synchronize all assessment rows directly from Google Sheet (starting from row A2 downwards)
   * Ensures that whatever exists in the Google Sheet is fully displayed in the web app
   */
  const syncFromGoogleSheet = async (showToastAlert = false): Promise<{ success: boolean; message: string; count?: number }> => {
    if (!googleSheetConfig.spreadsheetUrl || !isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl)) {
      const msg = 'Tautan Google Sheet belum diatur atau masih menggunakan template contoh.';
      if (showToastAlert) showToast(msg, 'info');
      return { success: false, message: msg, count: 0 };
    }

    try {
      const result = await fetchAssessmentsFromGoogleSheet(googleSheetConfig);
      if (!result.success || !result.data) {
        if (showToastAlert) showToast(result.message, 'info');
        return { success: false, message: result.message, count: 0 };
      }

      const sheetItems = result.data;
      const storedDeleted = getStoredDeletedAssessmentIds();

      // Ensure data currently present in Google Sheet is NOT suppressed by deletedAssessmentIds
      let unsuppressedCount = 0;
      sheetItems.forEach((s) => {
        if (s.id && storedDeleted.has(s.id)) {
          storedDeleted.delete(s.id);
          deletedAssessmentIds.current.delete(s.id);
          unsuppressedCount++;
        }
        if (s.code && storedDeleted.has(s.code)) {
          storedDeleted.delete(s.code);
          deletedAssessmentIds.current.delete(s.code);
          unsuppressedCount++;
        }
      });
      if (unsuppressedCount > 0) {
        try {
          localStorage.setItem(STORAGE_KEYS.DELETED_ASSESSMENTS, JSON.stringify(Array.from(storedDeleted)));
        } catch {}
      }

      setAssessments((prev) => {
        const map = new Map<string, BuildingAssessment>();
        // Add existing local assessments
        prev.forEach((p) => {
          if (!storedDeleted.has(p.id)) {
            map.set(p.id, p);
          }
        });

        // Set of keys already claimed by a sheet item to prevent duplicate assignment
        const claimedKeys = new Set<string>();

        // Overlay Google Sheet records: every row from Google Sheet is preserved
        sheetItems.forEach((s) => {
          let matchedKey: string | undefined = undefined;
          if (map.has(s.id)) {
            matchedKey = s.id;
          } else if (s.code) {
            for (const [k, v] of map.entries()) {
              if (!claimedKeys.has(k) && v.code && v.code.trim().toUpperCase() === s.code.trim().toUpperCase()) {
                matchedKey = k;
                break;
              }
            }
          }

          // IMPORTANT: Do NOT fuzzy match by buildingName or desaName!
          // Multiple survey rows can legitimately have identical or empty building names (e.g. "Rumah Warga").
          // Matching by name caused different sheet rows to collapse into fewer rows.

          if (matchedKey) {
            claimedKeys.add(matchedKey);
            const existing = map.get(matchedKey)!;
            const regCode = s.code || existing.code || generateNextRegistrationCode(Array.from(map.values()));
            map.set(matchedKey, {
              ...existing,
              ...s,
              id: existing.id,
              code: regCode,
              photos: existing.photos && existing.photos.length > 0 ? existing.photos : s.photos,
              components: existing.components && existing.components.length > 0 ? existing.components : s.components,
              googleSheetSynced: true,
              googleSheetSyncedAt: new Date().toISOString(),
            });
          } else {
            claimedKeys.add(s.id);
            // New record from Google Sheet: guarantee registration code
            const regCode = s.code || generateNextRegistrationCode(Array.from(map.values()));
            map.set(s.id, {
              ...s,
              code: regCode,
            });
          }
        });

        const mergedList = Array.from(map.values());
        try {
          const lightweight = mergedList.map((a) => ({
            ...a,
            photos: a.photos?.map((p) => ({
              ...p,
              url: p.url && (p.url.startsWith('http') || p.url.length < 300) ? p.url : '',
            })) || [],
          }));
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
        } catch {}
        return mergedList;
      });

      const msg = `Berhasil memuat seluruh ${sheetItems.length} data survei dari Google Sheet (semua baris dengan data ditampilkan tanpa batasan).`;
      if (showToastAlert) showToast(msg, 'success');
      logUserActivity(
        'SYNC_GOOGLE_SHEET',
        'Integrasi Google Sheet',
        `Tarik Data dari Google Sheet: Seluruh ${sheetItems.length} Data Termuat`,
        'Semua baris dengan data',
        `Sumber: ${googleSheetConfig.spreadsheetUrl}`
      );
      return { success: true, message: msg, count: sheetItems.length };
    } catch (err: any) {
      const errMsg = `Gagal memuat data dari Google Sheet: ${err?.message || 'Koneksi terputus'}`;
      if (showToastAlert) showToast(errMsg, 'error');
      return { success: false, message: errMsg, count: 0 };
    }
  };

  // Automatically synchronize assessments from Google Sheet if URL is configured
  useEffect(() => {
    if (googleSheetConfig.spreadsheetUrl && isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl)) {
      syncFromGoogleSheet(false);
    }
  }, [googleSheetConfig.spreadsheetUrl]);

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
    setGoogleSheetConfig((prev) => {
      const updated = { ...prev, ...config };
      if (db && !isFirestoreQuotaExceeded) {
        setDoc(doc(db, 'system_configs', 'google_sheet'), JSON.parse(JSON.stringify(updated)), { merge: true }).catch(
          (err) => {
            if (isQuotaError(err)) {
              setIsFirestoreQuotaExceeded(true);
              pauseFirestoreNetwork().catch(() => {});
            }
            console.warn('Firebase google_sheet config save deferred:', err);
          }
        );
      }
      try {
        localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
          ch.postMessage({ type: 'UPDATE_GOOGLE_SHEET', payload: { config: updated } });
          ch.close();
        }
      } catch {}
      return updated;
    });
  };

  const updateFirebaseShieldConfig = (config: Partial<FirebaseShieldConfig>) => {
    setFirebaseShieldConfig((prev) => ({ ...prev, ...config }));
  };

  const deduplicatedAssessments = useMemo(() => {
    const duplicateGroups = detectAllDuplicateGroups(assessments);
    if (duplicateGroups.length === 0) return assessments;
    
    // Automatically hide duplicates globally so they never appear to any user role
    const hiddenIds = new Set<string>();
    duplicateGroups.forEach((group) => {
      // Sort to keep the best one as primary (verified first, most photos, newest)
      const sorted = [...group.items].sort((a, b) => {
        const aVer = a.verificationStatus === 'Terverifikasi' ? 1 : 0;
        const bVer = b.verificationStatus === 'Terverifikasi' ? 1 : 0;
        if (aVer !== bVer) return bVer - aVer;
        const aPhotos = a.photos?.length || 0;
        const bPhotos = b.photos?.length || 0;
        if (aPhotos !== bPhotos) return bPhotos - aPhotos;
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      // Hide all except the primary (index 0)
      for (let i = 1; i < sorted.length; i++) {
        hiddenIds.add(sorted[i].id);
      }
    });
    return assessments.filter((a) => !hiddenIds.has(a.id));
  }, [assessments]);

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

        assessments: deduplicatedAssessments,
        addAssessment,
        updateAssessment,
        deleteAssessment,
        purgeAllDuplicates,
        verifyAssessment,
        syncAssessmentToSheet,
        syncAllToSheet,
        syncFromGoogleSheet,

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
        isFirestoreQuotaExceeded,
        firestoreConsoleUrl: FIRESTORE_DATABASE_CONSOLE_URL,

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

        notifications,
        unreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        latestIncomingData,
        clearLatestIncomingData,
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
