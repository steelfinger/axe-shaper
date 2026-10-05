# Output jacks: Schema 8 implementation plan

Deferred implementation note, prepared 2026-10-04.

## Progress

- **Steps 1-2 (contract, web model and persistence): done.** Schema 8, the
  stamp rule, empty-list drop and format doc are in; iOS reads and preserves
  `jacks` and has a cross-writer fixture (`output_jacks.axe.svg`).
- **Steps 3-4 (web editor, plan rendering): done behind
  `OUTPUT_JACKS_ENABLED`.** Canvas, printable SVG, sidebar, inspector.
  At `angleDegrees` 0 a Strat plate's long axis lies along X; iOS must draw
  the same.
- **Step 6 (iOS): done behind `OutputJackFeature.isAuthoringEnabled`.** iOS
  reads, preserves, draws (canvas, printable SVG, PDF), hit-tests, selects,
  moves, rotates (plates only) and deletes jacks, with a selection card and an
  inspector list. `jackCrossWriter.test.ts` pins that both writers draw the
  same primitives. **The iPad gate is the mirror of the web one:** placing a
  jack stamps 8, and the *live web* refuses a payload newer than the schema it
  ships, so iPad authoring stays off until a web build that reads schema 8 is
  live (web goes live by tag).
- **Not done:** step 5 (blueprints/templates carrying a jack; user templates
  do not yet copy `jacks`), the 3D preview of a jack (preview-only, not part of
  the contract), step 7 (release verification), and turning either flag on.

## Status and release gate

**Deferred. Do not begin the persisted Schema 8 implementation until Schema 7
has shipped as the shared web/iOS baseline.** This document is the source of
truth for the subsequent work; it does not author an output jack in any
project, blueprint, fixture, or runtime type.

Schema 8 support must ship in the web app and iOS together, or the web UI must
keep output-jack authoring unavailable until the iOS release can read and
preserve Schema 8 documents.

This is the same rule as "the web goes live only when an App Store version that
reads the same format is live too" (CLAUDE.md, *Deploying is a tag*), applied
to v8. Concretely:

- Raising `PROJECT_SCHEMA_VERSION` to 8 only widens what the web *reads*. It is
  safe to deploy before iOS ships, because a save stamps 8 only when a jack is
  placed (see *Schema 8 contract*, item 3), so no existing or jack-free
  document changes version.
- Anything that lets a user *place* a jack (the Output Jack action, blueprints
  or templates carrying one) must be hidden behind a build-time flag until an
  iOS release that reads v8 is live. No `v*` tag may enable that flag before
  then.
- iOS reader support lands first, so there is never a window where the web
  writes v8 and the shipping iPad build refuses it.

## Decision

Output jacks are independently placed, front-face hardware. The first release
has exactly two mounting styles:

| Stored style | Plan-view representation | Intended use |
| --- | --- | --- |
| `strat_plate` | A rotated flat oval plate, visible jack assembly, and two screw markers | Strat-style front-face installation |
| `direct` | A visible jack washer, hex nut, and central through-hole | Through the pickguard or the body top |

The Strat plate is deliberately a simplified plan symbol. Do **not** represent
its dished/angled cup, thickness, countersinks, jack barrel, or routing depth.
Those are manufacturing and 3D concerns, not part of the current 2D hardware
presentation model.

Telecaster cup and Les Paul-style side-mounted jacks are explicitly out of
scope. They need a side-face reference, drilling direction/depth, and a
different editor interaction from top-view hardware; they must be designed as
a later `side_mounted` feature rather than forced into either v1 style.

## Agreed dimensions

All dimensions are millimetres. They are shared physical drawing geometry, not
per-project user controls in v1.

| Item | Dimension | Notes |
| --- | ---: | --- |
| Jack through-hole | 9.8 mm diameter | The regular output-jack body/pickguard hole |
| Nut | 13 mm across flats | `SW13`; draw as a hexagon where shown |
| Washer | 15 mm diameter | Visible on a direct-mounted jack |
| Strat plate overall | 80.5 x 31.3 mm | Flat oval silhouette |
| Strat plate screw spacing | 71.0 mm centre-to-centre | Screw diameter is visual-only until a manufacturing definition exists |

For `direct`, draw the 15 mm washer, 13 mm hex nut, and 9.8 mm opening. For
`strat_plate`, draw the 80.5 x 31.3 mm oval with its two screw markers and the
same compact jack assembly centred on the plate. Plate rotation controls the
whole symbol. A direct jack is rotationally symmetric, so it has no meaningful
user-facing rotation control.

## Schema 8 contract

Add an optional root `jacks` list at the tolerant stored-project boundary.
An in-memory project that contains a jack uses the following concept:

```ts
type JackMountingStyle = 'strat_plate' | 'direct';

interface OutputJackPlacement {
  id: string;
  position: Vector2D;
  mountingStyle: JackMountingStyle;
  /** Used by strat_plate; retained for stable round-tripping on direct items. */
  angleDegrees: number;
}
```

The exact type and field names must be agreed with `axe-shaper-ios` before
either implementation writes Schema 8.

**`angleDegrees` on `direct` jacks.** It is ignored for rendering and must be
preserved verbatim on save. A new `direct` jack is created with `0`. Switching
a jack's style in the inspector changes only `mountingStyle`; the angle is kept,
so `strat_plate` -> `direct` -> `strat_plate` restores the original rotation.

