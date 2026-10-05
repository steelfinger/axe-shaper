# Fretboard binding and inlay variants: implementation plan

Planning note for expanding the persisted, **3D-preview-only** instrument
appearance system. Prepared 2026-10-04.

## Decision

The existing root-level `instrumentAppearance` object already owns the
fretboard material, cream fretboard binding, and dot/trapezoid choice. Extend
that object; do not introduce a viewer-local setting or a second appearance
panel.

```ts
interface InstrumentAppearance {
  neckFinish: 'natural_maple' | 'body_matched';
  fingerboard: 'maple' | 'rosewood';
  fretboardBinding: boolean; // cream when enabled
  fretboardInlay: 'dots' | 'trapezoids' | 'blocks' | 'sharkfins';
  headstockShape: HeadstockShapeId;
}
```

`'blocks'` and `'sharkfins'` are the only new values. They need **no schema
version**; see *File-format and compatibility policy*.

The choices are saved with the project, participate in undo/redo, travel in
the self-contained 3D-viewer link, survive Save/Open, and are copied into a
user template. They do **not** affect the 2D editor drawing, SVG/DXF output,
body geometry, or manufacturing dimensions.

## Defaults

Defaults apply when creating a new design from a bundled blueprint and when
switching to a bundled blueprint. They do not rewrite or visually alter an
existing saved project.

| Blueprint/template IDs | Fretboard binding | Inlays |
| --- | ---: | --- |
| `single_cut`, `gibson_firebird`, `sg_style` | cream / enabled | trapezoids |
| `semi_hollow_single_cut`, `semi_hollow_double_cut`, `gibson_explorer` | cream / enabled | dots |
| `r_bass_style` | cream / enabled | sharkfins |
| Every other bundled guitar or bass | disabled | dots |

All basses therefore begin with dots except the R-style bass, which is the
explicit cream-binding/sharkfin-inlay exception. Binding remains available as an
override for every model.

The blueprint `.axe.svg` payload remains the sole source of these defaults.
Do not add a parallel template-ID-to-appearance table in application code.

## Editor behaviour

Keep the controls in the existing **Instrument Appearance** modal:

- Keep the all-model **Cream fretboard binding** checkbox.
- Add **Blocks** and **Sharkfins** alongside Dots and Trapezoids in the
  Fretboard inlays select; each is a single option with a single geometry.
- Retain the existing 3D-preview-only copy, so users understand that this is
  intentionally absent from their printable plan.

No side markers are rendered or configured.

## 3D rendering

### Materials

Use the established appearance rule for every inlay shape:

- maple fretboard: black inlays;
- rosewood fretboard: shiny natural-white shell inlays.

Fretboard binding remains cream. Its low contrast against maple is expected
and intentional.

### Marker placement and shape rules

The normal marker-fret set is unchanged. Dots retain their current special
double-dot layout at the 12th and 24th frets.

Blocks, trapezoids and sharkfins instead render **one centered inlay at every marked
fret**, including the 12th and 24th. They must not become a pair at those
frets and must have no unique 12th/24th shape or dimensions.

For a marker in fret interval `n`, calculate its centre at the midpoint
between fret `n - 1` and fret `n`. Its height on the neck axis is derived only
from that interval's fret spacing:

```text
interval = distanceToFret(n) - distanceToFret(n - 1)
inlayHeightY = interval × 0.70
```

The 70% factor leaves equal visual clearance at both fret wires. It is shared
by blocks, trapezoids and sharkfins; no cap, minimum, marker-number exception, or
fretboard-width term may alter the Y-axis height.

**Sharkfins use their own, tighter rule** (below) for both axes. The
height and width rules in this paragraph and the next apply to blocks and
trapezoids.

**Width (X axis).** Blocks and trapezoids share one width rule: leave
**8 mm of clearance on each side, measured from the fingerboard's physical
edge**.

```text
fretboardWidth = fingerboard width at the marker's centre Y
inlayWidthX    = fretboardWidth - 2 x 8 mm
```

