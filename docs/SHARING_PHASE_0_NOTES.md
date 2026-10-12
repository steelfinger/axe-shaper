# Sharing and gallery: Phase 0 notes

**Updated:** 2026-10-10

Companion to [the sharing and gallery plan](DESIGN_SHARING_AND_GALLERY_PLAN.md).
This records observations and planning decisions; cloud provisioning and
release gates remain incomplete.

## Environment decision

Recommended architecture: a separate staging Firebase project owns both the
nonproduction Hosting lanes and the nonproduction backend. Production remains
in `axe-shaper-web` and is deployed only from a `v*` tag. The project identifier,
credentials, billing account and domain registration still need to be recorded.

Migrate `firebase-hosting-merge.yml` and `firebase-hosting-pull-request.yml`
before introducing sharing rewrites. Main deploys the stable staging site and
staging backend; PRs deploy only isolated-from-production Hosting previews and
do not replace that backend. Initially, hosted sharing is disabled in PRs and
the preview config omits service rewrites, including pins that could implicitly
deploy Functions from a Hosting-only command.

This resolves where staging's backend lives in the proposal. It does not claim
that the project exists or that the workflows have already changed.

## Verified repository baseline

Inspected on 2026-10-10:

- All three existing Hosting workflows target `axe-shaper-web`.
- Main uses its persistent `staging` channel; PRs use preview channels; `v*` tags
  use live Hosting. All deploy through `action-hosting-deploy`.
- `npm run deploy` still invokes `firebase deploy --only hosting` after composing
  the site; it is not a full backend deployment.
- Staging builds with `VITE_OUTPUT_JACKS=1`; the release workflow does not.
  Only designs containing jack data require schema 8 on that basis.
- `withEmbeddedPresets()` supplies the full payload used by `exportProjectToSVG()`;
  `requiredSchemaVersion()` stamps it from actual fields.
- `EditorRoute` already handles `?plan=` loading, session/history resets and
  URL normalization. The `e2e` suite pins those behaviors.
- `CLAUDE.md` requires a compatible live iPad release before schema-visible web
  authoring ships. Local source supporting schema 8 is not proof of App Store release.
- `verify` is intentionally secret-free. `check:all` supplies local cross-repo
  evidence but can skip absent repositories; a skipped run is not full evidence.

## Cloud observation — 2026-10-09

A read-only `firebase firestore:databases:list --project axe-shaper-web --json`
request returned HTTP 403 stating that the Firestore API had not been used or
was disabled. This does not prove that no database exists. Its edition/location
and availability remain unverified. No API was enabled or resource provisioned.

Recheck with the selected deployment/admin identity during Phase 0. Record
database edition and location before choosing SDK/index implementation, and
inspect the current billing plan before proposing an upgrade.

## Provisional production schema policy

Use **7** as the provisional `maxAcceptedProjectSchema`. Source: the repository's
`CLAUDE.md`, “Instrument type is project-level, and version 3 gates the door,”
records iPad **v1.2.0** as the first live App Store release reading v7 in October
2026. The “Output jacks are built but gated” section and release workflow keep
v8 authoring off until the compatible iPad release is live.

This is a documented baseline, not an independent App Store verification on
October 10. The disabled flag alone does not prove that no newer iPad release
exists. Before production deployment, reconfirm the live app's editable schema
support and record date/source in the manifest. Keep admission at 7 until
positive evidence permits a higher ceiling; isolated staging may test v8.

The client checks this ceiling before upload consent; the server enforces it on
the exact received payload without normalization. Client saving supplies embedded
presets; unknown upload fields and missing embedded presets are rejected.

## Standalone migration and release policy

Phase 0a moves Hosting lanes before any sharing backend is introduced: staging
project/billing, separate deployment identity, explicit aliases/configs, main/PR
workflow targets and a `CLAUDE.md` update. Main still downloads the pinned viewer
on each push, so an expired private-repo token remains visible immediately.
`VIEWER3D_RELEASE_TOKEN` is a GitHub build-job secret, not a Firebase runtime
secret. Existing repository-level access can be reused; copy it only if a new
GitHub environment changes its secret scope.

