# R-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology. **This is the
weakest of the eight drafts and should be the first one refined by hand.**

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 342.9mm (13.5") | Published Rickenbacker 4003 overall width | High |
| Body length (joint line to tail) | 478mm | **Estimated** — Rickenbacker publishes only overall instrument length (44-13/16"); no body-only figure found. Scaled down from the StingRay estimate for the shorter 33.25" scale | Low |
| Scale length | 844.55mm (33.25") | `bass_medium_33_25` (W2), matches the plan's own sourcing table | High |
| Neck pocket | 63.5 × 98.425mm | W2 — **known gap**: this is `GENERIC_POCKET_SPEC.bass.glued`, which W2 documents as repeating the bolt-on bass pocket because no real set-neck/neck-through tenon measurement was available | Medium (documented approximation, not this file's own) |
| Neck joint | Modelled as `glued` | The real Rickenbacker 4001/4003 is **neck-through**, which this app does not model as a third option (deferred, per the plan). `glued` is the closer of the two available buckets | Modelling choice, not a construction claim |
| Pickup type/shape | R-style toaster + R-style horseshoe | User-supplied `bass-pickups.svg` cavity and 3D part outlines | High |
| Pickup Y positions (210mm, 310mm) | Not sourced | Plausible neck/bridge placement only | **Estimated** |
| Body outline | Derived from `jag_style`, scaled | **Does not resemble a Rickenbacker's cresting-wave silhouette at all** | **First draft, weakest match of the eight** |

## Body outline calibration and bounds

Donor: `jag_style` (Jaguar-style offset guitar), the closest available
in-repo shape with any asymmetric/offset character — but a Rickenbacker's
real "cresting wave" body (a distinctive stepped upper bout, sharp horns, and
a shape unlike any Fender-family offset) is not represented by this donor at
all. Scaled to 342.9mm width × 478mm length. Treat this contour as a
placeholder that establishes correct overall size and a valid, editable
starting curve — nothing more.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 528.2012mm (fret-17 distance, 844.55mm scale). Mechanism
is `glued`, per the modelling choice above (not a claim the real instrument
has a mortise-and-tenon joint — it doesn't; it's neck-through).

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. A real Rickenbacker ships its own
distinctive bridge/mute assembly, not modelled.

## Pickup routs, pickguard, front/back routes

One `bass_r_toaster` rout at Y=210mm and one `bass_r_horseshoe` rout at
Y=310mm. Their positions remain estimated. No pickguard or control routes; a real
Rickenbacker's pickguard and control-cavity layout is distinctive and
entirely unmodelled here.

## Body thickness and edge treatment

Not modelled; Slab default. A real Rickenbacker's body has distinctive
binding, unmodelled.

## Approximations, explicitly — this file has the most

- Body outline: placeholder, not resembling the real archetype.
- Pickup positions: not sourced.
- Body length: estimated with low confidence.
- Neck joint mechanism: a modelling choice, not a construction match.
