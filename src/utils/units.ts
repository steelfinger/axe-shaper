import type { LengthMm, ProjectSettings } from '../types/guitar';

export type UnitDisplay = ProjectSettings['unitDisplay'];

export const MM_PER_INCH = 25.4;

export const unitLabel = (unit: UnitDisplay): string => (unit === 'mm' ? 'mm' : 'in');

/** Millimetres -> the number shown to the user in their chosen unit. */
export const toDisplayUnits = (mm: LengthMm, unit: UnitDisplay): number =>
  unit === 'mm' ? mm : mm / MM_PER_INCH;

/** A number the user typed in their chosen unit -> millimetres. */
export const toMm = (value: number, unit: UnitDisplay): LengthMm =>
  unit === 'mm' ? value : value * MM_PER_INCH;

/** Trim trailing zeros so 1.50 reads as 1.5 and 2.00 as 2. */
export const formatLength = (mm: LengthMm, unit: UnitDisplay, decimals = 1): string =>
  `${Number(toDisplayUnits(mm, unit).toFixed(unit === 'mm' ? decimals : decimals + 1))}`;

/**
 * Grid spacing presets. Metric subdivides by 5, imperial by 4, because a
 * quarter inch is a real division and a fifth of an inch is not.
 * The stored value is always millimetres - only the choices on offer change.
 */
export const GRID_PRESETS: Record<UnitDisplay, { majorMm: LengthMm; label: string }[]> = {
  mm: [
    { majorMm: 25, label: '25 mm major / 5 mm minor' },
    { majorMm: 50, label: '50 mm major / 10 mm minor' },
    { majorMm: 100, label: '100 mm major / 20 mm minor' },
  ],
  inches: [
    { majorMm: 25.4, label: '1 in major / 1/4 in minor' },
    { majorMm: 50.8, label: '2 in major / 1/2 in minor' },
    { majorMm: 101.6, label: '4 in major / 1 in minor' },
  ],
};

export const gridMinorDivisor = (unit: UnitDisplay): number => (unit === 'mm' ? 5 : 4);

/** Nearest preset in the target unit, so toggling units keeps the grid sensible. */
export const snapGridToUnit = (currentMm: LengthMm, unit: UnitDisplay): LengthMm =>
  GRID_PRESETS[unit].reduce((best, p) =>
    Math.abs(p.majorMm - currentMm) < Math.abs(best.majorMm - currentMm) ? p : best
  ).majorMm;

/** Round scale-bar lengths that read well in each unit. */
export const SCALE_BAR_STEPS: Record<UnitDisplay, { mm: LengthMm; label: string }[]> = {
  mm: [
    { mm: 5, label: '5 mm' },
    { mm: 10, label: '10 mm' },
    { mm: 20, label: '20 mm' },
    { mm: 25, label: '25 mm' },
    { mm: 50, label: '50 mm' },
    { mm: 100, label: '100 mm' },
    { mm: 200, label: '200 mm' },
    { mm: 250, label: '250 mm' },
    { mm: 500, label: '500 mm' },
    { mm: 1000, label: '1000 mm' },
  ],
  inches: [
    { mm: 6.35, label: '1/4 in' },
    { mm: 12.7, label: '1/2 in' },
    { mm: 25.4, label: '1 in' },
    { mm: 50.8, label: '2 in' },
    { mm: 101.6, label: '4 in' },
    { mm: 152.4, label: '6 in' },
    { mm: 304.8, label: '12 in' },
    { mm: 609.6, label: '24 in' },
  ],
};
