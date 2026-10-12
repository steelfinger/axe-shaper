import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import type {
  CreationOperationRecord, SnapshotControls, SnapshotQuotaRecord, SnapshotRecord, SnapshotStore, SnapshotTransaction,
} from '../../src/sharing/snapshotService';
import type { ProjectDigest, SharedProjectEnvelope } from '../../src/sharing/sharingContract';

/**
 * Collections are private: firestore.rules denies every client, and only this
 * Admin SDK adapter reads or writes them.
 *
 * The envelope is stored as JSON text, not as a Firestore map. A map would
 * re-type numbers (integer vs double), cannot hold nested arrays, and is not
 * guaranteed to give back the exact value that was digested; text does.
 *
 * `expireAt` is a Timestamp copy of `expiresAt` for Firestore TTL cleanup only.
 * The service checks expiry itself, so a late TTL delete changes nothing.
 */
export const SHARING_COLLECTIONS = Object.freeze({
  shares: 'sharingShares',
  operations: 'sharingOperations',
  quotas: 'sharingQuotas',
  control: 'sharingControl',
});
const CONTROLS_DOC = 'service';

interface StoredShare { envelopeJson: string | null; managementSecretHash: string; revokedAt: string | null }

function shareFrom(data: StoredShare): SnapshotRecord {
  return {
    envelope: data.envelopeJson === null ? null : Object.freeze(JSON.parse(data.envelopeJson) as SharedProjectEnvelope),
    managementSecretHash: data.managementSecretHash as ProjectDigest,
    revokedAt: data.revokedAt,
  };
}

export function createFirestoreSnapshotStore(db: Firestore): SnapshotStore {
  const share = (id: string) => db.collection(SHARING_COLLECTIONS.shares).doc(id);
  const operation = (hash: string) => db.collection(SHARING_COLLECTIONS.operations).doc(hash);
  const quota = (key: string) => db.collection(SHARING_COLLECTIONS.quotas).doc(key);
  const controls = db.collection(SHARING_COLLECTIONS.control).doc(CONTROLS_DOC);

  return {
    transaction<T>(action: (tx: SnapshotTransaction) => Promise<T>): Promise<T> {
      return db.runTransaction(async (t: Transaction) => {
        // Firestore requires every read before the first write, and reruns this
        // callback on contention. Buffer writes per attempt and apply them last,
        // so a rerun starts clean and a failed attempt writes nothing.
        const writes: [DocumentReference, Record<string, unknown>][] = [];
        const read = async (ref: DocumentReference) => {
          if (writes.length) throw new Error('read after write in a snapshot transaction');
          const snapshot = await t.get(ref);
          return snapshot.exists ? snapshot.data()! : null;
        };
        const tx: SnapshotTransaction = {
          async getControls() {
            const data = await read(controls);
            return data ? { creationEnabled: data.creationEnabled, projectReadsEnabled: data.projectReadsEnabled } as SnapshotControls : null;
          },
          async getShare(id) {
            const data = await read(share(id));
            return data ? shareFrom(data as StoredShare) : null;
          },
          async getOperation(hash) {
            const data = await read(operation(hash));
            return data ? { requestDigest: data.requestDigest, shareId: data.shareId, createdAt: data.createdAt,
              expiresAt: data.expiresAt } as CreationOperationRecord : null;
          },
          async getQuota(key) {
            const data = await read(quota(key));
            return data ? { count: data.count, expiresAt: data.expiresAt } as SnapshotQuotaRecord : null;
          },
          putShare(id, value) {
            writes.push([share(id), { envelopeJson: value.envelope === null ? null : JSON.stringify(value.envelope),
              managementSecretHash: value.managementSecretHash, revokedAt: value.revokedAt } satisfies StoredShare]);
          },
          putOperation(hash, value) {
            writes.push([operation(hash), { ...value, expireAt: Timestamp.fromMillis(value.expiresAt) }]);
          },
          putQuota(key, value) {
            writes.push([quota(key), { ...value, expireAt: Timestamp.fromMillis(value.expiresAt) }]);
          },
        };
        const result = await action(tx);
        for (const [ref, data] of writes) t.set(ref, data);
        return result;
      });
    },
  };
}
