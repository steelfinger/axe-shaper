import { describe, expect, it } from 'vitest';
import { REFERENCE_TEMPLATES } from '../../constants/templates';
import { evaluateCubicBezier, getSegmentControlPoints, segmentCount } from '../bezier';
import { applyBlueprintJacks, blueprintJackIds } from '../blueprintJacks';
import { requiredSchemaVersion } from '../../constants/schema';
import { createProject } from '../projectFactory';
import type { BodyContour, Vector2D } from '../../types/guitar';

// The coordinates are the user's (Tero's) measured jack centres for each blueprint.
const EXPECTED: Record<string, { x: number; y: number; style: 'direct' | 'strat_plate'; angle?: number }> = {
  s_style: { x: 93.2, y: 317.7, style: 'strat_plate', angle: 40 },
  semi_hollow_double_cut: { x: 76, y: 405, style: 'direct' },
  sg_style: { x: 72, y: 403, style: 'direct' },
  gibson_flying_v: { x: 186, y: 503, style: 'direct' },
  gibson_firebird: { x: 78, y: 421, style: 'direct' },
  jag_style: { x: 120, y: 312, style: 'direct' },
  p_bass_style: { x: 99, y: 371, style: 'direct' },
  j_bass_style: { x: 137, y: 328, style: 'direct' },
  mm_bass_style: { x: 96, y: 351, style: 'direct' },
  mustang_bass_style: { x: 125, y: 303, style: 'direct' },
};

function polygon(contour: BodyContour): Vector2D[] {
  const points: Vector2D[] = [];
  for (let i = 0; i < segmentCount(contour.anchors, contour.closed); i += 1) {
    const [p0, p1, p2, p3] = getSegmentControlPoints(contour.anchors, i, contour.closed)!;
    for (let k = 0; k < 40; k += 1) points.push(evaluateCubicBezier(p0, p1, p2, p3, k / 40));
  }
  return points;
}
function inside(point: Vector2D, poly: Vector2D[]): boolean {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

const parts = (id: string) => {
  const template = REFERENCE_TEMPLATES[id];
  return {
    potentiometers: template.defaultPotentiometers ?? [],
    pickguards: template.defaultPickguards ?? [],
    jacks: template.defaultJacks ?? [],
  };
};

describe('blueprint output jacks', () => {
  it('covers exactly the ten blueprints that have a jack', () => {
    expect(blueprintJackIds().sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.keys(EXPECTED))('%s gets its jack at the measured centre', (id) => {
    const want = EXPECTED[id];
    const { jacks } = applyBlueprintJacks(id, parts(id), true);
    expect(jacks).toHaveLength(1);
    expect(jacks[0].position).toEqual({ x: want.x, y: want.y });
    expect(jacks[0].mountingStyle).toBe(want.style);
    expect(jacks[0].angleDegrees).toBe(want.angle ?? 0);
  });

  it.each(Object.keys(EXPECTED))('%s keeps its jack inside the body outline', (id) => {
    const template = REFERENCE_TEMPLATES[id];
    const { jacks } = applyBlueprintJacks(id, parts(id), true);
    const body = polygon({ anchors: template.defaultAnchors, closed: true });
    expect(inside(jacks[0].position, body)).toBe(true);
  });

  it('is a no-op while authoring is disabled, so blueprints stay at schema 7', () => {
    for (const id of Object.keys(EXPECTED)) {
      expect(applyBlueprintJacks(id, parts(id), false)).toEqual(parts(id));
      expect(requiredSchemaVersion(createProject({ templateId: id }))).toBe(7);
    }
  });

  it('only the Jaguar loses a potentiometer, and it is the third one', () => {
    for (const id of Object.keys(EXPECTED)) {
      const before = parts(id).potentiometers;
      const after = applyBlueprintJacks(id, parts(id), true).potentiometers;
      expect(after.length, id).toBe(id === 'jag_style' ? before.length - 1 : before.length);
    }
    const before = parts('jag_style').potentiometers;
    const after = applyBlueprintJacks('jag_style', parts('jag_style'), true).potentiometers;
    expect(before).toHaveLength(3);
    expect(after.map((pot) => pot.id)).toEqual(before.slice(0, 2).map((pot) => pot.id));
    // The removed pot sat within a few millimetres of the new jack.
    const removed = before[2].position;
    expect(Math.hypot(removed.x - 120, removed.y - 312)).toBeLessThan(5);
  });

  it('only the Flying V gains a pickguard: a 44 mm round guard centred on the jack', () => {
    for (const id of Object.keys(EXPECTED)) {
      const before = parts(id).pickguards;
      const after = applyBlueprintJacks(id, parts(id), true).pickguards;
      expect(after.length, id).toBe(id === 'gibson_flying_v' ? before.length + 1 : before.length);
    }
    const guard = applyBlueprintJacks('gibson_flying_v', parts('gibson_flying_v'), true).pickguards.at(-1)!;
    const poly = polygon(guard.contour);
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(44, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(44, 1);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(186, 1);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(503, 1);
  });

  it('the S-style plate sits on its Front Cavity #2 with the same long-axis direction', () => {
    const template = REFERENCE_TEMPLATES.s_style;
    const cavity = polygon(template.defaultFrontRoutes![1].contour);
    const centre = { x: 93.2, y: 317.7 };
    expect(inside(centre, cavity)).toBe(true);
    let best = { extent: 0, degrees: 0 };
    for (let degrees = 0; degrees < 180; degrees += 0.25) {
      const r = (degrees * Math.PI) / 180;
      const projections = cavity.map((p) => p.x * Math.cos(r) + p.y * Math.sin(r));
      const extent = Math.max(...projections) - Math.min(...projections);
      if (extent > best.extent) best = { extent, degrees };
    }
    expect(Math.abs(best.degrees - 40)).toBeLessThanOrEqual(2.5);
  });
});
