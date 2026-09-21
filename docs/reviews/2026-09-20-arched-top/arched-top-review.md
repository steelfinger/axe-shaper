# Arched body top: independent review

Reviewed 20 September 2026 against the remote `codex/arched-body-top` branches:

| Repository | Reviewed revision |
|---|---|
| Web editor | `280a1a7` |
| iOS | `9e5875c` |
| 3D viewer | `8b9e058` |

The local iOS and viewer checkouts were each three commits behind. Those remote commits were fetched and tested in separate temporary worktrees. The main checkouts were not advanced or edited. Findings reproduced on the older local viewer were rechecked against the latest revision.

> **Superseded, 21 September 2026.** This is the review as it stood against the
> revisions in the table above. Every finding it raised has since been closed;
> see the note on [the status table](#status-of-every-supplied-finding) for what
> closed each one. Read the sections below as the record of what was found, not
> as open work.

## Assessment

Several fixes are sound, particularly the viewer fallback and the blueprint payload migration. The feature does not need to be rewritten. The main concern is that the final web fix changes product semantics: choosing a preview construction now overwrites authored edge geometry. That decision is not implemented consistently in iOS and is not necessary merely to draw a straight preview wall.

I would resolve the editing policy and the binding geometry before merging. Keep the renderer fixes; do not treat rewriting the format document as proof that all writers follow it.

## Findings that still matter

### 1. High: the latest web fix discards a tuned edge profile, while iOS preserves it

[Web selection handler](https://github.com/steelfinger/axe-shaper/blob/280a1a7d72e22478efa58998bb2e20f3a02e27ee/src/components/Sidebar.tsx#L150) · [native selection helper](https://github.com/steelfinger/axe-shaper-ios/blob/9e5875c0f45d2b4d1279a97ef7745260e14a13fa/AxeShaper/Model/ProjectEditing.swift#L183) · [native preservation test](https://github.com/steelfinger/axe-shaper-ios/blob/9e5875c0f45d2b4d1279a97ef7745260e14a13fa/AxeShaperTests/M24ModelTests.swift#L356)

Reproduced by executing the current web handler with its real profile constants:

| Action | Stored profile |
|---|---|
| Start | Beveled, width 12 mm, angle 30° |
| Choose Arched Top | Slab, ease 0 mm |
| Return to Beveled | Beveled, width 15 mm, angle 45° |

The intermediate `78f18d3` fix preserved tuned values when returning to the same stored kind. The subsequent `280a1a7` change destroys those values when entering Arched Top, so that earlier protection no longer preserves this round trip. Undo can recover the edit, but toggling back cannot.

iOS still deliberately leaves `edgeProfile` untouched. Its latest renderer, however, ignores that profile for arched bodies and draws a straight wall. Consequently the same selection has different saved-data and plan-drawing consequences in the two editors. The new comments describing shaped profiles as only an old-writer/hand-edit case are false for the current iOS writer.

**Recommended direction:** preserve the authored profile and make its relationship to the preview explicit in both editors. If mutually exclusive treatments are the intended product behavior, implement that deliberately in both editors with an agreed restoration/data-loss policy. Do not silently settle this through a renderer bug fix.

### 2. Medium: back binding is positioned on the old body depth

[Viewer assembly](https://github.com/steelfinger/axe-shaper-3D-viewer/blob/8b9e0589c3fde48227ab803b032a56cbef1fa18e/src/core/archedInstrument.ts#L748) · [native binding construction](https://github.com/steelfinger/axe-shaper-ios/blob/9e5875c0f45d2b4d1279a97ef7745260e14a13fa/AxeShaper/Mesh/InstrumentMeshBuilder.swift#L423)

A solid carve subtracts its rise from the core depth, moving the body's back toward the rim. Both binding paths still use the original document thickness. In the viewer the body meshes are replaced after the flat instrument is built, while binding is returned unchanged.

Reproduced on the latest viewer with a 45 mm body, solid carve, slab edge and top-and-back binding:

- Body back: approximately Z = −37.00005 mm.
- Back binding: Z = −45.05 to −38.65 mm.
- The whole strip is below the body, with a gap of approximately 1.65 mm even at its nearest edge.

The native code has the same thickness mismatch: body construction subtracts 8 mm, while `BindingMesh.build` receives `project.resolvedBodyThicknessMm`. This native case was identified from the build inputs; the numeric reproduction above is from the viewer.

For files containing both a shaped profile and an arch, binding also still follows the original shaped profile while the body wall is now slab. Bindings should be built from the same effective profile and rim-to-back depth as the resolved body.

### 3. Medium: the viewer still performs its first solve with the wrong profile

[Current viewer App at reviewed revision](https://github.com/steelfinger/axe-shaper-3D-viewer/blob/8b9e0589c3fde48227ab803b032a56cbef1fa18e/src/App.tsx#L192)

The memo uses `archParameters` initialized from the carved-cap defaults. An effect later replaces them with the saved construction's parameters. A React integration probe on the latest branch observed these two calls when opening one solid carve:

1. Rise 14 mm, thickness basis `core`.
2. Rise 8 mm, thickness basis `overall`.

This is still a redundant full solve with incorrect first-build geometry. Derive production parameters directly from the current project inside the memo; retain mutable study parameters only for the study mode. The probe confirms the two builds, not that users necessarily see a visible flash before the lazy stage loads.

### 4. Medium: the blueprint fix has not reached the other repositories

[Web blueprint loading](https://github.com/steelfinger/axe-shaper/blob/280a1a7d72e22478efa58998bb2e20f3a02e27ee/src/constants/templates.ts#L62) · [native blueprint injection](https://github.com/steelfinger/axe-shaper-ios/blob/9e5875c0f45d2b4d1279a97ef7745260e14a13fa/AxeShaper/App/BlueprintLibrary.swift#L240)

The web fix is correct: all 16 authored files are schema 5, and Single-Cut contains `bodyTop: carved_cap`. Comparing decoded payloads before and after that commit showed only schema-version changes plus Single-Cut's new `bodyTop`; no hardware or contour changes.

The latest iOS and viewer branches still vendor schema-4 blueprints with no `bodyTop`. Native still injects Single-Cut's default in code. Opening that bundled file directly remains different from creating a design through the native blueprint library, and the viewer's bundled Single-Cut is still flat outside the study.

Sync the authored files through the existing contract process and remove the superseded native injection. Current contract checks validate the pinned copies against their own manifests; they do not establish freshness against the current web branch.

## Status of every supplied finding

**All thirteen rows below are closed.** The table is a 20 September snapshot;
verified 21 September against web `2909a5f`, iOS `0053b4f` and viewer
`8f7eb65`, with both suites run locally (viewer `npm run check`, 280 tests;
iOS 1,075 tests, 0 failures). What closed each row:

| Row | Closed by |
|---|---|
| Blank viewer after a carve failure | Already fixed when the review ran (viewer `1b2a722`); still is. |
| Resetting tuned edge values when leaving Arched Top | The *inconsistency* is gone: iOS `d9cbaef` adopted the web policy, so Arched Top writes Slab in both editors. The data loss is retained deliberately — that was the product decision the review asked for, not an oversight. |
| Different arched side walls between viewer and iOS | Walls: viewer `8b9e058`, iOS `1399f51`. Writer policy: iOS `d9cbaef`. Binding: viewer `6386b78`, iOS `d9cbaef`. |
| Visible cap-band promise / numeric defaults in editor copy | Web `0349a0a`; the 14 mm / 8 mm figures are out of the copy. |
| Hidden profile while plan and per-node controls still use it | Web `280a1a7` and iOS `d9cbaef` both force Slab, so the plan and the preview agree. The exclusivity rule is in `AXE_SVG_FORMAT.md` (`82c3a02`). |
| Misplaced schema-v5 heading | Web `82c3a02`. |
| Stale bundled blueprints / weakened version check | All 16 payloads are byte-identical across the three repos (iOS `d9cbaef`, viewer `6386b78`), and the assertion now covers all 16 with a count guard, not just the S-style base (web `1ab86a3`). |
| Missing `solid_body_carve` interoperability fixture | Web `0349a0a`, viewer `6386b78`; the checker requires both constructions. |
| Wrong first-render solid-carve parameters | Viewer `368e496` — one build, correct parameters. |
| Wrong preview triangle statistics | Viewer `6386b78` — counts `capBand` + `coreBand`, with an assertion tying the reported count to the parts in the assembly. |
| No shared numeric solver fixture | `archedBodyCases` (iOS `430c7d7`, viewer `368e496`) pins the carve; `archedAssemblyCases` (iOS `aaaca6e`, viewer `5cea8fb`) pins the assembly datums. |
| Native comment says renderer has not arrived | iOS `430c7d7`. |
| Stale Bass/4 viewer guidance | Web `0349a0a`. |

Two things the review could not have known, both settled since:

- Matching cap vertex counts did **not** prove tessellation parity. Earcut chose
  the opposite diagonal even on a square, so equal counts and equal sampled
  heights concealed a different piecewise-linear surface; viewer `368e496`
  switched to the repo's own ear clipper.
- Assembled arched instruments are under contract for their shared *physics*,
  not their triangle digests. The two renderers legitimately differ — the viewer
  routs a neck-pocket cavity and splits its wall into a textured cap band, which
  native does not build. The boundary is stated in the viewer's
  `docs/MESH_PARITY.md` and iOS's `docs/m22-cross-platform-3d-mesh-corpus.md`.

The companion [`arched-review-probes.test.ts`](arched-review-probes.test.ts)
carries the same caveat in its own header: three of its four probes now fail by
design, because they assert the defects that were fixed.


| Original finding | Current status |
|---|---|
| Blank viewer after a carve failure | **Fixed on remote.** Stage remains mounted and a non-fatal note appears. Rechecked with a thin-body integration probe. |
| Resetting tuned edge values when leaving Arched Top | **Superseded by a new loss path.** Same-kind return is protected, but entering Arched Top now discards the profile in web. |
| Different arched side walls between viewer and iOS | **Fixed at the body renderer level.** Both latest renderers use slab walls. Writer policy and binding remain inconsistent. |
| Visible cap-band promise / numeric defaults in editor copy | **Partly fixed.** The cap-band promise is gone. The web copy still hardcodes 14 mm / 8 mm. Current native rise defaults match; future drift is a maintenance concern, not a demonstrated current geometry error. |
| Hidden profile while plan and per-node controls still use it | **Partly addressed.** Web clears it on new selection and now exposes stored profile controls. Native still keeps it, while its renderer now ignores it. Imported mixed documents still require a clear editing policy. |
| Misplaced schema-v5 heading | **Fixed.** The remaining control bullets are back under v4. |
| Stale bundled blueprints / weakened version check | **Fixed in web only.** Strict equality is restored; native/viewer copies are stale. The equality assertion itself checks the S-style base blueprint, not all 16 files. |
| Missing `solid_body_carve` interoperability fixture | **Still open.** The current v5 set contains only one arched fixture: carved-cap `controls.axe.svg`. The checker still requires only carved-cap coverage. |
| Wrong first-render solid-carve parameters | **Still open; reproduced.** |
| Wrong preview triangle statistics | **Still open; reproduced.** One cap comparison reports 8,994 triangles while its rendered meshes contain 9,522. Normal registered-assembly statistics use a separate path. |
| No shared numeric solver fixture | **Still open.** Matching property tests are useful but do not prove cross-language numeric agreement. A small sampled-height fixture remains a sensible follow-up. |
| Native comment says renderer has not arrived | **Still open.** `PayloadSchema.swift` still contains the obsolete comment. |
| Stale Bass/4 viewer guidance | **Still open.** `CLAUDE.md` and Header comments describe a disabled action, while `App.tsx` passes `view3DAvailable` as true. This predates the feature and is documentation cleanup, not evidence that bass needs to be disabled again. |

## Validation

- Web: `corpus:check`, `schema:check`, `bass:check`, `fixtures:check`, lint and TypeScript passed. The known App hook-dependency lint warning remains.
- Latest viewer: 270 tests across 28 files passed; lint, contract check, preview capability check and TypeScript passed.
- Four additional temporary viewer probes passed: fallback notice and stage mounting; incorrect first solve; detached back binding; triangle undercount.
- Web handler probe confirmed the 12 mm / 30° → slab → 15 mm / 45° transition.
- Latest iOS: 55 targeted tests passed with zero failures, covering `BodyMeshBuilderTests`, `M29ArchedTopTests`, `ArchedTopSelectionTests` and `BodyTopCodingTests`, on an iPad simulator.

The integration probes mock the WebGL stage while exercising the real App and mesh builders. They establish control flow and numeric geometry, not a screenshot-based visual inspection. No production source changes were made.

The [viewer probes](arched-review-probes.test.ts) are retained beside this report. To rerun, copy that file into the reviewed viewer's `tests/` directory and run `npx vitest run tests/arched-review-probes.test.ts`. They assert the observed current behavior, including the remaining defects; they are diagnostic reproductions, not acceptance tests for the eventual fixes.