The migration is reversible while it remains Hosting-only. Never roll back to
production-backed previews once service rewrites are introduced. Detailed steps
and acceptance are in [operations](sharing-operations.md).
The stable staging live channel deliberately drops the old channel's 30-day
expiry/dead-man's switch; the Phase 0a `CLAUDE.md` update records that change.

Recorded hotfix convention: `v1.2.0-web.1`, incrementing the suffix for later
web/backend fixes against the coordinated release. The existing `v*` workflow
trigger matches it. `CLAUDE.md` and pure compatibility checks now reflect it;
complete manifests and deployment enforcement remain pending.
The confirmed iPad version is a separate field, not inferred from this suffix.
Hotfixes preserve admission/authoring gates and runtime pause overrides.
Because the suffix has prerelease precedence under SemVer, successful deployment
history and explicit predecessor manifests determine rollback order, not tag sort
or GitHub “latest.”

## Upload preflight and hashing decisions

The client runs the same strict upload validator as the server before consent.
File preservation and hosted acceptance have distinct expected results: the
web-written v8 jack fixture, its iPad return, and native v8 jack fixture retain
unknown mounting vocabulary and are expected hosted-upload rejections, even at
ceiling 8. Existing tolerant round-trip tests remain intact.

[The sharing-format draft](AXE_SHARING_FORMAT.md) defines RFC 8785 JCS plus
SHA-256 over the complete project. Fixed canonical texts/digests are committed
under `tests/fixtures/sharing/jcs-digest-vectors.json`; they test hashing independently
of design admission. Validator/API and independent client integration tests remain
Phase 1 work; the draft and vectors are not an implementation claim.

## Evidence still required

- Staging project ID, billing, deployment identity and App Check domains.
- Production billing status and scope/cost approval for any Blaze upgrade.
- Database edition/location, Functions region and actual serving-path estimate.
- Reconfirmation of the documented iPad v1.2.0/schema-7 baseline against the live
  App Store release, with date/source, before production; corresponding manifest.
- Full cross-repository check evidence for implementation, with no skipped repos.
- Staged deployment, API/share content checks, and tested rollback of HTTP and
  non-HTTP backend resources.
- Runtime incident switches that pause/restore without a tag and survive release
  deployment; hotfix manifest/trigger checks for both supported tag forms.

## Implementation started — 2026-10-10

The first local foundation adds `src/sharing/canonicalJson.ts`: bounded raw
JSON parsing that rejects duplicate decoded property names, RFC 8785
canonicalization, and SHA-256 project hashing with the committed vectors.
That first commit did not implement project admission: valid JSON is not
necessarily a valid hosted design. The follow-up below implements project
vocabulary/geometry validation; request/envelope fixtures remain pending.

`src/sharing/releasePolicy.ts` checks the compatibility portion of future
manifests, including coordinated/hotfix tag forms, reader/native ceilings and
preserved hotfix gates. Tests validate both tag forms and check that the workflow
text includes `v*`; they do not parse or verify the complete workflow trigger.
`CLAUDE.md` now records the hotfix convention and the tag lane runs unit tests.
Complete manifests, evidence verification and deployment enforcement are
still pending; test policies are not live-release evidence.

No provisioning, Hosting-lane migration, service rewrites or deployment has
been performed. Phase 0/0a cloud prerequisites remain unresolved. Existing
file/schema behavior and the output-jack authoring flag are unchanged.

Local validation: all 324 unit tests (including 18 new sharing tests), build,
schema, fixture, corpus and bass checks passed. Lint passed with the existing
`src/App.tsx` hook-dependency warning. This is web-only evidence; no viewer,
iPad, emulator or staging integration checks are claimed for this foundation.

Review follow-up on 2026-10-10: coordinated tags must match the confirmed iPad
marketing version; missing Web Crypto yields `crypto-unavailable`. Request byte
counting avoids a buffer allocation, numeric parsing uses a sticky token regex,
and serialization enforces its separate 6 MiB byte budget incrementally.
Hashing encodes the bounded canonical text once. Tests cover number expansion,
UTF-8/escaped-string boundaries, early stopping, missing crypto and final-newline
tag rejection. All 330 unit tests (24 sharing tests), build and lint passed;
lint retains the existing `src/App.tsx` warning. Cloud prerequisites are unchanged.

