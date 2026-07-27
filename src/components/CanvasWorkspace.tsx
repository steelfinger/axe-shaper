import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Path, Text, Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { BRIDGE_PRESETS, NECK_PRESETS, PICKUP_SPECIFICATIONS } from '../constants/hardware';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import type { GuitarProject, GuideImageState, Vector2D, CalibrationState } from '../types/guitar';
import {
  anchorsToSVGPath,
  findClosestSegment,
  getSegmentControlPoints,
  insertAnchorOnSegment,
  updateAnchorHandle,
} from '../utils/bezier';
import { applyLiveSymmetry } from '../utils/symmetry';
import { getBridgePlateTopYMm, getSaddleYMm, getTheoreticalSaddleYMm } from '../utils/scaleMath';
import { ZoomIn, ZoomOut, Maximize2, Hand, Spline } from 'lucide-react';
import {
  SCALE_BAR_STEPS,
  formatLength,
  gridMinorDivisor,
  toMm,
  unitLabel,
} from '../utils/units';

/**
 * The body Path's hit area is its fill, so a click a few pixels *outside* the
 * outline misses it entirely. Segment picking therefore runs on the Stage and
 * uses this name to tell "clicked the body" apart from "clicked a node handle".
 */
const BODY_OUTLINE_NAME = 'body-outline';

/** How close to the outline a click has to land to select or split a segment. */
const PICK_TOLERANCE_PX = 12;

interface CanvasWorkspaceProps {
  project: GuitarProject;
  selectedAnchorId: string | null;
  onSelectAnchor: (id: string | null) => void;
  selectedSegmentIndex: number | null;
  onSelectSegment: (index: number | null) => void;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject) => void;
  onDragStartHistory: () => void;
  guideImage: GuideImageState;
  onUpdateGuideImage: (updater: (prev: GuideImageState) => GuideImageState) => void;
  calibration: CalibrationState;
  onCalibrationPick: (point: Vector2D) => void;
  onApplyCalibration: (knownDistanceMm: number) => void;
  onCancelCalibration: () => void;
}


