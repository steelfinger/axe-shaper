# S-style rounded heel — Phase 0 evidence packet

**Status:** documented candidate; not yet a released `neckJointGeometry`
profile. The source is sufficient for the candidate's plan-view geometry, but
the current v7 `bolt_on_pocket` shape cannot yet represent all of it without
loss. This packet does not claim a fit to every Strat-compatible neck.

## Sources

| Source | Retrieved | What it establishes |
| --- | --- | --- |
| Fender, *Body, Vintage Stratocaster 1962*, part no. `019574`, sheet 1 of 2, release `1-20-82` | 2026-09-28 | A supplied drawing copy identifies the body/pocket, says the pocket is symmetric about the centreline, and dimensions its length, deep-end width limits, side angle, corner radii and 5 in closing arc. SHA-256: `ae8ede99a146eb543193035acfdad557bf00555a2d2460ad29b88f18633eb004`. The copy's provenance has not been independently authenticated. |
| [Warmoth: Guitar Neck Pocket Options](https://warmoth.com/guitar-body-neck-pockets) | 2026-09-27 | Warmoth says its Strat/Tele-style heels and pockets use 2-3/16 in (56mm) width and 3 in (76mm) length; it distinguishes a rounded Strat-style heel from a squared Tele-style heel and warns that the dimensions are not universal. |
| [Musikraft: Heel Width](https://musikraft.com/heel-width/) | 2026-09-27 | A replacement-neck manufacturer defines its default Fender-sized heel as 2-3/16 in (55.56mm), and independently says Strat necks have a rounded base. |
| [Allparts SMNF-VRF replacement neck](https://www.allparts.com/products/allparts-select-licensed-by-fender%C2%AE-aaa-roasted-flame-maple-vintage-spec-replacement-neck-for-stratocaster%C2%AE-nitro-finish-soft-v-shape) | 2026-09-27 | Identified replacement-neck SKU with 2-3/16 in heel width and a round heel shape. |

## Supported facts

| Plan-view fact | Value | Confidence |
| --- | --- | --- |
| Pocket symmetry | Symmetric about centreline | High — Fender drawing note |
| Plan length | 3.000 in +/- 1/32 in = 76.200 mm +/- 0.794 mm | High — Fender drawing |
| Deep-end pocket width | 2.1875--2.2000 in = 55.5625--55.8800 mm | High — Fender drawing; this is a limit range, not an asserted nominal |
| Side taper | 0.84 degree per side, +0/-0.25 degree | High — Fender drawing |
| Mouth-side corner radii | 3/16 in (two) = 4.7625 mm | High — drawing callout; orientation transcribed from the supplied drawing context |
| Deep-end corner radii | 0.250 in (two) = 6.3500 mm | High — drawing callout; orientation transcribed from the supplied drawing context |
| Closing arc | 5.000 in = 127.000 mm | High — Fender drawing |
| Rounded S-style family | Rounded heel rather than T-style square heel | High — Fender drawing plus replacement-neck sources |

## Derived nominal stations — not an extra source measurement

The drawing does not prescribe one nominal deep-end width. For an app profile
we need an explicit target, not a min/max manufacturing limit. The proposed
target below uses the drawing's **maximum** deep-end width and its nominal
0.84 degree side angle:

```
per-side taper = 76.2 mm x tan(0.84 degree) = 1.1172 mm
total taper    = 2 x 1.1172 mm = 2.2344 mm
mouth width    = 55.8800 mm - 2.2344 mm = 53.6456 mm
```

The resulting candidate profile target is `deepEndWidthMm: 55.8800`,
`mouthWidthMm: 53.6456`, `planLengthMm: 76.2000`, with the source radii and
arc above. It is a **chosen fitting target**, not an invented Fender nominal.
If paired with a perfectly matching 2-3/16 in (55.5625 mm) heel, it leaves
0.3175 mm total clearance at the deep end (0.15875 mm per side). That heel
and clearance assumption must be shown to the builder and must not be
presented as a factory fit guarantee.

## Current schema blocker — not an evidence blocker

The base v7 `bolt_on_pocket` shape has one equal `endCornerRadiusMm` and one
`endRoundnessMm`. It cannot faithfully generate this drawing's two different
corner-radius pairs plus its 5 in closing arc. It also starts at the mouth
anchors and does not yet say whether the mouth-corner fillets are generated
joint geometry or attached body-contour geometry.

Before this candidate can be shipped, add and test a named compound bolt-on
shape with explicit `mouthCornerRadiusMm`, `deepCornerRadiusMm`, and
`deepEndArcRadiusMm`, alongside the two width stations and plan length. The
web, iOS and viewer must generate the same tangent-continuous outline and
agree on how its mouth fillets bind to the locked body anchors. Do not quietly
substitute the legacy 6.35 mm rounded-rectangle value or approximate the
127 mm arc with a semicircle.

## Limits and next evidence

The drawing is one body pocket, not a measurement of every replacement neck.
It establishes no neck identity, production revision beyond the drawing, tool
diameter, pocket depth, paint allowance, or real fit result. A later
measurement/fit packet should identify a specific neck and body and record
clearance at both stations before this candidate can be promoted from
**documented** to **verified**.
