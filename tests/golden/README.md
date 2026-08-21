# Golden geometry corpus

`geometry-corpus.json` is the reference output of the web app's geometry code.
It exists so a second implementation - an iPad build in Swift, an Android build
in Kotlin - can prove it produces the same numbers, without sharing any code.

Regenerate after any deliberate change to curve evaluation, scale math, or
symmetry:

```bash
npm run corpus
```

Verify the committed file still matches the code (suitable for CI):

```bash
npm run corpus:check
```

`corpus:check` failing means geometry output changed. If that was intended,
regenerate and commit - and treat the diff as a heads-up that every port now
needs the same change.

## Conventions

Millimetres throughout. X = 0 is the body centreline; Y = 0 is the neck-pocket
joint line, with Y growing toward the tail. `handleIn` / `handleOut` are
offsets **relative to their own anchor**, not absolute points - the most
common thing to get wrong when porting.

Points are `[x, y]`. Values are rounded to 6 decimal places. Compare with a
tolerance of `1e-6` mm (`conventions.toleranceMm`): a different order of
floating-point operations will not reproduce the last bits exactly, and 1e-6 mm
is a nanometre, so nothing that matters can hide under it.

## What is in it

| Key | Covers |
| --- | --- |
| `constants` | The full neck, bridge and pickup tables. Diff these against the port's own constants first - a mismatch here explains every downstream failure at once. |
| `unitConversions`, `gridSnapping` | `units.ts`: mm/inch conversion, display formatting, grid preset snapping. |
| `scaleMathMatrix` | `scaleMath.ts` over **every** neck x bridge combination. Saddle and bridge-plate placement is the highest-consequence math in the app; it is covered exhaustively rather than sampled. |
| `cases[]` | Per built-in blueprint: the input contour, the pickup routs, and the expected output of every geometry function. |

Each case also carries `pickups[]`: the resolved rout for every pickup, plus
`routPath` - its real cavity shape (mounting ears and all, where the pickup
has them; see `constants.pickupSpecifications`), already rotated and
translated into model space. `routPath` is there to pin down the rotation
convention - **positive `angleDegrees` turns clockwise**, because Y grows
downward, matching SVG's `rotate()`. Two blueprints have genuinely slanted
pickups (S-Style's bridge single coil at 10 degrees, T-Style's bridge pickup
at its installed-canted 15 degrees), so a port that rotates the wrong way
fails here rather than silently routing a mirrored cavity.

Note that the rout comes from the *placement*, not from the pickup type -
`type` only seeds the defaults when a pickup is created. Read `widthMm` /
`heightMm` / `anchors` off the placement - except a placement saved before
`anchors` existed, whose widthMm/heightMm described a simplified pickup-cover
outline rather than a real cavity measurement: `resolvePickupSpec` in
`presets.ts` ignores that placement's own fields entirely and returns the
type's real catalogue rout (size and shape together), never a value scaled
to fit the old number.

Each case carries `input` (the contour as authored) and `expected`:

- `svgPath` - `anchorsToSVGPath` output. An exact string comparison, including
  the 2-decimal formatting. A port that renders correctly but formats
  differently will fail this; that is deliberate, because the string ends up in
  the exported SVG that gets printed and cut.
- `segments[]` - for each segment, its four control points and 129 sampled
  points at `t = i/128`. This is the real curve-evaluation contract.
- `closestSegmentProbes[]` - `findClosestSegment` at fixed points, including
  one outside the body. Covers hit-testing, which drives node insertion.
- `operations` - the result of each editing operation applied to the pristine
  contour: insert, straighten, curve, handle reset, mirrored insertion, and
  live-centerline symmetry after a fixed drag.

## Generated ids

`insertAnchorOnSegment` and `withMirroredInsertion` mint anchor ids from a
timestamp and a random suffix. In the corpus those are rewritten to
`generated:0`, `generated:1`, ... in order of appearance, and `mirrorId`
cross-references are remapped to match.

A port should therefore compare **geometry and structure, not id strings**:
assert that the anchor at a given index has the expected position and handles,
and that `mirrorId` points at the anchor the corpus says it does. Pre-existing
anchors keep their real ids and can be matched directly.

## Suggested Swift test shape

Add the JSON to the test target as a resource and decode it into structs
mirroring the app's types. A single parameterised test per section keeps
failures legible:

```swift
func testCurveSampling() throws {
    let corpus = try GoldenCorpus.load()
    for expectedCase in corpus.cases {
        let contour = expectedCase.input.contour
        for segment in expectedCase.expected.segments {
            let cps = contour.controlPoints(ofSegment: segment.index)
            XCTAssertEqual(cps, segment.controlPoints, accuracy: corpus.toleranceMm)

            for (i, point) in segment.samples.enumerated() {
                let t = Double(i) / Double(corpus.conventions.samplesPerSegment)
                XCTAssertEqual(
                    Bezier.evaluate(cps, t: t), point,
                    accuracy: corpus.toleranceMm,
                    "\(expectedCase.id) segment \(segment.index) t=\(t)"
                )
            }
        }
    }
}
```

Include the case id, segment index and `t` in every failure message. When a
port drifts it usually drifts on one segment of one blueprint, and that message
is the difference between a five-minute fix and an afternoon.

Work through the sections in this order - each one's failures are caused by the
previous one, so fixing them in order avoids chasing symptoms:

1. `constants`
2. `scaleMathMatrix`
3. `segments` (control points, then samples)
4. `svgPath`
5. `closestSegmentProbes`
6. `operations`
