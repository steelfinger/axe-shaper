# Neck pocket interface profiles: coordinated web + iOS plan

Planning note, 2026-09-26. This is a schema-first, two-client migration for
accurate, editable guitar neck-pocket geometry. It deliberately does not yet
change runtime behavior.

## Decision

Treat a neck pocket as a first-class **interface profile**, separate from both
the body style and the selected neck's scale/fret data. A profile owns the
two-dimensional pocket outline and its evidence. A parallel `neckPlacement`
datum owns where the body joint line meets the scale; the neck preset continues
to own scale length and fret data.

The first release supports only symmetric pockets. A custom pocket is
possible, but only after a deliberate conversion from a locked profile. This
avoids presenting a manufacturing-critical joint as an ordinary freeform body
curve.

## Why this is needed

The current fields (`jointWidthMm`, `jointDepthMm`, and
`jointCornerRadiusMm`) can only draw one rounded rectangle. In particular,
the current S-style and T-style presets both resolve to 55.56 mm x 76.2 mm
with a 6.35 mm radius. That representation cannot express the different heel
end treatments of a documented S-style rounded interface and a traditional
T-style square-ended interface.

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

1. Fender-compatible S-style, rounded heel.
2. Fender-compatible T-style, square heel.

All other guitar profiles remain legacy in the first release. Bass profiles
also remain legacy; a later Custom Pocket flow may seed from the existing
63.5 mm x 98.425 mm bass geometry, but must not make a compatibility claim.

## v7 document contract

Add paired project-root `neckPocket` and `neckPlacement` objects. A document
requires schema version 7 when these v7 interface objects are present, and a
valid v7 document carries both; neither object is a valid stand-alone partial
upgrade. Existing v1-v6 files retain their stored version and legacy output
when untouched.

The final field names are to be written in `docs/AXE_SVG_FORMAT.md` after the
web reference implementation proves them. The object must nevertheless cover:

- a `profileId`; locked pockets carry an immutable embedded profile snapshot
  for repeatable saves, while custom pockets carry `derivedFromProfileId` and
  their own mutable path;
- mode: `locked` or `custom`;
- construction/mechanism and evidence/provenance metadata;
- a canonical symmetric pocket path, including the mouth points, paired
  outline nodes and mirrored Bézier handles;
- IDs of the two body-contour anchors forming the mouth;
- optional target heel width, requested fitting clearance, and cutter diameter
  for custom pockets.

`neckPlacement` is deliberately not part of `neckPocket`. It records the
scale-critical position independently of heel outline and has:

- mode: `profile` or `custom`;
- the fixed cross-platform reference fret: 22 for guitar and 20 for bass;
- `jointToReferenceFretMm`, the signed centreline distance from the body joint
  line (`Y = 0`) to that reference fret;
- source/provenance for its profile value.

For a known scale, this datum is the authoritative way to derive
`nutToBodyEdgeMm`. It replaces neither the scale length nor the physical pocket
path. The reference-fret number is stored for auditability but is not a casual
user preference: it must match the instrument-type contract.

The stored geometry must be an explicit path rather than a radius shortcut.
The decoder generates the complete closed outline deterministically from its
canonical symmetric representation. This makes mirror topology inspectable,
keeps the centreline exact, and avoids web/iOS drift from independent
rounded-rectangle approximations.

### Schema compatibility rules

- A v1-v6 project with no `neckPocket` resolves through a **frozen legacy
  adapter**. That adapter covers both generic and per-template pocket specs.
- The legacy adapter's generated outline is pinned in the golden corpus and
  must never change an untouched legacy export.
- A v7 project without valid `neckPocket` and `neckPlacement` objects is
  malformed and rejected.
- Continue the existing policy for future schemas: reject them at the editable
  project gate. Do not introduce a partial read-only future-profile mode.
- An older client cannot safely edit a v7 file. Tests must cover a v7 payload
  whose `neckPocket` or `neckPlacement` was stripped or corrupted and
  demonstrate a loud, deterministic rejection rather than a silent legacy
  fallback.

For v7, `neckPocket` is authoritative for pocket rendering, validation and
export. `neckPlacement` is authoritative for the body-to-scale datum. The
`joint*` and `pocket*` fields embedded in `neckPreset` remain legacy-compatible
mirrors only: writers derive their bounding dimensions from the resolved path,
derive `nutToBodyEdgeMm` from the resolved placement, and v7 readers do not use
these fields to resolve either answer. The 3D viewer must read both v7 objects;
it cannot continue treating those mirrors as its joint geometry.

Validation is deliberately not persisted as truth. Every current client
recomputes it on load, edit, preview and export; provenance is stored, but a
saved `valid` flag could become stale after an external edit.

## Pocket attachment and constraints

The pocket has its own symmetry contract. It is independent of the body's
`live_centerline` setting and cannot be weakened by turning body symmetry off.

For a valid symmetric pocket:

- Its two mouth anchors are the body anchors with semantic roles
  `neck_pocket_left` and `neck_pocket_right`, recorded by ID in the profile.
- Both anchors are constrained to the neck-pocket joint line, `Y = 0`.
- Changing pocket width moves the two anchors to `-width / 2` and `+width / 2`
  in one undo transaction.
