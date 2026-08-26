# Bass body design — web milestones

## Outcome

Axe Shaper supports two deliberately separate design modes: six-string
electric guitar and four-string electric bass. A new design begins by choosing
the instrument and an exact blueprint on one screen. Once the editor opens,
every template and hardware control is constrained to that instrument; an
instrument change starts a new design rather than mutating the open one.

This plan covers the React/web repository. The matching native work is scoped
as `axe-shaper-ios/docs/m24-bass-body-design.md`. The `.axe.svg` payload and
fixture tests are the shared contract; implementation code remains separate.

## Product decisions

- The first release supports **four-string, single-scale, solid-body electric
  basses only**. Five-string, multiscale, left-handed, acoustic and hollow-body
  construction are explicit follow-ups.
- `instrumentType` is a project-level fact with wire values `guitar` and
  `bass`. `stringCount` is also project-level; v3 writes `6` for guitar and `4`
  for bass. Hardware compatibility is derived from both values.
- This is a schema v3 feature. v1/v2 projects migrate to `guitar` and `6`.
  Future-version projects must not be silently edited by the web app.
- Keep the existing `GuitarProject` source type name during this program. A
  repository-wide rename adds risk without changing the file format or user
  experience; it can be handled separately after both apps support v3.
- The type is selected only while creating a design. Inside the editor it is
  displayed as project context, not exposed as a live Guitar/Bass toggle.
- The startup chooser replaces the current first-run S-style welcome action.
  Opening a saved file or `/app?plan=...` bypasses it.
- Manual blueprint authoring happens after the schema, catalogs and validation
  are complete. Until then, synthetic fixtures exercise bass dimensions.

## The 4 + 4 bass catalog

“4 + 4” means four curated reference blueprints and four additional
blueprints, mirroring the guitar library's current reference/extra tiers.

Naming follows one pattern, `<Archetype>-Style Bass`, for every entry. Note
that this is a *new* policy rather than a description of the shipped guitar
library: `BLUEPRINT_MANIFEST` already ships `gibson_firebird`,
`gretsch_thunderbird` and `gibson_flying_v` with categories like “Firebird”
and “Thunderbird”, and descriptions naming Gibson and Gretsch outright. This
plan does not retro-rename those; it only commits the bass entries to the
reviewed-name pattern going forward. If the guitar names are to change, that
is separate work with its own manifest/blueprint-id migration.

| Tier | Shared id | Shipping name | Historical archetype used for research | Nominal scale to verify | Why it belongs |
| --- | --- | --- | --- | ---: | --- |
| Reference | `p_bass_style` | P-Style Bass | Fender Precision Bass | 34 in | Foundational split-coil, bolt-on bass |
| Reference | `j_bass_style` | J-Style Bass | Fender Jazz Bass | 34 in | Offset body and dual J pickups |
| Reference | `mm_bass_style` | MM-Style Bass | Music Man StingRay | 34 in | Large bridge humbucker and distinct pickguard |
| Reference | `r_bass_style` | R-Style Bass | Rickenbacker 4001/4003 | 33.25 in | Neck-through archetype and distinct hardware |
| Extra | `thunderbird_bass_style` | Thunderbird-Style Bass | Gibson Thunderbird | 34 in | Reverse offset, long body and dual bass humbuckers |
| Extra | `mustang_bass_style` | Mustang-Style Bass | Fender Mustang Bass | 30 in | Canonical short-scale solid body |
| Extra | `sg_bass_style` | SG-Style Bass | Gibson EB-3 / SG Bass | 30.5 in | Short scale and glued-neck construction |
| Extra | `streamer_bass_style` | Streamer-Style Bass | Warwick Streamer | 34 in | Modern sculpted-body archetype and soapbar option |

The scale values above seed research; they are not blueprint evidence. Every
neck joint, rout, bridge reference and body dimension must be verified while
the corresponding blueprint is authored.

The **Shared id** column is contract, not UI: it is the `activeTemplateId`
written into every saved file and the key for `BLUEPRINT_MANIFEST`,
`FINGERBOARD_OVERHANG_MM` and `DEFAULT_NECK_JOINT_MECHANISM` on both
platforms. `thunderbird_bass_style` was renamed from `thunderbird_bass` for
consistency here; any further change to this column must land in
`axe-shaper-ios/docs/m24-bass-body-design.md` in the same change. The
Shipping-name column is UI only and can move freely.

## Shared wire contract

Schema v3 adds these required project fields:

```json
{
  "schemaVersion": 3,
  "instrumentType": "bass",
  "stringCount": 4
}
```

Rules:

- v1/v2 decode as `instrumentType: "guitar"`, `stringCount: 6`, then migrate.
- `instrumentType` is authoritative. Do not duplicate it inside each embedded
  neck or bridge, where mismatched copies could disagree.
