# S-style rounded heel — Phase 0 evidence packet

**Status:** research only; not a released `neckJointGeometry` profile.

## Sources

| Source | Retrieved | What it establishes |
| --- | --- | --- |
| [Warmoth: Guitar Neck Pocket Options](https://warmoth.com/guitar-body-neck-pockets) | 2026-09-27 | Warmoth says its Strat/Tele-style heels and pockets use 2-3/16 in (56mm) width and 3 in (76mm) length; it distinguishes a rounded Strat-style heel from a squared Tele-style heel and warns that the dimensions are not universal. |
| [Musikraft: Heel Width](https://musikraft.com/heel-width/) | 2026-09-27 | A replacement-neck manufacturer defines its default Fender-sized heel as 2-3/16 in (55.56mm), and independently says Strat necks have a rounded base. |
| [Allparts SMNF-VRF replacement neck](https://www.allparts.com/products/allparts-select-licensed-by-fender%C2%AE-aaa-roasted-flame-maple-vintage-spec-replacement-neck-for-stratocaster%C2%AE-nitro-finish-soft-v-shape) | 2026-09-27 | Identified replacement-neck SKU with 2-3/16 in heel width and a round heel shape. |

## Supported facts

| Plan-view fact | Value | Confidence |
| --- | --- | --- |
| Mouth / heel width | 55.56mm nominal (2-3/16 in) | High — two replacement-neck manufacturers; Allparts SKU corroborates |
| Plan length | 76.2mm nominal (3 in) | High — published by Warmoth |
| End family | Rounded S-style | High — Warmoth, Musikraft, and Allparts agree |

## Missing facts — profile blocker

The v7 `bolt_on_pocket` needs a numeric `endRoundnessMm` to create the
actual bottom of the pocket. The sources above name the heel family but do not
dimension that radius or publish a trace/CAD outline. They also do not provide
manufacturing tolerance or a specific fitting clearance.

The existing app value of 6.35mm is a legacy rounded-rectangle parameter; it
is **not** evidence for an S-style profile and must not be copied into one.

## Required next measurement

Measure a named, unmodified rounded replacement neck heel on a flatbed scan,
CMM, or calibrated top-down photo. Record SKU/revision, width at the mouth,
width at the deep end, joint-line-to-deep-end length, actual end
geometry/radius, measurement uncertainty, and whether the measured neck has
ever been fitted or sanded. Both widths matter: a preliminary, non-authoritative
Warmoth-community measurement suggests a Fender-family pocket may taper.
Only then can this packet nominate a numeric profile snapshot.
