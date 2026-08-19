import type { EdgeProfile, LengthMm } from '../types/guitar';

/**
 * The edge treatments the bundled blueprints and the iOS writer actually use.
 * These strings go into the saved payload and are read by the native port, so
 * they are format, not labels - see the `.axe.svg` contract in CLAUDE.md.
 *
 * Only `beveled` and `german_carve` produce a drawn top-face boundary here;
 * `variableInsetWidthMm()` in utils/bevelIntensity.ts returns null for the
 * other two, so picking Slab or Contoured removes the inset line.
 */
export type EdgeProfileKind = 'slab' | 'contoured' | 'beveled' | 'german_carve';

export const EDGE_PROFILE_KINDS: EdgeProfileKind[] = ['slab', 'contoured', 'beveled', 'german_carve'];

export const EDGE_PROFILE_LABELS: Record<EdgeProfileKind, string> = {
  slab: 'Slab (Square Edge)',
  contoured: 'Contoured (Radiused Edge)',
  beveled: 'Beveled',
  german_carve: 'German Carve',
};

/**
 * The field set written for each kind, matching what the blueprints carry:
 * slab and contoured are copied from the shipped payloads, beveled from
 * `sg_style` (the only blueprint drawn with one). No blueprint uses
 * german_carve, so its numbers are the same 20 mm effective inset that
 * `variableInsetWidthMm()` already assumes for a freeform preview fallback.
 *
 * `dropMm` and `angleDegrees` are depths and angles - invisible in a 2D plan,
 * so they have no control here, but they are written so a file this app
 * creates carries the whole profile the native port expects.
 */
export const DEFAULT_EDGE_PROFILES: Record<EdgeProfileKind, EdgeProfile> = {
  slab: { kind: 'slab', easeMm: 0 },
  contoured: { kind: 'contoured', baseRadiusMm: 8 },
  beveled: { kind: 'beveled', widthMm: 15, angleDegrees: 45, appliesTo: 'top_and_back' },
  german_carve: { kind: 'german_carve', insetMm: 10, dropMm: 4, channelRadiusMm: 10 },
};

export interface EdgeProfileControl {
  field: 'widthMm' | 'insetMm' | 'channelRadiusMm';
  label: string;
  minMm: LengthMm;
  maxMm: LengthMm;
  stepMm: LengthMm;
}

/**
 * The numeric fields that actually move the inset line, and their limits.
 *
 * The caps are not cosmetic. Per-anchor `bevelIntensity` multiplies these
 * (`bevelInsetLoop()` requests `width * intensity`), and the shipped
 * blueprints carry intensities up to 2.0 - so a 25 mm bevel already asks for
 * a 50 mm inset at those anchors, against an SG half-width of about 160 mm.
 * Past that `offsetPolygon()` keeps relaxing the request by 15% a round until
 * the offset stops self-intersecting, which degrades quietly rather than
 * failing: the drawing stays valid while no longer meaning what it says.
 */
export const EDGE_PROFILE_CONTROLS: Record<EdgeProfileKind, EdgeProfileControl[]> = {
  slab: [],
  // baseRadiusMm is deliberately not editable: nothing draws it, and a slider
  // with no visible effect is worse than no slider.
  contoured: [],
  beveled: [{ field: 'widthMm', label: 'Bevel Width', minMm: 5, maxMm: 25, stepMm: 1 }],
  german_carve: [
    { field: 'insetMm', label: 'Carve Inset', minMm: 0, maxMm: 15, stepMm: 1 },
    { field: 'channelRadiusMm', label: 'Channel Radius', minMm: 3, maxMm: 15, stepMm: 1 },
  ],
};

/** An absent profile means Slab, per the `GuitarProject.edgeProfile` contract. */
export function edgeProfileKindOf(profile: EdgeProfile | undefined): string {
  return profile?.kind ?? 'slab';
}

export function isKnownEdgeProfileKind(kind: string): kind is EdgeProfileKind {
  return (EDGE_PROFILE_KINDS as string[]).includes(kind);
}

/** Reads a control's current value, falling back to its kind's default. */
export function edgeProfileValue(
  profile: EdgeProfile | undefined,
  control: EdgeProfileControl,
  kind: EdgeProfileKind,
): LengthMm {
  const value = profile?.[control.field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return DEFAULT_EDGE_PROFILES[kind][control.field] as LengthMm;
}

/**
 * Per-node intensity is a multiplier on the edge width, not a length: 1.0 is
 * the profile's full width, 0 runs the bevel out to nothing at that node. The
 * ceiling matches the widest value the shipped blueprints carry, and the step
 * is fine enough to nudge one horn into line with the other without turning
 * the slider into a typing exercise.
 */
export const BEVEL_INTENSITY_MIN = 0;
export const BEVEL_INTENSITY_MAX = 2;
export const BEVEL_INTENSITY_STEP = 0.05;
export const BEVEL_INTENSITY_DEFAULT = 1;
