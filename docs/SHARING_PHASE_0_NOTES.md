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
