/**
 * Schema 10 knob types and finishes, and the pickguard finish
 * (docs/AXE_SVG_FORMAT.md, "Version 10").
 *
 * The family table is shared by every implementation: the 3D viewer's
 * `familyKnobStyles` (`src/core/controlHardwareMesh.ts`) and axe-shaper-ios
 * `ControlHardwareMesh.familyKnobStyles`. The editor uses it only to show what
 * the 3D preview draws for a knob that names no type or finish of its own.
 */

export const KNOB_TYPES = ['skirted', 'top_hat', 'speed', 'dome'] as const;
export type KnobType = (typeof KNOB_TYPES)[number];

export const HARDWARE_FINISHES = ['white', 'cream', 'black', 'gold', 'chrome'] as const;
export type HardwareFinish = (typeof HARDWARE_FINISHES)[number];

export const KNOB_TYPE_LABELS: Readonly<Record<KnobType, string>> = {
  skirted: 'Skirted',
  top_hat: 'Top Hat',
  speed: 'Speed',
  dome: 'Dome',
};

export const HARDWARE_FINISH_LABELS: Readonly<Record<HardwareFinish, string>> = {
  white: 'White',
  cream: 'Cream',
  black: 'Black',
  gold: 'Gold',
  chrome: 'Chrome',
};

/**
 * The `colorHex` a writer stores with a pickguard `finish`, so the 2D canvas,
 * the exports and readers that predate `finish` show a close flat colour.
 */
export const PICKGUARD_FINISH_COLOR_HEX: Readonly<Record<HardwareFinish, string>> = {
  white: '#ffffff',
  cream: '#f0e6c8',
  black: '#111111',
  gold: '#d4af37',
  chrome: '#c9ccd1',
};

export interface KnobStyle {
  type: KnobType;
  finish: HardwareFinish;
}

/** What `generic` means for each bundled blueprint family. */
export const FAMILY_KNOB_STYLES: Readonly<Record<string, KnobStyle>> = {
  s_style: { type: 'skirted', finish: 'white' },
  t_style: { type: 'dome', finish: 'chrome' },
  jag_style: { type: 'skirted', finish: 'black' },
  prs_style: { type: 'speed', finish: 'black' },
  single_cut: { type: 'top_hat', finish: 'gold' },
  sg_style: { type: 'top_hat', finish: 'black' },
  gibson_flying_v: { type: 'top_hat', finish: 'black' },
  gibson_firebird: { type: 'top_hat', finish: 'black' },
  gibson_explorer: { type: 'speed', finish: 'black' },
  gretsch_thunderbird: { type: 'dome', finish: 'chrome' },
  semi_hollow_double_cut: { type: 'top_hat', finish: 'black' },
  semi_hollow_single_cut: { type: 'top_hat', finish: 'gold' },
  p_bass_style: { type: 'dome', finish: 'chrome' },
  j_bass_style: { type: 'speed', finish: 'black' },
  mustang_bass_style: { type: 'skirted', finish: 'black' },
  mm_bass_style: { type: 'dome', finish: 'chrome' },
  r_bass_style: { type: 'top_hat', finish: 'black' },
  sg_bass_style: { type: 'top_hat', finish: 'black' },
  thunderbird_bass_style: { type: 'top_hat', finish: 'black' },
  streamer_bass_style: { type: 'dome', finish: 'black' },
};

/** A design with no blueprint family, or one this build does not know. */
export const FALLBACK_KNOB_STYLE: KnobStyle = { type: 'speed', finish: 'black' };

export function isKnobType(value: unknown): value is KnobType {
  return typeof value === 'string' && (KNOB_TYPES as readonly string[]).includes(value);
}

export function isHardwareFinish(value: unknown): value is HardwareFinish {
  return typeof value === 'string' && (HARDWARE_FINISHES as readonly string[]).includes(value);
}

/**
 * A knob's own type and finish where it names them, the blueprint family's
 * otherwise. The two resolve independently, so a knob that names only a
 * finish keeps its family's shape.
 */
export function resolvedKnobStyle(
  knob: { knobStyleId?: string; knobFinish?: string } | undefined,
  templateId: string | undefined
): KnobStyle {
  const family = (templateId && Object.hasOwn(FAMILY_KNOB_STYLES, templateId) ? FAMILY_KNOB_STYLES[templateId] : undefined)
    ?? FALLBACK_KNOB_STYLE;
  return {
    type: isKnobType(knob?.knobStyleId) ? knob.knobStyleId : family.type,
    finish: isHardwareFinish(knob?.knobFinish) ? knob.knobFinish : family.finish,
  };
}
