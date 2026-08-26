# P-Style Bass — evidence packet

See `README.md` in this directory for the shared methodology (donor-shape
scaling) and how to read the acceptance-gate table.

## Sources and confidence

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Body width | 330mm (13") | Widely corroborated published Fender P-Bass spec | High |
| Body length (joint line to tail) | 511mm (20-1/8") | Widely corroborated published Fender P-Bass spec | High |
| Scale length | 863.6mm (34") | This app's own `bass_long_34` (W2), matches Fender spec | High |
| Neck pocket | 63.5 × 98.425mm | Sourced at W2 — real Fender four-string bolt-on pocket, StewMac/Warmoth templates | High |
| Neck joint | Bolt-on | Real construction; matches `DEFAULT_NECK_JOINT_MECHANISM` (W2) | High |
| Pickup type/shape | Split-coil, 57.91 × 29.21mm core | Sourced at W2 from a published P-Bass routing template | High |
| Pickup Y positions (235mm, 265mm) | Staggered, D/G half nearer the bridge than E/A half, per the real P-Bass convention | Positions themselves are **not independently sourced** — chosen to sit in a plausible mid-body location with a believable stagger; not measured off a real instrument | **Estimated** |
| Body outline (contour) | Derived from `s_style`, scaled | Not traced from any P-Bass reference — see "Donor shape" below | **First draft, not sourced** |

## Body outline calibration and bounds

Donor: `s_style` (S-Style Standard guitar blueprint), affine-scaled: X to
330mm overall width, Y to 511mm (joint line to tail), independently. Neck
pocket anchors then snapped to exactly (∓31.75, 0). Resulting bounds:
X ∈ roughly [-171, 159], Y ∈ [-78.2, 511.0] (horn tips extend ~78mm above the
joint line — inherited from the donor's own proportions, not independently
verified against a real P-Bass, whose horns are generally shorter/stubbier
than a Strat's).

## Neck construction and joint relationship

`nutToBodyEdgeMm` = 540.1155mm, the fret-17 distance on an 863.6mm scale
(sourced at W2 — Fender's own setup documentation treats fret 17 as "where
the neck joins the body" for a four-string bolt-on bass). `neckJointMechanism`
is `bolt_on`, matching a real Precision Bass.

## Bridge, compensation, string spacing

Unchanged from W2: `bass_vintage_plate` (81.03 × 53.09mm plate, +3.2/+9.5mm
compensation, 57.15mm total string spread). All sourced there; see
`docs/BASS_BODY_DESIGN_MILESTONES.md`.

## Pickup routs, pickguard, front/back routes

Two `bass_split_coil` routs (57.91 × 29.21mm each — one coil half per the
real P-Bass split-coil design), placed at Y=235mm and Y=265mm, unrotated,
centred on X=0. **Not present**: pickguard, front/back control routes,
split-coil mounting-tab detail (out to 68.58mm — see the W2 note in
`hardware.ts`). All deliberately left for hand refinement.

## Body thickness and edge treatment

Not modelled. `edgeProfile` is absent (Slab default) — no sourced edge
treatment was available.

## Approximations, explicitly

- The contour is a scaled donor shape, not a trace — see README.
- Pickup Y-positions are a plausible placement, not a measured one.
- Horn height above the joint line is inherited from the donor, unverified
  against a real P-Bass.
