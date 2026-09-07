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
      // Different official PUPR registration codes mean distinct registered survey entries!
      return null;
    }
  }

  const tKec = normalizeString(target.kecamatanName || target.kecamatanId);
  const cKec = normalizeString(candidate.kecamatanName || candidate.kecamatanId);
  const isSameKec = Boolean(tKec && cKec && (tKec === cKec || target.kecamatanId === candidate.kecamatanId));

  const tDesa = normalizeString(target.desaName || target.desaId);
  const cDesa = normalizeString(candidate.desaName || candidate.desaId);
  const isSameDesa = Boolean(tDesa && cDesa && (tDesa === cDesa || target.desaId === candidate.desaId));

  // Location must match or be closely related for name matching
  if (isSameDesa || (isSameKec && (!tDesa || !cDesa))) {
    const tName = normalizeString(target.buildingName);
    const cName = normalizeString(candidate.buildingName);

    if (tName && cName) {
      // Exact building name
      if (tName === cName) {
        return {
          assessment: candidate,
          reason: 'EXACT_NAME_AND_LOCATION',
          similarityScore: 100,
          description: `Nama gedung "${candidate.buildingName}" dan lokasi (${candidate.desaName || 'Desa'}, ${candidate.kecamatanName || 'Kecamatan'}) sama persis.`,
        };
      }

      // CATATAN: Kepemilikan gedung bisa sama karena Pemda atau Pemerintah Desa
      // dapat memiliki lebih dari satu gedung (contoh: Kantor Desa, Balai Pertemuan Desa,
      // Posyandu Dusun Maunura, Posyandu Usu, dan Polindes semuanya dimiliki oleh Pemdes yang sama).
      // Oleh karena itu, kesamaan kepemilikan/pengelola BUKAN merupakan duplikat jika nama gedung berbeda.

      // High text similarity (>85%)
      const similarity = calculateTextSimilarity(tName, cName);
      if (similarity >= 0.85) {
        return {
          assessment: candidate,
          reason: 'HIGH_SIMILARITY_NAME',
          similarityScore: Math.round(similarity * 100),
          description: `Nama gedung mirip ${Math.round(similarity * 100)}% ("${candidate.buildingName}") di desa yang sama.`,
        };
      }
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
