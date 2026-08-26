# Bass blueprint evidence — milestone W6

## What these are, and what they are not

The eight files in `src/constants/blueprints/` named `*_bass_style.axe.svg`
are **first-draft starting shapes**, not photo-traced replicas of the named
instrument. That was a deliberate product decision, not a shortcut:

> All final blueprint shapes were created by hand. An AI agent can't really
> create good enough optimised bezier curves matching bitmap
> blueprints/photos. The initial blueprint files exist so a person can
> manually fix them once the UI is built, so Bass designs can be easily
> edited.

This document — and the one per blueprint alongside it — records what each
draft is actually built from, what is sourced versus estimated, and what a
person refining one should check first. It exists because this codebase's
own standard (`CLAUDE.md`) is that catalogue numbers are checked against
published specs, not eyeballed, and a body outline is a bigger claim than a
hardware dimension: it is the line a router or a bandsaw actually follows.

## How every draft was built

Each draft starts from an **existing shipped guitar blueprint's own contour**
— already a valid, smooth, non-self-intersecting closed Bezier curve — scaled
to the target bass's own sourced overall envelope (body width, body length
from the neck-pocket joint line to the tail), with the neck pocket then
snapped to the exact bass hardware width, independent of that scale. See
`scripts/generate-bass-blueprint-drafts.ts` for the exact transform and why
it scales to *overall width* rather than to the neck pocket ratio (an earlier
version did the latter and produced a body nearly 200mm too wide for
mortise-neck donor shapes).

Donor shapes were picked for the closest available family resemblance, not
selected by curve-fitting:

| Blueprint | Donor guitar shape | Why |
| --- | --- | --- |
| P-Style Bass | `s_style` | Generic Fender-family offset double-cutaway |
| J-Style Bass | `s_style` | Same family; Jazz and Strat bodies are close relatives |
| MM-Style Bass | `s_style` | No closer in-repo analog available |
| R-Style Bass | `jag_style` | Weakest match — see its own evidence file |
| Thunderbird-Style Bass | `gretsch_thunderbird` | Direct real-world analog: elongated reverse body |
| Mustang-Style Bass | `jag_style` | Offset Fender family, scaled to Mustang's smaller envelope |
| SG-Style Bass | `sg_style` | Direct real-world analog: EB-3 is independently documented as sharing the SG guitar's body |
| Streamer-Style Bass | `s_style` | No analog available; least-sourced of the eight |

What is **not** in these drafts, left for hand refinement rather than
guessed: a pickguard, front/back control routes, an edge profile (all default
to Slab/absent), and any curve detail finer than the donor shape's own
anchors. `pickguardEnabled` is set `false` on every draft for that reason.

## What is sourced versus estimated, per number

Every neck, bridge, pocket and string-spacing number was already sourced at
milestone W2 (`docs/BASS_BODY_DESIGN_MILESTONES.md`) and is unchanged here —
these drafts only add the *body outline* and *pickup placement* on top of
that existing, verified hardware. Body envelope dimensions (length, width)
and pickup Y-offsets are sourced per blueprint in each file below; where no
public figure could be found, the file says so explicitly rather than
presenting a guess as a measurement.

## Acceptance gate status (docs/BASS_BODY_DESIGN_MILESTONES.md, W6)

| Item | Status |
| --- | --- |
| Closed, non-self-intersecting contour, intentional centreline behaviour | ✅ verified by `bass:check` (segment-intersection sweep on the real files) |
| Bridge and saddle positions recomputed from the embedded neck/bridge data | ✅ real `presets.ts`/`scaleMath.ts`, not hand-placed |
| Manufacturing-critical geometry survives save/reload | ✅ every file was produced by the app's own `exportProjectToSVG`, and reloading it is the same code path any other file uses |
| True-scale SVG renders without clipping | ✅ verified by `bass:check` against each file's own real contour/hardware, both orientations |
| iOS 3D mesh builds without degenerate parts | ⚠️ not applicable yet — no iOS bass rendering exists until its own M24 work lands |
| `FINGERBOARD_OVERHANG_MM` / `DEFAULT_NECK_JOINT_MECHANISM` agree on both platforms | ⚠️ web-side values are set (this document); iOS needs matching entries added when its own catalogue lands — recorded on branch `bass-body/m24-web-w1-contract` |
| A human visual comparison is completed after numerical checks | ⚠️ **partial** — reviewed by the agent that authored these drafts, against no photographic reference (none was available); the real comparison against reference material is exactly the refinement step these drafts exist to be a starting point for |

## For whoever refines these next

Priority order, most to least urgent:

1. **R-Style Bass** — the donor shape (`jag_style`) does not resemble a
   Rickenbacker's cresting-wave silhouette at all. Everything else about the
   file (hardware, pocket, pickups) is correctly wired; only the contour
   needs real work.
2. **Streamer-Style Bass** — no published body dimension of any kind was
   found; both length and width are generic estimates.
3. **MM-Style Bass, R-Style Bass** — body length is estimated (no
   manufacturer figure found), width is sourced.
4. Everything else — both length and width are sourced from a published
   figure; the contour still needs real refinement, but the envelope it is
   scaled to is trustworthy.

Pickup placement, split-coil mounting-tab detail, and pickguards are called
out per file where they need the same treatment.
