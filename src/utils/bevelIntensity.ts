import type { BodyContour, EdgeProfile, GuitarProject, Vector2D } from '../types/guitar';
import { getSegmentControlPoints, splitCubicBezier } from './bezier';

const DEFAULT_FLATTENING_TOLERANCE_MM = 0.15;
const MAX_SUBDIVISION_DEPTH = 8;
const EPSILON = 1e-9;
const MAX_MITER_SCALE = 3;

export interface FlattenedContour {
  points: Vector2D[];
  anchorIndices: Map<string, number>;
}

export interface OffsetResult {
  points: Vector2D[];
  safeLimitsMm: number[];
}

type Keyframe = { position: number; value: number };
type Line = { point: Vector2D; dir: Vector2D };
type ActiveEdge = {
  originalIndex: number;
  start: Vector2D;
  end: Vector2D;
  mappedVertexIndices: number[];
};

const add = (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Vector2D, factor: number): Vector2D => ({ x: v.x * factor, y: v.y * factor });
const magnitude = (v: Vector2D): number => Math.hypot(v.x, v.y);
const distance = (a: Vector2D, b: Vector2D): number => magnitude(subtract(a, b));
const dot = (a: Vector2D, b: Vector2D): number => a.x * b.x + a.y * b.y;

function isFlat(points: [Vector2D, Vector2D, Vector2D, Vector2D], toleranceMm: number): boolean {
  const chord = subtract(points[3], points[0]);
  const chordLength = magnitude(chord);
  if (chordLength <= EPSILON) {
    return distance(points[1], points[0]) <= toleranceMm && distance(points[2], points[0]) <= toleranceMm;
  }
  const perpendicularDistance = (point: Vector2D) => {
    const toPoint = subtract(point, points[0]);
    return Math.abs(chord.x * toPoint.y - chord.y * toPoint.x) / chordLength;
  };
  return Math.max(perpendicularDistance(points[1]), perpendicularDistance(points[2])) <= toleranceMm;
}

function flattenSegment(
  points: [Vector2D, Vector2D, Vector2D, Vector2D],
  toleranceMm: number,
  depth: number,
  result: Vector2D[],
): void {
  if (depth <= 0 || isFlat(points, toleranceMm)) {
    result.push(points[0]);
    return;
  }
  const split = splitCubicBezier(...points, 0.5);
  flattenSegment(split.segment1 as [Vector2D, Vector2D, Vector2D, Vector2D], toleranceMm, depth - 1, result);
  flattenSegment(split.segment2 as [Vector2D, Vector2D, Vector2D, Vector2D], toleranceMm, depth - 1, result);
}

/** Matches iOS AdaptiveFlattening, including its 0.15 mm chord-error tolerance. */
export function flattenContour(
  contour: BodyContour,
  toleranceMm = DEFAULT_FLATTENING_TOLERANCE_MM,
  maxDepth = MAX_SUBDIVISION_DEPTH,
): FlattenedContour {
  const segmentTotal = contour.closed ? contour.anchors.length : Math.max(0, contour.anchors.length - 1);
  const points: Vector2D[] = [];
  const anchorIndices = new Map<string, number>();

  if (segmentTotal === 0) {
    contour.anchors.forEach((anchor, index) => anchorIndices.set(anchor.id, index));
    return { points: contour.anchors.map((anchor) => anchor.position), anchorIndices };
  }

  for (let segmentIndex = 0; segmentIndex < segmentTotal; segmentIndex += 1) {
    const controls = getSegmentControlPoints(contour.anchors, segmentIndex, contour.closed);
    if (!controls) continue;
    anchorIndices.set(contour.anchors[segmentIndex % contour.anchors.length].id, points.length === 0 ? 0 : points.length - 1);
    const flattened: Vector2D[] = [];
    flattenSegment(controls, toleranceMm, maxDepth, flattened);
    flattened.push(controls[3]);
    points.push(...(points.length === 0 ? flattened : flattened.slice(1)));
  }
  return { points, anchorIndices };
}

/** Periodic Fritsch-Carlson monotone cubic used by iOS for intensity interpolation. */
export class PeriodicMonotoneCubic {
  readonly positions: number[];
  readonly values: number[];
  readonly tangents: number[];
  readonly periodMm: number;

