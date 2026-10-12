# Axe Shaper sharing format — draft

**Status:** Local hashing, admission and version-1 request/envelope contracts implemented; endpoints and independent clients pending

Companion to [the product plan](DESIGN_SHARING_AND_GALLERY_PLAN.md) and
[the saved-project contract](AXE_SVG_FORMAT.md). This defines hosted-sharing
admission and hashing without changing `.axe.svg` decoding or saving.

## Payload and admission

The client prepares the normal full saved project with `withEmbeddedPresets()`.
The server stores the received validated project value without migration,
catalogue lookup, default filling, coercion, rounding or schema repair. Embedded
neck/bridge presets are required; unknown IDs with valid known geometry are allowed.

Client preflight and server admission use the same pure strict validator and
policy revision: known recursive fields/enums, required embedded data, structure,
numeric/resource limits, and declared/required schema within the release ceiling.
The status endpoint identifies the active policy revision and admission ceiling.
If the client does not support that revision, offer an app update/file sharing
before consent. The server remains authoritative for every write.

`src/sharing/projectAdmission.ts` implements this project boundary under
`project-upload-v2`. `validateProjectUpload()` accepts an explicit policy revision
and release ceiling. On success it returns the exact received project object
and internally computed canonical text for digest reuse. On failure it reports
a stable error code and a known field path. Unknown property
names and supplied metadata are not echoed into errors. It checks schema 3–8,
the supported Guitar/6 and Bass/4 combinations, known recursive vocabulary,
paired/buildable joint geometry whenever either joint field is present, and exact
required-schema stamping. Schema 7 requires the joint pair; schema 8 can carry
legacy v3–v6 neck data plus jacks without that pair, matching the normal file save
contract. Partial pairs are always refused. Empty jack lists are accepted unchanged
but do not raise the required schema: schema 8 with only empty jacks still fails
the exact-stamp rule. Dangling mirror links are harmless preserved file state;
self-links remain refused. Explicit editor deletion now unlinks missing partners.

The revision's pickup vocabulary is an explicit frozen list; catalogue additions
cannot silently enlarge it. Every closed model enum has an exhaustive type guard.
Open string types (jack/knob IDs and edge/binding bags) retain explicit admitted
subsets. The catalogue-walk test remains a drift alarm requiring a new policy
revision when new types become shareable.

`policy-fingerprints.json` pins a SHA-256 digest of the policy definition to its
revision: recursive required/optional field sets, enum lists, number/text/list
bounds, JSON safety limits and instrument/pickup compatibility tables. Changing
that data without adding a new revision fails the test. Existing fingerprints
must remain unchanged; add a revision and retain its historical validator before
deploying an admission change. This data guard does not fingerprint arbitrary
validation code: changes to custom semantics still require review and regression
tests.

Embedded neck/bridge presets and pickup rout anchors are required. IDs do not
require catalogue membership. Current known knob/jack vocabulary is intentionally
strict even where local file types permit arbitrary strings. The validator also
recognizes saved pickup `name`, `cornerRadiusMm` and `defaultAngleDegrees`, and
the historical `settings.snapToGrid` spelling. Pre-release joint `mouthAnchorIds`
and unrestricted edge/binding extension fields are not accepted.

The initial policy limits canonical project data to **384 KiB**, leaving room
for the **512 KiB complete creation request**. It caps total anchors at
2,048, each contour at 512, all hardware/pickguard/route placements together at
128, and coordinates/handles at ±5,000 mm. Physical dimensions are positive and
bounded (general dimensions up to 2,000 mm, neck scale 200–1,500 mm, body
thickness 5–150 mm); finite angles are preserved rather than normalized.
Text is bounded: IDs 160 UTF-16 units, display names/author 200, provenance 2,048.
Colours use six-digit hex. These provisional upload bounds are exercised against
all 20 bundled save payloads and the committed native/web fixtures; they do not
claim cloud storage sizing or staging performance validation.

`src/sharing/prepareSharedProject.ts` is the client-only adapter. It runs
`withEmbeddedPresets()` and normal saved-JSON serialization, checks the strict
policy, freezes a detached copy, and computes its digest. Optional in-memory
`undefined` fields are omitted just as they are in the SVG save payload. Future
JSON fields remain intact and cause refusal rather than being erased to pass
admission. The adapter leaves the working project unchanged. Consent UI,
status loading and actual upload remain pending. The wire boundary below validates
the full request; the consent/pending-operation integration has not been added.

