import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Path, Text, Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import type { GuitarProject, GuideImageState, Vector2D, CalibrationState } from '../types/guitar';
import {
  anchorsToSVGPath,
  findClosestSegment,
  getSegmentControlPoints,
  insertAnchorOnSegment,
  resetAnchorHandle,
  updateAnchorHandle,
} from '../utils/bezier';
import { applyLiveSymmetry, withMirroredInsertion } from '../utils/symmetry';
import { bevelInsetLoop, closedPolylineToSVGPath } from '../utils/bevelIntensity';
import { type ActiveLayer, getActiveContour, withActiveContour } from '../utils/layerShapes';
import {
  movingPickup,
  pickupRotationHandlePosition,
  rotatingPickupToward,
} from '../utils/pickupEditing';
import { resolveBridgePreset, resolveNeckPreset, resolvePickupSpec } from '../utils/presets';
import {
  getMountingPointOriginYMm,
  getTheoreticalSaddleYMm,
} from '../utils/scaleMath';
import {
  bridgeMountingPointsAreVisible,
  bridgeReferenceLineXRange,
  getBridgeDrawingGeometry,
} from '../utils/bridgeDrawing';
import { ZoomIn, ZoomOut, Maximize2, Hand, Spline } from 'lucide-react';
import {
  SCALE_BAR_STEPS,
  formatLength,
  gridMinorDivisor,
  snapToGridMm,
  toMm,
  unitLabel,
} from '../utils/units';
import { PLAN_DRAWING_STYLE, colorWithAlpha } from '../constants/planDrawingStyle';

/**
 * The body Path's hit area is its fill, so a click a few pixels *outside* the
 * outline misses it entirely. Segment picking therefore runs on the Stage and
 * uses this name to tell "clicked the body" apart from "clicked a node handle".
 */
const BODY_OUTLINE_NAME = 'body-outline';

/** How close to the outline a click has to land to select or split a segment. */
const PICK_TOLERANCE_PX = 12;

// One undo step per drag, not per mousemove: every update in a gesture carries
// the same key, so history records only the first.
const anchorDragKey = (id: string) => `anchor:${id}`;
const handleDragKey = (id: string, type: 'in' | 'out') => `handle:${id}:${type}`;
const GUIDE_DRAG_KEY = 'guide:move';
const pickupMoveKey = (id: string) => `pickup:move:${id}`;
const pickupRotateKey = (id: string) => `pickup:rotate:${id}`;
// Konva only ever has one drag gesture in flight, so a single fixed key -
// rather than one derived from the selected id set - is enough to coalesce
// a whole multi-anchor drag into one undo step.
const MULTI_ANCHOR_DRAG_KEY = 'anchor-multi-drag';

interface CanvasWorkspaceProps {
  project: GuitarProject;
  selectedAnchorIds: Set<string>;
  onSelectAnchor: (id: string | null, shiftKey?: boolean) => void;
  selectedSegmentIndex: number | null;
  onSelectSegment: (index: number | null) => void;
  selectedPickupId: string | null;
  onSelectPickup: (id: string | null) => void;
  /** Model-space cursor position, live, for the sidebar readout - null while the pointer is off the canvas. */
  onCursorMove: (pos: Vector2D | null) => void;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  /** Snapshot before an edit; pass the same key the following updates use. */
  onBeginEdit: (coalesceKey?: string) => void;
  /** Close the current gesture so the next drag is its own undo step. */
  onEndEdit: () => void;
  guideImage: GuideImageState;
  onUpdateGuideImage: (
    updater: (prev: GuideImageState) => GuideImageState,
    coalesceKey?: string
  ) => void;
  calibration: CalibrationState;
  onCalibrationPick: (point: Vector2D) => void;
  onApplyCalibration: (knownDistanceMm: number) => void;
  onCancelCalibration: () => void;
  /** Which contour a gesture on this canvas edits - the body by default. */
  activeLayer: ActiveLayer;
}