- The paired anchors' Bézier handles translate by the same X delta, preserving
  their local curve geometry.
- Pocket nodes and handles mirror around `X = 0`; adding or editing one side
  creates or updates its partner.
- The pocket must be closed, finite, non-self-intersecting, and remain inside
  the body except for the two mouth points on the perimeter.
- When the pocket mode is `locked`, the two mouth anchors are locked against
  independent body editing. This keeps a freely editable body from drifting
  away from an immutable profile.

If a template does not have a valid, unambiguous pair of mouth anchors,
pocket-width editing is unavailable. The app must never infer shoulder anchors
from visual proximity. This attachment behavior is the highest-risk geometry
piece and is prototyped before the contract is finalized; it must cover bodies
whose contour treatment at `Y = 0` differs from Fender-style horns.

There is no app-wide numeric width range. If target heel width is known, the
minimum valid pocket width is that value plus the requested clearance. If it
is not known, a Custom Pocket remains valid only within the selected profile's
explicit authored bounds; if the profile supplies no bounds, width editing is
disabled until the user enters a target heel width. This avoids silently
falling back to an arbitrary global range.

For a custom pocket with a supplied cutter diameter, each concave internal
corner must have a radius at least as large as that cutter diameter. The app
may report this as a fabrication warning or an export-blocking validation
failure according to the chosen cutter strategy; it must never claim that an
impossible inside corner is routable.

Asymmetric pockets, free movement of the two mouth nodes in Y, and a body
without mapped attachment anchors are explicit non-goals for this release.

## Neck placement and scale

`jointToReferenceFretMm` is not a cosmetic pocket dimension. Changing it moves
the body along the neck's scale relationship and can relocate scale-linked
bridge/reference geometry relative to the body. It must therefore never be a
free canvas drag.

Release A resolves this datum from the profile/blueprint and keeps it locked.
Release B may offer **Custom Neck Placement** as a numeric, measurement-led
override. Its primary builder-facing input may be either "Joint line to
reference fret" or "Nut to body joint line"; the other value is derived from
the chosen scale and displayed for cross-checking.

Before accepting a custom placement change, both clients show the signed shift
in scale-linked hardware and validate bridge/body bounds, pickup and
fingerboard-overhang clearance, and any other affected physical constraints.
Changing a pocket outline alone preserves `neckPlacement`; changing neck
placement alone preserves the pocket outline. Both operations are separately
undoable.

## Neck and joint selection

Picking another neck preset must never overwrite a v7 `neckPocket`: it changes
only scale/fret data and other neck-owned information. It preserves the
resolved `neckPlacement` unless the user explicitly enters Custom Neck
Placement. The old
`neckPresetFieldsForTemplate` generic/template resolver is a legacy-v1-v6
path, not a v7 override.

Changing between bolt-on and glued construction is a material interface
change. It requires an explicit choice to replace the pocket with a compatible
locked profile or create a compatible custom pocket; the app must not silently
carry an incompatible profile across, discard a custom path, or overwrite it
with generic geometry. The prior state remains recoverable through undo.

## Product flow

The Hardware panel receives a Neck Pocket card.

1. It presents the chosen locked profile, outline/end treatment, dimensions,
   evidence level, provenance and compatibility scope.
2. The default profile and its two body-mouth anchors are locked. Its pocket is
   visible but has no ordinary node editing affordances.
3. **Convert to Custom Pocket** makes one explicit undoable copy and asks for
   target heel width, desired fitting clearance and cutter/tool diameter where
   known.
4. The first custom controls are constrained pocket width and depth.
5. **Edit pocket outline** is a separate advanced action that exposes mirrored
   nodes and handles; it does not permit breaking pocket symmetry.

On the canvas, locked pockets retain the existing gold/locked visual language.
Custom pockets expose constrained dimensional handles only while the user is
in their dedicated edit mode. The UI makes it clear that body live symmetry
does not control this pocket symmetry.

Release A shows the resolved neck-placement datum as read-only context. Release
B adds **Custom Neck Placement** as a separate advanced flow; it is numeric,
shows the predicted scale-linked shift before confirmation, and has no direct
canvas-drag affordance.

Custom is not an error. It receives a quiet "Verify against the physical neck"
state. Invalid geometry, on the other hand, blocks export.

## Export and disclosure

Every exporter reads the resolved explicit outline for v7 and the frozen
legacy adapter for older documents.

- **SVG payload:** stores evidence/provenance and the authoritative
  `neckPocket` object. Validation is recomputed by the reader.
- **Printable SVG:** puts an unverified-pocket note outside cut geometry and
  retains the metadata.
- **DXF:** uses the explicit outline on `NECK_POCKET`; custom/unverified
  output carries an `unverified` filename suffix and DXF group-code-999
  non-geometric comment. It must not add note text that CAM software might
  treat as a toolpath.
- **Export UI:** requires acknowledgement before a custom/unverified pocket is
  exported.

Legacy output remains byte-stable: do not add print or DXF warnings to legacy
files. Instead, the editor and export UI show a low-key "Legacy generic pocket
— compatibility unverified" notice before export. New v7 output carries the
more specific disclosure above.

