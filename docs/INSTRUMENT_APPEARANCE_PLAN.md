# Instrument Appearance: implementation plan

Planning note for moving neck and headstock presentation choices out of the
standalone 3D viewer and into the saved Axe Shaper project. Prepared
2026-09-24 on `codex/instrument-appearance-settings`.

Updated 2026-09-25: defaults are authored in each blueprint `.axe.svg`, and
the headstock catalogue must distinguish Strat-style and T-style shapes.

## Implementation status — 2026-09-25

Completed: schema v6 persistence, blueprint-owned defaults, web and native
editor sheets, and saved rendering for neck finish, fingerboard, cream
fretboard binding, dot/trapezoid inlays, and routed saved headstock choices.
The viewer no longer owns transient neck/fingerboard selections.

The supplied source sheet now provides distinct Strat-style, T-style, and
Explorer traces. Guitar Thunderbird deliberately reuses the Gibson-style
trace; it is no longer offered as a duplicate picker choice, but older saved
`thunderbird` selections remain compatible and resolve to Gibson-style.

## Decision

Add a project-owned **Instrument Appearance** panel, opened from the editor
header beside **View in 3D**. It is a compact modal/sheet, not a fifth
sidebar tab, so it does not change the drawing workspace or displace Hardware,
Layers, or Guide.

The 3D viewer becomes a renderer of the saved choice. It may retain temporary
camera, lighting, and wireframe controls, but it must not own a second,
unsaved copy of instrument appearance. Its appearance controls are replaced by
a read-only summary plus **Edit appearance** returning to the editor (or
removed when that round trip is not practical).

## Scope: v1

Persist one project-root object, deliberately separate from `settings`:

```ts
interface InstrumentAppearance {
  neckFinish: 'natural_maple' | 'body_matched';
  fingerboard: 'maple' | 'rosewood';
  fretboardBinding: boolean; // cream when enabled
  fretboardInlay: 'dots' | 'trapezoids';
  headstockShape: HeadstockShapeId;
}
```

- “Coloured neck” means **body-matched**. There is no independent neck-colour
  picker or `neckColor` field.
- `HeadstockShapeId` is a closed cross-platform vocabulary. Guitar/6 begins
  with `strat_style`, `t_style`, `gibson`, `explorer`, `firebird`,
  `thunderbird`, and `flying_v`; Bass/4 retains its four current families.
  The picker only offers shapes compatible with the document's Guitar/6 or
  Bass/4 axis.
- Strat-style and T-style are distinct models, not aliases of the existing
  generic `fender` shape. Their outlines, tuner placement, and string-tree
  details are part of the shape definition.
- Body-edge `binding` stays untouched. `fretboardBinding` is a different
  visual feature and must never be folded into the existing body-routing/
  binding object.
- Pickup presentation is not user-configurable. Humbuckers always render with
  metal covers; P-90s and single-coils always render with plastic covers.
  Metal covers inherit the global metal finish once that feature ships;
  plastic covers, humbucker rings, and switch tips inherit the global plastic
  colour. There are no per-pickup colour, material, or override fields.
- Headstock, inlays, and fretboard binding are explicitly labelled **3D
  preview appearance — not included in the 2D SVG/DXF cut plan**. The setting
  nevertheless survives Save, Open, Share, and reopening 3D.

`InstrumentAppearance` belongs at the project root, not inside
`ProjectSettings`: the latter contains editor/canvas preferences such as grid,
visibility and units, while this object describes the instrument represented
by the document. Existing `settings.finishStyle`/`bodyColor` remain where they
are for this feature, but their **blueprint defaults** move with the new
appearance defaults into the blueprint files.

## Blueprint-owned defaults

The blueprint `.axe.svg` is the one authoritative starting point for a new
design. Each bundled blueprint therefore carries a full
`instrumentAppearance` object in its embedded project payload, alongside its
existing body geometry, hardware, binding and body-top construction. Selecting
that blueprint copies the object into the new project; Save then preserves the
same object in the user's `.axe.svg`.