export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  project,
  selectedAnchorIds,
  onSelectAnchor,
  selectedSegmentIndex,
  onSelectSegment,
  selectedPickupId,
  onSelectPickup,
  onCursorMove,
  onUpdateProject,
  onBeginEdit,
  onEndEdit,
  guideImage,
  onUpdateGuideImage,
  calibration,
  onCalibrationPick,
  onApplyCalibration,
  onCancelCalibration,
  activeLayer,
}) => {
  const [knownDistanceInput, setKnownDistanceInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  // Model-space starting positions of every selected anchor, captured once at
  // the start of a multi-anchor drag gesture. Every onDragMove tick applies
  // the grabbed anchor's delta-from-start to these fixed originals - never
  // chaining off the previous tick's already-moved position, which would
  // compound drift and let grid-snap on the grabbed anchor warp the
  // followers' spacing. Null outside a multi-drag gesture.
  const dragStartPositionsRef = useRef<Map<string, Vector2D> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.2); // 1.2 px per mm base scale
  const [panOffset, setPanOffset] = useState<Vector2D>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isModifierPanning, setIsModifierPanning] = useState(false);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  // Show every anchor's bezier handles at once, instead of only the selected one's
  const [showAllHandles, setShowAllHandles] = useState(false);

  // pickguards/frontRoutes/backRoutes are optional on GuitarProject - a file
  // from before this feature existed genuinely lacks the key - so default
  // here rather than at every .map()/.filter() below.
  const { contour, settings, pickups, pickguards = [], frontRoutes = [], backRoutes = [], activeTemplateId } = project;
  const neck = resolveNeckPreset(project);
  const bridge = resolveBridgePreset(project);
  const activeTemplate = REFERENCE_TEMPLATES[activeTemplateId] || REFERENCE_TEMPLATES.s_style;

  const isBodyActive = activeLayer.kind === 'body';
  // The contour a gesture on this canvas actually reads/writes - `contour`
  // itself when body is active (every file today), a pickguard/route's own
  // contour otherwise. Falls back to the body if the active shape's id has
  // gone missing (e.g. deleted from another tab) rather than editing nothing.
  const activeContour = getActiveContour(project, activeLayer) ?? contour;

  const isHorizontal = settings.canvasOrientation === 'horizontal';
  const rotation = isHorizontal ? 90 : 0;

  // Origin offset: Vertical -> top centered; Horizontal -> right side centered (neck joint points right)
  const baseOriginX = isHorizontal ? dimensions.width - 150 : dimensions.width / 2;
  const baseOriginY = isHorizontal ? dimensions.height / 2 : 120;

  const originX = baseOriginX + panOffset.x;
  const originY = baseOriginY + panOffset.y;

  // Spacebar or Alt/Option held down = temporary pan mode. Alt is the spare
  // modifier here: Ctrl-drag is a right-click on macOS, and Shift is reserved
  // for constrained drags.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      // Bare Alt focuses the menu bar on Windows; suppress that so it can pan
      if (e.key === 'Alt') e.preventDefault();
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'h') {
          e.preventDefault();
          setShowAllHandles((p) => !p);
        } else if (key === 'p') {
          e.preventDefault();
          setIsPanToolActive((p) => !p);
        }
      }
      setIsModifierPanning(e.altKey);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
      setIsModifierPanning(e.altKey);
    };

    // Alt-Tab and friends swallow the keyup, which would leave pan mode stuck on
    const releaseAll = () => {
      setIsSpacePressed(false);
      setIsModifierPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
    };
  }, []);

  // A ResizeObserver rather than a window resize listener: the container can be
  // 0x0 at mount (hidden tab, late layout) and a 0-sized Konva stage throws when
  // it builds its buffer canvas. The observer fires again once it has a real size.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => setDimensions({ width: node.offsetWidth, height: node.offsetHeight });
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Conversions using rotation
  const toScreen = (pt: Vector2D): Vector2D => {
    const rad = (rotation * Math.PI) / 180;
    const rx = pt.x * Math.cos(rad) - pt.y * Math.sin(rad);
    const ry = pt.x * Math.sin(rad) + pt.y * Math.cos(rad);
    return {
      x: originX + rx * zoom,
      y: originY + ry * zoom,
    };
  };

  const toModel = (screenPt: Vector2D): Vector2D => {
    const dx = (screenPt.x - originX) / zoom;
    const dy = (screenPt.y - originY) / zoom;
    const rad = (-rotation * Math.PI) / 180;
    return {
      x: dx * Math.cos(rad) - dy * Math.sin(rad),
      y: dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  };

  // Ghost template path data
  const ghostSVGPath = anchorsToSVGPath(activeTemplate.defaultAnchors, true);
  // Live body path data
  const bodySVGPath = anchorsToSVGPath(contour.anchors, contour.closed);
  // The physical boundary between the flat top and a Beveled/German-Carve edge.
  // This is the same flattened spline + Tiller-Hanson offset used by iOS.
  const bevelInset = bevelInsetLoop(project);
  const bevelInsetPath = bevelInset ? closedPolylineToSVGPath(bevelInset) : '';
  // The currently-editable contour's path - same as bodySVGPath when the body is active
  const activeSVGPath = isBodyActive ? bodySVGPath : anchorsToSVGPath(activeContour.anchors, activeContour.closed);

  // Theoretical saddle & bridge Y mm (measured from body pocket entrance edge Y=0)
  const theoreticalSaddleY = getTheoreticalSaddleYMm(neck);
  const bridgeDrawing = getBridgeDrawingGeometry(neck, bridge);
  const [bridgeReferenceMinX, bridgeReferenceMaxX] = bridgeReferenceLineXRange(bridgeDrawing);
  const mountingOriginY = getMountingPointOriginYMm(neck, bridge);

  // Wheel Zoom handler
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
    setZoom(Math.min(Math.max(0.4, newZoom), 10));
  };

  // Node Dragging Handler
  const handleAnchorDragMove = (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
    const newScreenX = e.target.x();
    const newScreenY = e.target.y();

    const modelPt = toModel({ x: newScreenX, y: newScreenY });
    let newModelX = modelPt.x;
    let newModelY = modelPt.y;

    if (settings.snapToGridEnabled) {
      newModelX = snapToGridMm(newModelX, settings.gridSizeMm, settings.unitDisplay);
      newModelY = snapToGridMm(newModelY, settings.gridSizeMm, settings.unitDisplay);
    }

    const anchor = activeContour.anchors[index];

    // Pocket constraint: If anchor is locked, keep x snapped to joint width.
    // A body-only concept - the neck pocket only exists relative to the body.
    // Only reachable via the single-anchor path below: a locked anchor is
    // never draggable, so it can never be the grabbed node in a multi-drag.
    if (isBodyActive && anchor.locked) {
      newModelY = 0; // Lock to Y=0 joint line
      if (anchor.semanticRole === 'neck_pocket_left') newModelX = -neck.jointWidthMm / 2;
      if (anchor.semanticRole === 'neck_pocket_right') newModelX = neck.jointWidthMm / 2;
    }

    const dragStarts = dragStartPositionsRef.current;
    if (dragStarts && selectedAnchorIds.size > 1) {
      const startPos = dragStarts.get(anchor.id);
      if (!startPos) return;
      const dx = newModelX - startPos.x;
      const dy = newModelY - startPos.y;

      onUpdateProject((prev) => {
        const prevContour = getActiveContour(prev, activeLayer);
        if (!prevContour) return prev;
        // Live-centerline mirroring is intentionally skipped here - every
        // selected anchor moves by the same delta and nothing else moves
        // as a side effect during a multi-anchor drag.
        const updatedAnchors = prevContour.anchors.map((a) => {
          const start = dragStarts.get(a.id);
          if (!start) return a;
          return { ...a, position: { x: start.x + dx, y: start.y + dy } };
        });
        return withActiveContour(prev, activeLayer, { ...prevContour, anchors: updatedAnchors });
      }, MULTI_ANCHOR_DRAG_KEY);
      return;
    }

    onUpdateProject((prev) => {
      const prevContour = getActiveContour(prev, activeLayer);
      if (!prevContour) return prev;
      const updatedAnchors = [...prevContour.anchors];
      updatedAnchors[index] = {
        ...anchor,
        position: { x: newModelX, y: newModelY },
      };

      // Live-centerline mirroring only exists for the body.
      const finalAnchors = isBodyActive
        ? applyLiveSymmetry(updatedAnchors, anchor.id, prev.settings.symmetry)
        : updatedAnchors;

      return withActiveContour(prev, activeLayer, { ...prevContour, anchors: finalAnchors });
    }, anchorDragKey(anchor.id));
  };

  // Handle Drag Move (Bezier handleIn or handleOut)
  const handleHandleDragMove = (
    index: number,
    handleType: 'in' | 'out',
    e: Konva.KonvaEventObject<DragEvent>
  ) => {
    const newScreenX = e.target.x();
    const newScreenY = e.target.y();

    const anchor = activeContour.anchors[index];
    const anchorScreen = toScreen(anchor.position);

    // Delta in screen pixels
    const deltaScreenX = newScreenX - anchorScreen.x;
    const deltaScreenY = newScreenY - anchorScreen.y;

    // Rotate delta back to model space
    const rad = (-rotation * Math.PI) / 180;
    const offsetX = (deltaScreenX * Math.cos(rad) - deltaScreenY * Math.sin(rad)) / zoom;
    const offsetY = (deltaScreenX * Math.sin(rad) + deltaScreenY * Math.cos(rad)) / zoom;

    onUpdateProject((prev) => {
      const prevContour = getActiveContour(prev, activeLayer);
      if (!prevContour) return prev;
      const updatedAnchors = [...prevContour.anchors];
      const target = updateAnchorHandle(anchor, handleType, { x: offsetX, y: offsetY });

      updatedAnchors[index] = target;
      const finalAnchors = isBodyActive
        ? applyLiveSymmetry(updatedAnchors, anchor.id, prev.settings.symmetry)
        : updatedAnchors;

      return withActiveContour(prev, activeLayer, { ...prevContour, anchors: finalAnchors });
    }, handleDragKey(anchor.id, handleType));
  };

  // Escape hatch for a handle dragged somewhere unreachable (typically right on
  // top of its own anchor) - double-click snaps it back out to a grabbable length.
  const handleHandleReset = (index: number, handleType: 'in' | 'out') => {
    const anchor = activeContour.anchors[index];
    onUpdateProject((prev) => {
      const prevContour = getActiveContour(prev, activeLayer);
      if (!prevContour) return prev;
      const updatedAnchors = resetAnchorHandle(prevContour.anchors, index, handleType, prevContour.closed);
      const finalAnchors = isBodyActive
        ? applyLiveSymmetry(updatedAnchors, anchor.id, prev.settings.symmetry)
        : updatedAnchors;

      return withActiveContour(prev, activeLayer, { ...prevContour, anchors: finalAnchors });
    });
  };

  const isPanMode = isPanToolActive || isSpacePressed || isModifierPanning;

  // The bug this closes: releasing Space/Alt (or the window losing focus -
  // `releaseAll` above, on blur) mid-pan-drag flips `draggable` off on the
  // Stage, but does nothing about a drag Konva is already tracking. If that
  // drag never gets a mouseup - blur is exactly the case where the browser
  // may never deliver one - `onDragEnd` never runs, so the live offset never
  // folds into `panOffset` and the Stage's own transform never resets to
  // zero. Every click afterward still computes model coordinates from
  // `panOffset` (React state, unaware anything is wrong) while the canvas is
  // actually rendered shifted by Konva's leftover internal position - a
  // fixed-pixel offset on every future click/segment-pick/calibration-pick,
  // invisible to React and unrecoverable without a reload since nothing
  // re-renders it away. `stopDrag()` is a no-op if nothing is dragging, and
  // otherwise synchronously fires the real `dragend` - the Stage's own
  // `onDragEnd` below is what actually commits `panOffset` and zeroes the
  // transform back out.
  useEffect(() => {
    if (!isPanMode) stageRef.current?.stopDrag();
  }, [isPanMode]);

  /** Nearest active-contour segment to a stage pointer position, if the click was close enough. */
  const pickSegment = (pointer: Vector2D): number | null => {
    const hit = findClosestSegment(activeContour.anchors, activeContour.closed, toModel(pointer));
    if (!hit) return null;
    // Tolerance in screen px, so it stays the same size as you zoom
    return hit.distance * zoom <= PICK_TOLERANCE_PX ? hit.index : null;
  };

  /** Only empty canvas and the active outline pick segments - never a node or handle. */
  const isOutlinePickTarget = (target: Konva.Node): boolean =>
    target === target.getStage() || target.name() === BODY_OUTLINE_NAME;

  return (
    <div className="app-canvas-container" ref={containerRef}>
      {/* Floating Canvas Toolbar */}
      <div className="canvas-toolbar">
        <button
          className={`btn btn-sm ${isPanToolActive ? 'btn-primary' : ''}`}
          onClick={() => setIsPanToolActive((p) => !p)}
          title="Pan / Move Canvas. Press P to keep it on, or hold Spacebar / Alt-Option"
        >
          <Hand size={14} /> Pan (P)
        </button>

        <button
          className={`btn btn-sm ${showAllHandles ? 'btn-primary' : ''}`}
          onClick={() => setShowAllHandles((p) => !p)}
          title="Show bezier handles for every node, not just the selected one"
        >
          <Spline size={14} /> Handles (H)
        </button>

        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        <button className="btn btn-sm" onClick={() => setZoom((z) => Math.max(0.4, z / 1.15))} title="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <span className="zoom-text">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(10, z * 1.15))} title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            setZoom(1.2);
            setPanOffset({ x: 0, y: 0 });
            // Belt and suspenders alongside the isPanMode effect above: if the
            // Stage's own Konva-internal position is ever left non-zero by some
            // other path this doesn't cover, resetting only the React state
            // above wouldn't touch it, and every click would stay offset.
            stageRef.current?.position({ x: 0, y: 0 });
          }}
          title="Recenter Canvas & Reset Zoom"
        >
          <Maximize2 size={14} /> Recenter
        </button>
      </div>

      <Stage
        ref={stageRef}
        // Never 0: Konva throws building its buffer canvas at zero size, and the
        // container really can measure 0x0 for a frame before layout settles.
        width={Math.max(1, dimensions.width)}
        height={Math.max(1, dimensions.height)}
        onWheel={handleWheel}
        onMouseMove={(e) => {
          const pointer = e.target.getStage()?.getPointerPosition();
          onCursorMove(pointer ? toModel(pointer) : null);
        }}
        onMouseLeave={() => onCursorMove(null)}
        draggable={isPanMode}
        onDragStart={(e) => {
          if (e.target === e.target.getStage()) {
            setIsDraggingStage(true);
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setIsDraggingStage(false);
            const pos = e.target.position();
            setPanOffset((prev) => ({
              x: prev.x + pos.x,
              y: prev.y + pos.y,
            }));
            e.target.position({ x: 0, y: 0 });
          }
        }}
        style={{
          cursor: isPanMode ? (isDraggingStage ? 'grabbing' : 'grab') : 'default',
        }}
        onClick={(e) => {
          if (calibration.active) {
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer) onCalibrationPick(toModel(pointer));
            return;
          }
          if (isPanMode || !isOutlinePickTarget(e.target)) return;

          const pointer = e.target.getStage()?.getPointerPosition();
          if (!pointer) return;
          const index = pickSegment(pointer);
          onSelectSegment(index);
          // A click out in open space, or well inside the body, clears everything
          if (index === null) {
            onSelectAnchor(null);
            onSelectPickup(null);
          }
        }}
        onDblClick={(e) => {
          if (isPanMode || calibration.active || !isOutlinePickTarget(e.target)) return;

          const pointer = e.target.getStage()?.getPointerPosition();
          if (!pointer) return;
          const hit = findClosestSegment(activeContour.anchors, activeContour.closed, toModel(pointer));
          if (!hit || hit.distance * zoom > PICK_TOLERANCE_PX) return;

          // Split up front rather than inside the updater: React runs the updater
          // after the handler returns, so an id read from in there is always empty
          let updated = insertAnchorOnSegment(activeContour.anchors, hit.index, hit.t);
          const insertedId = updated[hit.index + 1]?.id;
          // Live-centerline mirroring only exists for the body.
          if (insertedId && isBodyActive) {
            updated = withMirroredInsertion(updated, insertedId, settings.symmetry, activeContour.closed);
          }

          onUpdateProject((prev) => withActiveContour(prev, activeLayer, { ...activeContour, anchors: updated }));
          if (insertedId) onSelectAnchor(insertedId);
        }}
      >
        {/* LAYER 0: GRID, GHOST GUIDE, GUIDE IMAGE & BACK ROUTES - merged into one
            Konva Layer to stay within the recommended 3-5 layer budget. Each
            piece keeps its own Group (screen-space grid vs model-space
            ghost/guide-image/back-routes), and only the guide image needs to be
            hittable, so the layer's own listening flag matches its old layer
            and the rest get an explicit listening={false} on their Group. */}
        <Layer listening={!isPanMode && !calibration.active && isBodyActive}>
          <Group listening={false}>
          {settings.showGrid && (
            <Group>
              {(() => {
                // Model-space bounds of the visible viewport. Rotation is only ever
                // 0 or 90 degrees, so the corner bounding box is the visible area.
                const corners = [
                  toModel({ x: 0, y: 0 }),
                  toModel({ x: dimensions.width, y: 0 }),
                  toModel({ x: 0, y: dimensions.height }),
                  toModel({ x: dimensions.width, y: dimensions.height }),
                ];
                const minX = Math.min(...corners.map((c) => c.x));
                const maxX = Math.max(...corners.map((c) => c.x));
                const minY = Math.min(...corners.map((c) => c.y));
                const maxY = Math.max(...corners.map((c) => c.y));

                const majorMm = settings.gridSizeMm > 0 ? settings.gridSizeMm : 50;
                const minorMm = majorMm / gridMinorDivisor(settings.unitDisplay);
                // Drop the minor lines once they crowd together on screen
                const stepMm = minorMm * zoom >= 5 ? minorMm : majorMm;

                const isMajor = (v: number) => Math.abs(v / majorMm - Math.round(v / majorMm)) < 1e-6;
                const nodes: React.JSX.Element[] = [];

                for (let i = Math.floor(minX / stepMm); i <= Math.ceil(maxX / stepMm); i++) {
                  const x = i * stepMm;
                  const major = isMajor(x);
                  const a = toScreen({ x, y: minY });
                  const b = toScreen({ x, y: maxY });
                  nodes.push(
                    <Line
                      key={`grid_x_${i}`}
                      points={[a.x, a.y, b.x, b.y]}
                      stroke={major ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
                      strokeWidth={1}
                    />
                  );
                  if (major && x !== 0) {
                    nodes.push(
                      <Text
                        key={`grid_xl_${i}`}
                        x={a.x + (isHorizontal ? -46 : 4)}
                        y={a.y + (isHorizontal ? 4 : 6)}
                        text={formatLength(x, settings.unitDisplay, 0)}
                        fill="rgba(255,255,255,0.38)"
                        fontSize={10}
                      />
                    );
                  }
                }

                for (let i = Math.floor(minY / stepMm); i <= Math.ceil(maxY / stepMm); i++) {
                  const y = i * stepMm;
                  const major = isMajor(y);
                  const a = toScreen({ x: minX, y });
                  const b = toScreen({ x: maxX, y });
                  nodes.push(
                    <Line
                      key={`grid_y_${i}`}
                      points={[a.x, a.y, b.x, b.y]}
                      stroke={major ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
                      strokeWidth={1}
                    />
                  );
                  if (major && y !== 0) {
                    nodes.push(
                      <Text
                        key={`grid_yl_${i}`}
                        x={a.x + (isHorizontal ? 4 : 6)}
                        y={a.y + (isHorizontal ? 6 : 4)}
                        text={formatLength(y, settings.unitDisplay, 0)}
                        fill="rgba(255,255,255,0.38)"
                        fontSize={10}
                      />
                    );
                  }
                }

                return nodes;
              })()}
            </Group>
          )}

          {settings.showCenterAxis && (
            <Group>
              {/* Centerline Crosshair (X = 0) */}
              {(() => {
                const p1 = toScreen({ x: 0, y: -100 });
                const p2 = toScreen({ x: 0, y: 550 });
                return (
                  <Line
                    points={[p1.x, p1.y, p2.x, p2.y]}
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    opacity={0.6}
                  />
                );
              })()}
              <Text x={originX + 8} y={15} text="Centerline Axis (X=0)" fill="#38bdf8" fontSize={11} opacity={0.7} />

              {/* Neck Joint Line (Y = 0) */}
              {(() => {
                const p1 = toScreen({ x: -200, y: 0 });
                const p2 = toScreen({ x: 200, y: 0 });
                return (
                  <Line
                    points={[p1.x, p1.y, p2.x, p2.y]}
                    stroke="#d1a53d"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    opacity={0.6}
                  />
                );
              })()}
              <Text x={20} y={originY - 18} text="Neck Pocket Joint Line (Y=0)" fill="#d1a53d" fontSize={11} opacity={0.7} />

              {/* Theoretical Scale Line */}
              {(() => {
                const p1 = toScreen({ x: -150, y: theoreticalSaddleY });
                const p2 = toScreen({ x: 150, y: theoreticalSaddleY });
                return (
                  <Line
                    points={[p1.x, p1.y, p2.x, p2.y]}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    dash={[4, 4]}
                    opacity={0.8}
                  />
                );
              })()}
            </Group>
          )}
          </Group>

          {settings.showGhostGuide && (
            <Group listening={false} x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              <Path data={ghostSVGPath} stroke="#64748b" strokeWidth={1.5 / zoom} dash={[5, 5]} opacity={0.35} />
            </Group>
          )}

          {guideImage.visible && guideImage.element && (
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              <KonvaImage
                image={guideImage.element}
                x={guideImage.offsetXMm}
                y={guideImage.offsetYMm}
                offsetX={guideImage.element.width / 2}
                offsetY={guideImage.element.height / 2}
                scaleX={guideImage.scale}
                scaleY={guideImage.scale}
                rotation={guideImage.rotationDegrees}
                opacity={guideImage.opacity}
                draggable={!isPanMode && isBodyActive && !guideImage.locked}
                onDragStart={() => onBeginEdit(GUIDE_DRAG_KEY)}
                onDragEnd={(e) => {
                  onUpdateGuideImage(
                    (prev) => ({ ...prev, offsetXMm: e.target.x(), offsetYMm: e.target.y() }),
                    GUIDE_DRAG_KEY
                  );
                  onEndEdit();
                }}
              />
            </Group>
          )}

          {/* Back-routed cavities - dashed, drawn under the body fill since a
              cut from the back isn't visible from the front */}
          {settings.showBackRoutes !== false && backRoutes.length > 0 && (
            <Group listening={false} x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              {backRoutes
                .filter((r) => r.visible !== false)
                .map((r) => (
                  <Path
                    key={r.id}
                    data={anchorsToSVGPath(r.contour.anchors, r.contour.closed)}
                    fill={PLAN_DRAWING_STYLE.screen.backRouteFill}
                    stroke={PLAN_DRAWING_STYLE.screen.backRouteStroke}
                    strokeWidth={PLAN_DRAWING_STYLE.screen.layerStrokePx / zoom}
                    dash={PLAN_DRAWING_STYLE.screen.backRouteDashPx.map((length) => length / zoom)}
                  />
                ))}
            </Group>
          )}
        </Layer>

        {/* LAYER 1: LIVE BODY SHAPE (and, while editing one, the active pickguard/route outline) */}
        <Layer listening={!isPanMode && !calibration.active}>
          <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
            {/* Dimmed reference outline of the real body, while editing a different layer */}
            {!isBodyActive && (
              <Path data={bodySVGPath} stroke="#f0f4f8" strokeWidth={1.5 / zoom} opacity={0.15} listening={false} />
            )}
            <Path
              data={activeSVGPath}
              fill={
                isBodyActive
                  ? settings.finishStyle === 'solid'
                    ? settings.bodyColor
                    : settings.finishStyle === 'sunburst'
                    ? '#8a6718'
                    : '#b3861f'
                  : 'rgba(147, 51, 234, 0.18)'
              }
              opacity={isBodyActive ? settings.bodyFillOpacity ?? 0.35 : 1}
              stroke={isBodyActive ? '#f0f4f8' : '#9333ea'}
              strokeWidth={PLAN_DRAWING_STYLE.screen.bodyStrokePx / zoom}
              shadowColor="#000"
              shadowBlur={isBodyActive ? 20 : 0}
              shadowOpacity={isBodyActive ? 0.5 : 0}
              name={BODY_OUTLINE_NAME}
            />
            {bevelInsetPath && (
              <Path
                data={bevelInsetPath}
                fillEnabled={false}
                stroke="#f59e0b"
                strokeWidth={1.25 / zoom}
                dash={[4 / zoom, 3 / zoom]}
                opacity={isBodyActive ? 0.9 : 0.2}
                listening={false}
              />
            )}
            {/* Pickguard - translucent, above the body, under the hardware/pickups */}
            {settings.showPickguard !== false &&
              pickguards
                .filter((p) => p.visible !== false)
                .map((p) => (
                  <Path
                    key={p.id}
                    data={anchorsToSVGPath(p.contour.anchors, p.contour.closed)}
                    fill={colorWithAlpha(
                      p.colorHex ?? '#ffffff',
                      PLAN_DRAWING_STYLE.screen.pickguardFillOpacity
                    )}
                    stroke={PLAN_DRAWING_STYLE.screen.pickguardStroke}
                    strokeWidth={PLAN_DRAWING_STYLE.screen.layerStrokePx / zoom}
                    listening={false}
                  />
                ))}
          </Group>
        </Layer>

        {/* Front routes are their own construction layer. Their visibility is
            independent of the hardware-cavity toggle, matching iOS. */}
        {settings.showFrontRoutes !== false && frontRoutes.length > 0 && (
          <Layer listening={false}>
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              {frontRoutes
                .filter((r) => r.visible !== false)
                .map((r) => (
                  <Path
                    key={r.id}
                    data={anchorsToSVGPath(r.contour.anchors, r.contour.closed)}
                    fill={PLAN_DRAWING_STYLE.screen.frontRouteFill}
                    stroke={PLAN_DRAWING_STYLE.screen.frontRouteStroke}
                    strokeWidth={PLAN_DRAWING_STYLE.screen.layerStrokePx / zoom}
                  />
                ))}
            </Group>
          </Layer>
        )}

        {/* LAYER 2: HARDWARE, ROUTS & PICKUPS - merged into one Layer (see LAYER 0
            above for why). Hardware/routs stay display-only via an explicit
            listening={false} on their Group; pickups keep the layer's own
            listening flag so their drag/rotate handles still hit-test. */}
        {settings.showHardwareCavities && (
          <Layer listening={!isPanMode && !calibration.active && isBodyActive}>
            <Group listening={false} x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              {/* Neck Pocket Cavity */}
              <Rect
                x={-neck.jointWidthMm / 2}
                y={0}
                width={neck.jointWidthMm}
                height={neck.jointDepthMm}
                fill={PLAN_DRAWING_STYLE.screen.neckPocketFill}
                stroke={PLAN_DRAWING_STYLE.screen.neckPocketStroke}
                strokeWidth={PLAN_DRAWING_STYLE.screen.neckPocketStrokePx / zoom}
                cornerRadius={neck.jointCornerRadiusMm}
              />

              {/* Recognisable bridge hardware at the scale-math-resolved
                  position: the supplied F-style plate/housing/socket, a
                  slanted capsule-ended TOM and straight tailpiece, or the
                  defensive two-plate fallback for an unknown id. */}
              <Group>
                {bridgeDrawing.kind === 'f-style' && (
                  <>
                    <Line
                      points={bridgeDrawing.plateOutline.flatMap((point) => [point.x, point.y])}
                      closed
                      fill="rgba(59, 130, 246, 0.15)"
                      stroke="#3b82f6"
                      strokeWidth={1.5 / zoom}
                    />
                    <Rect
                      x={bridgeDrawing.saddleHousing.center.x - bridgeDrawing.saddleHousing.widthMm / 2}
                      y={bridgeDrawing.saddleHousing.center.y - bridgeDrawing.saddleHousing.heightMm / 2}
                      width={bridgeDrawing.saddleHousing.widthMm}
                      height={bridgeDrawing.saddleHousing.heightMm}
                      fill="rgba(59, 130, 246, 0.15)"
                      stroke="#3b82f6"
                      strokeWidth={1.5 / zoom}
                    />
                    <Circle
                      x={bridgeDrawing.armSocket.center.x}
                      y={bridgeDrawing.armSocket.center.y}
                      radius={bridgeDrawing.armSocket.radiusMm}
                      fill="#0b0c10"
                      stroke="#3b82f6"
                      strokeWidth={1.5 / zoom}
                    />
                  </>
                )}
                {bridgeDrawing.kind === 'tom' && (
                  <>
                    <Group
                      x={bridgeDrawing.bridgeBar.center.x}
                      y={bridgeDrawing.bridgeBar.center.y}
                      rotation={bridgeDrawing.bridgeBar.angleDegrees}
                    >
                      <Rect
                        x={-bridgeDrawing.bridgeBar.widthMm / 2}
                        y={-bridgeDrawing.bridgeBar.heightMm / 2}
                        width={bridgeDrawing.bridgeBar.widthMm}
                        height={bridgeDrawing.bridgeBar.heightMm}
                        cornerRadius={bridgeDrawing.bridgeBar.cornerRadiusMm}
                        fill="rgba(59, 130, 246, 0.15)"
                        stroke="#3b82f6"
                        strokeWidth={1.5 / zoom}
                      />
                    </Group>
                    <Rect
                      x={bridgeDrawing.tailpiece.center.x - bridgeDrawing.tailpiece.widthMm / 2}
                      y={bridgeDrawing.tailpiece.center.y - bridgeDrawing.tailpiece.heightMm / 2}
                      width={bridgeDrawing.tailpiece.widthMm}
                      height={bridgeDrawing.tailpiece.heightMm}
                      cornerRadius={bridgeDrawing.tailpiece.cornerRadiusMm}
                      fill="rgba(59, 130, 246, 0.15)"
                      stroke="#3b82f6"
                      strokeWidth={1.5 / zoom}
                    />
                  </>
                )}
                {bridgeDrawing.kind === 'generic' && (
                  <>
                    {[bridgeDrawing.bridgePlate, bridgeDrawing.saddlePlate].map((plate, index) => (
                      <Rect
                        key={index}
                        x={plate.center.x - plate.widthMm / 2}
                        y={plate.center.y - plate.heightMm / 2}
                        width={plate.widthMm}
                        height={plate.heightMm}
                        fill="rgba(59, 130, 246, 0.15)"
                        stroke="#3b82f6"
                        strokeWidth={1.5 / zoom}
                        cornerRadius={plate.cornerRadiusMm / zoom}
                      />
                    ))}
                  </>
                )}
                {/* Theoretical Scale-Length Line - exactly scaleLengthMm from
                    the nut, zero compensation, drawn through the bridge plate */}
                <Line
                  points={[bridgeReferenceMinX, theoreticalSaddleY, bridgeReferenceMaxX, theoreticalSaddleY]}
                  stroke="#ef4444"
                  strokeWidth={2.0 / zoom}
                />
                {/* `?? []` - an embedded bridge copy need not carry these, and
                    an iOS-written file never does. Unguarded, this threw
                    inside render, which is a blank canvas rather than a
                    missing detail. See BridgePreset.mountingPoints. */}
                <Group x={0} y={mountingOriginY}>
                  {bridgeMountingPointsAreVisible(bridgeDrawing) && (bridge.mountingPoints ?? []).map((pt, idx) => (
                    <Circle key={idx} x={pt.x} y={pt.y} radius={3 / zoom} fill="#3b82f6" />
                  ))}
                </Group>
              </Group>
            </Group>

            {/* Pickups - interactive, body-layer-only (the same "not the active
                layer doesn't hit-test" rule the pickguard/route content follows,
                applied to pickups instead - see EditingController.ActiveLayer on iOS) */}
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              {pickups.map((p) => {
                const { anchors } = resolvePickupSpec(p);
                const isSelected = p.id === selectedPickupId;
                const handlePos = pickupRotationHandlePosition(p);
                return (
                  <Group key={p.id}>
                    <Group
                      x={p.offsetXMm}
                      y={p.offsetYMm}
                      rotation={p.angleDegrees}
                      draggable={!isPanMode && isBodyActive}
                      // Konva tracks a dragged node's position itself, independent of the
                      // React props, until the gesture ends - pinning offsetXMm to 0 in
                      // committed state (movingPickup) only snaps it back at drag end,
                      // which lets the shape visibly wander off-axis mid-drag. This
                      // constrains the live drag itself, every frame, the same way
                      // toModel/toScreen already convert for the locked neck-pocket
                      // anchors above.
                      dragBoundFunc={(pos) => {
                        const model = toModel(pos);
                        const y = settings.snapToGridEnabled
                          ? snapToGridMm(model.y, settings.gridSizeMm, settings.unitDisplay)
                          : model.y;
                        return toScreen({ x: 0, y });
                      }}
                      onClick={() => {
                        if (!isPanMode) onSelectPickup(p.id);
                      }}
                      onDragStart={() => {
                        onSelectPickup(p.id);
                        onBeginEdit(pickupMoveKey(p.id));
                      }}
                      onDragMove={(e) =>
                        onUpdateProject((prev) => movingPickup(prev, p.id, e.target.y()), pickupMoveKey(p.id))
                      }
                      onDragEnd={onEndEdit}
                    >
                      <Path
                        data={anchorsToSVGPath(anchors, true)}
                        fill={isSelected ? 'rgba(56, 189, 248, 0.22)' : 'rgba(10, 185, 129, 0.15)'}
                        stroke={isSelected ? '#38bdf8' : '#10b981'}
                        strokeWidth={(isSelected ? 2.2 : 1.2) / zoom}
                      />
                      <Circle x={0} y={0} radius={2 / zoom} fill={isSelected ? '#38bdf8' : '#10b981'} />
                    </Group>

                    {/* Rotation handle - only hittable once this pickup is already
                        selected, matching CanvasRenderer/ContourEditing on iOS */}
                    {isSelected && (
                      <Circle
                        x={handlePos.x}
                        y={handlePos.y}
                        radius={5 / zoom}
                        fill="#38bdf8"
                        stroke="#fff"
                        strokeWidth={1.5 / zoom}
                        draggable={!isPanMode && isBodyActive}
                        onDragStart={() => onBeginEdit(pickupRotateKey(p.id))}
                        onDragMove={(e) =>
                          onUpdateProject(
                            (prev) => rotatingPickupToward(prev, p.id, { x: e.target.x(), y: e.target.y() }),
                            pickupRotateKey(p.id)
                          )
                        }
                        onDragEnd={onEndEdit}
                      />
                    )}
                  </Group>
                );
              })}
            </Group>
          </Layer>
        )}

        {/* LAYER 3: INTERACTIVE BEZIER NODE CONTROLS & CALIBRATION PICKS - merged
            into one Layer (see LAYER 0 above for why). Calibration content only
            renders while calibration.active is true, at which point this layer's
            own listening flag is already false, so the two never fight over
            hit-testing. */}
        <Layer listening={!isPanMode && !calibration.active}>
          {/* Selected segment highlight */}
          {selectedSegmentIndex !== null && (
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation} listening={false}>
              {(() => {
                const cps = getSegmentControlPoints(activeContour.anchors, selectedSegmentIndex, activeContour.closed);
                if (!cps) return null;
                const [p0, p1, p2, p3] = cps;
                return (
                  <Path
                    data={`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`}
                    stroke="#38bdf8"
                    strokeWidth={5 / zoom}
                    lineCap="round"
                    opacity={0.85}
                  />
                );
              })()}
            </Group>
          )}

          {activeContour.anchors.map((anchor, index) => {
            const isSelected = selectedAnchorIds.has(anchor.id);
            // Bezier handles only surface for a lone selection - showing N
            // pairs of handle lines at once is visual noise, and it keeps
            // handle-dragging unambiguously single-anchor-only.
            const showHandles = (selectedAnchorIds.size === 1 && isSelected) || showAllHandles;
            const handleOpacity = isSelected ? 1 : 0.55;
            const aPos = toScreen(anchor.position);
            const ax = aPos.x;
            const ay = aPos.y;

            // Handle positions in screen px
            const hInPos = anchor.handleIn
              ? toScreen({ x: anchor.position.x + anchor.handleIn.x, y: anchor.position.y + anchor.handleIn.y })
              : null;
            const hOutPos = anchor.handleOut
              ? toScreen({ x: anchor.position.x + anchor.handleOut.x, y: anchor.position.y + anchor.handleOut.y })
              : null;

            return (
              <Group key={anchor.id}>
                {/* Lines to handles */}
                {showHandles && hInPos && (
                  <Line
                    points={[ax, ay, hInPos.x, hInPos.y]}
                    stroke="#ef4444"
                    strokeWidth={1.2}
                    dash={[2, 2]}
                    opacity={handleOpacity}
                  />
                )}
                {showHandles && hOutPos && (
                  <Line
                    points={[ax, ay, hOutPos.x, hOutPos.y]}
                    stroke="#ef4444"
                    strokeWidth={1.2}
                    dash={[2, 2]}
                    opacity={handleOpacity}
                  />
                )}

                {/* Anchor Circle - drawn under the handles, so a handle sitting on
                    top of its own anchor still wins the hit-test and stays grabbable */}
                <Circle
                  x={ax}
                  y={ay}
                  radius={anchor.locked ? 7 : isSelected ? 9 : 7}
                  fill={anchor.locked ? '#d1a53d' : isSelected ? '#38bdf8' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable={!isPanMode && !anchor.locked}
                  onClick={(e) => {
                    if (isPanMode) return;
                    // Locked pins (neck-pocket anchors) can't join a
                    // multi-selection - they're never draggable, so a group
                    // move could never act on them anyway. A plain click on
                    // one still selects it solo, same as before.
                    if (anchor.locked && e.evt.shiftKey) return;
                    onSelectAnchor(anchor.id, e.evt.shiftKey);
                  }}
                  onDragStart={() => {
                    // Grabbing an anchor that isn't part of the current
                    // multi-selection collapses the selection to just that
                    // anchor first - you don't drag "everything selected"
                    // unless the node you grabbed was already one of them.
                    if (!selectedAnchorIds.has(anchor.id)) {
                      onSelectAnchor(anchor.id, false);
                      dragStartPositionsRef.current = null;
                      onBeginEdit(anchorDragKey(anchor.id));
                      return;
                    }
                    if (selectedAnchorIds.size > 1) {
                      dragStartPositionsRef.current = new Map(
                        activeContour.anchors
                          .filter((a) => selectedAnchorIds.has(a.id))
                          .map((a) => [a.id, a.position])
                      );
                      onBeginEdit(MULTI_ANCHOR_DRAG_KEY);
                    } else {
                      dragStartPositionsRef.current = null;
                      onBeginEdit(anchorDragKey(anchor.id));
                    }
                  }}
                  onDragMove={(e) => handleAnchorDragMove(index, e)}
                  onDragEnd={() => {
                    dragStartPositionsRef.current = null;
                    onEndEdit();
                  }}
                />

                {/* Handle In Circle */}
                {showHandles && hInPos && (
                  <Circle
                    x={hInPos.x}
                    y={hInPos.y}
                    radius={isSelected ? 5 : 4}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.5}
                    opacity={handleOpacity}
                    draggable
                    onDragStart={() => {
                      onSelectAnchor(anchor.id);
                      onBeginEdit(handleDragKey(anchor.id, 'in'));
                    }}
                    onDragMove={(e) => handleHandleDragMove(index, 'in', e)}
                    onDragEnd={onEndEdit}
                    onDblClick={() => handleHandleReset(index, 'in')}
                  />
                )}

                {/* Handle Out Circle */}
                {showHandles && hOutPos && (
                  <Circle
                    x={hOutPos.x}
                    y={hOutPos.y}
                    radius={isSelected ? 5 : 4}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.5}
                    opacity={handleOpacity}
                    draggable
                    onDragStart={() => {
                      onSelectAnchor(anchor.id);
                      onBeginEdit(handleDragKey(anchor.id, 'out'));
                    }}
                    onDragMove={(e) => handleHandleDragMove(index, 'out', e)}
                    onDragEnd={onEndEdit}
                    onDblClick={() => handleHandleReset(index, 'out')}
                  />
                )}
              </Group>
            );
          })}

          {calibration.active && (
            <Group listening={false}>
              {calibration.points.length === 2 &&
                (() => {
                  const a = toScreen(calibration.points[0]);
                  const b = toScreen(calibration.points[1]);
                  return (
                    <Line points={[a.x, a.y, b.x, b.y]} stroke="#d1a53d" strokeWidth={1.5} dash={[6, 4]} />
                  );
                })()}
              {calibration.points.map((pt, i) => {
                const s = toScreen(pt);
                return (
                  <Group key={`cal_${i}`}>
                    <Line points={[s.x - 9, s.y, s.x + 9, s.y]} stroke="#d1a53d" strokeWidth={1.5} />
                    <Line points={[s.x, s.y - 9, s.x, s.y + 9]} stroke="#d1a53d" strokeWidth={1.5} />
                    <Circle x={s.x} y={s.y} radius={4} stroke="#d1a53d" strokeWidth={1.5} />
                  </Group>
                );
              })}
            </Group>
          )}
        </Layer>
      </Stage>

      {/* Scale bar - lets you sanity-check the workspace scale at a glance */}
      {(() => {
        // Largest round length that still fits the bar's budget
        const steps = SCALE_BAR_STEPS[settings.unitDisplay];
        const bar = [...steps].reverse().find((s) => s.mm * zoom <= 170) ?? steps[0];
        return (
          <div className="canvas-scalebar">
            <div className="scalebar-track" style={{ width: `${bar.mm * zoom}px` }} />
            <span>{bar.label}</span>
          </div>
        );
      })()}

      {/* Two-point guide image calibration */}
      {calibration.active && (
        <div className="calibration-card">
          <div className="calibration-title">Calibrate guide image</div>
          {calibration.points.length < 2 ? (
            <p className="calibration-hint">
              Click {calibration.points.length === 0 ? 'the first' : 'the second'} point on the guide image.
              Pick two points whose real distance you know &mdash; body width, scale length, or a ruler in the photo.
            </p>
          ) : (
            <>
              <p className="calibration-hint">
                Picked span measures{' '}
                <strong>
                  {formatLength(
                    Math.hypot(
                      calibration.points[1].x - calibration.points[0].x,
                      calibration.points[1].y - calibration.points[0].y
                    ),
                    settings.unitDisplay
                  )}{' '}
                  {unitLabel(settings.unitDisplay)}
                </strong>{' '}
                right now. What should it be?
              </p>
              <div className="calibration-row">
                <input
                  type="number"
                  className="form-input"
                  autoFocus
                  min="0.01"
                  step={settings.unitDisplay === 'mm' ? '0.1' : '0.01'}
                  placeholder={settings.unitDisplay === 'mm' ? 'e.g. 324' : 'e.g. 12.75'}
                  value={knownDistanceInput}
                  onChange={(e) => setKnownDistanceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onApplyCalibration(toMm(parseFloat(knownDistanceInput), settings.unitDisplay));
                      setKnownDistanceInput('');
                    }
                  }}
                />
                <span className="calibration-unit">{unitLabel(settings.unitDisplay)}</span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!(parseFloat(knownDistanceInput) > 0)}
                  onClick={() => {
                    onApplyCalibration(toMm(parseFloat(knownDistanceInput), settings.unitDisplay));
                    setKnownDistanceInput('');
                  }}
                >
                  Apply
                </button>
              </div>
            </>
          )}
          <button
            className="btn btn-sm"
            onClick={() => {
              setKnownDistanceInput('');
              onCancelCalibration();
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