Second review follow-up: removed the incorrect JavaScript `$` comment and
redundant full-match guards. Both coordinated and hotfix policies now compare
the base coordinated tag with the confirmed iPad marketing version; a matching
but inconsistent base/hotfix pair is rejected. Removed duplicate Unicode checks
for canonical object names and documented/tested crypto-error precedence.
All 331 unit tests (25 sharing tests), build and lint passed with the existing
lint warning. Upload preflight must still enforce the raw request size separately.

## Shared project admission — 2026-10-10

Added `project-upload-v1` in `src/sharing/projectAdmission.ts`, shared by future
client/server integrations. It validates the exact project value without save
normalization, catalogue resolution or mutation: schema/release ceilings,
recursive fields/enums, complete embedded hardware, rout anchors, instrument
combinations, paired v7 geometry and resource limits. Unknown IDs with valid
embedded presets are preserved. The canonical project budget is provisionally
384 KiB within a planned 512 KiB creation request; actual cloud sizing and full
request enforcement still await the service. See the format document for limits.

The separate client `prepareSharedProject()` adapter creates the normal full
saved JSON, validates it, freezes a detached copy before hashing, and returns a
digest or a typed file-fallback reason. No upload/consent UI is enabled.

Admission tests include the unchanged native v7 baseline, a new positive
known-vocabulary schema-8 JSON fixture at ceilings 7/8, and explicit vocabulary
rejections for all three named future-vocabulary v8 files at ceiling 8. They
also cover all 20 bundled full save payloads, unknown recursive fields, missing
embedded data, schema-stamp bypasses, invalid joint geometry, budgets, and
independent edits during hashing. Original tolerant SVG fixtures are untouched.

This continues local contract work while Phase 0/0a cloud prerequisites remain
unresolved. Status/API envelopes, Functions, emulator configuration, staging
migration, independent viewer integration and the sharing UI remain pending.

Validation: all 350 web unit tests (44 sharing tests), build, lint, schema,
fixture, corpus and bass checks passed. Lint has only the existing App hook
warning. This is local web evidence, not independent viewer/iPad or staging
verification; no services were deployed.

## Admission review follow-up — 2026-10-11

`project-upload-v2` corrects admission of editor/file states: stale missing
mirror targets are preserved, legacy projects saved with jacks at schema 8 need
no v7 joint pair, and empty jack arrays are accepted without mutation. Schema 7
and any present joint fields still require a valid pair, and exact required-schema
stamping remains enforced. Both editor delete branches now unlink removed mirror
partners while preserving surviving geometry, including locked anchors.

Instrument/string-count and pickup compatibility use the repository's central
tables. Nested field maps are checked against their model types, closed headstock
and semantic-role vocabulary maps must cover their unions, and pickup vocabulary
comes from the compatibility table. Known legacy pickup/settings fields remain
explicit. Pre-release joint fields and open extension bags are still refused.

Canonicalization enforces the project byte budget directly and its branded text
is reused for preflight hashing. Snapshot detachment and freeze responsibilities
are documented separately. Only known preparation errors become file-fallback
reasons; unexpected failures propagate. Regression tests cover these behaviors.
The policy revision changed because admission semantics changed; no deployed
service or stored snapshots use the provisional earlier revision.

Validation: all 359 web unit tests (51 sharing tests plus two mirror-deletion
tests), 32 browser smoke tests, build, lint, schema, fixture, corpus and bass
checks passed. Lint retains the existing App hook warning. No cloud deployment
or independent viewer/iPad checks were performed.

## Version-1 wire contracts — 2026-10-11

