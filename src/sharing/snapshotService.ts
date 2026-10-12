import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import { PROJECT_REVISION_READERS, UPLOAD_POLICY_REVISION } from './projectAdmission';
import type { ProjectAdmissionPolicy } from './projectAdmission';
import {
  admitShareCreation, buildSharedProjectEnvelope, hashShareManagementSecret, isShareId,
  SharingContractError, supportManifestPath, SHARE_OPERATION_TTL_MS,
} from './sharingContract';
import type { ProjectDigest, SharedProjectEnvelope } from './sharingContract';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const HASH = /^sha256:[0-9a-f]{64}$/;

/** Private records. A database adapter must never expose these as public documents. */
export interface SnapshotRecord {
  envelope: SharedProjectEnvelope | null;
  managementSecretHash: ProjectDigest;
  revokedAt: string | null;
}
export interface CreationOperationRecord {
  requestDigest: ProjectDigest;
  shareId: string;
  createdAt: string;
  expiresAt: number;
}
export interface SnapshotQuotaRecord { count: number; expiresAt: number }
export interface SnapshotControls { creationEnabled: boolean; projectReadsEnabled: boolean }

/**
 * Serializable, all-or-nothing transaction; adapters may rerun the callback.
 * Reads return detached snapshots and precede writes. Failures roll back ALL
 * writes, including quota counters.
 * TTL is cleanup only: the service checks expiry explicitly. Keep records private.
 */
export interface SnapshotTransaction {
  getControls(): Promise<SnapshotControls | null>;
  getShare(id: string): Promise<SnapshotRecord | null>;
  getOperation(hash: ProjectDigest): Promise<CreationOperationRecord | null>;
  getQuota(key: string): Promise<SnapshotQuotaRecord | null>;
  putShare(id: string, value: SnapshotRecord): void;
  putOperation(hash: ProjectDigest, value: CreationOperationRecord): void;
  putQuota(key: string, value: SnapshotQuotaRecord): void;
}
export interface SnapshotStore {
  transaction<T>(action: (transaction: SnapshotTransaction) => Promise<T>): Promise<T>;
}
export interface SnapshotServiceConfig {
  releaseTag: string;
  admission: ProjectAdmissionPolicy;
  quotas: { globalPerDay: number; clientPerHour: number; clientPerDay: number };
}
export interface ShareCreationResult { id: string; createdAt: string; replayed: boolean }
export interface ShareManagementStatus { id: string; state: 'active' | 'revoked'; revokedAt: string | null }
export interface SnapshotServiceDependencies {
  store: SnapshotStore;
  now?: () => number;
  allocateId?: () => string;
}

function fail(code: ConstructorParameters<typeof SharingContractError>[0]): never {
  throw new SharingContractError(code);
}
function requireId(id: string): void { if (!isShareId(id)) fail('invalid-id'); }
function sameHash(left: string, right: string): boolean {
  // Fixed-size hashes; avoid an early return based on the first differing byte.
  let difference = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ (right.charCodeAt(i) || 0);
  return difference === 0;
}

/** Rejection sampling avoids modulo bias in the opaque 20-character public ID. */
export function allocateShareId(): string {
  if (!globalThis.crypto?.getRandomValues) fail('unavailable');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  // A broken random provider must not leave a request spinning indefinitely.
  for (let batch = 0; batch < 8 && id.length < 20; batch++) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte < 248) id += alphabet[byte % 62];
      if (id.length === 20) break;
    }
  }
  if (id.length !== 20) fail('unavailable');
  return id;
}

/**
 * Local service core, with no HTTP/Firebase dependency. The future HTTP adapter
 * must verify App Check and derive a trusted, privacy-preserving client key
 * before calling create; a request body must never choose its own quota identity.
 */
