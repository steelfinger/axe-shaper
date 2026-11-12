import { describe, expect, it } from 'vitest';
import { contourBounds } from '../bezier';
import { createProject } from '../projectFactory';
import { exportProjectToSVG } from '../svgExporter';
import {
  PAPER_SIZES,
  calibrationOverlaySVG,
  flapGuideOffsetsMm,
  parseMm,
  printBoundsMm,
  registrationMarkOffsetsMm,
  seamEdgesFor,
  seamOverlaySVG,
  tilingFor,
} from '../tiledPrint';

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

describe('seam guides and registration marks', () => {
  const a4 = PAPER_SIZES.a4;
  const plan = tilingFor(380, 520, a4);
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  const drawingMarks = (column: number, row: number) =>
    registrationMarkOffsetsMm(plan, seamEdgesFor(column, row, plan)).map((m) => ({
      x: column * plan.stepXMm + m.x,
      y: row * plan.stepYMm + m.y,
    }));

  it('precondition: the drawing tiles both ways', () => {
    expect(plan.columns).toBeGreaterThan(1);
    expect(plan.rows).toBeGreaterThan(1);
  });

  it('puts every crosshair where a neighbouring sheet prints one too', () => {
    for (let row = 0; row < plan.rows; row++) {
      for (let column = 0; column < plan.columns; column++) {
        const here = drawingMarks(column, row);
        expect(here.length).toBeGreaterThan(0);
        for (const mark of here) {
          let shared = false;
          for (let r = 0; r < plan.rows; r++) {
            for (let c = 0; c < plan.columns; c++) {
              if ((c !== column || r !== row) && drawingMarks(c, r).some((m) => near(m, mark))) shared = true;
            }
          }
          expect(shared, `mark ${JSON.stringify(mark)} on sheet ${column},${row}`).toBe(true);
        }
      }
    }
  });

  it("places each dashed guide on the neighbour's printable-area edge", () => {
    const right = flapGuideOffsetsMm(plan, { left: false, right: true, top: false, bottom: false }).vertical[0];
    const left = flapGuideOffsetsMm(plan, { left: true, right: false, top: false, bottom: false }).vertical[0];
    // Tile 0 starts at 0, tile 1 at stepXMm.
    expect(right).toBeCloseTo(plan.stepXMm, 9);
    expect(plan.stepXMm + left).toBeCloseTo(plan.usableWidthMm, 9);
  });

  it('draws nothing on a single sheet', () => {
    const single = tilingFor(100, 150, a4);
    const edges = seamEdgesFor(0, 0, single);
    expect(registrationMarkOffsetsMm(single, edges)).toEqual([]);
    expect(seamOverlaySVG(single, edges)).toBe('');
  });
});

describe('printBoundsMm', () => {
  const project = createProject();

  it('is the drawn extent of the design, not the saved SVG page', () => {
    const bounds = printBoundsMm(project)!;
    const body = contourBounds(project.contour.anchors, project.contour.closed)!;
    expect(bounds.minX).toBeLessThanOrEqual(body.minX);
    expect(bounds.minY).toBeLessThanOrEqual(body.minY);
    expect(bounds.widthMm).toBeGreaterThanOrEqual(body.widthMm);
    expect(bounds.heightMm).toBeGreaterThanOrEqual(body.heightMm);

    // The page adds padding, a label margin and the title band; tiling it is
    // what printed 9 sheets where the iPad app prints 4.
    const page = exportProjectToSVG(project);
    const pageWidthMm = parseMm(page.match(/\swidth="([^"]+)"/)![1])!;
    const pageHeightMm = parseMm(page.match(/\sheight="([^"]+)"/)![1])!;
    expect(pageWidthMm - bounds.widthMm).toBeGreaterThan(90);
    expect(pageHeightMm - bounds.heightMm).toBeGreaterThan(200);
  });

  it('prints the default design on four A4 sheets', () => {
    const bounds = printBoundsMm(project)!;
    const plan = tilingFor(bounds.widthMm, bounds.heightMm, PAPER_SIZES.a4);
    expect([plan.columns, plan.rows]).toEqual([2, 2]);
  });

  it('grows to take in a control placed outside the body', () => {
    const base = printBoundsMm(project)!;
    const far = base.minX + base.widthMm + 100;
    const withSwitch = printBoundsMm({
      ...project,
      switches: [{ id: 's', type: 'gibson_toggle', position: { x: far, y: 0 }, angleDegrees: 0 }],
    })!;
    expect(withSwitch.minX + withSwitch.widthMm).toBeCloseTo(far + 18, 9);
  });
});

describe('calibrationOverlaySVG', () => {
  const plan = tilingFor(380, 520, PAPER_SIZES.a4);

  it('draws a 100mm square at 1:1 in printable-area mm', () => {
    const svg = calibrationOverlaySVG(plan, null);
    expect(svg).toContain(`viewBox="0 0 ${plan.usableWidthMm} ${plan.usableHeightMm}"`);
    expect(svg).toContain(`width="${plan.usableWidthMm}mm"`);
    expect(svg).toContain('<rect x="0" y="0" width="100" height="100"');
  });

  it('carries the neck joint disclosure, escaped', () => {
    expect(calibrationOverlaySVG(plan, 'Custom <joint>')).toContain('Custom &lt;joint&gt;');
  });
});