`sharingContract.ts` adds the local creation request, public snapshot envelope,
public tagged client-support manifest, preview variants and stable HTTP error
mapping. Creation enforces 512 KiB of raw UTF-8 before parsing, reuses project
admission and verifies the claimed digest. Separate canonical 256-bit operation
and management keys become domain-separated private hashes. The retry digest
binds project identity and management authority; the transaction adapter still
must enforce expiry, quotas and revocation atomically.

Public envelopes use an explicit projection, expected route ID, required schema,
tagged same-origin manifest reference and verified project digest. Reader schema
ceilings come from installed capabilities. Generic previews are the builder's
Release-A output; readers also check the planned generated preview states and
same-share media path. Public manifests structurally validate the explicit
schema-to-minimum-iPad-version map, retaining null for unconfirmed support.
They do not prove live release evidence. Contract field sets have compile-time
coverage guards.

Fixed complete request/envelope/support fixtures and independent private hash
vectors complement negative mutation cases. Their public deterministic secrets
and compatibility entries are synthetic test data. No existing SVG fixture was
changed. This milestone changes only the web repository; independent viewer/iPad
readers and fixture syncing remain the next contract work.

Validation: all 401 web unit tests (93 sharing tests), build, lint, schema,
fixture, corpus and bass checks passed. Lint retains the existing App hook warning.
The final field-set guard change was additionally type-checked and the sharing
tests rerun. No browser flow changed, cloud service was deployed, or independent
viewer/iPad verification performed. Status/deployment manifests, consent/pending
operation storage, Functions/emulators and the actual sharing API remain pending.

## Wire/admission review follow-up — 2026-10-11

The pickup vocabulary is now an explicit exhaustive list for `project-upload-v2`,
and every closed model enum uses a compile-time coverage guard. Intentionally
open string types keep their explicit admitted subsets. A pinned policy fingerprint
covers recursive required/optional fields, enum vocabulary, numeric/text/list
bounds, JSON safety limits and compatibility tables. The catalogue-walk test
remains a drift alarm. Existing fingerprints must not be replaced when admission
changes; custom validator semantics still require reviewed regression tests.

Envelope reading dispatches through a supplied/default table of known revision
validators. Tests check historical dispatch, refusal of unknown/inherited keys,
retention of a reader for each fingerprinted revision, and the installed schema
ceiling even when a historical validator uses its own ceiling. Before deploying a
new revision, preserve the old implementation/entry and historical fixtures.
Only v2 is registered today; no v1 snapshots were deployed.

Public support manifests reject confirmed versions after a null gap and decreasing
minimum versions as schema increases. Numeric components are compared without
binary64 rounding. Manifest type/key ranges and reader/builder ceilings derive
from `PROJECT_SCHEMA_VERSION`. Envelope building retains a deliberate serialization,
admission and digest read-back self-check; its comment now explains that cost.

Validation: all 409 web unit tests (101 sharing tests), build, lint, schema,
fixture, corpus and bass checks passed; final capability/retention guards were
additionally type-checked and covered by rerun sharing tests. Lint retains the
existing App hook warning. No cloud deployment or independent client verification
was performed, and no editor/browser flow changed.

## Independent viewer contract checks — 2026-10-11

The web exports `project-upload-v2-definition.json` as data for independent
clients. Tests compare the current revision's artifact with compiled admission
rules and check every retained definition against its immutable fingerprint.
`scripts/write-sharing-policy.ts` generates a missing revision artifact and
refuses changed existing definitions; `--check` verifies without writing.

The viewer's `codex/sharing` branch vendors eight JSON artifacts, pinned by file
SHA-256 in its own contract manifest. Its own JSON tokenizer/JCS implementation,
policy-data interpreter and envelope/support/error readers import no web code.
Full saved snapshot integrity is checked before renderer normalization. Tests
cover canonical vectors, private creation hash vectors, native schema-7/known
schema-8 positives, preserved native future vocabulary, explicit reader ceilings,
preview paths/states, tampering, complexity limits, stale mirrors/empty jacks,
joint pairing/placement/compound tangency, native minimum versions and separate
missing/revoked/quota/unavailable errors. Historical revision entries are retained
explicitly. The existing tolerant SVG/fragment/handoff readers are unchanged.

