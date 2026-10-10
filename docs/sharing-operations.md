# Sharing and gallery operations

**Prepared:** 2026-10-10

**Status:** Proposed operating procedure; no provisioning or deployment performed

Companion to [the product and contract plan](DESIGN_SHARING_AND_GALLERY_PLAN.md).
[Phase 0 notes](SHARING_PHASE_0_NOTES.md) track local evidence and remaining setup.

## Runtime incident controls

Release manifests contain stable resource limits, the admission ceiling, build-time
schema-authoring flags, and initial defaults for incident switches. Their current
values are runtime operational state, not tagged configuration.

Use a private service-control record changed by an IAM-protected administrative
tool. Support independent creation, publication, generation, gallery-read,
media-delivery and project-read switches. Validate and audit admin changes, use
revision preconditions, and return confirmation of the effective revision.
Pause/restore requires no tag, Hosting build, or release deployment. Prefer this
one control mechanism to adding a separate Remote Config dependency.

Handlers cache the effective record for at most 60 seconds; document this
origin-enforcement delay and test it. Missing/unreadable controls fail closed for
new creation, publication and rendering. Reads use only a last-known control
state within that bounded window, then return an unavailable response. Cached
CDN responses have their separate documented expiry/invalidation window.

Runtime switches can stop operations; they cannot raise the manifest's schema
admission ceiling or enable an unreleased authoring feature. The public status
endpoint reports the effective public availability and the release ceiling,
without administrative identity, history or secrets. The client treats status
as advisory and every server operation checks the effective control policy.

Initialize switch defaults only for a new environment. Deployments, hotfixes and
rollbacks preserve existing runtime values; a pause must survive a release.
Restore switches explicitly after smoke checks and incident inspection. Keep
management/removal available during creation pauses where the platform permits.
Firestore transactions support guarded updates; final storage APIs depend on
the detected edition. [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)

## Standalone Phase 0a: migrate Hosting before the backend

1. Confirm/provision the staging project and its billing, then its restricted
   Hosting deployment identity and GitHub secret/federation binding.
2. Add explicit project aliases/configs and move the main/PR Hosting workflows
   to staging. Grant their deploy jobs access to `VIEWER3D_RELEASE_TOKEN` (copy
   it into any separately scoped GitHub environment if that scope is introduced).
   Keep viewer download out of `verify`.
3. Keep this first change Hosting-only: no Functions rewrites, database, preview
   bucket or schema-production changes. Main still composes/downloads the viewer
   and deploys on every push, preserving the expired-token canary.
4. Verify main and PR targets, stable staging URL, production unchanged, composed
   viewer title, and secret failure behavior. Update `CLAUDE.md` and lane links.
5. Retire old channels only after those checks. Roll back workflow targets/configs
   if necessary while the change is still Hosting-only. Once production service
   rewrites exist, never restore production-backed previews as a shortcut.

Main staging deliberately moves from the expiring `staging` preview channel
(`expires: 30d`) to the separate project's stable live Hosting channel. This drops
the old dead-man's URL-expiry safeguard; it is a deliberate policy change, not
implicit parity. Keep commit/deploy time visible in staging and update `CLAUDE.md`
to state that the stable staging URL no longer expires. PR channels remain ephemeral.

This independently reviewable migration finishes before Phase 1. It provides
isolation without waiting for the sharing service to be implemented.

## Cost, retention, and incident response

No “free at hobby scale” promise and no guaranteed all-services dollar ceiling.
Traffic and image delivery can cost money even when accepted creation is capped.
Set a budget using actual database edition, Functions/bucket locations, and the
Hosting/media serving path before production.

