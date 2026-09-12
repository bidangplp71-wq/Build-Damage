import { BuildingAssessment } from '../types';

const OFFLINE_QUEUE_KEY = 'sipandu_offline_sync_outbox';

export interface PendingSyncItem {
  id: string;
  operation: 'insert' | 'update';
  assessment: BuildingAssessment;
  queuedAt: string;
  attempts: number;
}

/**
 * Get all queued sync items from local storage
 */
export function getOfflineSyncQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save updated queue to local storage
 */
function saveOfflineSyncQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(0, 200)));
  } catch (err) {
    console.warn('Gagal menyimpan offline sync queue:', err);
  }
}

/**
 * Add or update an assessment in the offline sync queue
 */
export function queueAssessmentForSync(
  assessment: BuildingAssessment,
  operation: 'insert' | 'update' = 'insert'
): void {
  if (!assessment || !assessment.id) return;

  const queue = getOfflineSyncQueue();
  const existingIdx = queue.findIndex((item) => item.id === assessment.id);

  const newItem: PendingSyncItem = {
    id: assessment.id,
    operation,
    assessment,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = newItem;
  } else {
    queue.push(newItem);
  }

  saveOfflineSyncQueue(queue);
}

/**
 * Remove an item from the offline sync queue after successful upload
 */
export function removeAssessmentFromSyncQueue(assessmentId: string): void {
  const queue = getOfflineSyncQueue();
  const filtered = queue.filter((item) => item.id !== assessmentId);
  saveOfflineSyncQueue(filtered);
}

/**
 * Process and flush the offline sync queue to the server
 */
export async function flushOfflineSyncQueue(
  onItemSynced?: (item: PendingSyncItem) => void
): Promise<{ processed: number; succeeded: number }> {
  const queue = getOfflineSyncQueue();
  if (queue.length === 0) return { processed: 0, succeeded: 0 };

  let succeeded = 0;

  for (const item of queue) {
    try {
      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.assessment),
      });

      if (response.ok) {
        removeAssessmentFromSyncQueue(item.id);
        succeeded++;
        if (onItemSynced) {
          onItemSynced(item);
        }
      } else {
        item.attempts = (item.attempts || 0) + 1;
        saveOfflineSyncQueue(queue);
      }
    } catch {
      item.attempts = (item.attempts || 0) + 1;
      saveOfflineSyncQueue(queue);
    }
  }

  return { processed: queue.length, succeeded };
}
