# Neck-joint evidence packets

These packets are the research gate for a released `neckJointGeometry` profile.
They record what a source actually establishes, not what a familiar style name
usually implies.

## Evidence levels

- **Documented** — a named manufacturer drawing or published interface
  specification supplies every stored plan-view parameter.
- **Measured** — a uniquely identified physical neck/body or
  manufacturer-confirmed drawing was measured, with method and results.
- **Verified** — fit evidence exists for the recorded interface.

No profile may be shipped as documented, measured, or verified until its
packet supports every parameter written into `neckJointGeometry`. A source
that establishes only the width/length envelope and qualitative heel family
is useful research, but is not enough to choose a round-end radius or a
tooling-corner radius on the user's behalf.

## Current Phase 0 result — 2026-09-29

Warmoth and Musikraft independently establish the common 2-3/16 in (55.56mm)
Fender-family heel width and the distinct rounded S-style / squared T-style
end families. Warmoth also publishes a 3 in (76.2mm) pocket length.

A supplied copy of the Fender `BODY, VINTAGE STRATOCASTER 1962` body drawing,
part no. `019574`, adds a source-backed S-style result. It dimensions the
pocket's 3 in length, 2.1875--2.2000 in deep-end width limits, 0.84 degree
per-side taper, the two corner-radius pairs, and the 5 in closing arc. See
[`s-style.md`](s-style.md) for the recorded source identity, transcription,
tolerances and the distinction between source dimensions and the app's
proposed fitting target.

This changes the **S-style evidence decision** to *documented, not verified*.
The v7 `compound` end treatment stores the two width stations, 6.35 mm
deep-corner fillets and 127 mm closing arc without loss; web and iOS generate
the same tangent-continuous outline and the viewer validates the contract.
The 3/16 in mouth fillets remain a locked body-template feature because the
pocket is open there. The bundled S blueprint itself stays at version 6 until
the release gate permits raising its iPad reader floor.

**The T-style decision remains no-go.** A current Musikraft 50's/60's Tele
body product independently corroborates a routed four-bolt 3 in × 2-3/16 in
envelope (and .670 in depth). No source in this packet supplies its
inside-corner radius, taper and fitting limits, however. The v1-v6 legacy
adapter therefore remains the only released geometry for both bundled
blueprints.

The next acceptable evidence is one of:

1. a manufacturer CAD/drawing that dimensions the missing radii;
2. a measurement of an identified Allparts, Warmoth, Musikraft, or USA Custom
   Guitars heel, including instrument, revision/SKU, datum, tool/method and
   repeat measurements; or
3. an actual neck-to-pocket fit record for promotion from measured to verified.

### Closed modelling question: bolt-on sides may taper

The Fender drawing confirms that the two S-style sides are straight and taper
symmetrically: 0.84 degree per side, with a +0/-0.25 degree tolerance. A
nominal 76.2 mm pocket therefore changes total width by 2.234 mm. Bolt-on
profiles must retain explicit `mouthWidthMm` and `deepEndWidthMm`; they must
not be flattened to a parallel-sided generic rectangle.
