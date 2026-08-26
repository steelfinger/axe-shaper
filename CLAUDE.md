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
npm run schema:check  # schema v3 contract: migration, round-trip, rejections
npm run bass:check    # bass catalogue: pocket, selectors, pickups, corpus pairs
npm run fixtures:check # iOS-written payloads decode, load and re-save intact
```

`corpus:check`, `schema:check`, `bass:check` and `fixtures:check` are not in CI (which only
runs `build`, and therefore `bridge:check`). Run them by hand before
committing anything that touches the file format, the hardware tables or the
geometry utils.

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

## Instrument type is project-level, and version 3 gates the door

`instrumentType` (`guitar` | `bass`) and `stringCount` are schema v3 fields on
the project itself. They are deliberately *not* repeated inside the embedded
neck or bridge, and the supported matrix - Guitar/6 and Bass/4 - lives in
exactly one place, `SUPPORTED_STRING_COUNTS` in `src/utils/instrument.ts`.

**Every path that opens a document goes through `loadProject()`**
(`src/utils/presets.ts`), never `migrateProject()` directly. It refuses two
things that used to sail straight into the editor:

- a payload from a *newer* schema version - before v3 there was no gate at
  all, so a v4 file was accepted, edited and written back out as v2;
- a known instrument with a string count this build cannot draw.

v1/v2 files decode as Guitar/6. That is a default-when-absent read, not a
guess: nothing else was drawable.

Catalogue compatibility (`NECK_PRESET_INSTRUMENT` and friends in
`constants/hardware.ts`) is a **side-table keyed by id**, never a field on the
presets. Presets are embedded verbatim into every save and into the golden
corpus; an `instrumentType` inside one would be a second, stale answer to a
question the project already answers.

`docs/AXE_SVG_FORMAT.md` is the format contract - read it before changing
anything a second implementation reads. Two things there are easy to get
backwards: `stringSpacingMm` / `nutStringSpacingMm` are a **total spread
across all strings**, not a per-string pitch; and the fingerboard-overhang
reference fret (`FINGERBOARD_REFERENCE_FRET`, 22 guitar / 20 bass) is a
**rate**, not a claim about where a fingerboard ends. It must be the same
number on the way in and the way out - reading it off each neck's own `frets`
would move the bridge 10.8mm in a case that is currently exact.

## The editor is isolated to one instrument

A document's `instrumentType` is fixed for its life. Blueprints, saved
templates, necks, bridges and pickup types are all filtered to it, and
`handleSelectTemplate` refuses a mismatch even if the UI ever stops
filtering. Changing instrument is **New...**, not a switch - it replaces the
contour and every piece of hardware.

The filter that matters most is on **user templates**. A `UserTemplate`
stores preset ids with *no embedded copy*, so applying one from the other
instrument resolves its neck and bridge purely through the catalogue - the
one path in this app where "the embedded copy wins" cannot rescue a wrong
lookup. Untagged records predate the field and read as Guitar/6.

## The bass catalogue

Bass hardware lives in the same `NECK_PRESETS` / `BRIDGE_PRESETS` /
`PICKUP_SPECIFICATIONS` tables as guitar hardware, with
`NECK_PRESET_INSTRUMENT` and friends saying which is which. Two consequences:

- **The pickers go through the selectors in `utils/presets.ts`**
  (`offeredNeckPresets` / `offeredBridgePresets` / `offeredPickupTypes`),
  never over the tables directly. Iterating a table is how a bass project
  gets offered a guitar tremolo.
- `GENERIC_POCKET_SPEC` is keyed **instrument first, then mechanism**. A
  four-string bass heel is 63.5mm against the guitar's 55.56mm; before the
  instrument axis existed every bass project routed a guitar pocket. Pass the
  project's own `instrumentType` to `neckPresetFieldsForTemplate`.

Bass necks have no legacy/curated split - the guitar side has one only
because its nine per-body necks predate the four scale-length ones.

The measurements are sourced, not eyeballed; each entry's comment says what
from. Where a number is derived (a pickup rout taken as the pickup plus
clearance) or approximated, the comment says that too, and the approximation
is listed in `docs/BASS_BODY_DESIGN_MILESTONES.md` for the blueprint evidence
packet to settle.

## The 3D viewer doesn't know about instruments yet

`steelfinger/axe-shape-3D-viewer` tolerates schema v3 (any `schemaVersion`
number, no upper bound) but reads neither `instrumentType` nor `stringCount`
- string count, pole spacing and headstock posts are fixed at six. **View in
3D** is disabled and explained for Bass/4 (`Header`'s `view3DAvailable`, and
`handleView3D` itself refuses independently of the button) until the
viewer's own Bass/4 rendering is verified. See `docs/AXE_SVG_FORMAT.md`.

## Regenerating the golden corpus is guarded

`npm run corpus` refuses to write if it would change a `scaleMathMatrix` row
that already exists in the committed file - adding hardware is meant to *add*
rows, and a moved saddle number is either a regression or a contract change
every port must reproduce. `--allow-scale-math-change` when the move is the
point.

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

## The app shell decides before the editor exists

`EditorRoute` (`src/App.tsx`) shows either `NewDesignScreen` or `EditorApp`,
never both, and `EditorApp` takes a plain `GuitarProject` - there is no
`GuitarProject | null` threaded through the editor because no project exists
until one is chosen. That is also why choosing Bass cannot flash a guitar
project: `createProject` runs on submit, not on selection.

`EditorApp` is keyed by a session id, so New Design gets a fresh editor.
Undo history, selections and the guide image belong to the document that was
open, and none of them survive into the next one.

Unsaved-change tracking is its own `isDirty` flag, not `canUndo`: undoing to
the start still leaves a redo stack, and saving does not clear history.

Controls on the New Design screen are real `<input type="radio">` elements
inside `<label>`s. Arrow-key movement, Space, and the single roving tab stop
come from the platform - a `div` with an `onClick` would have to reimplement
all three.

## Opening a plan from a link

`/app?plan=/marketing/foo.axe.svg` fetches that file and loads it as the
project, which is how the public page's "Open it in the editor" works. The
deep link bypasses the New Design screen entirely - `EditorRoute` starts in a
`loading` state when the parameter is present, so a link never flashes the
chooser on its way to the drawing someone was sent. A plan that fails to load
falls back to the chooser, not to a default project nobody asked for.

Two things are load-bearing in `planParamFromLocation` / its effect in
`src/App.tsx`:

- The value must be a **same-origin absolute path**. It is fetched and loaded
  as project data, so accepting `https://...` or protocol-relative `//host/...`
  would let a crafted link drop arbitrary content into someone's editor.
- The plan becomes the shell's chosen project rather than an undoable edit on
  top of something else, so undo is empty when it opens. The parameter is then
  stripped with `history.replaceState`, because otherwise a reload re-applies
  the plan and silently discards whatever the user has drawn since.

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
