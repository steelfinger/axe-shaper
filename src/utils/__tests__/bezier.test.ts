import { describe, expect, it } from 'vitest';
import { evaluateCubicBezier, splitCubicBezier } from '../bezier';

const p0 = { x: 0, y: 0 };
const p1 = { x: 10, y: 40 };
const p2 = { x: 30, y: 40 };
const p3 = { x: 40, y: 0 };

describe('cubic bezier', () => {
  it('hits its end points at t=0 and t=1', () => {
    expect(evaluateCubicBezier(p0, p1, p2, p3, 0)).toEqual(p0);
    expect(evaluateCubicBezier(p0, p1, p2, p3, 1)).toEqual(p3);
  });

  it('is symmetric about the midpoint for a symmetric hull', () => {
    const mid = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
    expect(mid.x).toBeCloseTo(20, 10);
    expect(mid.y).toBeCloseTo(30, 10);
  });

  it('splits into two curves that trace the original', () => {
    const { segment1: left, segment2: right } = splitCubicBezier(p0, p1, p2, p3, 0.3);
    expect(left[3]).toEqual(right[0]);
    const onOriginal = evaluateCubicBezier(p0, p1, p2, p3, 0.3);
    expect(left[3].x).toBeCloseTo(onOriginal.x, 10);
    expect(left[3].y).toBeCloseTo(onOriginal.y, 10);

    // Halfway along the left piece is t = 0.15 on the original.
    const a = evaluateCubicBezier(left[0], left[1], left[2], left[3], 0.5);
    const b = evaluateCubicBezier(p0, p1, p2, p3, 0.15);
    expect(a.x).toBeCloseTo(b.x, 10);
    expect(a.y).toBeCloseTo(b.y, 10);
  });
});
