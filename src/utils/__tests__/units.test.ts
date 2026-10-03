import { describe, expect, it } from 'vitest';
import { MM_PER_INCH, formatLength, snapToGridMm, toDisplayUnits, toMm } from '../units';

describe('units', () => {
  it('round-trips between millimetres and inches', () => {
    expect(toDisplayUnits(MM_PER_INCH, 'inches')).toBe(1);
    expect(toMm(1, 'inches')).toBe(25.4);
    expect(toMm(toDisplayUnits(647.7, 'inches'), 'inches')).toBeCloseTo(647.7, 10);
  });

  it('leaves millimetres untouched', () => {
    expect(toDisplayUnits(12.5, 'mm')).toBe(12.5);
    expect(toMm(12.5, 'mm')).toBe(12.5);
  });

  it('trims trailing zeros when formatting', () => {
    expect(formatLength(25.4, 'inches')).toBe('1');
    expect(formatLength(38.1, 'inches')).toBe('1.5');
    expect(formatLength(10, 'mm')).toBe('10');
  });

  it('snaps to the minor grid line: major/5 metric, major/4 imperial', () => {
    expect(snapToGridMm(7, 25, 'mm')).toBe(5);
    expect(snapToGridMm(8, 25, 'mm')).toBe(10);
    expect(snapToGridMm(7, 25.4, 'inches')).toBeCloseTo(6.35, 10);
  });

  it('does not snap to a non-positive grid', () => {
    expect(snapToGridMm(7.3, 0, 'mm')).toBe(7.3);
  });
});
