# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hobbyist luthiers and builders designing custom electric guitar bodies before
cutting them — starting from Tero's own use, extended to other hobbyists via
an MIT-licensed public repo. They are designing a body they intend to
physically produce (hand tools, router, or CNC), not just sketching for
visualization.

## Product Purpose

Axe Shaper is a high-precision 2D vector tool for designing electric guitar
body shapes from scratch or from iconic luthier blueprints (Stratocaster,
Telecaster, Les Paul, Double-Cut SG), then exporting them true-to-scale for
physical fabrication. Success means the exported shape is both geometrically
correct and physically buildable — hardware lands where it needs to for the
instrument to play in tune.

## Positioning

The differentiator is two things together, not either alone: luthier-correct
math (scale length, intonation compensation, neck-pocket snapping, and
hardware placement are physically interlinked, not independent vector shapes)
and a trustworthy physical-output pipeline (1:1 true-scale printable SVG with
a ruler calibration box, backed by a golden geometry corpus). A generic vector
tool like Illustrator or Inkscape can draw the same outline but has no
awareness that moving a curve also has to move the bridge.

## Operating Context

- Design happens at a desktop/laptop, with the output printed 1:1 on a home
  printer/plotter or sent to a CNC router — the drawing is a working pattern,
  not decorative art.
- The web app is also the public testbed for a planned native iPad app (a
  separate, clean-room Swift/SwiftUI rewrite, not a code-sharing port). The
  `.axe.svg` export format and the golden geometry corpus
  (`tests/golden/geometry-corpus.json`) are the contract that keeps the two
  implementations in agreement.
- Projects persist as versioned `.guitar` JSON files with full undo/redo.

## Capabilities and Constraints

- All geometry is stored in physical millimetres (`LengthMm`); never inches
  internally.
- Hardware presets (neck, bridge, pickups) are embedded as a full copy inside
  each saved project, not just referenced by id, so a file drawn against
  hardware a later build has never heard of still renders correctly.
- Bezier curve editing (drag anchors/handles, De Casteljau subdivision) is a
  core interaction, not incidental.
- Supports 25.5" Fender, 24.75" Gibson, and 27" baritone scale lengths, with
  neck-pocket presets for Fender square/rounded and mortise joints.

## Brand Commitments

- Name: Axe Shaper.
- Canonical public domain: `axeshaper.com`; marketing, social previews, support, and App Store URLs should use it.
- Existing README describes a "Dark Luthier Studio" dark glassmorphism visual
  style; treated as incumbent implementation evidence for design work, not a
  binding brief from this interview.

## Evidence on Hand

No real builds, testimonials, or case studies exist yet to cite. Future
design work must not fabricate any (no invented user quotes, guitars built,
or vendor endorsements). No specific accessibility requirement has been
established.

## Product Principles

1. Physical correctness before visual polish — a beautiful shape that doesn't
   intonate is a failed output.
2. The export is the product. Every feature earns its place by improving what
   comes out of the printer/CNC, not just what's on screen.
3. One geometry engine, two frontends. The web app and the future native iPad
   app must agree on output via the `.axe.svg` contract and golden corpus,
   even though they share no code.
4. Precision math stays invisible until needed — hobbyist builders shouldn't
   have to understand intonation compensation to trust the result is correct.