Admission counts canonical bytes with the 384 KiB budget during serialization,
without re-encoding the complete result merely to measure it. Client hashing
reuses that internally generated text through `canonicalJsonDigest()`; the text
has a branded type to distinguish it from untrusted request strings. The service
must always compute it from received project data, never accept a supplied cache.
Saved-JSON serialization detaches the client snapshot synchronously. Freezing
protects the returned snapshot from later modification; it is not what detaches
it from the working project. Known malformed-joint/JSON errors become file-fallback
reasons, while unexpected save failures propagate for diagnosis.

Tolerant file saving may preserve future vocabulary that hosted admission rejects.
Client preflight must detect this and offer the file fallback before upload consent;
it must not erase vocabulary to obtain an admissible project.

## Project digest

The algorithm is **RFC 8785 JSON Canonicalization Scheme (JCS)**, UTF-8 encoding,
then SHA-256. The wire digest is `sha256:` followed by 64 lowercase hexadecimal
digits. Declare `digestCanonicalization: "rfc8785"` in the versioned sharing
contract. Hash the entire project value, including its metadata, not the share
envelope, creator key, operation key, server ID/time, preview or licence envelope.
All clients and the server recompute the same scope; readers can verify integrity.

JCS recursively sorts object names by UTF-16 code units, preserves array order,
uses ECMAScript binary64 number serialization and string escaping, and emits no
insignificant whitespace. It does not normalize Unicode. Signed zero hashes as
zero. Reject duplicate object names, nonfinite numbers and invalid Unicode,
including lone surrogates. Inspect raw request JSON for duplicate names before
a normal parser discards them. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)

Canonicalization produces hash bytes only; it never overwrites the stored project.
JCS-equivalent number spellings/key orders yield the same digest. This is content
identity under the defined JSON/binary64 model, not original source-file bytes.
Retain supported geometry precision; integers that must be exact stay within the
safe binary64 integer range. Application bounds may be stricter than JCS bounds.

`src/sharing/canonicalJson.ts` implements the browser/server canonicalizer,
bounded raw JSON parsing and Web Crypto hashing. Its tests consume the fixed
vectors, including duplicate decoded names and invalid Unicode. Sorting keys
and calling ordinary Swift `JSONEncoder` is insufficient.
Raw JSON requests are limited to 1 MiB of UTF-8, depth 64 and 100,000 value
nodes. Canonical output has a separate 6 MiB ceiling to allow number expansion
such as `1e20` becoming `100000000000000000000`. Whitespace and equivalent
number spellings can still affect the raw transport limit; that limit protects
request handling, while the canonical ceiling protects serialization memory.
Canonicalization counts output bytes incrementally, including escaped strings,
and stops before building an oversized result. These are transport/serialization
bounds; the stricter project/request admission limits apply separately. Deployment
storage bounds remain pending.

Hashing requires Web Crypto, available on HTTPS and trusted localhost contexts.
Plain HTTP over a LAN may lack it. `projectDigest()` returns the typed
`crypto-unavailable` error in that case so the sharing UI can offer file sharing
or explain that a secure connection is needed.
The capability check runs first: when crypto is unavailable, this error takes
precedence over malformed or oversized project input. Hash success does not
establish upload eligibility; client preflight must separately check the exact
serialized creation request against the 512 KiB limit before sending it.
Do not introduce application-specific number rounding. The future iPad adapter
uses JCS-compatible serialization, independent of its normal file encoder.

## Version-1 creation and public envelope

`src/sharing/sharingContract.ts` defines the local wire boundary. These contracts
do not create a deployed API or App Check enforcement. The
[local snapshot service](SHARING_SNAPSHOT_SERVICE.md) now implements creation,
quota, retry, public-read and management rules behind a transactional storage
interface; the production adapter remains pending.

Creation JSON has exactly `shareFormatVersion: 1`, `uploadPolicyRevision`,
`digestCanonicalization: "rfc8785"`, `project`, `projectDigest`, `operationKey`
and `managementSecret`. `serializeShareCreationRequest()` checks the exact
serialized UTF-8 body against **512 KiB** for client transport preflight.
`admitShareCreation()` checks that budget before parsing, rejects decoded duplicate
names/invalid Unicode, validates the full unchanged project against the server's
policy, recomputes its digest, and refuses a claimed digest mismatch. Client
serialization alone does not establish admission. All request fields are required;
unknown fields are refused. The format version is independent of project schema.