This also removes an existing source of split truth: `defaultAppearance`
(`finishStyle`/`bodyColor`) currently lives in `blueprintManifest.ts`, even
though the blueprint file carries the rest of the instrument's authored data.
During implementation, migrate those two defaults into the matching blueprint
payloads, have `templates.ts` derive them from the decoded project, and remove
`defaultAppearance` from the manifest/type. The manifest remains only for
curation metadata such as name, category, description, tier and instrument
type.

## File-format decision

Yes, this requires a schema update: introduce **schema version 6**.

`instrumentAppearance` is required in a v6 document and every newly-authored
blueprint/project writes it. A v3–v5 document has no such object; the resolver
uses its historical template/neck defaults without modifying the payload just
by loading it. On its first intentional appearance save, it becomes v6. This
makes an old editor refuse to edit a document whose saved visual identity it
cannot honour, rather than opening it with unsaved-looking defaults.

Required contract work:

1. Add `InstrumentAppearance`/`HeadstockShapeId` to the shared project model.
   It is required on in-memory v6 projects and optional only at the tolerant
   stored-project boundary for legacy decoding.
2. Raise `PROJECT_SCHEMA_VERSION` to 6 and make
   `requiredSchemaVersion()` return 6 when `instrumentAppearance` is present.
   Document version 6 and default/unknown-value behaviour in
   `docs/AXE_SVG_FORMAT.md`.
3. Migration is default-on-read only for legacy files: an absent object stays
   absent in the payload and resolves visually through a single
   `resolveInstrumentAppearance(project)` helper. Do not eagerly write default
   values into old files; this preserves the existing no-op load/round-trip
   guarantee.
4. Add web migration, export/import, schema-version, and native-fixture tests;
   add equivalent Codable/version policy and round-trip tests in iOS.

## Build sequence

1. **Contract and shape catalogue first — web, iOS, viewer.** Agree the exact
   enum spellings, per-blueprint defaults, compatible headstock lists, and v6
   policy before UI work. Split the generic Fender trace into Strat-style and
   T-style traces. Add traced Explorer and Thunderbird headstocks in both
   renderers; route the already-existing Firebird trace through the new
   persisted field. Extend the viewer mesh pipeline for fretboard binding,
   trapezoid markers, and headstock override, including strings/tuners for the
   selected headstock.
2. **Web persistence.** Implement the model, resolver, factory defaults,
   migration/versioning, SVG embed/decode, and regression checks. Move body
   finish defaults out of `blueprintManifest.ts`, write full defaults to every
   bundled blueprint file, and confirm old files render their current defaults
   byte-for-byte apart from the established migration fields.
3. **Editor UI.** Add the modal entry point by the 3D action. Group controls as
   Neck, Fingerboard, and Headstock; preview the saved selection in its labels.
   Every change uses project undo/redo and normal Save state. Do not add a
   permanent editor column, canvas overlay, or geometry controls here.
4. **Viewer release integration.** Remove/redirect local appearance controls,
   consume the shared object from the hash payload, test opening a saved link,
   cut a viewer release, then bump `viewer3d.version` in this repository.
5. **Cross-platform verification and release.** Add v6 fixture(s) written by
   iOS, run `npm run schema:check`, `npm run fixtures:check`, viewer checks,
   iOS XCTest, and finally `npm run check:all`. Do not tag a web release until
   the shipped iOS build reads and preserves v6.

## Acceptance criteria

- A user selects rosewood/maple, natural/body-matched neck, fretboard binding,
  dots/trapezoids, and a compatible headstock in the editor; each selection
  survives Save/Open/Share and reappears identically in 3D.
- Every bundled blueprint declares its full appearance in its own `.axe.svg`;
  a new design created from it receives those values without a manifest-side
  override.
- Strat-style, T-style, Explorer, Firebird, and Thunderbird have distinct
  headstock identities where their construction warrants one; Firebird uses
  its existing trace rather than being redrawn.
- Loading a v3–v5 project keeps its legacy appearance defaults without adding
  `instrumentAppearance` merely by opening it.
- A v6 document is rejected for editing by an older implementation, while all
  current implementations render the same selected appearance.
- No appearance choice changes body outline, neck-pocket math, scale/bridge
  placement, SVG plan, or DXF output.
