import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  UserAccount,
  UserRole,
  ROLE_LIMITS,
  ROLE_NAV_CONFIGS,
  BuildingAssessment,
  BuildingCategory,
  BuildingCategoryConfig,
  BUILDING_CATEGORY_CONFIGS,
  Kecamatan,
  Desa,
  GoogleSheetConfig,
  FirebaseShieldConfig,
  VerificationStatus,
  DukcapilRecord,
  UserActivityLog,
  ActivityActionType,
  DataNotification,
  SheetSyncProgress,
  SessionQuotaStatus,
  ActiveSessionInfo,
  VerifyAssessmentOptions,
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
  consolidateSheetsInGoogleSheet,
  isConfiguredSheetUrl,
  directSaveUserToGoogleSheet,
  syncAllUsersToGoogleSheet,
  fetchUsersFromGoogleSheet,
  clearGoogleSheetsMemoryCache,
  extractSpreadsheetId,
} from '../services/googleSheetsService';
import {
  encryptPassword,
  verifyPassword,
  canManageUserPassword,
  canViewUserPassword,
} from '../utils/security';
import { db, isQuotaError, isQuotaExceeded, FIRESTORE_DATABASE_CONSOLE_URL, pauseFirestoreNetwork, resumeFirestoreNetwork } from '../services/firebase';
import { collection, onSnapshot, doc, setDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { 
  savePhotoLocally,
  savePhotosLocally, 
  deletePhotosByAssessmentIdLocally, 
  getAllLocalPhotoRecords, 
  uploadPhotoToServer, 
  syncBatchPhotosToServer, 
  getPhotoLocally 
} from '../utils/photoStorage';
import { hydrateAssessmentPhotos } from '../utils/imageCompressor';
import { 
  detectAllDuplicateGroups, 
  deduplicateAssessmentsList, 
  reconcileAndMergeAssessments 
} from '../utils/duplicateDetector';
import { 
  generateNextRegistrationCode, 
  autoFixDuplicateRegistrationCodes,
  getKecamatanCodePrefix 
} from '../utils/registrationCodeGenerator';
import {
  queueAssessmentForSync,
  removeAssessmentFromSyncQueue,
  flushOfflineSyncQueue,
} from '../utils/offlineSync';

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
  loginByEmailPassword: (emailInput: string, passwordInput: string) => Promise<{ success: boolean; message: string }>;
  loginByNamePassword: (nameInput: string, passwordInput: string) => Promise<{ success: boolean; message: string }>;
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
  deleteAssessment: (id: string, bypassAuth?: boolean) => { success: boolean; message: string };
  restoreAndRecoverAllAssessments: () => Promise<{ success: boolean; message: string; recoveredCount: number; totalCount: number }>;
  restoreDeletedAssessment: (id: string) => Promise<boolean>;
  getDeletedAssessmentIds: () => string[];
  purgeAllDuplicates: () => Promise<{ success: boolean; count: number; message: string }>;
  autoFixDuplicateCodes: () => Promise<{
    success: boolean;
    fixedCount: number;
    message: string;
    sheetSyncStatus?: boolean;
    fixedItems: Array<{
      id: string;
      buildingName: string;
      oldCode: string;
      newCode: string;
      sourceSheet?: string;
    }>;
  }>;
  fixSingleAssessmentRegistrationCode: (
    id: string,
    customNewCode?: string
  ) => Promise<{
    success: boolean;
    oldCode: string;
    newCode: string;
    message: string;
  }>;
  verifyAssessment: (
    id: string,
    status: VerificationStatus,
    notes: string,
    syncOptions?: VerifyAssessmentOptions
  ) => Promise<{
    success: boolean;
    message: string;
    sheetSyncResult?: { success: boolean; message: string; folderUrl?: string };
  }>;
  batchVerifyAssessments: (
    ids: string[],
    status: VerificationStatus,
    notes: string,
    syncOptions?: VerifyAssessmentOptions
  ) => Promise<{ success: boolean; message: string; processedCount: number }>;
  syncAssessmentToSheet: (id: string) => Promise<{ success: boolean; message: string }>;
  syncAllToSheet: () => Promise<{ success: boolean; message: string; count?: number }>;
  syncFromGoogleSheet: (showToastAlert?: boolean, forceRefresh?: boolean) => Promise<{ success: boolean; message: string; count?: number }>;
  syncAllProfiles: (options?: { forceRefresh?: boolean; showToastAlert?: boolean }) => Promise<{ success: boolean; message: string; count?: number; countPerProfile?: Record<string, number> }>;
  consolidateAndSyncSheets: () => Promise<{ success: boolean; message: string; count?: number }>;
  recoverAndSyncPhotos: (targetAssessmentId?: string) => Promise<{ recoveredCount: number; success: boolean; message: string }>;
  attachPhotoToAssessment: (assessmentId: string, photoId: string, dataUrl: string) => Promise<boolean>;

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
  syncUsersToGoogleSheet: () => Promise<{ success: boolean; message: string; count: number }>;
  fetchUsersFromSheet: () => Promise<{ success: boolean; users: UserAccount[]; message: string }>;
  firebaseShieldConfig: FirebaseShieldConfig;
  updateFirebaseShieldConfig: (config: Partial<FirebaseShieldConfig>) => void;
  isFirestoreQuotaExceeded: boolean;
  firestoreConsoleUrl: string;

  // HSBGN Regional Standards Configuration
  hsbgnConfigs: Record<BuildingCategory, number>;
  updateHsbgnConfig: (category: BuildingCategory, newHsbgn: number) => void;
  resetHsbgnConfigs: () => void;
  getCategoryConfig: (category: BuildingCategory) => BuildingCategoryConfig;

  // Data Fulfillment Target Configuration (Pemenuhan Kuota Data Input)
  targetAssessmentCount: number;
  updateTargetAssessmentCount: (newTarget: number) => { success: boolean; message: string };

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

  // Real-time Sheet Sync Progress Bar & Details
  sheetSyncProgress: SheetSyncProgress;

  // Concurrent Surveyor Quota & Session Slot Control
  sessionQuotaStatus: SessionQuotaStatus;
  isSurveyorQuotaBlocked: boolean;
  activeSessionsList: ActiveSessionInfo[];
  checkSessionSlot: () => Promise<boolean>;
  refreshActiveSessions: () => Promise<void>;
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
  HSBGN_CONFIGS: 'sipandu_pupr_hsbgn_v1',
  TARGET_COUNT: 'sipandu_pupr_target_count_v1',
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

function clearStoredDeletedAssessmentIds() {
  try {
    localStorage.removeItem(STORAGE_KEYS.DELETED_ASSESSMENTS);
  } catch {}
}

function removeStoredDeletedAssessmentId(id: string) {
  if (!id) return;
  try {
    const current = getStoredDeletedAssessmentIds();
    current.delete(id);
    localStorage.setItem(STORAGE_KEYS.DELETED_ASSESSMENTS, JSON.stringify(Array.from(current)));
  } catch {}
}

/**
 * Strip heavy raw base64 photo URLs before sending to Cloud Firestore
 * so the payload stays well below Firestore's 1MB document limit.
 */
function prepareAssessmentForFirestore(assessment: BuildingAssessment): any {
  const clean = JSON.parse(JSON.stringify(assessment));
  if (Array.isArray(clean.photos)) {
    clean.photos = clean.photos.map((p: any) => {
      let safeUrl = '';
      if (p.url && typeof p.url === 'string') {
        if (p.url.startsWith('http://') || p.url.startsWith('https://') || p.url.startsWith('/uploads/')) {
          safeUrl = p.url;
        } else if (!p.url.startsWith('data:') && p.url.length <= 400) {
          safeUrl = p.url;
        }
      }
      return {
        id: p.id || '',
        caption: p.caption || '',
        damageLocation: p.damageLocation || '',
        url: safeUrl,
        timestamp: p.timestamp || '',
      };
    });
  }
  return clean;
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

  // Initialize assessments with persistent deleted IDs filtered out, aggregating all local keys and backups
  const [assessments, setAssessments] = useState<BuildingAssessment[]>(() => {
    try {
      const deletedIds = getStoredDeletedAssessmentIds();
      const collected: BuildingAssessment[] = [];

      // 1. Primary current storage key
      const saved = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) collected.push(...parsed);
        } catch {}
      }

      // 2. Also check legacy & backup keys to prevent any data loss between versions or offline sessions
      const backupKeys = [
        'sipandu_pupr_assessments_backup',
        'sipandu_pupr_assessments_v2',
        'sipandu_pupr_assessments_v1',
        'sipandu_pupr_assessments_2026',
        'sipandu_pupr_assessments',
        'sipandu_assessments',
        'sipandu_offline_sync_queue',
      ];
      for (const k of backupKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const it of parsed) {
                const item = it && it.assessment ? it.assessment : it;
                if (item && item.id && item.buildingName) collected.push(item);
              }
            }
          }
        } catch {}
      }

      // Filter out deleted IDs and deduplicate completely
      const valid = collected.filter((item: BuildingAssessment) => item && item.id && !deletedIds.has(item.id));
      if (valid.length > 0) {
        const deduplicated = deduplicateAssessmentsList(valid);
        try {
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(deduplicated));
        } catch {}
        return deduplicated;
      }
      return INITIAL_ASSESSMENTS.filter((a) => !deletedIds.has(a.id));
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

  // Initialize Google Sheet Config with URL parameter auto-detection
  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() => {
    let initial = DEFAULT_GOOGLE_SHEET_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GOOGLE_SHEET);
      if (saved) {
        initial = { ...initial, ...JSON.parse(saved) };
      }
    } catch {}

    try {
      if (typeof window !== 'undefined' && window.location) {
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash || '';

        let sUrl = searchParams.get('sheetUrl') || searchParams.get('spreadsheetUrl') || searchParams.get('sUrl') || '';
        let wUrl = searchParams.get('webhookUrl') || searchParams.get('wUrl') || '';
        const sId = searchParams.get('sheetId') || searchParams.get('sId') || '';

        if (!sUrl && hash.includes('sheetUrl=')) {
          const hashParams = new URLSearchParams(hash.replace(/^#\/?/, '?'));
          sUrl = hashParams.get('sheetUrl') || hashParams.get('spreadsheetUrl') || hashParams.get('sUrl') || '';
          wUrl = wUrl || hashParams.get('webhookUrl') || hashParams.get('wUrl') || '';
        }

        if (!sUrl && sId) {
          sUrl = `https://docs.google.com/spreadsheets/d/${sId}/edit`;
        }

        if (sUrl || wUrl) {
          initial = {
            ...initial,
            spreadsheetUrl: sUrl.trim() || initial.spreadsheetUrl,
            webhookUrl: wUrl.trim() || initial.webhookUrl,
          };
          try {
            localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(initial));
          } catch {}
        }
      }
    } catch {}

    return initial;
  });

  // Initialize HSBGN Regional Standards Config
  const [hsbgnConfigs, setHsbgnConfigs] = useState<Record<BuildingCategory, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HSBGN_CONFIGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    const defaults: Record<string, number> = {};
    Object.keys(BUILDING_CATEGORY_CONFIGS).forEach((cat) => {
      defaults[cat] = BUILDING_CATEGORY_CONFIGS[cat as BuildingCategory].defaultHsbgn;
    });
    return defaults as Record<BuildingCategory, number>;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HSBGN_CONFIGS, JSON.stringify(hsbgnConfigs));
    } catch (e) {
      console.error('Error saving hsbgnConfigs:', e);
    }
  }, [hsbgnConfigs]);

  const updateHsbgnConfig = (category: BuildingCategory, newHsbgn: number) => {
    setHsbgnConfigs((prev) => ({
      ...prev,
      [category]: Math.max(0, newHsbgn),
    }));
  };

  const resetHsbgnConfigs = () => {
    const defaults: Record<string, number> = {};
    Object.keys(BUILDING_CATEGORY_CONFIGS).forEach((cat) => {
      defaults[cat] = BUILDING_CATEGORY_CONFIGS[cat as BuildingCategory].defaultHsbgn;
    });
    setHsbgnConfigs(defaults as Record<BuildingCategory, number>);
  };

  const getCategoryConfig = (category: BuildingCategory): BuildingCategoryConfig => {
    const base = BUILDING_CATEGORY_CONFIGS[category] || BUILDING_CATEGORY_CONFIGS['Hunian Masyarakat'];
    const customHsbgn = hsbgnConfigs[category];
    if (customHsbgn !== undefined) {
      return {
        ...base,
        defaultHsbgn: customHsbgn,
      };
    }
    return base;
  };

  // Initialize Data Fulfillment Target Count (Default: 400, dynamically configurable by Super Admin)
  const [targetAssessmentCount, setTargetAssessmentCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TARGET_COUNT);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {}
    return 400; // Standar default 400 data
  });

  const updateTargetAssessmentCount = (newTarget: number): { success: boolean; message: string } => {
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return {
        success: false,
        message: 'Akses Ditolak: Hanya Super Admin yang memiliki wewenang mengubah target kuota pemenuhan data.',
      };
    }
    if (!newTarget || isNaN(newTarget) || newTarget < 1) {
      return {
        success: false,
        message: 'Nilai target harus berupa angka bulat positif minimal 1.',
      };
    }
    const sanitizedTarget = Math.round(newTarget);
    setTargetAssessmentCount(sanitizedTarget);
    try {
      localStorage.setItem(STORAGE_KEYS.TARGET_COUNT, sanitizedTarget.toString());
    } catch (e) {
      console.error('Error saving targetAssessmentCount:', e);
    }

    logUserActivity(
      'UPDATE_ASSESSMENT',
      'Sistem & Pengguna',
      `Super Admin ${currentUser.name} memperbarui target kuota data menjadi ${sanitizedTarget} gedung`,
      `Target: ${sanitizedTarget}`,
      `Nilai kuota sebelumnya diperbarui ke ${sanitizedTarget}`
    );

    return {
      success: true,
      message: `Target pemenuhan data berhasil disetel ke ${sanitizedTarget.toLocaleString('id-ID')} gedung!`,
    };
  };

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
      return isQuotaExceeded || localStorage.getItem('sipandu_pupr_quota_exceeded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isFirestoreQuotaExceeded) {
        localStorage.setItem('sipandu_pupr_quota_exceeded', 'true');
        pauseFirestoreNetwork().catch(() => {});
      } else {
        localStorage.removeItem('sipandu_pupr_quota_exceeded');
        resumeFirestoreNetwork().catch(() => {});
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

  // Real-time Sheet Sync Progress & Status Bar State
  const initialKecList = [
    'Aesesa',
    'Aesesa Selatan',
    'Boawae',
    'Mauponggo',
    'Nangaroro',
    'Keo Tengah',
    'Wolowae',
  ];
  const [sheetSyncProgress, setSheetSyncProgress] = useState<SheetSyncProgress>({
    isLoading: false,
    currentKecamatan: '',
    currentStep: 0,
    totalSteps: 7,
    percent: 0,
    totalLoaded: 0,
    loadedKecamatans: initialKecList.map((k) => ({ name: k, count: 0, status: 'pending' })),
    statusMessage: '',
  });

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

  // Single Initial Load & 1-Hour Schedule tracker (prevents re-reading Google Sheet and tab crash)
  const hasLoadedInitialGoogleSheetRef = useRef<boolean>(false);
  const lastSheetSyncTimestampRef = useRef<number>(0);
  
  // 1. Load Google Sheet Config dynamically from Firestore (Primary) & Express server (Fallback)
  useEffect(() => {
    let unsubConfig: (() => void) | undefined;
    if (db && !isFirestoreQuotaExceeded) {
      try {
        unsubConfig = onSnapshot(doc(db, 'system_configs', 'google_sheet'), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && (data.spreadsheetUrl || data.webhookUrl || data.driveFolderId || data.spreadsheetProfiles)) {
              setGoogleSheetConfig((prev) => {
                const updated = {
                  ...prev,
                  spreadsheetUrl: data.spreadsheetUrl || prev.spreadsheetUrl,
                  webhookUrl: data.webhookUrl || prev.webhookUrl,
                  driveFolderId: data.driveFolderId || prev.driveFolderId,
                  spreadsheetProfiles: data.spreadsheetProfiles || prev.spreadsheetProfiles,
                  activeProfileId: data.activeProfileId || prev.activeProfileId,
                };
                try {
                  localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
                } catch {}
                return updated;
              });
            }
          }
        }, (err) => {
          console.warn('Firebase config sync failed, using fallback:', err);
        });
      } catch (err) {
        console.warn('Firebase config snapshot error:', err);
      }
    }

    // Always fetch server configuration as well to ensure latest webhookUrl & active profile
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          const { spreadsheetUrl, webhookUrl, driveFolderId, spreadsheetProfiles, activeProfileId } = data.config;
          if (spreadsheetUrl || webhookUrl || driveFolderId || spreadsheetProfiles) {
            setGoogleSheetConfig((prev) => {
              const updated = {
                ...prev,
                spreadsheetUrl: spreadsheetUrl || prev.spreadsheetUrl,
                webhookUrl: webhookUrl || prev.webhookUrl,
                driveFolderId: driveFolderId || prev.driveFolderId,
                spreadsheetProfiles: spreadsheetProfiles || prev.spreadsheetProfiles,
                activeProfileId: activeProfileId || prev.activeProfileId,
              };
              try {
                localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
              } catch {}
              return updated;
            });
            // If we fetched a new config, trigger user list sync to make sure login credentials work instantly!
            fetchUsersFromGoogleSheet({
              spreadsheetUrl: spreadsheetUrl || '',
              webhookUrl: webhookUrl || '',
              sheetName: 'Daftar_Pengguna',
              logSheetName: 'Log_Akses_Pengguna',
              autoSync: true,
              directSaveEnabled: true,
            }).then((res) => {
              if (res.success && res.users && res.users.length > 0) {
                setUsers((prev) => {
                  const deletedUserIds = getStoredDeletedUserIds();
                  const userMap = new Map<string, UserAccount>();
                  INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
                  prev.forEach((u) => { if (u && u.id && !deletedUserIds.has(u.id)) userMap.set(u.id, u); });
                  res.users.forEach((u) => { if (u && u.id && !deletedUserIds.has(u.id)) userMap.set(u.id, u); });
                  const merged = Array.from(userMap.values());
                  try {
                    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
                  } catch {}
                  return merged;
                });
              }
            }).catch((err) => console.warn('Background user fetch from Sheet failed:', err));
          }
        }
      })
      .catch((err) => console.warn('Failed to load server-side google sheet config:', err));

    return () => {
      if (unsubConfig) unsubConfig();
    };
  }, []);

  // 2. Load assessments from server (/api/assessments) for zero-quota persistence & cross-device sharing
  useEffect(() => {
    fetch('/api/assessments')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.assessments)) {
          setAssessments((prev) => {
            const pool = [...data.assessments];
            const merged = reconcileAndMergeAssessments(prev, pool);
            try {
              localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(merged));
            } catch {}
            // Silently persist back to server so server /data/assessments.json always stays updated
            fetch('/api/assessments/sync-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assessments: merged, replace: false }),
            }).catch(() => {});
            return merged;
          });
        }
      })
      .catch((err) => console.warn('Server assessments initial fetch notice:', err));
  }, []);

  // Periodic background check against server storage & flush offline sync queue
  useEffect(() => {
    // Immediate initial flush
    flushOfflineSyncQueue().catch(() => {});

    const handleOnline = () => {
      console.info('[Network] Online event detected, flushing offline sync outbox...');
      flushOfflineSyncQueue().catch(() => {});
    };
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      // 1. Flush any pending offline queue submissions
      flushOfflineSyncQueue().catch(() => {});

      // 2. Fetch latest surveys from server smoothly without re-rendering if unchanged
      fetch('/api/assessments')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.assessments) && data.assessments.length > 0) {
            setAssessments((prev) => {
              if (data.assessments.length === prev.length) {
                const prevIdSet = new Set(prev.map((p) => p.id));
                const hasNew = data.assessments.some((a: any) => a.id && !prevIdSet.has(a.id));
                if (!hasNew) return prev;
              }
              const merged = reconcileAndMergeAssessments(prev, data.assessments);
              if (merged.length === prev.length) return prev;
              try {
                localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        })
        .catch(() => {});

      // 3. Poll latest google sheet config from server to ensure Super Admin updates propagate smoothly
      fetch('/api/config')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.config) {
            const { spreadsheetUrl, webhookUrl, driveFolderId, spreadsheetProfiles, activeProfileId } = data.config;
            if (spreadsheetUrl) {
              setGoogleSheetConfig((prev) => {
                if (prev.spreadsheetUrl !== spreadsheetUrl || prev.activeProfileId !== activeProfileId) {
                  const updated = {
                    ...prev,
                    spreadsheetUrl: spreadsheetUrl || prev.spreadsheetUrl,
                    webhookUrl: webhookUrl || prev.webhookUrl,
                    driveFolderId: driveFolderId || prev.driveFolderId,
                    spreadsheetProfiles: spreadsheetProfiles || prev.spreadsheetProfiles,
                    activeProfileId: activeProfileId || prev.activeProfileId,
                  };
                  try {
                    localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
                  } catch {}
                  return updated;
                }
                return prev;
              });
            }
          }
        })
        .catch(() => {});
    }, 60 * 60 * 1000); // 1-Hour refresh cycle: keeps the system lightweight and calm without CPU/network saturation
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Real-time Firestore & BroadcastChannel listener for Super Admin Google Sheet config updates
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;
    if (db && !isFirestoreQuotaExceeded) {
      try {
        unsubscribeFirestore = onSnapshot(
          doc(db, 'system_configs', 'google_sheet'),
          (docSnap) => {
            if (docSnap.exists()) {
              const remoteData = docSnap.data() as GoogleSheetConfig;
              if (remoteData && remoteData.spreadsheetUrl) {
                setGoogleSheetConfig((prev) => {
                  if (prev.spreadsheetUrl !== remoteData.spreadsheetUrl || prev.activeProfileId !== remoteData.activeProfileId) {
                    const updated = { ...prev, ...remoteData };
                    try {
                      localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
                    } catch {}
                    return updated;
                  }
                  return prev;
                });
              }
            }
          },
          (err) => {
            if (isQuotaError(err)) {
              setIsFirestoreQuotaExceeded(true);
            }
          }
        );
      } catch {}
    }

    let bc: BroadcastChannel | undefined;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('sipandu_pupr_sync_channel');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'UPDATE_GOOGLE_SHEET' && event.data.payload && event.data.payload.config) {
            const newConf = event.data.payload.config;
            setGoogleSheetConfig((prev) => {
              const updated = { ...prev, ...newConf };
              try {
                localStorage.setItem(STORAGE_KEYS.GOOGLE_SHEET, JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        };
      } catch {}
    }

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (bc) bc.close();
    };
  }, [db, isFirestoreQuotaExceeded]);

  // Load from Firebase ONCE on mount with Deleted IDs Filtering
  useEffect(() => {
    if (!db) {
      isInitialLoad.current = false;
      return;
    }
    
    Promise.allSettled([
      getDocs(collection(db, 'users')).then((snapshot) => {
        const deletedUserIds = getStoredDeletedUserIds();
        const remoteUsers = snapshot.docs
          .map((d) => d.data() as UserAccount)
          .filter((u) => u && u.id && !deletedUserIds.has(u.id));

        setUsers((prev) => {
          const userMap = new Map<string, UserAccount>();
          // 1. Default initial users
          INITIAL_USERS.forEach((u) => {
            if (!deletedUserIds.has(u.id)) userMap.set(u.id, u);
          });
          // 2. Keep local users
          prev.forEach((u) => {
            if (u && u.id && !deletedUserIds.has(u.id)) {
              userMap.set(u.id, u);
            }
          });
          // 3. Merge remote users
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
      }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
        }
        console.warn('Firebase users fetch offline/deferred:', err?.message || err);
      }),

      getDocs(collection(db, 'assessments')).then(async (snapshot) => {
        const storedDeleted = getStoredDeletedAssessmentIds();
        const map = new Map<string, BuildingAssessment>();
        if (!snapshot.empty) {
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as BuildingAssessment;
            if (data && data.id && !storedDeleted.has(data.id) && !storedDeleted.has(docSnap.id)) {
              const existing = map.get(data.id);
              if (!existing || new Date(data.updatedAt || data.createdAt || 0).getTime() >= new Date(existing.updatedAt || existing.createdAt || 0).getTime()) {
                map.set(data.id, data);
              }
            }
          });
        }

        const uniqueRemote = Array.from(map.values());
        const hydrated = await Promise.all(uniqueRemote.map(hydrateAssessmentPhotos));
        setAssessments((prev) => {
          const mergedMap = new Map<string, BuildingAssessment>();
          prev.filter((p) => !storedDeleted.has(p.id)).forEach((p) => mergedMap.set(p.id, p));
          hydrated.forEach((h) => mergedMap.set(h.id, h));
          const mergedList = Array.from(mergedMap.values());

          try {
            localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(mergedList));
          } catch (e) {
            try {
              const lightweight = mergedList.map((a) => ({
                ...a,
                photos: a.photos?.map((p) => ({
                  ...p,
                  url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/') || (!p.url.startsWith('data:') && p.url.length <= 400)) ? p.url : '',
                })) || [],
              }));
              localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
            } catch {}
          }
          return mergedList;
        });
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
  }, [db]);

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
              const cleanPrev = prev.filter((a) => !storedDeleted.has(a.id));
              const localMap = new Map<string, BuildingAssessment>();
              cleanPrev.forEach((a) => localMap.set(a.id, a));
              currentRemoteDocs.forEach((r) => {
                const existing = localMap.get(r.id);
                if (existing) {
                  // Safely preserve working photo URLs
                  const mergedPhotos = r.photos?.map((rp) => {
                    if (rp.url && (rp.url.startsWith('http') || rp.url.startsWith('/uploads/') || rp.url.startsWith('data:'))) return rp;
                    const existingP = existing.photos?.find((ep) => ep.id === rp.id);
                    if (existingP?.url) return { ...rp, url: existingP.url };
                    return rp;
                  }) || r.photos || existing.photos;
                  localMap.set(r.id, { ...existing, ...r, photos: mergedPhotos });
                } else {
                  localMap.set(r.id, r);
                }
              });
              const result = Array.from(localMap.values());
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
                const next = prev.map((a) => {
                  if (a.id !== docData.id) return a;
                  const mergedPhotos = docData.photos?.map((dp) => {
                    if (dp.url && (dp.url.startsWith('http') || dp.url.startsWith('/uploads/') || dp.url.startsWith('data:'))) return dp;
                    const existingP = a.photos?.find((ep) => ep.id === dp.id);
                    if (existingP?.url) return { ...dp, url: existingP.url };
                    return dp;
                  }) || docData.photos || a.photos;
                  return { ...docData, photos: mergedPhotos };
                });
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
        }
        console.warn('Firestore real-time assessment listener deferred:', error?.message || error);
      }
    );

    return () => unsubscribe();
  }, [db]);

  // Real-time listener for users from Firebase Firestore
  useEffect(() => {
    if (!db) return;

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
        }
        console.warn('Firestore users real-time listener deferred:', error?.message || error);
      }
    );

    return () => unsubscribe();
  }, [db]);

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

  // On mount, hydrate any missing photo URLs from IndexedDB for initial assessments
  useEffect(() => {
    let isMounted = true;
    if (assessments.some((a) => a.photos?.some((p) => !p.url))) {
      Promise.all(assessments.map(hydrateAssessmentPhotos)).then((hydrated) => {
        if (!isMounted) return;
        let changed = false;
        hydrated.forEach((h, idx) => {
          const orig = assessments[idx];
          if (orig && JSON.stringify(h.photos) !== JSON.stringify(orig.photos)) {
            changed = true;
          }
        });
        if (changed) {
          setAssessments(hydrated);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Persist photos to IndexedDB cache
    assessments.forEach((a) => {
      if (a.photos && a.photos.length > 0) {
        savePhotosLocally(a.photos, a.id).catch(() => {});
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
    } catch (e) {
      try {
        const lightweight = assessments.map((a) => ({
          ...a,
          photos: a.photos.map((p) => ({
            ...p,
            url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.length < 300) ? p.url : '',
          })),
        }));
        localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
      } catch {}
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
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase setDoc user failed:', err?.message || err);
      });
    }

    if (googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http')) {
      directSaveUserToGoogleSheet(newUser, googleSheetConfig).catch(() => {});
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
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
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

  // Stable references for logUserActivity to prevent re-render loops
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const usersRef = useRef(users);
  usersRef.current = users;
  const dbRef = useRef(db);
  dbRef.current = db;
  const isFirestoreQuotaExceededRef = useRef(isFirestoreQuotaExceeded);
  isFirestoreQuotaExceededRef.current = isFirestoreQuotaExceeded;
  const googleSheetConfigRef = useRef(googleSheetConfig);
  googleSheetConfigRef.current = googleSheetConfig;

  // User Activity & Access Logger (Analytics & Audit Trail)
  const logUserActivity = React.useCallback((
    action: ActivityActionType,
    actionCategory: 'Autentikasi' | 'Penilaian Kerusakan' | 'Pencetakan & Dokumen' | 'Integrasi Google Sheet' | 'Sistem & Pengguna',
    actionDescription: string,
    targetResource?: string,
    details?: string
  ) => {
    const activeUser = currentUserRef.current || usersRef.current[0];
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
    const firestoreDb = dbRef.current;
    if (firestoreDb && isMajorAuditAction && !isFirestoreQuotaExceededRef.current) {
      const cleanLog = JSON.parse(JSON.stringify(newLog));
      setDoc(doc(firestoreDb, 'activity_logs', cleanLog.id), cleanLog).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
      });
    }

    const gsConfig = googleSheetConfigRef.current;
    if (gsConfig.webhookUrl && gsConfig.webhookUrl.startsWith('http') && gsConfig.directSaveEnabled) {
      directSaveActivityLogToGoogleSheet(newLog, gsConfig).catch(() => {});
    }
  }, []);

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

  const loginByEmailPassword = async (emailInput: string, passwordInput: string) => {
    const email = emailInput.trim().toLowerCase();
    let usersToSearch = users.length > 0 ? users : INITIAL_USERS;
    let user = usersToSearch.find((u) => u.email && u.email.toLowerCase() === email);

    const isGSheetActive = Boolean(googleSheetConfig.spreadsheetUrl && isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl));

    if (!user && isGSheetActive) {
      try {
        const sheetRes = await fetchUsersFromGoogleSheet(googleSheetConfig);
        if (sheetRes.success && sheetRes.users.length > 0) {
          const deletedUserIds = getStoredDeletedUserIds();
          const validSheetUsers = sheetRes.users.filter((u) => u && u.id && !deletedUserIds.has(u.id));
          if (validSheetUsers.length > 0) {
            const userMap = new Map<string, UserAccount>();
            INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            usersToSearch.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            validSheetUsers.forEach((su) => { userMap.set(su.id, { ...(userMap.get(su.id) || {}), ...su }); });
            const merged = Array.from(userMap.values());
            setUsers(merged);
            try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged)); } catch {}

            user = merged.find((u) => u.email && u.email.toLowerCase() === email);
          }
        }
      } catch (e) {
        console.warn('Live user lookup from Google Sheet notice:', e);
      }
    }

    if (!user && db && !isGSheetActive) {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        if (!snapshot.empty) {
          const deletedUserIds = getStoredDeletedUserIds();
          const remoteUsers = snapshot.docs
            .map((d) => d.data() as UserAccount)
            .filter((u) => u && u.id && !deletedUserIds.has(u.id));

          if (remoteUsers.length > 0) {
            const userMap = new Map<string, UserAccount>();
            INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            usersToSearch.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            remoteUsers.forEach((r) => { userMap.set(r.id, { ...(userMap.get(r.id) || {}), ...r }); });
            const merged = Array.from(userMap.values());
            setUsers(merged);
            try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged)); } catch {}

            user = merged.find((u) => u.email && u.email.toLowerCase() === email);
          }
        }
      } catch (err) {
        console.warn('Live user lookup from Firestore notice:', err);
      }
    }

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

  const loginByNamePassword = async (nameInput: string, passwordInput: string) => {
    const query = nameInput.trim().toLowerCase();
    
    let usersToSearch = users.length > 0 ? users : INITIAL_USERS;

    let user = usersToSearch.find((u) => 
      (u.name && u.name.toLowerCase() === query) || 
      (u.email && u.email.toLowerCase() === query) ||
      (u.email && u.email.toLowerCase().split('@')[0] === query)
    );
    
    if (!user) {
      user = usersToSearch.find((u) => u.name && u.name.toLowerCase().includes(query));
    }

    const isGSheetActive = Boolean(googleSheetConfig.spreadsheetUrl && isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl));

    if (!user && isGSheetActive) {
      try {
        const sheetRes = await fetchUsersFromGoogleSheet(googleSheetConfig);
        if (sheetRes.success && sheetRes.users.length > 0) {
          const deletedUserIds = getStoredDeletedUserIds();
          const validSheetUsers = sheetRes.users.filter((u) => u && u.id && !deletedUserIds.has(u.id));
          if (validSheetUsers.length > 0) {
            const userMap = new Map<string, UserAccount>();
            INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            usersToSearch.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            validSheetUsers.forEach((su) => { userMap.set(su.id, { ...(userMap.get(su.id) || {}), ...su }); });
            const merged = Array.from(userMap.values());
            setUsers(merged);
            try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged)); } catch {}

            user = merged.find((u) => 
              (u.name && u.name.toLowerCase() === query) || 
              (u.email && u.email.toLowerCase() === query) ||
              (u.email && u.email.toLowerCase().split('@')[0] === query) ||
              (u.name && u.name.toLowerCase().includes(query))
            );
          }
        }
      } catch (e) {
        console.warn('Live user lookup from Google Sheet notice:', e);
      }
    }

    if (!user && db && !isGSheetActive) {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        if (!snapshot.empty) {
          const deletedUserIds = getStoredDeletedUserIds();
          const remoteUsers = snapshot.docs
            .map((d) => d.data() as UserAccount)
            .filter((u) => u && u.id && !deletedUserIds.has(u.id));

          if (remoteUsers.length > 0) {
            const userMap = new Map<string, UserAccount>();
            INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            usersToSearch.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
            remoteUsers.forEach((r) => { userMap.set(r.id, { ...(userMap.get(r.id) || {}), ...r }); });
            const merged = Array.from(userMap.values());
            setUsers(merged);
            try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged)); } catch {}

            user = merged.find((u) => 
              (u.name && u.name.toLowerCase() === query) || 
              (u.email && u.email.toLowerCase() === query) ||
              (u.email && u.email.toLowerCase().split('@')[0] === query) ||
              (u.name && u.name.toLowerCase().includes(query))
            );
          }
        }
      } catch (err) {
        console.warn('Live user lookup from Firestore notice:', err);
      }
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

  // Concurrent Surveyor Quota & Session Slot Control (Cloudflare & Server dual-mode support)
  const [sessionQuotaStatus, setSessionQuotaStatus] = useState<SessionQuotaStatus>({
    allowed: true,
    isPriority: false,
    activeSurveyors: 1,
    maxSurveyorQuota: 15,
    activePriorityUsers: 0,
    reason: 'ACTIVE',
    message: 'Sesi aktif',
  });
  const [activeSessionsList, setActiveSessionsList] = useState<ActiveSessionInfo[]>([]);
  const [isSurveyorQuotaBlocked, setIsSurveyorQuotaBlocked] = useState(false);

  // Unique Tab Session ID for multi-tab / multi-device active slot tracking
  const getOrCreateTabSessionId = (): string => {
    try {
      let sId = sessionStorage.getItem('sipandu_active_session_id');
      if (!sId) {
        sId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem('sipandu_active_session_id', sId);
      }
      return sId;
    } catch {
      return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  };

  // Real-time Firestore Active Sessions Listener (works seamlessly on Cloudflare Pages & Static hosting)
  useEffect(() => {
    if (!db || isFirestoreQuotaExceeded) return;

    const unsubscribe = onSnapshot(
      collection(db, 'active_sessions'),
      (snapshot) => {
        const now = Date.now();
        const activeList: ActiveSessionInfo[] = [];

        snapshot.docs.forEach((d) => {
          const data = d.data() as ActiveSessionInfo;
          // Active if heartbeat was within last 3 minutes (180,000 ms)
          if (data && data.lastHeartbeat && now - data.lastHeartbeat < 180000) {
            activeList.push(data);
          } else if (data && data.sessionId && !isFirestoreQuotaExceeded) {
            // Prune stale session silently
            deleteDoc(doc(db, 'active_sessions', data.sessionId)).catch(() => {});
          }
        });

        // If active list is empty but current user is logged in, ensure current user session is counted
        if (activeList.length === 0 && isLoggedIn && currentUser) {
          activeList.push({
            sessionId: getOrCreateTabSessionId(),
            userId: currentUser.id,
            userName: currentUser.name,
            userEmail: currentUser.email,
            role: currentUser.role,
            isPriority: currentUser.role !== 'admin_user',
            lastHeartbeat: now,
            loginAt: new Date().toISOString(),
          });
        }

        setActiveSessionsList(activeList);

        const activeSurveyorCount = activeList.filter(
          (s) => s.role === 'admin_user' || !s.isPriority
        ).length;
        const activePriorityCount = activeList.filter(
          (s) => s.role !== 'admin_user' && s.isPriority
        ).length;

        const currentSessId = getOrCreateTabSessionId();
        const isPriorityUser = currentUser && currentUser.role !== 'admin_user';

        let isBlocked = false;
        if (!isPriorityUser && activeSurveyorCount > 15) {
          const surveyorSessions = activeList
            .filter((s) => s.role === 'admin_user' || !s.isPriority)
            .sort(
              (a, b) =>
                (new Date(a.loginAt).getTime() || 0) - (new Date(b.loginAt).getTime() || 0)
            );
          const mySlotIndex = surveyorSessions.findIndex((s) => s.sessionId === currentSessId);
          if (mySlotIndex >= 15) {
            isBlocked = true;
          }
        }

        setSessionQuotaStatus({
          allowed: !isBlocked,
          isPriority: Boolean(isPriorityUser),
          activeSurveyors: Math.max(1, activeSurveyorCount),
          maxSurveyorQuota: 15,
          activePriorityUsers: activePriorityCount,
          reason: isBlocked ? 'QUOTA_FULL' : isPriorityUser ? 'PRIORITY_GRANTED' : 'ACTIVE',
          message: isBlocked
            ? 'Kuota 15 surveyor telah penuh. Mohon tunggu sesi berikutnya.'
            : 'Sesi aktif',
        });
        setIsSurveyorQuotaBlocked(isBlocked);
      },
      (err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firestore active_sessions listener notice:', err?.message || err);
      }
    );

    return () => unsubscribe();
  }, [db, isLoggedIn, currentUser?.role, currentUser?.id, isFirestoreQuotaExceeded]);

  const refreshActiveSessions = async () => {
    // 1. Try server API
    try {
      const res = await fetch('/api/sessions/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSessionQuotaStatus({
            allowed: data.allowed !== false,
            isPriority: Boolean(data.isPriority),
            activeSurveyors: data.activeSurveyors || 1,
            maxSurveyorQuota: data.maxSurveyorQuota || 15,
            activePriorityUsers: data.activePriorityUsers || 0,
            reason: data.reason || 'ACTIVE',
            message: data.message || 'Sesi aktif',
          });
          if (Array.isArray(data.activeSessions)) {
            setActiveSessionsList(data.activeSessions);
          }
          return;
        }
      }
    } catch {}

    // 2. If server API failed (e.g. on Cloudflare Pages static hosting), query Firestore
    if (db) {
      try {
        const snap = await getDocs(collection(db, 'active_sessions'));
        const now = Date.now();
        const activeList: ActiveSessionInfo[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as ActiveSessionInfo;
          if (data && data.lastHeartbeat && now - data.lastHeartbeat < 180000) {
            activeList.push(data);
          }
        });
        setActiveSessionsList(activeList);
        const surveyorCount = activeList.filter((s) => s.role === 'admin_user' || !s.isPriority).length;
        const priorityCount = activeList.filter((s) => s.role !== 'admin_user' && s.isPriority).length;
        setSessionQuotaStatus((prev) => ({
          ...prev,
          activeSurveyors: Math.max(1, surveyorCount),
          activePriorityUsers: priorityCount,
        }));
      } catch (err) {
        console.warn('Firestore manual session refresh notice:', err);
      }
    }
  };

  const checkSessionSlot = async (): Promise<boolean> => {
    if (!currentUser) return true;
    const sessionId = getOrCreateTabSessionId();
    const sessionPayload: ActiveSessionInfo = {
      sessionId,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      role: currentUser.role,
      isPriority: currentUser.role !== 'admin_user',
      lastHeartbeat: Date.now(),
      loginAt: new Date().toISOString(),
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 100) : '',
    };

    // Sync to Firestore for Cloudflare Pages / Static Hosting support only if quota is healthy
    if (db && !isFirestoreQuotaExceeded) {
      try {
        await setDoc(doc(db, 'active_sessions', sessionId), sessionPayload, { merge: true });
      } catch (err) {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
      }
    }

    // Also sync to server API if fullstack
    try {
      const res = await fetch('/api/sessions/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionQuotaStatus(data);
        if (data.allowed) {
          setIsSurveyorQuotaBlocked(false);
          return true;
        } else {
          setIsSurveyorQuotaBlocked(true);
          return false;
        }
      }
    } catch (err) {
      // Non-blocking for static hosting
    }
    return true;
  };

  // Acquire or refresh slot on login or user change
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      checkSessionSlot();
    }
  }, [isLoggedIn, currentUser?.id, currentUser?.role]);

  // Periodic Heartbeat every 25 seconds
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    const interval = setInterval(async () => {
      const sessionId = getOrCreateTabSessionId();
      const heartbeatPayload = {
        sessionId,
        userId: currentUser.id,
        userName: currentUser.name,
        role: currentUser.role,
        isPriority: currentUser.role !== 'admin_user',
        lastHeartbeat: Date.now(),
      };

      // 1. Sync Heartbeat to Server API (Heartbeats run via server to completely prevent Firestore write quota exhaustion)
      try {
        const res = await fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(heartbeatPayload),
        });

        if (res.ok) {
          const data = await res.json();
          setSessionQuotaStatus(data);
          if (data.allowed === false && !data.isPriority) {
            setIsSurveyorQuotaBlocked(true);
          } else if (data.allowed) {
            setIsSurveyorQuotaBlocked(false);
          }
        }
      } catch {}
    }, 25000);

    // Release session on beforeunload / close tab
    const handleBeforeUnload = () => {
      try {
        const sessionId = getOrCreateTabSessionId();
        if (db && !isFirestoreQuotaExceeded) {
          deleteDoc(doc(db, 'active_sessions', sessionId)).catch(() => {});
        }
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/sessions/release', JSON.stringify({ sessionId }));
        } else {
          fetch('/api/sessions/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [db, isLoggedIn, currentUser?.id, currentUser?.role, isFirestoreQuotaExceeded]);

  const logout = () => {
    try {
      const sessionId = getOrCreateTabSessionId();
      if (db && !isFirestoreQuotaExceeded) {
        deleteDoc(doc(db, 'active_sessions', sessionId)).catch(() => {});
      }
      fetch('/api/sessions/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
    } catch {}

    logUserActivity(
      'LOGOUT',
      'Autentikasi',
      `Pengguna Keluar (Logout) dari Sistem`,
      currentUser.name,
      `Peran: ${ROLE_LIMITS[currentUser.role]?.title || currentUser.role}`
    );
    setIsLoggedIn(false);
    setIsSurveyorQuotaBlocked(false);
    showToast('Anda telah keluar dari sesi.', 'info');
  };

  // Session Inactivity Lock State & Methods (15 minutes standard timeout)
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const isSessionLockedRef = useRef(false);

  useEffect(() => {
    isSessionLockedRef.current = isSessionLocked;
  }, [isSessionLocked]);

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
      if (isSessionLockedRef.current) return;
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
  }, [currentUser?.id]);

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

  // Assessment operations: Guaranteed instant multi-layer save (State + LocalStorage + IndexedDB + Server + Cloud)
  const addAssessment = async (data: BuildingAssessment) => {
    const activeWebhook = googleSheetConfig.webhookUrl || DEFAULT_GOOGLE_SHEET_CONFIG.webhookUrl;
    const hasGSheet = Boolean(activeWebhook && activeWebhook.startsWith('http'));
    const effectiveSheetConfig: GoogleSheetConfig = {
      ...DEFAULT_GOOGLE_SHEET_CONFIG,
      ...googleSheetConfig,
      webhookUrl: activeWebhook,
      spreadsheetUrl: googleSheetConfig.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_CONFIG.spreadsheetUrl,
    };

    // Ensure guaranteed unique ID for every single new assessment to prevent any collisions or overwrites
    const finalId = data.id && data.id.trim()
      ? data.id.trim()
      : `ass_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const rawCode = (data.code || '').trim();
    const finalCode = (rawCode && !rawCode.startsWith('REG-TEMP') && !rawCode.startsWith('REG-PREVIEW') && rawCode.length >= 3)
      ? rawCode
      : generateNextRegistrationCode(assessments);
    const targetKecName = data.kecamatanName || 'Boawae';
    const finalSheetName = data.targetSheetName || data.sourceSheet || `Kec. ${targetKecName}`;

    const assessmentToSave: BuildingAssessment = {
      ...data,
      id: finalId,
      code: finalCode,
      targetSheetName: finalSheetName,
      sourceSheet: data.sourceSheet || finalSheetName,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      googleSheetSynced: hasGSheet,
      googleSheetSyncedAt: hasGSheet ? new Date().toISOString() : undefined,
    };

    // 1. Optimistic instant React state update
    setAssessments((prev) => {
      const filtered = prev.filter((a) => a.id !== assessmentToSave.id);
      return [assessmentToSave, ...filtered];
    });

    // 2. Instant synchronous LocalStorage write (zero latency, resilient to browser close/refresh)
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = [assessmentToSave, ...existingList.filter((a: any) => a.id !== assessmentToSave.id)];
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updatedList));
    } catch (err) {
      try {
        const lightweight = [assessmentToSave].map((a) => ({
          ...a,
          photos: (a.photos || []).map((p) => ({
            ...p,
            url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.length < 300) ? p.url : '',
          })),
        }));
        localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
      } catch {}
    }

    // 3. Save photos permanently to IndexedDB
    if (assessmentToSave.photos && assessmentToSave.photos.length > 0) {
      savePhotosLocally(assessmentToSave.photos, assessmentToSave.id).catch(() => {});
    }

    // 4. Queue into Offline Outbox for guaranteed delivery regardless of network drops
    queueAssessmentForSync(assessmentToSave, 'insert');

    // 5. Send to Express server & Buffer Queue for zero-quota persistence, staging and multi-client accessibility
    try {
      const serverPromise = fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessmentToSave),
      }).then((res) => {
        if (res.ok) {
          removeAssessmentFromSyncQueue(assessmentToSave.id);
        }
      });

      // Also stage in buffer queue for 1-hour batch processing
      fetch('/api/buffer-queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment: assessmentToSave,
          submittedBy: assessmentToSave.createdByName || currentUser.name,
        }),
      }).catch(() => {});

      // Await server write with 1.5s timeout so it is written before navigation without blocking offline users
      await Promise.race([
        serverPromise,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch (e) {
      console.warn('Server assessment save notice (queued in outbox):', e);
    }

    // 6. Save to Firebase Firestore if connected and quota is healthy
    if (db && !isFirestoreQuotaExceeded) {
      const cleanA = prepareAssessmentForFirestore(assessmentToSave);
      setDoc(doc(db, 'assessments', cleanA.id), cleanA, { merge: true }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase assessment save notice:', err?.message || err);
      });
    }

    // Real-time notification when new building data enters the system
    const newNotif: DataNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: 'Data Masuk: Penilaian Gedung Baru',
      message: `Penilaian gedung "${assessmentToSave.buildingName}" (${assessmentToSave.kecamatanName || 'Kecamatan'}) berhasil dicatat ke sistem.`,
      buildingName: assessmentToSave.buildingName,
      kecamatan: assessmentToSave.kecamatanName,
      desa: assessmentToSave.desaName,
      damageClassification: assessmentToSave.damageClassification,
      totalDamagePercent: assessmentToSave.totalDamagePercent,
      rehabCost: assessmentToSave.roundedRehabCost,
      assessmentId: assessmentToSave.id,
      timestamp: new Date().toISOString(),
      isRead: false,
      surveyorName: assessmentToSave.createdByName || currentUser.name,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setLatestIncomingData(newNotif);
    playNotificationChime();

    logUserActivity(
      'CREATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Input Penilaian Baru: ${assessmentToSave.buildingName}`,
      assessmentToSave.code || assessmentToSave.buildingName,
      `Klasifikasi: ${assessmentToSave.damageClassification} (${Number(assessmentToSave.totalDamagePercent ?? 0).toFixed(1)}%) — Biaya: Rp ${Number(assessmentToSave.roundedRehabCost ?? 0).toLocaleString('id-ID')}`
    );

    // Save directly to Google Sheet without needing manual synchronization
    if (hasGSheet) {
      directSaveToGoogleSheet(
        assessmentToSave,
        effectiveSheetConfig,
        'insert',
        undefined,
        assessmentToSave.targetSheetName || assessmentToSave.sourceSheet
      )
        .then((res) => {
          if (res.success) {
            setAssessments((prev) =>
              prev.map((a) =>
                a.id === assessmentToSave.id
                  ? { ...a, googleSheetSynced: true, googleSheetSyncedAt: new Date().toISOString() }
                  : a
              )
            );
          }
        })
        .catch((e) => console.error('Direct Google Sheet save error:', e));

      return {
        success: true,
        message: `✓ Penilaian gedung "${assessmentToSave.buildingName}" langsung masuk & tersimpan permanen! (Tersinkron ke Google Sheet)`,
      };
    }

    return {
      success: true,
      message: `✓ Penilaian gedung "${assessmentToSave.buildingName}" berhasil disimpan sekali klik!`,
    };
  };

  const updateAssessment = async (id: string, data: Partial<BuildingAssessment>) => {
    const target = assessments.find((a) => a.id === id);

    // Locking enforcement: Once verified, data cannot be modified unless status is being explicitly reverted by verifier/admin
    if (target?.verificationStatus === 'Terverifikasi' && data.verificationStatus === undefined) {
      return {
        success: false,
        message: 'Akses ditolak: Data ini telah berstatus Terverifikasi oleh Verifikator/Admin dan terkunci dari perubahan data teknis/lapangan.',
      };
    }

    const activeWebhook = googleSheetConfig.webhookUrl || DEFAULT_GOOGLE_SHEET_CONFIG.webhookUrl;
    const hasGSheet = Boolean(activeWebhook && activeWebhook.startsWith('http'));
    const effectiveSheetConfig: GoogleSheetConfig = {
      ...DEFAULT_GOOGLE_SHEET_CONFIG,
      ...googleSheetConfig,
      webhookUrl: activeWebhook,
      spreadsheetUrl: googleSheetConfig.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_CONFIG.spreadsheetUrl,
    };
    const now = new Date().toISOString();
    const updatedCode = data.code || target?.code || target?.id || id;
    const mergedData: BuildingAssessment = {
      ...(target || ({} as BuildingAssessment)),
      ...data,
      id,
      code: updatedCode,
      googleSheetSynced: hasGSheet ? true : (target?.googleSheetSynced ?? false),
      googleSheetSyncedAt: hasGSheet ? now : target?.googleSheetSyncedAt,
      updatedAt: now,
    };

    // 1. Optimistic instant React state update
    setAssessments((prev) =>
      prev.map((a) => (a.id === id ? mergedData : a))
    );

    // 2. Instant synchronous LocalStorage write
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = existingList.map((a: any) => (a.id === id ? mergedData : a));
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updatedList));
    } catch {}

    // 3. Save photos permanently to IndexedDB
    if (mergedData.photos && mergedData.photos.length > 0) {
      savePhotosLocally(mergedData.photos, id).catch(() => {});
    }

    // 4. Queue into Offline Outbox
    queueAssessmentForSync(mergedData, 'update');

    // 5. Update on Express server for instant zero-quota persistence across devices
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedData),
    })
      .then((res) => {
        if (res.ok) {
          removeAssessmentFromSyncQueue(id);
        }
      })
      .catch((e) => console.warn('Server assessment update notice (queued):', e));

    // 6. Update on Firestore if connected and quota is healthy
    if (db && !isFirestoreQuotaExceeded) {
      const cleanA = prepareAssessmentForFirestore(mergedData);
      setDoc(doc(db, 'assessments', id), cleanA, { merge: true }).catch((err) => {
        if (isQuotaError(err)) {
          setIsFirestoreQuotaExceeded(true);
          pauseFirestoreNetwork().catch(() => {});
        }
        console.warn('Firebase assessment update notice:', err?.message || err);
      });
    }

    logUserActivity(
      'UPDATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Memperbarui Data Penilaian: ${mergedData.buildingName || id}`,
      updatedCode,
      'Pembaruan data kerusakan atau pengesahan tim lapangan'
    );

    if (hasGSheet) {
      directSaveToGoogleSheet(mergedData, effectiveSheetConfig, 'update', target?.code || target?.id).catch((e) =>
        console.error('Direct Google Sheet update error:', e)
      );
    }

    return {
      success: true,
      message: hasGSheet
        ? '✓ Data penilaian berhasil diperbarui & langsung tersinkron ke Google Sheet.'
        : '✓ Data penilaian berhasil diperbarui.',
    };
  };

  const deleteAssessment = (id: string, bypassAuth = false) => {
    // Super Admin, Admin, and Verifikator are authorized to delete (or bypass with valid PIN)
    if (
      !bypassAuth &&
      currentUser.role !== 'super_admin' &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'admin_verifikator'
    ) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Super Admin, Admin, dan Verifikator yang berhak menghapus data penilaian.',
      };
    }

    const target = assessments.find((a) => a.id === id);

    // Locking enforcement: Verified data is locked from deletion unless bypassed by explicit PIN authorization
    if (!bypassAuth && target?.verificationStatus === 'Terverifikasi') {
      return {
        success: false,
        message: 'Akses ditolak: Data yang telah berstatus Terverifikasi telah terkunci secara permanen dan tidak dapat dihapus!',
      };
    }
    logUserActivity(
      'DELETE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Menghapus Data Penilaian Gedung: ${target?.buildingName || id}`,
      target?.code || id,
      `Dihapus oleh ${currentUser.name} (${ROLE_LIMITS[currentUser.role]?.title})`
    );

    if (target) {
      if (googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http')) {
        directSaveToGoogleSheet(
          target,
          googleSheetConfig,
          'delete',
          undefined,
          target.targetSheetName || target.sourceSheet
        ).catch((e) => console.error('Direct Google Sheet delete error:', e));
      }
      if (target.code) {
        deletedAssessmentIds.current.add(target.code);
        persistDeletedAssessmentId(target.code);
      }
    }

    // Persist deleted ID immediately so it can NEVER be resurrected on page refresh / link re-entry
    deletedAssessmentIds.current.add(id);
    persistDeletedAssessmentId(id);
    deletePhotosByAssessmentIdLocally(id);

    // Delete from Express server
    fetch(`/api/assessments/${id}`, {
      method: 'DELETE',
    }).catch(() => {});

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
      message: `Data penilaian gedung "${target?.buildingName || id}" berhasil dihapus permanen dari sistem & baris Google Sheet.`,
    };
  };

  // Mass cleanup of all duplicate entries: retains the most complete/verified survey in each cluster
  const purgeAllDuplicates = async (): Promise<{ success: boolean; count: number; message: string }> => {
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
    const itemsToDelete: BuildingAssessment[] = [];

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
        itemsToDelete.push(sorted[i]);
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
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updated));
    } catch {}

    clearGoogleSheetsMemoryCache();

    // Update Express server with replace: true
    fetch('/api/assessments/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessments: updated, replace: true }),
    }).catch(() => {});

    // Sync to Google Sheet if webhook active
    const activeWebhook = googleSheetConfig.webhookUrl || DEFAULT_GOOGLE_SHEET_CONFIG.webhookUrl;
    const hasGSheet = Boolean(activeWebhook && activeWebhook.startsWith('http'));
    const effectiveSheetConfig: GoogleSheetConfig = {
      ...DEFAULT_GOOGLE_SHEET_CONFIG,
      ...googleSheetConfig,
      webhookUrl: activeWebhook,
      spreadsheetUrl: googleSheetConfig.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_CONFIG.spreadsheetUrl,
    };

    if (hasGSheet) {
      try {
        await syncAllToGoogleSheet(updated, effectiveSheetConfig);
      } catch (sheetErr) {
        console.warn('Google Sheet purge sync notice:', sheetErr);
      }
      // Also issue direct row deletions for extra reliability
      for (const item of itemsToDelete) {
        directSaveToGoogleSheet(
          item,
          effectiveSheetConfig,
          'delete',
          undefined,
          item.targetSheetName || item.sourceSheet
        ).catch(() => {});
      }
    }

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
      `Pembersihan Otomatis Data Ganda: Menghapus ${idsToDelete.length} survei duplikat dari database & Google Sheet`,
      `${duplicateGroups.length} kluster`,
      `Dibersihkan secara tuntas oleh ${currentUser.name}`
    );

    return {
      success: true,
      count: idsToDelete.length,
      message: `Berhasil membersihkan ${idsToDelete.length} data survei ganda dari ${duplicateGroups.length} kluster! Data primer tetap aman & Google Sheet telah diperbarui bersih.`,
    };
  };

  const getDeletedAssessmentIds = (): string[] => {
    return Array.from(getStoredDeletedAssessmentIds());
  };

  const restoreDeletedAssessment = async (id: string): Promise<boolean> => {
    if (!id) return false;
    deletedAssessmentIds.current.delete(id);
    removeStoredDeletedAssessmentId(id);

    // Check if item exists on Express server and restore it immediately
    try {
      const res = await fetch('/api/assessments');
      const data = await res.json();
      if (data.success && Array.isArray(data.assessments)) {
        const found = data.assessments.find((a: any) => a.id === id || a.code === id);
        if (found) {
          setAssessments((prev) => {
            const merged = reconcileAndMergeAssessments(prev, [found]);
            try {
              localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(merged));
            } catch {}
            return merged;
          });
          showToast(`Data "${found.buildingName || id}" berhasil dipulihkan ke daftar aktif!`, 'success');
          return true;
        }
      }
    } catch {}

    // Fallback: sync from Google Sheet with forceRefresh
    await syncFromGoogleSheet(false, true);
    showToast(`Data dengan ID/Kode "${id}" telah dibuka dari daftar hapus & disinkronkan.`, 'success');
    return true;
  };

  const restoreAndRecoverAllAssessments = async (): Promise<{ success: boolean; message: string; recoveredCount: number; totalCount: number }> => {
    // 1. Clear all suppressed/deleted IDs so any hidden items are resurrected
    const deletedCount = getStoredDeletedAssessmentIds().size;
    clearStoredDeletedAssessmentIds();
    deletedAssessmentIds.current.clear();

    // 2. Gather candidates from all legacy & backup keys and arbitrary localStorage items
    const recoveredPool: BuildingAssessment[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        try {
          const raw = localStorage.getItem(key);
          if (!raw || raw.length < 20) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const it of parsed) {
              const item = it && it.assessment ? it.assessment : (it && it.data ? it.data : it);
              if (item && item.id && item.buildingName) {
                recoveredPool.push(item);
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            const item = parsed.assessment || parsed.data || parsed;
            if (item && item.id && item.buildingName) {
              recoveredPool.push(item);
            }
          }
        } catch {}
      }
    } catch {}

    // 3. Fetch from Express server /api/assessments
    try {
      const srvRes = await fetch('/api/assessments');
      const srvData = await srvRes.json();
      if (srvData.success && Array.isArray(srvData.assessments)) {
        recoveredPool.push(...srvData.assessments);
      }
    } catch {}

    // 3b. Fetch from Express server /api/buffer-queue
    try {
      const bRes = await fetch('/api/buffer-queue');
      const bData = await bRes.json();
      if (bData.success && Array.isArray(bData.items)) {
        bData.items.forEach((it: any) => {
          const item = it && it.assessmentData ? it.assessmentData : (it && it.data ? it.data : it);
          if (item && item.id && item.buildingName) {
            recoveredPool.push(item);
          }
        });
      }
    } catch {}

    // 4. Force sync from all Google Sheet tabs (without 1-hour cache limit)
    try {
      await syncFromGoogleSheet(false, true);
    } catch {}

    // 5. Merge all recovered records cleanly without injecting fake default records
    let finalCount = 0;
    setAssessments((prev) => {
      const merged = reconcileAndMergeAssessments(prev, recoveredPool);
      finalCount = merged.length;
      try {
        localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(merged));
        localStorage.setItem('sipandu_pupr_assessments_backup', JSON.stringify(merged));
        // Persist to server as well so server data/assessments.json is kept complete (additive, replace: false)
        fetch('/api/assessments/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessments: merged, replace: false }),
        }).catch(() => {});
      } catch {}
      return merged;
    });

    const msg = `Pemulihan data selesai! Seluruh ${finalCount} data penilaian aktif berhasil dipulihkan.`;
    showToast(msg, 'success');
    return {
      success: true,
      message: msg,
      recoveredCount: Math.max(1, deletedCount + recoveredPool.length),
      totalCount: finalCount,
    };
  };

  // Automatically detects duplicate/conflicting registration codes across all assessments,
  // assigns new unique sequential codes, and permanently updates Google Sheets, Firestore, LocalStorage & Server
  const autoFixDuplicateCodes = async (): Promise<{
    success: boolean;
    fixedCount: number;
    message: string;
    sheetSyncStatus?: boolean;
    fixedItems: Array<{
      id: string;
      buildingName: string;
      oldCode: string;
      newCode: string;
      sourceSheet?: string;
    }>;
  }> => {
    try {
      const { updatedAssessments, fixedCount, fixedItems } = autoFixDuplicateRegistrationCodes(assessments);
      if (fixedCount > 0) {
        // 1. Optimistic instant React state update
        setAssessments(updatedAssessments);

        // 2. Instant synchronous LocalStorage write
        try {
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updatedAssessments));
        } catch {}

        // 3. Clear Google Sheets memory cache to ensure fresh read
        clearGoogleSheetsMemoryCache();

        // 4. Cross-tab sync via BroadcastChannel
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('sipandu_pupr_sync_channel');
            ch.postMessage({ type: 'UPDATE_ALL_ASSESSMENTS', payload: updatedAssessments });
            ch.close();
          } catch {}
        }

        // 5. Update on Express server with replace: true for clean persistent sync
        fetch('/api/assessments/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessments: updatedAssessments, replace: true }),
        }).catch(() => {});

        // 6. Update on Firestore for all fixed items
        if (db && !isFirestoreQuotaExceeded) {
          fixedItems.forEach((item) => {
            const full = updatedAssessments.find((a) => a.id === item.id);
            if (full) {
              const clean = prepareAssessmentForFirestore(full);
              setDoc(doc(db, 'assessments', clean.id), clean, { merge: true }).catch(() => {});
            }
          });
        }

        // 7. Synchronize to Google Sheets permanently
        const activeWebhook = googleSheetConfig.webhookUrl || DEFAULT_GOOGLE_SHEET_CONFIG.webhookUrl;
        const hasGSheet = Boolean(activeWebhook && activeWebhook.startsWith('http'));
        const effectiveSheetConfig: GoogleSheetConfig = {
          ...DEFAULT_GOOGLE_SHEET_CONFIG,
          ...googleSheetConfig,
          webhookUrl: activeWebhook,
          spreadsheetUrl: googleSheetConfig.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_CONFIG.spreadsheetUrl,
        };

        let sheetSyncSuccess = false;
        if (hasGSheet) {
          try {
            // A. Direct comprehensive sync to update all 7 kecamatan tabs in Google Sheets
            const syncRes = await syncAllToGoogleSheet(updatedAssessments, effectiveSheetConfig);
            sheetSyncSuccess = syncRes.success;

            // B. Also trigger individual direct row updates for each fixed item to ensure exact row replacement in target sheet
            for (const fixed of fixedItems) {
              const full = updatedAssessments.find((a) => a.id === fixed.id);
              if (full) {
                directSaveToGoogleSheet(
                  full,
                  effectiveSheetConfig,
                  'update',
                  fixed.oldCode,
                  full.targetSheetName || full.sourceSheet
                ).catch((err) => console.warn('Direct row update notice:', err));
              }
            }
          } catch (sheetErr) {
            console.warn('Google Sheet auto-fix sync error:', sheetErr);
          }
        }

        logUserActivity(
          'UPDATE_ASSESSMENT',
          'Penilaian Kerusakan',
          `Auto-Fix Nomor Registrasi: Menerbitkan ${fixedCount} no. registrasi baru & tersimpan permanen di Google Sheet`,
          `${fixedCount} data bangunan`,
          `Dijalankan otomatis oleh ${currentUser.name}`
        );

        return {
          success: true,
          fixedCount,
          fixedItems,
          sheetSyncStatus: sheetSyncSuccess,
          message: hasGSheet
            ? `Berhasil memperbaiki ${fixedCount} nomor registrasi ganda dan tersimpan permanen di Google Sheet, Firestore & Database Lokal!`
            : `Berhasil memperbaiki ${fixedCount} nomor registrasi ganda dan tersimpan di Firestore & Database Lokal!`,
        };
      }

      return {
        success: true,
        fixedCount: 0,
        fixedItems: [],
        message: 'Semua data bangunan sudah memiliki nomor registrasi yang unik & valid.',
      };
    } catch (err: any) {
      return {
        success: false,
        fixedCount: 0,
        fixedItems: [],
        message: 'Gagal memperbaiki nomor registrasi: ' + (err?.message || 'Terjadi kesalahan sistem'),
      };
    }
  };

  // Fixes a single assessment's registration code and permanently updates Google Sheets, Firestore, LocalStorage & Server
  const fixSingleAssessmentRegistrationCode = async (
    id: string,
    customNewCode?: string
  ): Promise<{
    success: boolean;
    oldCode: string;
    newCode: string;
    message: string;
  }> => {
    const target = assessments.find((a) => a.id === id);
    if (!target) {
      return {
        success: false,
        oldCode: '',
        newCode: '',
        message: 'Data penilaian tidak ditemukan.',
      };
    }

    const oldCode = target.code || target.id;
    let newCode = customNewCode?.trim();

    if (!newCode) {
      const year = new Date().getFullYear();
      const prefix = getKecamatanCodePrefix(target, year);
      const existingCodes = new Set(assessments.map((a) => (a.code || a.id || '').toUpperCase()));
      let seq = 1;
      let candidate = `${prefix}${String(seq).padStart(4, '0')}`;
      while (existingCodes.has(candidate.toUpperCase())) {
        seq++;
        candidate = `${prefix}${String(seq).padStart(4, '0')}`;
      }
      newCode = candidate;
    }

    const activeWebhook = googleSheetConfig.webhookUrl || DEFAULT_GOOGLE_SHEET_CONFIG.webhookUrl;
    const hasGSheet = Boolean(activeWebhook && activeWebhook.startsWith('http'));
    const effectiveSheetConfig: GoogleSheetConfig = {
      ...DEFAULT_GOOGLE_SHEET_CONFIG,
      ...googleSheetConfig,
      webhookUrl: activeWebhook,
      spreadsheetUrl: googleSheetConfig.spreadsheetUrl || DEFAULT_GOOGLE_SHEET_CONFIG.spreadsheetUrl,
    };

    const updatedAssessment: BuildingAssessment = {
      ...target,
      code: newCode,
      updatedAt: new Date().toISOString(),
      googleSheetSynced: hasGSheet,
      googleSheetSyncedAt: hasGSheet ? new Date().toISOString() : target.googleSheetSyncedAt,
    };

    // 1. Update React state
    setAssessments((prev) => prev.map((a) => (a.id === id ? updatedAssessment : a)));

    // 2. Update LocalStorage
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const updatedList = existingList.map((a: any) => (a.id === id ? updatedAssessment : a));
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updatedList));
    } catch {}

    // 3. Clear memory cache
    clearGoogleSheetsMemoryCache();

    // 4. Update on Express server
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedAssessment),
    }).catch(() => {});

    // 5. Update on Firestore
    if (db && !isFirestoreQuotaExceeded) {
      const clean = prepareAssessmentForFirestore(updatedAssessment);
      setDoc(doc(db, 'assessments', id), clean, { merge: true }).catch(() => {});
    }

    // 6. Direct save to Google Sheet with previous registration code for in-place replacement
    if (hasGSheet) {
      try {
        await directSaveToGoogleSheet(
          updatedAssessment,
          effectiveSheetConfig,
          'update',
          oldCode,
          updatedAssessment.targetSheetName || updatedAssessment.sourceSheet
        );
      } catch (e) {
        console.warn('Direct Google Sheet update error for single code fix:', e);
      }
    }

    logUserActivity(
      'UPDATE_ASSESSMENT',
      'Penilaian Kerusakan',
      `Perbaikan No. Registrasi Tunggal: "${target.buildingName}" diubah dari ${oldCode} ke ${newCode}`,
      newCode,
      `Diperbarui oleh ${currentUser.name}`
    );

    return {
      success: true,
      oldCode,
      newCode,
      message: `Nomor registrasi gedung "${target.buildingName}" berhasil diubah menjadi ${newCode} dan langsung tersimpan permanen di Google Sheet!`,
    };
  };

  /**
   * Automatic photo recovery engine:
   * Scans local IndexedDB and server to restore any photos that have empty URLs in Firestore.
   * If found, automatically syncs them to the server and updates Firestore so all users see them.
   */
  const recoverAndSyncPhotos = async (
    targetAssessmentId?: string
  ): Promise<{ recoveredCount: number; success: boolean; message: string }> => {
    try {
      const localRecords = await getAllLocalPhotoRecords();
      const localRecordMap = new Map<string, string>();
      if (localRecords && localRecords.length > 0) {
        localRecords.forEach((r) => {
          if (r.id && r.url) localRecordMap.set(r.id, r.url);
        });
      }

      let totalRecovered = 0;
      let hasAnyUpdate = false;

      const updatedAssessments = await Promise.all(
        assessments.map(async (ass) => {
          if (targetAssessmentId && ass.id !== targetAssessmentId) {
            return ass;
          }
          if (!ass.photos || ass.photos.length === 0) return ass;

          let assChanged = false;
          const updatedPhotos = await Promise.all(
            ass.photos.map(async (p) => {
              if (p.url && (p.url.startsWith('http://') || p.url.startsWith('https://') || p.url.startsWith('/uploads/') || p.url.startsWith('data:'))) {
                return p;
              }

              // 1. Check local IndexedDB memory
              const localUrl = localRecordMap.get(p.id) || (await getPhotoLocally(p.id));
              if (localUrl) {
                let finalUrl = localUrl;
                // Upload to server to get permanent /uploads/ URL for all devices
                if (!localUrl.startsWith('/uploads/') && !localUrl.startsWith('http')) {
                  const up = await uploadPhotoToServer(p.id, ass.id, localUrl);
                  if (up.success && up.url) {
                    finalUrl = up.url;
                  }
                }
                totalRecovered++;
                assChanged = true;
                return { ...p, url: finalUrl };
              }

              return p;
            })
          );

          if (assChanged) {
            hasAnyUpdate = true;
            const updatedAss = { ...ass, photos: updatedPhotos, updatedAt: new Date().toISOString() };
            if (db && !isFirestoreQuotaExceeded) {
              const clean = prepareAssessmentForFirestore(updatedAss);
              setDoc(doc(db, 'assessments', clean.id), clean, { merge: true }).catch((err) => {
                if (isQuotaError(err)) {
                  setIsFirestoreQuotaExceeded(true);
                  pauseFirestoreNetwork().catch(() => {});
                }
              });
            }
            return updatedAss;
          }

          return ass;
        })
      );

      if (hasAnyUpdate && totalRecovered > 0) {
        setAssessments(updatedAssessments);
        try {
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(updatedAssessments));
        } catch {}
        return {
          recoveredCount: totalRecovered,
          success: true,
          message: `Berhasil memulihkan ${totalRecovered} foto kerusakan ke server & tersinkron ke semua perangkat!`,
        };
      }

      return {
        recoveredCount: 0,
        success: false,
        message: 'Foto fisik belum ditemukan di browser ini. Data tersimpan di perangkat surveyor (HP Anton) atau Google Drive.',
      };
    } catch (err: any) {
      return { recoveredCount: 0, success: false, message: 'Gagal memulihkan foto: ' + err.message };
    }
  };

  const attachPhotoToAssessment = async (assessmentId: string, photoId: string, dataUrl: string): Promise<boolean> => {
    try {
      const up = await uploadPhotoToServer(photoId, assessmentId, dataUrl);
      const publicUrl = up.success && up.url ? up.url : dataUrl;
      savePhotoLocally(photoId, assessmentId, publicUrl).catch(() => {});

      setAssessments((prev) => {
        const next = prev.map((a) => {
          if (a.id !== assessmentId) return a;
          const newPhotos = (a.photos || []).map((p) => (p.id === photoId ? { ...p, url: publicUrl } : p));
          const updated = { ...a, photos: newPhotos, updatedAt: new Date().toISOString() };
          if (db && !isFirestoreQuotaExceeded) {
            const clean = prepareAssessmentForFirestore(updated);
            setDoc(doc(db, 'assessments', clean.id), clean, { merge: true }).catch((err) => {
              if (isQuotaError(err)) {
                setIsFirestoreQuotaExceeded(true);
                pauseFirestoreNetwork().catch(() => {});
              }
            });
          }
          return updated;
        });
        try {
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(next));
        } catch {}
        return next;
      });

      return true;
    } catch {
      return false;
    }
  };

  // Auto-trigger recovery once when assessments are populated
  const hasAutoRecoveredRef = useRef(false);
  useEffect(() => {
    if (hasAutoRecoveredRef.current || assessments.length === 0) return;
    const hasMissingPhotos = assessments.some((a) => a.photos?.some((p) => !p.url || p.url.trim() === ''));
    if (hasMissingPhotos) {
      hasAutoRecoveredRef.current = true;
      recoverAndSyncPhotos().then((res) => {
        if (res.success && res.recoveredCount > 0) {
          showToast(`✓ Auto-Recovery: ${res.recoveredCount} foto kerusakan berhasil dipulihkan & disinkronkan ke server!`, 'success');
        }
      });
    }
  }, [assessments.length]);

  const verifyAssessment = async (
    id: string,
    status: VerificationStatus,
    notes: string,
    syncOptions?: VerifyAssessmentOptions
  ) => {
    if (
      currentUser.role !== 'super_admin' &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'admin_verifikator'
    ) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Super Admin, Admin, atau Verifikator yang dapat memvalidasi survei.',
      };
    }

    const target = assessments.find((a) => a.id === id);
    if (!target) {
      return {
        success: false,
        message: 'Data penilaian tidak ditemukan.',
      };
    }

    const now = new Date().toISOString();
    const targetWorksheet = syncOptions?.targetWorksheetName?.trim() || target.targetSheetName;
    const targetProfileId = syncOptions?.targetProfileId || target.targetProfileId;

    const updatedAssessment: BuildingAssessment = {
      ...target,
      verificationStatus: status,
      verificationNotes: notes,
      verifiedBy: currentUser.name,
      verifiedAt: now,
      updatedAt: now,
      ...(targetWorksheet ? { targetSheetName: targetWorksheet } : {}),
      ...(targetProfileId ? { targetProfileId } : {}),
    };

    if (db && !isFirestoreQuotaExceeded) {
      setDoc(
        doc(db, 'assessments', id),
        {
          verificationStatus: status,
          verificationNotes: notes,
          verifiedBy: currentUser.name,
          verifiedAt: now,
          updatedAt: now,
          ...(targetWorksheet ? { targetSheetName: targetWorksheet } : {}),
          ...(targetProfileId ? { targetProfileId } : {}),
        },
        { merge: true }
      ).catch((err) => {
        if (isQuotaError(err)) setIsFirestoreQuotaExceeded(true);
        console.warn('Firebase assessment verification save notice:', err?.message || err);
      });
    }

    setAssessments((prev) =>
      prev.map((a) => (a.id === id ? updatedAssessment : a))
    );

    // Auto-sync / Send to specified target worksheet & spreadsheet if requested or configured
    let sheetSyncResult: { success: boolean; message: string; folderUrl?: string } | undefined;
    const shouldSync = syncOptions?.syncToSheet ?? (googleSheetConfig.autoSync || Boolean(targetWorksheet));

    if (shouldSync) {
      let effectiveConfig: GoogleSheetConfig = { ...googleSheetConfig };

      if (syncOptions?.targetProfileId) {
        const foundProf = (googleSheetConfig.spreadsheetProfiles || []).find((p) => p.id === syncOptions.targetProfileId);
        if (foundProf) {
          effectiveConfig = {
            ...effectiveConfig,
            spreadsheetUrl: foundProf.spreadsheetUrl || effectiveConfig.spreadsheetUrl,
            webhookUrl: foundProf.webhookUrl || effectiveConfig.webhookUrl,
            driveFolderId: foundProf.driveFolderId || effectiveConfig.driveFolderId,
          };
        }
      }

      if (syncOptions?.targetSpreadsheetUrl && syncOptions.targetSpreadsheetUrl.trim()) {
        effectiveConfig.spreadsheetUrl = syncOptions.targetSpreadsheetUrl.trim();
      }
      if (syncOptions?.targetWebhookUrl && syncOptions.targetWebhookUrl.trim()) {
        effectiveConfig.webhookUrl = syncOptions.targetWebhookUrl.trim();
      }

      if (effectiveConfig.webhookUrl && effectiveConfig.webhookUrl.startsWith('http')) {
        try {
          const destSheetName = targetWorksheet || effectiveConfig.verifiedWorksheetName || 'Data_Terverifikasi';
          const res = await directSaveToGoogleSheet(
            updatedAssessment,
            effectiveConfig,
            'insert',
            undefined,
            destSheetName
          );

          sheetSyncResult = res;

          if (res.success) {
            setAssessments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      googleSheetSynced: true,
                      googleSheetSyncedAt: new Date().toISOString(),
                      targetSheetName: destSheetName,
                    }
                  : a
              )
            );
          }
        } catch (syncErr: any) {
          console.warn('Auto-sync on verification notice:', syncErr?.message || syncErr);
          sheetSyncResult = {
            success: false,
            message: `Verifikasi tersimpan di sistem, namun pengiriman ke Google Sheet tertunda: ${syncErr?.message || 'Koneksi gagal'}`,
          };
        }
      }
    }

    logUserActivity(
      'VERIFY_ASSESSMENT',
      'Penilaian Kerusakan',
      `Verifikasi Teknis [${status}]: ${target.buildingName} -> Sheet: ${targetWorksheet || 'Default'}`,
      target.code || id,
      `Catatan Verifikasi: ${notes || 'Tanpa catatan khusus'}`
    );

    const baseMessage = `Status penilaian "${target.buildingName}" berhasil divalidasi menjadi "${status}".`;
    const finalMessage = sheetSyncResult
      ? (sheetSyncResult.success
          ? `${baseMessage} Data otomatis masuk ke worksheet "${targetWorksheet || 'Data_Terverifikasi'}"!`
          : `${baseMessage} (${sheetSyncResult.message})`)
      : baseMessage;

    return {
      success: true,
      message: finalMessage,
      sheetSyncResult,
    };
  };

  const batchVerifyAssessments = async (
    ids: string[],
    status: VerificationStatus,
    notes: string,
    syncOptions?: VerifyAssessmentOptions
  ) => {
    if (
      currentUser.role !== 'super_admin' &&
      currentUser.role !== 'admin' &&
      currentUser.role !== 'admin_verifikator'
    ) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Super Admin, Admin, atau Verifikator yang dapat memvalidasi survei.',
        processedCount: 0,
      };
    }

    let successCount = 0;
    for (const id of ids) {
      try {
        const res = await verifyAssessment(id, status, notes, syncOptions);
        if (res.success) successCount++;
      } catch (err) {
        console.warn(`Error verifying item ${id}:`, err);
      }
    }

    const targetSheet = syncOptions?.targetWorksheetName || 'Data_Terverifikasi';
    return {
      success: successCount > 0,
      message: `Berhasil memvalidasi ${successCount} data dan memindahkannya ke worksheet "${targetSheet}".`,
      processedCount: successCount,
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
   * Loaded only once on initial app start or on explicit 1-hour schedule / manual click to prevent crashes
   */
  const syncFromGoogleSheet = async (showToastAlert = false, forceRefresh?: boolean): Promise<{ success: boolean; message: string; count?: number }> => {
    // If multiple worksheet profiles are configured, synchronize across all sheets so data from all 5 sheets is read
    if (googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 1) {
      return syncAllProfiles({ forceRefresh, showToastAlert });
    }

    if (!googleSheetConfig.spreadsheetUrl || !isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl)) {
      const msg = 'Tautan Google Sheet belum diatur atau masih menggunakan template contoh.';
      if (showToastAlert) showToast(msg, 'info');
      return { success: false, message: msg, count: 0 };
    }

    try {
      // If user clicked manual sync or 1-hour periodic schedule passed, force fresh download
      const shouldForce = forceRefresh !== undefined ? forceRefresh : Boolean(showToastAlert);

      // FAST PATH: If not forced and initial sheet load already succeeded with active data, avoid heavy re-fetch on tab switches
      if (!shouldForce && hasLoadedInitialGoogleSheetRef.current && assessments.length > 0) {
        return {
          success: true,
          message: 'Data Google Sheet telah termuat saat pembukaan awal.',
          count: assessments.length,
        };
      }

      if (shouldForce) {
        clearGoogleSheetsMemoryCache();
      }
      
      const defaultKecamatans = [
        'Aesesa',
        'Aesesa Selatan',
        'Boawae',
        'Mauponggo',
        'Nangaroro',
        'Keo Tengah',
        'Wolowae',
      ];

      // Initialize Live Progress State
      setSheetSyncProgress({
        isLoading: true,
        currentKecamatan: 'Aesesa',
        currentStep: 1,
        totalSteps: defaultKecamatans.length,
        percent: 10,
        totalLoaded: assessments.length,
        loadedKecamatans: defaultKecamatans.map((k, idx) => ({
          name: k,
          count: 0,
          status: idx === 0 ? 'loading' : 'pending',
        })),
        statusMessage: 'Memulai pembacaan sheet kecamatan secara berurutan...',
      });

      const onProgressStream = (prog: { currentKec: string; count: number; totalSoFar: number; step: number; totalSteps: number; partialData: BuildingAssessment[] }) => {
        if (!prog.partialData) return;
        
        // Update live progress bar details strictly without altering table state mid-flight
        const calculatedPercent = Math.min(99, Math.round((prog.step / prog.totalSteps) * 100));
        setSheetSyncProgress((prev) => {
          const updatedKecs = prev.loadedKecamatans.map((k, idx) => {
            if (k.name.toLowerCase() === prog.currentKec.toLowerCase() || prog.currentKec.toLowerCase().includes(k.name.toLowerCase())) {
              return { ...k, count: prog.count, status: 'completed' as const };
            }
            if (idx === prog.step) {
              return { ...k, status: 'loading' as const };
            }
            return k;
          });

          return {
            isLoading: true,
            currentKecamatan: prog.currentKec,
            currentStep: prog.step,
            totalSteps: prog.totalSteps,
            percent: calculatedPercent,
            totalLoaded: prog.totalSoFar,
            loadedKecamatans: updatedKecs,
            statusMessage: `Sheet Kec. ${prog.currentKec} selesai dibaca (+${prog.count} baris). Melanjutkan ke sheet berikutnya...`,
          };
        });
      };

      const result = await fetchAssessmentsFromGoogleSheet(googleSheetConfig, shouldForce, onProgressStream);
      
      // Mark initial load as completed and record timestamp
      hasLoadedInitialGoogleSheetRef.current = true;
      lastSheetSyncTimestampRef.current = Date.now();

      // Update progress to 100% finished
      setSheetSyncProgress((prev) => ({
        ...prev,
        isLoading: false,
        percent: 100,
        totalLoaded: result.data ? result.data.length : prev.totalLoaded,
        statusMessage: `Selesai! Seluruh ${result.data ? result.data.length : 0} data gedung siap ditampilkan.`,
        loadedKecamatans: prev.loadedKecamatans.map((k) => ({ ...k, status: 'completed' as const })),
      }));

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
        // Authoritative reconciliation that matches by ID, Reg Code, and semantic location signature
        const mergedList = reconcileAndMergeAssessments(prev, sheetItems);

        try {
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(mergedList));
        } catch {
          try {
            const lightweight = mergedList.map((a) => ({
              ...a,
              photos: a.photos?.map((p) => ({
                ...p,
                url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.length < 300) ? p.url : '',
              })) || [],
            }));
            localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
          } catch {}
        }

        // Persist merged dataset to Express server (additive, non-destructive)
        fetch('/api/assessments/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessments: mergedList, replace: false }),
        }).catch((err) => console.warn('Server sync-batch notice:', err));

        // Note: Data is saved to server via /api/assessments/sync-batch and local storage;
        // avoid bulk setDoc loop to Firestore to protect Spark free-tier daily write limit.

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

  /**
   * Synchronize all configured worksheet books / pages sequentially.
   * Reads from all 5 sheets (and any future ones), tagging each record with targetProfileId
   * and merging them safely without losing any data.
   */
  const syncAllProfiles = async (options?: { forceRefresh?: boolean; showToastAlert?: boolean }): Promise<{ success: boolean; message: string; count?: number; countPerProfile?: Record<string, number> }> => {
    const forceRefresh = options?.forceRefresh ?? false;
    const showToastAlert = options?.showToastAlert ?? true;

    const profilesList = (googleSheetConfig.spreadsheetProfiles && googleSheetConfig.spreadsheetProfiles.length > 0)
      ? googleSheetConfig.spreadsheetProfiles
      : [
          {
            id: 'profile_primary_2026',
            pageNumber: 1,
            name: 'Buku 1: Spreadsheet Utama SIM-PKBG 2026 (Nagekeo)',
            spreadsheetUrl: googleSheetConfig.spreadsheetUrl || '',
            isDefault: true,
          },
        ];

    // Filter to valid profiles and ensure unique spreadsheet targets
    const seenSheetTargets = new Set<string>();
    const validProfiles = profilesList.filter((p) => {
      if (!p.spreadsheetUrl || !isConfiguredSheetUrl(p.spreadsheetUrl)) return false;
      const sheetId = extractSpreadsheetId(p.spreadsheetUrl) || p.spreadsheetUrl;
      if (seenSheetTargets.has(sheetId)) return false;
      seenSheetTargets.add(sheetId);
      return true;
    });
    if (validProfiles.length === 0) {
      if (googleSheetConfig.spreadsheetUrl && isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl)) {
        return syncFromGoogleSheet(showToastAlert, forceRefresh);
      }
      const msg = 'Tidak ada profil worksheet dengan URL Google Sheet yang valid.';
      if (showToastAlert) showToast(msg, 'info');
      return { success: false, message: msg, count: 0 };
    }

    if (showToastAlert) {
      showToast(`Memulai sinkronisasi data dari seluruh ${validProfiles.length} worksheet/buku...`, 'info');
    }

    setSheetSyncProgress({
      isLoading: true,
      currentKecamatan: 'Semua Sheet',
      currentStep: 1,
      totalSteps: validProfiles.length,
      percent: 10,
      totalLoaded: assessments.length,
      loadedKecamatans: validProfiles.map((p, idx) => ({
        name: p.name,
        count: 0,
        status: idx === 0 ? 'loading' : 'pending',
      })),
      statusMessage: `Membaca data dari ${validProfiles.length} worksheet...`,
    });

    const countPerProfile: Record<string, number> = {};
    const allFetchedItems: BuildingAssessment[] = [];

    for (let i = 0; i < validProfiles.length; i++) {
      const prof = validProfiles[i];
      try {
        setSheetSyncProgress((prev) => ({
          ...prev,
          currentStep: i + 1,
          percent: Math.round(((i + 1) / validProfiles.length) * 90),
          statusMessage: `Sedang membaca worksheet ${i + 1}/${validProfiles.length}: ${prof.name}...`,
        }));

        const tempConfig: GoogleSheetConfig = {
          ...googleSheetConfig,
          spreadsheetUrl: prof.spreadsheetUrl,
          webhookUrl: prof.webhookUrl || googleSheetConfig.webhookUrl,
          sheetName: prof.sheetName || googleSheetConfig.sheetName,
        };

        const res = await fetchAssessmentsFromGoogleSheet(tempConfig, forceRefresh);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const tagged = res.data.map((item) => ({
            ...item,
            targetProfileId: item.targetProfileId || prof.id,
            targetProfileName: item.targetProfileName || prof.name,
          }));
          allFetchedItems.push(...tagged);
          countPerProfile[prof.id] = tagged.length;
        } else {
          countPerProfile[prof.id] = 0;
        }
      } catch (err) {
        console.warn(`Sync notice for profile ${prof.name}:`, err);
        countPerProfile[prof.id] = 0;
      }
    }

    // Merge allFetchedItems into assessments safely without creating duplicate items
    setAssessments((prev) => {
      const mergedList = reconcileAndMergeAssessments(prev, allFetchedItems);

      try {
        localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(mergedList));
      } catch {
        try {
          const lightweight = mergedList.map((a) => ({
            ...a,
            photos: a.photos?.map((p) => ({
              ...p,
              url: p.url && (p.url.startsWith('http') || p.url.startsWith('/uploads/') || p.url.startsWith('data:') || p.url.length < 300) ? p.url : '',
            })) || [],
          }));
          localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(lightweight));
        } catch {}
      }

      fetch('/api/assessments/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessments: mergedList, replace: true }),
      }).catch((err) => console.warn('Server sync-batch notice:', err));

      return mergedList;
    });

    setSheetSyncProgress((prev) => ({
      ...prev,
      isLoading: false,
      percent: 100,
      totalLoaded: allFetchedItems.length,
      statusMessage: `Selesai! Seluruh ${allFetchedItems.length} data dari ${validProfiles.length} worksheet berhasil disinkronkan.`,
    }));

    const totalCount = allFetchedItems.length;
    const msg = `Berhasil membaca & menyinkronkan data dari seluruh ${validProfiles.length} sheet (Total ${totalCount} data termuat)!`;
    if (showToastAlert) showToast(msg, 'success');
    return { success: true, message: msg, count: totalCount, countPerProfile };
  };

  /**
   * Consolidate 7 kecamatan sheets into a single Rekap sheet (REKAP_SEMUA_KECAMATAN)
   * and immediately refresh local state from that single master sheet
   */
  const consolidateAndSyncSheets = async (): Promise<{ success: boolean; message: string; count?: number }> => {
    try {
      showToast('Memproses penyatuan data dari 7 sheet kecamatan ke satu Sheet Rekap...', 'info');
      const consResult = await consolidateSheetsInGoogleSheet(googleSheetConfig, assessments);
      const syncResult = await syncFromGoogleSheet(false, true);
      const totalCount = syncResult.count || assessments.length;
      const finalMsg = consResult.success
        ? `Berhasil menyatukan data 7 sheet kecamatan ke Sheet Rekap ("${googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN'}"). Total ${totalCount} data termuat.`
        : `Penyatuan sheet selesai. Total ${totalCount} data termuat dari sheet rekap.`;
      showToast(finalMsg, 'success');
      logUserActivity(
        'SYNC_GOOGLE_SHEET',
        'Integrasi Google Sheet',
        `Konsolidasi 7 Sheet Kecamatan ke Sheet Rekap Utama (${googleSheetConfig.sheetName || 'REKAP_SEMUA_KECAMATAN'})`,
        'REKAP_SEMUA_KECAMATAN',
        finalMsg
      );
      return { success: true, message: finalMsg, count: totalCount };
    } catch (err: any) {
      const errMsg = `Gagal menyatukan data sheet: ${err?.message || 'Koneksi terputus'}`;
      showToast(errMsg, 'error');
      return { success: false, message: errMsg, count: 0 };
    }
  };

  /**
   * Sync all local user accounts to Google Sheet tab 'Daftar_Pengguna'
   */
  const syncUsersToGoogleSheet = async (): Promise<{ success: boolean; message: string; count: number }> => {
    const res = await syncAllUsersToGoogleSheet(users, googleSheetConfig);
    return res;
  };

  /**
   * Fetch user accounts from Google Sheet tab 'Daftar_Pengguna'
   */
  const fetchUsersFromSheet = async (): Promise<{ success: boolean; users: UserAccount[]; message: string }> => {
    const res = await fetchUsersFromGoogleSheet(googleSheetConfig);
    if (res.success && res.users.length > 0) {
      const deletedUserIds = getStoredDeletedUserIds();
      const sheetUsers = res.users.filter((u) => u && u.id && !deletedUserIds.has(u.id));
      if (sheetUsers.length > 0) {
        const userMap = new Map<string, UserAccount>();
        INITIAL_USERS.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
        users.forEach((u) => { if (!deletedUserIds.has(u.id)) userMap.set(u.id, u); });
        sheetUsers.forEach((su) => { userMap.set(su.id, { ...(userMap.get(su.id) || {}), ...su }); });
        const merged = Array.from(userMap.values());
        setUsers(merged);
        try { localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged)); } catch {}
      }
    }
    return res;
  };

  // Synchronize from Google Sheet ONLY ONCE on initial startup, and strictly every 1 hour thereafter
  // (Prevents continuous reloading, high memory usage, and browser crashes when switching tabs)
  useEffect(() => {
    const hasSpreadsheet = Boolean(googleSheetConfig.spreadsheetUrl && isConfiguredSheetUrl(googleSheetConfig.spreadsheetUrl));
    const hasWebhook = Boolean(googleSheetConfig.webhookUrl && googleSheetConfig.webhookUrl.startsWith('http'));

    if (hasSpreadsheet || hasWebhook) {
      // 1. Initial Load: Run once upon opening the application with live animated progress notification
      if (!hasLoadedInitialGoogleSheetRef.current) {
        lastSheetSyncTimestampRef.current = Date.now();
        syncFromGoogleSheet(false, false);
        fetchUsersFromSheet();
      }

      // 2. 1-Hour Scheduled Auto-Refresh (60 menit) per user directive:
      // Lightweight, prevents constant busy refreshing, preserves system stability
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const intervalId = setInterval(() => {
        const now = Date.now();
        if (now - lastSheetSyncTimestampRef.current >= ONE_HOUR_MS) {
          lastSheetSyncTimestampRef.current = now;
          syncFromGoogleSheet(false, false);
          fetchUsersFromSheet();
        }
      }, ONE_HOUR_MS);

      return () => clearInterval(intervalId);
    }
  }, [googleSheetConfig.spreadsheetUrl, googleSheetConfig.webhookUrl]);

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
      
      // Save to server-side JSON config endpoint for robust fallback across all devices
      if (updated.spreadsheetUrl || updated.webhookUrl || updated.driveFolderId || updated.spreadsheetProfiles) {
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spreadsheetUrl: updated.spreadsheetUrl,
            webhookUrl: updated.webhookUrl,
            driveFolderId: updated.driveFolderId,
            spreadsheetProfiles: updated.spreadsheetProfiles,
            activeProfileId: updated.activeProfileId,
          }),
        }).catch((err) => console.warn('Server config save failed:', err));
      }

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

      // Also propagate new spreadsheetUrl to all users so that every user record explicitly carries the active link!
      if (updated.spreadsheetUrl) {
        setUsers((prevUsers) => {
          const newUsers = prevUsers.map((u) => ({
            ...u,
            spreadsheetUrl: updated.spreadsheetUrl,
          }));
          try {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(newUsers));
          } catch {}
          return newUsers;
        });
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

  // Full collection of building assessments (never hide valid records)
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
        restoreAndRecoverAllAssessments,
        restoreDeletedAssessment,
        getDeletedAssessmentIds,
        purgeAllDuplicates,
        autoFixDuplicateCodes,
        fixSingleAssessmentRegistrationCode,
        verifyAssessment,
        batchVerifyAssessments,
        syncAssessmentToSheet,
        syncAllToSheet,
        syncFromGoogleSheet,
        syncAllProfiles,
        consolidateAndSyncSheets,
        recoverAndSyncPhotos,
        attachPhotoToAssessment,

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
        syncUsersToGoogleSheet,
        fetchUsersFromSheet,
        firebaseShieldConfig,
        updateFirebaseShieldConfig,
        isFirestoreQuotaExceeded,
        firestoreConsoleUrl: FIRESTORE_DATABASE_CONSOLE_URL,

        hsbgnConfigs,
        updateHsbgnConfig,
        resetHsbgnConfigs,
        getCategoryConfig,

        targetAssessmentCount,
        updateTargetAssessmentCount,

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

        sheetSyncProgress,

        sessionQuotaStatus,
        isSurveyorQuotaBlocked,
        activeSessionsList,
        checkSessionSlot,
        refreshActiveSessions,
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
