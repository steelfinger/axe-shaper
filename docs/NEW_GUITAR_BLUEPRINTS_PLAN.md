# Axe Shaper — 4 new guitar blueprints: plan

Planning note for the four new guitar blueprints (PRS, ES-335, ES-225T, Explorer). Last reconciled 2026-09-23 against
`main` at fc256b3. No implementation has started; this reflects planning only.

## What changed since the first draft (2026-09-20)

- **The arched-top branch has merged.** `main` now has it, and viewer3d v0.1.16
  ("the first release that can draw an arched top") is pinned. The reason for
  keeping this note out of the repo no longer applies, so it lives in `docs/`.
- **Saves stamp the schema version they need**, not the newest
  (`requiredSchemaVersion`, `src/constants/schema.ts`; `docs/AXE_SVG_FORMAT.md`
  "A save stamps the version it needs"). A `bodyTop` means v5, placed controls
  mean v4. Today 15 bundled blueprints are v4 and only `single_cut` is v5
  (`carved_cap`). Consequences below.
- **Live deploys are now a `v*` tag, not a push to `main`.** Merging goes to
  staging only. A blueprint or format change reaches users when tagged, and the
  tag should track an App Store version that reads the same format.
- **`npm run check:all`** runs this repo's gates plus the viewer's and iOS's own.
  It is the evidence for anything touching the viewer or iOS fixtures.
- **Still true, re-verified**: no 25" (635mm) neck, no wraparound bridge, and the
  viewer has no `frontRoutes`/`RoutedCavity` handling at all.

## Foundational corrections established during planning

- **Headstock customization doesn't exist anywhere** in the app (bass or
  guitar) — no field, no shape table, no SVG layer. Custom headstocks for
  PRS/Explorer/Firebird is a standalone feature to scope separately, not a
  per-blueprint task.
- **No hollow-body modeling needed.** "Semi-hollow" here means carved-solid-
  body construction, which the app already models (`bodyTop` construction
  enum + flat `bodyThicknessMm`). No chamber/volume feature required.
- **"Arched top" is cosmetic-only in this app's 2D geometry.** It's a
  2-value enum (`carved_cap` / `solid_body_carve`) consumed by the Sidebar
  edge-treatment picker (`src/utils/bodyTop.ts`). The real carve profile
  lives only in the separate 3D viewer (`steelfinger/axe-shape-3D-viewer`).
  Selecting it costs nothing but doesn't change the DXF/outline.

## Per-blueprint status

### PRS-style (PRS Custom 24)
25" scale, neck joint at fret 20, arched top, thin body, wraparound bridge.

