import { describe, expect, it } from 'vitest';
import { snapHandleAngle } from '../handleAngleSnap';

describe('snapHandleAngle', () => {
  it('snaps the direction to the increment and keeps the length', () => {
    const snapped = snapHandleAngle({ x: 10, y: 1 }, 15);
    expect(snapped.x).toBeCloseTo(Math.hypot(10, 1), 10);
    expect(snapped.y).toBeCloseTo(0, 10);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(Math.hypot(10, 1), 10);
  });

  it('lands on a multiple of the increment', () => {
    const { x, y } = snapHandleAngle({ x: 3, y: 5 }, 30);
    const degrees = (Math.atan2(y, x) * 180) / Math.PI;
    expect(Math.abs(degrees / 30 - Math.round(degrees / 30))).toBeLessThan(1e-9);
  });

  it.each([null, 0, -15, 360, NaN, Infinity])('returns the offset unchanged for increment %s', (increment) => {
    const offset = { x: 4, y: 7 };
    expect(snapHandleAngle(offset, increment)).toBe(offset);
  });

  it('returns a zero-length handle unchanged', () => {
    const offset = { x: 0, y: 0 };
    expect(snapHandleAngle(offset, 15)).toBe(offset);
  });
});