Both keys are distinct, canonical unpadded base64url strings encoding exactly
32 random bytes. `generateShareCreationSecrets()` uses Web Crypto independently
for each. The application must persist the confirmed pending operation before
sending, retain it across uncertain results, and put later management credentials
in an authorization header. Local recovery storage and HTTP management handlers remain pending. The parser verifies encoding/length, not the entropy of client-supplied keys.

The admitted transaction input contains the frozen project and only private key
hashes, never plaintext key fields. Define each private hash as JCS/UTF-8/SHA-256:

| Hash | Canonical input |
| --- | --- |
| `operationKeyHash` | `{ domain: "axe-sharing-operation-v1", secret: operationKey }` |
| `managementSecretHash` | `{ domain: "axe-sharing-management-v1", secret: managementSecret }` |
| `requestDigest` | `{ domain: "axe-sharing-creation-v1", shareFormatVersion: 1, uploadPolicyRevision, digestCanonicalization: "rfc8785", projectDigest, managementSecretHash }` |

Look up the operation using `operationKeyHash`. Equal request digests mean the
same confirmed request; a different digest under that key means **409 conflict**.
This binds both project content and management authority, while JCS-equivalent
property order/number spellings do not create conflicts. Different operation keys
are separate operations. `compareShareCreationRetry()` performs only that comparison:
the local snapshot service checks quotas, expiry and revocation atomically,
returns the existing ID on a matching live retry, and never reactivates a revoked
share. Its storage adapter must uphold the documented transaction guarantees.

The v1 retry-protection window is fixed at **24 hours** by
`SHARE_OPERATION_TTL_MS`. Before the first send, persist the operation and
`shareCreationRetryDeadline(startedAt)` (24 hours minus a one-minute safety margin).
Never extend that deadline on retries. Stop automatic retries at the deadline or
when a clock rollback makes timing uncertain; no response or status fetch is
required to learn this window. Retained expired keys return **409 operation-expired**,
separately from changed-content **409 conflict**. After TTL cleanup removes the
operation, the server cannot recognize an old key, so client deadline enforcement
is essential. Expiry does not authorize automatically creating a replacement.

The public envelope has exactly `shareFormatVersion`, `id`, `createdAt`,
`uploadPolicyRevision`, `digestCanonicalization`, `projectDigest`, `project`,
`requirements` and `preview`. IDs are 20 ASCII alphanumeric characters. Times are
canonical UTC ISO timestamps with milliseconds. `requirements.projectSchema`
equals the project's actual schema; `requirements.supportManifest` is the
same-origin path `/sharing/releases/<release-tag>.json` (including hotfix tags).
Public routing/absolute share URLs still need trusted deployment-origin config.
`buildSharedProjectEnvelope()` explicitly projects public fields and emits a
generic preview, keeping transaction/control hashes out of the response.

`readSharedProjectEnvelope()` checks the expected route ID, installed reader's
schema ceiling, full project admission and recomputed digest before returning a
frozen snapshot. It takes a table of known revision validators, defaulting to
`PROJECT_REVISION_READERS` with `project-upload-v2`. The stored revision selects
its validator independently of the current creation revision; unknown revisions
are refused. When a new revision is deployed, retain the old validator implementation
and registry entry so the fixed historical envelope fixtures continue to read.
The selected revision checks stored project vocabulary/resource limits;
receiving a support-manifest reference does not raise the installed reader's ceiling.

Preview variants are `{ kind: "generic" }`, generated `pending`/`failed` with no
URL, or generated `ready` with exactly `/media/shares/<same-id>/v1.jpg`.
Readers already accept these planned Release-B variants; Release-A builders do
not request jobs or publish media. Publication/licence fields require a later
explicit contract extension and remain refused by this version's reader.

`readSharingClientSupportManifest()` validates the expected tag, format version,
web/viewer reader ceilings, and an explicit contiguous map from schema 3 through
the manifest's own maximum to minimum editable iPad marketing versions. That range
belongs to the immutable release manifest, independently of installed client schema
capability. Ceilings are safe integers covered by the map, and may exceed the local
reader's maximum. Older maps remain readable after a client update. Per-share
schema gating still uses the installed client's ceiling. Non-null
versions must not decrease as schema increases; once a minimum is `null`, every
higher schema must also be `null`. Comparisons preserve numeric component precision.
`null` means native edit support is unconfirmed. This
is public compatibility data, separate from the full private deployment manifest;
it does not validate release evidence or prove that a manifest has been published.
The fixture is synthetic test data, not a live release declaration.