- **Scale length 25"/635mm — gap.** Not in `NECK_PRESETS`
  (`src/constants/hardware.ts`). Existing guitar lengths are 610.0mm (24"),
  628.65mm (24.75"), 647.7mm (25.5"), 685.8mm (27"). Needs a new
  `NeckPreset` entry, `nutToBodyEdgeMm` derived for a fret-20 joint (same
  by-hand `fret22Distance(scale) − overhang` style derivation used for
  SG/Firebird at fret 19), and a `FINGERBOARD_OVERHANG_MM` entry. Open call:
  PRS-exclusive or added to `CURATED_NECK_PRESETS` for reuse.
- **Wraparound bridge — gap.** No preset exists in `BRIDGE_PRESETS`. New
  entry needed: 2 `mountingPoints`, `scaleReference: 'saddle_line'`,
  `singlePlate: true`, own `compensationMm` — modeled on `tune_o_matic`
  minus the tailpiece half. Fits the existing `BridgePreset` type, no schema
  change.
- Thin body — trivial, just a lower `bodyThicknessMm`.
- Arched top — free, already wired. Setting `bodyTop` stamps this blueprint
  at v5, like `single_cut`, so the shipping iPad build must read v5 before the
  web release that bundles it is tagged. The viewer (v0.1.16) does draw the
  carve; the 2D outline/DXF is unaffected.
- Body outline — no existing donor shape resembles a PRS double-cutaway;
  needs human tracing in-app (per `CLAUDE.md`, AI agents can't produce a
  good bezier trace of a reference photo), same process as `p_bass_style`.

### Semi-Hollow Double Cut (ES-335 style)
24.75" scale, neck joint at fret 19, F-holes.

- Scale/joint already covered (628.65mm, fret-19 math same pattern as
  SG/Firebird).
- F-holes — reuse `frontRoutes`/`RoutedCavity`, **no new schema field**
  (see rendering rule below). This matters more now: a new field would need a
  version bump or a documented exemption (the format doc's "rule going
  forward"), and would tie every F-hole blueprint to a newer iPad build. With
  the existing field, the save stamps v4, or v5 if a `bodyTop` is chosen.
- Carved top (`bodyTop`) makes it v5, same reasoning as PRS.
- Body outline — no donor; needs human trace.

### Semi-Hollow Single Cut (ES-225T style)
24.75" scale, neck joint at fret 15.

- Scale covered; fret-15 joint is unusual but just an mm distance — no
  special-casing needed in the math.
- **Shares its outline with the ES-295** — same trace reusable if that ever
  gets its own blueprint entry.
- Same F-hole treatment as ES-335.
- Body outline — human trace needed (single-cutaway ES-295 shape).

### Gibson Explorer
- No new features required at all. No `bodyTop`, so it stays at v4 and is the
  one of the four with no iPad-version dependency.
- **Status (2026-09-24): built, uncommitted.** `gibson_explorer.axe.svg` is
  generated by `scripts/build-explorer-blueprint.ts` from
  `docs/guitar-blueprint-evidence/explorer-58-plan-trace.json`, which holds
  geometry read out of the owner's vector 1958 Explorer plan (PDF paths, not an
  eyeballed trace: body 434.6 mm wide, fingerboard 42.9 mm at the nut). It has
  the traced outline and pickguard, two humbuckers, TOM + stopbar, three pots
  and a toggle, all at the plan's positions. No front/back routes.
- The Flying V is *not* a donor after all; an Explorer is not an affine
  transform of a V. Tracing from the plan was the right call.
- Neck: uses the curated `gibson_scale` neck (no new `NECK_PRESETS` entry, so
  the corpus's neck key set is unchanged), with `FINGERBOARD_OVERHANG_MM` 37.6444
  and a `TEMPLATE_NECK_POCKET_SPEC` of 38.1 x 122.06 x 8.0 (measured off the
  plan; the generic Gibson mortise is 101.6 deep). `nutToBodyEdgeMm` is
  414.5967, which is about fret 18.85 rather than the owner's fret 19 (418.86):
  the plan's TOM posts land at the scale length from its nut, so it follows the
  plan. One number to flip if fret 19 exactly is preferred.
- Also touched: `'Explorer'` added to the blueprint category union, the
  hard-coded blueprint counts in `check-schema-migration.ts` (17) and
  `check-bass-hardware.ts` (9 guitar), the corpus regenerated, and
  `NewDesignScreen` now reads curated necks so the card shows the scale.
- **Still open:** `npm run fixtures:check` fails on "missing:
  gibson_explorer.axe.svg" until the iOS repo writes its own copy into
  `tests/fixtures/ios-written-v5/`. 3D viewer view of the Explorer not yet
  looked at (pickups straddle the pickguard edge, worth a glance).
- Lowest-effort of the four; standard registration checklist only.

## Cross-cutting decision: front-cavity / F-hole 3D rendering (finalized)

- **No new `RoutedCavity` field.** Signal comes entirely from data that
  already exists.
- **Rule**: for each `frontRoute`, test whether its centroid falls inside
  any enabled+visible pickguard (reuse the 3D viewer's existing
  point-in-pickguard containment pattern, `pickguardContainsPoint` in
  `axe-shape-3D-viewer/src/core/pickguardMesh.ts`).
  - Inside a pickguard → no special handling; already hidden by the opaque
    pickguard mesh (current behavior is already correct).
  - Outside any pickguard → render a shallow, fixed-depth cutout (~20mm)
    into the top surface only — a visual impression of a cut, not a
    through-body hole. Not driven by the cavity's own `depthMm` (that stays
    a separate CNC-routing-depth concern).
- **Verified against real data**, not just theory: in
  `gibson_flying_v.axe.svg`, the control-cavity `frontRoute` sits inside its
  pickguard's polygon (no change needed); the small jack `frontRoute` sits
  outside it (needs the new cutout treatment). Fixing this also fixes
  Flying V's and S-style's currently-invisible jack cavities as a side
  effect, at no extra cost — they render as nothing in 3D today because
  `frontRoutes`/`RoutedCavity` aren't even typed in that repo's `axe.ts` yet.
- Scope: `frontRoutes` only (not `backRoutes`).
- **Known remaining lift, unaffected by the depth simplification**: cutting
  an interior hole into a *curved* top needs new geometry in
  `axe-shape-3D-viewer`. Today's only "opening" mechanism
  (`neckPocketNotch`/`appendNeckPocketCavity` in `src/core/archedTop.ts`)
  cuts an edge notch for the neck pocket, not an interior hole surrounded by
  material. Flat tops (`solid_body_carve`) are close to an existing
  primitive (`cappedPrismWithHoles` in `src/core/prismMesh.ts`); carved tops
  (`carved_cap`) aren't — that's a scoped task of its own, needed before
  ES-335/ES-225T's F-holes look real in 3D, not incidental to authoring the
  blueprints. Re-checked 2026-09-23: the viewer's recent arched work (pickup
  families, neck set, binding) does not touch `frontRoutes`. Shipping it means
  a new viewer release, then bumping `viewer3d.version` here (currently
  v0.1.16), then `npm run check:all`.
- Viewer-side ordering: the blueprints can be authored and registered before the
  viewer renders the cutouts (they render as nothing, exactly as the jack
  cavity does today). They should not be *tagged live* claiming a semi-hollow
  look until the cutout ships.

## Standard registration checklist (applies to all four)

1. Blueprint `.axe.svg` file — design in-app, Save, drop into
   `src/constants/blueprints/`.
2. `blueprintManifest.ts` — add to `BLUEPRINT_MANIFEST` and
   `BLUEPRINT_ORDER`.
3. `NECK_PRESETS` entry (+ `CURATED_NECK_PRESETS`/`NECK_PRESET_INSTRUMENT`
   as applicable) if the scale/joint isn't already covered.
4. `FINGERBOARD_OVERHANG_MM` entry for the new template id.
5. `TEMPLATE_NECK_POCKET_SPEC` entry only if the pocket differs from the
   generic default.
6. `BRIDGE_PRESETS` entry only where new hardware is needed (PRS
   wraparound).
7. `npm run corpus` regeneration (guarded against unintended scale-math
   drift).
8. iOS fixture check (`npm run fixtures:check` / `scripts/check-ios-
   fixtures.ts`). Fixtures live in `tests/fixtures/ios-written-v5/`; each new
   guitar blueprint needs an iOS-written copy, which means the iOS repo has to
   produce it.
8b. Version guard: `scripts/check-schema-migration.ts` now guards every
   bundled blueprint's stamped version (6092ed9). A new blueprint must be
   saved at the version its content needs (v5 with `bodyTop`, else v4 when it
   has controls), not hand-edited.
9b. Before release: `npm run check:all`; then the tag decides what is live.
9. `npm run dxf:check`, `npm run bridge:check` — ride along automatically,
   no separate registration.
10. No bass-style dedicated check (`bass:check`) applies to guitar
    additions.

## Suggested build order

1. **Explorer** — proves the registration checklist, zero new features.
2. **PRS** — one-time additions (wraparound bridge preset, 25" scale
   entry), plus a human-traced outline.
3. **ES-335**, then **ES-225T** — share the F-hole rendering rule, resolved
   once and reused; each needs its own human-traced outline.
4. **Headstock customization** (PRS/Explorer/Firebird) — scoped and
   scheduled independently; gates none of the four blueprints.

Release note: PRS, ES-335 and ES-225T bundle v5 content (`bodyTop`), so they
wait on an iOS build that reads v5 (the iOS arched-top fixtures check landed
before this reconciliation; confirm the shipped App Store version before
tagging). Explorer has no such dependency and can go out first.

Nothing has been implemented yet as of this note.