Functions require the Blaze billing plan. Phase 0 checks the existing plan and
records the billing-account choice for both environments. If `axe-shaper-web`
needs an upgrade, its billing scope includes the existing live site as well as
the new service; do not treat enabling Functions as a cost change confined to
sharing. The separately billed staging project also needs an approved budget.
[Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

Proposed conservative small-launch configuration:

| Control | Planning value |
| --- | --- |
| New snapshots | 100/day globally; 10/hour and 25/day per trusted client-IP key |
| Gallery submissions | 20/day globally; 5/day per client key; bound pending queue size |
| Reports | Separate per-client and global limits plus a bounded queue |
| Creation/submission Functions | Minimum instances 0; maximum 2; bounded concurrency/timeouts |
| Preview worker — Release B | Minimum 0; maximum 1; concurrency 1; measured memory and bounded retries |
| Public reads/media | Separate low scaling limits, CDN caching, negative caches and throttling |
| Monthly alerts | Proposed $5, $10, and $25 thresholds |
| Eligible Functions spend cap | Proposed $10/month if available and suitable for this project's other Functions |
| Operation records | 24-hour retry protection |
| Limiter records | Short TTL covering the quota window; no long-term client history |

These are configurable starting points to test, not finalized entitlements.
App Check/body validation precedes quota-store work where feasible; accepted
creation and quotas commit atomically. Management removal remains available
when new creation or gallery submissions are paused, subject to the platform
itself being available.

Budget alerts notify rather than stop costs. Firebase spend caps have eligible
service scope and delayed enforcement; they can affect other Functions in the
same project and do not cover every remaining storage/delivery cost. Verify their
current behavior at provisioning. [Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets),
[Firebase spend caps](https://firebase.google.com/docs/projects/billing/spend-caps)

Use the runtime switches above for incident pauses. Do not stop the existing
static editor when pausing sharing. A predeployed static fallback explains
outages if the underlying function service is unavailable; it is not the
mechanism for pausing the service.

The runbook maps incidents to actions: pause growth endpoints for upload abuse;
pause gallery submissions for moderation overload; pause generation/media for
image abuse; pause public reads as a last resort. Review remaining stored-data
costs, invalidate controlled caches where supported, and restore deliberately.
Billing notifications can supplement monitoring but are too delayed to be the
only protection. Do not automatically disable billing for the whole website.

Keep active shares/previews until removal; do not configure an age-based bucket
lifecycle that deletes images still promised by active links. Persistent means
no scheduled expiration, not permanent guaranteed availability. At 100 new
shares/day and 300 KiB per image, previews alone add approximately 10.4 GiB/year
at sustained maximum creation, before projects, logs, and recovery retention.

Revocation atomically marks unavailable and removes public listing visibility.
An idempotent cleanup job deletes project/image content, clears associated
records as appropriate, and retains only bounded tombstones needed for retry
and user messaging. Set and test a cleanup target, initially within 24 hours;
monitor failures. Disclose separately how long provider backups/soft-deleted
objects retain recoverable data. Validate orphan targets with a grace period.

Use bounded maintenance for expired operations/counters, stuck leases, and
orphan images. TTL is cleanup, not the access decision. Explicitly choose bucket
soft-delete/versioning settings; avoid locked retention accidentally. Include
maintenance, deployment artifacts, logs, and retained data in estimates.

Release A's maintenance covers records and revoked project cleanup only;
leases, private media storage, and orphan-image maintenance start in Release B.

## Deployment lanes and release procedure

The [standalone Phase 0a procedure](#standalone-phase-0a-migrate-hosting-before-the-backend)
above owns the Hosting migration and its checks. The settled lanes are PR →
staging preview (no backend), main → stable staging site/backend, and `v*` tag →
production site/backend. Function revision pinning does not isolate data.

Initially, PR previews omit service rewrites and disable hosted sharing, while
retaining local/file flows. A Hosting-only command can implicitly deploy HTTP
function source when `pinTag` is present; “no explicit Functions step” does not
prevent that. The preview config must omit those rewrites, not just disable
write buttons. Backend-changing PRs verify in emulators; cloud integration runs
after merge on staging. Share-enabled cloud previews before merge require a
separate temporary project and explicit workflow scope, rather than a PR replacing
the shared staging backend. Fork/untrusted PRs receive no deployment credentials.
Unavailable preview features never fall back to a production API.

Staging has separate database, accounts, secrets, App Check registration, limits,
budget, base URL, and (Release B) bucket. Higher-schema snapshots remain there.
Hosting preview channels within staging can share staging data, which tests and
documentation must acknowledge.
[Firebase preview testing guidance](https://firebase.google.com/docs/hosting/test-preview-deploy)

Generate explicit environment-specific Hosting/Functions configuration from a
single maintained template; deployment commands name both project and config.
Assert that the configured project, bucket, API origin, and support manifest all
belong to the selected environment. Use emulator-only local development; startup
fails rather than falling back to production when an emulator is absent.
Creation/publication default off in new deployments.

### One tagged release for Hosting and backend

Extend “deploying is a tag” to the complete sharing service. Production has one
release manifest per existing `v*` tag, not a separately floating backend tag.
Record web commit/tag, viewer pin, envelope version, server read/admission
ceilings, build-time authoring flags, incident-switch defaults, confirmed iPad
release support, and configuration
identifiers for Functions, rules and indexes. Retain deploy artifacts and record
the actual Hosting release/HTTP revision IDs so rollback can be verified.
Coordinated releases keep tags such as `v1.2.0`. Define web/backend hotfix tags
as `v1.2.0-web.1`, `v1.2.0-web.2`, and so on, based on the last coordinated
release. These are production deployment identifiers, not a promise of a new
App Store build. The existing workflow's `v*` trigger matches both forms.

The hotfix suffix has SemVer prerelease precedence below its base release;
do not use SemVer/tag-name sorting, GitHub “latest,” or the immediately preceding
tag as deployment recency. Record successful deployment sequence/time, explicit
predecessor release and immutable manifest/artifact IDs in the release ledger.
Select rollback targets from that ledger. Tag sorting can be tool/config dependent.
[SemVer precedence](https://semver.org/#spec-item-11)

The manifest stores `releaseTag`, `baseCoordinatedTag`, `confirmedIpadVersion`
and confirmed editable schema support as separate fields. Do not infer the iPad
version from the hotfix suffix or require a new matching iPad marketing version.
A quota/validator/backend hotfix preserves the approved admission ceiling and
schema-authoring gate; changing either requires renewed compatible-live-iPad
evidence. The hotfix still deploys Hosting and the backend from one tag.

Before implementation, update `CLAUDE.md`'s tag doctrine and manifest validation
to accept this convention, and test both tag forms against the release trigger
and manifest checks. Keep the existing required `verify` job name. Hotfixes use
the tagged workflow, not the laptop deploy escape hatch. Runtime incident pauses
remain available while a hotfix is being prepared. Preserve live switch overrides
through its deployment.

All current workflows use `action-hosting-deploy`; they are insufficient for
the complete service. Add explicit Firebase CLI deployment steps for Functions,
database rules/indexes appropriate to the detected edition, and Storage rules
when the bucket is added. The staging lane does this only in staging; the tag
lane does it only in production. Pin rewritten HTTP functions to compatible
Hosting revisions. Background workers, maintenance jobs, rules and indexes
remain explicit release resources even if Hosting deploys pinned HTTP functions.
[Hosting v2 pinning](https://firebase.google.com/docs/hosting/functions),
[Functions deployment controls](https://firebase.google.com/docs/functions/manage-functions)

Build and verify before resource changes. Deploy compatible access/index changes
and backend readers, wait for required indexes, then Hosting/editor/viewer.
Validate smoke results before enabling creation or raising admission. Use
backward-compatible changes and default-off switches to bound partial-deploy
failures; the multi-resource deploy is not atomic. Serialize staging deploys and
production releases so a later run cannot change a backend mid-check.

Replace or guard the laptop `npm run deploy` escape hatch with an explicit
project/config/release-manifest path and the same checks. A bare Hosting-only
deploy must not be advertised as a complete sharing release.

### Verification and release smoke checks

Keep the required job named exactly `verify`. Add Functions typecheck/build,
validator/API/lifecycle tests and emulator-only access-rule tests without cloud,
App Check, or viewer-download secrets. Keep `build:site` and the private viewer
token in deploy jobs. Mirror backend steps in `scripts/check-all.ts` so local
cross-platform evidence includes the new service.

The tag lane reruns its own correctness checks and checks the manifest's iPad
gate; a tag may name a commit that never passed a PR. For the coordinated viewer
release, record a full `npm run check:all` run with web, viewer and iOS present
and no skipped repositories. Private Actions status alone is not this evidence;
the repository notes that jobs can fail to start when paid minutes lapse.

Extend the existing root/viewer title smoke check with content assertions:

- `/api/sharing-status`: JSON content type, exact expected environment/release
  marker, envelope version and admission ceiling; reject an HTML SPA response.
- `/api/shares/:id`: a known, unlisted, non-sensitive smoke fixture with expected
  schema and digest; malformed/missing IDs return the documented JSON errors.
- `/share/:id`: matching canonical URL, dedicated share-page marker, actions and
  social metadata for that fixture; unknown shares return a real 404 share page,
  not the site's generic 200 HTML shell.
- Static generic card in Release A; verified JPEG dimensions/type from the media
  route in Release B; gallery smoke queries return approved data only.

Seed the smoke fixture using an authorized administrative setup tool, not a
public App Check bypass. Keep it compatible with the supported rollback range
and out of gallery listings. An HTTP 200 alone proves none of these routes.
Run these checks in staging and after each production release; manual staged
creation/native-sharing checks remain necessary.

### Rollback and persistent data

Hosting rollback with pinned v2 rewrites can restore the associated HTTP
revisions. It does not restore background triggers, scheduled jobs, database
rules/indexes, service controls, or stored snapshots. Existing published designs
must remain immutable and accessible under supported readers.

For a full rollback, first pause new creation/publication, select a recorded
compatible release, redeploy its backend/access/worker configuration, restore
the matching Hosting bundle, smoke-test, then restore switches deliberately.
Keep already-needed indexes until no running revision uses them. Retain read
support for all stored schemas/envelope variants: when an older release cannot
read newer stored data, roll forward a reader fix or keep the newer reader with
the older UI rather than downgrade documents. Exercise both HTTP-only and full
service rollback in staging before enabling production sharing.

## Acceptance and verification matrix

- Accepted complete projects survive create → fetch → edit → export with equality
  against their `.axe.svg` payloads. Known-only v8 cases succeed at ceiling 8;
  the three named unknown-vocabulary v8 fixtures are expected upload rejections.
  Their tolerant file round-trip preservation assertions stay unchanged.
- Admission cannot be bypassed with a lower declared stamp; support-manifest
  warnings match actual client capabilities and confirmed release evidence.
- Server validation never mutates projects or resolves catalogue presets;
  missing embedded presets/unknown nested fields fail, while valid embedded
  hardware with unfamiliar IDs stays intact and matches the client digest.
- The same pure strict validator runs client-side before consent and server-side
  before writes. Test unknown vocabulary at ceiling 8, unsupported v8 at ceiling 7,
  resource limits and unknown policy revisions; all offer file sharing without
  upload. Stale status never bypasses server enforcement.
- All clients match fixed JCS canonical texts and SHA-256 digest vectors, including
  awkward floats, UTF-16 ordering and invalid input. Raw duplicate keys are rejected
  before ordinary parsing. Native JSONEncoder byte output is not the digest basis.
- Malformed/future/oversized input fails before writes; text stays escaped in HTML
  and generated images; network validators enforce geometry/resource limits.
- Concurrent duplicate creation counts once; conflicting retries fail; quota
  transactions cannot be bypassed; retry expiry and lost-response recovery work.
- Release A local-key/pasted-key revocation and recovery export work; Release B
  tests recovery-file import/library. Incorrect keys fail and internal records
  stay out of public responses and direct browser cloud-data access.
- Revocation racing creation retries, image rendering, approval, submission, or
  withdrawal never revives a share/listing; cleanup survives partial failures.
- Worker repeat delivery/lease expiry creates one valid bounded image; generic
  fallback works; no GET can start unbounded rendering.
- Editor loading has no chooser flash; unsaved-change/history rules and stale-fetch
  protection work through the existing route shell; successful loads normalize
  the URL; altered recipient projects receive new share IDs.
- Remote viewer errors never load an unrelated fragment/default design, including
  malformed `share` queries and valid IDs returning 404/410/429/503.
- Existing file share, compressed fragments, viewer PNG download, and ordinary
  local editor workflows keep working.
- Viewer `npm run check` consumes the versioned sharing-envelope fixtures and
  independently tests parsing, errors, compatibility and preview variants.
- Pagination filters/order/cursors are bounded and tested under concurrent changes;
  hidden/pending/rejected/withdrawn items do not enter public API responses.
- Creator secrets and operation/report/moderation records never appear in public
  metadata, gallery cards, exported projects, client errors, or application logs.
- Staging confirms actual CDN/cache removal windows, real social-crawler image/HTML
  retrieval, native sharing on iOS/Android targets, and desktop fallbacks.
- Emulator tests cover logic; real staging checks cover platform IAM, App Check,
  storage/cache behavior, monitoring, and billing configuration.
- The three migrated workflows target the intended project; preview configs
  contain no production backend; smoke checks reject SPA-shell 200 responses;
  backend tests run under secret-free `verify` and the tag's own checks.
- Staging rollback preserves records, stored-schema reads and relevant indexes;
  hosting-only rollback is distinguished from worker/rules/service rollback.
- Runtime switches pause/restore without a tag, enforce their bounded refresh
  window, and survive deploy/rollback. Hotfix tags pass the workflow/manifest
  checks without requiring a new iPad version or raising schema admission.

Run the repository's relevant unit/contract/schema checks and build after code
changes. Record validation results per phase; this planning document does not
claim implementation tests have already passed.
