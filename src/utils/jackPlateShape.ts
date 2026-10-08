import { JACK_DRAWING_GEOMETRY } from '../constants/planDrawingStyle';
import type { Vector2D } from '../types/guitar';

/**
 * The shape of a Strat jack plate (schema 8), shared by the editor canvas, the
 * printable plan and the 3D previews.
 *
 * A real plate is a teardrop, round at the inner end and a small rounded point at
 * the outer one, with a teardrop cutout whose left edge is flat. Both curves are
 * traced from a manufacturer's drawing (81 x 32.5 mm, cutout 49 mm, screws 70.5 mm
 * apart), each as [mm from the round end, half-height in mm] for one half of a
 * shape that is symmetric about its axis. They are scaled onto the agreed
 * 80.5 x 31.3 mm overall size, so the footprint is what the plan has always said.
 *
 * The same numbers are in the viewer's `plateOutlineTrace` and the iPad's
 * `JackGeometry.plateOutlineTrace`; each repository asserts the same area for
 * them, so a drift in any copy fails a test.
 *
 * At `angleDegrees` 0 the pointed end is toward +X.
 */
export const JACK_PLATE_TRACE_LENGTH_MM = 81;
export const JACK_PLATE_TRACE_HALF_WIDTH_MM = 16.3;
/** The left (round-end) screw's distance from its end; the right one follows at the 71 mm spacing. */
export const JACK_PLATE_SCREW_FROM_ROUND_END_MM = 5.6;
/** The jack's through-hole, measured from the round end of the traced drawing. */
export const JACK_PLATE_HOLE_FROM_ROUND_END_MM = 29.1;

const outlineTrace: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.4, 4], [1, 5.3], [2, 7.3], [3, 8.79], [4, 9.95], [5, 10.94], [6, 11.47], [8, 12.87], [10, 13.69], [12, 14.23], [14, 14.64], [16, 14.98], [18, 15.28], [20, 15.52], [22, 15.9], [24, 15.92], [26, 15.94], [28, 16.23], [30, 16.25], [32, 16.3], [34, 16.3], [36, 16.3], [38, 16.23], [40, 16.16], [42, 16.01], [44, 15.86], [46, 15.65], [48, 15.42], [50, 15.14], [52, 14.81], [54, 14.45], [56, 14.05], [58, 13.59], [60, 13.05], [62, 12.45], [64, 11.78], [66, 11.04], [68, 10.23], [70, 9.31], [72, 8.33], [74, 7.16], [75, 6.53], [76, 5.86], [77, 5.14], [78, 4.36], [79, 3.49], [80, 2.55], [80.6, 2.08], [81, 0],
];
/** The cutout's top half, from its flat left edge (first point) to its tip (last point). */
const recessTrace: ReadonlyArray<readonly [number, number]> = [
  [22.13, 10.06], [22.23, 10.83], [22.53, 11.56], [23.01, 12.18], [23.63, 12.66], [24.35, 12.96], [25.13, 13.06], [25.63, 13.06], [27.13, 13.06], [28.63, 13.06], [30.13, 13.12], [31.63, 13.13], [33.13, 13.13], [34.63, 13.13], [36.13, 13.13], [37.63, 13.06], [39.13, 12.98], [40.63, 12.91], [42.13, 12.8], [43.63, 12.68], [45.13, 12.53], [46.63, 12.34], [48.13, 12.14], [49.63, 11.91], [51.13, 11.64], [52.63, 11.35], [54.13, 11.02], [55.63, 10.66], [57.13, 10.26], [58.63, 9.79], [60.13, 9.33], [61.63, 8.82], [63.13, 8.23], [64.63, 7.56], [66.13, 6.79], [67.63, 5.87], [69.13, 4.76], [70.63, 3.2], [71.56, 0],
];

/** Plate-local x of a point `u` mm from the round end of the 81 mm drawing. */
function localX(u: number): number {
  return (u / JACK_PLATE_TRACE_LENGTH_MM - 0.5) * JACK_DRAWING_GEOMETRY.plateLengthMm;
}

/** One traced half-shape, mirrored into a closed outline in plate-local mm (origin at the plate's centre). */
function traceOutline(trace: ReadonlyArray<readonly [number, number]>): Vector2D[] {
  const y = (h: number) => h / JACK_PLATE_TRACE_HALF_WIDTH_MM * JACK_DRAWING_GEOMETRY.plateWidthMm / 2;
  const top = trace.map(([u, h]) => ({ x: localX(u), y: -y(h) }));
  // Back along the other side, without repeating the points that sit on the axis.
  const bottom = trace.slice(0, -1).reverse().filter(([, h]) => h > 0).map(([u, h]) => ({ x: localX(u), y: y(h) }));
  return [...top, ...bottom];
}

export function jackPlateOutline(): Vector2D[] {
  return traceOutline(outlineTrace);
}

export function jackPlateCutout(): Vector2D[] {
  return traceOutline(recessTrace);
}

/** The two screw centres, in the plate's own (unrotated) frame: asymmetric, the pointed end being narrower. */
export function jackPlateScrews(): [Vector2D, Vector2D] {
  const left = localX(JACK_PLATE_SCREW_FROM_ROUND_END_MM);
  return [{ x: left, y: 0 }, { x: left + JACK_DRAWING_GEOMETRY.plateScrewSpacingMm, y: 0 }];
}

/** Where the jack's 9.8 mm through-hole is, in the plate's own frame: inside the cutout, toward the round end. */
export function jackPlateHole(): Vector2D {
  return { x: localX(JACK_PLATE_HOLE_FROM_ROUND_END_MM), y: 0 };
}

/** Plate-local points turned by `degrees` (clockwise in plan, as everywhere) about the origin, then moved to `centre`. */
export function placedAbout(points: Vector2D[], centre: Vector2D, degrees: number): Vector2D[] {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return points.map((point) => ({
    x: centre.x + point.x * cosine - point.y * sine,
    y: centre.y + point.x * sine + point.y * cosine,
  }));
}

/** Shoelace area, mm². Positive whichever way the outline winds. */
export function polygonArea(points: Vector2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
