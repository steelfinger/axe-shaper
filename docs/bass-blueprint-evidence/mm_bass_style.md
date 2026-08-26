# MM-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 342.9mm (13.5") | Published Music Man StingRay overall width | High |
| Body length (joint line to tail) | 495mm | **Estimated** — no published body-only length found. StingRay overall instrument length (44-7/8") is ~25mm shorter than a Precision's (45-7/8"); scaled the P-Bass body length down by the same proportion | Low |
| Scale length | 863.6mm (34") | `bass_long_34` (W2) | High |
| Neck pocket | 63.5 × 98.425mm | W2 | High |
| Neck joint | Bolt-on | Real construction | High |
| Pickup type/shape | Humbucker (MM-style), 103.7 × 50.5mm | W2 — published routing-template cavity | High |
| Pickup Y position (186.7mm) | Derived, see below | Real sourced pickup-position data, computed through this app's own coordinate math | **Sourced, derivation shown below** |
| Body outline | Derived from `s_style`, scaled | Not traced — see below | **First draft, not sourced** |

## Pickup position — derivation shown

A published measurement gives the MM pickup centre as 11-5/8" (295.275mm)
from the 12th fret. Converting that into this app's own Y=0-at-joint-line
convention:

```
12th fret distance from nut = getFretDistanceFromNutMm(12, 863.6) = 431.8mm
12th fret Y (joint-line-relative) = 431.8 - nutToBodyEdgeMm(540.1155) = -108.3mm
pickup Y = -108.3 + 295.275 = 186.7mm  (rounded)
```

This is the one pickup position across all eight drafts with a real citation
behind the exact number, not a plausible placement — worth treating as the
most trustworthy single fact in this file.

## Body outline calibration and bounds

Donor: `s_style`, scaled to 342.9mm width × 495mm length (the length figure
itself is estimated — see table above). A real StingRay body has a
noticeably rounder, fuller lower bout than a Strat/S-Style shape; the donor
does not capture that.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 540.1155mm (fret-17 distance, 863.6mm scale). Bolt-on,
matching a real StingRay's 3+1 bolt-on neck (mounting detail not modelled).

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. A real StingRay ships its own
distinctive bridge, not modelled separately (W2 explicitly ships one bass
bridge preset, sourced, rather than several invented ones).

## Pickup routs, pickguard, front/back routes

One `bass_humbucker` rout at the derived Y=186.7mm, unrotated, X=0. No
pickguard or control routes.

## Body thickness and edge treatment

Not modelled; Slab default.

## Approximations, explicitly

- Body length is an estimate scaled from an unrelated overall-instrument-
  length comparison, not a direct measurement — the least confident number
  in this file.
- The contour is a generic donor shape; a real StingRay's rounder lower bout
  is not represented.
