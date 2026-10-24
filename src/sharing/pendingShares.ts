import { MAX_CREATION_REQUEST_BYTES, SHARE_OPERATION_TTL_MS } from './sharingContract';
import type { PendingShare } from './shareLinkClient';

const PREFIX = 'axe-shaper.sharing.pending.v1.';
type PendingStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export interface SavedPendingShare extends PendingShare { title: string; terminalError?: string }

export function sharingStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

function keyFor(pending: PendingShare): string {
  if (new TextEncoder().encode(pending.body).length > MAX_CREATION_REQUEST_BYTES) throw new Error('Oversized pending share');
  const request = JSON.parse(pending.body);
  if (!/^[A-Za-z0-9_-]{43}$/.test(request.operationKey) ||
    !/^[A-Za-z0-9_-]{43}$/.test(pending.managementSecret) || request.managementSecret !== pending.managementSecret ||
    !Number.isSafeInteger(pending.deadline) || pending.deadline <= 0) throw new Error('Invalid pending share');
  return PREFIX + request.operationKey;
}

/** Persist and read back BEFORE any upload. Separate keys prevent tabs overwriting each other. */
export function savePendingShare(storage: PendingStorage | null, pending: PendingShare, title: string): boolean {
  try {
    if (!storage) return false;
    const key = keyFor(pending);
    const value = JSON.stringify({ ...pending, title: title.slice(0, 500) });
    storage.setItem(key, value);
    return storage.getItem(key) === value;
  } catch { return false; }
}

export function savedShareAttempts(storage: PendingStorage | null, now = Date.now()): SavedPendingShare[] {
  const records: SavedPendingShare[] = [];
  try {
    if (!storage) return records;
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const raw = storage.getItem(key);
        if (!raw || raw.length > MAX_CREATION_REQUEST_BYTES * 2) continue;
        const record = JSON.parse(raw) as SavedPendingShare;
        if (keyFor(record) !== key || typeof record.title !== 'string' || record.title.length > 500 ||
          record.deadline > now + SHARE_OPERATION_TTL_MS ||
          (record.terminalError !== undefined && typeof record.terminalError !== 'string')) continue;
        records.push(record);
      } catch { /* Invalid local data is never sent. */ }
    }
  } catch { /* Storage may be blocked after the page opened. */ }
  return records.sort((a, b) => a.deadline - b.deadline);
}

/** Only requests that can still be recovered belong in the pending notice/queue. */
export function pendingShares(storage: PendingStorage | null, now = Date.now()): SavedPendingShare[] {
  return savedShareAttempts(storage, now).filter(record => record.deadline > now && !record.terminalError);
}

export function finishFailedShare(storage: PendingStorage | null, pending: PendingShare, code: string): void {
  try {
    if (!storage) return;
    const key = keyFor(pending);
    const record = JSON.parse(storage.getItem(key) ?? 'null') as SavedPendingShare | null;
    if (record) storage.setItem(key, JSON.stringify({ ...record, terminalError: code }));
  } catch { /* Keep recovery data when storage is unavailable. */ }
}

/** Only remove after the returned share ID and management key have been saved. */
export function forgetPendingShare(storage: PendingStorage | null, pending: PendingShare): void {
  try { storage?.removeItem(keyFor(pending)); } catch { /* Keeping it is safe: replay is idempotent. */ }
}
