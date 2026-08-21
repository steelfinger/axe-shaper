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
  /**
   * id of the anchor this one mirrors under live-centerline symmetry, once
   * established. Absent on older saves and on anchors that haven't been
   * paired yet - applyLiveSymmetry() bootstraps it on demand, by role or by
   * geometric proximity, rather than requiring a migration.
   */
  mirrorId?: string;
  /** Per-node Beveled/German-Carve scale. Absent means the unchanged 1.0 default. */
  bevelIntensity?: number;
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
  /**
   * Same measurement as jointWidthMm/jointDepthMm/jointCornerRadiusMm, under
   * the name the iOS writer uses. Not read by any rendering or export code
   * here - present so pocket*-only fields on an iOS-written file survive a
   * round trip through this app instead of being silently dropped.
   */
  pocketWidthMm?: LengthMm;
  pocketDepthMm?: LengthMm;
  pocketCornerRadiusMm?: LengthMm;
}

/**
 * How the neck attaches to the body - an axis independent of both the body
 * shape and the neck's scale length (a Gibson-scale neck can be bolt-on, a
 * Fender-scale neck can be glued). Matches axe-shaper-ios's
 * `NeckJointMechanism` (`TolerantEnums.swift`) string-for-string, including
 * the ids: iOS's own fixture sync already writes `neckJointMechanism` into
 * this app's `tests/fixtures/ios-written/*.axe.svg`, ahead of this app
 * modeling the field itself.
 */
export type NeckJointMechanism = 'bolt_on' | 'glued';

export interface BridgePreset {
  id: string;
  name: string;
  scaleReference: 'saddle_line' | 'post_line' | 'plate_origin';
  compensationMm: {
    treble: LengthMm;
    bass: LengthMm;
  };
  /**
   * Mounting screw positions relative to the bridge origin, in mm. Optional
   * because the *embedded copy* in a file need not carry them: the iOS app's
   * preset catalogue doesn't transcribe this field, so every bridgePreset it
   * embeds omits it, and this app used to crash rendering or saving such a
   * file (`bridge.mountingPoints.map` on undefined). Nothing in the scale or
   * saddle math reads it — it is drawn decoration — so `?? []` at each call
   * site is the right answer, and the optional type is what forces one.
   */
  mountingPoints?: Vector2D[]; // Relative to bridge origin mm
  widthMm: LengthMm;
  lengthMm: LengthMm;
  saddleOffsetYMm?: LengthMm; // Distance from top edge of plate to saddle line
}

export type PickupType =
  | 'humbucker'
  | 'mini_humbucker'
  | 'single_coil'
  | 'lipstick'
  | 'p90_soapbar'
  | 'p90_dogear'
  | 'tele_neck'
  | 'tele_bridge';

/** The real shape actually routed for a pickup - a traced cavity outline (mounting ears and all, where the real pickup has them), not a plain rectangle. */
export interface PickupRoutSpec {
  widthMm: LengthMm;
  heightMm: LengthMm;
  /** Centered at (0,0), unrotated, sized to widthMm x heightMm. */
  anchors: PathAnchor[];
}

export interface PickupPlacement {
  id: string;
  type: PickupType;
  offsetYMm: LengthMm;
  offsetXMm: LengthMm;
  angleDegrees: number;
  /**
   * Rout dimensions for this specific pickup, saved with the file. These are
   * authoritative - `type` selects the defaults when a pickup is created, but
   * it is not re-consulted afterwards, so a file whose type this build has
   * never heard of still routs the right hole. See resolvePickupSpec() in
   * src/utils/presets.ts.
   */
  widthMm: LengthMm;
  heightMm: LengthMm;
  /**
   * The actual routed cavity outline, centered at (0,0) and already scaled
   * to widthMm x heightMm - not the type's catalogue shape, a copy of it.
   * Optional only because files saved before this shape existed predate it;
   * resolvePickupSpec() backfills by scaling the type's catalogue shape to
   * fit this placement's own widthMm/heightMm, so an old file's declared
   * size is preserved exactly and only the missing shape detail is added.
   */
  anchors?: PathAnchor[];
}