- Catalog-only compatibility metadata may wrap a preset in memory, but the
  embedded preset remains the physical source of truth.
- Reject a known type with an invalid count in v3. The supported matrix for
  this release is Guitar/6 and Bass/4.
- Continue embedding the complete resolved neck, bridge and pickup rout data.
- Add bass pickup vocabulary only where a distinct rout or presentation is
  real: split-coil, J single-coil, bass humbucker and bass soapbar at minimum.
  Blueprint-specific pickup types may be added rather than disguising a
  different rout under a generic name.
- Add a web future-version policy before writing v3: a payload newer than this
  build may be viewed/exported only if that is proven safe, never edited and
  rewritten as if it were understood. Today there is no such gate at all:
  `extractProjectFromSVG` (`src/utils/svgExporter.ts`) does a bare
  `JSON.parse` with no version check, and `migrateProject`
  (`src/utils/presets.ts`) unconditionally stamps `PROJECT_SCHEMA_VERSION`, so
  a v4 file opened today is accepted, edited and re-saved as v2. Those two
  functions are the fix site.
- **String spacing is a v3 field, not a W2 implementation detail — and web is
  already behind iOS on it.** `BridgePreset` here carries only `widthMm`,
  `lengthMm`, `compensationMm` and `saddleOffsetYMm`. iOS already models
  `BridgePreset.stringSpacingMm`, `BridgePreset.heightMm` and
  `NeckPreset.nutStringSpacingMm` — but as optionals it never writes, so every
  fixture in `tests/fixtures/ios-written` omits all three and `StringGeometry`
  falls back to constants. Bass makes them load-bearing. Web adds all three
  under **exactly those names**; both sides start writing them at v3.
- **`stringSpacingMm` is the total spread across all strings, not per-string
  pitch.** iOS spends it as `-totalMm / 2 + (index - 1) * (totalMm / 5)`, and
  its `fallbackStringSpacingMm = 52.5` is six strings at 10.5 mm pitch. Write
  the bass value the same way — four strings at ~19 mm pitch is a spread of
  ~57 mm, not `19`. Getting this backwards would draw four strings 6.3 mm
  apart in the native preview while the printed plan still looked right, which
  is the “two facts competing” failure this codebase has documented twice
  already. Pin the definition in the format doc before either side writes it.
- **The fingerboard-overhang reference fret is per instrument: 22 guitar, 20
  bass.** `FINGERBOARD_OVERHANG_MM` (`src/constants/hardware.ts`) stores, per
  blueprint, how far past Y=0 that body's reference fret sits, and
  `neckPresetFieldsForTemplate` recomputes `nutToBodyEdgeMm` as
  `getFretDistanceFromNutMm(N, scale) - overhang`. iOS mirrors the same
  constant as `BlueprintCosmetics.fingerboardOverhangMm` and must agree on N.

  **Revised during W4.** This plan originally said 22 for every instrument.
  The number turns out not to be a claim about where a fingerboard ends: the
  overhang is derived with N and consumed with N, so the absolute position
  cancels and only the rate `kN = 1 - 2^(-N/12)` survives - how far the joint
  slides per mm of scale-length change. A same-scale swap is therefore exact
  whatever N is (`s_style`'s overhang is derived from a *21*-fret neck using
  22 and still reproduces 390.7 exactly), and N only matters across a scale
  change.

  That makes 22 exactly right for guitar, where all four curated necks have
  22 frets, and the wrong *rate* for bass, where necks have 19-21: a 34" to
  30" swap misplaces the joint - and the bridge - by ~3.5mm. N=20 drops that
  below a millimetre for the swaps that make sense.

  Two things stay true from the original wording, and matter more than the
  value: **N must be identical on the way in and the way out** (reading it off
  each neck's own fret count breaks the cancellation and would move the bridge
  10.8mm in a case that is currently exact), and **N must be identical on both
  platforms** per instrument, or the body lands at a different Y on each side.

  Changed at W4 rather than later because the bass catalogue existed and no
  bass blueprint did, so no stored overhang constant had to be recomputed.
  After W6 authors eight of them, this change would mean recomputing all eight
  on both platforms.

### Catalog tables and the golden corpus

`scripts/generate-golden-corpus.ts` iterates **every** `NECK_PRESETS` ×
`BRIDGE_PRESETS` pair and embeds `NECK_PRESETS`, `BRIDGE_PRESETS` and
`PICKUP_SPECIFICATIONS` verbatim under `constants`. `npm run corpus:check`
pins those key sets exactly. Adding bass hardware to those three dictionaries
therefore:

- fails `corpus:check` the moment it lands, in **W2** — not W7;
- grows the scale-math matrix from 9 × 4 = 36 rows to roughly 13 × 7 = 91, of
  which about 40 are meaningless pairings (a 34" bass neck against an F-style
  tremolo) that every port is then contractually obliged to reproduce.