The fingerboard widens toward the body, so the width is evaluated at the
marker's own centre, not at the nut or a fixed fret. The 8 mm is a constant,
not a fraction, so the side clearance is the same on every fret and on both
instruments.

The physical edge is the outer edge of the fingerboard, which is where the
binding sits: binding is carved out of the board's own width, not added to it.
The inlay width is therefore **identical with binding on or off**; the binding
occupies the outermost 1 mm of the 8 mm clearance and leaves 7 mm of bare
wood beside the inlay. A block is a rectangle of `inlayWidthX x inlayHeightY`.

A trapezoid has the same overall width and height. Its **bottom nodes are
taken in by 4 mm** on each side, where "bottom" is the edge toward the
bridge and "top" the edge toward the nut, so the bottom edge is
`inlayWidthX - 2 x 4 mm` wide while the top edge is the full `inlayWidthX`.
The taper is therefore a fixed 4 mm per side on every marker, not a ratio.

**Binding dimensions.** The cream binding is **1 mm wide and 3 mm deep**
(full board thickness at the edge). The viewer's current
`buildFretboardBinding` draws a 1.5 mm strip 0.16 mm thick, so the viewer
change in step 3 also brings the binding mesh to these values.
Binding is unchanged in its other respects: cream, a separate physical mesh,
inset within the fingerboard width.

**Sharkfins.** A right triangle, one centered per marked fret (including the
12th and 24th, like the other long inlays). It is sized by a single 3 mm
clearance on every side, not by the 70% rule:

```text
inlayHeightY = interval - 2 x 3 mm                 (3 mm from each fret centreline)
inlayWidthX  = fretboardWidth(centre) - 2 x 3 mm   (3 mm from each physical edge)
```

Seen from above with the nut at the top and the bass side on the left, its
three corners are:

- **top-left** (nut side, bass edge): the upper acute point;
- **bottom-left** (bridge side, bass edge): the **right angle**;
- **bottom-right** (bridge side, treble edge): the lower acute point.

So the vertical leg runs along the bass edge, the **flat leg is the edge
nearer the bridge**, and the hypotenuse runs from the nut-side bass corner to
the treble-side bridge corner, leaving the sharp point on the treble side. The
shape is a plain straight-edged triangle; the hypotenuse is not curved. The
same orientation applies on bass and guitar necks, and is not mirrored for
left-handed instruments in the preview.

The 3 mm values are nominal and need not be
precise.

Implement blocks as the conventional centered rectangular fretboard inlay,
with the same shallow raised/inset visual treatment used by the existing
marker mesh. Preserve the current binding mesh as a separate physical mesh;
it is not body-edge binding.

## File-format and compatibility policy

**No schema version change.** `blocks` and `sharkfins` are two more values of
the existing, open `instrumentAppearance.fretboardInlay` string (schema v6).
A save stamps the version the document already needs (`requiredSchemaVersion`
is unchanged: normally 7 for a bundled design).

This is safe because every reader treats the field as an open string:

- **iOS** stores it as a `String`, keeps an unknown value verbatim on a
  round-trip, and draws anything that is not `"trapezoids"` as dots. An iPad
  build that predates these inlays opens, edits and resaves the file; it only
  shows dots in its 3D preview. Nothing is lost.
- **The web app** does not validate the value at runtime.
- **The viewer** is bundled with the web build and updates with it.