export interface PickguardPlacement {
  id: string;
  name?: string;
  contour: BodyContour;
  colorHex?: string;
  visible?: boolean;
  locked?: boolean;
}

export interface RoutedCavity {
  id: string;
  name?: string;
  contour: BodyContour;
  depthMm?: LengthMm;
  visible?: boolean;
  locked?: boolean;
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
  snapToGridEnabled: boolean;
  finishStyle: 'solid' | 'sunburst' | 'flame_maple' | 'natural_wood';
  bodyColor: string;
  secondaryColor: string;
  bodyFillOpacity: number; // 0.0 (transparent) to 1.0 (opaque)
  pickguardEnabled: boolean;
  pickguardColor: string;
  /**
   * Absent-means-on, unlike the required flags above: these three have no
   * existing files to retroactively affect - a file either predates this
   * feature (empty arrays, default-on is a no-op) or was written by it
   * (field always present).
   */
  showPickguard?: boolean;
  showFrontRoutes?: boolean;
  showBackRoutes?: boolean;
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
  /** Edge profile restored with the blueprint; absent means Slab. */
  edgeProfile?: EdgeProfile;
  defaultPickups: PickupPlacement[];
  defaultPickguards?: PickguardPlacement[];
  defaultFrontRoutes?: RoutedCavity[];
  defaultBackRoutes?: RoutedCavity[];
}

export interface EdgeProfile {
  kind: string;
  widthMm?: LengthMm;
  angleDegrees?: number;
  appliesTo?: string;
  insetMm?: LengthMm;
  dropMm?: LengthMm;
  channelRadiusMm?: LengthMm;
  previewFallback?: string;
  [key: string]: unknown;
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
  /** Optional for pre-edge-profile files; absent resolves to Slab. */
  edgeProfile?: EdgeProfile;
  neckPresetId: string;
  bridgePresetId: string;
  /**
   * Resolved copy of the hardware this design was drawn against, saved with
   * the file so the geometry survives a reader whose preset table differs -
   * an older build, or a separate implementation. Takes precedence over the
   * id; see src/utils/presets.ts. Optional only because schemaVersion 1 files
   * predate it, and migrateProject() backfills them on load.
   */
  neckPreset?: NeckPreset;
  bridgePreset?: BridgePreset;
  /**
   * Bolt-on or glued - an explicit user choice, independent of which neck
   * preset is attached; the neck-pocket rout shape (width/depth/corner
   * radius) is driven entirely by this, not by the neck (see
   * `GENERIC_POCKET_SPEC` in `constants/hardware.ts`). Optional and, like
   * `pickguards` below, deliberately NOT backfilled by `migrateProject()`:
   * a file predating this field genuinely lacks it, and synthesizing a
   * value on load would change a file's bytes with nothing about the
   * design having changed - the same `scripts/check-ios-fixtures.ts`
   * "loading is a no-op" guarantee. Every reader uses
   * `utils/presets.ts`'s `resolvedNeckJointMechanism()` instead, which
   * falls back to the body's own real construction (or bolt-on) without
   * writing anything back.
   */
  neckJointMechanism?: NeckJointMechanism;
  pickups: PickupPlacement[];
  /**
   * Optional, unlike `pickups` - a file from before this feature existed
   * genuinely lacks the key, and `migrateProject()` deliberately does not
   * backfill it (unlike the embedded hardware presets): doing so would mean
   * loading a file changes its bytes even when nothing about the design
   * did, which is exactly the "loading is a no-op for a current file"
   * guarantee `scripts/check-ios-fixtures.ts` pins. Every reader guards
   * with `?? []` instead, the same idiom already used for
   * `BridgePreset.mountingPoints`.
   */
  pickguards?: PickguardPlacement[];
  frontRoutes?: RoutedCavity[];
  backRoutes?: RoutedCavity[];
}
