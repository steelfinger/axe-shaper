import type { GuitarProject } from '../types/guitar';
import { exportProjectToSVG } from './svgExporter';

export type PrintPaper = 'a4' | 'letter';

interface PaperSize {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<PrintPaper, PaperSize> = {
  a4: { label: 'A4', widthMm: 210, heightMm: 297 },
  letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
};

const MARGIN_MM = 10;
const OVERLAP_MM = 10;

interface TilingPlan {
  columns: number;
  rows: number;
  usableWidthMm: number;
  usableHeightMm: number;
  stepXMm: number;
  stepYMm: number;
}

export function tilingFor(widthMm: number, heightMm: number, paper: PaperSize): TilingPlan {
  const usableWidthMm = paper.widthMm - MARGIN_MM * 2;
  const usableHeightMm = paper.heightMm - MARGIN_MM * 2;
  const stepXMm = usableWidthMm - OVERLAP_MM;
  const stepYMm = usableHeightMm - OVERLAP_MM;
  return {
    columns: Math.max(Math.ceil((widthMm - OVERLAP_MM) / stepXMm), 1),
    rows: Math.max(Math.ceil((heightMm - OVERLAP_MM) / stepYMm), 1),
    usableWidthMm,
    usableHeightMm,
    stepXMm,
    stepYMm,
  };
}

/** Which edges of a tile have a neighbouring sheet. */
export interface SeamEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export function seamEdgesFor(column: number, row: number, plan: TilingPlan): SeamEdges {
  return {
    left: column > 0,
    right: column < plan.columns - 1,
    top: row > 0,
    bottom: row < plan.rows - 1,
  };
}

/**
 * Dashed guides, in mm from the printable area's origin, on every edge that
 * has a neighbour. Tiles advance by `usable - overlap`, so the neighbour's
 * printed area ends one overlap inside ours: that is where the line goes.
 * On the printable-area edge it would mark a coordinate the neighbouring
 * sheet has nothing at, and the taped-up template would be out by the
 * overlap at every seam.
 */
export function flapGuideOffsetsMm(
  plan: TilingPlan,
  edges: SeamEdges
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  if (edges.left) vertical.push(OVERLAP_MM);
  if (edges.right) vertical.push(plan.usableWidthMm - OVERLAP_MM);
  if (edges.top) horizontal.push(OVERLAP_MM);
  if (edges.bottom) horizontal.push(plan.usableHeightMm - OVERLAP_MM);
  return { vertical, horizontal };
}

/**
 * Registration crosshairs, in mm from the printable area's origin.
 *
 * A crosshair only helps if the neighbouring sheet prints one at the same
 * drawing coordinate, so overlapping the sheets puts mark on mark. The strip
 * both sheets print is the overlap band along each seam; the marks sit on
 * its midline, `overlap / 2` in from the edge, at both ends and the middle of
 * the seam. Corner marks on the printable-area edge would land on the
 * neighbour's dashed guide instead, `OVERLAP_MM` from its own crosshair. The
 * iPad app had exactly that bug; keep the two in step.
 */
export function registrationMarkOffsetsMm(
  plan: TilingPlan,
  edges: SeamEdges
): Array<{ x: number; y: number }> {
  const half = OVERLAP_MM / 2;
  const w = plan.usableWidthMm;
  const h = plan.usableHeightMm;
  const alongVertical = [half, h / 2, h - half];
  const alongHorizontal = [half, w / 2, w - half];
  const marks: Array<{ x: number; y: number }> = [];
  const add = (x: number, y: number) => {
    if (!marks.some((m) => Math.abs(m.x - x) < 1e-9 && Math.abs(m.y - y) < 1e-9)) marks.push({ x, y });
  };
  if (edges.left) alongVertical.forEach((y) => add(half, y));
  if (edges.right) alongVertical.forEach((y) => add(w - half, y));
  if (edges.top) alongHorizontal.forEach((x) => add(x, half));
  if (edges.bottom) alongHorizontal.forEach((x) => add(x, h - half));
  return marks;
}

const MARK_ARM_MM = 6;

/** The seam guides and crosshairs for one tile, as an SVG in printable-area mm. */
export function seamOverlaySVG(plan: TilingPlan, edges: SeamEdges): string {
  const { vertical, horizontal } = flapGuideOffsetsMm(plan, edges);
  const marks = registrationMarkOffsetsMm(plan, edges);
  if (vertical.length === 0 && horizontal.length === 0 && marks.length === 0) return '';
  const w = plan.usableWidthMm;
  const h = plan.usableHeightMm;
  const arm = MARK_ARM_MM / 2;
  const guides = [
    ...vertical.map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="flap" />`),
    ...horizontal.map((y) => `<line x1="0" y1="${y}" x2="${w}" y2="${y}" class="flap" />`),
  ].join('');
  const crosses = marks
    .map(({ x, y }) => `<path d="M ${x - arm} ${y} H ${x + arm} M ${x} ${y - arm} V ${y + arm}" class="mark" />`)
    .join('');
  return `<svg class="seams" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm">${guides}${crosses}</svg>`;
}

export function parseMm(value: string | null): number | null {
  const match = value?.trim().match(/^([0-9]+(?:\.[0-9]+)?)mm$/i);
  return match ? Number(match[1]) : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Opens the browser's native print dialog. Selecting "Save as PDF" creates a
 * tiled PDF; selecting a printer routes through the platform's print service
 * (including AirPrint on supporting devices). The SVG remains at 1:1 mm
 * scale, and the existing 100 mm calibration box travels with the same job.
 */
export function printTiledProject(project: GuitarProject, paperKind: PrintPaper): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('Your browser blocked the print window. Allow pop-ups for Axe Shaper and try again.');
    return;
  }

  const svg = exportProjectToSVG(project);
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const widthMm = parseMm(parsed.getAttribute('width'));
  const heightMm = parseMm(parsed.getAttribute('height'));
  if (!widthMm || !heightMm) {
    printWindow.close();
    window.alert('The print plan could not determine the drawing size. Save the SVG instead and try again.');
    return;
  }

  const paper = PAPER_SIZES[paperKind];
  const plan = tilingFor(widthMm, heightMm, paper);
  const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const tiles = Array.from({ length: plan.rows }, (_, row) =>
    Array.from({ length: plan.columns }, (_, column) => {
      const x = column * plan.stepXMm;
      const y = row * plan.stepYMm;
      return `<section class="tile">
        <div class="tile-label">${escapeHtml(project.settings.name)} · ${paper.label} · ${column + 1}/${plan.columns}, ${row + 1}/${plan.rows}${plan.columns * plan.rows > 1 ? ` · ${OVERLAP_MM} mm overlap: lay crosshair on crosshair` : ''}</div>
        <div class="trim top"></div><div class="trim right"></div><div class="trim bottom"></div><div class="trim left"></div>
        <div class="window"><img src="${imageUrl}" alt="" style="left:-${x}mm;top:-${y}mm;width:${widthMm}mm;height:${heightMm}mm" />${seamOverlaySVG(plan, seamEdgesFor(column, row, plan))}</div>
      </section>`;
    }).join('')
  ).join('');

  printWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(project.settings.name)} - tiled print</title>
<style>
  @page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .tile { width: ${paper.widthMm}mm; height: ${paper.heightMm}mm; position: relative; overflow: hidden; break-after: page; page-break-after: always; background: #fff; }
  .tile:last-child { break-after: auto; page-break-after: auto; }
  .window { position: absolute; left: ${MARGIN_MM}mm; top: ${MARGIN_MM}mm; width: ${plan.usableWidthMm}mm; height: ${plan.usableHeightMm}mm; overflow: hidden; }
  .window img { position: absolute; display: block; max-width: none; }
  .seams { position: absolute; left: 0; top: 0; overflow: visible; }
  .seams .flap { stroke: #4b5563; stroke-width: .2; stroke-dasharray: 2 1.2; fill: none; }
  .seams .mark { stroke: #000; stroke-width: .2; fill: none; }
  .tile-label { position: absolute; left: ${MARGIN_MM}mm; top: 3mm; font: 3mm/1.2 Arial, sans-serif; color: #0f1117; }
  .trim { position: absolute; background: #0f1117; }
  .trim.top, .trim.bottom { left: ${MARGIN_MM}mm; width: ${plan.usableWidthMm}mm; height: .2mm; }
  .trim.left, .trim.right { top: ${MARGIN_MM}mm; width: .2mm; height: ${plan.usableHeightMm}mm; }
  .trim.top { top: ${MARGIN_MM}mm; } .trim.bottom { top: ${MARGIN_MM + plan.usableHeightMm}mm; }
  .trim.left { left: ${MARGIN_MM}mm; } .trim.right { left: ${MARGIN_MM + plan.usableWidthMm}mm; }
</style></head><body>${tiles}
<script>
  const image = document.querySelector('img');
  let printed = false;
  const finish = () => { if (printed) return; printed = true; window.focus(); window.print(); };
  image?.addEventListener('load', finish, { once: true });
  image?.addEventListener('error', finish, { once: true });
  if (image?.complete) finish();
  window.addEventListener('afterprint', () => URL.revokeObjectURL(${JSON.stringify(imageUrl)}), { once: true });
</script></body></html>`);
  printWindow.document.close();
}
