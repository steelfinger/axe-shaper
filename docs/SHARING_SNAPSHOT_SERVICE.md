# Local snapshot service core

Implemented 2026-10-12 in `src/sharing/snapshotService.ts`. This is a tested
service core behind a transactional storage interface, with no deployed endpoint
or production database adapter. It does not change the editor or viewer UI.

`createSnapshotService` takes an explicit release tag, upload admission policy,
quota limits, retry-record lifetime, storage adapter and optional clock/ID
allocator. Production must validate release/native evidence before constructing
it; accepting a configuration here does not prove that an iPad version is live.
Configuration is detached from caller mutation. Controls can pause creation and
project reads independently without raising the release's admission ceiling.
The core reads controls inside each transaction, without a cache. Missing
controls fail closed for creation, reads and status; creator management does not
depend on controls.

Creation validates the bounded raw request and verifies its project digest before
storage access. The transaction checks the hashed operation key, current controls,
ID availability and UTC fixed-window quotas before writing the snapshot,
management-secret hash, operation result and all counters together. Independent
operations with identical projects create independent shares. IDs use unbiased
random sampling of 20 alphanumeric characters. An allocation collision returns
`unavailable` without overwriting anything; retrying the same operation is safe
within the protection window.

Identical concurrent retries return the original ID/time and count once. Changed
content or management authority under a retained operation returns `conflict`.
Already accepted results can be recovered during a creation pause when controls
remain available. Explicit expiry checks refuse retries at or after the deadline,
even if database TTL cleanup has not run. Once an expired operation is deleted,
the server cannot recognize that key: the client must persist its original retry
deadline and stop automatic creation retries after it. Never automatically create
a new operation to resolve an expired or uncertain result. Client pending-operation
storage and this UX are still pending.

Public reads return only the full saved-project envelope, preserving its original
release manifest reference and schema independently of today's admission ceiling.
They distinguish missing (`not-found`), tombstoned (`revoked`) and paused or failed
storage (`unavailable`) results. Management status/revocation require the separate
creator capability. Wrong well-formed keys return the same `not-found` as absent
records. Public IDs grant no management rights. The HTTP adapter must carry keys
in authorization headers, never URLs or logs.

Revocation atomically removes the Release A project payload and keeps a bounded
control tombstone with the management-secret hash and original revocation time.
Repeated revocations return that same time; creation retries never restore it.
There are no preview or listing records in this milestone. Tombstone/operation
maintenance and provider backup retention remain to be defined by the selected
storage adapter. Removal remains available while creation or project reads are
paused. Quotas are not refunded on revocation.

## Storage adapter requirements

`SnapshotStore.transaction` must provide serializable, all-or-nothing transactions,
including reads of controls, operation, share and quota records. It may rerun the
callback on contention. Reads must return detached snapshots. The service performs
all reads before writes and generates its candidate ID/envelope outside the
callback. Transaction failure must roll back every write. The adapter must keep
records private, exclude project payloads from unnecessary indexes, enforce finite
retention for expired operation/quota records, and record diagnostics privately.
Unexpected storage failures map to a fixed `unavailable` error at the service
boundary. The in-memory copy-on-write adapter in tests is not production storage.

The trusted client quota key is a digest supplied by the server adapter, not a
field in the creation request. Before calling the core, an HTTP adapter must
verify App Check, enforce transport/body limits before buffering arbitrary input,
derive the client key from trusted proxy metadata using an environment-owned
privacy-preserving keyed hash, and implement request throttling/negative caching.
Runtime controls are private administrative state; deploying the service must
preserve their existing values. No control administration API is added here.

Cloud Functions, database edition/location and physical records, staging identities,
billing, live native evidence, HTTP authentication/headers, cache policy, hosted
fetch, pending-operation UI, maintenance and emulator integration remain pending.
This local milestone does not resolve Phase 0/0a provisioning prerequisites.
