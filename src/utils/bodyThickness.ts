import type { GuitarProject, LengthMm } from '../types/guitar';

/** Cross-app compatibility fallback for files written before body thickness. */
export const FALLBACK_BODY_THICKNESS_MM = 45;

/** Editable manufacturing range, matching axe-shaper-ios's Validator. */
export const MIN_BODY_THICKNESS_MM = 30;
export const MAX_BODY_THICKNESS_MM = 60;

/**
 * Resolve a safe preview value without mutating the document. Foreign or
 * hand-edited files can carry invalid numbers; the 3D viewer follows the same
 * finite-positive rule and caps extreme values at 500mm.
 */
export function resolvedBodyThickness(
  project: Pick<GuitarProject, 'bodyThicknessMm'>
): LengthMm {
  const value = project.bodyThicknessMm;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(value, 500)
    : FALLBACK_BODY_THICKNESS_MM;
}