**Unknown mounting styles.** A `jacks` entry whose `mountingStyle` is not one of
the two known values is kept in `jacks` verbatim (all fields, including unknown
ones) and written back unchanged. The editor treats it as follows:

- Drawn with a generic fallback symbol: the 15 mm washer circle with a dashed
  outline and no nut or hole detail.
- Selectable and deletable, but not restylable or rotatable, since the editor
  cannot know what the style means.
- It does not raise the stamp beyond 8. A document claiming a version above
  this build's is already preserved by the existing "keeps its own claim" rule
  in `requiredSchemaVersion()`, so a v9 file with a new style stays v9.

In iOS the style must decode through a raw-value-preserving type, not a closed
`enum`, so an unknown string survives a round-trip. Decide this in the contract
step; it is hard to retrofit once fixtures exist.

Update the version contract in all implementations:

1. Record `jacks` as the Version 8 addition in `src/constants/schema.ts` and
   `docs/AXE_SVG_FORMAT.md`.
2. Raise `PROJECT_SCHEMA_VERSION` to 8.
3. Make `requiredSchemaVersion()` return 8 only when `jacks` is non-empty.
   A project containing no jacks retains the lowest version required by its
   other content, including Version 7's required neck-joint pair.
   - The checks in `src/constants/schema.ts` run highest version first, so the
     `jacks` check goes **before** the v7 `neckJointGeometry` / `neckPlacement`
     check. Placed after it, every new design (which always carries the v7
     pair) would stamp 7 even with a jack.
   - Add `'jacks'` to the function's `Pick<StoredProject, ...>` parameter type.
   - The stamp is applied in `withEmbeddedPresets` (`src/utils/presets.ts`), so
     it happens on the way out as well as on the way in; a save with a
     non-empty `jacks` must come out at 8 through that path.
   - An empty `jacks: []` counts as absent: it does not raise the stamp, and
     the empty list is dropped on save rather than written.
   - Tests in `schemaStamp.test.ts`: no jacks -> 7 for a new design; one jack
     -> 8; `jacks: []` -> unchanged; v3/v4/v5 files stay at their own version
     on open and re-save.
4. Implement matching version computation, migration, Codable preservation,
   and fixture coverage in iOS before declaring Schema 8 cross-platform.

The version bump is intentional. A saved document with placed output jacks
must claim a version understood by every editor allowed to modify it; it must
not be described as Schema 7 merely because `jacks` is additive.

## Implementation sequence after the gate opens

1. **Agree and test the contract.** Finalise the shared field spellings,
   dimensions, fallback behaviour, Schema 8 policy, and a web/iOS fixture
   before UI work.
2. **Web model and persistence.** Add the placement model, factory/template
   copying, migration/version computation, SVG metadata encode/decode, viewer
   handoff where applicable, and undo-safe editing helpers.
3. **Web editor.** Add an Output Jack action beside Potentiometer and Selector
   Switch; provide selection, movement, deletion, inspector style selection,
   and rotation only for the oval plate.
4. **Plan and printable SVG rendering.** Render both styles consistently in
   the canvas and full-size SVG plan. Keep jacks in the hardware presentation
   layer rather than representing them as body routes.
5. **Blueprints and templates.** Add `strat_plate` only to blueprints that
   visibly use one. Use `direct` only where the front-face installation is
   evidenced. Leave side-jack instruments without a v1 jack marker.
6. **iOS parity.** Implement equivalent model, persistence, editing and plan
   rendering, then add cross-writer round-trip fixtures.
7. **Release verification.** Test Schema 3--7 loading unchanged, Schema 8
   round-trips in both directions, selection/rotation behaviour, print scale,
   and old-client version refusal/preservation policy before release.

## Explicit non-goals for Schema 8

- Telecaster, Les Paul, acoustic endpin, or any other side/end-mounted jack.
- Actual control-cavity or jack drilling/routing output in DXF.
- Plate counterbores, depth, angled cup geometry, screw pilot-hole dimensions,
  manufacturing tolerances, or CAM toolpaths.
- Wiring, electrical values, stereo/TRS variants, active-electronics battery
  boxes, or signal-path modelling.

DXF continues to omit jack holes and plate screws, just as it currently omits
the physical holes for visible potentiometers and selector switches. A future
manufacturing feature must add measured drilling/routing definitions rather
than promoting these presentation symbols directly into machining geometry.

## Acceptance criteria

- A user can place, move, select, and delete either agreed front-face style;
  the Strat plate alone can be rotated.
- A direct jack is readable over both a body finish and a pickguard, using the
  agreed washer, nut, and hole geometry.
- A Strat plate reads as an oval 80.5 x 31.3 mm metal plate with two screws
  71.0 mm apart and a central jack assembly, without a simulated recessed cup.
- Output-jack placement survives Save, Open, templates, undo/redo, SVG
  metadata round-trip, and web/iOS cross-writer fixtures.
- Documents without a jack do not become Schema 8 merely because they were
  opened or saved by a Schema 8-capable editor.
- Side-mounted jacks and machining geometry remain absent from the editor and
  DXF export until their separate designs are approved.