export function createSnapshotService(config: SnapshotServiceConfig, dependencies: SnapshotServiceDependencies) {
  supportManifestPath(config.releaseTag);
  if (config.admission.revision !== UPLOAD_POLICY_REVISION ||
    !Object.hasOwn(PROJECT_REVISION_READERS, config.admission.revision) ||
    !Number.isSafeInteger(config.admission.maxAcceptedProjectSchema) ||
    config.admission.maxAcceptedProjectSchema < 3 || config.admission.maxAcceptedProjectSchema > PROJECT_SCHEMA_VERSION ||
    Object.values(config.quotas).some(limit => !Number.isSafeInteger(limit) || limit < 1)) {
    fail('unavailable');
  }
  // Detach operational configuration from caller mutation. Native release
  // evidence and deployment-policy validation belong to the deployment adapter.
  const policy = Object.freeze({ ...config.admission });
  const quotas = Object.freeze({ ...config.quotas });
  const releaseTag = config.releaseTag;
  const ttl = SHARE_OPERATION_TTL_MS;
  const { store } = dependencies;
  const transact = async <T>(action: (tx: SnapshotTransaction) => Promise<T>): Promise<T> => {
    try { return await store.transaction(action); } catch (error) {
      if (error instanceof SharingContractError) throw error;
      // The adapter owns private diagnostics; never send database errors to a client.
      return fail('unavailable');
    }
  };
  const now = dependencies.now ?? Date.now;
  const allocateId = dependencies.allocateId ?? allocateShareId;
  const time = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0 || value > 253402300799999 - ttl) fail('unavailable');
    return value;
  };
  const controlsFor = async (tx: SnapshotTransaction) => {
    const controls = await tx.getControls();
    if (!controls || typeof controls.creationEnabled !== 'boolean' || typeof controls.projectReadsEnabled !== 'boolean') fail('unavailable');
    return controls;
  };
  const authorized = async (tx: SnapshotTransaction, id: string, hash: ProjectDigest) => {
    const share = await tx.getShare(id);
    // No existence/state disclosure without the management capability.
    if (!share || !sameHash(share.managementSecretHash, hash)) fail('not-found');
    return share;
  };

  return {
    async create(source: string, trustedClientKey: ProjectDigest): Promise<ShareCreationResult> {
      if (!HASH.test(trustedClientKey)) fail('malformed-request');
      // Bound and validate untrusted content before any storage/quota work. The
      // current ceiling applies only to NEW creations (below): a retry of an
      // operation accepted before an admission rollback must stay recoverable.
      const creation = await admitShareCreation(source, { ...policy, maxAcceptedProjectSchema: PROJECT_SCHEMA_VERSION });
      let id: string;
      try { id = allocateId(); } catch { return fail('unavailable'); }
      if (!isShareId(id)) fail('unavailable');
      const createdAt = new Date(time()).toISOString();
      const envelope = await buildSharedProjectEnvelope(creation, { id, createdAt, releaseTag });
      return transact(async tx => {
        const currentTime = time();
        const controls = await controlsFor(tx);
        const operation = await tx.getOperation(creation.operationKeyHash);
        if (operation) {
          if (operation.expiresAt <= currentTime) fail('operation-expired');
          if (!sameHash(operation.requestDigest, creation.requestDigest)) fail('conflict');
          const previous = await tx.getShare(operation.shareId);
          if (!previous) fail('not-found');
          if (previous.revokedAt !== null) fail('revoked');
          if (!previous.envelope) fail('unavailable');
          // Already accepted results remain recoverable during a creation pause.
          return { id: operation.shareId, createdAt: operation.createdAt, replayed: true };
        }
        if (creation.project.schemaVersion > policy.maxAcceptedProjectSchema) fail('unsupported-schema');
        if (!controls.creationEnabled) fail('unavailable');
        const collision = await tx.getShare(id);
        if (collision) fail('unavailable');
        const windows = [
          { key: 'global', duration: DAY, limit: quotas.globalPerDay },
          { key: `client-hour:${trustedClientKey}`, duration: HOUR, limit: quotas.clientPerHour },
          { key: `client-day:${trustedClientKey}`, duration: DAY, limit: quotas.clientPerDay },
        ];
        const counters: { key: string; value: SnapshotQuotaRecord }[] = [];
        for (const window of windows) {
          const start = Math.floor(currentTime / window.duration) * window.duration;
          const key = `${window.key}:${start}`;
          const previous = await tx.getQuota(key);
          const count = previous && previous.expiresAt > currentTime ? previous.count : 0;
          if (!Number.isSafeInteger(count) || count < 0) fail('unavailable');
          if (count >= window.limit) fail('quota-exceeded');
          counters.push({ key, value: { count: count + 1, expiresAt: start + window.duration } });
        }
        // Use this attempt's clock for metadata, quotas and expiry together.
        // Project bytes/digest and all other envelope fields are already validated.
        const committedAt = new Date(currentTime).toISOString();
        const committedEnvelope = Object.freeze({ ...envelope, createdAt: committedAt });
        tx.putShare(id, { envelope: committedEnvelope, managementSecretHash: creation.managementSecretHash, revokedAt: null });
        tx.putOperation(creation.operationKeyHash, { requestDigest: creation.requestDigest, shareId: id,
          createdAt: committedAt, expiresAt: currentTime + ttl });
        for (const counter of counters) tx.putQuota(counter.key, counter.value);
        return { id, createdAt: committedAt, replayed: false };
      });
    },
    async read(id: string): Promise<SharedProjectEnvelope> {
      requireId(id);
      return transact(async tx => {
        if (!(await controlsFor(tx)).projectReadsEnabled) fail('unavailable');
        const share = await tx.getShare(id);
        if (!share) fail('not-found');
        if (share.revokedAt !== null) fail('revoked');
        if (!share.envelope) fail('unavailable');
        // Only the public projection crosses the service boundary.
        return share.envelope;
      });
    },
    async managementStatus(id: string, managementSecret: string): Promise<ShareManagementStatus> {
      requireId(id);
      const hash = await hashShareManagementSecret(managementSecret);
      return transact(async tx => {
        const share = await authorized(tx, id, hash);
        return { id, state: share.revokedAt === null ? 'active' : 'revoked', revokedAt: share.revokedAt };
      });
    },
    async revoke(id: string, managementSecret: string): Promise<ShareManagementStatus> {
      requireId(id);
      const hash = await hashShareManagementSecret(managementSecret);
      return transact(async tx => {
        const share = await authorized(tx, id, hash);
        const revokedAt = share.revokedAt ?? new Date(time()).toISOString();
        // Release A has no media/listing records. Remove the project in the same
        // transaction, retaining only the capability hash and bounded tombstone.
        if (share.revokedAt === null) tx.putShare(id, { envelope: null, managementSecretHash: hash, revokedAt });
        return { id, state: 'revoked', revokedAt };
      });
    },
    async status() {
      return transact(async tx => {
        const controls = await controlsFor(tx);
        return { releaseTag, uploadPolicyRevision: policy.revision, maxAcceptedProjectSchema: policy.maxAcceptedProjectSchema,
          creationAvailable: controls.creationEnabled, projectReadAvailable: controls.projectReadsEnabled };
      });
    },
  };
}
