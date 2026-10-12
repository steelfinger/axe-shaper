import { afterEach, describe, expect, it, vi } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import schema8 from '../../../tests/fixtures/sharing/schema8-known-jacks.json';
import { projectDigest } from '../canonicalJson';
import { UPLOAD_POLICY_REVISION } from '../projectAdmission';
import { generateShareCreationSecrets, readSharedProjectEnvelope, SHARE_OPERATION_TTL_MS, SHARE_RETRY_SAFETY_MARGIN_MS, shareCreationRetryDeadline } from '../sharingContract';
import type { ProjectDigest } from '../sharingContract';
import { allocateShareId, createSnapshotService } from '../snapshotService';
import type { SnapshotServiceConfig } from '../snapshotService';

import { MemoryStore } from './helpers/memorySnapshotStore';

const client = `sha256:${'1'.repeat(64)}` as const;
const otherClient = `sha256:${'2'.repeat(64)}` as const;
const source = JSON.stringify(requestFixture);
const config: SnapshotServiceConfig = {
  releaseTag: 'v1.2.0', admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 },
  quotas: { globalPerDay: 100, clientPerHour: 10, clientPerDay: 25 },
};
function setup(overrides: Partial<SnapshotServiceConfig> = {}) {
  const store = new MemoryStore();
  let tick = Date.parse('2026-10-12T10:00:00.000Z');
  let nextId = 0;
  const service = createSnapshotService({ ...config, ...overrides }, { store, now: () => tick,
    allocateId: () => `A${String(++nextId).padStart(19, '0')}` });
  return { store, service, advance: (ms: number) => { tick += ms; } };
}
function freshRequest() { return JSON.stringify({ ...requestFixture, ...generateShareCreationSecrets() }); }
afterEach(() => vi.unstubAllGlobals());

