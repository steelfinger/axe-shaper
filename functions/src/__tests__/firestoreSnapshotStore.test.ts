import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeEach, describe, expect, it } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import { UPLOAD_POLICY_REVISION } from '../../../src/sharing/projectAdmission';
import { generateShareCreationSecrets } from '../../../src/sharing/sharingContract';
import { createSnapshotService } from '../../../src/sharing/snapshotService';
import { createFirestoreSnapshotStore, SHARING_COLLECTIONS } from '../firestoreSnapshotStore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('run through `npm run functions:test` (Firestore emulator)');
initializeApp({ projectId: 'demo-axe-shaper' });
const db = getFirestore();
const client = `sha256:${'1'.repeat(64)}` as const;
const source = JSON.stringify(requestFixture);
const config = { releaseTag: 'v1.2.0', admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 },
  quotas: { globalPerDay: 100, clientPerHour: 10, clientPerDay: 25 } };
const service = () => createSnapshotService(config, { store: createFirestoreSnapshotStore(db) });
const controls = db.collection(SHARING_COLLECTIONS.control).doc('service');

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-axe-shaper/databases/(default)/documents`,
    { method: 'DELETE' });
  await controls.set({ creationEnabled: true, projectReadsEnabled: true });
});

describe('Firestore snapshot store', () => {
  it('round-trips the exact project and keeps secrets out of stored records', async () => {
    const created = await service().create(source, client);
    expect(created.replayed).toBe(false);
    const envelope = await service().read(created.id);
    expect(envelope.project).toEqual(requestFixture.project);
    expect(envelope.projectDigest).toBe(requestFixture.projectDigest);
    const stored = JSON.stringify(await Promise.all(Object.values(SHARING_COLLECTIONS).map(async name =>
      (await db.collection(name).get()).docs.map(doc => [doc.id, doc.data()]))));
    expect(stored).not.toContain(requestFixture.operationKey);
    expect(stored).not.toContain(requestFixture.managementSecret);
  });
  it('commits concurrent identical retries once, with one quota count', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => service().create(source, client)));
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect((await db.collection(SHARING_COLLECTIONS.shares).get()).size).toBe(1);
    const counts = (await db.collection(SHARING_COLLECTIONS.quotas).get()).docs.map(doc => doc.get('count'));
    expect(counts).toEqual([1, 1, 1]);
    const ttl = (await db.collection(SHARING_COLLECTIONS.operations).get()).docs[0].get('expireAt');
    expect(ttl.toMillis()).toBeGreaterThan(Date.now());
  });
  it('revokes by removing the project and fails closed without controls', async () => {
    const { id } = await service().create(source, client);
    expect((await service().revoke(id, requestFixture.managementSecret)).state).toBe('revoked');
    await expect(service().read(id)).rejects.toMatchObject({ code: 'revoked' });
    expect((await db.collection(SHARING_COLLECTIONS.shares).doc(id).get()).get('envelopeJson')).toBeNull();
    await controls.delete();
    await expect(service().create(JSON.stringify({ ...requestFixture, ...generateShareCreationSecrets() }), client))
      .rejects.toMatchObject({ code: 'unavailable' });
  });
});
