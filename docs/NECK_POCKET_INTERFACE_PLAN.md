# Neck joint geometry: coordinated web + iOS plan

Planning note, 2026-09-26. This is a schema-first, two-client migration for
accurate, editable guitar neck-joint geometry. It deliberately does not yet
change runtime behavior.

## Decision

Treat the joint as a first-class, construction-aware `neckJointGeometry`,
separate from the body style and the selected neck's scale/fret data. It owns
the two-dimensional bolt-on pocket or glued-neck mortise parameters and their
evidence. A parallel, blueprint-owned `neckPlacement` datum owns where the
body joint line meets the scale; the neck preset continues to own scale length
and fret data.

The first release supports only symmetric numeric geometry. A custom joint is
possible only after a deliberate conversion from a locked profile. The editor
does not expose draggable pocket nodes or Bézier handles: the mouth, straight
sides and closing end are semantic manufacturing features, not a generic
freeform contour.

## Why this is needed

The current fields (`jointWidthMm`, `jointDepthMm`, and
`jointCornerRadiusMm`) can only draw one rounded rectangle. In particular,
the current S-style and T-style presets both resolve to 55.56 mm x 76.2 mm
with a 6.35 mm radius. That representation cannot express the different heel
end treatments of a documented S-style rounded interface and a traditional
T-style square-ended interface, nor a straight, tapered or long-tenon glued
joint.

`GENERIC_POCKET_SPEC` / iOS `genericPocketSpec` and
`TEMPLATE_NECK_POCKET_SPEC` / iOS `templatePocketSpec` remain important:
they are legacy resolution paths, not evidence that every bolt-on or glued
joint has a universal geometry.

## Evidence policy

Do not call a profile *verified* merely because it uses familiar nominal
dimensions.

- **documented** means its outline is authored from a named manufacturer
  drawing or published interface specification, with a recorded source and
  date.
- **measured** means a specific physical neck/body or a manufacturer-confirmed
  drawing was measured, with method and sample identity recorded.
- **verified** is reserved for an interface that has evidence of an actual
  fit; it is an evidence level, not a casual style label.

Each shipped profile needs an evidence packet under
`docs/neck-pocket-evidence/` before it can carry one of these labels. The
packet records source URLs or files, model/SKU and revision when available,
measurement method, dimensions, confidence, and limitations. The app's claim
is always scoped: "authored against this documented interface", never "fits
all Fender-style necks".

The first two research targets are:

1. S-style, rounded heel.
2. T-style, square heel.

All other guitar profiles, including glued-neck instruments, remain legacy in
the first release. Bass profiles also remain legacy; a later Custom Joint flow
may seed from the existing 63.5 mm x 98.425 mm bass geometry, but must not
make a compatibility claim.

## v7 document contract

Add paired project-root `neckJointGeometry` and `neckPlacement` objects. A
document requires schema version 7 when these v7 interface objects are
present, and a valid v7 document carries both; neither object is a valid
stand-alone partial upgrade. Existing v1-v6 files retain their stored version
and legacy output when untouched.

The final field names are to be written in `docs/AXE_SVG_FORMAT.md` after the
web reference implementation proves them. The object must nevertheless cover:

- a `profileId`; locked joints carry an immutable embedded profile snapshot
  for repeatable saves, while custom joints carry `derivedFromProfileId` plus
  their own mutable numeric parameters;
- mode: `locked` or `custom`;
- construction/mechanism and evidence/provenance metadata;
- `planShape`: initially `bolt_on_pocket`, `straight_mortise`, or
  `tapered_mortise`. `long_tenon` is deliberately deferred until its distinct
  reduced-width tongue and extension parameters are independently specified;
- symmetric plan-view parameters: mouth width, plan length from `Y = 0`,
  optional deep-end width for a taper, two equal end-corner radii, and an
  end-treatment/radius for the centre of the heel or tenon end;
- IDs of the two body-contour anchors forming the mouth;
- optional target heel width, requested fitting clearance, and cutter diameter
  for custom joints;
