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
 * The second rectangle's top edge. For most bridges this is the saddle's own
 * plate footprint - the hardware that actually sets intonation, the same
 * size/shape as the bridge plate (getBridgePlateTopYMm) but anchored to the
 * *compensated* line (getSaddleYMm) instead of the uncompensated one.
 *
 * A bridge with 4+ `mountingPoints` (today, only a TOM) draws this rectangle
 * differently: those bridges have a genuinely separate physical part beyond
 * the bridge's own 2 posts - a stopbar tailpiece, mounted on its own 2 studs
 * - and that tailpiece's real position was never actually measured against
 * the compensated saddle line; it just happened to land close by
 * coincidence. Centre on the *tailpiece's own* mounting points instead
 * (everything past the first pair, which are the bridge's own posts already
 * centred inside the first rectangle by `getBridgePlateTopYMm`).
 *
 * A bridge with fewer points (a hardtail's 3, all on one plate with the
 * saddles) keeps the compensated-line anchor - there's no second physical
 * part for those to represent.
 */
export function getSaddlePlateTopYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  const points = bridge.mountingPoints;
  if (points && points.length >= 4) {
    const secondary = points.slice(2);
    const secondaryY = secondary.reduce((sum, p) => sum + p.y, 0) / secondary.length;
    const centre = getMountingPointOriginYMm(neck, bridge) + secondaryY;
    return centre - bridge.lengthMm / 2;
  }
  return getSaddleYMm(neck, bridge) - (bridge.saddleOffsetYMm ?? 15);
}

/**
 * Where `bridge.mountingPoints` are measured from. Each preset's own
 * `scaleReference` says what its recorded {x,y} offsets are relative to -
 * `post_line` for a TOM (the mounting posts sit at the uncompensated line,
 * well ahead of where the saddles land), `saddle_line` for a hardtail/plate
 * bridge (the screws are on the same plate as the saddles), `plate_origin`
 * for a bridge whose points are measured from its own rout footprint. Was
 * previously hardcoded to getSaddleYMm() everywhere, which is correct for
 * saddle_line bridges but put a TOM's post holes 37.5mm downstream of the
 * actual posts - inside the saddle plate instead of the bridge plate.
 */
export function getMountingPointOriginYMm(neck: NeckPreset, bridge: BridgePreset): LengthMm {
  switch (bridge.scaleReference) {
    case 'post_line':
      return getTheoreticalSaddleYMm(neck);
    case 'plate_origin':
      return getBridgePlateTopYMm(neck, bridge);
    case 'saddle_line':
    default:
      return getSaddleYMm(neck, bridge);
  }
}

/**
 * Distance from the nut to a given fret, along the fingerboard centreline -
 * standard equal-temperament fret spacing. Used to derive a body's own
 * `fingerboardOverhangMm` (see `neckPresetFieldsForTemplate` in
 * `utils/presets.ts`) so any of the 4 curated, scale-length-only necks can
 * attach to any bundled body and still land the bridge at the fret-based
 * position that body's own native neck was measured against - the same
 * fret22Distance(scale) formula the axe-shaper-ios sibling app uses
 * (docs/m17-hardware-and-body-refinements.md there).
 */
export function getFretDistanceFromNutMm(fret: number, scaleLengthMm: LengthMm): LengthMm {
  return scaleLengthMm * (1 - Math.pow(2, -fret / 12));
}
