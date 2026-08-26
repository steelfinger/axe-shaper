# The `.axe.svg` payload

Code is not shared between the web app, `axe-shaper-ios` and
`axe-shape-3D-viewer`. This file format and `tests/golden/geometry-corpus.json`
are the contract instead, so anything ambiguous here becomes two
implementations quietly disagreeing about a drawing whose entire purpose is to
be printed 1:1 and cut into wood.

This document covers the parts that are ambiguous by nature: what a version
means, and the handful of fields where the obvious reading is the wrong one.
`src/constants/schema.ts` holds the version history; `src/types/guitar.ts`
holds the field-by-field types.

## Shape of the file

A `.axe.svg` is a real, printable SVG with the project stashed in
`<metadata>`:

- `<project:data>` — the whole project as JSON, UTF-8, base64. **Authoritative.**
- `<project:schemaVersion>`, `<project:instrumentType>`,
  `<project:stringCount>`, `<project:name>`, `<project:appVersion>`,
  `<project:units>` — plain-text mirrors of payload fields, for anything
  scanning the file without base64-decoding it. A reader that has decoded the
  payload should use the payload. A writer must never compute these
  separately from what it encodes.

Base64 rather than CDATA because CDATA has no escape for a literal `]]>` and a
project name could contain one.

## Versions

| Version | Adds |
| --- | --- |
| 1 | Hardware referenced by id only. |
| 2 | `neckPreset` / `bridgePreset`: full embedded copies of the hardware. |
| 3 | `instrumentType`, `stringCount`; reserves `stringSpacingMm`, `heightMm`, `nutStringSpacingMm`. |

### The embedded copy wins

From version 2 on, a project stores hardware twice: the preset **id** and a
full **copy** of the preset. Every reader resolves the copy first.

This is not redundancy. Bridge position is derived from the neck's scale
length and the bridge's compensation, so a reader that resolves an unknown id
by falling back to a default does not fail loudly — it draws a plausible
instrument with the saddle line up to ~38 mm out of place. The copy means a
file drawn against hardware a build has never heard of still comes out
dimensionally correct.

The intended consequence: correcting a published spec in a catalogue does not
move the bridge on existing saves. Re-picking the preset adopts the new spec.

The same rule applies to pickups: the rout comes from the `PickupPlacement`'s
own `widthMm` / `heightMm` / `cornerRadiusMm` / `anchors`, and `type` only
seeds those at creation.

### Decode tolerantly, refuse to edit

The rule for anything a reader does not understand — a newer `schemaVersion`,
an unrecognised `instrumentType`, an unknown enum value:

1. **Decoding never fails on unknown vocabulary.** The payload is parsed and
   the unknown value is kept verbatim, so it can still be round-tripped or
   inspected. This is what makes the embedded hardware copies worth having: a
   strict decoder that aborts never reaches the geometry that would have been
   drawn correctly anyway. (Invalid *numbers* are a different matter and are
   still rejected.)
2. **Opening it for editing is refused.** Editing implies writing it back,
   and writing back what you did not understand silently discards it — or, in
   the instrument case, offers guitar hardware, a guitar pocket and guitar
   string spacing for something the build cannot draw.

The two layers are separate on purpose. On web that is
`extractProjectFromSVG` (tolerant, never inspects the instrument) and
`loadProject` (the single edit door, which refuses); on iOS it is the
`TolerantWireEnum` decode path and document validation. A reader that only
ever views or exports may use layer 1 alone, deliberately.

### A payload newer than the reader

A version above what a build knows must not be **edited**. Editing and saving
it back rewrites it as if the build understood it, silently discarding
whatever the newer writer knew. Viewing or exporting such a file may be made
safe deliberately; editing it never is.

On web this gate is `isSupportedSchemaVersion` (`src/constants/schema.ts`),
enforced in `migrateProject` / `loadProject` (`src/utils/presets.ts`) — the
one door into the editable project path.

## Version 3: the instrument axis

```json
{
  "schemaVersion": 3,
  "instrumentType": "bass",
  "stringCount": 4
}
```

- Both fields are **required at version 3** and both are **project-level**.
  They are deliberately *not* repeated inside the embedded neck or bridge,
  where two copies could disagree.
- Hardware compatibility is derived from the pair. Compatibility metadata may
  wrap a preset in memory (web: the `*_INSTRUMENT` side-tables in
  `src/constants/hardware.ts`), but it never takes part in resolving
  geometry — the embedded preset stays the physical source of truth.
- The supported matrix for this release is **Guitar/6** and **Bass/4**. A
  version 3 payload naming a known type with a count outside the matrix, or an
  unrecognised type, decodes intact but is refused for editing — see "Decode
  tolerantly, refuse to edit" above. It is never opened as something else.
- Version 1 and 2 payloads carry neither field and decode as **Guitar/6** —
  a default-when-absent read, not a guess: nothing else was drawable.
- The bump is not a bass-only event. From the first build that writes version
  3, every existing *guitar* project also reaches other readers as version 3.

### `stringSpacingMm` and `nutStringSpacingMm` are a total spread

