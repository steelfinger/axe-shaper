# Hardware fixes handoff — from the iOS side

Three data/design issues surfaced while building the iOS sibling app
(`axe-shaper-ios`) against `tests/golden/geometry-corpus.json`. All three are
**upstream bugs in this repo's own `src/constants/hardware.ts`**, not iOS
transcription slips — confirmed by reading this file directly, not assumed.
iOS can't fix any of them on its own: `PresetCatalogue.swift` is a mechanical
transcription of the corpus (see that file's own `CONTRACT` comment), and
`GoldenCorpusTests` pins iOS's neck/bridge tables to the corpus's key set and
values exactly. The fix has to land here first.

**Process once a fix is made:** `npm run corpus` to regenerate
`tests/golden/geometry-corpus.json`, `npm run corpus:check` to confirm it's
not stale, then hand off back to iOS to re-run `Scripts/sync-contract.sh` and
mechanically re-transcribe the changed `PresetCatalogue.swift` entries.

---

## 1. Tune-O-Matic saddle position doesn't move enough

**Symptom (reported by hand on iOS):** selecting a Tune-O-Matic bridge barely
moves the saddle line compared to other bridge types — visually reads as "the
bridge selection doesn't do anything."

**Root cause:** `getSaddleYMm` (`src/utils/scaleMath.ts:27`) is one formula
for every bridge type:

```ts
export function getSaddleYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  return getTheoreticalSaddleYMm(neck) + bridge.compensationMm.treble;
}
```

`BridgePreset.scaleReference` (`post_line` for both `tune_o_matic` and
`tune_o_matic_firebird`, `saddle_line` for the other three,
`src/constants/hardware.ts`) is **stored but never read** — confirmed by
grepping the whole `src` tree for `scaleReference`; the only two hits outside
`hardware.ts`/`types/guitar.ts` are `svgExporter.ts` (just re-emits the
field) and this doc. So `compensationMm.treble` is quietly doing double duty:
real intonation compensation *and* the only lever available to correct for a
TOM's structurally different, post-line-referenced saddle position. Today's
values don't lean into that:

```ts
tune_o_matic:          compensationMm: { treble: 3.0, bass: 6.0 }
tune_o_matic_firebird: compensationMm: { treble: 3.0, bass: 6.0 }
// compare:
hardtail_6:            compensationMm: { treble: 1.5, bass: 4.5 }
tremolo_strat:         compensationMm: { treble: 2.0, bass: 5.0 }
tele_bridge_plate:     compensationMm: { treble: 2.5, bass: 5.5 }
```

3.0mm vs. 1.5–2.5mm for everything else is a ~1mm swing — invisible at this
drawing's scale, which matches the reported symptom exactly.

**Recommended fix — data-only, no formula change.** Every other bridge entry
in this file already carries a real, sourced derivation comment (e.g.
`tremolo_strat`: "Plate footprint measured directly: front edge 249mm from
the joint line..."). `tune_o_matic`/`tune_o_matic_firebird` don't have one —
`3.0`/`6.0` reads like an initial guess that was never revisited. **I'm
deliberately not proposing a replacement number here** — every other entry's
number traces to an actual measurement or a target bridge position, and
guessing one for this issue would just relocate the same kind of bug. What's
needed: a real Tune-O-Matic's actual saddle position relative to its own
post line (or a target compensated-saddle-line figure the way `jaguar_22`'s
neck entry has one), then back-solve `compensationMm.treble` the same way the
rest of this file already does.

The bigger alternative — actually consulting `scaleReference` and branching
`getSaddleYMm` by bridge mounting type — is flagged, not recommended. This
codebase doesn't model `scaleReference` anywhere yet, and introducing it for
one bridge type is a much bigger, riskier change than a data fix.

---

## 2. Bridge preset naming/consolidation (5 → 4)

**Step 1 — renames, safe, no geometry change:**

| id | current `name` | proposed `name` |
|---|---|---|
| `tune_o_matic` | "Tune-O-Matic + Stopbar Tailpiece" | "TOM-style Bridge" (avoid the trademark) |
| `hardtail_6` | "Hardtail 6-Saddle Plate" | "F-style Hardtail" |
| `tremolo_strat` | "Vintage 6-Screw Tremolo Bridge" | "F-style Tremolo" |
| `tele_bridge_plate` | "Vintage T-Style Bridge & Pickup Plate" | "T-Style Vintage" |
| `tune_o_matic_firebird` | — | unchanged for now, see step 2 |

Small but not zero-impact: `GoldenCorpusTests.testConstantsMatch` on iOS
asserts `name` too, so this still needs `npm run corpus` + a downstream
iOS re-sync, just a much smaller one than step 2.

**Step 2 — delete `tune_o_matic_firebird` — re-examine before doing this.**
The original plan (written iOS-side, without reading this file directly)
assumed this was a near-duplicate of `tune_o_matic` safe to drop. It isn't
quite that simple: its own comment says

```ts
// Same plate/compensation as tune_o_matic, but the tailpiece sits 39.5mm
// behind the post line here (not 45mm) - measured off the real routing
// template (bridge posts ~207.5mm, tailpiece 247mm from the joint line).
```

That's a real, separately-measured number (`mountingPoints`' tailpiece y:
39.5 vs. `tune_o_matic`'s 45.0), not a placeholder. Deleting this preset
means the Firebird either loses that measured refinement (falls back to
plain `tune_o_matic` spacing) or the 39.5mm figure needs to move somewhere
else (e.g. onto the Firebird body/blueprint itself, if this repo ever grows
a per-body bridge-spacing override the way iOS's `BlueprintCosmetics` now
has one). Worth a deliberate call, not a mechanical dedup. If dropped anyway:
remove the `BRIDGE_PRESETS.tune_o_matic_firebird` entry, update
`gibson_firebird.axe.svg`'s embedded `bridgePresetId`/`bridgePreset` (it's
base64 inside `<project:data>`, so a plain text search won't find it — decode
or re-save through the app), and expect `scaleMathMatrix` in the regenerated
corpus to drop from 45 rows (9 necks × 5 bridges) to 36 (9 × 4).

---

## 3. SG's `nutToJointMm` is a copy-paste bug

**In `src/constants/hardware.ts`:**

```ts
gibson_lp_22: {
  ...
  nutToJointMm: 414.27,
  ...
},
gibson_sg_22: {
  ...
  // (long, careful derivation comment for nutToBodyEdgeMm, see below)
  nutToBodyEdgeMm: 417.15,
  nutToJointMm: 414.27,   // <- byte-identical to gibson_lp_22's, no comment
  ...
},
```

`nutToBodyEdgeMm` on the SG entry has a real, careful derivation comment
right above it (back-solved from a target bridge position, with an explicit
note about why the SG can't just use "fret 19" directly — the horn tips sit
at `Y=0` rather than above it, unlike the Firebird). `nutToJointMm` has none,
and is exactly the LP's own value to the hundredth of a millimetre. Every
other template in this file (Firebird, Thunderbird, Flying V) has an
independently-derived `nutToJointMm`; only the SG's matches another entry
verbatim. Strong evidence this was copy-pasted once as a placeholder and
never revisited, not a genuine shared value.

**Consequence:** `nutToJointMm` is "nut to end of fingerboard overhang" —
how far the fingerboard extends past the joint line. iOS's own symptom of
this exact bug: the SG's fingerboard rendered short enough to not even reach
the body in the 3D preview (fixed there with a workaround — see
`axe-shaper-ios`'s `GuitarProject.resolvedNeckPreset`/M17 — but that only
patches the render, the source number here is still wrong).

**Recommended fix:** re-derive `gibson_sg_22.nutToJointMm` the same rigorous
way `nutToBodyEdgeMm` was — a real SG's fingerboard overhang past the joint
line, adjusted for this template's own `Y=0` placement the way the
`nutToBodyEdgeMm` comment already explains. **Not proposing a number here**
either, same reasoning as issue 1 — this needs an actual real-instrument
reference, not an inference from the neighboring LP entry a second time.

---

## Priority / sequencing suggestion

1. **Step 1 renames** (issue 2) — safe, no geometry risk, do anytime.
2. **Issue 3 (SG `nutToJointMm`)** — single-field fix once a real value is
   sourced, no design decision attached.
3. **Issue 1 (TOM compensation)** — single-field fix once a real value is
   sourced, no design decision attached.
4. **Step 2 deletion** (issue 2) — do last, and only after deciding what
   happens to the Firebird's measured 39.5mm tailpiece offset.

Each is independent — no need to batch them into one change.
