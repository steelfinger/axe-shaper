import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Path, Text, Group, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { BRIDGE_PRESETS, NECK_PRESETS, PICKUP_SPECIFICATIONS } from '../constants/hardware';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import type { GuitarProject, GuideImageState, Vector2D, CalibrationState } from '../types/guitar';
import { anchorsToSVGPath, insertAnchorOnSegment, updateAnchorHandle } from '../utils/bezier';
import { applyLiveSymmetry } from '../utils/symmetry';
import { getBridgePlateTopYMm, getSaddleYMm, getTheoreticalSaddleYMm } from '../utils/scaleMath';
import { ZoomIn, ZoomOut, Maximize2, Hand, MousePointer } from 'lucide-react';
import {
  SCALE_BAR_STEPS,
  formatLength,
  gridMinorDivisor,
  toMm,
  unitLabel,
} from '../utils/units';

interface CanvasWorkspaceProps {
  project: GuitarProject;
  selectedAnchorId: string | null;
  onSelectAnchor: (id: string | null) => void;
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
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1.2); // 1.2 px per mm base scale
  const [panOffset, setPanOffset] = useState<Vector2D>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingStage, setIsDraggingStage] = useState(false);

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

  // Listen to Spacebar key to toggle pan mode temporarily while held down
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const isPanMode = isPanToolActive || isSpacePressed;

  return (
    <div className="app-canvas-container" ref={containerRef}>
      {/* Floating Canvas Toolbar */}
      <div className="canvas-toolbar">
        <button
          className={`btn btn-sm ${!isPanToolActive ? 'btn-primary' : ''}`}
          onClick={() => setIsPanToolActive(false)}
          title="Select / Edit Nodes Tool"
        >
          <MousePointer size={14} /> Select
        </button>
        <button
          className={`btn btn-sm ${isPanToolActive ? 'btn-primary' : ''}`}
          onClick={() => setIsPanToolActive((p) => !p)}
          title="Pan / Move Canvas (Hold Spacebar or Drag Empty Area)"
        >
          <Hand size={14} /> Pan
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
        width={dimensions.width}
        height={dimensions.height}
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
          if (!isPanMode && e.target === e.target.getStage()) {
            onSelectAnchor(null);
          }
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
          <Layer>
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
              onDblClick={(e) => {
                if (isPanMode) return;
                e.cancelBubble = true;
                const stage = e.target.getStage();
                const pointer = stage?.getPointerPosition();
                if (!pointer) return;
                const clickModelPt = toModel(pointer);
                let minDistance = Infinity;
                let closestIdx = 0;
                contour.anchors.forEach((anchor, i) => {
                  const dx = anchor.position.x - clickModelPt.x;
                  const dy = anchor.position.y - clickModelPt.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < minDistance) {
                    minDistance = dist;
                    closestIdx = i;
                  }
                });

                onDragStartHistory();
                let insertedId = '';
                onUpdateProject((prev) => {
                  const updated = insertAnchorOnSegment(prev.contour.anchors, closestIdx, 0.5);
                  insertedId = updated[closestIdx + 1]?.id || '';
                  return {
                    ...prev,
                    contour: {
                      ...prev.contour,
                      anchors: updated,
                    },
                  };
                });
                if (insertedId) {
                  onSelectAnchor(insertedId);
                }
              }}
            />
          </Group>
        </Layer>

        {/* LAYER 3: HARDWARE & ROUTS */}
        {settings.showHardwareCavities && (
          <Layer listening={!isPanMode && !calibration.active}>
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
          {contour.anchors.map((anchor, index) => {
            const isSelected = anchor.id === selectedAnchorId;
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
                {/* Lines to handles if selected */}
                {isSelected && hInPos && (
                  <Line points={[ax, ay, hInPos.x, hInPos.y]} stroke="#ef4444" strokeWidth={1.2} dash={[2, 2]} />
                )}
                {isSelected && hOutPos && (
                  <Line points={[ax, ay, hOutPos.x, hOutPos.y]} stroke="#ef4444" strokeWidth={1.2} dash={[2, 2]} />
                )}

                {/* Handle In Circle */}
                {isSelected && hInPos && (
                  <Circle
                    x={hInPos.x}
                    y={hInPos.y}
                    radius={5}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.5}
                    draggable
                    onDragStart={onDragStartHistory}
                    onDragMove={(e) => handleHandleDragMove(index, 'in', e)}
                  />
                )}

                {/* Handle Out Circle */}
                {isSelected && hOutPos && (
                  <Circle
                    x={hOutPos.x}
                    y={hOutPos.y}
                    radius={5}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1.5}
                    draggable
                    onDragStart={onDragStartHistory}
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
