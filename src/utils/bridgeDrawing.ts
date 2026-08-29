import type { BridgePreset, NeckPreset, Vector2D } from '../types/guitar';
import {
  getBridgePlateTopYMm,
  getSaddlePlateTopYMm,
  getSaddleYMm,
  getTheoreticalSaddleYMm,
} from './scaleMath';

export const F_STYLE_PLATE_THICKNESS_MM = 2;
export const F_STYLE_PLATE_WIDTH_MM = 83;
export const F_STYLE_PLATE_LENGTH_MM = 40;
export const F_STYLE_LOCAL_X_OFFSET_MM = -36.5;
export const F_STYLE_SADDLE_LINE_LOCAL_Y_MM = 6;
export const F_STYLE_ARM_SOCKET_RADIUS_MM = 3.5;
export const F_STYLE_SADDLE_HOUSING_WIDTH_MM = 71;
export const F_STYLE_SADDLE_HOUSING_HEIGHT_MM = 34;
export const TOM_BRIDGE_ANGLE_DEGREES = -3;

export interface BridgeDrawingRect {
  center: Vector2D;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  angleDegrees: number;
}

export interface BridgeDrawingCircle {
  center: Vector2D;
  radiusMm: number;
}

export type BridgeDrawingGeometry =
  | {
      kind: 'f-style';
      plateOutline: Vector2D[];
      saddleHousing: BridgeDrawingRect;
      // Present only for the vibrato bridge (`tremolo_strat`): the hole the
      // arm screws into. A hardtail (`hardtail_6`) has no vibrato arm, so it
      // omits this - its plate and saddle housing are the whole silhouette.
      armSocket?: BridgeDrawingCircle;
    }
  | {
      kind: 'tom';
      bridgeBar: BridgeDrawingRect;
      tailpiece: BridgeDrawingRect;
    }
  | {
      kind: 'generic';
      bridgePlate: BridgeDrawingRect;
      // Absent when the preset is `singlePlate` - a one-piece plate has no
      // separate saddle carrier to draw.
      saddlePlate?: BridgeDrawingRect;
    }
  | {
      kind: 'custom-outline';
      plateOutline: Vector2D[];
    };

// The vibrato bridge: an asymmetric plate with a tab on the bass side that
// carries the arm socket.
const fStyleLocalOutline: Vector2D[] = [
  { x: 0, y: 38.4 },
  { x: 0, y: 7.6 },
  { x: 0.2, y: 4.4 },
  { x: 1.5, y: 2 },
  { x: 4.3, y: 0.3 },
  { x: 5.7, y: 0 },
  { x: 67, y: 0 },
  { x: 70.2, y: 0.7 },
  { x: 72, y: 4 },
  { x: 72, y: 17 },
  { x: 79, y: 17 },
  { x: 81.8, y: 18.5 },
  { x: 83, y: 22 },
  { x: 83, y: 33.9 },
  { x: 82.4, y: 38 },
  { x: 80.8, y: 39.4 },
  { x: 75.1, y: 40 },
  { x: 2.6, y: 40 },
  { x: 1, y: 39.8 },
];

// The hardtail: one flat plate, no vibrato tab. A plain rounded rectangle the
// width (73) and length (42) of `hardtail_6`, in the same local frame as
// `fStyleLocalOutline` (origin front-left, saddle line at local
// y = F_STYLE_SADDLE_LINE_LOCAL_Y_MM).
const fStyleHardtailLocalOutline: Vector2D[] = ((width = 73, length = 42, radius = 4) => [
  { x: radius, y: 0 },
  { x: width - radius, y: 0 },
  { x: width - 1.2, y: 0.3 },
  { x: width - 0.3, y: 1.2 },
  { x: width, y: radius },
  { x: width, y: length - radius },
  { x: width - 0.3, y: length - 1.2 },
  { x: width - 1.2, y: length - 0.3 },
  { x: width - radius, y: length },
  { x: radius, y: length },
  { x: 1.2, y: length - 0.3 },
  { x: 0.3, y: length - 1.2 },
  { x: 0, y: length - radius },
  { x: 0, y: radius },
  { x: 0.3, y: 1.2 },
  { x: 1.2, y: 0.3 },
])();

function rect(
  center: Vector2D,
  widthMm: number,
  heightMm: number,
  cornerRadiusMm = 0,
  angleDegrees = 0
): BridgeDrawingRect {
  return { center, widthMm, heightMm, cornerRadiusMm, angleDegrees };
}

function fStylePoint(point: Vector2D, saddleY: number): Vector2D {
  return {
    x: point.x + F_STYLE_LOCAL_X_OFFSET_MM,
    y: saddleY + point.y - F_STYLE_SADDLE_LINE_LOCAL_Y_MM,
  };
}

/**
 * Recognisable bridge hardware geometry shared by the live canvas, bounds,
 * and SVG writer. The embedded preset still owns scale and placement; its id
 * only chooses the cosmetic silhouette at that resolved position.
 */
