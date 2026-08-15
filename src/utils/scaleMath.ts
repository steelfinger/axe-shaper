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

/**
 * Top edge of the bridge plate/rout footprint - anchored to the
 * *uncompensated* theoretical saddle line (where the bridge's own mounting
 * posts sit), not the compensated saddle line. Anchoring to the compensated
 * saddle was the bug: harmless for a small-compensation bridge (a hardtail,
 * ~2mm), but for a TOM (37.5mm) it pulled the whole plate footprint onto the
 * saddle line, rendering as one cluster instead of two features ~38mm apart.
 * `saddleOffsetYMm` keeps its own meaning (where within the plate's own
 * footprint this bridge type's saddle typically sits, e.g. TOM's `7` centres
 * its 14mm-deep plate on that line) - only the point it's measured *from*
 * changes.
 */
export function getBridgePlateTopYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  return getTheoreticalSaddleYMm(neck) - (bridge.saddleOffsetYMm ?? 15);
}

/**
 * The saddle's own plate footprint - the hardware that actually sets
 * intonation, the same size/shape as the bridge plate (getBridgePlateTopYMm)
 * but anchored to the *compensated* line (getSaddleYMm) instead of the
 * uncompensated one. For a bridge with large compensation (TOM, 37.5mm) this
 * sits well clear of the bridge plate; for a small-compensation bridge (a
 * hardtail, ~2mm) the two nearly coincide, which is physically correct - the
 * saddles genuinely sit almost on top of the bridge's own footprint there.
 */
export function getSaddlePlateTopYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  return getSaddleYMm(neck, bridge) - (bridge.saddleOffsetYMm ?? 15);
}