  constructor(keyframes: Keyframe[], periodMm: number) {
    this.periodMm = periodMm;
    this.positions = keyframes.map(({ position }) => position);
    this.values = keyframes.map(({ value }) => value);
    const count = keyframes.length;
    const slopes = Array<number>(count).fill(0);

    for (let index = 0; index < count; index += 1) {
      const width = index === count - 1
        ? periodMm - this.positions[index] + this.positions[0]
        : this.positions[index + 1] - this.positions[index];
      slopes[index] = width > EPSILON ? (this.values[(index + 1) % count] - this.values[index]) / width : 0;
    }

    const tangents = slopes.map((slope, index) => (slopes[(index - 1 + count) % count] + slope) / 2);
    for (let index = 0; index < count; index += 1) {
      const previous = slopes[(index - 1 + count) % count];
      const next = slopes[index];
      if (previous === 0 || next === 0 || (previous > 0) !== (next > 0)) tangents[index] = 0;
    }
    for (let index = 0; index < count; index += 1) {
      const slope = slopes[index];
      const next = (index + 1) % count;
      if (Math.abs(slope) <= EPSILON) {
        tangents[index] = 0;
        tangents[next] = 0;
        continue;
      }
      const alpha = tangents[index] / slope;
      const beta = tangents[next] / slope;
      const tangentMagnitude = Math.hypot(alpha, beta);
      if (tangentMagnitude > 3) {
        const correction = 3 / tangentMagnitude;
        tangents[index] = correction * alpha * slope;
        tangents[next] = correction * beta * slope;
      }
    }
    this.tangents = tangents;
  }

  valueAt(positionMm: number): number {
    const count = this.positions.length;
    if (count < 2) return this.values[0] ?? 1;
    let segment = count - 1;
    for (let index = 0; index < count; index += 1) {
      if (this.positions[index] <= positionMm) segment = index;
    }
    const next = (segment + 1) % count;
    const width = next === 0
      ? this.periodMm - this.positions[segment] + this.positions[0]
      : this.positions[next] - this.positions[segment];
    if (width <= EPSILON) return this.values[segment];
    const localStart = next === 0 && positionMm < this.positions[segment] ? positionMm + this.periodMm : positionMm;
    const t = (localStart - this.positions[segment]) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * this.values[segment]
      + (t3 - 2 * t2 + t) * this.tangents[segment] * width
      + (-2 * t3 + 3 * t2) * this.values[next]
      + (t3 - t2) * this.tangents[next] * width;
  }
}

function isFixedNeckPocketAnchor(anchor: BodyContour['anchors'][number]): boolean {
  return anchor.locked === true
    && (anchor.semanticRole === 'neck_pocket_left' || anchor.semanticRole === 'neck_pocket_right');
}

/** Resolves the dense per-anchor values onto the adaptively flattened outline. */
export function resolveBevelIntensities(contour: BodyContour, flattened: FlattenedContour): number[] {
  const loop = [...flattened.points];
  if (loop.length > 1 && pointsEqual(loop[0], loop[loop.length - 1])) loop.pop();
  if (loop.length < 3) return Array(loop.length).fill(1);

  const arcLengths = Array<number>(loop.length).fill(0);
  let running = 0;
  for (let index = 0; index < loop.length; index += 1) {
    arcLengths[index] = running;
    running += distance(loop[index], loop[(index + 1) % loop.length]);
  }
  const perimeter = arcLengths[loop.length - 1] + distance(loop[loop.length - 1], loop[0]);
  const keyframes: Keyframe[] = [];
  for (const anchor of contour.anchors) {
    const index = flattened.anchorIndices.get(anchor.id);
    if (index === undefined || index >= loop.length) continue;
    keyframes.push({
      position: arcLengths[index],
      value: isFixedNeckPocketAnchor(anchor) ? 0 : (anchor.bevelIntensity ?? 1),
    });
  }
  keyframes.sort((a, b) => a.position - b.position);
  if (keyframes.length < 2 || perimeter <= EPSILON) return Array(loop.length).fill(keyframes[0]?.value ?? 1);
  const spline = new PeriodicMonotoneCubic(keyframes, perimeter);
  return arcLengths.map((position) => spline.valueAt(position));
}

function pointsEqual(a: Vector2D, b: Vector2D): boolean {
  return a.x === b.x && a.y === b.y;
}