export function getBridgeDrawingGeometry(
  neck: NeckPreset,
  bridge: BridgePreset
): BridgeDrawingGeometry {
  if (bridge.id === 'hardtail_6' || bridge.id === 'tremolo_strat') {
    const saddleY = getSaddleYMm(neck, bridge);
    const isTremolo = bridge.id === 'tremolo_strat';
    return {
      kind: 'f-style',
      plateOutline: (isTremolo ? fStyleLocalOutline : fStyleHardtailLocalOutline).map((point) =>
        fStylePoint(point, saddleY)
      ),
      saddleHousing: rect(
        { x: F_STYLE_LOCAL_X_OFFSET_MM + F_STYLE_SADDLE_HOUSING_WIDTH_MM / 2, y: saddleY + 17 },
        F_STYLE_SADDLE_HOUSING_WIDTH_MM,
        F_STYLE_SADDLE_HOUSING_HEIGHT_MM
      ),
      // Only the vibrato bridge gets an arm socket.
      ...(isTremolo
        ? {
            armSocket: {
              center: fStylePoint({ x: 76, y: 27.5 }, saddleY),
              radiusMm: F_STYLE_ARM_SOCKET_RADIUS_MM,
            },
          }
        : {}),
    };
  }

  const width = bridge.widthMm || 70;
  const height = bridge.lengthMm || 40;
  if (bridge.id === 'tune_o_matic') {
    return {
      kind: 'tom',
      bridgeBar: rect(
        { x: 0, y: getBridgePlateTopYMm(neck, bridge) + height / 2 },
        width,
        height,
        height / 2,
        TOM_BRIDGE_ANGLE_DEGREES
      ),
      tailpiece: rect(
        { x: 0, y: getSaddlePlateTopYMm(neck, bridge) + height / 2 },
        width,
        height,
        height / 2
      ),
    };
  }

  if (bridge.outlineMm?.length && bridge.outlineMm.length >= 3) {
    const theoreticalSaddleY = getTheoreticalSaddleYMm(neck);
    return {
      kind: 'custom-outline',
      plateOutline: bridge.outlineMm.map((point) => ({ x: point.x, y: theoreticalSaddleY + point.y })),
    };
  }

  const bridgePlate = rect(
    { x: 0, y: getBridgePlateTopYMm(neck, bridge) + height / 2 },
    width,
    height,
    3
  );
  if (bridge.singlePlate) {
    return { kind: 'generic', bridgePlate };
  }
  return {
    kind: 'generic',
    bridgePlate,
    saddlePlate: rect(
      { x: 0, y: getSaddlePlateTopYMm(neck, bridge) + height / 2 },
      width,
      height,
      3
    ),
  };
}

export function rotatedRectCorners(rectangle: BridgeDrawingRect): Vector2D[] {
  const halfWidth = rectangle.widthMm / 2;
  const halfHeight = rectangle.heightMm / 2;
  const radians = (rectangle.angleDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => ({
    x: rectangle.center.x + point.x * cosine - point.y * sine,
    y: rectangle.center.y + point.x * sine + point.y * cosine,
  }));
}

/** Conservative vertices for export/page fitting. */
export function bridgeDrawingBoundsPoints(geometry: BridgeDrawingGeometry): Vector2D[] {
  switch (geometry.kind) {
    case 'f-style':
      return [
        ...geometry.plateOutline,
        ...rotatedRectCorners(geometry.saddleHousing),
        ...(geometry.armSocket
          ? [
              { x: geometry.armSocket.center.x - geometry.armSocket.radiusMm, y: geometry.armSocket.center.y },
              { x: geometry.armSocket.center.x + geometry.armSocket.radiusMm, y: geometry.armSocket.center.y },
              { x: geometry.armSocket.center.x, y: geometry.armSocket.center.y - geometry.armSocket.radiusMm },
              { x: geometry.armSocket.center.x, y: geometry.armSocket.center.y + geometry.armSocket.radiusMm },
            ]
          : []),
      ];
    case 'tom':
      return [...rotatedRectCorners(geometry.bridgeBar), ...rotatedRectCorners(geometry.tailpiece)];
    case 'generic':
      return [
        ...rotatedRectCorners(geometry.bridgePlate),
        ...(geometry.saddlePlate ? rotatedRectCorners(geometry.saddlePlate) : []),
      ];
    case 'custom-outline':
      return geometry.plateOutline;
  }
}

export function bridgeReferenceLineXRange(geometry: BridgeDrawingGeometry): [number, number] {
  if (geometry.kind === 'f-style') {
    // Keep the established 73 mm reference-line length, but centre it on the
    // corrected local 0...71 mm saddle housing instead of the asymmetric
    // plate/arm-tab bounds. This moves the complete line exactly 6 mm left.
    const halfWidth = (F_STYLE_PLATE_WIDTH_MM - 10) / 2;
    return [geometry.saddleHousing.center.x - halfWidth, geometry.saddleHousing.center.x + halfWidth];
  }
  const points = bridgeDrawingBoundsPoints(geometry);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  if (maxX - minX <= 10) return [minX, maxX];
  return [minX + 5, maxX - 5];
}

export function bridgeMountingPointsAreVisible(geometry: BridgeDrawingGeometry): boolean {
  // Neither F-style bridge draws mounting points: the vibrato has its arm
  // socket, and a hardtail's real screw positions are a bridge-model-specific
  // detail this app doesn't model (same call made for `tremolo_strat` and
  // `tele_bridge_plate` in `constants/hardware.ts`).
  return geometry.kind !== 'f-style' && geometry.kind !== 'custom-outline';
}

export function tomBridgePostLineY(neck: NeckPreset): number {
  return getTheoreticalSaddleYMm(neck);
}
