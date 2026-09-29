# T-style squared heel — Phase 0 evidence packet

**Status:** research only; not a released `neckJointGeometry` profile.

## Sources

| Source | Retrieved | What it establishes |
| --- | --- | --- |
| [Warmoth: Guitar Neck Pocket Options](https://warmoth.com/guitar-body-neck-pockets) | 2026-09-27 | Warmoth publishes the shared 2-3/16 in (56mm) × 3 in (76mm) Strat/Tele-style pocket envelope and identifies the Tele-style heel as squared. It explicitly warns that the dimensions are not universal. |
| [Musikraft: Heel Width](https://musikraft.com/heel-width/) | 2026-09-27 | Musikraft independently calls 2-3/16 in (55.56mm) its Fender-sized guitar heel and says Tele necks have a squared-off base. |
| [Musikraft: 50's / 60's Style Tele body](https://musikraft.com/product/tele-body/) | 2026-09-29 | Musikraft publishes a routed, four-bolt Tele body pocket at 3 in × 2-3/16 in × .670 in deep. This corroborates the plan-view envelope on an actual body product, but does not dimension its inside corners or side taper. |

## Supported facts

| Plan-view fact | Value | Confidence |
| --- | --- | --- |
| Mouth / heel width | 55.56mm nominal (2-3/16 in) | High — Warmoth and Musikraft |
| Plan length | 76.2mm nominal (3 in) | High — published by Warmoth |
| End family | Squared T-style | High — Warmoth and Musikraft |
| Pocket depth | 17.018mm nominal (.670 in) | High — Musikraft body product; depth is outside the v7 plan-view contract |

## Missing facts — profile blocker

A real routed square-ended pocket still has internal cutter corners. The v7
shape must therefore know the actual `endCornerRadiusMm`; `0mm` would make a
visually square outline but an impossible routing claim. Neither cited source
dimensions the relevant cutter/inside-corner radius, taper, fit allowance, or
manufacturing tolerance.

The existing 6.35mm legacy corner radius is not a published T-style interface
specification and must not be promoted to one.

## Required next measurement

Measure a named, unmodified square-heel replacement neck or its matching
manufacturer pocket template. Record SKU/revision, mouth width, plan length,
deep-end width, each deep-end inside-corner radius, any side taper,
measurement uncertainty, and the measurement datum. A fitted body alone is
not sufficient unless the neck identity and resulting clearance are recorded
too.
