# P-Style Bass — evidence packet

Unlike the other seven bass blueprints, `p_bass_style` is **not** a
donor-scaled first draft. Its body outline, pickguard and control-cavity
front route are traced from photos of a real Fender Precision; its pickup
cavity and bridge plate are traced/measured from real hardware. It is built
by `scripts/build-p-bass-blueprint.ts` from
`p_bass_style-traced-source.axe.svg` (in this directory) and is **out of**
`scripts/generate-bass-blueprint-drafts.ts`.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body outline (contour) | 17-anchor traced outline, X ∈ [-164.5, 163.4], Y ∈ [-85.9, 419.5] | **Traced from photos** of a real Precision (`p_bass_style-traced-source.axe.svg`) | High — photo trace, not a published dimension set |
| Pickguard | 23-anchor traced outline | Traced from the same photos | High — photo trace |
| Control cavity (front route) | 8-anchor outline on the lower treble bout | Traced from the same photos | High — photo trace |
| Scale length | 863.6mm (34") | This app's own `bass_long_34` (W2), matches Fender spec | High |
| Neck pocket | 63.5 × 98.425mm | Sourced at W2 — real Fender four-string bolt-on pocket | High |
| Neck joint | Bolt-on | Real construction; matches `DEFAULT_NECK_JOINT_MECHANISM` | High |
| Saddle line (joint line → uncompensated saddle) | 368mm (`nutToBodyEdgeMm` 495.6) | **User-measured** on a real Precision. Overrides the fret-17 joint convention the other 34" bass bodies keep (≈ fret 15.7 on this scale) | User-sourced, uncited |
| Bridge plate | 84 × 46mm, one rectangle, top at 356mm / bottom at 402mm | **User-measured** off a real Precision bridge — `bass_precision_plate` | User-sourced, uncited |
| Bridge compensation | treble +3.2mm, bass +9.5mm | Unchanged from `bass_vintage_plate` (34"-derived string stretch) | High |
| Pickup cavity | One Z-shaped opening, ~105 × 62mm, two ~70 × 32mm bobbin pockets in the split stagger | **Traced verbatim** from a Fender Precision routing template the user supplied (`p_bass_style-pickup-cavity.svg`) | High — traced outline; 62mm height confirmed |
| Pickup rout depth | 3/4" (19.05mm) | Fender Precision routing standard, user-supplied | High — **not modelled** (no pickup-depth field on the plan) |
| Pickup Y position | 218.9mm (cavity centre) | Positioned against the traced body and pickguard by the user; not a published measurement | Estimated |

## Neck construction and joint relationship

`nutToBodyEdgeMm` = **495.6mm** (863.6 − 368), not the fret-17 distance
(540.1155mm) the other 34" bass bodies use. A user measurement puts the
saddle line 368mm from the joint line on a real Precision, so
`FINGERBOARD_OVERHANG_MM.p_bass_style` carries the P-bass exception
(fret20Distance(863.6) − 495.6 ≈ 95.983). P-bass-only: `bass_long_34` itself
and j/mm/thunderbird/streamer are untouched. `neckJointMechanism` is
`bolt_on`.

## Bridge

`bass_precision_plate` — the second bass bridge (the milestone doc anticipated
one arriving "measured with the body at W6"). Same family as
`bass_vintage_plate` (a one-piece bent-steel top-load Fender bass plate) but
measured off a real Precision: 84 × 46mm, and the saddle line sits 12mm behind
the plate's front edge, not centred. `singlePlate: true`, so it draws as one
rectangle. On this build the plate spans Y 356..402 with the saddle line at
368. Compensation is unchanged from `bass_vintage_plate`.

## Pickup rout

**One** `bass_split_coil` placement at Y≈218.9, unrotated, centred on X=0.
The rout is the actual Fender Precision cavity outline, traced from
`p_bass_style-pickup-cavity.svg` and recentred on (0,0): two ~70 × 32mm
bobbin pockets in the split stagger — E/A toward the neck and bass side, D/G
toward the bridge and treble side — joined by a short strip into one Z-shaped
opening, ~105 × 62mm overall. The two pockets meet but do not overlap. Real
routing depth 3/4" (19.05mm), not modelled.

## Pickguard and front route

Both traced from the photos, carried verbatim from
`p_bass_style-traced-source.axe.svg`. The pickguard is the standard Precision
shape wrapping the neck-pocket area and the upper bout; the front route is the
control-plate cavity on the lower treble bout. No back routes, no
edge profile (Slab default — no sourced edge treatment).

## Approximations, explicitly

- The body/pickguard/control-cavity outlines are photo traces, not derived
  from a published Fender dimension set.
- The 368mm saddle line and the 84 × 46mm plate are user measurements without
  a published citation yet.
- The pickup Y position is placed against the traced body, not measured.