- optional `neckAngleDegrees` for glued joints only. `0°` means the fretboard
  plane is parallel to the body **construction plane**; positive values raise
  the nut/headstock end relative to the body. It is never inferred from a
  selected arched or carved top: a curved top has no single plane. It is
  meaningful manufacturing data but does not make a top-view SVG/DXF a
  complete angled mortise template.

`neckPlacement` is deliberately not part of `neckJointGeometry`. It is
blueprint/body-owned: bodies can share a joint profile while placing that joint
at different positions on the scale. It has:

- mode: `blueprint` or `custom`;
- the fixed cross-platform reference fret: 22 for guitar and 20 for bass;
- `jointToReferenceFretMm`, the signed centreline distance from the body joint
  line (`Y = 0`) to that reference fret, where positive means from the joint
  line into the body/toward the tail;
- source/provenance for its blueprint value.

For a known scale, this datum is the authoritative way to derive
`nutToBodyEdgeMm`. It replaces neither the scale length nor the physical joint
plan geometry. The reference-fret number is stored for auditability but is not a casual
user preference: it must match the instrument-type contract. For example, the
current S/T blueprint value is `+75.2453 mm`: fret 22 sits that far from the
`Y = 0` joint line toward the tail.

The decoder generates the complete closed plan outline deterministically from
the named shape and numeric parameters. It never stores editable nodes or
handles. This keeps the centreline and straight sides exact, avoids web/iOS
drift, and gives DXF/CNC users a geometry they can inspect by dimensions.

All placement-entry paths use the same full-precision canonical calculation
for `jointToReferenceFretMm`; display/input rounding never becomes an
independent saved value. Web, iOS and viewer use the existing corpus epsilon
when comparing derived values.

### Schema compatibility rules

- A v1-v6 project with no `neckJointGeometry` resolves through a **frozen
  legacy adapter**. That adapter covers both generic and per-template pocket
  specs.
- The legacy adapter's generated parametric geometry is pinned in the golden
  corpus and must never change an untouched legacy export.
- When a legacy project is explicitly converted in Release B, create a v7
  custom joint seeded from that frozen adapter and a `blueprint` placement
  seeded from the existing `FINGERBOARD_OVERHANG_MM` value. It is never
  promoted to documented/verified merely by conversion.
- A v7 project without valid `neckJointGeometry` and `neckPlacement` objects is
  malformed and rejected.
- Continue the existing policy for future schemas: reject them at the editable
  project gate. Do not introduce a partial read-only future-profile mode.
- An older client cannot safely edit a v7 file. Tests must cover a v7 payload
  whose `neckJointGeometry` or `neckPlacement` was stripped or corrupted and
  demonstrate a loud, deterministic rejection rather than a silent legacy
  fallback.

For v7, `neckJointGeometry` is authoritative for joint rendering, validation
and export. `neckPlacement` is authoritative for the body-to-scale datum. The
`joint*` and `pocket*` fields embedded in `neckPreset` remain legacy-compatible
mirrors only: writers derive their bounding dimensions from resolved numeric
geometry, derive `nutToBodyEdgeMm` from resolved placement, and v7 readers do
not use these fields to resolve either answer. The 3D viewer must read both v7
objects; it cannot continue treating those mirrors as joint geometry.

Validation is deliberately not persisted as truth. Every current client
recomputes it on load, edit, preview and export; provenance is stored, but a
saved `valid` flag could become stale after an external edit.

## Joint attachment and parametric constraints

Joint geometry has its own symmetry contract. It is independent of the body's
`live_centerline` setting and cannot be weakened by turning body symmetry off.

For every supported joint shape:

- The two mouth anchors are the body anchors with semantic roles
  `neck_pocket_left` and `neck_pocket_right`, recorded by ID in the geometry.
- Both anchors remain on the joint line, `Y = 0`. Their positions **and both
  Bézier handles** are locked against ordinary body editing in locked and
  custom modes.
- A numeric width edit moves them to `-width / 2` and `+width / 2` in one undo
  transaction and translates their handles by the same X delta.