describe('transactional snapshot service', () => {
  it('stores the exact saved project and returns only a valid public projection', async () => {
    const { store, service } = setup();
    const result = await service.create(source, client);
    expect(result).toEqual({ id: 'A0000000000000000001', createdAt: '2026-10-12T10:00:00.000Z', replayed: false });
    const envelope = await service.read(result.id);
    expect(envelope.project).toEqual(requestFixture.project);
    expect(await readSharedProjectEnvelope(JSON.stringify(envelope), result.id, 7)).toEqual(envelope);
    const publicText = JSON.stringify(envelope);
    for (const secret of ['operationKey', 'managementSecret', 'requestDigest', client]) expect(publicText).not.toContain(secret);
    const privateText = JSON.stringify([...store.shares, ...store.operations, ...store.quotas]);
    expect(privateText).not.toContain(requestFixture.operationKey);
    expect(privateText).not.toContain(requestFixture.managementSecret);
  });
  it('counts concurrent retries once and recovers a lost response without new records', async () => {
    const { store, service } = setup({ quotas: { globalPerDay: 1, clientPerHour: 1, clientPerDay: 1 } });
    const results = await Promise.all(Array.from({ length: 12 }, () => service.create(source, client)));
    expect(new Set(results.map(value => value.id)).size).toBe(1);
    expect(results.filter(value => !value.replayed)).toHaveLength(1);
    expect(store.shares.size).toBe(1); expect(store.operations.size).toBe(1);
    expect([...store.quotas.values()].map(value => value.count)).toEqual([1, 1, 1]);
    const retry = JSON.stringify(Object.fromEntries(Object.entries(requestFixture).reverse()), null, 2);
    expect(await service.create(retry, client)).toEqual({ ...results[0], replayed: true });
  });
  it('rejects changed content and changed management authority under the same operation', async () => {
    const { store, service } = setup();
    await service.create(source, client);
    const project = structuredClone(requestFixture.project);
    project.metadata.author = 'Different';
    await expect(service.create(JSON.stringify({ ...requestFixture, project, projectDigest: await projectDigest(project) }), client))
      .rejects.toMatchObject({ code: 'conflict', status: 409 });
    await expect(service.create(JSON.stringify({ ...requestFixture, managementSecret: generateShareCreationSecrets().managementSecret }), client))
      .rejects.toMatchObject({ code: 'conflict' });
    expect(store.shares.size).toBe(1);
    expect([...store.quotas.values()].every(value => value.count === 1)).toBe(true);
  });
  it('does not deduplicate independent creations by project digest', async () => {
    const { store, service } = setup();
    const a = await service.create(source, client);
    const b = await service.create(freshRequest(), client);
    expect(a.id).not.toBe(b.id); expect(store.shares.size).toBe(2);
  });
  it('atomically admits only one concurrent request at the global limit', async () => {
    const { store, service } = setup({ quotas: { globalPerDay: 1, clientPerHour: 10, clientPerDay: 25 } });
    const results = await Promise.allSettled([service.create(source, client), service.create(freshRequest(), otherClient)]);
    expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(value => value.status === 'rejected')).toMatchObject({ reason: { code: 'quota-exceeded', status: 429 } });
    expect(store.shares.size).toBe(1); expect(store.operations.size).toBe(1); expect(store.quotas.size).toBe(3);
  });
  it('uses UTC fixed windows and resets the hourly counter exactly at the boundary', async () => {
    const { store, service, advance } = setup({ quotas: { globalPerDay: 100, clientPerHour: 1, clientPerDay: 2 } });
    await service.create(source, client);
    await expect(service.create(freshRequest(), client)).rejects.toMatchObject({ code: 'quota-exceeded' });
    advance(60 * 60 * 1000);
    await service.create(freshRequest(), client);
    advance(60 * 60 * 1000);
    await expect(service.create(freshRequest(), client)).rejects.toMatchObject({ code: 'quota-exceeded' });
    expect(store.shares.size).toBe(2);
    advance(12 * 60 * 60 * 1000); // midnight UTC
    await service.create(freshRequest(), client);
    expect(store.shares.size).toBe(3);
  });
  it('rolls back snapshot, operation and all quotas on commit failure', async () => {
    const { store, service } = setup(); store.failCommit = true;
    await expect(service.create(source, client)).rejects.toMatchObject({ code: 'unavailable', message: 'unavailable', status: 503 });
    expect([store.shares.size, store.operations.size, store.quotas.size]).toEqual([0, 0, 0]);
    expect((await service.create(source, client)).replayed).toBe(false);
    expect([...store.quotas.values()].every(value => value.count === 1)).toBe(true);
  });
  it('supports transaction callback reruns without duplicate records or counts', async () => {
    const { store, service } = setup(); store.rerun = true;
    await service.create(source, client);
    expect([store.shares.size, store.operations.size, store.quotas.size]).toEqual([1, 1, 3]);
    expect([...store.quotas.values()].every(value => value.count === 1)).toBe(true);
  });
  it('replays a concurrent winner committed between callback attempts', async () => {
    const { store, service } = setup();
    const winningStore = new MemoryStore();
    const winningService = createSnapshotService(config, { store: winningStore,
      allocateId: () => 'Z0000000000000000000', now: () => Date.parse('2026-10-12T10:00:00.000Z') });
    const winner = await winningService.create(source, client);
    store.rerun = true;
    store.betweenAttempts = () => {
      store.shares = structuredClone(winningStore.shares);
      store.operations = structuredClone(winningStore.operations);
      store.quotas = structuredClone(winningStore.quotas);
    };
    expect(await service.create(source, client)).toEqual({ ...winner, replayed: true });
    expect(store.shares.size).toBe(1);
    expect([...store.quotas.values()].every(value => value.count === 1)).toBe(true);
  });
  it('uses the final transaction attempt clock consistently across midnight', async () => {
    const { store, service, advance } = setup();
    advance(14 * 60 * 60 * 1000 - 1); // 23:59:59.999Z
    store.rerun = true;
    store.betweenAttempts = () => advance(2);
    const result = await service.create(source, client);
    expect(result.createdAt).toBe('2026-10-13T00:00:00.001Z');
    expect((await service.read(result.id)).createdAt).toBe(result.createdAt);
    const dayStart = Date.parse('2026-10-13T00:00:00.000Z');
    expect(store.quotas.has(`global:${dayStart}`)).toBe(true);
    expect([...store.operations.values()][0].expiresAt).toBe(Date.parse(result.createdAt) + SHARE_OPERATION_TTL_MS);
  });
  it('refuses expired retries even if TTL cleanup has not removed the operation', async () => {
    const { store, service, advance } = setup();
    const result = await service.create(source, client);
    advance(SHARE_OPERATION_TTL_MS - 1); expect((await service.create(source, client)).id).toBe(result.id);
    advance(1); await expect(service.create(source, client)).rejects.toMatchObject({ code: 'operation-expired', status: 409 });
    expect(store.shares.size).toBe(1); expect(store.operations.size).toBe(1);
    expect((await service.read(result.id)).id).toBe(result.id);
  });
  it('requires the management secret and does not disclose state to another capability', async () => {
    const { service } = setup(); const { id } = await service.create(source, client);
    const wrongKey = generateShareCreationSecrets().managementSecret;
    await expect(service.managementStatus(id, wrongKey)).rejects.toMatchObject({ code: 'not-found' });
    await expect(service.revoke(id, wrongKey)).rejects.toMatchObject({ code: 'not-found' });
    await expect(service.revoke(id, id)).rejects.toMatchObject({ code: 'malformed-request' });
    expect(await service.managementStatus(id, requestFixture.managementSecret)).toEqual({ id, state: 'active', revokedAt: null });
  });
  it('revokes idempotently, removes content immediately and never restores a revoked retry', async () => {
    const { store, service, advance } = setup(); const { id } = await service.create(source, client);
    const status = await service.revoke(id, requestFixture.managementSecret);
    advance(1000);
    expect(await service.revoke(id, requestFixture.managementSecret)).toEqual(status);
    expect(await service.managementStatus(id, requestFixture.managementSecret)).toEqual(status);
    expect(store.shares.get(id)?.envelope).toBeNull();
    await expect(service.read(id)).rejects.toMatchObject({ code: 'revoked', status: 410 });
    await expect(service.create(source, client)).rejects.toMatchObject({ code: 'revoked' });
    expect(store.shares.size).toBe(1);
    expect([...store.quotas.values()].every(value => value.count === 1)).toBe(true);
  });
  it('keeps a revoke racing concurrent retries final', async () => {
    const { store, service } = setup(); const { id } = await service.create(source, client);
    const results = await Promise.allSettled([service.create(source, client), service.revoke(id, requestFixture.managementSecret),
      service.create(source, client)]);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'revoked' });
    }
    expect(store.shares.get(id)?.envelope).toBeNull();
    await expect(service.read(id)).rejects.toMatchObject({ code: 'revoked' });
  });
  it('pauses new creation independently of reads and preserves recovery and removal', async () => {
    const { store, service } = setup(); const { id } = await service.create(source, client);
    store.controls = { creationEnabled: false, projectReadsEnabled: true };
    await expect(service.create(freshRequest(), client)).rejects.toMatchObject({ code: 'unavailable', status: 503 });
    expect((await service.create(source, client)).replayed).toBe(true);
    expect((await service.read(id)).id).toBe(id);
    expect(await service.status()).toEqual({ releaseTag: 'v1.2.0', uploadPolicyRevision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7,
      creationAvailable: false, projectReadAvailable: true });
    store.controls = { creationEnabled: true, projectReadsEnabled: false };
    await expect(service.read(id)).rejects.toMatchObject({ code: 'unavailable' });
    expect((await service.revoke(id, requestFixture.managementSecret)).state).toBe('revoked');
  });
  it('fails closed on missing controls, while management remains available', async () => {
    const { store, service } = setup(); const { id } = await service.create(source, client); store.controls = null;
    await expect(service.create(freshRequest(), client)).rejects.toMatchObject({ code: 'unavailable' });
    await expect(service.read(id)).rejects.toMatchObject({ code: 'unavailable' });
    await expect(service.status()).rejects.toMatchObject({ code: 'unavailable' });
    expect((await service.revoke(id, requestFixture.managementSecret)).state).toBe('revoked');
  });
  it('rejects bad IDs and inadmissible bodies before touching storage', async () => {
    const { store, service } = setup();
    await expect(service.read('../other')).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(service.revoke('../other', requestFixture.managementSecret)).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(service.create('{}', client)).rejects.toMatchObject({ code: 'malformed-request' });
    await expect(service.create(source, 'not-a-trusted-hash' as ProjectDigest)).rejects.toMatchObject({ code: 'malformed-request' });
    expect(store.calls).toBe(0);
  });
  it('rejects a new creation above the ceiling after only an operation lookup, without writes or quota', async () => {
    const { store, service } = setup();
    await expect(service.create(JSON.stringify({ ...requestFixture, project: schema8, projectDigest: await projectDigest(schema8) }), client))
      .rejects.toMatchObject({ code: 'unsupported-schema' });
    expect(store.shares.size).toBe(0); expect(store.operations.size).toBe(0); expect(store.quotas.size).toBe(0);
  });
  it('preserves existing higher-schema snapshots and their original release after an admission rollback', async () => {
    const { store, service } = setup({ releaseTag: 'v1.3.0',
      admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 8 } });
    const body = JSON.stringify({ ...requestFixture, project: schema8, projectDigest: await projectDigest(schema8) });
    const { id } = await service.create(body, client);
    const rolledBack = createSnapshotService(config, { store });
    const envelope = await rolledBack.read(id);
    expect(envelope.project).toEqual(schema8);
    expect(envelope.requirements.supportManifest).toBe('/sharing/releases/v1.3.0.json');
    expect((await rolledBack.status()).maxAcceptedProjectSchema).toBe(7);
  });
  it('replays a creation accepted before an admission rollback, but refuses new ones above the ceiling', async () => {
    const { store, service } = setup({ releaseTag: 'v1.3.0',
      admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 8 } });
    const body = JSON.stringify({ ...requestFixture, project: schema8, projectDigest: await projectDigest(schema8) });
    const first = await service.create(body, client);
    const quotasBefore = structuredClone([...store.quotas.entries()]);
    const rolledBack = createSnapshotService(config, { store, now: () => Date.parse('2026-10-12T10:00:00.000Z') });
    // The first response was lost: the identical retry still recovers the ID and management works.
    expect(await rolledBack.create(body, client)).toEqual({ ...first, replayed: true });
    expect([...store.quotas.entries()]).toEqual(quotasBefore);
    expect((await rolledBack.managementStatus(first.id, requestFixture.managementSecret)).state).toBe('active');
    const fresh = JSON.stringify({ ...JSON.parse(body), ...generateShareCreationSecrets() });
    await expect(rolledBack.create(fresh, client)).rejects.toMatchObject({ code: 'unsupported-schema' });
    expect(store.shares.size).toBe(1); expect(store.operations.size).toBe(1);
  });
  it('knows a conservative retry deadline before sending even if the response is lost', async () => {
    const { store, service, advance } = setup();
    const start = Date.parse('2026-10-12T10:00:00.000Z');
    const deadline = shareCreationRetryDeadline(start);
    expect(deadline).toBe(start + SHARE_OPERATION_TTL_MS - SHARE_RETRY_SAFETY_MARGIN_MS);
    expect(new Date(deadline).toISOString()).toBe('2026-10-13T09:59:00.000Z');
    advance(2000); // validation/network delay before first server acceptance
    await service.create(source, client); // simulate discarding the response
    expect([...store.operations.values()][0].expiresAt).toBeGreaterThan(deadline);
    expect(() => shareCreationRetryDeadline(NaN)).toThrow('malformed-request');
    expect(() => shareCreationRetryDeadline(Number.MAX_SAFE_INTEGER)).toThrow('malformed-request');
  });
  it.each(['unknown-policy', '__proto__', 'constructor'])('rejects invalid revision %s at startup before storage', revision => {
    const store = new MemoryStore();
    expect(() => createSnapshotService({ ...config, admission: { ...config.admission, revision } }, { store }))
      .toThrow('unavailable');
    expect(store.calls).toBe(0);
  });
  it('maps failed or malformed custom allocators to unavailable before storage', async () => {
    const store = new MemoryStore();
    for (const allocateId of [() => { throw new Error('private allocator detail'); }, () => 'bad-id']) {
      const service = createSnapshotService(config, { store, allocateId });
      await expect(service.create(source, client)).rejects.toMatchObject({ code: 'unavailable', message: 'unavailable', status: 503 });
    }
    expect(store.calls).toBe(0);
  });
  it('distinguishes absent shares from revocation and never replaces an ID collision', async () => {
    const { store, service } = setup(); await service.create(source, client);
    await expect(service.read('Z0000000000000000000')).rejects.toMatchObject({ code: 'not-found', status: 404 });
    const colliding = createSnapshotService(config, { store, allocateId: () => 'A0000000000000000001' });
    await expect(colliding.create(freshRequest(), client)).rejects.toMatchObject({ code: 'unavailable' });
    expect(store.shares.size).toBe(1);
  });
  it('detaches release configuration so caller mutation cannot raise the ceiling or quotas', async () => {
    const mutable = structuredClone(config);
    const { service } = setup(mutable);
    mutable.admission.maxAcceptedProjectSchema = 8; mutable.quotas.globalPerDay = 1000;
    expect((await service.status()).maxAcceptedProjectSchema).toBe(7);
  });
});

describe('opaque ID allocation', () => {
  it('uses unbiased alphanumeric bytes, skipping the rejected tail', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(0); bytes.set([255, 248, 249, 250, ...Array.from({ length: 20 }, (_, i) => i)]); return bytes; } });
    expect(allocateShareId()).toBe('ABCDEFGHIJKLMNOPQRST');
  });
  it('returns a typed failure for missing or broken randomness', () => {
    vi.stubGlobal('crypto', undefined);
    expect(allocateShareId).toThrow('unavailable');
    const fill = vi.fn((bytes: Uint8Array) => bytes.fill(255)); vi.stubGlobal('crypto', { getRandomValues: fill });
    expect(allocateShareId).toThrow('unavailable'); expect(fill).toHaveBeenCalledTimes(8);
  });
});
