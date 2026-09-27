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

## Current Phase 0 result — 2026-09-27

Warmoth and Musikraft independently establish the common 2-3/16 in (55.56mm)
Fender-family heel width and the distinct rounded S-style / squared T-style
end families. Warmoth also publishes a 3 in (76.2mm) pocket length. Neither
source publishes the planar radius needed to generate the rounded S-style end
or the cutter-corner radius required to turn a nominally square T-style end
into routable geometry.

Therefore **the Phase 0 profile go/no-go is no-go**: do not convert the
bundled S/T blueprints or label either v7 profile documented yet. The
v1-v6 legacy adapter remains the only released geometry for those blueprints.

The next acceptable evidence is one of:

1. a manufacturer CAD/drawing that dimensions the missing radii;
2. a measurement of an identified Allparts, Warmoth, Musikraft, or USA Custom
   Guitars heel, including instrument, revision/SKU, datum, tool/method and
   repeat measurements; or
3. an actual neck-to-pocket fit record for promotion from measured to verified.
