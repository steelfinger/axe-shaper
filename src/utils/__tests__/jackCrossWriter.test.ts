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
});