The precedent for this exact problem is already in the tree and documented:
`CURATED_NECK_PRESETS` is a separate table from `NECK_PRESETS` *specifically*
because adding ids to the corpus-pinned dictionary “would fail the check
outright,” and `axe-shaper-ios`'s `PresetCatalogue.curatedNecks` is split from
its corpus-pinned `necks` for the same reason.

Decide before W1 code lands, because it is a cross-platform decision and iOS
must make the same one:

1. **Separate bass tables** (`BASS_NECK_PRESETS` / `BASS_BRIDGE_PRESETS`),
   resolved through the same `??` chain as `CURATED_NECK_PRESETS`, corpus
   untouched — cheapest, but bass scale math then has no corpus coverage and
   needs its own section adding deliberately; or
2. **One set of tables, compatibility-filtered cross-product** — the generator
   skips pairs whose instrument types disagree. Existing guitar rows stay
   byte-identical, bass gets real coverage, and both generators change in
   lockstep; or
3. **One set of tables, full cross-product, regenerated deliberately** —
   simplest code, largest corpus, and it asks ports to match nonsense pairs.

Option 2 is the recommendation. Whichever is chosen, the guitar half of
`scaleMathMatrix` must be asserted unchanged rather than eyeballed after
regeneration.

**Decided at W1: option 2.** `scripts/generate-golden-corpus.ts` now skips
neck x bridge pairs whose instrument types disagree, resolved through the
`*_INSTRUMENT` side-tables in `src/constants/hardware.ts`. Ids with no
declared instrument pair with everything, so a preset added without a
compatibility entry shows up as extra rows rather than silently vanishing
from the contract; `npm run schema:check` fails if any catalogue id is
missing one. The guitar half is asserted rather than eyeballed:
`npm run corpus` refuses to write when regeneration would change a
`scaleMathMatrix` row the committed corpus already has, unless run with
`--allow-scale-math-change`. iOS must make the same choice in M24.

## Web milestone W1 — contract and migration

**Status: complete**, except for the two gates that need the sibling
repositories (recorded under "Exit criteria" below). Decisions taken here:

- Corpus/catalog tables: **option 2**, see above.
- `stringSpacingMm` / `heightMm` / `nutStringSpacingMm` are added to the
  types as **optional**, under iOS's exact spellings, with the total-spread
  semantics pinned in `docs/AXE_SVG_FORMAT.md`. The guitar catalogue is
  **not** backfilled with values here; those land in W2 alongside the bass
  hardware, so every measurement gets verified against published specs in one
  pass rather than eyeballed one at a time (CLAUDE.md is explicit that
  `hardware.ts` values are checked, not estimated). Nothing reads the fields
  yet on this side, so an absent value changes no behaviour.
- An unrecognised `instrumentType` is **rejected**, not coerced to guitar.
  The plan only required rejecting a known type with a bad count; silently
  treating an unknown instrument as a guitar would offer guitar hardware for
  something this build cannot draw.
- `GuitarProject` keeps its name, per the plan. A new `StoredProject` type
  marks the read boundary - a decoded payload that has not been migrated -
  so v1/v2 payloads are not typed as if they carried fields they lack.

Work:

- Add `InstrumentType` and `stringCount` to the project model and schema v3.
- Add pure migration/validation helpers and make all new-project construction
  pass through one factory instead of the current module-level S-style value
  (`INITIAL_PROJECT` in `src/App.tsx`, evaluated at import — which also means
  its `metadata.created` is the timestamp of page load, not of the project;
  the factory fixes that in passing).
- Add catalog compatibility metadata without weakening “embedded copy wins.”
- Tag built-in and user templates with their instrument type; legacy browser
  templates default to Guitar/6. `UserTemplate` (`src/utils/userTemplates.ts`)
  has no version field and stores preset **ids only**, with no embedded copy —
  so this is a default-when-absent read on load, not a migration, and it is
  the one place in the app where an unknown id cannot fall back to embedded
  physical values.
- Add `stringSpacingMm` and `heightMm` to `BridgePreset` and
  `nutStringSpacingMm` to `NeckPreset`, matching iOS's existing spellings and
  its total-spread semantics (see the wire contract above), and decide whether
  existing guitar presets get backfilled values or the fields stay optional.
- Choose and implement the corpus/catalog-table option from “Catalog tables
  and the golden corpus”, in the same change on both platforms.
- Extend SVG metadata/payload encoding and import policy.
- Confirm that `steelfinger/axe-shape-3D-viewer` tolerates `schemaVersion: 3`
  **before** this milestone ships. The v3 bump is not a bass-only event: once
  the web app writes v3, every existing *guitar* project also reaches the
  viewer and iOS as v3. `buildViewer3DPath` serializes the whole project into
  the fragment, so the new fields travel there automatically.