function signedArea(loop: Vector2D[]): number {
  let sum = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const a = loop[index];
    const b = loop[(index + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function edgeOutwardNormal(edge: Vector2D, area: number): Vector2D {
  const rotated = area >= 0 ? { x: edge.y, y: -edge.x } : { x: -edge.y, y: edge.x };
  const length = magnitude(rotated);
  return length > EPSILON ? scale(rotated, 1 / length) : { x: 0, y: 0 };
}

function intersectLines(first: Line, second: Line): Vector2D | null {
  const cross = first.dir.x * second.dir.y - first.dir.y * second.dir.x;
  if (Math.abs(cross) <= EPSILON) return null;
  const delta = subtract(second.point, first.point);
  const t = (delta.x * second.dir.y - delta.y * second.dir.x) / cross;
  return add(first.point, scale(first.dir, t));
}

function segmentsCross(p1: Vector2D, p2: Vector2D, p3: Vector2D, p4: Vector2D): boolean {
  const orientation = (a: Vector2D, b: Vector2D, c: Vector2D) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = orientation(p3, p4, p1);
  const d2 = orientation(p3, p4, p2);
  const d3 = orientation(p1, p2, p3);
  const d4 = orientation(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function rawTillerHansonOffset(loop: Vector2D[], requested: number[], maxMiterScale: number): Vector2D[] {
  const count = loop.length;
  const area = signedArea(loop);
  if (count < 3 || Math.abs(area) <= EPSILON) return loop;

  const originalEdges: Vector2D[] = [];
  const offsetLines: Line[] = [];
  for (let index = 0; index < count; index += 1) {
    const edge = subtract(loop[(index + 1) % count], loop[index]);
    originalEdges.push(edge);
    const inward = scale(edgeOutwardNormal(edge, area), -1);
    offsetLines.push({ point: add(loop[index], scale(inward, requested[index])), dir: edge });
  }

  const initialJoints: Vector2D[] = [];
  for (let index = 0; index < count; index += 1) {
    const previous = (index - 1 + count) % count;
    const previousInward = scale(edgeOutwardNormal(originalEdges[previous], area), -1);
    const currentInward = scale(edgeOutwardNormal(originalEdges[index], area), -1);
    const previousLine = { point: add(loop[index], scale(previousInward, requested[index])), dir: originalEdges[previous] };
    const currentLine = { point: add(loop[index], scale(currentInward, requested[index])), dir: originalEdges[index] };
    const averageOutward = scale(add(previousInward, currentInward), -1);
    const averageMagnitude = magnitude(averageOutward);
    const vertexInward = averageMagnitude > 1e-6 ? scale(averageOutward, -1 / averageMagnitude) : currentInward;
    const nominal = Math.max(requested[index], 1e-6);
    const intersection = intersectLines(previousLine, currentLine);

    if (requested[index] <= 1e-6) initialJoints.push(loop[index]);
    else if (intersection) {
      const rawOffset = subtract(intersection, loop[index]);
      const inwardProjection = dot(rawOffset, vertexInward);
      const ratio = magnitude(rawOffset) / nominal;
      if (inwardProjection > 0 && ratio <= maxMiterScale) initialJoints.push(intersection);
      else if (inwardProjection > 0) initialJoints.push(add(loop[index], scale(vertexInward, nominal * Math.min(ratio, maxMiterScale))));
      else initialJoints.push(add(loop[index], scale(vertexInward, nominal)));
    } else initialJoints.push(add(loop[index], scale(vertexInward, nominal)));
  }

  const active: ActiveEdge[] = initialJoints.map((start, index) => ({
    originalIndex: index,
    start,
    end: initialJoints[(index + 1) % count],
    mappedVertexIndices: [index],
  }));

  for (let round = 0; round < count * 2 && active.length >= 3; round += 1) {
    let invalidIndex = -1;
    for (let index = 0; index < active.length; index += 1) {
      const edge = active[index];
      const next = active[(index + 1) % active.length];
      if (dot(subtract(edge.end, edge.start), originalEdges[edge.originalIndex]) <= 0
        || segmentsCross(edge.start, edge.end, next.start, next.end)) {
        invalidIndex = index;
        break;
      }
    }
    if (invalidIndex < 0) break;

    const size = active.length;
    const previousIndex = (invalidIndex - 1 + size) % size;
    const nextIndex = (invalidIndex + 1) % size;
    const edge = active[invalidIndex];
    const previous = active[previousIndex];
    const next = active[nextIndex];
    const firstLine = offsetLines[previous.originalIndex];
    const secondLine = offsetLines[next.originalIndex];
    const firstLength = magnitude(firstLine.dir);
    const secondLength = magnitude(secondLine.dir);
    const determinant = firstLength > 0 && secondLength > 0
      ? (firstLine.dir.x * secondLine.dir.y - firstLine.dir.y * secondLine.dir.x) / (firstLength * secondLength)
      : 0;
    let joint: Vector2D | null = null;
    if (Math.abs(determinant) > 0.08) {
      const candidate = intersectLines(firstLine, secondLine);
      if (candidate) {
        const reference = loop[edge.originalIndex];
        const inward = scale(edgeOutwardNormal(originalEdges[edge.originalIndex], area), -1);
        const nominal = Math.max(requested[edge.originalIndex], 1e-6);
        if (dot(subtract(candidate, reference), inward) > 0 && distance(candidate, reference) / nominal <= maxMiterScale) {
          joint = candidate;
        }
      }
    }
    joint ??= { x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2 };
    previous.end = joint;
    next.start = joint;
    next.mappedVertexIndices.push(...edge.mappedVertexIndices);
    active.splice(invalidIndex, 1);
  }

  const mapped: Array<Vector2D | undefined> = Array(count);
  for (const edge of active) for (const index of edge.mappedVertexIndices) mapped[index] = edge.start;
  return loop.map((point, index) => {
    const candidate = mapped[index] ?? initialJoints[index];
    const displacement = subtract(candidate, point);
    const displacementLength = magnitude(displacement);
    const maximum = requested[index] * maxMiterScale;
    return displacementLength > maximum && displacementLength > EPSILON
      ? add(point, scale(displacement, maximum / displacementLength))
      : candidate;
  });
}

/** Matches iOS PolylineOffset, including cusp trimming and collision relaxation. */
export function offsetPolygon(
  loop: Vector2D[],
  requestedInwardMm: number[],
  maxMiterScale = MAX_MITER_SCALE,
): OffsetResult {
  if (loop.length < 3 || requestedInwardMm.length !== loop.length) {
    return { points: loop, safeLimitsMm: requestedInwardMm };
  }
  const sanitized = requestedInwardMm.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  if (!sanitized.some((value) => value > 0)) return { points: loop, safeLimitsMm: sanitized };
  const limits = [...sanitized];

  for (let round = 0; round < 30; round += 1) {
    const points = rawTillerHansonOffset(loop, limits, maxMiterScale);
    let foundCrossing = false;
    for (let i = 0; i < loop.length; i += 1) {
      const iNext = (i + 1) % loop.length;
      for (let j = i + 1; j < loop.length; j += 1) {
        const jNext = (j + 1) % loop.length;
        if (j === i || j === iNext || jNext === i) continue;
        if (segmentsCross(points[i], points[iNext], points[j], points[jNext])) {
          foundCrossing = true;
          for (const index of [i, iNext, j, jNext]) limits[index] *= 0.85;
        }
      }
    }
    if (!foundCrossing) return { points, safeLimitsMm: limits };
  }
  return { points: rawTillerHansonOffset(loop, limits, maxMiterScale), safeLimitsMm: limits };
}

function variableInsetWidthMm(profile?: EdgeProfile): number | null {
  if (!profile) return null;
  if (profile.kind === 'beveled' && typeof profile.widthMm === 'number') return profile.widthMm;
  if (profile.kind === 'german_carve'
    && typeof profile.insetMm === 'number'
    && typeof profile.channelRadiusMm === 'number') {
    return Math.max(profile.insetMm, 0) + profile.channelRadiusMm;
  }
  if (profile.kind === 'freeform') {
    if (profile.previewFallback === 'beveled') return 15;
    if (profile.previewFallback === 'german_carve') return 20;
  }
  return null;
}

/** The top-face inset boundary shared by the canvas and SVG export. */
export function bevelInsetLoop(project: GuitarProject): Vector2D[] | null {
  const width = variableInsetWidthMm(project.edgeProfile);
  if (width === null || width <= 0) return null;
  const flattened = flattenContour(project.contour);
  const loop = [...flattened.points];
  if (loop.length > 1 && pointsEqual(loop[0], loop[loop.length - 1])) loop.pop();
  if (loop.length < 3) return null;
  const intensities = resolveBevelIntensities(project.contour, flattened);
  return offsetPolygon(loop, intensities.map((value) => width * value)).points;
}

/** Closed polyline path with the same two-decimal spelling as iOS SVG output. */
export function closedPolylineToSVGPath(points: Vector2D[]): string {
  if (points.length === 0) return '';
  return `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')} Z`;
}
