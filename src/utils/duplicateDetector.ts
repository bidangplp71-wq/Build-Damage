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
 * Group all assessments in the database into duplicate clusters
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
  const lower = sourceName.toLowerCase();
  return (
    lower.includes('arsip') ||
    lower.includes('archive') ||
    lower.includes('lama') ||
    lower.includes('old') ||
    lower.includes('read only') ||
    lower.includes('readonly') ||
    lower.includes('backup') ||
    lower.includes('2023') ||
    lower.includes('2024') ||
    lower.includes('2025') ||
    lower.includes('buku_arsip')
  );
}

/**
 * Builds a deterministic semantic key for a building assessment record to prevent duplicate duplication
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
 * Deduplicate an array of assessments strictly and semantically
 * Preserves the richest data (photos, verified status, coordinates, drive link)
 */
export function deduplicateAssessmentsList(list: BuildingAssessment[]): BuildingAssessment[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];

  const result: BuildingAssessment[] = [];
  const seenIdMap = new Map<string, number>(); // id -> index in result
  const seenCodeMap = new Map<string, number>(); // code -> index in result
  const seenSemanticMap = new Map<string, number>(); // semantic key -> index in result

  for (const item of list) {
    if (!item) continue;

    let matchIdx = -1;
    if (item.id && seenIdMap.has(item.id)) {
      matchIdx = seenIdMap.get(item.id)!;
    } else if (item.code && item.code.trim().length >= 4 && seenCodeMap.has(item.code.toUpperCase().trim())) {
      matchIdx = seenCodeMap.get(item.code.toUpperCase().trim())!;
    } else {
      const semKey = buildSemanticKey(item);
      if (semKey.startsWith('nik:') || (semKey.startsWith('loc:') && !semKey.includes('survei_bangunan_lapangan'))) {
        if (seenSemanticMap.has(semKey)) {
          matchIdx = seenSemanticMap.get(semKey)!;
        }
      }
    }

    if (matchIdx !== -1) {
      // Merge with existing item at matchIdx (preserve latest timestamps, photos, and verification)
      const existing = result[matchIdx];
      const mergedPhotos = (item.photos && item.photos.length > 0)
        ? item.photos
        : (existing.photos || []);
      const mergedDriveUrl = item.googleDriveFolderUrl || item.backupDriveUrl || existing.googleDriveFolderUrl || existing.backupDriveUrl;

      const isItemVerified = item.verificationStatus === 'Terverifikasi';
      const isExistingVerified = existing.verificationStatus === 'Terverifikasi';

      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

      // Primary record priority: prefer verified, then latest timestamp
      const keepIncomingAsBase = isItemVerified && !isExistingVerified
        ? true
        : !isItemVerified && isExistingVerified
        ? false
        : incomingTime >= existingTime;

      const base = keepIncomingAsBase ? item : existing;
      const other = keepIncomingAsBase ? existing : item;

      const merged: BuildingAssessment = {
        ...other,
        ...base,
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

      result[matchIdx] = merged;
    } else {
      const newIdx = result.length;
      result.push(item);
      if (item.id) seenIdMap.set(item.id, newIdx);
      if (item.code && item.code.trim().length >= 4) {
        seenCodeMap.set(item.code.toUpperCase().trim(), newIdx);
      }
      const semKey = buildSemanticKey(item);
      if (semKey.startsWith('nik:') || (semKey.startsWith('loc:') && !semKey.includes('survei_bangunan_lapangan'))) {
        seenSemanticMap.set(semKey, newIdx);
      }
    }
  }

  return result;
}

/**
 * Reconcile base assessments with incoming Google Sheet records
 * Seamlessly matches existing records by ID, Registration Code, or Location Signature,
 * preventing ghost duplicates from accumulating on every sync.
 */
export function reconcileAndMergeAssessments(
  baseList: BuildingAssessment[],
  incomingList: BuildingAssessment[]
): BuildingAssessment[] {
  const incoming = deduplicateAssessmentsList(incomingList || []);
  const seenIdMap = new Map<string, number>();
  const seenCodeMap = new Map<string, number>();
  const seenSemanticMap = new Map<string, number>();

  incoming.forEach((item, idx) => {
    if (item.id) seenIdMap.set(item.id, idx);
    if (item.code && item.code.trim().length >= 4) {
      seenCodeMap.set(item.code.toUpperCase().trim(), idx);
    }
    const semKey = buildSemanticKey(item);
    if (semKey.startsWith('nik:') || (semKey.startsWith('loc:') && !semKey.includes('survei_bangunan_lapangan'))) {
      seenSemanticMap.set(semKey, idx);
    }
  });

  const merged = [...incoming];

  // Process base records
  (baseList || []).forEach((baseItem) => {
    if (!baseItem) return;

    let matchIdx = -1;
    if (baseItem.id && seenIdMap.has(baseItem.id)) {
      matchIdx = seenIdMap.get(baseItem.id)!;
    } else if (baseItem.code && baseItem.code.trim().length >= 4 && seenCodeMap.has(baseItem.code.toUpperCase().trim())) {
      matchIdx = seenCodeMap.get(baseItem.code.toUpperCase().trim())!;
    } else {
      const semKey = buildSemanticKey(baseItem);
      if (semKey.startsWith('nik:') || (semKey.startsWith('loc:') && !semKey.includes('survei_bangunan_lapangan'))) {
        if (seenSemanticMap.has(semKey)) {
          matchIdx = seenSemanticMap.get(semKey)!;
        }
      }
    }

    if (matchIdx !== -1) {
      // Merge user local photos or edits into the incoming item
      const incomingItem = merged[matchIdx];
      const mergedPhotos = (baseItem.photos && baseItem.photos.length > 0)
        ? baseItem.photos
        : (incomingItem.photos || []);
      const isBaseVerified = baseItem.verificationStatus === 'Terverifikasi';
      const isIncomingVerified = incomingItem.verificationStatus === 'Terverifikasi';

      merged[matchIdx] = {
        ...incomingItem,
        ...baseItem,
        photos: mergedPhotos,
        googleDriveFolderUrl: incomingItem.googleDriveFolderUrl || baseItem.googleDriveFolderUrl,
        sourceSheet: incomingItem.sourceSheet || baseItem.sourceSheet,
        sheetRowNumber: incomingItem.sheetRowNumber || baseItem.sheetRowNumber,
        targetSheetName: incomingItem.targetSheetName || baseItem.targetSheetName,
        targetProfileId: incomingItem.targetProfileId || baseItem.targetProfileId,
        targetProfileName: incomingItem.targetProfileName || baseItem.targetProfileName,
        verificationStatus: isBaseVerified || isIncomingVerified ? 'Terverifikasi' : (baseItem.verificationStatus || incomingItem.verificationStatus),
      };
    } else {
      // Keep unique local records that aren't in incoming sheets
      merged.push(baseItem);
    }
  });

  return deduplicateAssessmentsList(merged);
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

