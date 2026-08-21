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
 * Update handleIn or handleOut on a PathAnchor while strictly enforcing handleMode constraints:
 * - 'symmetric': handleIn and handleOut are antiparallel AND equal in length (handleIn = -handleOut).
 * - 'smooth': handleIn and handleOut are antiparallel (angle locked 180 deg opposite) BUT keep independent lengths.
 * - 'corner': handleIn and handleOut have independent angles and lengths.
 */
export function updateAnchorHandle(
  anchor: PathAnchor,
  handleType: 'in' | 'out',
  newOffset: Vector2D
): PathAnchor {
  const mode = anchor.handleMode || 'smooth';
  const updated = { ...anchor };

  if (mode === 'corner') {
    if (handleType === 'out') {
      updated.handleOut = newOffset;
    } else {
      updated.handleIn = newOffset;
    }
    return updated;
  }

  const newLen = Math.sqrt(newOffset.x * newOffset.x + newOffset.y * newOffset.y);
  if (newLen < 0.0001) {
    if (handleType === 'out') {
      updated.handleOut = newOffset;
    } else {
      updated.handleIn = newOffset;
    }
    return updated;
  }

  // Normalized direction vector of dragged handle
  const dirX = newOffset.x / newLen;
  const dirY = newOffset.y / newLen;

  if (handleType === 'out') {
    updated.handleOut = newOffset;
    if (mode === 'symmetric') {
      updated.handleIn = { x: -newOffset.x, y: -newOffset.y };
    } else if (mode === 'smooth') {
      const existingIn = anchor.handleIn || { x: 0, y: 0 };
      const inLen = Math.sqrt(existingIn.x * existingIn.x + existingIn.y * existingIn.y) || newLen;
      updated.handleIn = { x: -dirX * inLen, y: -dirY * inLen };
    }
  } else {
    updated.handleIn = newOffset;
    if (mode === 'symmetric') {
      updated.handleOut = { x: -newOffset.x, y: -newOffset.y };
    } else if (mode === 'smooth') {
      const existingOut = anchor.handleOut || { x: 0, y: 0 };
      const outLen = Math.sqrt(existingOut.x * existingOut.x + existingOut.y * existingOut.y) || newLen;
      updated.handleOut = { x: -dirX * outLen, y: -dirY * outLen };
    }
  }

  return updated;
}

const MIN_RESET_HANDLE_LEN_MM = 8;
const MAX_RESET_HANDLE_LEN_MM = 40;
const FALLBACK_RESET_HANDLE_LEN_MM = 15;

/**
 * Snap a handle that's been dragged somewhere unreachable (typically right on
 * top of its own anchor) back out to a third of the way along the neighboring
 * chord - the same convention curveSegment() uses. Escape hatch for the
 * zero-length case handle reachability can't otherwise recover from, however
 * far you zoom in.
 */
