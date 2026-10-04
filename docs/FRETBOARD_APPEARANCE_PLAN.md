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

`'blocks'` and `'sharkfins'` are the only new values, and they are the one part of this plan that
changes the file format. It is therefore delivered in a separate, release-gated
phase (see *Release phasing*); everything else here is format-neutral.

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
| `r_bass_style` | cream / enabled | sharkfins (dots until phase 2 ships) |
| Every other bundled guitar or bass | disabled | dots |

All basses therefore begin with dots except the R-style bass, which is the
explicit cream-binding/sharkfin-inlay exception once phase 2 is live. Until then
its blueprint carries cream binding and **dots**, so that a new R-style bass
saves at v7 and stays editable on the shipping iPad build. Binding remains available as an
override for every model.

The blueprint `.axe.svg` payload remains the sole source of these defaults.
Do not add a parallel template-ID-to-appearance table in application code.

## Editor behaviour

Keep the controls in the existing **Instrument Appearance** modal:

- Keep the all-model **Cream fretboard binding** checkbox.
- Add **Blocks** and **Sharkfins** alongside Dots and Trapezoids in the
  Fretboard inlays select. Sharkfins covers both the Jackson and the
  Rickenbacker look; there is one option, one geometry.
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
change in phase 1 step 3 also brings the binding mesh to these values.
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

This one geometry serves both the Jackson style and the Rickenbacker bass; they
are the same option, not two. The 3 mm values are nominal and need not be
precise.

Implement blocks as the conventional centered rectangular fretboard inlay,
with the same shallow raised/inset visual treatment used by the existing
marker mesh. Preserve the current binding mesh as a separate physical mesh;
it is not body-edge binding.

## File-format and compatibility policy

Adding `blocks` and `sharkfins` expands a persisted enum. It takes **schema version 8**.

**Version ownership.** A schema version is one number, not a feature set: a
reader that claims "reads v8" must understand *everything* v8 can carry, or it
will pass the gate and then drop what it did not understand on resave. The
deferred output-jacks plan (`OUTPUT_JACKS_SCHEMA_9_PLAN.md`) originally named
Schema 8 as well. Two features cannot share one version, so the rule is:
**whichever ships first owns v8, and the other takes the next number.** Blocks
is the active work, so it owns v8; output jacks has been renumbered to **v9**,
and its stamp check runs before the blocks check.

1. Raise the project-schema ceiling to 8 in web, viewer, and iOS. At this
   version v8 means exactly one thing: `fretboardInlay` may be `'blocks'` or
   `'sharkfins'`.
2. `requiredSchemaVersion` returns 8 only when
   `instrumentAppearance.fretboardInlay` is `'blocks'` or `'sharkfins'`. Every other document
   keeps its ordinary lowest compatible version (normally v7 for a bundled
   design, since it carries the neck-joint contract). Opening or saving in a
   v8-capable editor never upgrades a file.
3. A reader that does not support v8 must reject a blocks or sharkfins document at its
   normal newer-schema gate rather than silently falling back to dots.
4. Version 1-7 documents continue to resolve and preserve their existing
   appearance without eager migration. Absence of `instrumentAppearance`
   continues to use the legacy resolver.

Update the shared web, standalone viewer, and iOS model vocabulary together.
The iOS editor/preview must preserve and render the value so that opening and
resaving a v8 project cannot discard its selected appearance.

## Release phasing

The web goes live only when an App Store version that reads the same format is
live too (CLAUDE.md, *Deploying is a tag*). Raising a read ceiling is safe at
any time; *writing* v8 is not. This plan therefore ships in two phases, and
**no `v*` tag may include phase 2 until an iPad release that reads v8 is
live** (v1.2.0 is the first that reads v7; it does not read v8).

**Phase 1 - format-neutral, can ship on the next tag.** Nothing here can
produce a v8 document.

- cream-binding defaults for the blueprints in the table, with the R-style
  bass authored as binding + **dots**;
- trapezoids rendered as single centered markers at 12/24, with the
  `interval x 0.70` height rule;
- reader support for v8 in the web, viewer, and iOS (ceiling raised, `blocks` and `sharkfins`
  decoded, rendered and preserved). This is inert until something writes it,
  and iOS shipping it first is what unlocks phase 2.

**Phase 2 - writes v8, gated on iOS.**

- the **Blocks** and **Sharkfins** options in the appearance modal, behind a build-time flag that
  is off in any tag cut before the iOS release is live;
- the `r_bass_style` blueprint flipping from dots to sharkfins. This is the change
  that makes every new R-style bass a v8 document, and it is also the point at
  which `svgRoundTrip.test.ts` stops pinning all 20 blueprints at v7: it must
  assert v7 for 19 and v8 for `r_bass_style`.

Staging deploys every push to `main`, so phase 2 code may sit on `main` behind
the flag, but the blueprint flip is the last commit of the feature and waits
for the iOS release rather than riding along with it.

## Implementation sequence

Phase 1 (steps 1-4) first; phase 2 (steps 5-7) only after the iOS gate above.

1. **Agree the contract.** Add `blocks` and `sharkfins` to the web, viewer, and iOS appearance
   models; document schema v8 and version-on-demand stamping in
   `AXE_SVG_FORMAT.md` and `constants/schema.ts`; raise viewer/iOS read
   ceilings.
2. **Author phase-1 blueprint defaults.** Update only the affected bundled
   `.axe.svg` payloads (R-style bass as binding + dots), preserving all
   pre-existing document data; validate that other blueprints remain dots/no
   binding and that every blueprint still saves at v7.
3. **Render.** Extend the viewer's fret-marker builder: single centered
   trapezoids at 12/24, long-marker height derived only from the fret
   interval, and `blocks` / `sharkfins` support (reachable only from a v8 payload at this
   point).
4. **Release phase 1.** Build and publish the viewer, bump `viewer3d.version`
   in the editor repository, and ship iOS with v8 read support.
5. **Expose the selection (flagged).** Add Blocks and Sharkfins to the appearance modal via
   the existing project-update/undo path, behind the build-time flag.
6. **iOS live.** Confirm an App Store release that reads v8 is live, then
   enable the flag.
7. **Flip the R-style bass blueprint to sharkfins** and update the round-trip
   pin. Tag.

## Verification

- Web model/schema tests cover v8 only for blocks and sharkfins (and that no other
  appearance value, including an R-style bass before phase 2, stamps above v7); dots/trapezoids preserve
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
- Cross-platform fixtures prove iOS and web preserve v8, and older reader
  gates refuse it clearly.
- Run the repository schema/fixture checks, viewer test suite, iOS XCTest,
  and the combined `check:all` validation before release.

## Acceptance criteria

- Every model can toggle cream fretboard binding and select dots,
  trapezoids, blocks or sharkfins in the saved appearance panel (blocks and
  sharkfins once phase 2
  is enabled).
- New Single-Cut, Firebird, and SG designs start with cream binding and
  trapezoids; both semi-hollows and Explorer start with cream binding and
  dots; R-style bass starts with cream binding and sharkfins (dots until phase 2); all other bundled
  models start dot/no-binding.
- Existing saved projects retain their prior appearance until the user changes
  it or selects a different blueprint.
- Block, trapezoid and sharkfin markers at frets 12 and 24 are single,
  centered markers whose only Y-axis sizing variable is their local fret
  spacing.
- Inlays are black on maple and bright natural-white shell on rosewood.
- No side markers, printable-plan output, or other 2D/manufacturing geometry
  is added or changed.