export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  project,
  selectedAnchorId,
  onSelectAnchor,
  selectedSegmentIndex,
  onSelectSegment,
  onUpdateProject,
  onDragStartHistory,
  guideImage,
  onUpdateGuideImage,
  calibration,
  onCalibrationPick,
  onApplyCalibration,
  onCancelCalibration,
}) => {
  const [knownDistanceInput, setKnownDistanceInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.2); // 1.2 px per mm base scale
  const [panOffset, setPanOffset] = useState<Vector2D>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isModifierPanning, setIsModifierPanning] = useState(false);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  // Show every anchor's bezier handles at once, instead of only the selected one's
  const [showAllHandles, setShowAllHandles] = useState(false);

  const { contour, settings, neckPresetId, bridgePresetId, pickups, activeTemplateId } = project;
  const neck = NECK_PRESETS[neckPresetId] || NECK_PRESETS.fender_strat_21;
  const bridge = BRIDGE_PRESETS[bridgePresetId] || BRIDGE_PRESETS.tremolo_strat;
  const activeTemplate = REFERENCE_TEMPLATES[activeTemplateId] || REFERENCE_TEMPLATES.s_style;

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

  // Theoretical saddle & bridge Y mm (measured from body pocket entrance edge Y=0)
  const theoreticalSaddleY = getTheoreticalSaddleYMm(neck);
  const bridgeY = getSaddleYMm(neck, bridge);
  const bridgePlateTopY = getBridgePlateTopYMm(neck, bridge);

  // Wheel Zoom handler
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const newZoom = e.evt.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
    setZoom(Math.min(Math.max(0.4, newZoom), 3.5));
  };

  // Node Dragging Handler
  const handleAnchorDragMove = (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
    const newScreenX = e.target.x();
    const newScreenY = e.target.y();

    const modelPt = toModel({ x: newScreenX, y: newScreenY });
    let newModelX = modelPt.x;
    let newModelY = modelPt.y;

    const anchor = contour.anchors[index];

    // Pocket constraint: If anchor is locked, keep x snapped to joint width
    if (anchor.locked) {
      newModelY = 0; // Lock to Y=0 joint line
      if (anchor.semanticRole === 'neck_pocket_left') newModelX = -neck.jointWidthMm / 2;
      if (anchor.semanticRole === 'neck_pocket_right') newModelX = neck.jointWidthMm / 2;
    }

    onUpdateProject((prev) => {
      const updatedAnchors = [...prev.contour.anchors];
      updatedAnchors[index] = {
        ...anchor,
        position: { x: newModelX, y: newModelY },
      };

      // Apply live symmetry
      const finalAnchors = applyLiveSymmetry(updatedAnchors, anchor.id, prev.settings.symmetry);

      return {
        ...prev,
        contour: { ...prev.contour, anchors: finalAnchors },
      };
    });
  };

  // Handle Drag Move (Bezier handleIn or handleOut)
  const handleHandleDragMove = (
    index: number,
    handleType: 'in' | 'out',
    e: Konva.KonvaEventObject<DragEvent>
  ) => {
    const newScreenX = e.target.x();
    const newScreenY = e.target.y();

    const anchor = contour.anchors[index];
    const anchorScreen = toScreen(anchor.position);

    // Delta in screen pixels
    const deltaScreenX = newScreenX - anchorScreen.x;
    const deltaScreenY = newScreenY - anchorScreen.y;

    // Rotate delta back to model space
    const rad = (-rotation * Math.PI) / 180;
    const offsetX = (deltaScreenX * Math.cos(rad) - deltaScreenY * Math.sin(rad)) / zoom;
    const offsetY = (deltaScreenX * Math.sin(rad) + deltaScreenY * Math.cos(rad)) / zoom;

    onUpdateProject((prev) => {
      const updatedAnchors = [...prev.contour.anchors];
      const target = updateAnchorHandle(anchor, handleType, { x: offsetX, y: offsetY });

      updatedAnchors[index] = target;
      const finalAnchors = applyLiveSymmetry(updatedAnchors, anchor.id, prev.settings.symmetry);

      return {
        ...prev,
        contour: { ...prev.contour, anchors: finalAnchors },
      };
    });
  };

  const isPanMode = isPanToolActive || isSpacePressed || isModifierPanning;

  /** Nearest contour segment to a stage pointer position, if the click was close enough. */
  const pickSegment = (pointer: Vector2D): number | null => {
    const hit = findClosestSegment(contour.anchors, contour.closed, toModel(pointer));
    if (!hit) return null;
    // Tolerance in screen px, so it stays the same size as you zoom
    return hit.distance * zoom <= PICK_TOLERANCE_PX ? hit.index : null;
  };

  /** Only empty canvas and the body itself pick segments - never a node or handle. */
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
        <button className="btn btn-sm" onClick={() => setZoom((z) => Math.min(3.5, z * 1.15))} title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            setZoom(1.2);
            setPanOffset({ x: 0, y: 0 });
          }}
          title="Recenter Canvas & Reset Zoom"
        >
          <Maximize2 size={14} /> Recenter
        </button>
      </div>

      <Stage
        // Never 0: Konva throws building its buffer canvas at zero size, and the
        // container really can measure 0x0 for a frame before layout settles.
        width={Math.max(1, dimensions.width)}
        height={Math.max(1, dimensions.height)}
        onWheel={handleWheel}
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
          if (index === null) onSelectAnchor(null);
        }}
        onDblClick={(e) => {
          if (isPanMode || calibration.active || !isOutlinePickTarget(e.target)) return;

          const pointer = e.target.getStage()?.getPointerPosition();
          if (!pointer) return;
          const hit = findClosestSegment(contour.anchors, contour.closed, toModel(pointer));
          if (!hit || hit.distance * zoom > PICK_TOLERANCE_PX) return;

          // Split up front rather than inside the updater: React runs the updater
          // after the handler returns, so an id read from in there is always empty
          const updated = insertAnchorOnSegment(contour.anchors, hit.index, hit.t);
          const insertedId = updated[hit.index + 1]?.id;

          onDragStartHistory();
          onUpdateProject((prev) => ({ ...prev, contour: { ...prev.contour, anchors: updated } }));
          if (insertedId) onSelectAnchor(insertedId);
        }}
      >
        {/* LAYER 0: GRID & CENTERLINE AXIS */}
        <Layer listening={false}>
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
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    opacity={0.6}
                  />
                );
              })()}
              <Text x={20} y={originY - 18} text="Neck Pocket Joint Line (Y=0)" fill="#f59e0b" fontSize={11} opacity={0.7} />

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
        </Layer>

        {/* LAYER 1: GHOST REFERENCE GUIDE */}
        {settings.showGhostGuide && (
          <Layer listening={false}>
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              <Path data={ghostSVGPath} stroke="#64748b" strokeWidth={1.5 / zoom} dash={[5, 5]} opacity={0.35} />
            </Group>
          </Layer>
        )}

        {/* LAYER 1.5: GUIDE BACKGROUND IMAGE */}
        {guideImage.visible && guideImage.element && (
          <Layer listening={!isPanMode && !calibration.active}>
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
                draggable={!isPanMode && !guideImage.locked}
                onDragEnd={(e) => {
                  onUpdateGuideImage((prev) => ({
                    ...prev,
                    offsetXMm: e.target.x(),
                    offsetYMm: e.target.y(),
                  }));
                }}
              />
            </Group>
          </Layer>
        )}

        {/* LAYER 2: LIVE BODY SHAPE */}
        <Layer listening={!isPanMode && !calibration.active}>
          <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
            <Path
              data={bodySVGPath}
              fill={
                settings.finishStyle === 'solid'
                  ? settings.bodyColor
                  : settings.finishStyle === 'sunburst'
                  ? '#b45309'
                  : '#d97706'
              }
              opacity={settings.bodyFillOpacity ?? 0.35}
              stroke="#f0f4f8"
              strokeWidth={2.5 / zoom}
              shadowColor="#000"
              shadowBlur={20}
              shadowOpacity={0.5}
              name={BODY_OUTLINE_NAME}
            />
          </Group>
        </Layer>

        {/* LAYER 3: HARDWARE & ROUTS - display only, so it never eats a canvas click */}
        {settings.showHardwareCavities && (
          <Layer listening={false}>
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation}>
              {/* Neck Pocket Cavity */}
              <Rect
                x={-neck.jointWidthMm / 2}
                y={0}
                width={neck.jointWidthMm}
                height={neck.jointDepthMm}
                fill="rgba(239, 68, 68, 0.12)"
                stroke="#ef4444"
                strokeWidth={1.5 / zoom}
                dash={[4 / zoom, 3 / zoom]}
                cornerRadius={neck.jointCornerRadiusMm}
              />

              {/* Pickup Routings */}
              {pickups.map((p) => {
                const spec = PICKUP_SPECIFICATIONS[p.type] || PICKUP_SPECIFICATIONS.single_coil;
                const w = spec.widthMm;
                const h = spec.heightMm;
                return (
                  <Group key={p.id} x={p.offsetXMm} y={p.offsetYMm} rotation={p.angleDegrees}>
                    <Rect
                      x={-w / 2}
                      y={-h / 2}
                      width={w}
                      height={h}
                      fill="rgba(10, 185, 129, 0.15)"
                      stroke="#10b981"
                      strokeWidth={1.2 / zoom}
                      cornerRadius={spec.cornerRadiusMm}
                    />
                    <Circle x={0} y={0} radius={2 / zoom} fill="#10b981" />
                  </Group>
                );
              })}

              {/* Bridge Hardware Plate & Saddles */}
              <Group x={0} y={bridgeY}>
                <Rect
                  x={-bridge.widthMm / 2}
                  y={bridgePlateTopY - bridgeY}
                  width={bridge.widthMm}
                  height={bridge.lengthMm}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke="#3b82f6"
                  strokeWidth={1.5 / zoom}
                  cornerRadius={3 / zoom}
                />
                {/* Saddle Line Indicator */}
                <Line
                  points={[-bridge.widthMm / 2 + 5, 0, bridge.widthMm / 2 - 5, 0]}
                  stroke="#ef4444"
                  strokeWidth={2.0 / zoom}
                />
                {bridge.mountingPoints.map((pt, idx) => (
                  <Circle key={idx} x={pt.x} y={pt.y} radius={3 / zoom} fill="#3b82f6" />
                ))}
              </Group>
            </Group>
          </Layer>
        )}

        {/* LAYER 4: INTERACTIVE BEZIER NODE CONTROLS */}
        <Layer listening={!isPanMode && !calibration.active}>
          {/* Selected segment highlight */}
          {selectedSegmentIndex !== null && (
            <Group x={originX} y={originY} scaleX={zoom} scaleY={zoom} rotation={rotation} listening={false}>
              {(() => {
                const cps = getSegmentControlPoints(contour.anchors, selectedSegmentIndex, contour.closed);
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

          {contour.anchors.map((anchor, index) => {
            const isSelected = anchor.id === selectedAnchorId;
            const showHandles = isSelected || showAllHandles;
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
                      onDragStartHistory();
                    }}
                    onDragMove={(e) => handleHandleDragMove(index, 'in', e)}
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
                      onDragStartHistory();
                    }}
                    onDragMove={(e) => handleHandleDragMove(index, 'out', e)}
                  />
                )}

                {/* Anchor Circle */}
                <Circle
                  x={ax}
                  y={ay}
                  radius={anchor.locked ? 7 : isSelected ? 9 : 7}
                  fill={anchor.locked ? '#f59e0b' : isSelected ? '#38bdf8' : '#2563eb'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable={!isPanMode && !anchor.locked}
                  onClick={() => {
                    if (!isPanMode) onSelectAnchor(anchor.id);
                  }}
                  onDragStart={onDragStartHistory}
                  onDragMove={(e) => handleAnchorDragMove(index, e)}
                />
              </Group>
            );
          })}
        </Layer>

        {/* LAYER 5: CALIBRATION PICKS */}
        {calibration.active && (
          <Layer listening={false}>
            {calibration.points.length === 2 &&
              (() => {
                const a = toScreen(calibration.points[0]);
                const b = toScreen(calibration.points[1]);
                return (
                  <Line points={[a.x, a.y, b.x, b.y]} stroke="#f59e0b" strokeWidth={1.5} dash={[6, 4]} />
                );
              })()}
            {calibration.points.map((pt, i) => {
              const s = toScreen(pt);
              return (
                <Group key={`cal_${i}`}>
                  <Line points={[s.x - 9, s.y, s.x + 9, s.y]} stroke="#f59e0b" strokeWidth={1.5} />
                  <Line points={[s.x, s.y - 9, s.x, s.y + 9]} stroke="#f59e0b" strokeWidth={1.5} />
                  <Circle x={s.x} y={s.y} radius={4} stroke="#f59e0b" strokeWidth={1.5} />
                </Group>
              );
            })}
          </Layer>
        )}
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
