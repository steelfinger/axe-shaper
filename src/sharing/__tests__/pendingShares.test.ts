import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/sharing/creation-v1.json';
import {
  FINISHED_SHARE_RETENTION_MS, finishFailedShare, forgetPendingShare, pendingShares, pruneFinishedShares, savedShareAttempts,
  savePendingShare,
} from '../pendingShares';
import { shareFailureMessage } from '../shareErrors';

function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
const pending = { body: JSON.stringify(fixture), managementSecret: fixture.managementSecret, deadline: 1000 };
describe('interrupted upload lifecycle', () => {
  it('removes expired operations from the recoverable queue and allows explicit dismissal of their saved details', () => {
    const local = storage();
    expect(savePendingShare(local, pending, 'Expired')).toBe(true);
    expect(pendingShares(local, 999)).toHaveLength(1);
    expect(pendingShares(local, 1000)).toEqual([]);
    expect(savedShareAttempts(local, 1000)).toHaveLength(1);
    forgetPendingShare(local, pending);
    expect(savedShareAttempts(local, 1000)).toEqual([]);
  });
  it.each(['too-large', 'invalid-project', 'revoked', 'conflict', 'operation-expired'])('never queues permanent %s failures again', code => {
    const local = storage();
    savePendingShare(local, pending, 'Rejected');
    finishFailedShare(local, pending, code);
    expect(pendingShares(local, 500)).toEqual([]);
    expect(savedShareAttempts(local, 500)[0].terminalError).toBe(code);
    expect(shareFailureMessage(code)).not.toMatch(/try again|check your connection/i);
  });
  it('drops finished requests after the retention window and keeps recoverable ones', () => {
    const local = storage();
    const live = { ...pending, body: JSON.stringify({ ...fixture, operationKey: 'B'.repeat(42) + 'A' }), deadline: 5000 };
    savePendingShare(local, pending, 'Expired');
    savePendingShare(local, live, 'Live');
    pruneFinishedShares(local, 1000 + FINISHED_SHARE_RETENTION_MS - 1);
    expect(savedShareAttempts(local, 0)).toHaveLength(2);
    pruneFinishedShares(local, 1000 + FINISHED_SHARE_RETENTION_MS);
    expect(savedShareAttempts(local, 0).map(record => record.title)).toEqual(['Live']);
  });
  it('makes room by dropping finished requests when storage is full', () => {
    const local = storage();
    // Room for one record: a second new key does not fit.
    const full = { get length() { return local.length; }, key: local.key, getItem: local.getItem, removeItem: local.removeItem,
      setItem: (key: string, value: string) => {
        if (local.length >= 1 && !local.getItem(key)) throw new DOMException('full', 'QuotaExceededError');
        local.setItem(key, value);
      } };
    savePendingShare(local, pending, 'Rejected');
    finishFailedShare(local, pending, 'too-large');
    const next = { ...pending, body: JSON.stringify({ ...fixture, operationKey: 'B'.repeat(42) + 'A' }), deadline: 5000 };
    expect(savePendingShare(full, next, 'Next')).toBe(true);
    expect(savedShareAttempts(local, 0).map(record => record.title)).toEqual(['Next']);
  });
  it('keeps different tabs’ confirmed operations separate', () => {
    const local = storage();
    const other = { ...pending, body: JSON.stringify({ ...fixture, operationKey: 'B'.repeat(42) + 'A' }) };
    savePendingShare(local, pending, 'One');
    savePendingShare(local, other, 'Two');
    expect(pendingShares(local, 500)).toHaveLength(2);
    forgetPendingShare(local, pending);
    expect(pendingShares(local, 500)[0].title).toBe('Two');
  });
});