**Both are the distance from the outer string to the outer string, across all
strings. Neither is the per-string pitch.**

`BridgePreset.stringSpacingMm` — total spread at the saddles.
`NeckPreset.nutStringSpacingMm` — total spread at the nut.

A four-string bass at roughly 19 mm pitch is therefore about **57**, not 19.
Reading it as a pitch would draw four strings 6.3 mm apart.

What pins the definition: the field is spent as an even spread centred on the
centreline,

```
x(index) = -totalMm / 2 + (index - 1) * (totalMm / (stringCount - 1))
```

so `totalMm / (stringCount - 1)` is the per-string pitch and the stored field
is the numerator. `axe-shaper-ios`'s `StringGeometry.fallbackStringSpacingMm =
52.5` is six guitar strings at 10.5 mm pitch, and its
`fallbackNutStringSpacingMm = 35.0` is the same six strings at the nut — both
only make sense read as a total.

> **iOS carries a six-string assumption here.**
> `StringGeometry.evenSpread` currently divides by a literal `5`, not by
> `stringCount - 1`, at all three call sites (nut, saddle, headstock post).
> That is exactly right for Guitar/6 and wrong for Bass/4: four strings would
> be laid out across three fifths of the spread. Generalising that divisor is
> iOS milestone M24 work, and it is the reason `stringCount` is a
> project-level field rather than something inferred from the hardware.


Both fields, and `BridgePreset.heightMm`, are **optional**. iOS has modelled
them for longer than the web app has but never wrote them, so every fixture in
`tests/fixtures/ios-written` omits all three and both sides fall back to a
constant. Version 3 is where both sides start writing them; the web catalogue
values arrive with the bass hardware (milestone W2), so that guitar and bass
measurements get verified against published specs in one pass rather than
eyeballed one at a time.

### The fingerboard-overhang reference fret: 22 guitar, 20 bass

`FINGERBOARD_OVERHANG_MM` (web, `src/constants/hardware.ts`) and
`BlueprintCosmetics.fingerboardOverhangMm` (iOS) store, per blueprint, how far
past Y=0 that body's **reference fret** sits. `nutToBodyEdgeMm` is then
recomputed as `getFretDistanceFromNutMm(N, scale) - overhang`.

| Instrument | N |
| --- | ---: |
| Guitar | 22 |
| Bass | 20 |

**N is a rate, not a claim about where a fingerboard ends.** The overhang is
derived with N and consumed with N, so the absolute position cancels:

```
overhang  = fretN(S_native) − nutToBodyEdge_native
new value = fretN(S_new) − overhang
          = nutToBodyEdge_native + kN · (S_new − S_native),  kN = 1 − 2^(−N/12)
```

All that survives is `kN`: how far the joint line slides per millimetre of
scale-length change. Attaching a neck of the *same* scale reproduces the
body's own value exactly, whatever N is — web's `s_style` overhang is derived
from a **21**-fret neck using N=22 and still reproduces 390.7 to the digit.

Two rules follow, and both matter more than the number itself:

1. **N must be the same on the way in and the way out.** Reading it off each
   neck's real fret count breaks the cancellation: on web that would move the
   bridge **10.8 mm** when a 22-fret neck is attached to a body whose overhang
   was derived from a 21-fret one, at the *same* scale — a case that is
   currently exact.
2. **N must be the same on both platforms**, per instrument. It is a contract
   number; disagreeing on it lands the body at a different Y on each side.

Why the values differ: all four curated guitar necks have 22 frets, so N=22 is
the exact rate for every swap the guitar picker offers. Four-string bass necks
have 19–21, so N=22 would be the wrong rate — swapping a 34″ bass neck for a
30″ one would misplace the joint, and with it the bridge, by about **3.5 mm**.
N=20 is the common four-string count and drops that below a millimetre for the
swaps that make sense.

This replaces an earlier decision to use 22 for both instruments. It was
changed while the bass catalogue existed but no bass blueprint did, so no
stored overhang constant had to be recomputed; after bass bodies ship, changing
it means recomputing every one of them on both platforms.

## Coordinate system

All geometry is physical millimetres.

- **X = 0** is the body centreline.
- **Y = 0** is the neck-pocket joint line — the top of the body outline — and
  Y grows toward the tail.
- `handleIn` / `handleOut` are offsets relative to their own anchor, never
  absolute points.
- A positive `angleDegrees` turns clockwise, because Y grows downward.

`nutToBodyEdgeMm` is measured to Y=0. A template whose horns do not extend
above Y=0 cannot absorb a change to it: the whole body slides up the neck. See
`CLAUDE.md`, "Coordinate system".

## Unknown fields survive a save

A reader must write back fields it has no model for. The iOS app persists a
`guideImage` object the web app does not model at all, and it round-trips
because every web update path spreads the parsed object rather than rebuilding
it. `scripts/check-ios-fixtures.ts` turns that habit into a checked fact.

## Local checks

```bash
npm run schema:check     # version 3 contract: migration, round-trip, rejections
npm run fixtures:check   # iOS-written payloads decode, load and re-save intact
npm run corpus:check     # geometry output still matches the golden corpus
```
