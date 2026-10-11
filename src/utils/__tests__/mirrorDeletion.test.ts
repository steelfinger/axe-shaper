import { describe, expect, it } from 'vitest';
import type { PathAnchor } from '../../types/guitar';
import { removeAnchorsAndUnlinkMirrors } from '../symmetry';

const anchor = (id: string, mirrorId?: string, locked = false): PathAnchor => ({
  id, mirrorId, locked, position: { x: 10, y: 20 }, handleMode: 'corner',
});
describe('editor mirror cleanup on deletion', () => {
  it('unlinks a surviving locked partner without moving it or mutating the original', () => {
    const nodes = [anchor('left', 'right'), anchor('right', 'left', true), anchor('unpaired')];
    const result = removeAnchorsAndUnlinkMirrors(nodes, new Set(['left']));
    expect(result.map(node => node.id)).toEqual(['right', 'unpaired']);
    expect(Object.hasOwn(result[0], 'mirrorId')).toBe(false);
    expect(result[0].locked).toBe(true);
    expect(result[0].position).toBe(nodes[1].position);
    expect(nodes[1].mirrorId).toBe('left');
    expect(result[1]).toBe(nodes[2]);
  });
  it('supports explicit bulk deletion and preserves remaining valid pairs', () => {
    const nodes = [anchor('a', 'b'), anchor('b', 'a'), anchor('c', 'd'), anchor('d', 'c'), anchor('e', 'missing')];
    const result = removeAnchorsAndUnlinkMirrors(nodes, new Set(['a', 'e']));
    expect(result.map(node => node.id)).toEqual(['b', 'c', 'd']);
    expect(result[0].mirrorId).toBeUndefined();
    expect(result[1]).toBe(nodes[2]);
    expect(result[2]).toBe(nodes[3]);
  });
});
