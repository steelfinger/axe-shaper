# Axe Shaper - working notes

React 19 + TypeScript + Vite (rolldown), Konva via react-konva, oxlint. See
README.md for what the app does; this file is only the things that are easy to
get wrong.

## Commands

```bash
npm run dev        # vite dev server on :5173
npm run build      # tsc -b && vite build
npm run build:zip  # rebuilds dist and axe-shaper-dist.zip (the deliverable)
npm run lint       # oxlint
npm run corpus     # regenerate tests/golden/geometry-corpus.json
npm run corpus:check  # fail if the committed corpus is stale
```

`npx tsc -b --noEmit` before committing. `src/App.tsx` has two known lint
warnings (unused catch param, exhaustive-deps); anything else is new.

## Known repo landmine

`index.html` is untracked - `.gitignore` has a blanket `*.html` rule. A fresh
clone will not build until that is sorted out.

## Coordinate system

All geometry is physical millimetres (`LengthMm`). Never store inches;
`src/utils/units.ts` converts for display only.

- **X = 0** is the body centreline.
- **Y = 0** is the neck-pocket joint line, which is *the top of the body
  outline*, and Y grows toward the tail.

That second point is a trap. `nutToBodyEdgeMm` is measured to Y=0, so raising it
to reflect a deeper joint only works if the template's horns actually extend
above Y=0 (the Strat's do, at about -62mm; the SG's do not, they sit at 0).
Changing it on a template whose horns stop at Y=0 slides the entire body up the
neck and drags the bridge and pickups with it. There is a comment about this on
`sg_style` in `src/constants/hardware.ts` - it was found the hard way.

## Hardware presets: the embedded copy wins

A project stores hardware twice - the preset *id*, and a full copy of the
preset itself (`neckPreset` / `bridgePreset`, schemaVersion 2). `resolveNeckPreset`
and `resolveBridgePreset` in `src/utils/presets.ts` read the **copy** first, so
**setting `neckPresetId` on its own does nothing**. Spread `neckPresetFields(id)`
/ `bridgePresetFields(id)` instead - they move the pair together.

The reason is that bridge Y comes from the neck's scale length and the bridge's
compensation. A reader that resolves an unknown id by falling back to a default
does not fail loudly, it just puts the saddle line somewhere else - about 38mm
out in the worst case measured - on a drawing whose whole point is to be
printed 1:1 and cut. The copy means a file drawn against hardware this build
has never heard of still comes out right.

The consequence is intended: fixing a spec in `hardware.ts` does not move the
bridge on existing saves. Re-picking the preset adopts the new spec.

Pickups work the same way, via `resolvePickupSpec()`: the rout comes from the
`PickupPlacement`'s own `widthMm` / `heightMm` / `cornerRadiusMm`, and `type`
only seeds those when a pickup is created. The first two fields always existed
on the placement but nothing read them - every call site went to
`PICKUP_SPECIFICATIONS[type]` - so a file carried two answers for the size of a
rout and the obvious one to read was the one nothing used.

`migrateProject()` backfills all of these when a version 1 file is opened.

## The golden corpus

`tests/golden/geometry-corpus.json` is this app's geometry output, frozen, for
a native port to assert against - code is not shared between implementations,
so the `.axe.svg` format and this corpus are the contract. `npm run corpus:check`
also makes it a regression test here: it fails if curve evaluation, scale math
or symmetry output changes. Regenerate deliberately, never to make the check
pass. See `tests/golden/README.md`.

## Where the real logic lives

- `src/utils/scaleMath.ts` - single source of truth for saddle and bridge Y.
  Do not recompute scale-length math inline anywhere else.
- `src/utils/bezier.ts` - curve evaluation, De Casteljau splitting, segment
  hit-testing, straighten/curve.
- `src/utils/units.ts` - unit conversion, grid presets, scale-bar steps.
- `src/constants/hardware.ts`, `src/constants/templates.ts` - real-world
  measurements. Changes here should be checked against published specs, not
  eyeballed.

## Konva and React gotchas

- A Stage sized 0 throws when it builds its buffer canvas, which shows up as a
  blank screen. `CanvasWorkspace` clamps to >= 1px and measures with a
  ResizeObserver.
- Layers 0 and 4 (grid, node controls) draw in **screen** coordinates via
  `toScreen`. Layers 1-3 (ghost, guide image, body, hardware) draw in **model**
  coordinates inside a transformed `Group`. Mixing the two silently misplaces
  things.
- A filled `Path`'s hit area is its fill, so a click just outside the outline
  hits nothing. Segment picking runs on the Stage and identifies the body by
  `name`, not by hit target.
- Do not read a value assigned inside a `setState` updater after the call -
  React runs the updater after the handler returns, so it is still empty.
- Every `onUpdateProject` pushes an undo entry. Canvas view toggles (pan mode,
  handle visibility) are local component state for that reason.

## Verifying geometry

Screenshots are not enough for measurements. With the dev server running, import
the app's own modules in the browser console and compute:

```js
const t = await import('/src/constants/templates.ts');
const b = await import('/src/utils/bezier.ts');
```

Sample curves at 200-400 points per segment and compare against the spec you are
targeting.
