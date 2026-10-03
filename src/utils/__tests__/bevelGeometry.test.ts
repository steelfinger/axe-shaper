import { describe, expect, it } from 'vitest';
import type { BodyContour, PathAnchor } from '../../types/guitar';
import { createProject } from '../projectFactory';
import {
  PeriodicMonotoneCubic,
  bevelInsetLoop,
  closedPolylineToSVGPath,
  flattenContour,
  offsetPolygon,
  resolveBevelIntensities,
  variableInsetWidthMm,
} from '../bevelIntensity';

const corner = (id: string, x: number, y: number, extra: Partial<PathAnchor> = {}): PathAnchor => ({
  id,
  position: { x, y },
  handleMode: 'corner',
  ...extra,
});

const square = (half = 50): BodyContour => ({
  closed: true,
  anchors: [corner('a', -half, -half), corner('b', half, -half), corner('c', half, half), corner('d', -half, half)],
});

const area = (loop: { x: number; y: number }[]) => {
  let sum = 0;
  loop.forEach((p, i) => {
    const q = loop[(i + 1) % loop.length];
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum / 2);
};

describe('flattenContour', () => {
  it('keeps straight segments as their anchors', () => {
    const { points } = flattenContour(square());
    expect(points).toHaveLength(5); // four corners plus the closing return
    expect(points[0]).toEqual(points[4]);
  });

  it('subdivides a curve until it is within tolerance', () => {
    const curved: BodyContour = {
      closed: false,
      anchors: [
        corner('a', 0, 0, { handleOut: { x: 0, y: 40 } }),
        corner('b', 100, 0, { handleIn: { x: 0, y: 40 } }),
      ],
    };
    const loose = flattenContour(curved, 5).points.length;
    const tight = flattenContour(curved, 0.01).points.length;
    expect(tight).toBeGreaterThan(loose);
    expect(tight).toBeGreaterThan(8);
  });

  it('maps each anchor id to a point on the flattened path', () => {
    const { anchorIndices, points } = flattenContour(square());
    expect([...anchorIndices.keys()].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(points[anchorIndices.get('a')!]).toEqual({ x: -50, y: -50 });
  });
});

describe('PeriodicMonotoneCubic', () => {
  it('passes through its keyframes', () => {
    const spline = new PeriodicMonotoneCubic(
      [
        { position: 0, value: 1 },
        { position: 50, value: 2 },
        { position: 80, value: 1.5 },
      ],
      100
    );
    expect(spline.valueAt(0)).toBeCloseTo(1, 10);
    expect(spline.valueAt(50)).toBeCloseTo(2, 10);
    expect(spline.valueAt(80)).toBeCloseTo(1.5, 10);
  });

  it('never overshoots the keyframe range (monotone)', () => {
    const spline = new PeriodicMonotoneCubic(
      [
        { position: 0, value: 1 },
        { position: 30, value: 3 },
        { position: 60, value: 1 },
      ],
      100
    );
    for (let p = 0; p <= 100; p += 1) {
      const v = spline.valueAt(p);
      expect(v).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(v).toBeLessThanOrEqual(3 + 1e-9);
    }
  });

  it('is periodic: the value just before the end joins the value at the start', () => {
    const spline = new PeriodicMonotoneCubic(
      [
        { position: 0, value: 1 },
        { position: 50, value: 2 },
      ],
      100
    );
    expect(spline.valueAt(99.999)).toBeCloseTo(spline.valueAt(0), 2);
  });

  it('is constant for a single keyframe', () => {
    expect(new PeriodicMonotoneCubic([{ position: 0, value: 2 }], 100).valueAt(40)).toBe(2);
  });
});

describe('resolveBevelIntensities', () => {
  it('defaults to 1 everywhere when no anchor sets an intensity', () => {
    const contour = square();
    const values = resolveBevelIntensities(contour, flattenContour(contour));
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) expect(v).toBeCloseTo(1, 10);
  });

  it('raises intensity near an anchor that asks for more', () => {
    const contour = square();
    contour.anchors[0] = { ...contour.anchors[0], bevelIntensity: 2 };
    const flattened = flattenContour(contour);
    const values = resolveBevelIntensities(contour, flattened);
    expect(values[flattened.anchorIndices.get('a')!]).toBeCloseTo(2, 6);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});

describe('offsetPolygon', () => {
  const loop = [
    { x: -50, y: -50 },
    { x: 50, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
  ];

  it('insets a square evenly', () => {
    const { points } = offsetPolygon(loop, [10, 10, 10, 10]);
    expect(area(points)).toBeCloseTo(80 * 80, 4);
    for (const p of points) {
      expect(Math.abs(p.x)).toBeCloseTo(40, 6);
      expect(Math.abs(p.y)).toBeCloseTo(40, 6);
    }
  });

  it('returns the loop untouched for zero, negative or non-finite requests', () => {
    expect(offsetPolygon(loop, [0, 0, 0, 0]).points).toEqual(loop);
    expect(offsetPolygon(loop, [-5, -5, -5, -5]).points).toEqual(loop);
    expect(offsetPolygon(loop, [NaN, NaN, NaN, NaN]).points).toEqual(loop);
  });

  it('returns the loop untouched for a mismatched request or fewer than 3 points', () => {
    expect(offsetPolygon(loop, [10, 10]).points).toEqual(loop);
    expect(offsetPolygon(loop.slice(0, 2), [10, 10]).points).toEqual(loop.slice(0, 2));
  });

  it('survives an inset deeper than the shape: finite, and never outside the original', () => {
    const { points } = offsetPolygon(loop, [60, 60, 60, 60]);
    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(50 + 1e-6);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(50 + 1e-6);
    }
  });

  it('does not depend on winding direction', () => {
    const reversed = [...loop].reverse();
    const { points } = offsetPolygon(reversed, [10, 10, 10, 10]);
    expect(area(points)).toBeCloseTo(80 * 80, 4);
  });
});

describe('edge inset', () => {
  it('reads the width each edge profile draws', () => {
    expect(variableInsetWidthMm(undefined)).toBeNull();
    expect(variableInsetWidthMm({ kind: 'beveled', widthMm: 12 })).toBe(12);
    expect(variableInsetWidthMm({ kind: 'german_carve', insetMm: 5, channelRadiusMm: 8 })).toBe(13);
    expect(variableInsetWidthMm({ kind: 'german_carve', insetMm: -5, channelRadiusMm: 8 })).toBe(8);
    expect(variableInsetWidthMm({ kind: 'freeform', previewFallback: 'beveled' })).toBe(15);
    expect(variableInsetWidthMm({ kind: 'freeform', previewFallback: 'german_carve' })).toBe(20);
    expect(variableInsetWidthMm({ kind: 'rounded' })).toBeNull();
  });

  it('draws no inset loop without a bevelled profile', () => {
    expect(bevelInsetLoop({ ...createProject(), edgeProfile: undefined })).toBeNull();
  });

  it('draws an inset loop smaller than the body for a bevel', () => {
    const base = createProject();
    const project = { ...base, edgeProfile: { kind: 'beveled', widthMm: 10 } };
    const inset = bevelInsetLoop(project)!;
    const outline = flattenContour(project.contour).points;
    expect(inset.length).toBeGreaterThan(3);
    expect(area(inset)).toBeLessThan(area(outline));
  });
});

describe('closedPolylineToSVGPath', () => {
  it('spells points to two decimals and closes the path', () => {
    expect(closedPolylineToSVGPath([{ x: 1, y: 2 }, { x: 3.456, y: 4 }, { x: 0, y: 0 }])).toBe(
      'M 1.00 2.00 L 3.46 4.00 L 0.00 0.00 Z'
    );
    expect(closedPolylineToSVGPath([])).toBe('');
  });
});
