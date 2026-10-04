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
    description: 'Single-cutaway body with a carved-cap top, glued neck, two humbuckers and an adjustable bridge. 24.75" scale.',
    category: 'Single-Cut',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  sg_style: {
    description: 'Symmetric double-cutaway body with bevelled contours, glued neck, two humbuckers and an adjustable bridge. 24.75" scale.',
    category: 'Double-Cut',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  s_style: {
    description: 'Double-cutaway body with a contoured waist and upper horns, bolt-on neck, three single-coils and a tremolo bridge. 25.5" scale.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  t_style: {
    description: 'Single-cutaway slab body with a flat edge profile, bolt-on neck, two single-coils and a flat bridge plate. 25.5" scale.',
    category: 'T-Style',
    tier: 'reference',
    instrumentType: 'guitar',
  },
  gibson_firebird: {
    description: 'Body with a fret-19 pocket joint, glued neck, two mini humbuckers and an adjustable bridge, positioned from a real routing template. 24.75" scale.',
    category: 'Firebird',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  gretsch_thunderbird: {
    description: 'Single-cutaway body with a glued neck, two humbuckers and an adjustable bridge. 24.75" scale.',
    category: 'Thunderbird',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  gibson_flying_v: {
    description: 'V-shaped body with a deep-set neck joint, glued neck, two humbuckers and an adjustable bridge. 24.75" scale.',
    category: 'V-Style',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  gibson_explorer: {
    description: 'Angular body traced from a 1958 plan, with a deep neck pocket, two humbuckers, an adjustable bridge, and a treble-wing pickguard and toggle. 24.75" scale.',
    category: 'Explorer',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  prs_style: {
    description: 'Double-cutaway body traced from a plan, with an arched carved-cap top, a thin mahogany core, a wraparound stoptail, two humbuckers and a deep-set glued neck. 25" scale.',
    category: 'PRS',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  semi_hollow_double_cut: {
    description: 'Double-cutaway body with F-holes as 2 cm front cavities, an arched carved-cap top, two humbuckers, an adjustable bridge with stopbar tailpiece, and a fret-19 neck joint. Built as a solid carved body, not a hollow one. 24.75" scale.',
    category: 'Semi-Hollow',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  semi_hollow_single_cut: {
    description: 'Single-cutaway body with F-holes as 2 cm front cavities, an arched carved-cap top, a soapbar single-coil pickup, a black pickguard, and a fret-14 neck joint. Built as a solid carved body, not a hollow one. 24.75" scale.',
    category: 'Semi-Hollow',
    tier: 'extra',
    instrumentType: 'guitar',
  },
  jag_style: {
    description: 'Offset body with a pickguard and front control routes, bolt-on neck, two single-coils and an adjustable bridge. 24" scale.',
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
    description: 'Bolt-on bass with a split-coil pickup, 34" scale, 20 frets.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  j_bass_style: {
    description: 'Offset bolt-on bass with two single-coil pickups, 34" scale, 20 frets.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  mm_bass_style: {
    description: 'Bolt-on bass with a single bridge-position humbucker, 34" scale, 20 frets.',
    category: 'S-Style',
    tier: 'reference',
    instrumentType: 'bass',
  },
  r_bass_style: {
    description: 'Offset bass with a glued neck joint in a narrow 40 mm pocket and two pickups, 33.25" scale, 20 frets.',
    category: 'Offset',
    tier: 'reference',
    instrumentType: 'bass',
  },

  // --- Extra ------------------------------------------------------------
  thunderbird_bass_style: {
    description: 'Reverse-body bass with a glued neck and two mini humbuckers, 34" scale, 20 frets.',
    category: 'Thunderbird',
    tier: 'extra',
    instrumentType: 'bass',
  },
  mustang_bass_style: {
    description: 'Short-scale bolt-on bass with a single split-coil pickup, 30" scale, 19 frets.',
    category: 'Offset',
    tier: 'extra',
    instrumentType: 'bass',
  },
  sg_bass_style: {
    description: 'Short-scale bass with a glued neck and a single humbucker, 30.5" scale, 20 frets; the body shares the outline family of the double-cutaway guitar blueprint.',
    category: 'Double-Cut',
    tier: 'extra',
    instrumentType: 'bass',
  },
  streamer_bass_style: {
    description: 'Sculpted bolt-on bass with a split-coil and a single-coil pickup, 34" scale, 20 frets.',
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
  'gibson_explorer',
  'prs_style',
  'semi_hollow_double_cut',
  'semi_hollow_single_cut',
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
