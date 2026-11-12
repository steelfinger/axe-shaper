import { describe, expect, it } from 'vitest';
import type { PathAnchor } from '../../types/guitar';
import { contourBounds, evaluateCubicBezier, getSegmentControlPoints, splitCubicBezier } from '../bezier';

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

describe('contourBounds', () => {
  it('measures the curve, not the anchors', () => {
    // Two anchors on the centreline; the handles push the outline out to the
    // sides, so every anchor has x = 0 while the shape is 150mm wide.
    const anchors: PathAnchor[] = [
      { id: 'a', position: { x: 0, y: 0 }, handleIn: { x: -100, y: 0 }, handleOut: { x: 100, y: 0 }, handleMode: 'smooth' },
      { id: 'b', position: { x: 0, y: 300 }, handleIn: { x: 100, y: 0 }, handleOut: { x: -100, y: 0 }, handleMode: 'smooth' },
    ];
    const bounds = contourBounds(anchors, true)!;
    // x(t) = 300 t (1 - t), peaking at 75 on each side.
    expect(bounds.maxX).toBeCloseTo(75, 9);
    expect(bounds.minX).toBeCloseTo(-75, 9);
    expect(bounds.widthMm).toBeCloseTo(150, 9);
    expect(bounds.heightMm).toBeCloseTo(300, 9);
  });

  it('agrees with dense sampling on an asymmetric curve', () => {
    const anchors: PathAnchor[] = [
      { id: 'a', position: { x: -20, y: -30 }, handleOut: { x: 180, y: -90 }, handleIn: { x: -60, y: 40 }, handleMode: 'corner' },
      { id: 'b', position: { x: 90, y: 200 }, handleIn: { x: 140, y: -60 }, handleOut: { x: -30, y: 120 }, handleMode: 'corner' },
      { id: 'c', position: { x: -110, y: 260 }, handleIn: { x: 40, y: 90 }, handleOut: { x: -90, y: -70 }, handleMode: 'corner' },
    ];
    const bounds = contourBounds(anchors, true)!;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 3; i++) {
      const [p0, p1, p2, p3] = getSegmentControlPoints(anchors, i, true)!;
      for (let s = 0; s <= 20000; s++) {
        const p = evaluateCubicBezier(p0, p1, p2, p3, s / 20000);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    expect(bounds.minX).toBeCloseTo(minX, 4);
    expect(bounds.maxX).toBeCloseTo(maxX, 4);
    expect(bounds.minY).toBeCloseTo(minY, 4);
    expect(bounds.maxY).toBeCloseTo(maxY, 4);
    // Never smaller than the anchors themselves say.
    expect(bounds.maxX).toBeGreaterThan(90);
  });

  it('is the anchor box for straight segments, and uses real extent for an offset shape', () => {
    const anchors: PathAnchor[] = [
      { id: 'a', position: { x: -50, y: 10 }, handleMode: 'corner' },
      { id: 'b', position: { x: 150, y: 10 }, handleMode: 'corner' },
      { id: 'c', position: { x: 150, y: 400 }, handleMode: 'corner' },
    ];
    const bounds = contourBounds(anchors, true)!;
    expect(bounds.widthMm).toBe(200); // not 2 x 150
    expect(bounds.heightMm).toBe(390); // not measured from Y = 0
  });

  it('ignores the closing segment of an open contour and handles empty input', () => {
    const anchors: PathAnchor[] = [
      { id: 'a', position: { x: 0, y: 0 }, handleIn: { x: -100, y: 0 }, handleOut: { x: 100, y: 0 }, handleMode: 'smooth' },
      { id: 'b', position: { x: 0, y: 300 }, handleIn: { x: 100, y: 0 }, handleOut: { x: -100, y: 0 }, handleMode: 'smooth' },
    ];
    expect(contourBounds(anchors, false)!.minX).toBe(0);
    expect(contourBounds([], true)).toBeNull();
  });
});
