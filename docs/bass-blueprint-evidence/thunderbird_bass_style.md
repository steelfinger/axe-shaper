# Thunderbird-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology. This is one of
the two strongest drafts (with SG-Style), because its donor shape is a
genuine real-world analog rather than a generic substitute.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 330mm (13") | Published reverse-body Gibson Thunderbird dimension (mid-1970s reissue reference) | Medium — one source, explicitly caveated by that source as approximate |
| Body length (joint line to tail) | 508mm (20") | Same source as width | Medium |
| Scale length | 863.6mm (34") | `bass_long_34` (W2) | High |
| Neck pocket | 63.5 × 98.425mm | W2 — same documented `glued`-pocket gap as R-Style, see there | Medium |
| Neck joint | Modelled as `glued` | The real Thunderbird is neck-through; `glued` is the closer of the two available buckets — same modelling choice already used for the Firebird/Gretsch Thunderbird *guitar* blueprints in this repo | Modelling choice, not a construction claim |
| Pickup type/shape | Bass mini humbucker × 2 | User-supplied `bass-pickups.svg` cavity and 3D part outlines | High |
| Pickup Y positions (230mm, 320mm) | Not sourced | Plausible neck/bridge placement | **Estimated** |
| Body outline | Derived from `gretsch_thunderbird` (guitar), scaled | **Direct real-world analog** — the donor is genuinely the same archetype, not a substitute | Best available without a trace |

## Body outline calibration and bounds

Donor: `gretsch_thunderbird` — the existing guitar blueprint already modelling
an elongated reverse-body Thunderbird-family silhouette. Scaled to 330mm
width × 508mm length, pocket anchors snapped to (∓31.75, 0). Of the eight
drafts, this one's donor is the most defensible choice: it shares the actual
named archetype, not just a loose family resemblance.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 540.1155mm (fret-17 distance, 863.6mm scale).

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. A real reissue Thunderbird bass
ships its own bridge, not modelled.

## Pickup routs, pickguard, front/back routes

Two `bass_mini_humbucker` routs at Y=230mm and Y=320mm, unrotated, X=0. No
pickguard or control routes.

## Body thickness and edge treatment

Not modelled; Slab default.

## Approximations, explicitly

- Body width/length come from a single source that itself calls the figures
  approximate.
- Pickup Y-positions are plausible, not measured.
- Neck joint mechanism is a modelling choice (the real instrument is
  neck-through), matching the precedent already set by this repo's guitar
  Thunderbird/Firebird blueprints.
