import type { ReferenceTemplate } from '../types/guitar';

/**
 * Curation metadata for each built-in blueprint. Geometry, hardware presets
 * and pickups live in the matching src/constants/blueprints/<id>.axe.svg
 * file instead - the same save format a user gets from Save - so a new
 * built-in blueprint is just "design it, Save, drop the file here, add one
 * entry below". Order here is display order in the sidebar.
 */
export const BLUEPRINT_MANIFEST: Record<
  string,
  Pick<ReferenceTemplate, 'description' | 'category' | 'tier'>
> = {
  single_cut: {
    description: 'Classic single-cut Mahogany body with dual humbuckers and Tune-O-Matic bridge.',
    category: 'Single-Cut',
    tier: 'reference',
  },
  sg_style: {
    description: 'Symmetric double-cutaway Vintage SG body (Gibson/Yamaha style) with bevel contours.',
    category: 'Double-Cut',
    tier: 'reference',
  },
  s_style: {
    description: 'Double cutaway body with contoured waist and upper horns.',
    category: 'S-Style',
    tier: 'reference',
  },
  t_style: {
    description: 'Single cutaway solid body with flat edge profile and classic bridge plate.',
    category: 'T-Style',
    tier: 'reference',
  },
  gibson_firebird: {
    description:
      'Firebird-style body with a fret-19 pocket joint, Tune-O-Matic bridge, and standard humbuckers, positioned from a real routing template.',
    category: 'Firebird',
    tier: 'extra',
  },
  gretsch_thunderbird: {
    description:
      'Single-cutaway body inspired by the Gretsch Billy-Bo Jupiter Thunderbird, with a Tune-O-Matic bridge and standard humbuckers.',
    category: 'Thunderbird',
    tier: 'extra',
  },
  gibson_flying_v: {
    description: 'Body inspired by the Gibson Flying V, with a deep-set neck joint, Tune-O-Matic bridge, and standard humbuckers.',
    category: 'V-Style',
    tier: 'extra',
  },
  jag_style: {
    description: 'Jaguar-style offset body with its pickguard and front control routes, a 610 mm scale neck, and Tune-O-Matic bridge.',
    category: 'Offset',
    tier: 'extra',
  },
};

/** Display order - the manifest above is keyed for lookup, not iteration. */
export const BLUEPRINT_ORDER = [
  'single_cut',
  'sg_style',
  's_style',
  't_style',
  'gibson_firebird',
  'gretsch_thunderbird',
  'gibson_flying_v',
  'jag_style',
] as const;
