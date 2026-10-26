# Sharing: production launch checklist

**Prepared:** 2026-10-24. **Updated:** 2026-10-24, after Release A landed.

**Status:** Not started on production. Sharing (Create link, `/share/:id`,
download, management, interrupted-upload recovery, App Check) is complete and
verified on `axe-shaper-staging`; see [Release A status](sharing-release-a-status.md),
[Phase 0 notes](SHARING_PHASE_0_NOTES.md) and [operations](sharing-operations.md).

This is a working checklist. Once production sharing is live, record the
outcome in the release status document and delete this file.

**Owners:** **Owner** = console, billing or a decision only the project owner
can make. **Agent** = code, CLI deploys and verification.

## Starting point (checked 2026-10-24)

**Production is untouched.** Read-only checks against `axe-shaper-web`: the
Firestore API is disabled, listing Functions fails (no Blaze plan yet), and no
Firebase web app is registered. The release lane builds with `VITE_SHARING=0`.

**The release wiring is on `main`** (Release A, merged as `7029705`; Verify and
the staging deploy and smoke test passed):

- `config/sharing-release.json`: the reviewed release manifest, `v1.3.2-web.1`,
  admission ceiling 9, upload policy `project-upload-v3`, viewer `v0.1.28`,
  iPad 1.3.2 confirmed live, and `productionSharingEnabled: false`.
  `config/sharing-base-policies.json` and `config/sharing-support.json` hold the
  hotfix baseline and the immutable support records.
- `firebase.sharing-production.json`: production Hosting config. One RE2 rewrite
  sends `/api` and `/share` to the Function, pinned to its revision (`pinTag`);
  `/sharing/releases/**` is cached as immutable.
- `firebase-hosting-release.yml`: reads the manifest gate. With it off, a
  static Hosting deploy as today. With it on, it runs in the GitHub
  `production` environment, refuses App Check settings that do not name
  `axe-shaper-web`, builds and tests the backend, runs
  `node scripts/deploy-sharing.ts production` with
  `FIREBASE_SERVICE_ACCOUNT_AXE_SHAPER_SHARING_PRODUCTION`, then
  `npm run sharing:smoke -- https://axeshaper.com`.
- `npm run deploy` is the laptop fallback for both static and sharing
  releases, from a clean checkout of the reviewed tag.

## 0. Land the existing work - done

- [x] Release A reviewed, fixed, merged to `main`, staging deploy and smoke test
  passed (2026-10-24). Viewer `v0.1.26` published; `v0.1.27` (one-tap Share)
  followed on 2026-10-25, and `v0.1.28` (short share link) on 2026-10-26.

## 1. Decisions

- [ ] **Owner:** move `axe-shaper-web` to **Blaze**. This changes billing for
  the existing live site too, not only sharing.
- [ ] **Owner:** set a monthly budget for the project. Suggested: $25 with
  alerts at 20%, 40% and 100%, matching staging. Alerts notify; they do not
  stop spending.
- [ ] **Owner:** confirm Firestore in **`europe-north1`**, the same as
  staging. The location is permanent.
- [ ] **Owner:** confirm the launch tag. Today it is **`v1.3.2-web.1`**, a
  web/backend hotfix of the `v1.3.2` coordinated release with admission
  ceiling 9. Every tag must equal `releaseTag` in the manifest, so if another
  web release ships first, the launch tag moves with it (see CLAUDE.md,
  "Commit the release record before you tag").
- [ ] **Owner:** decide who may change the runtime switches. Initially: the
  owner, through the Firebase console.

## 2. Console steps on `axe-shaper-web`

- [ ] **Owner:** link billing at
  https://console.cloud.google.com/billing/linkedaccount?project=axe-shaper-web,
  then create the budget scoped to this project only.
- [ ] **Owner:** enable the Firestore API:
  https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=axe-shaper-web
- [ ] **Owner:** create a reCAPTCHA Enterprise key (type Web, checkbox
  challenge off) for `axeshaper.com`, `www.axeshaper.com`,
  `axe-shaper-web.web.app` and `axe-shaper-web.firebaseapp.com`. **No
  `localhost`.**
- [ ] **Owner, after the web app is registered (step 3):** App Check → that
  app → reCAPTCHA Enterprise → paste the key → Save. Do not click Enforce for
  Firebase services; the Function verifies tokens itself.
