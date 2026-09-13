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
 * Strict verification: Never falsely flag distinct school classrooms/buildings,
 * different homeowner properties in the same village, or separate spreadsheet rows.
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

  const tCode = normalizeString(target.code);
  const cCode = normalizeString(candidate.code);
  if (tCode && cCode) {
    if (tCode === cCode) {
      return {
        assessment: candidate,
        reason: 'SAME_CODE',
        similarityScore: 100,
        description: `Kode registrasi bangunan "${candidate.code}" sama persis.`,
      };
    } else {
      // Distinct official registration codes (REG-...) are always distinct surveys
      return null;
    }
  }

  const tKec = normalizeString(target.kecamatanName || target.kecamatanId);
  const cKec = normalizeString(candidate.kecamatanName || candidate.kecamatanId);
  const isSameKec = Boolean(tKec && cKec && (tKec === cKec || target.kecamatanId === candidate.kecamatanId));

  const tDesa = normalizeString(target.desaName || target.desaId);
  const cDesa = normalizeString(candidate.desaName || candidate.desaId);
  const isSameDesa = Boolean(tDesa && cDesa && (tDesa === cDesa || target.desaId === candidate.desaId));

  // Must be in the exact same village & subdistrict
  if (isSameDesa && isSameKec) {
    const tName = normalizeString(target.buildingName);
    const cName = normalizeString(candidate.buildingName);

    if (tName && cName && tName === cName) {
      // Check owner / NIK identity
      const tNik = (target.nikPemilik && target.nikPemilik !== '0' && String(target.nikPemilik).length >= 10)
        ? String(target.nikPemilik).trim()
        : '';
      const cNik = (candidate.nikPemilik && candidate.nikPemilik !== '0' && String(candidate.nikPemilik).length >= 10)
        ? String(candidate.nikPemilik).trim()
        : '';

      const tOwner = normalizeString(target.namaPemilikRumah || target.namaPemilikGedung || target.ownerAgency);
      const cOwner = normalizeString(candidate.namaPemilikRumah || candidate.namaPemilikGedung || candidate.ownerAgency);

      // If NIK is provided and matches exactly
      if (tNik && cNik && tNik === cNik) {
        return {
          assessment: candidate,
          reason: 'SAME_NIK',
          similarityScore: 100,
          description: `Nama gedung "${candidate.buildingName}" dan NIK Pemilik (${candidate.nikPemilik}) sama persis.`,
        };
      }

      // If generic name (e.g. "rumah warga", "rumah tinggal", "kantor", "posyandu"), require same owner
      const isGenericName = ['rumah', 'rumah tinggal', 'rumah warga', 'hunian warga', 'posyandu', 'polindes', 'balai', 'gedung'].includes(tName);
      if (isGenericName) {
        if (tOwner && cOwner && tOwner === cOwner) {
          return {
            assessment: candidate,
            reason: 'EXACT_NAME_AND_LOCATION',
            similarityScore: 100,
            description: `Rumah/gedung "${candidate.buildingName}" dengan pemilik yang sama ("${candidate.namaPemilikRumah || candidate.namaPemilikGedung || candidate.ownerAgency}") di ${candidate.desaName || 'Desa'}.`,
          };
        }
        // Different owners for generic house name in the same village are NOT duplicates
        return null;
      }

      // Specific building name (e.g. "SDI Kekandere Ruang Guru") matching identically in the same village
      if (tOwner && cOwner && tOwner !== cOwner) {
        // Different owners or agencies mean distinct assets
        return null;
      }

      return {
        assessment: candidate,
        reason: 'EXACT_NAME_AND_LOCATION',
        similarityScore: 100,
        description: `Nama gedung "${candidate.buildingName}" dan lokasi (${candidate.desaName || 'Desa'}, ${candidate.kecamatanName || 'Kecamatan'}) sama persis.`,
      };
    }
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
    if (visited.has(a.id)) continue;

    const cluster: BuildingAssessment[] = [a];
    let highestReason: DuplicateMatchReason = 'HIGH_SIMILARITY_NAME';
    let maxScore = 0;

    for (let j = i + 1; j < assessments.length; j++) {
      const b = assessments[j];
      if (visited.has(b.id)) continue;

      const pairKey = [a.id, b.id].sort().join(':::');
      if (ignoredSet.has(pairKey)) continue;

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
        matchScore: maxScore || 90,
      });
    }
  }

  // Sort groups: Exact matches first
  return groups.sort((g1, g2) => g2.matchScore - g1.matchScore);
}

