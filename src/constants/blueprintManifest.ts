import type { ReferenceTemplate } from '../types/guitar';

/**
 * Curation metadata for each built-in blueprint. Geometry, hardware presets
 * and pickups live in the matching src/constants/blueprints/<id>.axe.svg
 * file instead - the same save format a user gets from Save - so a new
 * built-in blueprint is just "design it, Save, drop the file here, add one
 * entry below". Order here is display order in the sidebar.
 *
 * `instrumentType` lives here rather than in the .axe.svg files because the
 * bundled blueprints are schema version 2 payloads that predate the field,
 * and because which instrument a body is for is curation metadata in exactly
 * the sense the rest of this table is. All eight current entries are guitars;
 * the bass blueprints arrive with milestone W6.
 */
export const BLUEPRINT_MANIFEST: Record<
  string,
  Pick<ReferenceTemplate, 'description' | 'category' | 'tier' | 'instrumentType'>
> = {
  single_cut: {
    description: 'Classic single-cut Mahogany body with dual humbuckers and Tune-O-Matic bridge.',
    category: 'Single-Cut',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  sg_style: {
    description: 'Symmetric double-cutaway Vintage SG body (Gibson/Yamaha style) with bevel contours.',
    category: 'Double-Cut',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  s_style: {
    description: 'Double cutaway body with contoured waist and upper horns.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  t_style: {
    description: 'Single cutaway solid body with flat edge profile and classic bridge plate.',
    category: 'T-Style',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  gibson_firebird: {
    description:
      'Firebird-style body with a fret-19 pocket joint, Tune-O-Matic bridge, and standard humbuckers, positioned from a real routing template.',
    category: 'Firebird',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  gretsch_thunderbird: {
    description:
      'Single-cutaway body inspired by the Gretsch Billy-Bo Jupiter Thunderbird, with a Tune-O-Matic bridge and standard humbuckers.',
    category: 'Thunderbird',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  gibson_flying_v: {
    description: 'Body inspired by the Gibson Flying V, with a deep-set neck joint, Tune-O-Matic bridge, and standard humbuckers.',
    category: 'V-Style',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  jag_style: {
    description: 'Jaguar-style offset body with its pickguard and front control routes, a 610 mm scale neck, and Tune-O-Matic bridge.',
    category: 'Offset',
    tier: 'extra',
    instrumentType: 'guitar',
  },

  // --- Bass (milestone W6) --------------------------------------------------
  //
  // Every body below is a FIRST-DRAFT starting shape, not a photo-accurate
  // trace - see docs/bass-blueprint-evidence/ for what each is actually
  // built from and what a person refining it should check first. Categories
  // reuse the guitar column's naming style; there is no dedicated bass
  // category vocabulary yet, so each picks the closest existing one plus a
  // parenthetical.
  p_bass_style: {
    description: 'Precision-style split-coil bolt-on bass, 34" scale. First-draft body - see the evidence packet before treating the contour as final.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  j_bass_style: {
    description: 'Jazz-style offset bolt-on bass with dual single-coil J pickups, 34" scale. First-draft body - see the evidence packet.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  mm_bass_style: {
    description: 'Music Man-style bolt-on bass with a single bridge humbucker, 34" scale. First-draft body - see the evidence packet.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  r_bass_style: {
    description: 'Rickenbacker-style neck-through bass, 33.25" scale. First-draft body only loosely approximates the real cresting-wave silhouette - see the evidence packet before relying on this contour.',
    category: 'Offset',
    tier: 'reference',
    instrumentType: 'bass',
  },

  // --- Extra ------------------------------------------------------------
  thunderbird_bass_style: {
    description: 'Reverse-body Thunderbird-style bass with dual humbuckers, 34" scale. First-draft body - see the evidence packet.',
    category: 'Thunderbird',
    tier: 'extra',
    instrumentType: 'bass',
  },
  mustang_bass_style: {
    description: 'Mustang-style short-scale bolt-on bass with a single split-coil pickup, 30" scale, 19 frets. First-draft body - see the evidence packet.',
    category: 'Offset',
    tier: 'extra',
    instrumentType: 'bass',
  },
  sg_bass_style: {
    description: 'SG-style short-scale glued-neck bass with dual humbuckers, 30.5" scale - body shares the existing sg_style guitar\'s own outline family. First-draft body - see the evidence packet.',
    category: 'Double-Cut',
    tier: 'extra',
    instrumentType: 'bass',
  },
  streamer_bass_style: {
    description: 'Streamer-style sculpted bolt-on bass with dual soapbar pickups, 34" scale. First-draft body, least-sourced of the eight - see the evidence packet.',
    category: 'S-Style',
    tier: 'extra',
    instrumentType: 'bass',
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
  'p_bass_style',
  'j_bass_style',
  'mm_bass_style',
  'r_bass_style',
  'thunderbird_bass_style',
  'mustang_bass_style',
  'sg_bass_style',
  'streamer_bass_style',
] as const;