Exit criteria:

- ✅ v1 and v2 fixtures become semantically identical Guitar/6 v3 projects.
  `npm run schema:check` asserts both directions; `npm run fixtures:check`
  asserts it for all 11 iOS-written (v2) fixtures.
- ✅ A synthetic Bass/4 fixture round-trips without changing geometry or type
  (`schema:check`).
- ✅ Wrong known combinations fail validation with a useful error — Bass/6,
  Guitar/4 and an unrecognised type, each with a message written to be shown
  as-is.
- ✅ Unknown future schema versions cannot enter the editable project path.
  `migrateProject()` throws `UnsupportedProjectError`; `loadProject()` is the
  single door and returns the refusal as a value.
- ✅ iOS-written v3 fixture decoding has a test placeholder ready for M24:
  `tests/fixtures/ios-written-v3/`, reported as *pending* by
  `fixtures:check` until iOS syncs files there, then asserted (strict no-op
  load, instrument axis present and inside the supported matrix).
- ⚠️ Readers opening a v3 *guitar* project written by this build:
  - **web** — verified end to end in the browser (export → extract → load →
    v3 Guitar/6, geometry unchanged).
  - **3D viewer** — verified. `validateProject` (`src/core/axeSvg.ts` in
    `steelfinger/axe-shape-3D-viewer`) only requires `typeof schemaVersion
    === 'number'` with no upper bound, and its `GuitarProject` has an index
    signature, so the new fields pass through untouched. Confirmed
    empirically against the pinned bundle in `public/viewer3d` (v0.1.2): a v3
    project renders with full geometry, correct scale and no console errors.
  - **iOS** — *not verified here*; it needs a run of the iOS test suite in
    `axe-shaper-ios`, which this milestone does not touch. Its
    `PayloadSchema` allow-lists known keys, so confirm `instrumentType` and
    `stringCount` are accepted rather than stripped before this ships.
- ✅ `npm run corpus:check` passes. The regenerated corpus differs from the
  committed baseline by exactly two lines — `projectSchemaVersion` 2 → 3 and
  one new `conventions.scaleMathPairing` note. All 36 `scaleMathMatrix` rows
  and every geometry number are byte-identical.

Confirmed against the iOS source while pinning the format doc, and already
covered there: `StringGeometry.evenSpread` divides by a literal `5`, not by
`stringCount - 1`, at all three call sites (nut, saddle, headstock post).
Correct for Guitar/6, wrong for Bass/4 — four strings would be laid across
three fifths of the spread. `axe-shaper-ios/docs/m24-bass-body-design.md`
Step 4 already names the `5` as the divisor to parameterise, so this is a
planned M24 item, not a new finding; it is noted in
`docs/AXE_SVG_FORMAT.md` so the web side cannot write a value that assumes
otherwise. What W1 leaves for that repository is recorded on its branch
`bass-body/m24-web-w1-contract`, including one genuinely open question: web
rejects an unrecognised `instrumentType`, while the iOS plan asks for a
tolerant enum that preserves it.

## Web milestone W2 — bass hardware foundations

**Status: complete.** Every measurement below is sourced; each catalogue
entry's comment records what from. Sourced values used:

| Measurement | Value | Source |
| --- | --- | --- |
| Scale lengths | 762 / 774.7 / 844.55 / 863.6 mm | exact inch conversions |
| Bass neck pocket | 2-1/2" x 3-7/8" (63.5 x 98.425 mm) | Fender-spec pocket, as used by every replacement neck and routing template |
| Body joint fret | 17 | Fender's own setup instructions use the 17th fret as "where the neck joins the body" |
| Bridge string spacing | .750" per string = **2-1/4" (57.15 mm) outer-to-outer** | published both ways on the same product — the total-spread reading, confirmed |
| Bridge plate footprint | 3.19" x 2.09" (81.03 x 53.09 mm) | Fender-spec four-string retrofit envelope |
| Compensation | G +3.2 mm, E +9.5 mm | a 34" bass intonates to ~34-1/8" on the G, ~34-3/8" on the E |
| Nut string spread | 30 mm | ~10 mm centre-to-centre on a 38.2 mm four-string nut, x 3 intervals |
| P split-coil cavity | 57.91 x 29.21 mm core | P-Bass routing template ("Core: 2.28" x 1.15"") |
| MM humbucker cavity | 103.7 x 50.5 mm | published routing-template cavity |
| J pickup | 91.4 x 19.3 mm + 2 mm clearance | published pickup dimensions |
| Soapbar | 88.9 x 38.1 mm + 2 mm clearance | the 3.5" four-string soapbar housing |

