# Updated implementation plan: layer-aware object selection

Updated 9 October 2026 from the agreed “Improve object selection” plan.

## Scope and model

Include Pickups, Pots (potentiometers), Toggles (selector switches), and Jacks in shared selection, on the desktop web canvas and native iPad canvas. Both repositories associate this hardware with **Body Outline**. Pickups is a hardware category, not an `ActiveLayer` case; selecting a pickup activates Body Outline. Do not introduce a new layer or change the file schema for this improvement.

## Selection contract

1. Keep existing active-layer node, handle, hardware, and outline priority. On a construction layer, its eligible outline must also precede overlapping hardware on Body Outline.
2. If the active layer misses, hit-test visible hardware through one shared resolver. Preserve existing hardware paint order (jacks, switches, pots, pickups; later placements win).
3. If hardware also misses, preserve nearest eligible construction-outline fallback and paint-order tie-breaking.
4. Activate the winning layer before publishing its selection. A single click/tap must both activate and select, including a segment on another contour.
5. Exclude hidden and locked construction layers, hidden hardware categories, and locked/hidden guide images under their existing policies. Locked anchors remain inspectable but cannot be dragged.
6. Retain pan, zoom, calibration, multi-selection, drag thresholds, rotation, snapping, undo grouping, cancellation, and double-click/double-tap insertion behavior.
7. Mouse and Pencil use precise hit regions; finger input gets a larger screen-space tolerance. Use transformed rendered footprints for rotated hardware rather than broad bounding boxes.

## Implementation phases

- [x] Investigate both repositories, active-layer ownership, hit geometry, and input routing.
- [x] Web: consolidate click and tap picking in `CanvasWorkspace`; tag existing hardware footprints, retain listening for cross-layer picking, and keep drag handlers and active-layer drag gates.
- [x] Web: prioritize active contour hits, fall back to visible hardware and eligible outlines, activate and select in the same event, and enlarge finger tolerance.
- [x] Native: extract `ContourEditing.hardwareTarget` for active-body and cross-layer use. Resolve active construction targets first, then hardware; activate Body Outline before entering existing hardware gesture states.
- [x] Native: apply global visibility toggles to active construction eligibility and preserve construction fallback restrictions.
- [x] Native: classify indirect mouse/trackpad touches as pointer input, use the precise Pencil radius, and keep the existing finger-style target/navigation arbitration.
- [x] Native: expand pickup footprint hit-testing by the existing input-policy tolerance; preserve exact containment for callers using the default zero tolerance.
- [x] Add browser regressions for all four types with mouse/finger, active-outline overlap, hidden controls, and pan mode.
- [x] Add native regressions for all four types with Pencil/finger/pointer, automatic activation and selection, active-outline overlap, hidden hardware, and rotated pickup tolerance.
- [x] Run builds and relevant automated regression suites; record results in the implementation report.
- [ ] Verify on a physical iPad with Apple Pencil and finger, plus a connected mouse/trackpad. Automated controller tests cannot establish OS-level gesture arbitration or hardware event delivery.
- [ ] Verify Safari browser behavior on a physical iPad. Chromium touch simulation is not Safari validation.

## Device acceptance checklist

Start on Pickguard, Front Route, and Back Route in turn. Pick each hardware type away from the active outline: it must activate Body Outline and show the matching selection. Repeat where the active outline crosses hardware: the active contour must win. Hide each category; it must stop receiving picks. Hide or lock construction shapes; they must not intercept fallback. Test rotated pickups and jack plates at several zoom levels and both canvas orientations.

Then exercise Pencil/finger dragging, rotation grips, snap/undo, finger pan away from objects, two-finger pan/pinch, calibration, multiple anchor selection, double-tap insertion, cancellation, and mouse/trackpad input. Web cross-layer activation is a click/tap; existing dragging becomes available after that activation. Native hardware fallback enters the existing pending-drag state immediately.
