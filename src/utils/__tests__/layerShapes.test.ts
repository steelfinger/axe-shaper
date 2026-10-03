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