Decisions and deliberate gaps, all recorded in the code:

- **One bass bridge ships, not several.** `bass_vintage_plate` is the only
  four-string bridge whose footprint, spacing and compensation could all be
  sourced. A Gibson three-point and a high-mass variant were left out rather
  than invented; each bass blueprint's own bridge is measured with the body
  at W6, which is where a second entry belongs anyway.
- **`bass_split_coil` is one coil half**, which is the unit that actually
  gets routed — a P-style body carries two, staggered. A `PickupRoutSpec` is
  one closed contour, so the pair cannot be a single spec, and a stepped
  outline enclosing both would tell a router to remove material that should
  stay.
- **The split-coil mounting tabs (out to 68.58 mm) are not in the outline
  yet.** Under-routing is the recoverable direction; the tab profile needs
  the traced template W6 supplies. **This is the one approximation in W2** —
  the P-Style blueprint's evidence packet must settle it.
- **`GENERIC_POCKET_SPEC.bass.glued` repeats the bolt-on bass pocket.** No
  measured set-neck bass tenon was available, and the two blueprints mapped
  to `glued` (R-Style, Thunderbird) are really neck-through, where the
  mortise is notional. Falling back to the guitar's 38.1 mm would rout a
  mortise 25 mm too narrow for a bass heel — the exact failure the axis
  exists to prevent. **SG-Style, a genuine set-neck bass, is the entry that
  will need a real number first.**
- Bass routs are rounded rectangles at a 3.175 mm corner radius (a 1/4"
  bit), generated rather than transcribed. That is what a J, an MM and a
  soapbar cavity actually are; the traced, ear-accurate outlines arrive with
  the blueprints at W6, as the guitar shapes did.
- Bass necks are in `NECK_PRESETS` (option 2, one set of tables) and have no
  legacy/curated split — they were authored as scale-length-only entries, so
  the same four serve both the picker and the corpus.

Found and fixed in passing: `scaleAnchors` (`utils/bezier.ts`) wrote
`handleIn`/`handleOut` keys holding `undefined` when the source anchor had
none. `JSON.stringify` drops those, so any resized rout — guitar included —
was not deep-equal to its own saved-and-reloaded copy. Caught by the new
resize/reload assertion rather than by inspection.

Work:

- Add verified 30, 30.5, 33.25 and 34 inch bass neck presets. Keep all stored
  measurements in millimetres.
- Add compatible four-string bridge presets, including string spacing,
  compensation, footprint and reference-line behavior.
- Add bass pickup rout specifications with embedded outlines and dimensions.
- **Give `GENERIC_POCKET_SPEC` an instrument axis.** It is currently keyed only
  by `NeckJointMechanism` and is explicitly “independent of which neck or body
  it's attached to”, with `bolt_on` at 55.56 mm — the real Fender *guitar*
  pocket. A P-Bass pocket is roughly 63.5 mm. Left alone, every bass project
  silently routs a guitar-width pocket. Either the spec gains an
  instrument/string-count axis or bass necks resolve their pocket elsewhere;
  either way iOS's `PresetCatalogue.genericPocketSpec(for:)` changes to match.
- **Decide each bass blueprint's `NeckJointMechanism` explicitly.**
  `DEFAULT_NECK_JOINT_MECHANISM` is keyed by blueprint id and falls back to
  `bolt_on` for anything unrecognized, so all eight bass entries default to
  bolt-on unless added. The enum has only `bolt_on | glued`, and this catalog
  lists R-Style as a neck-through archetype and Thunderbird as neck-through in
  reality. Follow the existing Firebird/Thunderbird precedent — map them to
  `glued` as the closer of the two buckets, with the same comment stating that
  this is a modeling choice and not a construction claim. A third
  neck-through mechanism is deferred (see “Explicitly deferred”).
- Update add/change-pickup logic, bridge drawing and preset resolution so a
  catalog lookup never substitutes guitar hardware into a bass project.
- Add pure selectors for compatible templates, necks, bridges and pickups.
- Regenerate the golden corpus **in this milestone**, per the option chosen at
  W1 — the check fails as soon as the new hardware ids land, and regenerating
  it here is deliberate rather than a way to make a red check go green.
- Seed synthetic bass projects for tests; do not wait for traced bodies.

Exit criteria — all asserted by `npm run bass:check`:

- ✅ The scale/compensation matrix covers every bass neck × bass bridge
  pairing (4 × 1 = 4 new corpus rows), and the corpus is asserted to contain
  no cross-instrument pair in either direction.
- ✅ Each bass pickup can be created, resized, saved, reloaded and deleted —
  including that the resized *outline* matches the resized width, not just
  the reported number.
- ✅ Every selector returns only entries compatible with the active
  type/count, checked in both directions for both instruments.
