# Sharing: production launch checklist

**Prepared:** 2026-10-24

**Status:** Not started on production. Sharing (Create link, `/share/:id`,
download, management, App Check) is complete and verified on
`axe-shaper-staging`; see [Phase 0 notes](SHARING_PHASE_0_NOTES.md) and
[operations](sharing-operations.md).

**Owners:** **Owner** = console, billing or a decision only the project owner
can make. **Agent** = code, CLI deploys and verification.

## Starting point (checked 2026-10-24)

**Production is untouched.** Read-only checks against `axe-shaper-web`: the
Firestore API is disabled, listing Functions fails (most likely no Blaze plan
yet), and no Firebase web app is registered. The release lane does not set
`VITE_SHARING`.

**Much of the release wiring exists, uncommitted.** The local branch
`codex/sharing-release-a` (last touched 2026-10-21, no commits beyond `main`)
holds uncommitted work that this checklist builds on rather than repeats:

- `config/sharing-release.json`: a reviewed release manifest targeting
  `v1.3.2-web.1` with admission ceiling 9, upload policy `project-upload-v3`,
  viewer `v0.1.26`, iPad 1.3.2 confirmed live on 2026-10-24 (App Store lookup),
  and `productionSharingEnabled: false`.
- `firebase.sharing-production.json`: production Hosting config with the
  `/api/**` and `/share/**` rewrites pinned to the Function revision
  (`pinTag`) and immutable caching for `/sharing/releases/**`.
- `scripts/deploy-sharing.ts`: refuses a production deploy unless the manifest
  enables it and it runs from exactly that tag in the release workflow; never
  initialises or overwrites runtime controls. `scripts/smoke-sharing.ts`,
  `scripts/check-sharing-release.ts`, `scripts/verify-native-release.ts`.
- Immutable support manifests under `public/sharing/releases/` and the minimum
  editable iPad version shown on the share page.
- Pending creations persisted across a reload (`src/sharing/pendingShares.ts`)
  with a recovery page (`RecoverSharesPage`).
- The staging workflow deploying the backend itself plus a smoke test, and
  `verify` running the Firestore emulator tests.

## 0. Land the existing work

- [ ] **Owner:** confirm the uncommitted `codex/sharing-release-a` work is
  meant to be kept.
- [ ] **Agent:** review it; run the full gates (unit, e2e, emulator, contract
  checks, `check:all` with no skipped repositories); fix findings; commit to
  `main`; confirm the staging deploy and its smoke test pass.

## 1. Decisions

- [ ] **Owner:** move `axe-shaper-web` to **Blaze**. This changes billing for
  the existing live site too, not only sharing.
- [ ] **Owner:** set a monthly budget for the project. Suggested: $25 with
  alerts at 20%, 40% and 100%, matching staging. Alerts notify; they do not
  stop spending.
- [ ] **Owner:** confirm Firestore in **`europe-north1`**, the same as
  staging. The location is permanent.
- [ ] **Owner:** confirm the launch tag **`v1.3.2-web.1`**, a web/backend
  hotfix of the `v1.3.2` coordinated release with admission ceiling 9.
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
- [ ] **Owner:** extend the CI deploy account behind
  `FIREBASE_SERVICE_ACCOUNT_AXE_SHAPER_WEB`. It is scoped for Hosting today;
  deploying Functions, Firestore rules and indexes needs more roles. The agent
  supplies the exact list; expect one round of adjustment.
- [ ] **Owner:** create the Firestore document `sharingControl/service` with
  `creationEnabled: false` and `projectReadsEnabled: true` (booleans).
  Production starts with creation paused; deploys never create or change this
  document.

## 3. Provisioning

- [ ] **Agent:** create Firestore `(default)` in `europe-north1` with delete
  protection; deploy the deny-all rules and the TTL field overrides.
- [ ] **Agent:** register the production Firebase web app. Store its public
  config and the reCAPTCHA site key in a GitHub **`production` environment**,
  so they can never be confused with the staging repository variables.
- [ ] **Agent:** create a new random `SHARING_CLIENT_KEY_SECRET` in production
  (never reuse staging's) and set the one-day Artifact Registry cleanup policy
  for `europe-north1`.

## 4. Wire the release lane

- [ ] **Agent:** make `firebase-hosting-release.yml` run
  `node scripts/deploy-sharing.ts production` and the smoke test against
  `https://axeshaper.com`. Set `VITE_SHARING=1` and the App Check variables in
  that workflow only, from the `production` environment.
- [ ] **Agent:** in one reviewed commit, set `productionSharingEnabled: true`
  in the manifest and update CLAUDE.md, which currently says `VITE_SHARING`
  must stay off in the release lane.
- [ ] **Agent:** rehearse the complete release workflow against staging before
  tagging.

## 5. Launch

- [ ] **Owner:** push the tag `v1.3.2-web.1`.
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

**Pausing:** set `creationEnabled` (or `projectReadsEnabled`) to `false` in
`sharingControl/service`. Handlers apply it within 60 seconds; no deploy or tag.

**Rolling back:** roll Hosting back to the previous release. The rewrites are
pinned, so the Function revision rolls back with it. Firestore data is
unaffected, and existing shares keep their original schema and release
manifest.

**Known, accepted limits:**

- A direct call to the Function URL can forge forwarding headers and choose
  its own per-client quota key. Each creation still needs a single-use App
  Check token, and the global cap of 100 creations a day still applies.
- Ingress limits are per Function instance and approximate (at most two
  instances).
- The Functions framework buffers a request body before the 512 KiB adapter
  limit applies; Cloud Run's own request cap bounds it.
