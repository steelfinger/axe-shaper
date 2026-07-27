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
  nutToBodyEdgeMm: LengthMm; // Distance from nut to body entrance edge Y=0 (Fret 16 line)
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
  mountingPoints: Vector2D[]; // Relative to bridge origin mm
  widthMm: LengthMm;
  lengthMm: LengthMm;
  saddleOffsetYMm?: LengthMm; // Distance from top edge of plate to saddle line
}

export type PickupType = 'humbucker' | 'single_coil' | 'p90' | 'tele_neck' | 'tele_bridge';

export interface PickupPlacement {
  id: string;
  type: PickupType;
  offsetYMm: LengthMm;
  offsetXMm: LengthMm;
  angleDegrees: number;
  widthMm: LengthMm;
  heightMm: LengthMm;
}

export interface HardwareCavity {
  id: string;
  label: string;
  type: 'neck_pocket' | 'pickup' | 'bridge' | 'control_cavity' | 'switch' | 'knob';
  position: Vector2D;
  widthMm: LengthMm;
  depthMm: LengthMm;
  cornerRadiusMm?: LengthMm;
}

export interface GuideImageState {
  imageUrl: string | null;
  element: HTMLImageElement | null;
  offsetXMm: LengthMm;
  offsetYMm: LengthMm;
  scale: number;
  rotationDegrees: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

/**
 * Two-point scale calibration for the guide image: the user picks two points
 * whose real-world distance they know, and the image is scaled to match.
 */
export interface CalibrationState {
  active: boolean;
  points: Vector2D[]; // model-space mm, 0-2 entries
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
  bodyFillOpacity: number; // 0.0 (transparent) to 1.0 (opaque)
  pickguardEnabled: boolean;
  pickguardColor: string;
}

export interface ReferenceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'S-Style' | 'T-Style' | 'Single-Cut' | 'Double-Cut' | 'Offset' | 'Firebird' | 'Thunderbird' | 'V-Style';
  /** 'reference' = the core curated set, always visible. 'extra' = the
   *  long tail of additional blueprints, tucked into a closed-by-default,
   *  scrollable panel so the reference list doesn't get buried. */
  tier: 'reference' | 'extra';
  neckPresetId: string;
  bridgePresetId: string;
  defaultAnchors: PathAnchor[];
  defaultPickups: PickupPlacement[];
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
