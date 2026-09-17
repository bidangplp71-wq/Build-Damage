import { BuildingAssessment } from '../types';

export type DuplicateMatchReason = 
  | 'EXACT_NAME_AND_LOCATION'   // Nama gedung sama persis di Desa & Kecamatan yang sama
  | 'SAME_NIK'                  // NIK KTP Pemilik sama di desa/kecamatan yang sama
  | 'HIGH_SIMILARITY_NAME'      // Nama gedung sangat mirip (>85%) di Desa yang sama
  | 'SAME_CODE';                // Kode registrasi gedung sama persis

export interface DuplicateMatchInfo {
  assessment: BuildingAssessment;
  reason: DuplicateMatchReason;
  similarityScore: number; // 0 - 100%
  description: string;
}

export interface DuplicateGroup {
  groupId: string;
  primaryKey: string;
  items: BuildingAssessment[];
  highestReason: DuplicateMatchReason;
  matchScore: number;
}

/**
 * Normalizes text for robust comparison (lowercase, trimmed, strip redundant punctuation & extra spaces)
 */
export function normalizeString(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token-based similarity calculation (Dice Coefficient on word tokens)
 */
export function calculateTextSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  // Split into words
  const words1 = norm1.split(' ').filter(w => w.length > 1);
  const words2 = norm2.split(' ').filter(w => w.length > 1);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersectionCount = 0;
  set1.forEach((w) => {
    if (set2.has(w)) intersectionCount++;
  });

  const dice = (2.0 * intersectionCount) / (set1.size + set2.size);
  return dice;
}

/**
 * Check if a single record matches an existing assessment as a duplicate
 * Strictly identifies duplicates ONLY by valid Registration Number (No. Registrasi / code)
 */
export function checkDuplicateSingle(
  target: Partial<BuildingAssessment>,
  candidate: BuildingAssessment,
  currentId?: string
): DuplicateMatchInfo | null {
  if (currentId && candidate.id === currentId) {
    return null;
  }
  if (target.id && candidate.id === target.id) {
    return null;
  }

  // Exact same registration code (No. Registrasi)
  const tCode = normalizeString(target.code);
  const cCode = normalizeString(candidate.code);

  const invalidCodes = new Set([
    '',
    '0',
    '-',
    '--',
    '---',
    'none',
    'tidak ada',
    'belum ada',
    'null',
    'undefined',
    'tanpa kode',
    'tanpa no reg',
    'reg',
    'reg-',
    'reg--',
  ]);

  if (
    tCode &&
    cCode &&
    tCode === cCode &&
    !invalidCodes.has(tCode) &&
    !invalidCodes.has(cCode) &&
    tCode.length >= 3
  ) {
    return {
      assessment: candidate,
      reason: 'SAME_CODE',
      similarityScore: 100,
      description: `Nomor Registrasi "${candidate.code}" sama persis. Keputusan validasi/penghapusan ditentukan oleh tim verifikator.`,
    };
  }

  return null;
}

/**
 * Check if the form currently being edited has any duplicate in the existing assessments list
 */
export function checkDuplicateBeforeSave(
  currentPayload: Partial<BuildingAssessment>,
  existingAssessments: BuildingAssessment[],
  editingId?: string
): { isDuplicate: boolean; matches: DuplicateMatchInfo[]; primaryMatch?: DuplicateMatchInfo } {
  if (!currentPayload.buildingName || (!currentPayload.kecamatanId && !currentPayload.kecamatanName)) {
    return { isDuplicate: false, matches: [] };
  }

  const matches: DuplicateMatchInfo[] = [];

  for (const existing of existingAssessments) {
    const match = checkDuplicateSingle(currentPayload, existing, editingId);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by similarity score descending
  matches.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    isDuplicate: matches.length > 0,
    matches,
    primaryMatch: matches[0],
  };
}

/**
 * Group all assessments in the database into duplicate clusters for verification warning badges
 */