- [ ] **Owner, after the first Function deploy:** grant **Firebase App Check
  Token Verifier** to the Function's runtime service account
  (`<project-number>-compute@developer.gserviceaccount.com`; the agent supplies
  the exact address). On staging this role first went to the similarly named
  `firebase-adminsdk-…` account by mistake; check the address exactly. Without
  it every real token fails with `app-check/permission-denied` and creation
  answers 503.
- [ ] **Owner:** create a separate sharing deploy service account (staging's is
  `github-sharing-deploy@axe-shaper-staging`) and store its key as the
  repository secret `FIREBASE_SERVICE_ACCOUNT_AXE_SHAPER_SHARING_PRODUCTION`.
  Leave the Hosting-only `github-action-…` account behind
  `FIREBASE_SERVICE_ACCOUNT_AXE_SHAPER_WEB` as it is. The staging identity's
  roles are the template: Hosting admin, Cloud Functions admin, Firebase Rules
  admin, Datastore index admin, Service Usage consumer and Secret Manager
  viewer at project scope, and Service Account User on the compute runtime and
  App Engine default identities only. The agent supplies the exact list; expect
  one round of adjustment.
- [ ] **Owner:** create the Firestore document `sharingControl/service` with
  `creationEnabled: false` and `projectReadsEnabled: true` (booleans).
  Production starts with creation paused; deploys never create or change this
  document.

## 3. Provisioning

- [ ] **Agent:** create Firestore `(default)` in `europe-north1` with delete
  protection; deploy the deny-all rules and the TTL field overrides.
- [ ] **Agent:** register the production Firebase web app. Create the GitHub
  **`production` environment** (the release job already names it) and store
  the public config and reCAPTCHA site key there as `VITE_FIREBASE_*` /
  `VITE_RECAPTCHA_SITE_KEY` variables, so they shadow the staging repository
  variables. The release guard refuses a sharing build whose project is not
  `axe-shaper-web`.
- [ ] **Agent:** create a new random `SHARING_CLIENT_KEY_SECRET` in production
  (never reuse staging's) and set the one-day Artifact Registry cleanup policy
  for `europe-north1`.

## 4. Turn the release lane on

The workflow side is done (see Starting point). What remains:

- [ ] **Agent:** in one reviewed commit, set `productionSharingEnabled: true`
  in `config/sharing-release.json`, and update CLAUDE.md, which says the
  manifest keeps production sharing off.
- [ ] **Agent:** rehearse the complete sharing release against staging
  (`node scripts/deploy-sharing.ts staging` from the release commit, then the
  smoke test) before tagging.
- [ ] **Agent:** physical-device check: a link created on the web opens,
  downloads and edits on a real iPad running the live App Store build.

## 5. Launch

- [ ] **Owner:** push the launch tag.
- [ ] **Agent:** confirm the workflow, the smoke test and the post-deploy
  `<title>` comparison.
- [ ] **Agent:** with creation still paused, check on axeshaper.com that the
  status and share routes respond, App Check refuses a missing, forged or
  reused token, and the cache headers match the plan.
- [ ] **Owner:** set `creationEnabled: true`.
- [ ] **Agent:** on axeshaper.com, run create → open → View in 3D → download →
  manage → revoke, then revoke the test link.

## 6. After launch

- [ ] **Owner:** make sure the budget alert emails arrive.
- [ ] **Agent:** check the Function logs for errors after the first day.
- [ ] **Agent:** run a rollback drill to a recorded compatible predecessor,
  and confirm shares created before it still open.
- [ ] **Agent:** record the outcome in the release status and delete this
  checklist.

**Pausing:** set `creationEnabled` (or `projectReadsEnabled`) to `false` in
`sharingControl/service`. Handlers apply it within 60 seconds; no deploy or tag.

**Rolling back:** roll Hosting back to a recorded compatible predecessor. The
rewrites are pinned, so the HTTP Function revision follows it, but rules,
indexes, data and runtime controls do not roll back. Never roll back to a
release that cannot read every stored schema: once schema 9 shares exist, a
schema-8 reader is not a valid target. Choose by recorded deployment order,
not by tag sorting. See `sharing-operations.md`, "Rollback and persistent
data".

**Known, accepted limits:**

- A direct call to the Function URL can forge forwarding headers and choose
  its own per-client quota key. Each creation still needs a single-use App
  Check token, and the global cap of 100 creations a day still applies.
- Ingress limits are per Function instance and approximate (at most two
  instances).
- The Functions framework buffers a request body before the 512 KiB adapter
  limit applies; Cloud Run's own request cap bounds it.
