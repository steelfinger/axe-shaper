/**
 * Visual contract for construction layers.
 *
 * Screen colours are bright enough to read on the dark editor canvas. Print
 * colours are deliberately pale, with darker outlines; front/back routes also
 * differ by dash pattern so they remain distinguishable on monochrome output.
 */
export const PLAN_DRAWING_STYLE = {
  screen: {
    bodyStrokePx: 2,
    layerStrokePx: 1.5,
    neckPocketFill: 'rgba(203, 213, 225, 0.18)',
    neckPocketStroke: '#cbd5e1',
    neckPocketStrokePx: 2,
    pickguardFillOpacity: 0.3,
    pickguardStroke: '#9ca3af',
    frontRouteFill: 'rgba(45, 212, 191, 0.16)',
    frontRouteStroke: '#5eead4',
    backRouteFill: 'rgba(192, 132, 252, 0.12)',
    backRouteStroke: '#d8b4fe',
    backRouteDashPx: [4, 3] as const,
  },
  print: {
    bodyStrokeMm: 0.4,
    detailStrokeMm: 0.3,
    guideStrokeMm: 0.2,
    neckPocketFill: '#e5e7eb',
    neckPocketStroke: '#374151',
    neckPocketStrokeMm: 0.4,
    pickguardFillOpacity: 0.35,
    pickguardStroke: '#6b7280',
    frontRouteFill: '#ccfbf1',
    frontRouteStroke: '#0f766e',
    backRouteFill: '#f3e8ff',
    backRouteStroke: '#7e22ce',
    backRouteDashMm: '3,2',
  },
} as const;

/** Apply fill alpha without dimming the shape's outline. */
export function colorWithAlpha(value: string, alpha: number, fallback = '#ffffff'): string {
  const parse = (candidate: string): [number, number, number] | null => {
    const digits = candidate.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(digits)) return null;
    const expanded = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16)) as [number, number, number];
  };
  const [red, green, blue] = parse(value) ?? parse(fallback)!;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