/**
 * Deduplicate an array of assessments strictly by unique ID
 * Preserves every single physical row from each kecamatan sheet (including similar/duplicate surveys for inspector review)
 */
export function deduplicateAssessmentsList(list: BuildingAssessment[]): BuildingAssessment[] {
  if (!Array.isArray(list) || list.length <= 1) return list || [];

  const result: BuildingAssessment[] = [];
  const seenIdMap = new Map<string, number>(); // id -> index in result

  for (const item of list) {
    if (!item || !item.id) continue;

    let matchIdx = -1;
    if (seenIdMap.has(item.id)) {
      matchIdx = seenIdMap.get(item.id)!;
    }

    if (matchIdx !== -1) {
      // Merge with existing item at matchIdx (preserve latest timestamps and photos)
      const existing = result[matchIdx];
      const mergedPhotos = (item.photos && item.photos.length > 0)
        ? item.photos
        : (existing.photos || []);
      const mergedDriveUrl = item.googleDriveFolderUrl || item.backupDriveUrl || existing.googleDriveFolderUrl || existing.backupDriveUrl;

      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

      const merged: BuildingAssessment = incomingTime >= existingTime ? {
        ...existing,
        ...item,
        photos: mergedPhotos,
        googleDriveFolderUrl: mergedDriveUrl,
        backupDriveUrl: item.backupDriveUrl || existing.backupDriveUrl,
        googleSheetSynced: Boolean(item.googleSheetSynced || existing.googleSheetSynced),
      } : {
        ...item,
        ...existing,
        photos: mergedPhotos,
        googleDriveFolderUrl: mergedDriveUrl,
        backupDriveUrl: existing.backupDriveUrl || item.backupDriveUrl,
        googleSheetSynced: Boolean(existing.googleSheetSynced || item.googleSheetSynced),
      };

      result[matchIdx] = merged;
    } else {
      const newIdx = result.length;
      result.push(item);
      seenIdMap.set(item.id, newIdx);
    }
  }

  return result;
}

/**
 * Reconcile base assessments with incoming Google Sheet records
 * Preserves 100% of rows from the 7 kecamatan sheets and appends any local unsynced surveys
 */
export function reconcileAndMergeAssessments(
  baseList: BuildingAssessment[],
  incomingList: BuildingAssessment[]
): BuildingAssessment[] {
  // Start with clean incoming records from the 7 kecamatan sheets (100% preserved)
  const incoming = deduplicateAssessmentsList(incomingList || []);
  const seenIdMap = new Map<string, number>();

  incoming.forEach((item, idx) => {
    seenIdMap.set(item.id, idx);
  });

  const merged = [...incoming];

  // Process base records
  (baseList || []).forEach((baseItem) => {
    if (!baseItem || !baseItem.id) return;

    if (seenIdMap.has(baseItem.id)) {
      // Merge user local photos or edits into the incoming item
      const matchIdx = seenIdMap.get(baseItem.id)!;
      const incomingItem = merged[matchIdx];
      const mergedPhotos = (baseItem.photos && baseItem.photos.length > 0)
        ? baseItem.photos
        : (incomingItem.photos || []);
      merged[matchIdx] = {
        ...baseItem,
        ...incomingItem,
        photos: mergedPhotos,
        googleDriveFolderUrl: incomingItem.googleDriveFolderUrl || baseItem.googleDriveFolderUrl,
      };
    } else {
      // Preserve user-created local drafts (ast_xxx) that have not yet been written to Google Sheet
      if (!baseItem.id.startsWith('sheet_')) {
        merged.push(baseItem);
      }
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