Errors contain a fixed code and no supplied field names, keys or metadata:

| HTTP | Codes |
| --- | --- |
| 400 | `malformed-request`, `invalid-id` |
| 422 | `unsupported-share-format`, `unsupported-policy`, `unsupported-schema`, `invalid-project`, `digest-mismatch` |
| 413 | `too-large` |
| 409 | `conflict`, `operation-expired` |
| 404 / 410 | `not-found` / `revoked` |
| 429 / 503 | `quota-exceeded` / `unavailable` |

The local boundary maps absent digest crypto to `unavailable`; unexpected internal
errors propagate. Future HTTP adapters must emit these codes as `{ error: { code } }`,
distinguish missing/revoked from quota/service errors, and enforce infrastructure
body limits before decoding the raw request into a string.

## Fixture expectations

`tests/fixtures/sharing/jcs-digest-vectors.json` fixes input JSON, canonical UTF-8
text and SHA-256 digests. Cases cover `0.1`, `1e21`, `-0`, exponent thresholds,
rounding, numeric-looking object keys, UTF-16 sorting, unnormalized Unicode and
nested array ordering. Invalid inputs name the expected rejection.

These are canonicalization vectors, not valid design uploads: large test numbers
may exceed geometry limits. Phase 1 separately adds full envelope/project admission
fixtures, marking each policy ceiling and expected result explicitly:

| Source/case | Expected hosted admission |
| --- | --- |
| `tests/fixtures/ios-written-v5/s_style.axe.svg` | Known schema-7 positive baseline; validate complete fields against final limits |
| `tests/fixtures/sharing/schema8-known-jacks.json` | Known styles/fields only; accept at ceiling 8, refuse at ceiling 7 |
| `tests/fixtures/web-written-v8/output_jacks.axe.svg` | Reject unknown `side_mounted` and `futureField` at ceiling 8 |
| `tests/fixtures/ios-written-v5/web_roundtrip_output_jacks.axe.svg` | Same rejection; retain the independent tolerant round-trip test |
| `tests/fixtures/ios-written-v5/output_jacks.axe.svg` | Reject unknown `side_mounted` at ceiling 8 |

For negative vocabulary cases, test at ceiling 8 to ensure a schema-ceiling error
does not mask the strict validator result. Never change those original fixtures
or weaken the existing preservation assertions. Add independent unknown-key and
unknown-enum cases so each rule is tested on its own.

Web unit checks now consume the digest vectors and project admission cases.
Request/envelope checks also consume `creation-v1.json`, its independently computed
private hash vectors, `envelope-v1.json` and `support-manifest-v1.json`. Negative
cases mutate individual fields and cover tampering, secret encoding, unknown fields,
whole-body UTF-8 limits, schema gates and all preview variants. Functions integration
remains pending. The viewer now vendors the nine sharing JSON artifacts, pins
their file hashes, and independently checks raw parsing/JCS, envelope integrity,
the frozen policy definition, schema gates, previews, support manifests and service
errors in its own `npm run check`. Its data interpreter uses the fingerprinted
`project-upload-v2-definition.json` without importing web implementation code.
Module-load assertions check descriptor operations, budgets, mirror semantics,
JSON safety limits and custom semantics against the interpreter's assumptions.
Both clients consume `joint-contract-vectors.json`: near/exact compound tangency,
bass reference-fret acceptance/refusal, and valid/malformed tapered mortises. The
web exercises `generateNeckJointOutline()` and the viewer exercises its own reader.
The web checks that this exported definition equals the compiled rules and retains
every revision's definition/fingerprint. Hosted viewer fetch/query/UI integration
is still pending. Require iPad digest/adapter checks
when that client is added. Record fixture revision/digests across repositories.

## Phase 1 completion

The local versioned envelope, public support-manifest structure, preview variants,
error codes and idempotency request comparison now have fixtures/tests. Complete
the deployment manifest/status contract, independent iPad checks and isolated
Functions/emulator foundation before marking Phase 1 complete. Preserve the
project-digest algorithm defined here; change it only through an explicit versioned
contract migration that keeps older snapshots/verifiers usable.