- ⚠️ A bass project's neck pocket is a bass pocket: asserted as 63.5 ×
  98.425 mm for every bass neck on both mechanisms, and asserted never to
  equal the guitar value. Verification against *a blueprint's own measured
  pocket* is not possible yet — no bass blueprint exists until W6 — so that
  half of the criterion carries forward, with the `glued` gap above as the
  specific open item.
- ✅ Existing guitar corpus output is byte-for-byte identical, asserted by
  test rather than inspection: the regeneration guard added at W1 refuses to
  move any committed `scaleMathMatrix` row, and the diff is **518 insertions,
  zero deletions**.

Verified end to end in the browser as well: a synthetic Bass/4 plan loads
through the real `?plan=` path, draws its 63.5 mm pocket, two staggered
split-coil halves and the bass bridge with no console errors, and every
picker offers bass-only hardware.

## Web milestone W3 — New Design screen

**Status: complete.** `src/components/NewDesignScreen.tsx` is the startup
surface; `EditorRoute` in `src/App.tsx` is the shell that decides between it
and the editor.

Notes on how it was built:

- **No project exists until Open editor is pressed.** The screen holds a
  template *id*, and `createProject` runs once, on submit. That is what makes
  "choosing Bass cannot briefly render or initialise the S-style project"
  structurally true rather than a timing accident - there is nothing to
  initialise until the choice is made.
- **Every control is a real radio input** inside a `<label>`, visually hidden
  by the standard 1px/absolute recipe. Arrow-key movement within a group,
  Space to select, and the single roving tab stop are the platform's; a `div`
  with an `onClick` would have to reimplement each of them and would get the
  roving tab stop wrong.
- **`EditorApp` is keyed by session id**, so a new design gets a new editor -
  undo history, selections and the guide image all belong to the document
  that was open. This is also W4's "undo/redo never crosses a New Design
  boundary" criterion, satisfied early and for free.
- **Unsaved-change tracking is its own flag**, not `canUndo`. Undoing back to
  the start still leaves a redo stack, and saving does not clear history, so
  `canUndo` would have prompted on documents with nothing to lose.
- **Bass shows an honest empty state**, because no bass blueprints are
  bundled until W6. The instrument is real end to end - hardware, pocket,
  routs, file format - and only the traced bodies are outstanding, so the
  screen says that rather than showing an unexplained blank grid. There is no
  Open editor button for an instrument with no blueprints. **This is the one
  thing to review before any public build**: the Bass option is visible and
  selectable while it cannot yet produce a design.
- The `WelcomeModal` is no longer a first-run gate. It survives as contextual
  help in the editor's Help menu, and its "Start with S-Style" action is gone
  - that action only ever existed because the S-Style project had already been
  built behind it. Its three-step primer is repeated below the choices on the
  New Design screen.


Replace `WelcomeModal` as the startup decision surface with one “New Design”
screen:

1. Guitar/Bass selector at the top.
2. Compatible reference blueprint cards, followed by a collapsed Extra group.
3. A clear selected card and one **Open editor** action.
4. **Open existing project** remains available on the same surface.

Behavior:

- Guitar is initially selected for continuity, with the first Guitar blueprint
  selected; Bass updates the grid immediately and selects its first reference.
- Template preview, name, category, scale and construction are visible before
  committing. Instrument selection and card selection are keyboard-operable
  controls, not click handlers on generic containers.
- The app shell creates `EditorWorkspace` only after a project has been chosen,
  avoiding `GuitarProject | null` checks throughout the editor.
- Imported files and same-origin `?plan=` links enter the editor directly.
- Header **New…** returns to this screen after an unsaved-change confirmation.
- First-run educational copy moves below the choices or into contextual help;
  it must not compete with the creation decision.

Exit criteria - verified in the browser (this repository has no component
test runner, and adding one was out of scope for this milestone):

- ✅ A keyboard-only user can choose type/template and open the editor.
  Verified by driving the real controls: ArrowRight moved Guitar to Bass and
  updated the grid, ArrowLeft returned, three ArrowRights moved the blueprint
  selection to T-Style, and Tab reached **Open editor**, which opened
  "Custom T-Style Standard". The final activation was clicked rather than
  keyed only because the automation harness sends Return with an empty
  `event.key`; the control is a `<button type="submit">` inside the form,
  which is what gives Enter its behaviour.
- ✅ Reload/new/open/deep-link paths each land on the intended surface.
  Reload of `/app` lands on the chooser. `?plan=` goes straight to the editor,
  never flashing the chooser, with the URL stripped and undo disabled (the
  plan is the baseline document, not an edit). A `?plan=` that 404s falls back
  to the chooser with an explanation, **not** to a default project nobody
  asked for. Header **New...** returns to the chooser, with the confirmation
  only when the document is dirty; declining keeps the document.