Validation: viewer `npm run check` passed (460 tests, including 52 sharing tests;
lint, 58 pinned contract files, 22 preview capability checks, type check/build).
Web passed all 409 unit tests, build, lint, schema, fixture, corpus and bass checks,
plus policy export verification. Final artifact-retention assertions were rerun
with all 101 web sharing tests and type checking. Both repositories retain their
existing lint warning and build chunk-size warning. No iPad suite or cloud deploy
was performed. Hosted fetch/query integration, status/deployment manifests,
Functions/emulators, quotas/storage and sharing UI are still pending.

## Manifest compatibility and descriptor review — 2026-10-12

Both public support readers now validate a contiguous schema map starting at 3
through the manifest's own maximum. Safe-integer web/viewer ceilings must be
covered by that map, but may exceed the installed reader's capability. Immutable
older maps and newer release manifests remain readable. Actual project schema
gates still use installed capability. Regression tests cover both directions,
map gaps, oversized ceilings, native-version consistency and per-share refusal.

The viewer asserts descriptor assumptions at module load: known operation fields,
list budget names, numeric metadata, mirror behavior, anchor contour ceiling,
JSON safety limits and the custom semantics block. Unsupported assumptions fail
as `unsupported-policy`. Project canonical size now precedes schema refusal,
matching the server's error priority. `npm run sharing:export` exposes the policy
generator; unit tests remain its CI drift gate.

`joint-contract-vectors.json` adds seven independently consumed cases for compound
tangency just above/below/at its boundary, bass reference fret 20 versus 22, and
tapered mortises with/without deep width. The web validates the pair and generates
outlines; the viewer reads complete envelopes with the same geometry and its own
validation. Existing admission definitions/fingerprints are unchanged.

Validation: all 420 web unit tests (112 sharing tests), build, lint, policy export,
schema, fixture, corpus and bass checks passed. Viewer `npm run check` passed:
476 tests (68 sharing tests), 59 pinned contract files, preview capability checks,
type check and build. Final numeric descriptor guards were additionally verified
with sharing tests/type checking/lint. Both existing lint warnings remain. No
deployment, hosted UI or native sharing adapter was added.

## Local snapshot service core — 2026-10-12

`src/sharing/snapshotService.ts` implements the Release A service rules behind a
serializable transactional storage interface. Creation validates the raw request
before storage, atomically writes snapshot/control/operation/quota records, and
returns the original result for matching concurrent retries. Retained expired or
conflicting operations are refused. UTC fixed-window global/client counters are
configurable, and retries count once even when quotas are exhausted. Opaque IDs
use unbiased random sampling; different operations never deduplicate by digest.

Public reads project only the original envelope. Creator status/removal require
the separate management capability; wrong keys do not disclose existence/state.
Revocation immediately removes the project payload, retains a bounded tombstone,
and stays final through retry races. Independent creation/read controls fail
closed when missing; management remains available during pauses. Existing shares
retain their original schema and release manifest after admission rollback.
Unexpected adapter failures return the fixed `unavailable` error.

The [service adapter contract](SHARING_SNAPSHOT_SERVICE.md) records transaction,
privacy, retry-window, control and retention requirements. The in-memory adapter
is test-only. After operation TTL deletion, retry recognition is no longer possible;
the future client must persist its deadline and stop automatic retries. No HTTP
handlers, physical storage, App Check enforcement, cloud provisioning, emulator
integration, maintenance, hosted fetch or sharing UI are added. Phase 0/0a staging,
billing, database and live iPad prerequisites remain unresolved.

Validation: all 440 web unit tests (132 sharing tests, including 20 new service
tests), build/type checking, lint, policy export, schema, fixture, corpus and bass
checks passed. Tests cover concurrent retries/quotas, conflicts, rollback,
transaction callback reruns, expiry boundaries, authorization, revocation races,
pauses, configuration detachment, ID collisions, release rollback and random ID
sampling. Existing App hook and bundle-size warnings remain. Viewer/iOS code and
public wire fixtures are unchanged; their suites were not rerun for this local
service-only milestone.
