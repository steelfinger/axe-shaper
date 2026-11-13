import { describe, expect, it } from 'vitest';
import type { PathAnchor, SymmetryConfig } from '../../types/guitar';
import { nudgeAnchors, nudgeDeltaForKey } from '../anchorNudge';

const anchor = (id: string, x: number, y: number, extra: Partial<PathAnchor> = {}): PathAnchor => ({
  id, position: { x, y }, handleMode: 'corner', ...extra,
});

describe('nudgeDeltaForKey', () => {
  it('steps 1mm, and 10mm with Shift, in screen directions', () => {
    expect(nudgeDeltaForKey('ArrowLeft', false, 0)).toEqual({ x: -1, y: 0 });
    expect(nudgeDeltaForKey('ArrowRight', false, 0)).toEqual({ x: 1, y: 0 });
    expect(nudgeDeltaForKey('ArrowUp', false, 0)).toEqual({ x: 0, y: -1 });
    expect(nudgeDeltaForKey('ArrowDown', true, 0)).toEqual({ x: 0, y: 10 });
  });

  it('follows the screen when the canvas is horizontal', () => {
    // Rotated 90 degrees, model +Y points left on screen and model +X points down.
    expect(nudgeDeltaForKey('ArrowLeft', false, 90)).toEqual({ x: 0, y: 1 });
    expect(nudgeDeltaForKey('ArrowRight', true, 90)).toEqual({ x: 0, y: -10 });
    expect(nudgeDeltaForKey('ArrowUp', false, 90)).toEqual({ x: -1, y: 0 });
    expect(nudgeDeltaForKey('ArrowDown', false, 90)).toEqual({ x: 1, y: 0 });
  });

  it('ignores other keys', () => {
    expect(nudgeDeltaForKey('a', false, 0)).toBeNull();
    expect(nudgeDeltaForKey('Enter', true, 0)).toBeNull();
  });
});

describe('nudgeAnchors', () => {
  const live: SymmetryConfig = { mode: 'live_centerline' } as SymmetryConfig;

  it('moves every selected anchor and leaves the rest untouched', () => {
    const nodes = [anchor('a', 10, 20, { handleOut: { x: 3, y: 4 } }), anchor('b', 30, 40), anchor('c', 50, 60)];
    const result = nudgeAnchors(nodes, new Set(['a', 'b']), { x: -10, y: 1 });
    expect(result[0].position).toEqual({ x: 0, y: 21 });
    expect(result[0].handleOut).toEqual({ x: 3, y: 4 });
    expect(result[1].position).toEqual({ x: 20, y: 41 });
    expect(result[2]).toBe(nodes[2]);
    expect(nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('never moves a locked anchor', () => {
    const nodes = [anchor('pocket', -28, 0, { locked: true }), anchor('b', 30, 40)];
    expect(nudgeAnchors(nodes, new Set(['pocket']), { x: 1, y: 0 })).toBe(nodes);
    const mixed = nudgeAnchors(nodes, new Set(['pocket', 'b']), { x: 1, y: 0 });
    expect(mixed[0]).toBe(nodes[0]);
    expect(mixed[1].position).toEqual({ x: 31, y: 40 });
  });

  it('carries the mirror partner for a single anchor under live symmetry', () => {
    const nodes = [anchor('l', -100, 50, { mirrorId: 'r' }), anchor('r', 100, 50, { mirrorId: 'l' })];
    const result = nudgeAnchors(nodes, new Set(['l']), { x: -10, y: 1 }, live);
    expect(result[0].position).toEqual({ x: -110, y: 51 });
    expect(result[1].position).toEqual({ x: 110, y: 51 });
  });

  it('does not mirror without symmetry, or for a multi-selection', () => {
    const nodes = [anchor('l', -100, 50, { mirrorId: 'r' }), anchor('r', 100, 50, { mirrorId: 'l' }), anchor('c', 0, 200)];
    expect(nudgeAnchors(nodes, new Set(['l']), { x: -1, y: 0 })[1]).toBe(nodes[1]);
    const group = nudgeAnchors(nodes, new Set(['l', 'c']), { x: 1, y: 0 }, live);
    expect(group[0].position.x).toBe(-99);
    expect(group[1]).toBe(nodes[1]);
    expect(group[2].position.x).toBe(1);
  });
});
