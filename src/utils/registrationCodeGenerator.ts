import { BuildingAssessment } from '../types';

/**
 * Utility to generate and validate sequential PUPR building assessment registration codes.
 * Standard format: REG-PUPR-YYYY-0001
 * Example: REG-PUPR-2026-0001, REG-PUPR-2026-0002, REG-PUPR-2026-0003
 */

export function generateNextRegistrationCode(
  existingAssessments: BuildingAssessment[] = [],
  customYear?: number
): string {
  const currentYear = customYear || new Date().getFullYear();
  const yearPrefix = `REG-PUPR-${currentYear}-`;

  // Set of all lowercased existing codes for instant uniqueness checking
  const existingCodeSet = new Set<string>();
  existingAssessments.forEach((a) => {
    if (a.code && a.code.trim()) {
      existingCodeSet.add(a.code.trim().toUpperCase());
    }
    // Also include id if id looks like a registration code
    if (a.id && a.id.trim().toUpperCase().startsWith('REG-')) {
      existingCodeSet.add(a.id.trim().toUpperCase());
    }
  });

  let maxSequence = 0;

  existingAssessments.forEach((a) => {
    const rawCode = (a.code || a.id || '').trim().toUpperCase();
    if (!rawCode) return;

    // Pattern 1: REG-PUPR-2026-0001 or REG-PUPR-2026-1
    const matchFull = rawCode.match(/REG-PUPR-(\d{4})-(\d+)/);
    if (matchFull) {
      const year = parseInt(matchFull[1], 10);
      const seq = parseInt(matchFull[2], 10);
      if (year === currentYear && !isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
      return;
    }

    // Pattern 2: REG-PUPR-0001 or REG-PUPR-1
    const matchSimple = rawCode.match(/REG-PUPR-(\d+)/);
    if (matchSimple) {
      const seq = parseInt(matchSimple[1], 10);
      if (!isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
      return;
    }

    // Pattern 3: REG-2026-0001 or REG-0001
    const matchGeneral = rawCode.match(/REG-(?:(\d{4})-)?(\d+)/);
    if (matchGeneral) {
      const seq = parseInt(matchGeneral[2], 10);
      if (!isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
      return;
    }

    // Pattern 4: Any trailing digits e.g. 0001, 001
    const matchTrailing = rawCode.match(/(\d+)$/);
    if (matchTrailing) {
      const seq = parseInt(matchTrailing[1], 10);
      // Only treat as sequence if within reasonable range (< 100000) and length <= 5
      if (!isNaN(seq) && seq > 0 && seq < 100000 && matchTrailing[1].length <= 5) {
        if (seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  });

  // If no sequence was extracted, default starting number to existingAssessments.length + 1
  let nextSeq = maxSequence > 0 ? maxSequence + 1 : Math.max(1, existingAssessments.length + 1);

  // Guarantee uniqueness: loop until an unused code is found
  let candidateCode = `${yearPrefix}${String(nextSeq).padStart(4, '0')}`;
  while (existingCodeSet.has(candidateCode.toUpperCase())) {
    nextSeq++;
    candidateCode = `${yearPrefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidateCode;
}

/**
 * Derives the standard prefix for an assessment based on kecamatan or PUPR convention
 */
export function getKecamatanCodePrefix(
  assessment: Partial<BuildingAssessment>,
  year: number = new Date().getFullYear()
): string {
  const kecName = (assessment.kecamatanName || assessment.sourceSheet || assessment.targetSheetName || '')
    .toUpperCase()
    .replace(/^KEC\.?\s*/i, '')
    .trim();

  let prefix = 'PUPR';
  if (kecName.includes('AESESA SELATAN') || kecName.includes('ASEL')) {
    prefix = 'ASS';
  } else if (kecName.includes('AESESA')) {
    prefix = 'AES';
  } else if (kecName.includes('BOAWAE')) {
    prefix = 'BOA';
  } else if (kecName.includes('MAUPONGGO')) {
    prefix = 'MPO';
  } else if (kecName.includes('NANGARORO')) {
    prefix = 'NGA';
  } else if (kecName.includes('KEO TENGAH') || kecName.includes('KEO')) {
    prefix = 'KEO';
  } else if (kecName.includes('WOLOWAE')) {
    prefix = 'WLW';
  } else if (kecName.length >= 3) {
    prefix = kecName.replace(/[^A-Z]/g, '').slice(0, 3);
  }

  return `REG-${prefix}-${year}-`;
}

/**
 * Automatically detects and fixes duplicate or conflicting registration codes across all assessments.
 * The first assessment keeps its registration code. Any subsequent assessment with the same code
 * gets assigned a brand-new, unique sequential registration code.
 */
export function autoFixDuplicateRegistrationCodes(
  assessments: BuildingAssessment[],
  customYear?: number
): {
  updatedAssessments: BuildingAssessment[];
  fixedCount: number;
  fixedItems: Array<{
    id: string;
    buildingName: string;
    oldCode: string;
    newCode: string;
    sourceSheet?: string;
  }>;
} {
  const currentYear = customYear || new Date().getFullYear();
  const seenCodes = new Set<string>();
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

  const fixedItems: Array<{
    id: string;
    buildingName: string;
    oldCode: string;
    newCode: string;
    sourceSheet?: string;
  }> = [];

  // 1. First pass: Register all valid, non-duplicate codes
  const codeCounts = new Map<string, number>();
  assessments.forEach((a) => {
    const rawCode = (a.code || '').trim().toUpperCase();
    if (rawCode && !invalidCodes.has(rawCode.toLowerCase()) && rawCode.length >= 3) {
      codeCounts.set(rawCode, (codeCounts.get(rawCode) || 0) + 1);
    }
  });

  // Track the highest sequence per prefix to generate sequential codes cleanly
  const maxSeqPerPrefix = new Map<string, number>();

  assessments.forEach((a) => {
    const rawCode = (a.code || '').trim().toUpperCase();
    if (!rawCode) return;
    const match = rawCode.match(/^REG-([A-Z0-9]+)-(\d{4})-(\d+)$/i);
    if (match) {
      const prefix = `REG-${match[1].toUpperCase()}-${match[2]}-`;
      const seq = parseInt(match[3], 10);
      if (!isNaN(seq)) {
        const currentMax = maxSeqPerPrefix.get(prefix) || 0;
        if (seq > currentMax) {
          maxSeqPerPrefix.set(prefix, seq);
        }
      }
    }
  });

  const updatedAssessments = assessments.map((assessment) => {
    const rawCode = (assessment.code || '').trim();
    const upperCode = rawCode.toUpperCase();
    const isInvalid = !rawCode || invalidCodes.has(rawCode.toLowerCase()) || rawCode.length < 3;

    // If valid and hasn't been seen yet, keep it!
    if (!isInvalid && !seenCodes.has(upperCode)) {
      seenCodes.add(upperCode);
      return assessment;
    }

    // It is a duplicate or invalid/missing registration code! Generate a new unique code.
    let basePrefix = getKecamatanCodePrefix(assessment, currentYear);

    // If original code was like REG-PUPR-2026-0001 or REG-AES-2026-0001, try to preserve the prefix
    const originalPrefixMatch = upperCode.match(/^REG-([A-Z0-9]+)-(\d{4})-/i);
    if (originalPrefixMatch) {
      basePrefix = `REG-${originalPrefixMatch[1].toUpperCase()}-${originalPrefixMatch[2]}-`;
    }

    let nextSeq = (maxSeqPerPrefix.get(basePrefix) || 0) + 1;
    let candidateCode = `${basePrefix}${String(nextSeq).padStart(4, '0')}`;

    while (seenCodes.has(candidateCode.toUpperCase())) {
      nextSeq++;
      candidateCode = `${basePrefix}${String(nextSeq).padStart(4, '0')}`;
    }

    maxSeqPerPrefix.set(basePrefix, nextSeq);
    seenCodes.add(candidateCode.toUpperCase());

    fixedItems.push({
      id: assessment.id,
      buildingName: assessment.buildingName,
      oldCode: rawCode || '(Kosong / Tidak Valid)',
      newCode: candidateCode,
      sourceSheet: assessment.sourceSheet || (assessment.kecamatanName ? `Kec. ${assessment.kecamatanName}` : undefined),
    });

    return {
      ...assessment,
      code: candidateCode,
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    updatedAssessments,
    fixedCount: fixedItems.length,
    fixedItems,
  };
}

/**
 * Validates if a registration code is unique among assessments
 */
export function isRegistrationCodeUnique(
  code: string,
  existingAssessments: BuildingAssessment[] = [],
  excludeAssessmentId?: string
): boolean {
  if (!code || !code.trim()) return true;
  const normalized = code.trim().toUpperCase();

  return !existingAssessments.some((a) => {
    if (excludeAssessmentId && a.id === excludeAssessmentId) return false;
    const aCode = (a.code || '').trim().toUpperCase();
    return aCode === normalized;
  });
}
