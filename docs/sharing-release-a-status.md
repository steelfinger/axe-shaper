# Sharing Release A: review and verification

Updated 2026-10-25. Candidate: web/backend `v1.3.2-web.1`, based on the
coordinated `v1.3.2`, schema 9, upload policy `project-upload-v3`, viewer
`v0.1.29` (`v0.1.26` plus one-tap Share, its short-link fix, and editor-created links). Production sharing remains disabled in the release manifest.

## Review fixes

| Finding | Resolution |
| --- | --- |
| 1. Expired/permanent uploads nag forever | Only unexpired, retryable attempts enter the pending notice. Expired and terminal attempts can be explicitly dismissed on the recovery page. Details are kept for 7 days after the deadline, because a lost response may represent an existing link, then pruned on page load; they are pruned early if storage is full when a new request is saved. Recovery links open in a new tab so the editor keeps unsaved work. |
| 2. v1.2.0 claims schema 9 | Corrected the unpublished record to web/viewer schema 7. Verified web tag `v1.2.0` and its viewer pin `v0.1.20`. Schema 8/9 native requirements are null for that release. |
| 3. Hotfix compares with itself | Independent committed base policies; regression test changes all candidate readers and admission to 10 and still requires `hotfix-changes-compatibility`. |
| 4. Laptop deployment broken | `npm run deploy` builds the composed site and runs checks from a clean reviewed tag, without GitHub environment variables. Static production works with sharing off; enabled sharing requires explicit production configuration before building. |
| 5. Staging identity cannot deploy backend | Separate `github-sharing-deploy@axe-shaper-staging.iam.gserviceaccount.com` identity and GitHub secret provisioned. Existing Hosting-only PR identity unchanged. |
| 6–7. Permanent errors invite recovery | Shared error mapping; retry buttons/hints depend on retryability. Permanent errors cannot consume another attestation token through recovery. |
| 8. Duplicated/fragile key download | Shared download helper, attached anchor, Blob URL revoked after 60 seconds. |
| 9. Inconsistent browser storage | Modal, management and recovery use `sharingStorage()`. Per-share key storage avoids cross-tab map overwrite. |
| 10. Repeated staging checks | Staging follows successful Verify for the exact main commit and skips (not fails) superseded main commits; it only rebuilds Functions and the composed site. |

The staging identity has project-scoped Hosting admin, Cloud Functions admin,
Firebase Rules admin, Datastore index admin, Service Usage consumer, and Secret
Manager viewer roles. Service Account User is granted on the existing compute
runtime/build identity and App Engine default identity, not at project scope.
No production permissions or billing were changed. The GitHub secret is
`FIREBASE_SERVICE_ACCOUNT_AXE_SHAPER_SHARING_STAGING`.

## Validation

- `npm run check:all`: all 13 gates passed in 531 seconds, with no skipped repositories (web, viewer, iPad and backend).

- Focused sharing tests: 205 passed before the final full gate run.
- Recovery browser regression: 5 passed, including expiry, permanent failures,
  dismissal, reload persistence and no overflow at 1600px/390px.
- Viewer: 494 tests, vendored contract and capability checks, TypeScript and build.
- Firestore emulator: 4 integration tests, including denied unauthenticated
  browser reads/writes.
- Live Apple lookup confirms iPad 1.3.2. Its release is recorded as 2026-10-21.
- All three changed GitHub workflows parse as YAML.