- The mouth is an attachment boundary, not an editable curve; the two side
  walls are always generated as straight lines. No joint nodes or handles are
  exposed on canvas.
- The generated outline must be finite, closed, non-self-intersecting, and
  remain inside the body except for its two mouth points.

Bolt-on pockets expose only the meaningful plan-view values: width, plan
length, matching end-corner radii, and heel-end treatment/roundness. A
T-style starting profile uses a square end treatment; an S-style profile uses
a rounded treatment. Custom editing changes these numeric values only.

Glued joints expose a distinct, construction-appropriate set: mortise width,
plan length, optional deep-end width for a taper, tenon/end treatment and
end-corner radii. `straight_mortise` and `tapered_mortise` are named shapes
rather than arbitrary paths. `long_tenon` is deferred: it needs a reduced-width
tongue and extension-length schema rather than a misleading reuse of mortise
parameters. Glued joints may also record a neck angle, but a top-view export
must state that it is not a complete angled mortise template.

If a template does not have a valid, unambiguous pair of mouth anchors,
width editing is unavailable. The app must never infer shoulder anchors from
visual proximity. This attachment behavior is the highest-risk geometry piece
and is prototyped before the contract is finalized; it must cover bodies whose
contour treatment at `Y = 0` differs from Fender-style horns.

There is no app-wide numeric width range. If target heel width is known, the
minimum valid pocket width is that value plus the requested clearance. If it
is not known, a Custom Joint remains valid only within the selected profile's
explicit authored bounds; if the profile supplies no bounds, width editing is
disabled until the user enters a target heel width. This avoids silently
falling back to an arbitrary global range.

For a custom joint with a supplied cutter diameter, each concave internal
corner must have a radius at least as large as that cutter diameter. The app
reports this as fabrication guidance by default; it must never claim that an
impossible inside corner is routable. A later CAM-specific workflow may choose
to make the warning blocking.

Asymmetric joints, curved/tapered bolt-on sides beyond the named parameters,
free movement of mouth nodes in Y, and a body without mapped attachment anchors
are explicit non-goals for this release.

## Neck placement and scale

`jointToReferenceFretMm` is not a cosmetic pocket dimension. Changing it moves
the body along the neck's scale relationship and can relocate scale-linked
bridge/reference geometry relative to the body. It must therefore never be a
free canvas drag.

Release A resolves this datum from the blueprint and keeps it locked. Release
B may offer **Custom Neck Placement** as a numeric, measurement-led override.
Its ordinary control is a signed plus/minus offset from the blueprint value;
builders do not need to see the reference-fret datum to use it. The canonical
stored value remains `jointToReferenceFretMm`. In Advanced measurement mode,
the UI can accept a distance from the joint line to the nut or to any chosen
fret N, derive the canonical reference-fret value, and never persist the
alternate input.

Before accepting a custom placement change, both clients show the signed shift
of the neck and scale-derived bridge/saddle reference, then validate
bridge/body bounds plus pickup and fingerboard-overhang clearance. Pickups are
always body-relative: neck placement never moves them automatically, even if a
resulting overlap requires the builder to move a pickup manually. This policy
is shared by web, iOS and viewer. Changing joint geometry alone preserves
`neckPlacement`; changing neck placement alone preserves joint geometry. Both
operations are separately undoable.

## Neck and joint selection

Picking another neck preset must never overwrite a v7 `neckJointGeometry`: it
changes only scale/fret data and other neck-owned information. It preserves the
resolved `neckPlacement` unless the user explicitly enters Custom Neck
Placement. The old
`neckPresetFieldsForTemplate` generic/template resolver is a legacy-v1-v6
path, not a v7 override.

Changing between bolt-on and glued construction is a material interface
change. It requires an explicit choice to replace the joint with a compatible
locked profile or create a compatible custom joint; the app must not silently
carry an incompatible profile across, discard numeric parameters, or overwrite
them with generic geometry. The prior state remains recoverable through undo.

## Product flow

The Hardware panel receives a **Neck Joint Geometry** card.

