import type { GuitarProject } from '../types/guitar';
import { contourBounds } from './bezier';
import { jackExtentRadiusMm } from './jackEditing';
import { neckJointFabricationDisclosure } from './neckJointDisclosure';
import { exportProjectToSVG } from './svgExporter';
import { CONTROL_DRAWING_GEOMETRY } from '../constants/planDrawingStyle';
import { resolveBridgePreset, resolveNeckPreset, resolvePickupSpec } from './presets';
import { bridgeDrawingBoundsPoints, bridgeMountingPointsAreVisible, getBridgeDrawingGeometry } from './bridgeDrawing';
import { getMountingPointOriginYMm, getTheoreticalSaddleYMm } from './scaleMath';
import { generateNeckJointOutline } from './neckJointGeometry';

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

export interface PrintBoundsMm {
  minX: number;
  minY: number;
  widthMm: number;
  heightMm: number;
}

/**
 * What the tiles have to cover, in model mm: the drawn extent of every
 * construction contour, the pocket, the drawn bridge, the saddle line, pickups
 * and controls, including any that sit outside the body. This is
 * `drawingBounds` in the iPad app's `PDFExporter` and must stay the same
 * rectangle, because it is what decides the sheet count.
 *
 * It is deliberately not the saved SVG's page. That page adds padding, an
 * 80mm label margin and a 181mm title band, and tiling it turned a body the
 * iPad prints on 4 sheets into 9, most of them nearly blank.
 */
export function printBoundsMm(project: GuitarProject): PrintBoundsMm | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  const shapes = [...(project.pickguards ?? []), ...(project.frontRoutes ?? []), ...(project.backRoutes ?? [])];
  for (const contour of [project.contour, ...shapes.map((shape) => shape.contour)]) {
    const bounds = contourBounds(contour.anchors, contour.closed);
    if (bounds) add(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  }
  const addCircle = (x: number, y: number, radius: number) => add(x - radius, y - radius, x + radius, y + radius);
  const neck = resolveNeckPreset(project);
  const bridge = resolveBridgePreset(project);
  if (project.neckJointGeometry) {
    for (const point of generateNeckJointOutline(project.neckJointGeometry).points) add(point.x, point.y, point.x, point.y);
  } else {
    add(-neck.jointWidthMm / 2, 0, neck.jointWidthMm / 2, neck.jointDepthMm);
  }
  const bridgeGeometry = getBridgeDrawingGeometry(neck, bridge);
  for (const point of bridgeDrawingBoundsPoints(bridgeGeometry)) add(point.x, point.y, point.x, point.y);
  if (bridgeMountingPointsAreVisible(bridgeGeometry)) {
    const mountingY = getMountingPointOriginYMm(neck, bridge);
    for (const point of bridge.mountingPoints ?? []) addCircle(point.x, mountingY + point.y, 2);
  }
  add(0, getTheoreticalSaddleYMm(neck), 0, getTheoreticalSaddleYMm(neck));
  for (const pickup of project.pickups ?? []) {
    const spec = resolvePickupSpec(pickup);
    addCircle(pickup.offsetXMm, pickup.offsetYMm, Math.hypot(spec.widthMm, spec.heightMm) / 2);
  }
  for (const potentiometer of project.potentiometers ?? []) {
    const radius = Math.max(
      potentiometer.bodyDiameterMm,
      CONTROL_DRAWING_GEOMETRY.potentiometerKnobDiameterMm,
      CONTROL_DRAWING_GEOMETRY.potentiometerShaftHoleDiameterMm
    ) / 2;
    addCircle(potentiometer.position.x, potentiometer.position.y, radius);
  }
  for (const selector of project.switches ?? []) addCircle(selector.position.x, selector.position.y, 18);
  for (const jack of project.jacks ?? []) addCircle(jack.position.x, jack.position.y, jackExtentRadiusMm(jack));
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, widthMm: maxX - minX, heightMm: maxY - minY };
}

const CALIBRATION_BOX_MM = 100;

