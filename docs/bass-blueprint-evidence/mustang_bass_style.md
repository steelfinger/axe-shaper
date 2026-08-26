# Mustang-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology. Its body
length figure is the single best-sourced number of all eight drafts.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body length (joint line to tail) | 431.8mm (17") | A TalkBass measurement explicitly described as "from the end of the neck pocket to the bottom of the body" — this is *exactly* this app's own Y=0-to-tail convention, not a figure needing reinterpretation | **High — best-matched figure of any blueprint** |
| Body width | 305mm (12") | Same source, "widest part of the lower bout is just over 12 inches" | Medium |
| Scale length | 762mm (30") | `bass_short_30` (W2), matches the plan's own sourcing table and Fender's own 30" Mustang Bass spec | High |
| Frets | 19 | Sourced at W2 for `bass_short_30` (a real Mustang Bass has 19 frets) | High |
| Neck pocket | 63.5 × 98.425mm | W2 | High |
| Neck joint | Bolt-on | Real construction (a real Mustang Bass is also string-through-body with a 7-bolt bridge plate, neither of which is modelled) | High for the mechanism; unmodelled detail beyond that |
| Pickup type/shape | `bass_split_coil`, 57.91 × 29.21mm | W2 catalogue; the original 1966 Mustang Bass shipped one split-coil humbucking pickup, matching this choice | High |
| Pickup Y position (230mm) | Not sourced | Plausible single-pickup placement, roughly centred in the lower two-thirds of the body | **Estimated** |
| Body outline | Derived from `jag_style`, scaled | Not traced — see below | **First draft, not sourced** |

## Body outline calibration and bounds

Donor: `jag_style` (offset Fender-family guitar), scaled to 305mm width ×
431.8mm length. A real Mustang body is more compact and rounder than a
Jaguar's; the donor's sharper offset horns are not a close match to the
Mustang's softer, smaller-bodied silhouette.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 476.5725mm — the fret-17 distance on a 762mm (30") scale.
Bolt-on, matching the real instrument's mechanism (not its 7-bolt/string-
through specifics, which are unmodelled).

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. A real Mustang Bass's string-through
7-bolt bridge is a genuinely different physical part, not modelled — W2
explicitly ships one generic bass bridge preset rather than several invented
ones.

## Pickup routs, pickguard, front/back routes

One `bass_split_coil` rout at Y=230mm, unrotated, X=0. No pickguard or
control routes.

## Body thickness and edge treatment

Not modelled; Slab default.

## Approximations, explicitly

- The contour is a scaled donor shape; a real Mustang's rounder, more
  compact silhouette is not represented.
- Pickup Y-position is plausible, not measured.
- String-through bridge construction and the 7-bolt neck plate are not
  modelled — only the generic bass bridge and bolt-on mechanism are.