1. It presents the chosen locked profile, construction, named plan shape,
   dimensions, end treatment, neck angle where applicable,
   evidence level, provenance and compatibility scope.
2. The default profile and its two body-mouth anchors/handles are locked. Its
   generated geometry is visible but has no ordinary node editing affordances.
3. **Convert to Custom Joint** makes one explicit undoable copy and asks for
   target heel width, desired fitting clearance and cutter/tool diameter where
   known.
4. Custom controls are numeric: width, plan length, end-corner radius and
   heel/tenon-end roundness; tapered mortises additionally show deep-end width.
   Glued shapes show neck angle as clearly limited supplementary data.

For a legacy project, **Convert to Custom Joint** uses the frozen legacy
adapter as its seed. If its body lacks valid mouth-anchor roles, the resulting
geometry remains visible/exportable but width editing stays unavailable; the
app does not invent attachment anchors.

On the canvas, locked joint geometry retains the existing gold/locked visual
language. It has dimension overlays but no geometry drag affordances; values
are edited in the panel. The UI makes it clear that body live symmetry does not
control joint symmetry.

Release A shows the resolved neck-placement datum as read-only context. Release
B adds **Custom Neck Placement** as a separate advanced flow; it is numeric,
shows the predicted scale-linked shift before confirmation, and has no direct
canvas-drag affordance.

Custom is not an error. It receives a quiet "Verify against the physical neck"
state. Invalid numeric geometry, on the other hand, blocks export.

## Export and disclosure

Every exporter reads the resolved parametric outline for v7 and the frozen
legacy adapter for older documents.

- **SVG payload:** stores evidence/provenance and the authoritative
  `neckJointGeometry` object. Validation is recomputed by the reader.
- **Printable SVG:** puts an unverified-joint note outside cut geometry and
  retains the metadata.
- **DXF:** keeps the existing `NECK_POCKET` layer name for compatibility while
  using the generated joint outline; custom/unverified
  output carries an `unverified` filename suffix and DXF group-code-999
  non-geometric comment. It must not add note text that CAM software might
  treat as a toolpath.
- **Export UI:** requires acknowledgement before a custom/unverified joint is
  exported.

Legacy output remains byte-stable: do not add print or DXF warnings to legacy
files. Instead, the editor and export UI show a low-key "Legacy generic joint
— compatibility unverified" notice before export. New v7 output carries the
more specific disclosure above.

Joint plan geometry is 2D data. Finished clearance, paint allowance, cutter
strategy, heel thickness and the full 3D stack must not be inferred from the
profile. A glued-joint angle can be carried as supplementary data, but does not
turn the 2D export into a complete angled-mortise template.

## Delivery sequence

This is coordinated at release time but deliberately web-first during contract
discovery.

### Phase 0 — evidence and joint-attachment spike

- Measure or obtain source material for the two initial S/T numeric profiles.
- Write the evidence packets.
- Prototype width edits against every relevant body class, especially
  anchor/handle movement at the mouth.
- Validate the numeric shape generator for square and rounded bolt-on ends.
- Hold a go/no-go review. If neither S nor T has citable or measurable geometry
  evidence, do not convert the bundled blueprints or label a profile
  documented. Retain legacy geometry and its editor/export disclosure while
  evidence work continues. Fender pocket drawings are not broadly published,
  so this is a real release risk rather than a formality.

### Phase 1 — web reference contract

- Draft the v7 section of `docs/AXE_SVG_FORMAT.md`.
- Implement the model, migration, frozen legacy adapter, parametric joint
  generator, neck-placement resolver, validation and SVG/DXF export in the web
  repository.
- Add fixtures and run `corpus:check`, `schema:check`, DXF checks and the full
  web gate.
- Finalize the written contract from this executable reference behavior.

### Phase 2 — iOS parity

- Port the finalized decoder, legacy resolver, parametric joint generation,
  placement resolution, validation, SVG/PDF/DXF output as applicable, and profile
  rendering to `axe-shaper-ios`.
