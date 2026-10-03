import { describe, expect, it } from 'vitest';
import type { PathAnchor } from '../../types/guitar';
import {
  curveSegment,
  findClosestSegment,
  insertAnchorOnSegment,
  isSegmentStraight,
  segmentCount,
  straightenSegment,
} from '../bezier';
import { applyLiveSymmetry, mirroredSegmentIndex } from '../symmetry';

const a = (id: string, x: number, y: number, extra: Partial<PathAnchor> = {}): PathAnchor => ({
  id,
  position: { x, y },
  handleMode: 'corner',
  ...extra,
});

// A square, symmetric about X=0: L-top, R-top, R-bottom, L-bottom.
const square = (): PathAnchor[] => [
  a('lt', -50, 0, { mirrorId: 'rt' }),
  a('rt', 50, 0, { mirrorId: 'lt' }),
  a('rb', 50, 100, { mirrorId: 'lb' }),
  a('lb', -50, 100, { mirrorId: 'rb' }),
];

describe('segments', () => {
  it('counts one segment per gap, plus the closing one', () => {
    expect(segmentCount(square(), true)).toBe(4);
    expect(segmentCount(square(), false)).toBe(3);
    expect(segmentCount([a('x', 0, 0)], true)).toBe(0);
  });

  it('curve then straighten round-trips straightness', () => {
    const anchors = square();
    expect(isSegmentStraight(anchors, 0, true)).toBe(true);
    const curved = curveSegment(anchors, 0, true);
    expect(isSegmentStraight(curved, 0, true)).toBe(false);
    expect(isSegmentStraight(straightenSegment(curved, 0, true), 0, true)).toBe(true);
  });

  it('ignores an out-of-range segment index', () => {
    const anchors = square();
    expect(straightenSegment(anchors, 9, true)).toBe(anchors);
    expect(curveSegment(anchors, -1, true)).toBe(anchors);
  });

  it('inserts an anchor on a straight segment without moving the line', () => {
    const next = insertAnchorOnSegment(square(), 0, 0.5);
    expect(next).toHaveLength(5);
    expect(next[1].position.x).toBeCloseTo(0, 10);
    expect(next[1].position.y).toBeCloseTo(0, 10);
  });

  it('finds the closest point on the contour', () => {
    const hit = findClosestSegment(square(), true, { x: 0, y: -5 })!;
    expect(hit.index).toBe(0);
    expect(hit.distance).toBeCloseTo(5, 6);
  });
});

describe('live centerline symmetry', () => {
  const live = { mode: 'live_centerline', sourceSide: 'left' } as const;

  it('mirrors a moved anchor onto its partner', () => {
    const moved = square();
    moved[1] = { ...moved[1], position: { x: 70, y: 10 } };
    const result = applyLiveSymmetry(moved, 'rt', live);
    expect(result[0].position).toEqual({ x: -70, y: 10 });
  });

  it('mirrors handles with swapped in/out', () => {
    const moved = square();
    moved[1] = { ...moved[1], handleOut: { x: 5, y: 8 }, handleIn: { x: -2, y: 3 } };
    const result = applyLiveSymmetry(moved, 'rt', live);
    expect(result[0].handleIn).toEqual({ x: -5, y: 8 });
    expect(result[0].handleOut).toEqual({ x: 2, y: 3 });
  });

  it('does nothing when symmetry is off', () => {
    const anchors = square();
    expect(applyLiveSymmetry(anchors, 'rt', { mode: 'none', sourceSide: 'left' })).toBe(anchors);
  });

  it('never drags a locked partner', () => {
    const anchors = square();
    anchors[0] = { ...anchors[0], locked: true };
    anchors[1] = { ...anchors[1], position: { x: 80, y: 0 } };
    const result = applyLiveSymmetry(anchors, 'rt', live);
    expect(result[0].position).toEqual({ x: -50, y: 0 });
  });

  it('leaves an unpaired anchor alone rather than guessing', () => {
    const anchors = [a('p', 40, 0), a('q', -90, 50), a('r', 0, 120)];
    expect(applyLiveSymmetry(anchors, 'p', live)).toBe(anchors);
  });

  it('keeps a centreline anchor\'s own handles mirrored', () => {
    const anchors = [a('c', 0, 0, { handleIn: { x: -9, y: 0 }, handleOut: { x: 6, y: 4 } })];
    const result = applyLiveSymmetry(anchors, 'c', live, 'out');
    expect(result[0].handleIn).toEqual({ x: -6, y: 4 });
  });

  it('maps a segment to its mirror across the centreline', () => {
    // rt->rb (index 1) mirrors lb->lt (index 3).
    expect(mirroredSegmentIndex(square(), 1, true, live)).toBe(3);
    expect(mirroredSegmentIndex(square(), 3, true, live)).toBe(1);
  });

  it('has no mirror for a segment that spans the centreline', () => {
    expect(mirroredSegmentIndex(square(), 0, true, live)).toBeNull();
  });

  it('has no mirror when symmetry is off', () => {
    expect(mirroredSegmentIndex(square(), 1, true, { mode: 'none', sourceSide: 'left' })).toBeNull();
  });
});
