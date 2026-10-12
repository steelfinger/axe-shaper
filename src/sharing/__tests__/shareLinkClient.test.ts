import { describe, expect, it } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import schema8 from '../../../tests/fixtures/sharing/schema8-known-jacks.json';
import type { StoredProject } from '../../types/guitar';
import { UPLOAD_POLICY_REVISION } from '../projectAdmission';
import {
  beginShare, fetchSharingStatus, forgetShareKey, loadSharedProject, manageShare, managementKeyFromInput,
  preflightShare, recoveryKeyText, rememberShareKey, sendShare, shareIdFromPath, shareUrl, storedShareKey,
} from '../shareLinkClient';
import type { SharingStatus } from '../shareLinkClient';
import { createSharingHttpHandler } from '../sharingHttp';
import { createSnapshotService } from '../snapshotService';
import { MemoryStore } from './helpers/memorySnapshotStore';

const project = requestFixture.project as unknown as StoredProject;
const clientKey = `sha256:${'1'.repeat(64)}` as const;

/** The real HTTP handler and service behind a fetch, so the client is tested against the contract itself. */
function server(maxAcceptedProjectSchema = 7) {
  const store = new MemoryStore();
  const service = createSnapshotService({ releaseTag: 'v1.2.0',
    admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema },
    quotas: { globalPerDay: 100, clientPerHour: 10, clientPerDay: 25 } }, { store });
  const handler = createSharingHttpHandler({ service, verifyAppCheck: async () => true, allowRequest: async () => true });
  let failures = 0;
  const requests: string[] = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push(`${init?.method ?? 'GET'} ${input}`);
    if (failures > 0) { failures--; throw new TypeError('network down'); }
    return handler(new Request(`https://axe-shaper-staging.web.app${input}`, init), { clientKey });
  };
  return { store, fetchImpl, requests, failNext: (count: number) => { failures = count; } };
}
const noWait = async () => undefined;
const token = async () => 'app-check-token';

