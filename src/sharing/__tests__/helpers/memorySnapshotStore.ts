import type { ProjectDigest } from '../../sharingContract';
import type { CreationOperationRecord, SnapshotControls, SnapshotQuotaRecord, SnapshotRecord, SnapshotStore, SnapshotTransaction } from '../../snapshotService';

/** Test adapter only. Serialized copy-on-write transactions model commit/rollback. */
export class MemoryStore implements SnapshotStore {
  shares = new Map<string, SnapshotRecord>();
  operations = new Map<ProjectDigest, CreationOperationRecord>();
  quotas = new Map<string, SnapshotQuotaRecord>();
  controls: SnapshotControls | null = { creationEnabled: true, projectReadsEnabled: true };
  calls = 0;
  failCommit = false;
  rerun = false;
  betweenAttempts?: () => void;
  private tail: Promise<unknown> = Promise.resolve();
  transaction<T>(action: (tx: SnapshotTransaction) => Promise<T>): Promise<T> {
    this.calls++;
    const run = this.tail.then(async () => {
      const attempt = async () => {
        const shares = structuredClone(this.shares);
        const operations = structuredClone(this.operations);
        const quotas = structuredClone(this.quotas);
        let wrote = false;
        const read = <V>(value: V): V => { if (wrote) throw new Error('read after write'); return structuredClone(value); };
        const result = await action({
          getControls: async () => read(this.controls),
          getShare: async id => read(shares.get(id) ?? null),
          getOperation: async hash => read(operations.get(hash) ?? null),
          getQuota: async key => read(quotas.get(key) ?? null),
          putShare: (id, value) => { wrote = true; shares.set(id, structuredClone(value)); },
          putOperation: (hash, value) => { wrote = true; operations.set(hash, structuredClone(value)); },
          putQuota: (key, value) => { wrote = true; quotas.set(key, structuredClone(value)); },
        });
        return { shares, operations, quotas, result };
      };
      if (this.rerun) { this.rerun = false; await attempt(); this.betweenAttempts?.(); }
      const state = await attempt();
      if (this.failCommit) { this.failCommit = false; throw new Error('injected commit failure'); }
      this.shares = state.shares; this.operations = state.operations; this.quotas = state.quotas;
      return state.result;
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
}