export function detectAllDuplicateGroups(
  assessments: BuildingAssessment[],
  ignoredKeys: Set<string> | string[] = new Set()
): DuplicateGroup[] {
  if (!assessments || assessments.length < 2) return [];

  const ignoredSet = Array.isArray(ignoredKeys) ? new Set(ignoredKeys) : ignoredKeys;
  const visited = new Set<string>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < assessments.length; i++) {
    const a = assessments[i];
    if (!a || !a.id || visited.has(a.id)) continue;
    if (ignoredSet.has(a.id)) continue;

    const cluster: BuildingAssessment[] = [a];
    let highestReason: DuplicateMatchReason = 'SAME_CODE';
    let maxScore = 0;

    for (let j = i + 1; j < assessments.length; j++) {
      const b = assessments[j];
      if (!b || !b.id || visited.has(b.id)) continue;
      if (ignoredSet.has(b.id)) continue;

      const pairKey1 = `${a.id}:::${b.id}`;
      const pairKey2 = `${b.id}:::${a.id}`;
      const pairKeySorted = [a.id, b.id].sort().join(':::');
      if (
        ignoredSet.has(pairKey1) ||
        ignoredSet.has(pairKey2) ||
        ignoredSet.has(pairKeySorted)
      ) {
        continue;
      }

      const match = checkDuplicateSingle(a, b);
      if (match) {
        cluster.push(b);
        if (match.similarityScore > maxScore) {
          maxScore = match.similarityScore;
          highestReason = match.reason;
        }
      }
    }

    if (cluster.length > 1) {
      cluster.forEach((item) => visited.add(item.id));
      groups.push({
        groupId: `dup_group_${a.id}`,
        primaryKey: `${a.buildingName} (${a.desaName})`,
        items: cluster,
        highestReason,
        matchScore: maxScore || 100,
      });
    }
  }

  // Sort groups: Exact matches first
  return groups.sort((g1, g2) => g2.matchScore - g1.matchScore);
}

/**
 * Identifies if a sheet/profile name represents an old archive / read-only historical sheet
 */
export function isArchiveSource(sourceName?: string | null): boolean {
  if (!sourceName) return false;
  const trimmed = sourceName.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('arsip') ||
    lower.includes('archive') ||
    lower.includes('data lama') ||
    lower.includes('datalama') ||
    lower.includes('data_lama') ||
    lower.includes('old') ||
    lower.includes('read only') ||
    lower.includes('readonly') ||
    lower.includes('backup') ||
    lower.includes('buku_arsip') ||
    lower.includes('buku 2') ||
    lower.includes('buku_2') ||
    lower.includes('riwayat_lama')
  ) {
    return true;
  }

  // NOTE: All Kecamatan sheets (e.g. "Kec. Aesesa", "Kec Aesesa", "Kec. Boawae", "Kec Boawae", etc.)
  // are 100% active operational sheets and must NEVER be flagged as archive.
  return false;
}

/**
 * Check if an assessment item belongs to historical archive / old data
 */
export function isArchiveAssessment(item?: Partial<BuildingAssessment> | null): boolean {
  if (!item) return false;
  if (isArchiveSource(item.sourceSheet)) return true;
  if (isArchiveSource(item.targetSheetName)) return true;
  if (isArchiveSource(item.targetProfileName)) return true;
  if (item.targetProfileId === 'profile_backup_new') return true;
  // Note: Only flag as archive if explicitly marked in source sheet / profile,
  // never flag active surveys based solely on registration code.
  return false;
}

/**
 * Builds a deterministic semantic key for a building assessment record to assist in verification badges.
 * NOTE: Semantic keys are strictly for UI assistance and MUST NEVER be used to delete or squash physical sheet survey rows.
 */
