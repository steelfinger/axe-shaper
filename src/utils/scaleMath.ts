import type { BridgePreset, LengthMm, NeckPreset } from '../types/guitar';

/**
 * Single source of truth for scale-length / intonation geometry.
 *
 * All values are physical millimetres in model space, where:
 *   Y = 0  is the body entrance edge (neck pocket joint line)
 *   X = 0  is the body centerline
 *
 * The saddle sits `scaleLengthMm` from the nut, and the nut sits
 * `nutToBodyEdgeMm` above Y = 0, so the theoretical saddle line is at
 * `scaleLengthMm - nutToBodyEdgeMm` below the joint line.
 *
 * NOTE: `nutToJointMm` (nut to the end of the fingerboard overhang) is a
 * different measurement and must NOT be used here - doing so puts the bridge
 * ~68mm too high on a 25.5" build.
 */

const FALLBACK_NUT_TO_BODY_EDGE_MM = 390.7;

/** Theoretical (uncompensated) saddle line, measured from the joint line Y=0. */
export function getTheoreticalSaddleYMm(neck: NeckPreset): LengthMm {
  return neck.scaleLengthMm - (neck.nutToBodyEdgeMm ?? FALLBACK_NUT_TO_BODY_EDGE_MM);
}

/** Actual treble-side saddle line, including bridge intonation compensation. */
export function getSaddleYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  return getTheoreticalSaddleYMm(neck) + bridge.compensationMm.treble;
}

/** Top edge of the bridge plate, derived from the saddle line. */
export function getBridgePlateTopYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  return getSaddleYMm(neck, bridge) - (bridge.saddleOffsetYMm ?? 15);
}