Pocket outline is 2D data. Finished clearance, paint allowance, cutter
strategy, neck angle, heel thickness and the full 3D stack must not be inferred
from the profile. They remain separate future manufacturing data.

## Delivery sequence

This is coordinated at release time but deliberately web-first during contract
discovery.

### Phase 0 — evidence and attachment spike

- Measure or obtain source material for the two initial S/T outlines.
- Write the evidence packets.
- Prototype width edits against every relevant body class, especially
  anchor/handle movement at the mouth.
- Decide the canonical symmetric path representation from observed behavior.
- Hold a go/no-go review. If neither S nor T has citable or measurable outline
  evidence, do not convert the bundled blueprints or label a profile
  documented. Retain legacy geometry and its editor/export disclosure while
  evidence work continues. Fender pocket drawings are not broadly published,
  so this is a real release risk rather than a formality.

### Phase 1 — web reference contract

- Draft the v7 section of `docs/AXE_SVG_FORMAT.md`.
- Implement the model, migration, frozen legacy adapter, pocket-path generator,
  neck-placement resolver, validation and SVG/DXF export in the web repository.
- Add fixtures and run `corpus:check`, `schema:check`, DXF checks and the full
  web gate.
- Finalize the written contract from this executable reference behavior.

### Phase 2 — iOS parity

- Port the finalized decoder, legacy resolver, path generation, placement
  resolution, validation, SVG/PDF/DXF output as applicable, and profile
  rendering to `axe-shaper-ios`.
- Add equivalent Swift tests and cross-written fixtures.
- Confirm web-written v7 projects re-export byte-consistently in iOS and
  iOS-written projects do the same in web, allowing only established writer
  normalization.

### Phase 2b — 3D viewer parity

- Update the pinned `axe-shape-3D-viewer` consumer to decode and render the
  v7 pocket path and neck-placement datum rather than legacy `neckPreset`
  joint/placement fields.
- Add viewer fixtures for v7, legacy and malformed v7 projects.
- Keep the viewer in the same release gate: `check:all` must pass across web,
  iOS and viewer before any v7 blueprint is published.

### Release A — profiles and exports, no custom editing

- Ship the v7 model in both clients.
- Convert only the researched S- and T-style bundled blueprints to documented
  profiles with distinct outlines.
- Ship provenance and unverified-export disclosure.
- Resolve and display `neckPlacement`, but keep it locked.
- Keep custom editing unavailable while the contract receives real use.
- Accept the version-floor consequence explicitly: new projects created from
  those updated S/T blueprints require v7. Their release therefore waits for a
  tagged web build, an App Store iOS build and a viewer release that all support
  v7, even though untouched legacy documents still stamp their lowest required
  version.

### Release B — constrained custom editing

- Add Convert to Custom Pocket, constrained width/depth editing and mirrored
  outline editing in both clients.
- Add the separately confirmed Custom Neck Placement numeric override and its
  shift preview/physical validation.
- Preserve attachment, validation, undo/redo and cross-platform parity.
- Consider asymmetric expert editing only as a separately researched feature.

## Required tests

Add the following to the web schema/corpus/DXF gates and their iOS equivalents:

- deterministic legacy output for generic and template-specific adapters;
- distinct, source-backed S- and T-style v7 pocket outlines;
- web-to-iOS and iOS-to-web v7 round trips;
- v7 viewer decoding/rendering and a `check:all` gate that includes all three
  consumers;
- v7 authority when embedded legacy `neckPreset` pocket dimensions disagree
  with the explicit path or its `nutToBodyEdgeMm` disagrees with resolved
  `neckPlacement`;
- fixed mouth `Y = 0`, symmetric X drag and translated paired handles;
- locked mouth anchors resisting ordinary body edits while a locked profile is
  active;
- mirrored node insertion, drag and handle edits;
- neck-preset changes retaining the active v7 pocket, and explicit construction
  changes preserving the old state through undo rather than overwriting it;
- missing/invalid attachment-anchor IDs;
- a malformed or self-intersecting outline;
- a pocket that leaves the body or contacts its perimeter away from the mouth;
- mismatched mirror pairs or non-mirrored handles;
- concave corners smaller than the supplied cutter diameter;
- fixed reference fret by instrument type, placement-to-nut derivation, and a
  custom placement shift moving all scale-linked geometry by the same amount;
- a pocket edit preserving placement and a placement edit preserving the
  pocket path;
- a current v7 reader receiving a v7-stamped payload with a missing or corrupt
  `neckPocket` or `neckPlacement` object;
- legacy v1-v6 import/re-export stability;
- export warning behavior in SVG, printable SVG, DXF comment/filename and the
  acknowledgement flow.

## Acceptance criteria

The feature is ready only when web, iOS and the 3D viewer resolve the same v7
pocket path, render it in the correct physical position, and retain legacy
exports unchanged. A user can distinguish documented S and T profiles, but
cannot mistake either for a universal fit guarantee. Custom pocket editing
remains symmetric, anchored, validated and explicitly user-owned.
