import { describe, expect, it } from 'vitest';
import { HistoryManager } from '../history';

type Doc = { n: number };
const make = (limit?: number) => new HistoryManager<Doc>((d) => ({ ...d }), limit);

describe('HistoryManager', () => {
  it('undoes and redoes whole snapshots', () => {
    const h = make();
    h.push({ n: 1 });
    expect(h.undo({ n: 2 })).toEqual({ n: 1 });
    expect(h.redo({ n: 1 })).toEqual({ n: 2 });
  });

  it('returns null when there is nothing to undo or redo', () => {
    const h = make();
    expect(h.undo({ n: 0 })).toBeNull();
    expect(h.redo({ n: 0 })).toBeNull();
  });

  it('clears redo when a new edit is recorded', () => {
    const h = make();
    h.push({ n: 1 });
    h.undo({ n: 2 });
    expect(h.canRedo()).toBe(true);
    h.push({ n: 1 });
    expect(h.canRedo()).toBe(false);
  });

  it('records one step for a whole gesture sharing a coalesce key', () => {
    const h = make();
    h.push({ n: 0 }, 'drag');
    h.push({ n: 1 }, 'drag');
    h.push({ n: 2 }, 'drag');
    expect(h.depth()).toBe(1);
    expect(h.undo({ n: 3 })).toEqual({ n: 0 });
  });

  it('starts a new step after endGesture', () => {
    const h = make();
    h.push({ n: 0 }, 'drag');
    h.endGesture();
    h.push({ n: 1 }, 'drag');
    expect(h.depth()).toBe(2);
  });

  it('starts a new step when the key changes', () => {
    const h = make();
    h.push({ n: 0 }, 'a');
    h.push({ n: 1 }, 'b');
    expect(h.depth()).toBe(2);
  });

  it('evicts the oldest step past the limit', () => {
    const h = make(2);
    h.push({ n: 1 });
    h.push({ n: 2 });
    h.push({ n: 3 });
    expect(h.depth()).toBe(2);
    expect(h.undo({ n: 4 })).toEqual({ n: 3 });
    expect(h.undo({ n: 3 })).toEqual({ n: 2 });
    expect(h.undo({ n: 2 })).toBeNull();
  });

  it('snapshots by clone, so later mutation does not rewrite history', () => {
    const h = make();
    const doc = { n: 1 };
    h.push(doc);
    doc.n = 99;
    expect(h.undo({ n: 99 })).toEqual({ n: 1 });
  });

  it('reset drops both stacks', () => {
    const h = make();
    h.push({ n: 1 });
    h.undo({ n: 2 });
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });
});