- Add equivalent Swift tests and cross-written fixtures.
- Confirm web-written v7 projects re-export byte-consistently in iOS and
  iOS-written projects do the same in web, allowing only established writer
  normalization.

### Phase 2b — 3D viewer parity

- Update the pinned `axe-shape-3D-viewer` consumer to decode and render the
  v7 parametric joint geometry and neck-placement datum rather than legacy
  `neckPreset` joint/placement fields.
- Add viewer fixtures for v7, legacy and malformed v7 projects.
- Keep the viewer in the same release gate: `check:all` must pass across web,
  iOS and viewer before any v7 blueprint is published.

### Release A — profiles and exports, no custom editing

- Ship the v7 model in both clients.
- Convert only the researched S- and T-style bundled blueprints to documented
  profiles with distinct joint geometry.
- Ship provenance and unverified-export disclosure.
- Resolve and display `neckPlacement`, but keep it locked.
- Keep custom editing unavailable while the contract receives real use.
- Accept the version-floor consequence explicitly: new projects created from
  those updated S/T blueprints require v7. Their release therefore waits for a
  tagged web build, an App Store iOS build and a viewer release that all support
  v7, even though untouched legacy documents still stamp their lowest required
  version.

### Release B — constrained custom joint editing

- Add Convert to Custom Joint and numeric bolt-on/mortise parameters in both
  clients. Do not add nodes, handles or direct joint dragging.
- Add the separately confirmed Custom Neck Placement numeric override and its
  shift preview/physical validation.
- Preserve attachment, validation, undo/redo and cross-platform parity.
- Consider asymmetric expert editing only as a separately researched feature.

## Required tests

Add the following to the web schema/corpus/DXF gates and their iOS equivalents:

- deterministic legacy output for generic and template-specific adapters;
- Release-A S/T migration seeded from the existing placement constants, with
  their current `scaleMathMatrix` corpus rows unchanged within the established
  cross-platform corpus epsilon;
- distinct, source-backed S- and T-style v7 bolt-on geometry;
- web-to-iOS and iOS-to-web v7 round trips;
- v7 viewer decoding/rendering and a `check:all` gate that includes all three
  consumers;
- v7 authority when embedded legacy `neckPreset` joint dimensions disagree
  with generated joint geometry or its `nutToBodyEdgeMm` disagrees with resolved
  `neckPlacement`;
- fixed mouth `Y = 0`, symmetric numeric width changes and translated paired
  handles;
- locked mouth anchors resisting ordinary body edits while a locked profile is
  active;
- numeric width edits moving mouth anchors symmetrically while their handles
  remain non-editable; generated straight side walls and named end treatments;
- straight and tapered mortise generation, including the fact that a stored
  neck angle does not alter the 2D plan shape;
- the neck-angle unit/sign convention and full-precision placement derivation
  across every supported measurement entry path;
- neck-preset changes retaining active v7 joint geometry, and explicit
  construction changes preserving the old state through undo rather than
  overwriting it;
- missing/invalid attachment-anchor IDs;
- malformed numeric values or an impossible generated outline;
- a joint that leaves the body or contacts its perimeter away from the mouth;
- concave corners smaller than the supplied cutter diameter;
- fixed reference fret by instrument type, placement-to-nut derivation, and a
  custom placement shift moving only neck and scale-derived bridge/saddle
  geometry while pickups remain body-relative;
- a joint-geometry edit preserving placement and a placement edit preserving
  numeric joint geometry;
- a current v7 reader receiving a v7-stamped payload with a missing or corrupt
  `neckJointGeometry` or `neckPlacement` object;
- legacy v1-v6 import/re-export stability;
- export warning behavior in SVG, printable SVG, DXF comment/filename and the
  acknowledgement flow.

## Acceptance criteria

The feature is ready only when web, iOS and the 3D viewer resolve the same v7
numeric joint geometry, render it in the correct physical position, and retain
legacy exports unchanged. A user can distinguish documented S and T profiles,
but cannot mistake either for a universal fit guarantee. Custom joint editing
remains symmetric, numeric, anchored, validated and explicitly user-owned.
