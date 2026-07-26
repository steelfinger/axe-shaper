# 2D Guitar Designer (Axe Shaper) - Production-Ready Implementation Plan

A vector-based 2D electric guitar body designer (**Axe Shaper**) built with **React + TypeScript + Konva**. 

This plan addresses geometry modeling, scale calculations, luthier constraints, data persistence, and printable 1:1 true-scale vector exports.

---

## Key Architectural Principles

1. **Millimeters as Source of Truth**: All geometry, anchors, and cavity dimensions are stored in physical millimeters (`LengthMm = number`). Viewport pixels (`screenPx = modelMm * zoom * pixelsPerMm`) are computed exclusively for rendering.
2. **Explicit Coordinate System**:
   - `Origin (0, 0)`: Intersection of Centerline (`X = 0`) and Neck Pocket Joint line (`Y = 0`).
   - `+X`: Treble (Right) side | `-X`: Bass (Left) side
   - `+Y`: Body tail (downward) | `-Y`: Nut / Headstock (upward)
3. **Konva as Viewport Only**: The domain model and SVG exporter are completely independent of Konva stage DOM or canvas scaling.
4. **Structured Path-Segment Bezier Model**: Anchors store position, cubic `handleIn`, `handleOut`, `handleMode`, and `semanticRole` rather than flat node lists.

---

## Domain Data Model (`src/types/guitar.ts`)

```ts
export type LengthMm = number;

export interface Vector2D {
  x: LengthMm;
  y: LengthMm;
}

export type HandleMode = 'corner' | 'smooth' | 'symmetric';

export type BodyNodeRole =
  | 'neck_pocket_left'
  | 'neck_pocket_right'
  | 'upper_horn_left'
  | 'upper_horn_right'
  | 'waist_left'
  | 'waist_right'
  | 'lower_bout_left'
  | 'lower_bout_right'
  | 'tail_center'
  | 'custom';

export interface PathAnchor {
  id: string;
  position: Vector2D;
  handleIn?: Vector2D;  // Offset relative to position in mm
  handleOut?: Vector2D; // Offset relative to position in mm
  handleMode: HandleMode;
  locked?: boolean;
  semanticRole?: BodyNodeRole;
}

export interface BodyContour {
  anchors: PathAnchor[];
  closed: boolean;
}

export type SymmetryMode = 'none' | 'live_centerline' | 'copy_once';

export interface SymmetryConfig {
  mode: SymmetryMode;
  sourceSide: 'left' | 'right';
}

export interface NeckPreset {
  id: string;
  name: string;
  scaleLengthMm: LengthMm;
  nutToJointMm: LengthMm;
  frets: number;
  jointWidthMm: LengthMm;
  jointDepthMm: LengthMm;
  jointCornerRadiusMm: LengthMm;
  style: 'fender_style' | 'gibson_style' | 'baritone';
}

export interface BridgePreset {
  id: string;
  name: string;
  scaleReference: 'saddle_line' | 'post_line' | 'plate_origin';
  compensationMm: {
    treble: LengthMm;
    bass: LengthMm;
  };
  mountingPoints: Vector2D[];
  widthMm: LengthMm;
  lengthMm: LengthMm;
}

export interface ProjectSettings {
  name: string;
  unitDisplay: 'mm' | 'inches';
  canvasOrientation: 'vertical' | 'horizontal';
  symmetry: SymmetryConfig;
  showCenterAxis: boolean;
  showGhostGuide: boolean;
  showHardwareCavities: boolean;
  showDimensions: boolean;
  showGrid: boolean;
  gridSizeMm: LengthMm;
  finishStyle: 'solid' | 'sunburst' | 'flame_maple' | 'natural_wood';
  bodyColor: string;
  secondaryColor: string;
  pickguardEnabled: boolean;
  pickguardColor: string;
}

export interface GuitarProject {
  schemaVersion: number;
  appVersion: string;
  metadata: {
    created: string;
    modified: string;
    author: string;
  };
  settings: ProjectSettings;
  activeTemplateId: string;
  contour: BodyContour;
  neckPresetId: string;
  bridgePresetId: string;
  pickups: PickupPlacement[];
}
```