export function resetAnchorHandle(
  anchors: PathAnchor[],
  index: number,
  handleType: 'in' | 'out',
  closed: boolean
): PathAnchor[] {
  if (index < 0 || index >= anchors.length) return anchors;

  const count = anchors.length;
  const anchor = anchors[index];
  const neighborIndex =
    handleType === 'out'
      ? closed
        ? (index + 1) % count
        : index + 1
      : closed
        ? (index - 1 + count) % count
        : index - 1;
  const neighbor = neighborIndex >= 0 && neighborIndex < count ? anchors[neighborIndex] : null;

  let dir: Vector2D;
  let chordLen: number;
  if (neighbor) {
    chordLen = distanceVector(anchor.position, neighbor.position) || FALLBACK_RESET_HANDLE_LEN_MM * 3;
    dir = {
      x: (neighbor.position.x - anchor.position.x) / chordLen,
      y: (neighbor.position.y - anchor.position.y) / chordLen,
    };
  } else {
    // Open-contour endpoint with nothing on this side - mirror the other handle if it exists.
    const other = handleType === 'out' ? anchor.handleIn : anchor.handleOut;
    const otherLen = other ? Math.sqrt(other.x * other.x + other.y * other.y) : 0;
    dir = otherLen > 0.0001 ? { x: -other!.x / otherLen, y: -other!.y / otherLen } : { x: 1, y: 0 };
    chordLen = FALLBACK_RESET_HANDLE_LEN_MM * 3;
  }

  const len = Math.min(Math.max(chordLen / 3, MIN_RESET_HANDLE_LEN_MM), MAX_RESET_HANDLE_LEN_MM);
  const target = updateAnchorHandle(anchor, handleType, { x: dir.x * len, y: dir.y * len });

  const result = [...anchors];
  result[index] = target;
  return result;
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
 * Scale every anchor's position and handles about the origin. For a shape
 * already centered at (0,0) this is exactly "resize to a new width/height" -
 * used to fit a pickup's catalogue cavity shape to a placement's own
 * widthMm/heightMm (see resolvePickupSpec / settingPickupWidth in
 * presets.ts and pickupEditing.ts).
 */
export function scaleAnchors(anchors: PathAnchor[], scaleX: number, scaleY: number): PathAnchor[] {
  const scaleVec = (v?: Vector2D): Vector2D | undefined =>
    v ? { x: v.x * scaleX, y: v.y * scaleY } : undefined;
  return anchors.map((a) => ({
    ...a,
    position: { x: a.position.x * scaleX, y: a.position.y * scaleY },
    handleIn: scaleVec(a.handleIn),
    handleOut: scaleVec(a.handleOut),
  }));
}

/** Number of segments in an anchor list: one per gap, plus the closing gap. */
export function segmentCount(anchors: PathAnchor[], closed: boolean): number {
  if (anchors.length < 2) return 0;
  return closed ? anchors.length : anchors.length - 1;
}

/**
 * The four cubic control points of segment `index` (from anchor `index` to the next one).
 * A missing handle collapses onto its anchor, which is exactly how a straight
 * segment is expressed: a cubic whose controls sit on its own endpoints.
 */
export function getSegmentControlPoints(
  anchors: PathAnchor[],
  index: number,
  closed: boolean
): [Vector2D, Vector2D, Vector2D, Vector2D] | null {
  if (index < 0 || index >= segmentCount(anchors, closed)) return null;

  const a1 = anchors[index];
  const a2 = anchors[(index + 1) % anchors.length];

  return [
    a1.position,
    a1.handleOut
      ? { x: a1.position.x + a1.handleOut.x, y: a1.position.y + a1.handleOut.y }
      : a1.position,
    a2.handleIn
      ? { x: a2.position.x + a2.handleIn.x, y: a2.position.y + a2.handleIn.y }
      : a2.position,
    a2.position,
  ];
}

/**
 * Nearest point on the contour to `point`, by sampling each segment and then
 * refining around the best sample. Distances are in model mm.
 */
export function findClosestSegment(
  anchors: PathAnchor[],
  closed: boolean,
  point: Vector2D,
  samplesPerSegment: number = 24
): { index: number; t: number; point: Vector2D; distance: number } | null {
  const count = segmentCount(anchors, closed);
  if (count === 0) return null;

  let best = { index: 0, t: 0, point: anchors[0].position, distance: Infinity };

  for (let i = 0; i < count; i++) {
    const cps = getSegmentControlPoints(anchors, i, closed);
    if (!cps) continue;
    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const p = evaluateCubicBezier(cps[0], cps[1], cps[2], cps[3], t);
      const d = distanceVector(p, point);
      if (d < best.distance) best = { index: i, t, point: p, distance: d };
    }
  }

  // Refine within one sample step of the winner for a usable insertion point
  const cps = getSegmentControlPoints(anchors, best.index, closed);
  if (cps) {
    const span = 1 / samplesPerSegment;
    for (let s = -16; s <= 16; s++) {
      const t = Math.min(1, Math.max(0, best.t + (span * s) / 16));
      const p = evaluateCubicBezier(cps[0], cps[1], cps[2], cps[3], t);
      const d = distanceVector(p, point);
      if (d < best.distance) best = { index: best.index, t, point: p, distance: d };
    }
  }

  return best;
}

/** A handle shorter than this is treated as retracted onto its anchor. */
const RETRACTED_HANDLE_MM = 0.05;

export function isHandleRetracted(handle?: Vector2D): boolean {
  return !handle || Math.hypot(handle.x, handle.y) < RETRACTED_HANDLE_MM;
}

/** True when the segment renders as a plain straight line. */
export function isSegmentStraight(anchors: PathAnchor[], index: number, closed: boolean): boolean {
  if (index < 0 || index >= segmentCount(anchors, closed)) return false;
  const a1 = anchors[index];
  const a2 = anchors[(index + 1) % anchors.length];
  return isHandleRetracted(a1.handleOut) && isHandleRetracted(a2.handleIn);
}

/**
 * Make a segment a straight line by retracting the two handles that shape it.
 * Both endpoints are forced to 'corner' mode: in 'smooth' or 'symmetric' mode
 * dragging the *other* handle would immediately pull the retracted one back out
 * and re-curve the segment behind the user's back.
 */
export function straightenSegment(
  anchors: PathAnchor[],
  index: number,
  closed: boolean
): PathAnchor[] {
  if (index < 0 || index >= segmentCount(anchors, closed)) return anchors;

  const nextIndex = (index + 1) % anchors.length;
  const result = [...anchors];

  const a1 = { ...result[index], handleMode: 'corner' as const };
  delete a1.handleOut;
  result[index] = a1;

  const a2 = { ...result[nextIndex], handleMode: 'corner' as const };
  delete a2.handleIn;
  result[nextIndex] = a2;

  return result;
}

/**
 * Give a straight segment its handles back, placed a third of the way along the
 * chord. The rendered shape is unchanged - the segment is still a straight line -
 * but there is now something to grab and pull into a curve.
 */
export function curveSegment(
  anchors: PathAnchor[],
  index: number,
  closed: boolean
): PathAnchor[] {
  if (index < 0 || index >= segmentCount(anchors, closed)) return anchors;

  const nextIndex = (index + 1) % anchors.length;
  const p0 = anchors[index].position;
  const p3 = anchors[nextIndex].position;
  const third: Vector2D = { x: (p3.x - p0.x) / 3, y: (p3.y - p0.y) / 3 };

  const result = [...anchors];
  result[index] = { ...result[index], handleOut: third };
  result[nextIndex] = { ...result[nextIndex], handleIn: { x: -third.x, y: -third.y } };
  return result;
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
