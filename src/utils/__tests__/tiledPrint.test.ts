import { describe, expect, it } from 'vitest';
import { PAPER_SIZES, parseMm, tilingFor } from '../tiledPrint';

describe('parseMm', () => {
  it('reads a millimetre length', () => {
    expect(parseMm('420mm')).toBe(420);
    expect(parseMm(' 99.5MM ')).toBe(99.5);
  });

  it.each([null, '', '420', '420px', '-5mm', 'mm', '1e3mm'])('rejects %j', (value) => {
    expect(parseMm(value)).toBeNull();
  });
});

describe('tilingFor', () => {
  const a4 = PAPER_SIZES.a4;

  it('uses one tile for a drawing that fits the printable area', () => {
    const plan = tilingFor(100, 100, a4);
    expect([plan.columns, plan.rows]).toEqual([1, 1]);
  });

  it('keeps a 10mm margin and a 10mm overlap', () => {
    const plan = tilingFor(100, 100, a4);
    expect(plan.usableWidthMm).toBe(190);
    expect(plan.usableHeightMm).toBe(277);
    expect(plan.stepXMm).toBe(180);
    expect(plan.stepYMm).toBe(267);
  });

  it('adds a tile only once the overlap is exhausted', () => {
    // One tile covers 190mm; a second adds 180mm more, so 370mm needs exactly two.
    expect(tilingFor(190, 100, a4).columns).toBe(1);
    expect(tilingFor(190.1, 100, a4).columns).toBe(2);
    expect(tilingFor(370, 100, a4).columns).toBe(2);
    expect(tilingFor(370.1, 100, a4).columns).toBe(3);
  });

  it('covers the whole drawing: the last tile reaches past its far edge', () => {
    for (const [w, h] of [[500, 1500], [1000, 400], [215, 300]] as const) {
      const plan = tilingFor(w, h, a4);
      expect((plan.columns - 1) * plan.stepXMm + plan.usableWidthMm).toBeGreaterThanOrEqual(w);
      expect((plan.rows - 1) * plan.stepYMm + plan.usableHeightMm).toBeGreaterThanOrEqual(h);
    }
  });

  it('tiles for Letter on its own dimensions', () => {
    const plan = tilingFor(100, 100, PAPER_SIZES.letter);
    expect(plan.usableWidthMm).toBeCloseTo(195.9, 10);
    expect(plan.usableHeightMm).toBeCloseTo(259.4, 10);
  });

  it('never returns fewer than one tile', () => {
    const plan = tilingFor(0, 0, a4);
    expect([plan.columns, plan.rows]).toEqual([1, 1]);
  });
});