The viewer change is prepared in PR
[axe-shaper-3D-viewer#4](https://github.com/steelfinger/axe-shaper-3D-viewer/pull/4).
Its v0.1.26 bundle is a draft release built from `11b0f30`; publish it after
review before treating the pin as a public release. Re-verified 2026-10-24: a
fresh `npm run build` of `11b0f30` is byte-identical to the draft's served
files (one sourcemap differs only in asset-placeholder order), and the viewer's
`npm run check` passes locally (494 tests). The draft was composed locally using maintainer authentication for staging
testing; publish it before merging the web pin so the normal read-only CI token
can fetch it.

## Production launch boundaries

`axe-shaper-web` has billing disabled. It has not received the sharing backend,
App Check setup or runtime controls. Production requires enabling a paid plan
and choosing a budget, provisioning Firestore in the reviewed region, production
App Check and separate CI identity, then verifying deployment and rollback.
The production workflow is prepared but gated off. Environment configuration
must name `axe-shaper-web`; staging variables fail the production build guard.

Do not call this production-ready until the remaining operational checks in
`sharing-operations.md` and the production setup are complete. In particular,
physical-device/native sharing and a compatible full-service rollback drill
cannot be inferred from unit tests or HTTP 200 responses. Old staging schema-8
revisions are not valid rollback targets once schema-9 snapshots exist.

The remaining production steps, in order and with owners, are in
[sharing-production-launch.md](sharing-production-launch.md). This document
records the implementation and evidence for Release A, rather than claiming
those steps are complete.

The local iPad gate uses the existing `finger-precision` checkout; those three
post-1.3.2 commits remain separate and are not claimed as shipped. Compatibility
with the live native release is based on the `v1.3.2` schema source and App Store
version evidence, not on the newer local feature branch.

## Staging deployment findings

The new CI identity successfully deployed Functions, Firestore rules and TTL
indexes. The first pinned Hosting attempts then exposed a Firebase CLI 15.26.0
race: two separate rewrites to the same function caused `runTags.js` to update
the same Cloud Run service concurrently. One PUT succeeded, the other returned
HTTP 409 (`version ... was specified but current version is ...`). This was not
a missing permission; no extra role was granted to work around it.

Both environments now use one RE2 rewrite for `/api` and `/share`, with one
`pinTag`. `sharing:check` rejects duplicate pinned rules for a function, and the
deployment uses one Firebase invocation. RE2 rewrites and pinned-function
behavior are documented in the [Firebase Hosting configuration reference](https://firebase.google.com/docs/hosting/full-config#rewrites).

The staging runtime creation pause took effect at the public origin in 1,066ms
without changing read availability. Creation was restored using a Firestore
update-time precondition and verified through the public status endpoint.

Viewer PR CI did not start: GitHub reports failed account payments or a spending
limit (check run 120900402991). This is distinct from a failed test; the complete
viewer check passed locally. Resolve the GitHub billing block or deliberately
use the recorded local release validation before publishing the viewer bundle.

## Live staging result

The corrected combined deploy succeeded using the dedicated staging CI identity
(Functions, Firestore and pinned Hosting). Its temporary test key was revoked
and removed from disk. The existing PR identity was unchanged. Content-aware
smoke passed for `v1.3.2-web.1`, policy v3, schema 9 and all support manifests.

A real browser test created a schema-9 flame-maple design. The first App Check
request hit a network error before upload; opening the saved request on a fresh
recovery page then obtained real attestation and completed creation. Management
opened from the recovered key, and its recovery-key download completed. The
landing page correctly required iPad 1.3.2. The full-snapshot viewer rendered the
design and the editable-copy route opened it with provenance. The downloaded
`.axe.svg` payload exactly matched the immutable project (deep equality), whose
verified JCS digest was
`sha256:3ab3d4299b4c6ea9846e4b6c7454d081217ce793b887d32821256bc73c1e1e8c`.

Web PR #12's Verify check passed in GitHub. Its Hosting preview failed because
the read-only viewer token cannot fetch the draft v0.1.26 release; publishing
that reviewed dependency is required before merging the web pin. This preview
failure is separate from the successful manual staging deployment.

## Viewer v0.1.27: one-tap Share

[axe-shaper-3D-viewer#5](https://github.com/steelfinger/axe-shaper-3D-viewer/pull/5)
adds **Share** to the viewer: the current 3D view as a branded PNG plus the
design's link (the canonical `/share/<id>` page for a stored share), handed to
the platform share sheet. Without one, it copies the link and downloads the
image. Review found two stale-image cases (a capture finishing after a design
change, and a prepared image surviving scene or camera changes); both were
fixed before merging and checked in the browser.

The PR was admin-merged as `972735d` because the viewer's Actions are blocked
by the billing limit. `v0.1.27` was built locally from that commit with
`npm run check` passing (502 tests). A real phone share sheet, and what each
target app keeps from an image-plus-text share, are not yet checked.

`v0.1.28` ([axe-shaper-3D-viewer#6](https://github.com/steelfinger/axe-shaper-3D-viewer/pull/6),
admin-merged as `06f901f`, built locally with 503 tests passing) fixes what a
Mac test of v0.1.27 found. A design that isn't a stored share sent its
fragment link, the whole project in the URL, into Messages; Share now posts
the `/share/<id>` page for a stored share and otherwise links to the site.
The button also reads "Sharing…" while the sheet is open. The editor's
Create link result gained **View in 3D** (`/share/<id>/3d`), so that path
always has the short link.

`v0.1.29` ([axe-shaper-3D-viewer#7](https://github.com/steelfinger/axe-shaper-3D-viewer/pull/7),
admin-merged as `039c7ad`, built locally with 509 tests passing) has Share
create a short link for a design that isn't stored yet. The viewer holds only
`projectForViewerLink`'s projection, so it asks the editor tab that opened it
(`postMessage`, same origin) to create the link with the exact project and the
Share dialog's own checks, consent text and key handling
(`src/sharing/viewerBridge.ts`, `64fe1d4`). Verified locally with Playwright:
the confirmation, a real App Check refusal relayed with Try again, and, with
the token exchange and create response faked, the stored-share switch and a
short-link share. A real creation awaits a browser that passes App Check on
staging.
