import { describe, expect, it } from 'vitest';
import {
  jackPlateCutout,
  jackPlateHole,
  jackPlateOutline,
  jackPlateScrews,
  placedAbout,
  polygonArea,
} from '../jackPlateShape';
import { JACK_DRAWING_GEOMETRY as g } from '../../constants/planDrawingStyle';

// The same traced curves live in the viewer (plateOutlineTrace) and the iPad
// (JackGeometry.plateOutlineTrace). Each repository pins the same areas, so a
// drift in any copy of the numbers fails a test somewhere.
const OUTLINE_AREA_MM2 = 1998.94;
const CUTOUT_AREA_MM2 = 1028.95;

const bounds = (points: Array<{ x: number; y: number }>) => ({
  minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)),
});
const inside = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
};

describe('Strat jack plate shape', () => {
  it('keeps the agreed 80.5 x 31.3 mm footprint', () => {
    const box = bounds(jackPlateOutline());
    expect(box.maxX - box.minX).toBeCloseTo(g.plateLengthMm, 2);
    expect(box.maxY - box.minY).toBeCloseTo(g.plateWidthMm, 2);
    expect(box.minX + box.maxX).toBeCloseTo(0, 2);
  });

  it('is a teardrop: round at one end, a small point at the other', () => {
    const outline = jackPlateOutline();
    const halfHeightAt = (x: number) => Math.max(...outline.filter((p) => Math.abs(p.x - x) < 0.8).map((p) => Math.abs(p.y)));
    expect(halfHeightAt(-g.plateLengthMm / 2 + 5)).toBeGreaterThan(9);
    expect(halfHeightAt(g.plateLengthMm / 2 - 5)).toBeLessThan(6);
    // Widest toward the round end, as in the drawing.
    const widest = outline.reduce((best, p) => (Math.abs(p.y) > Math.abs(best.y) ? p : best));
    expect(widest.x).toBeLessThan(0);
  });

  it('pins the traced curves with an area fingerprint shared with the viewer and the iPad', () => {
    expect(polygonArea(jackPlateOutline())).toBeCloseTo(OUTLINE_AREA_MM2, 1);
    expect(polygonArea(jackPlateCutout())).toBeCloseTo(CUTOUT_AREA_MM2, 1);
  });

  it('puts the cutout inside the plate, with the jack hole and both screws on the right parts', () => {
    const outline = jackPlateOutline();
    const cutout = jackPlateCutout();
    expect(cutout.every((p) => inside(p, outline))).toBe(true);
    // 49 mm long, with a flat left edge.
    const cut = bounds(cutout);
    expect((cut.maxX - cut.minX) * 81 / g.plateLengthMm).toBeCloseTo(49.4, 0);
    const hole = jackPlateHole();
    expect(inside(hole, cutout)).toBe(true);
    expect(hole.x - g.holeDiameterMm / 2).toBeGreaterThan(cut.minX);
    expect(hole.x).toBeLessThan(0);
    // The screws sit on the plate, outside the cutout, 71 mm apart, the left one nearer its end.
    const [left, right] = jackPlateScrews();
    expect(right.x - left.x).toBeCloseTo(g.plateScrewSpacingMm, 6);
    for (const screw of [left, right]) {
      expect(inside(screw, outline)).toBe(true);
      expect(inside(screw, cutout)).toBe(false);
    }
    expect(left.x - bounds(outline).minX).toBeLessThan(bounds(outline).maxX - right.x + 3);
  });

  it('turns clockwise in plan, with the pointed end toward +x at 0 degrees', () => {
    const turned = placedAbout(jackPlateOutline(), { x: 100, y: 200 }, 90);
    const box = bounds(turned);
    expect(box.maxY - 200).toBeCloseTo(g.plateLengthMm / 2, 2);
    expect(box.minY - 200).toBeCloseTo(-g.plateLengthMm / 2, 2);
    expect(box.maxX - box.minX).toBeCloseTo(g.plateWidthMm, 2);
  });
});
