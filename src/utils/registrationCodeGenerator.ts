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