Raising the version would instead *strand* those files on older readers for a
purely cosmetic field. The rule that a new version must not be stamped when
an old reader copes is the one in `docs/AXE_SVG_FORMAT.md` ("A save stamps
the version it needs"), applied here.

Two obligations follow, and replace the version gate:

1. A writer must **preserve an inlay value it does not recognise**, never
   coerce it to `dots`.
2. The iOS inlay picker must not discard an unknown value when it is merely
   displayed (it currently has `dots` and `trapezoids` tags only).

**Verified (2026-10-05):** `fretboardInlay` is a plain `String` in both the
released App Store iPad build and the current iOS source, so the policy above
holds. Had it been a closed enum, an unknown value would fail to open and the
version gate would have been needed.

Versions 1-7 documents continue to resolve and preserve their existing
appearance without migration. Absence of `instrumentAppearance` continues to
use the legacy resolver.

## Implementation sequence

Status (2026-10-05): steps 1-5 are done except the final tag. Web, viewer
(`v0.1.21`) and iOS ship the same geometry, the contract is synced across all
three repos and `npm run check:all` passes. Remaining: cut the editor `v*` tag
once an iPad release containing step 4 is live, and add the viewer material
tests listed under *Verification*.

1. **Web: model and selector.** Add `blocks` and `sharkfins` to the web
   appearance type and the Fretboard inlays select; document the open-string
   rule in `AXE_SVG_FORMAT.md`.
2. **Web: blueprint defaults.** Update only the affected bundled `.axe.svg`
   payloads (`r_bass_style` to cream binding + sharkfins), preserving all
   other document data; every blueprint still saves at v7.
3. **Viewer.** Single centered long markers at 12/24, the height and width
   rules, sharkfins, and the 1 mm x 3 mm binding mesh.
4. **iOS.** Render `blocks` and `sharkfins` and the new trapezoid/binding
   geometry, offer them in the inlay picker, and preserve unknown values.
5. **Contract sync and release.** Sync the blueprints and mesh corpus into the
   viewer once iOS renders the same geometry, publish the viewer, bump
   `viewer3d.version`, then tag.

## Verification

Open items: the viewer material tests (black on maple, shell on rosewood) are
not written, and the rosewood marker colour `#e8e3d5` has not been checked
against "bright natural-white shell". The mesh corpus has no inlay-variant or
binding parts, so web/viewer/iOS parity for those shapes rests on each
repository's own unit tests.

- Web schema tests assert that `blocks` and `sharkfins` do **not** raise the
  stamp (6 alone, 7 with the joint pair); dots/trapezoids preserve
  their prior schema stamping.
- Blueprint tests assert the exact defaults in the table and that a template
  switch replaces the former project appearance with its authored default.
- Save/Open, undo/redo, user-template, and compressed 3D-link tests preserve
  `blocks`, `sharkfins` and binding.
- Viewer mesh tests verify `inlayWidthX = fretboardWidth(centre) - 16 mm` for
  blocks and trapezoids with binding on and off, and a trapezoid bottom edge exactly 8 mm narrower
  than its top edge;
- Viewer mesh tests verify a sharkfin's height is `interval - 6 mm`, its
  width `fretboardWidth(centre) - 6 mm`, its flat edge is toward the bridge and
  its sharp point is on the treble side;
- Viewer mesh tests verify one centered block/trapezoid/sharkfin at frets 12 and 24,
  unchanged paired dot positions, and `inlayHeightY = interval × 0.70` at
  every marked fret.
- Viewer material tests cover black maple markers and bright shell markers on
  rosewood for all three styles.
- Cross-platform fixtures prove iOS and web preserve `blocks` and `sharkfins`
  on a round-trip, and that an unrecognised inlay string survives unchanged.
- Run the repository schema/fixture checks, viewer test suite, iOS XCTest,
  and the combined `check:all` validation before release.

## Acceptance criteria

- Every model can toggle cream fretboard binding and select dots,
  trapezoids, blocks or sharkfins in the saved appearance panel.
- New Single-Cut, Firebird, and SG designs start with cream binding and
  trapezoids; both semi-hollows and Explorer start with cream binding and
  dots; R-style bass starts with cream binding and sharkfins; all other bundled
  models start dot/no-binding.
- Existing saved projects retain their prior appearance until the user changes
  it or selects a different blueprint.
- Block, trapezoid and sharkfin markers at frets 12 and 24 are single,
  centered markers whose only Y-axis sizing variable is their local fret
  spacing.
- Inlays are black on maple and bright natural-white shell on rosewood.
- No side markers, printable-plan output, or other 2D/manufacturing geometry
  is added or changed.