describe('share link client', () => {
  it('creates a link, retries the same operation, and opens the exact design', async () => {
    const { store, fetchImpl, failNext } = server();
    const status = await fetchSharingStatus(fetchImpl);
    expect(status?.creationAvailable).toBe(true);
    const preflight = await preflightShare(project, status, true);
    if (!preflight.ok) throw new Error(preflight.reason);
    const pending = beginShare(preflight, Date.now());
    failNext(2); // first two sends never arrive; the third succeeds
    const first = await sendShare(pending, fetchImpl, token, Date.now, noWait);
    if (!first.ok) throw new Error(first.code);
    // A later manual retry of the same pending share is the same share, not a second one.
    const again = await sendShare(pending, fetchImpl, token, Date.now, noWait);
    expect(again).toEqual(first);
    expect(store.shares.size).toBe(1);
    const opened = await loadSharedProject(first.id, fetchImpl);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.project.settings.name).toBe(project.settings.name);
  });

  it('blocks before upload when the server would refuse the design', async () => {
    const schema8Project = schema8 as unknown as StoredProject;
    const status: SharingStatus = { uploadPolicyRevision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7,
      creationAvailable: true, projectReadAvailable: true };
    expect(await preflightShare(schema8Project, status, true)).toEqual({ ok: false, reason: 'unsupported-schema' });
    expect(await preflightShare(project, { ...status, creationAvailable: false }, true)).toEqual({ ok: false, reason: 'paused' });
    expect(await preflightShare(project, { ...status, uploadPolicyRevision: 'project-upload-v9' }, true)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await preflightShare(project, null, true)).toEqual({ ok: false, reason: 'unavailable' });
    // A build without App Check config cannot create links, so it never offers to.
    expect(await preflightShare(project, status, false)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('reports an unreachable status as null rather than guessing', async () => {
    expect(await fetchSharingStatus(async () => { throw new TypeError('offline'); })).toBeNull();
    expect(await fetchSharingStatus(async () => new Response('<html>', { status: 200 }))).toBeNull();
  });

  it('stops retrying at the fixed deadline instead of creating a new operation', async () => {
    const { fetchImpl, requests } = server();
    const preflight = await preflightShare(project, await fetchSharingStatus(fetchImpl), true);
    if (!preflight.ok) throw new Error(preflight.reason);
    const pending = beginShare(preflight, 1_000_000);
    expect(await sendShare(pending, fetchImpl, token, () => pending.deadline, noWait))
      .toEqual({ ok: false, code: 'operation-expired', retryable: false });
    expect(requests.filter(request => request.startsWith('POST'))).toHaveLength(0);
  });

  it('explains removed and unknown shares instead of opening something else', async () => {
    const { fetchImpl } = server();
    const preflight = await preflightShare(project, await fetchSharingStatus(fetchImpl), true);
    if (!preflight.ok) throw new Error(preflight.reason);
    const pending = beginShare(preflight, Date.now());
    const created = await sendShare(pending, fetchImpl, token, Date.now, noWait);
    if (!created.ok) throw new Error(created.code);
    await fetchImpl(`/api/shares/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${pending.managementSecret}` } });
    const removed = await loadSharedProject(created.id, fetchImpl);
    expect(removed.ok ? '' : removed.message).toMatch(/removed/);
    const unknown = await loadSharedProject('Z'.repeat(20), fetchImpl);
    expect(unknown.ok ? '' : unknown.message).toMatch(/does not point to a design/);
  });

  it('parses the SPA share routes and builds the one public URL', () => {
    const id = 'mNYiSR2ND7TWcLMTkYk4';
    expect(shareIdFromPath(`/app/share/${id}/`)).toBe(id);
    expect(shareIdFromPath(`/download/share/${id}`, 'download')).toBe(id);
    // The landing page is server-rendered; the SPA never claims it.
    expect(shareIdFromPath(`/share/${id}`)).toBeNull();
    expect(shareIdFromPath(`/download/share/${id}`)).toBeNull();
    expect(shareIdFromPath('/app/share/../etc')).toBeNull();
    expect(shareIdFromPath(`/app/share/${id}/extra`)).toBeNull();
    expect(shareUrl('https://axe-shaper-staging.web.app', id)).toBe(`https://axe-shaper-staging.web.app/share/${id}`);
  });

  it('lets the creator check and remove a link with the key, and refuses any other key alike', async () => {
    const { fetchImpl } = server();
    const preflight = await preflightShare(project, await fetchSharingStatus(fetchImpl), true);
    if (!preflight.ok) throw new Error(preflight.reason);
    const pending = beginShare(preflight, Date.now());
    const created = await sendShare(pending, fetchImpl, token, Date.now, noWait);
    if (!created.ok) throw new Error(created.code);
    expect(await manageShare(created.id, pending.managementSecret, 'status', fetchImpl))
      .toEqual({ ok: true, state: 'active', revokedAt: null });
    const wrong = await manageShare(created.id, 'A'.repeat(43), 'status', fetchImpl);
    const unknown = await manageShare('Z'.repeat(20), pending.managementSecret, 'status', fetchImpl);
    expect(wrong).toEqual(unknown);
    expect(wrong.ok).toBe(false);
    const removed = await manageShare(created.id, pending.managementSecret, 'revoke', fetchImpl);
    expect(removed.ok && removed.state).toBe('revoked');
    // Removing again is harmless and keeps the original removal time.
    expect(await manageShare(created.id, pending.managementSecret, 'revoke', fetchImpl)).toEqual(removed);
  });

  it('reads a key from the bare key or the whole recovery file', () => {
    const key = 'k'.repeat(43);
    expect(managementKeyFromInput(`  ${key}\n`)).toBe(key);
    const file = recoveryKeyText('https://axe-shaper-staging.web.app/share/mNYiSR2ND7TWcLMTkYk4', 'mNYiSR2ND7TWcLMTkYk4', key, 'Strat');
    expect(file).toContain('Manage it at: https://axe-shaper-staging.web.app/manage/share/mNYiSR2ND7TWcLMTkYk4');
    expect(managementKeyFromInput(file)).toBe(key);
    expect(managementKeyFromInput('not a key')).toBeNull();
    expect(managementKeyFromInput(`${key}x`)).toBeNull();
  });

  it('remembers keys per link, and survives storage that is missing, corrupt or full', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (name: string) => map.get(name) ?? null, setItem: (name: string, value: string) => { map.set(name, value); } };
    const key = { managementSecret: 'k'.repeat(43), title: 'Strat', createdAt: '2026-10-12T15:15:25.125Z' };
    rememberShareKey(storage, 'A'.repeat(20), key);
    rememberShareKey(storage, 'B'.repeat(20), { ...key, title: 'Bass' });
    expect(storedShareKey(storage, 'A'.repeat(20))).toEqual(key);
    forgetShareKey(storage, 'A'.repeat(20));
    expect(storedShareKey(storage, 'A'.repeat(20))).toBeNull();
    expect(storedShareKey(storage, 'B'.repeat(20))?.title).toBe('Bass');
    map.set('axe-shaper.sharing.keys.v1', '{not json');
    expect(storedShareKey(storage, 'B'.repeat(20))).toBeNull();
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    expect(() => rememberShareKey(full, 'A'.repeat(20), key)).not.toThrow();
    expect(storedShareKey(null, 'A'.repeat(20))).toBeNull();
  });

  it('sends nothing without an App Check token, and carries the token when there is one', async () => {
    const { fetchImpl, requests, store } = server();
    const preflight = await preflightShare(project, await fetchSharingStatus(fetchImpl), true);
    if (!preflight.ok) throw new Error(preflight.reason);
    const pending = beginShare(preflight, Date.now());
    expect(await sendShare(pending, fetchImpl, async () => null, Date.now, noWait))
      .toEqual({ ok: false, code: 'attestation', retryable: true });
    expect(requests.filter(request => request.startsWith('POST'))).toHaveLength(0);
    const seen: (string | null)[] = [];
    const recording = async (input: string, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('X-Firebase-AppCheck'));
      return fetchImpl(input, init);
    };
    expect((await sendShare(pending, recording, token, Date.now, noWait)).ok).toBe(true);
    expect(seen).toEqual(['app-check-token']);
    expect(store.shares.size).toBe(1);
  });
});
