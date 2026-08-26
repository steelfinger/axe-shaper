# SG-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology. This is the
strongest draft of all eight: its donor shape is directly, independently
confirmed to be the same body as the real instrument.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 330mm (13") | Published 1961 Gibson EB-3 body width | High |
| Body length (joint line to tail) | 432mm (17") | Published 1961 Gibson EB-3 body length | High |
| Body shape family | Same as the SG guitar | **Independently corroborated**: a period source describes the EB-3's body and neck dimensions as "nearly identical to a[n] SG guitar" | **High — the one blueprint where the donor-shape choice itself is sourced, not assumed** |
| Scale length | 774.7mm (30.5") | `bass_short_30_5` (W2), matches the plan's own sourcing table and the real EB-3's 30.5" scale | High |
| Neck pocket | 63.5 × 98.425mm | W2 — same documented `glued`-pocket gap as R-Style/Thunderbird-Style; **this is the entry that most needs a real number**, since SG-Style is the one genuinely glued-neck (not neck-through) instrument among the three `glued` blueprints | Medium — flagged in W2 as the priority case |
| Neck joint | `glued` | Matches the real EB-3's actual glued-neck construction (unlike R-Style/Thunderbird-Style, this is not a "closer bucket" modelling choice — it's the real mechanism) | High |
| Pickup type/shape | Humbucker, 103.7 × 50.5mm × 2 | W2 catalogue; the real EB-3's "mudbucker" pickups are not identical in shape, but it's this app's closest existing type | Medium |
| Pickup Y positions (200mm, 280mm) | Not sourced | Plausible neck/bridge placement | **Estimated** |
| Body outline | Derived directly from `sg_style` (guitar), scaled | **The best-grounded donor choice of the eight** — see above | Best available without a trace |

## Body outline calibration and bounds

Donor: `sg_style`, the existing guitar blueprint — chosen specifically
because a real EB-3's body is documented as sharing the SG guitar's own
shape, not because it was the closest guess available. Scaled to 330mm width
× 432mm length, pocket anchors snapped to (∓31.75, 0).

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 484.5154mm — the fret-17 distance on a 774.7mm (30.5")
scale.

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. A real EB-3 ships its own bridge/
vibrato assembly, not modelled — W2 explicitly ships one generic bass bridge
preset.

## Pickup routs, pickguard, front/back routes

Two `bass_humbucker` routs at Y=200mm and Y=280mm, unrotated, X=0. No
pickguard or control routes.

## Body thickness and edge treatment

Not modelled; Slab default — a real SG-family body has a distinctive bevel
that neither this file nor the donor `sg_style` guitar's edge profile carries
forward here (the donor's own beveled profile was not copied; a fresh choice
belongs to whoever refines this).

## Approximations, explicitly

- Neck pocket width (63.5mm) is the one number in this file most likely to
  need correction — see the W2 note on `GENERIC_POCKET_SPEC.bass.glued`.
- Pickup Y-positions are plausible, not measured.
- Body thickness/edge treatment are unmodelled.