- ✅ Choosing Bass cannot briefly render or initialize the S-style project:
  selecting Bass yields 0 cards, the empty state, and no submit control.
- ✅ Desktop and narrow layouts remain usable without horizontal overflow: at
  375px `documentElement.scrollWidth` equals the viewport and no element's
  right edge exceeds it.

Also confirmed while here: undo/redo do not cross a New Design boundary (both
disabled in a reopened document whose predecessor had history), and the
marketing route is unaffected by the shell change.

## Web milestone W4 — isolated editor mode

**Status: complete.** Much of it was already in place: the neck, bridge and
pickup pickers were wired to the selectors at W2, and the undo/redo boundary
fell out of W3's session key. What W4 added is blueprint and user-template
filtering, the project-type context, and the copy audit.

- **Blueprints and saved templates are filtered by
  `isTemplateCompatible`**, and `handleSelectTemplate` refuses a mismatch
  even if one reaches it. Belt and braces on purpose: a `UserTemplate` stores
  preset **ids only** with no embedded copy, so applying one from the other
  instrument would resolve its neck and bridge straight out of the catalogue,
  with nothing to fall back on. It is the one path in the app where "the
  embedded copy wins" cannot rescue a wrong lookup.
- **Project type shows in two places, not one.** The header carries it next
  to the project name, but the header's project controls are hidden in the
  narrow layout, so the Templates panel carries it too - and that panel is
  where the instrument actually decides what the lists below contain.
  Presented as context, never as a control: changing it would replace the
  contour and every piece of hardware, which is New..., not a toggle.
- **A bass project's Templates tab says there is nothing to switch to**,
  rather than showing an empty list under "Select a baseline bass blueprint".

### The copy audit, and what it deliberately did not change

- Changed: the Templates panel's "baseline guitar blueprint", and the guide
  image's "any guitar template photo".
- **Not changed: `AboutModal` and `MarketingSite`.** Both say "electric
  guitar", which is accurate today - no bass body can be designed until W6
  bundles blueprints. Broadening them now is exactly the "unsupported product
  claim" this milestone's own instruction warns against. They change when
  bass ships, with the counts, at W6/W7.
