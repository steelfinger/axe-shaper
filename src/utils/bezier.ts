import type { PathAnchor, Vector2D } from '../types/guitar';

/**
 * Evaluate point on cubic Bezier curve for t in [0, 1]
 */
export function evaluateCubicBezier(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  p3: Vector2D,
  t: number
): Vector2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Split a cubic Bezier curve at parameter t using De Casteljau's algorithm.
 * Returns two sets of 4 control points [start, c1, c2, split] and [split, c3, c4, end].
 */
export function splitCubicBezier(
  p0: Vector2D,
  p1: Vector2D,
  p2: Vector2D,
  p3: Vector2D,
  t: number
) {
  const p01 = lerpVector(p0, p1, t);
  const p12 = lerpVector(p1, p2, t);
  const p23 = lerpVector(p2, p3, t);

  const p012 = lerpVector(p01, p12, t);
  const p123 = lerpVector(p12, p23, t);

  const p0123 = lerpVector(p012, p123, t); // The split point on the curve

  return {
    segment1: [p0, p01, p012, p0123],
    segment2: [p0123, p123, p23, p3],
  };
}

export function lerpVector(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function distanceVector(a: Vector2D, b: Vector2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Generate an SVG path data string (`d="..."`) from an array of PathAnchors.
 * Each anchor's handleOut and next anchor's handleIn form a cubic Bezier segment.
 */
export function anchorsToSVGPath(anchors: PathAnchor[], closed: boolean = true): string {
  if (!anchors || anchors.length === 0) return '';

  const parts: string[] = [];
  const start = anchors[0].position;
  parts.push(`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`);

  const count = anchors.length;
  const segmentCount = closed ? count : count - 1;

  for (let i = 0; i < segmentCount; i++) {
    const curr = anchors[i];
    const next = anchors[(i + 1) % count];

    const cp1: Vector2D = curr.handleOut
      ? { x: curr.position.x + curr.handleOut.x, y: curr.position.y + curr.handleOut.y }
      : curr.position;

    const cp2: Vector2D = next.handleIn
      ? { x: next.position.x + next.handleIn.x, y: next.position.y + next.handleIn.y }
      : next.position;

    const end = next.position;

    parts.push(
      `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
    );
  }

  if (closed) {
    parts.push('Z');
  }

  return parts.join(' ');
}

/**
 * Split a curve segment between anchor at `anchorIndex` and `anchorIndex + 1` at parameter t.
 * Inserts a new PathAnchor into the array without distorting the existing curve geometry.
 */
export function insertAnchorOnSegment(
  anchors: PathAnchor[],
  segmentIndex: number,
  t: number = 0.5
): PathAnchor[] {
  const count = anchors.length;
  if (count < 2 || segmentIndex < 0 || segmentIndex >= count) return anchors;

  const nextIndex = (segmentIndex + 1) % count;
  const a1 = anchors[segmentIndex];
  const a2 = anchors[nextIndex];

  const p0 = a1.position;
  const p1 = a1.handleOut
    ? { x: a1.position.x + a1.handleOut.x, y: a1.position.y + a1.handleOut.y }
    : a1.position;

  const p2 = a2.handleIn
    ? { x: a2.position.x + a2.handleIn.x, y: a2.position.y + a2.handleIn.y }
    : a2.position;

  const p3 = a2.position;

  const { segment1, segment2 } = splitCubicBezier(p0, p1, p2, p3, t);

  // Update a1's handleOut
  const updatedA1: PathAnchor = {
    ...a1,
    handleOut: {
      x: segment1[1].x - a1.position.x,
      y: segment1[1].y - a1.position.y,
    },
  };

  // Create new inserted anchor at split point
  const splitPos = segment1[3];
  const newAnchor: PathAnchor = {
    id: `anchor_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    position: splitPos,
    handleIn: {
      x: segment1[2].x - splitPos.x,
      y: segment1[2].y - splitPos.y,
    },
    handleOut: {
      x: segment2[1].x - splitPos.x,
      y: segment2[1].y - splitPos.y,
    },
    handleMode: 'smooth',
    semanticRole: 'custom',
  };

  // Update a2's handleIn
  const updatedA2: PathAnchor = {
    ...a2,
    handleIn: {
      x: segment2[2].x - a2.position.x,
      y: segment2[2].y - a2.position.y,
    },
  };

  const newAnchors = [...anchors];
  newAnchors[segmentIndex] = updatedA1;
  newAnchors[nextIndex] = updatedA2;
  newAnchors.splice(segmentIndex + 1, 0, newAnchor);

  return newAnchors;
}
