# Streamer-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology. **This is the
least-sourced of the eight drafts** — no published body dimension of any
kind was found for the Warwick Streamer.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 340mm | **No source found** — generic 34"-class bass envelope, close to the other seven | **Estimated, unsourced** |
| Body length (joint line to tail) | 500mm | **No source found** — same generic envelope | **Estimated, unsourced** |
| Scale length | 863.6mm (34") | `bass_long_34` (W2), matches the plan's own sourcing table (Warwick's own published nut/scale specs confirm 34" for the Streamer family) | High |
| Neck pocket | 63.5 × 98.425mm | W2 | High |
| Neck joint | Bolt-on | The plan's own naming table describes the Streamer as "modern sculpted-body archetype and soapbar option" without specifying construction; real Warwick Streamers ship in both bolt-on and neck-through variants (Stage models are neck-through, Standard/LX are bolt-on) — bolt-on chosen as the more common of the two, matching `DEFAULT_NECK_JOINT_MECHANISM` (W2) | Medium — a real modelling choice among two real options, not a single fact |
| Pickup type/shape | Soapbar × 2, 90.9 × 40.1mm | W2 catalogue; matches the plan's own "soapbar option" description | Medium |
| Pickup Y positions (225mm, 310mm) | Not sourced | Plausible neck/bridge placement | **Estimated** |
| Body outline | Derived from `s_style`, scaled | Not traced, and Warwick's real sculpted, ergonomically-contoured body shares essentially no family resemblance with a Fender-style flat-front offset — this is the weakest shape match after R-Style | **First draft, not sourced, weak match** |

## Body outline calibration and bounds

Donor: `s_style` — chosen only for lack of any closer available analog.
Scaled to the estimated 340mm width × 500mm length. A real Warwick Streamer's
sculpted forearm/ribcage contours and asymmetric horn shaping are entirely
unrepresented by this flat Fender-family donor; this is the body most in
need of a genuine redesign rather than incremental refinement.

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 540.1155mm (fret-17 distance, 863.6mm scale).

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate`. Real Warwick bridges (2-piece
"Just-A-Nut III"-style or similar) are not modelled.

## Pickup routs, pickguard, front/back routes

Two `bass_soapbar` routs at Y=225mm and Y=310mm, unrotated, X=0. No
pickguard or control routes.

## Body thickness and edge treatment

Not modelled; Slab default. A real Streamer's forearm/ribcage sculpting is
the single biggest piece of missing geometry across all eight drafts — this
is not really an "edge treatment" in this app's vocabulary at all, and may
need new modelling capability rather than just a different contour.

## Approximations, explicitly — this file has the least grounding of the eight

- Body width and length: no source found at all.
- Body outline: weakest donor match after R-Style.
- Neck joint mechanism: a real choice between two real Warwick
  constructions, not a single sourced fact.
- Pickup Y-positions: plausible, not measured.
- Body sculpting: not represented at all, and may need new features to
  represent properly rather than just different anchor placement.