/**
 * The 100mm check square for sheet 1, in printable-area mm. The saved SVG
 * carries its own in the title band, which the tiles no longer reach, so the
 * print job draws one over the first sheet as the iPad app does.
 */
export function calibrationOverlaySVG(plan: TilingPlan, disclosure: string | null): string {
  if (plan.usableWidthMm < CALIBRATION_BOX_MM || plan.usableHeightMm < CALIBRATION_BOX_MM) return '';
  const w = plan.usableWidthMm;
  const h = plan.usableHeightMm;
  const note = disclosure
    ? `<text x="0" y="${CALIBRATION_BOX_MM + 18}" class="note">${escapeHtml(disclosure)}</text>`
    : '';
  return `<svg class="seams" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm"><rect x="0" y="0" width="${CALIBRATION_BOX_MM}" height="${CALIBRATION_BOX_MM}" class="calibration" /><text x="0" y="${CALIBRATION_BOX_MM + 4}" class="note">This dashed square must measure exactly 100 mm.</text>${note}</svg>`;
}

/** How far past the print bounds the drawing stays visible: room for a stroke, short of the page's labels. */
const BLEED_MM = 3;

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
 * scale, and a 100 mm calibration box rides on the first sheet of the job.
 */
export function printTiledProject(project: GuitarProject, paperKind: PrintPaper): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('Your browser blocked the print window. Allow pop-ups for Axe Shaper and try again.');
    return;
  }

  // Always the model orientation, like the iPad app: the canvas orientation
  // is a view setting, and a body laid on its side needs more sheets.
  const upright: GuitarProject = { ...project, settings: { ...project.settings, canvasOrientation: 'vertical' } };
  const svg = exportProjectToSVG(upright);
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const widthMm = parseMm(parsed.getAttribute('width'));
  const heightMm = parseMm(parsed.getAttribute('height'));
  const viewBox = (parsed.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number);
  const bounds = printBoundsMm(upright);
  if (!widthMm || !heightMm || viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n)) || !bounds) {
    printWindow.close();
    window.alert('The print plan could not determine the drawing size. Save the SVG instead and try again.');
    return;
  }

  // Where the print bounds sit inside the SVG page, which is 1:1 in mm.
  const originXMm = bounds.minX - viewBox[0];
  const originYMm = bounds.minY - viewBox[1];
  const clip = [
    originYMm - BLEED_MM,
    widthMm - originXMm - bounds.widthMm - BLEED_MM,
    heightMm - originYMm - bounds.heightMm - BLEED_MM,
    originXMm - BLEED_MM,
  ].map((mm) => `${Math.max(mm, 0)}mm`).join(' ');

  const paper = PAPER_SIZES[paperKind];
  const plan = tilingFor(bounds.widthMm, bounds.heightMm, paper);
  const disclosure = neckJointFabricationDisclosure(upright);
  const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const tiles = Array.from({ length: plan.rows }, (_, row) =>
    Array.from({ length: plan.columns }, (_, column) => {
      const x = originXMm + column * plan.stepXMm;
      const y = originYMm + row * plan.stepYMm;
      return `<section class="tile">
        <div class="tile-label">${escapeHtml(project.settings.name)} · ${paper.label} · ${column + 1}/${plan.columns}, ${row + 1}/${plan.rows}${plan.columns * plan.rows > 1 ? ` · ${OVERLAP_MM} mm overlap: lay crosshair on crosshair` : ''}</div>
        <div class="trim top"></div><div class="trim right"></div><div class="trim bottom"></div><div class="trim left"></div>
        <div class="window"><img src="${imageUrl}" alt="" style="left:${-x}mm;top:${-y}mm;width:${widthMm}mm;height:${heightMm}mm;clip-path:inset(${clip})" />${seamOverlaySVG(plan, seamEdgesFor(column, row, plan))}${column === 0 && row === 0 ? calibrationOverlaySVG(plan, disclosure) : ''}</div>
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
  .seams .calibration { stroke: rgba(0, 0, 0, .35); stroke-width: .2; stroke-dasharray: 1.4 1; fill: none; }
  .seams .note { font: 2.8px Arial, sans-serif; fill: #000; }
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
