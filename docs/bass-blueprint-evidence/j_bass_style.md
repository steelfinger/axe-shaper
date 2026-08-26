# J-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 355.6mm (14") | Published Jazz Bass lower-bout width (multiple corroborating sources) | High |
| Body length (joint line to tail) | 511mm | Inferred from a published minimum build-blank length (20.5") for a Jazz Bass body, not a direct "finished body" figure | Medium |
| Scale length | 863.6mm (34") | `bass_long_34` (W2) | High |
| Neck pocket | 63.5 × 98.425mm | W2 | High |
| Neck joint | Bolt-on | Real construction | High |
| Pickup type/shape | J single-coil, 93.4 × 21.3mm | W2 — pickup dimension + 2mm clearance | High |
| Pickup Y positions (220mm neck, 320mm bridge) | Two J single-coils, neck nearer the pocket, bridge nearer the tail | **Not independently sourced** — plausible relative placement, not measured | **Estimated** |
| Body outline | Derived from `s_style`, scaled | Not traced — see below | **First draft, not sourced** |

## Body outline calibration and bounds

Donor: `s_style`, scaled to 355.6mm width × 511mm length, pocket anchors
snapped to (∓31.75, 0). A real Jazz Bass body is narrower through the waist
and has a more symmetric horn pair than a Precision's single-lower-horn
emphasis; the donor shape does not capture that distinction — both
`p_bass_style` and `j_bass_style` currently share the same donor and differ
only in overall scale, which is the single biggest thing to fix by hand.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 540.1155mm (fret-17 distance, 863.6mm scale). Bolt-on,
matching a real Jazz Bass.

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. Note a real Jazz Bass's narrower
38.1mm nut and different bridge string spacing from a Precision's are **not**
modelled separately — both P-Style and J-Style currently share
`nutStringSpacingMm`/`stringSpacingMm` values from the same generic bass
catalogue entries (W2), which is a simplification worth revisiting once
per-model hardware variation matters.

## Pickup routs, pickguard, front/back routes

Two `bass_j_single_coil` routs, Y=220mm (neck) and Y=320mm (bridge),
unrotated, X=0. No pickguard or control routes — a real Jazz Bass's
pickguard covers most of the front face and is a meaningful piece of missing
geometry here, more so than for most of the other seven.

## Body thickness and edge treatment

Not modelled; Slab default.

## Approximations, explicitly

- Body length is inferred from a build-blank minimum, not a direct
  finished-body figure.
- The contour is identical in shape to P-Style, only rescaled — a real J-Bass
  body is proportioned differently and this is the most visible gap to close
  by hand.
- Pickup Y-positions are plausible, not measured.