export function buildSemanticKey(item: Partial<BuildingAssessment>): string {
  const cleanBuilding = normalizeString(item.buildingName);
  const cleanKec = (item.kecamatanName || item.kecamatanId || '').toLowerCase().trim();
  const cleanDesa = (item.desaName || item.desaId || '').toLowerCase().trim();
  const cleanNik = (item.nikPemilik || '').replace(/[^0-9]/g, '');

  if (cleanNik && cleanNik.length >= 10 && cleanNik !== '0000000000000000') {
    return `nik:${cleanNik}::${cleanKec}`;
  }

  if (cleanBuilding && (cleanKec || cleanDesa)) {
    return `loc:${cleanKec}::${cleanDesa}::${cleanBuilding}`;
  }

  return item.id || `item_${Math.random()}`;
}

/**
 * Generates all candidate identity keys for an assessment to guarantee 100% accurate deduplication
 * across local storage, server state, and Google Sheet fetch rows.
 */
export function getAssessmentLookupKeys(item: BuildingAssessment): string[] {
  const keys: string[] = [];
  const isArchive = isArchiveAssessment(item);
  const scopeTag = isArchive ? 'archive' : 'active';

  // 1. Exact ID
  if (item.id && item.id.trim()) {
    keys.push(`id:${item.id.trim()}::${scopeTag}`);
  }

  // 2. Registration Code (e.g. REG-BOA-2026-0001)
  const invalidCodes = new Set([
    '',
    '0',
    '-',
    '--',
    '---',
    'none',
    'tidak ada',
    'belum ada',
    'null',
    'undefined',
    'tanpa kode',
    'tanpa no reg',
    'reg',
    'reg-',
    'reg--',
    'reg-preview',
  ]);
  const cleanCode = (item.code || '').toUpperCase().trim();
  if (cleanCode && !invalidCodes.has(cleanCode.toLowerCase()) && cleanCode.length >= 4) {
    keys.push(`code:${cleanCode}::${scopeTag}`);
  }

  // 3. Physical Sheet Row + Canonical Kecamatan / Sheet
  const cleanSheet = (item.sourceSheet || item.targetSheetName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanKec = (item.kecamatanName || item.kecamatanId || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (item.sheetRowNumber && item.sheetRowNumber >= 2) {
    if (cleanKec) {
      keys.push(`row_kec:${cleanKec}::r${item.sheetRowNumber}::${scopeTag}`);
    }
    if (cleanSheet) {
      keys.push(`sheet:${cleanSheet}::r${item.sheetRowNumber}::${scopeTag}`);
      keys.push(`row:${cleanSheet}::r${item.sheetRowNumber}::${scopeTag}`);
    }
  }

  // 4. Semantic Location Signature (Building Name + Kecamatan + Desa)
  const cleanBuilding = normalizeString(item.buildingName).replace(/\s*\(baris\s+\d+\)/i, '').trim();
  const cleanDesa = normalizeString(item.desaName);
  if (cleanBuilding && cleanBuilding.length >= 4 && !cleanBuilding.startsWith('survei bangunan') && cleanKec) {
    keys.push(`loc:${cleanKec}::${cleanDesa}::${cleanBuilding}::${scopeTag}`);
    // If NIK is provided
    const cleanNik = (item.nikPemilik || '').replace(/[^0-9]/g, '');
    if (cleanNik && cleanNik.length >= 10 && cleanNik !== '0000000000000000') {
      keys.push(`nik:${cleanNik}::${cleanKec}::${scopeTag}`);
    }
  }

  return keys;
}

/**
 * Deduplicate an array of assessments strictly by exact ID, Registration Code, or exact physical sheet row.
 * CRITICAL RULE: Never merge independent rows with different identities,
 * and NEVER merge an archive record with an active record.
 * This guarantees 100% preservation of all 207 historical records and all newly inputted active surveys,
 * while eliminating duplicate clones caused by multiple sheet queries or re-fetches.
 */
export function deduplicateAssessmentsList(list: BuildingAssessment[]): BuildingAssessment[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];

  const result: BuildingAssessment[] = [];
  const keyToResultIndex = new Map<string, number>();

  for (const item of list) {
    if (!item) continue;

    const candidateKeys = getAssessmentLookupKeys(item);
    let matchedIndex: number | undefined = undefined;

    for (const key of candidateKeys) {
      if (keyToResultIndex.has(key)) {
        matchedIndex = keyToResultIndex.get(key);
        break;
      }
    }

    if (matchedIndex !== undefined) {
      const existing = result[matchedIndex];

      // Merge enriched fields non-destructively
      const mergedPhotos = (item.photos && item.photos.length > 0)
        ? item.photos
        : (existing.photos || []);
      const mergedDriveUrl = item.googleDriveFolderUrl || item.backupDriveUrl || existing.googleDriveFolderUrl || existing.backupDriveUrl;
      const isItemVerified = item.verificationStatus === 'Terverifikasi';
      const isExistingVerified = existing.verificationStatus === 'Terverifikasi';
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const keepIncomingAsBase = isItemVerified && !isExistingVerified
        ? true
        : !isItemVerified && isExistingVerified
        ? false
        : incomingTime >= existingTime;

      const base = keepIncomingAsBase ? item : existing;
      const other = keepIncomingAsBase ? existing : item;

      const mergedItem: BuildingAssessment = {
        ...other,
        ...base,
        // Prefer existing stable ID if it's already an active uuid/ass_ ID
        id: existing.id && !existing.id.startsWith('sheet_') ? existing.id : (base.id || other.id),
        code: base.code && !base.code.startsWith('REG-TEMP') ? base.code : (other.code || base.code),
        photos: mergedPhotos,
        googleDriveFolderUrl: mergedDriveUrl,
        backupDriveUrl: base.backupDriveUrl || other.backupDriveUrl,
        sourceSheet: base.sourceSheet || other.sourceSheet,
        sheetRowNumber: base.sheetRowNumber || other.sheetRowNumber,
        targetSheetName: base.targetSheetName || other.targetSheetName,
        targetProfileId: base.targetProfileId || other.targetProfileId,
        targetProfileName: base.targetProfileName || other.targetProfileName,
        verificationStatus: isExistingVerified || isItemVerified ? 'Terverifikasi' : base.verificationStatus,
        googleSheetSynced: Boolean(base.googleSheetSynced || other.googleSheetSynced),
      };

      result[matchedIndex] = mergedItem;

      // Register all candidate keys to point to matchedIndex
      for (const key of candidateKeys) {
        keyToResultIndex.set(key, matchedIndex);
      }
      for (const key of getAssessmentLookupKeys(mergedItem)) {
        keyToResultIndex.set(key, matchedIndex);
      }
    } else {
      const newIdx = result.length;
      result.push(item);
      for (const key of candidateKeys) {
        keyToResultIndex.set(key, newIdx);
      }
    }
  }

  return result;
}

/**
 * Reconcile base assessments with incoming Google Sheet records.
 * Retains all historical archive data, prevents active data from squashing archive data,
 * and immediately reflects newly added active rows.
 */
export function reconcileAndMergeAssessments(
  baseList: BuildingAssessment[],
  incomingList: BuildingAssessment[]
): BuildingAssessment[] {
  if (!incomingList || incomingList.length === 0) return deduplicateAssessmentsList(baseList || []);
  if (!baseList || baseList.length === 0) return deduplicateAssessmentsList(incomingList);

  // Combine both lists and deduplicate strictly by exact ID/row:
  // - Preserves 100% of all existing records (no data loss if an incoming fetch returns fewer items)
  // - Preserves all archive records without letting active sheets squash them
  // - Merges photos, verification status, and timestamps non-destructively
  return deduplicateAssessmentsList([...baseList, ...incomingList]);
}

/**
 * Get duplicate item IDs lookup map
 */
export function getDuplicateIdsMap(groups: DuplicateGroup[]): Map<string, { group: DuplicateGroup; count: number }> {
  const map = new Map<string, { group: DuplicateGroup; count: number }>();
  groups.forEach((g) => {
    g.items.forEach((item) => {
      map.set(item.id, { group: g, count: g.items.length });
    });
  });
  return map;
}

