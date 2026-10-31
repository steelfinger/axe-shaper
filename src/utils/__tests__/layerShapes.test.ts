import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import {
  activeLayersEqual,
  addingBackRoute,
  addingFrontRoute,
  addingPickguard,
  deletingLayerShape,
  getActiveContour,
  layerShapeExists,
  withActiveContour,
  type ActiveLayer,
} from '../layerShapes';

const base = createProject();

describe('active layer', () => {
  it('compares by kind, and by id except for the body', () => {
    expect(activeLayersEqual({ kind: 'body' }, { kind: 'body' })).toBe(true);
    expect(activeLayersEqual({ kind: 'pickguard', id: 'a' }, { kind: 'pickguard', id: 'a' })).toBe(true);
    expect(activeLayersEqual({ kind: 'pickguard', id: 'a' }, { kind: 'pickguard', id: 'b' })).toBe(false);
    expect(activeLayersEqual({ kind: 'pickguard', id: 'a' }, { kind: 'frontRoute', id: 'a' })).toBe(false);
  });

  it('resolves the body to the project contour', () => {
    expect(getActiveContour(base, { kind: 'body' })).toBe(base.contour);
  });
});

describe.each([
  ['pickguard', addingPickguard, 'pickguards'],
  ['frontRoute', addingFrontRoute, 'frontRoutes'],
  ['backRoute', addingBackRoute, 'backRoutes'],
] as const)('%s layer', (kind, add, field) => {
  it('adds a closed four-anchor shape and activates it', () => {
    const before = base[field]?.length ?? 0;
    const { project, layer } = add(base);
    expect(layer.kind).toBe(kind);
    expect(project[field]).toHaveLength(before + 1);
    const contour = getActiveContour(project, layer)!;
    expect(contour.closed).toBe(true);
    expect(contour.anchors).toHaveLength(4);
    expect(base[field]?.length ?? 0).toBe(before); // input not mutated
  });

  it('writes a contour back to only that shape', () => {
    const first = add(base);
    const second = add(first.project);
    const edited = { ...getActiveContour(second.project, second.layer)!, closed: false };
    const result = withActiveContour(second.project, second.layer, edited);
    expect(getActiveContour(result, second.layer)!.closed).toBe(false);
    expect(getActiveContour(result, first.layer)!.closed).toBe(true);
  });

  it('deletes it, after which the layer no longer exists', () => {
    const { project, layer } = add(base);
    const deleted = deletingLayerShape(project, layer as Exclude<ActiveLayer, { kind: 'body' }>);
    expect(layerShapeExists(deleted, layer)).toBe(false);
    expect(getActiveContour(deleted, layer)).toBeNull();
  });
});

describe.each([
  ['frontRoute', addingFrontRoute],
  ['backRoute', addingBackRoute],
] as const)('a new %s', (_kind, add) => {
  it('starts as a pillow: symmetric 10mm handles at 45 degrees, edges bowing outward', () => {
    const { project, layer } = add(base);
    const anchors = getActiveContour(project, layer)!.anchors;
    const cx = anchors.reduce((s, a) => s + a.position.x, 0) / 4;
    const cy = anchors.reduce((s, a) => s + a.position.y, 0) / 4;
    for (const a of anchors) {
      expect(a.handleMode).toBe('symmetric');
      const out = a.handleOut!;
      expect(Math.hypot(out.x, out.y)).toBeCloseTo(10, 9);
      expect(Math.abs(out.x)).toBeCloseTo(Math.abs(out.y), 9);
      expect(a.handleIn!.x).toBeCloseTo(-out.x, 9);
      expect(a.handleIn!.y).toBeCloseTo(-out.y, 9);
      // Perpendicular to the line from the centre: tangent, not pointing in or out.
      const rx = a.position.x - cx;
      const ry = a.position.y - cy;
      expect(Math.sign(rx) * out.x + Math.sign(ry) * out.y).toBeCloseTo(0, 9);
    }
    // Each edge's control points sit outside the straight chord between its anchors.
    for (let i = 0; i < 4; i++) {
      const a = anchors[i];
      const b = anchors[(i + 1) % 4];
      const mid = { x: (a.position.x + b.position.x) / 2 - cx, y: (a.position.y + b.position.y) / 2 - cy };
      const c1 = { x: a.position.x + a.handleOut!.x - cx, y: a.position.y + a.handleOut!.y - cy };
      expect(c1.x * mid.x + c1.y * mid.y).toBeGreaterThan(mid.x * mid.x + mid.y * mid.y);
    }
  });
});

describe('a new pickguard', () => {
  it('stays a plain corner rectangle', () => {
    const { project, layer } = addingPickguard(base);
    for (const a of getActiveContour(project, layer)!.anchors) {
      expect(a.handleMode).toBe('corner');
      expect(a.handleOut).toBeUndefined();
    }
  });
});

describe('layerShapeExists', () => {
  it('is always true for the body and false for an unknown id', () => {
    expect(layerShapeExists(base, { kind: 'body' })).toBe(true);
    expect(layerShapeExists(base, { kind: 'pickguard', id: 'ghost' })).toBe(false);
  });

  it('lands a new shape inside the body\'s own extent', () => {
    const { project, layer } = addingPickguard(base);
    const xs = base.contour.anchors.map((a) => a.position.x);
    const ys = base.contour.anchors.map((a) => a.position.y);
    for (const a of getActiveContour(project, layer)!.anchors) {
      expect(a.position.x).toBeGreaterThan(Math.min(...xs) - 100);
      expect(a.position.x).toBeLessThan(Math.max(...xs) + 100);
      expect(a.position.y).toBeGreaterThan(Math.min(...ys) - 100);
      expect(a.position.y).toBeLessThan(Math.max(...ys) + 100);
    }
  });
});
