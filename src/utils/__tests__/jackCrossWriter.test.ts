import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/ios-written-v5/output_jacks.axe.svg?raw';
import { exportProjectToSVG, extractProjectFromSVG } from '../svgExporter';

// The iOS app writes its own printable plan. A jack must be drawn with the same
// primitives and numbers on both sides, or the same document prints differently
// depending on which app saved it. Compared structurally (element, class, style,
// numbers), not byte for byte: attribute order and whitespace differ by writer.
function jackPrimitives(svg: string): string[] {
  const start = svg.indexOf('id="control-jacks"');
  expect(start, 'no control-jacks group').toBeGreaterThan(-1);
  const rest = svg.slice(start);
  const bridge = rest.search(/<!-- Family-specific bridge|<g id="bridge/);
  const body = bridge === -1 ? rest : rest.slice(0, bridge);
  return [...body.matchAll(/<(g|rect|circle|polygon)\b([^>]*)>/g)].map((match) => {
    const attrs = match[2];
    const numbers = (attrs.match(/-?\d+(?:\.\d+)?/g) ?? []).map((n) => Number(n).toFixed(2)).join(',');
    const cls = /class="([^"]+)"/.exec(attrs)?.[1] ?? '';
    const style = /data-jack-style="([^"]+)"/.exec(attrs)?.[1] ?? '';
    return `${match[1]}|${cls}|${style}|${numbers}`;
  });
}

describe('output jacks across writers', () => {
  it('the iOS and web writers draw the same jack primitives for the same document', () => {
    const project = extractProjectFromSVG(fixture)!;
    const web = jackPrimitives(exportProjectToSVG(project));
    const ios = jackPrimitives(fixture);
    expect(web.length).toBeGreaterThan(10);
    expect(ios).toEqual(web);
  });

  // 1:1 print: both writers must give one SVG user unit per millimetre, and the
  // agreed jack dimensions in those units. A physical printout is still checked
  // against a ruler by hand; this pins everything that can be pinned in code.
  describe.each([
    ['web', () => exportProjectToSVG(extractProjectFromSVG(fixture)!)],
    ['iPad', () => fixture],
  ])('print scale (%s writer)', (_name, svgOf) => {
    const svg = svgOf();
    const number = (value: string | undefined) => Number(value);

    it('is one user unit per millimetre', () => {
      const width = number(/<svg[^>]*\swidth="([\d.]+)mm"/.exec(svg)?.[1]);
      const height = number(/<svg[^>]*\sheight="([\d.]+)mm"/.exec(svg)?.[1]);
      const box = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg)!;
      expect(width).toBeGreaterThan(100);
      expect(number(box[3])).toBeCloseTo(width, 1);
      expect(number(box[4])).toBeCloseTo(height, 1);
    });

    it('draws the agreed jack dimensions', () => {
      const jacks = svg.slice(svg.indexOf('id="control-jacks"'));
      const attr = (tag: string, name: string) => [...jacks.matchAll(new RegExp(`<${tag}\\b[^>]*\\s${name}="(-?[\\d.]+)"`, 'g'))].map((m) => Number(m[1]));
      expect(attr('rect', 'width')[0]).toBeCloseTo(80.5, 2);
      expect(attr('rect', 'height')[0]).toBeCloseTo(31.3, 2);
      expect(attr('rect', 'rx')[0]).toBeCloseTo(15.65, 2);
      const radii = attr('circle', 'r');
      expect(radii).toContain(7.5); // 15 mm washer
      expect(radii).toContain(4.9); // 9.8 mm through-hole
      const screwX = attr('circle', 'cx').filter((x) => Math.abs(x) > 30);
      expect(Math.max(...screwX) - Math.min(...screwX)).toBeCloseTo(71, 2); // screw spacing
      // 13 mm across flats: opposite vertices of the hexagon are 2R = 15.01 apart.
      const nut = /<polygon[^>]*points="([^"]+)"/.exec(jacks)![1].split(' ').map((p) => p.split(',').map(Number));
      const across = Math.hypot(nut[0][0] - nut[3][0], nut[0][1] - nut[3][1]) * (Math.sqrt(3) / 2);
      expect(across).toBeCloseTo(13, 1);
    });
  });
});