- **Not changed: the exported SVG's own wording** (including its `<!-- Guitar
  Geometry Group -->` comment) and download filenames. W5 owns making SVG
  titles, descriptions, labels and download names type-aware; doing it here
  would only split that change across two milestones.


Work:

- Filter the sidebar's blueprints, necks, bridges and pickups by the project's
  type/count. Update labels such as “guitar blueprint” to “instrument” or the
  active type.
- Show the project type as quiet context in the header or Templates tab.
- Restrict **Switch Blueprint** to the current instrument. To change Guitar ↔
  Bass, use **New…**, because that replaces the contour and hardware.
- Preserve type/count in saved user templates and prevent applying a template
  from the other instrument. Records already in `localStorage` carry neither
  field and have no version to migrate on, so reads default an untagged
  template to Guitar/6; and because `UserTemplate` stores ids without an
  embedded preset copy, a bass user template resolves its hardware purely
  through the catalog — the one path where “embedded copy wins” cannot save a
  wrong lookup.
- Audit guide-image, export, print, About and marketing copy for guitar-only
  wording without making unsupported product claims.

Exit criteria:

- ✅ There is no route through the UI that offers guitar hardware in Bass/4.
  Necks, bridges and pickup types go through the selectors (asserted in both
  directions by `npm run bass:check`); blueprints and saved templates go
  through `isTemplateCompatible`; `handleSelectTemplate` refuses a mismatch
  as a backstop. Verified in the browser on a real Bass/4 document: every
  picker bass-only, no blueprint offered, and a bass-tagged user template
  visible only in the bass document while a guitar-tagged and an untagged
  legacy one were visible only in the guitar document.
- ✅ Imported Bass/4 projects open in Bass mode even when their preset ids
  are unknown; embedded physical values still win. Asserted by
  `bass:check`: a file naming `some_future_bass_neck` /
  `some_future_bass_bridge` opens as Bass/4, draws from its own embedded
  880 mm scale and 550 mm nut-to-body-edge, and those ids appear in no picker.
- ✅ Undo/redo never crosses a New Design boundary - satisfied at W3 by
  keying the editor on a session id, and verified there.
- ✅ Existing Guitar projects behave as before apart from the new creation
  flow: the golden corpus is unchanged, the iOS fixtures still round-trip,
  and a guitar document still lists all four reference blueprints, the four
  extras, and its untagged legacy user templates.


## Web milestone W5 — output and 3D handoff

Work:

- Make SVG titles, descriptions, labels and download names type-aware.
- Verify 1:1 export bounds for the longer bass body/scale range and both canvas
  orientations; avoid clipping the bridge or calibration marks.
- Send `instrumentType` and `stringCount` unchanged through the standalone 3D
  viewer link. This is nearly free — `buildViewer3DPath` serializes the whole
  project — so the work here is the Bass/4 *rendering* gate below, not the
  transport. The viewer's tolerance of `schemaVersion: 3` is a W1 gate.
- Coordinate a separate update in `steelfinger/axe-shape-3D-viewer`; until its
  Bass/4 rendering is verified, hide or explain the 3D action for bass rather
  than showing a six-string guitar preview.

Exit criteria:

- Bass output prints at 100% with a correct calibration square and no clipping.
- Save → web load → iOS load preserves type, count and all physical geometry.
- The Bass/4 3D action is either accurate or deliberately unavailable.

## Web milestone W6 — author the eight bass blueprints

Create each blueprint manually in the app and save it as a real `.axe.svg`,
then add its curation metadata and order to the manifest. Two other
blueprint-keyed tables need one new entry each, and neither is optional:

- `FINGERBOARD_OVERHANG_MM` — `fret20Distance(scale) - nutToBodyEdgeMm` for
  that body's own native neck, computed by hand exactly as the existing eight
  were (the table is deliberately literal to avoid an import cycle). Same
  value must be added to iOS's `BlueprintCosmetics.fingerboardOverhangMm`.
  The reference fret for a bass body is **20**, not the 22 the existing eight
  guitar entries use, and not that bass's own real fret count — see the wire
  contract.
- `DEFAULT_NECK_JOINT_MECHANISM` — omitting an entry silently yields bolt-on.

Author the four reference blueprints first; complete and validate them before
starting Extra.

Each blueprint's evidence packet must record:

- measurement sources and confidence, without bundling third-party plan scans;
- body outline calibration and body bounds;
- scale length, nut-to-body/joint relationship and neck construction;
- pocket/rout dimensions, bridge reference, compensation and string spacing;
- pickup rout shapes/positions, pickguard and front/back routes;
- body thickness and edge treatment where confidently known;
- any approximation made because no reliable dimension was available.

Per-blueprint acceptance gate:

- closed, non-self-intersecting contour with intentional centerline behavior;
- bridge and saddle positions recomputed from the embedded neck/bridge data;
- all manufacturing-critical geometry survives save/reload in both apps;
- true-scale SVG and iOS PDF render without clipping;
- iOS 3D mesh builds without empty, inverted or degenerate parts;
- `FINGERBOARD_OVERHANG_MM` and `DEFAULT_NECK_JOINT_MECHANISM` entries exist on
  both platforms and agree, with the body landing at the same Y on each;
- a human visual comparison is completed after numerical checks.

## Web milestone W7 — cross-platform release gate

- Add all eight blueprints to the geometry and fixture corpora deliberately.
  The *hardware* half of the corpus was already settled at W2; this milestone
  adds the per-blueprint cases only.
- Generate web-written and iOS-written v3 fixtures and run both readers over
  both sets.
- Assert semantic round-trip, payload compatibility, deterministic local
  output, unknown-field preservation and 1e-6 mm geometry agreement where the
  shared contract requires it.
- Run existing build, typecheck, lint and corpus checks; record unrelated
  pre-existing failures rather than regenerating baselines to hide them.
- Manually test New/Open/Deep link, Guitar and Bass, each blueprint tier,
  switching within a type, export, tiled print and 3D gating. Note that tiled
  print is separate in-flight work (`src/utils/tiledPrint.ts`), not part of
  this program — if it has not landed, drop it from the gate rather than
  blocking on it.
- Update product/marketing counts only after all eight blueprints ship.

## Explicitly deferred

- Five- and six-string basses, multiscale/fanned frets and per-string scale.
- Left-handed hardware mirroring.
- Acoustic/semi-hollow construction and internal bracing.
- Model-specific bass headstock editing.
- A third `NeckJointMechanism` for neck-through construction. R-Style and
  Thunderbird are modeled as `glued`, following the Firebird precedent.
- Retro-renaming the shipped guitar blueprints to the reviewed-name pattern.
- Live conversion of an open guitar project into a bass project.
- A broad `GuitarProject` → `InstrumentProject` source rename.

## Suggested delivery order

W1 and iOS M24 contract work land together, and the 3D viewer's v3 tolerance
is part of that same gate — the version bump reaches the viewer through every
existing guitar project, not just through bass. The corpus/catalog-table
decision is made at W1 and executed at W2, so W2 carries a deliberate corpus
regeneration in both repositories. W2 can then proceed independently
in both repositories. W3/W4 may be developed against synthetic bass fixtures.
W5 must be complete before claiming Bass support. W6 is intentionally the last
production step and is likely the largest calendar variable despite requiring
little new application code.
