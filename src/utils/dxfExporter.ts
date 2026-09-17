import type { BodyContour, GuitarProject, Vector2D } from '../types/guitar';
import { splitCubicBezier } from './bezier';
import { resolveNeckPreset, resolvePickupSpec } from './presets';

/** Maximum curve-to-chord deviation; serialization adds at most 0.000001 mm. */
export const DXF_CURVE_TOLERANCE_MM = 0.01;
const MAX_VERTICES = 100_000;
const LAYERS = ['BODY_OUTLINE', 'NECK_POCKET', 'PICKUP_CAVITIES', 'FRONT_ROUTES', 'BACK_ROUTES', 'PICKGUARDS'] as const;
type Layer = typeof LAYERS[number];
type Outline = { layer: Layer; points: Vector2D[] };

function finitePoint(point: Vector2D): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error('A contour contains invalid coordinates. Correct the design before exporting.');
  }
}

// Distance to the finite chord, not its infinite supporting line: collinear
// handles can overshoot the endpoints and must still be subdivided.
function chordDistance(p: Vector2D, a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function flatten(contour: BodyContour, label: string): Vector2D[] {
  if (!contour.closed || contour.anchors.length < 3) {
    throw new Error(`${label} must be a closed outline with at least three anchors. Close or hide it before exporting.`);
  }
  const points = [contour.anchors[0].position];
  function segment(a: Vector2D, b: Vector2D, c: Vector2D, d: Vector2D, depth = 0): void {
    [a, b, c, d].forEach(finitePoint);
    if (points.length >= MAX_VERTICES || depth > 24) {
      throw new Error(`${label} is too complex to export accurately. Simplify its contour and try again.`);
    }
    if (Math.max(chordDistance(b, a, d), chordDistance(c, a, d)) <= DXF_CURVE_TOLERANCE_MM) {
      points.push(d);
      return;
    }
    const halves = splitCubicBezier(a, b, c, d, 0.5);
    const [a0, b0, c0, d0] = halves.segment1;
    const [a1, b1, c1, d1] = halves.segment2;
    segment(a0, b0, c0, d0, depth + 1);
    segment(a1, b1, c1, d1, depth + 1);
  }
  contour.anchors.forEach((anchor, index) => {
    const next = contour.anchors[(index + 1) % contour.anchors.length];
    segment(anchor.position,
      anchor.handleOut ? { x: anchor.position.x + anchor.handleOut.x, y: anchor.position.y + anchor.handleOut.y } : anchor.position,
      next.handleIn ? { x: next.position.x + next.handleIn.x, y: next.position.y + next.handleIn.y } : next.position,
      next.position);
  });
  points.pop(); // DXF's closed flag supplies the last edge.
  return points;
}

function neckPocket(project: GuitarProject): Vector2D[] {
  const { jointWidthMm: width, jointDepthMm: height, jointCornerRadiusMm: radius } = resolveNeckPreset(project);
  if (![width, height, radius].every(Number.isFinite) || width <= 0 || height <= 0 || radius < 0) {
    throw new Error('The neck pocket dimensions are invalid. Choose a valid neck preset before exporting.');
  }
  const r = Math.min(radius, width / 2, height / 2);
  if (r === 0) return [{ x: -width / 2, y: 0 }, { x: width / 2, y: 0 }, { x: width / 2, y: height }, { x: -width / 2, y: height }];
  const steps = Math.max(1, Math.ceil((Math.PI / 2) / (2 * Math.acos(Math.max(-1, 1 - DXF_CURVE_TOLERANCE_MM / r)))));
  if (steps * 4 > MAX_VERTICES) throw new Error('The neck pocket is too large to export accurately.');
  const points: Vector2D[] = [];
  const centers = [[width / 2 - r, r], [width / 2 - r, height - r], [-width / 2 + r, height - r], [-width / 2 + r, r]];
  centers.forEach(([x, y], corner) => {
    for (let step = 0; step <= steps; step++) {
      const angle = (corner - 1 + step / steps) * Math.PI / 2;
      points.push({ x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) });
    }
  });
  return points;
}

/** 2D outlines only. Back routes share the front-view coordinates, not a flipped setup. */
export function exportProjectToDXF(project: GuitarProject): string {
  const outlines: Outline[] = [
    { layer: 'BODY_OUTLINE', points: flatten(project.contour, 'Body') },
    { layer: 'NECK_POCKET', points: neckPocket(project) },
  ];
  for (const pickup of project.pickups) {
    const points = flatten({ anchors: resolvePickupSpec(pickup).anchors, closed: true }, 'Pickup cavity');
    const angle = pickup.angleDegrees * Math.PI / 180;
    outlines.push({ layer: 'PICKUP_CAVITIES', points: points.map(({ x, y }) => ({
      x: pickup.offsetXMm + x * Math.cos(angle) - y * Math.sin(angle),
      y: pickup.offsetYMm + x * Math.sin(angle) + y * Math.cos(angle),
    })) });
  }
  for (const [layer, shapes] of [
    ['FRONT_ROUTES', project.frontRoutes], ['BACK_ROUTES', project.backRoutes], ['PICKGUARDS', project.pickguards],
  ] as const) {
    for (const shape of shapes ?? []) {
      if (shape.visible !== false) outlines.push({ layer, points: flatten(shape.contour, shape.name || layer) });
    }
  }

  const lines: string[] = [];
  const pair = (code: number, value: string | number) => { lines.push(String(code), String(value)); };
  const section = (name: string) => { pair(0, 'SECTION'); pair(2, name); };
  let handle = 0x100;
  const nextHandle = () => (handle++).toString(16).toUpperCase();
  pair(999, 'Axe Shaper 2D outlines; millimeters; no cutting depths or toolpaths.');
  pair(999, 'Origin: neck joint center. +X right, +Y toward neck. Back routes are NOT mirrored.');
  section('HEADER');
  pair(9, '$ACADVER'); pair(1, 'AC1015');
  pair(9, '$INSUNITS'); pair(70, 4);
  pair(9, '$MEASUREMENT'); pair(70, 1);
  pair(9, '$LUNITS'); pair(70, 2);
  pair(9, '$LUPREC'); pair(70, 6);
  pair(0, 'ENDSEC');
  section('TABLES');
  pair(0, 'TABLE'); pair(2, 'LTYPE'); pair(5, '1'); pair(100, 'AcDbSymbolTable'); pair(70, 1);
  pair(0, 'LTYPE'); pair(5, '2'); pair(330, '1'); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbLinetypeTableRecord');
  pair(2, 'CONTINUOUS'); pair(70, 0); pair(3, 'Solid line'); pair(72, 65); pair(73, 0); pair(40, 0);
  pair(0, 'ENDTAB');
  pair(0, 'TABLE'); pair(2, 'LAYER'); pair(5, '3'); pair(100, 'AcDbSymbolTable'); pair(70, LAYERS.length + 1);
  ['0', ...LAYERS].forEach((layer, index) => {
    pair(0, 'LAYER'); pair(5, nextHandle()); pair(330, '3'); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbLayerTableRecord');
    pair(2, layer); pair(70, 0); pair(62, index === 0 ? 7 : index); pair(6, 'CONTINUOUS');
  });
  pair(0, 'ENDTAB');
  pair(0, 'TABLE'); pair(2, 'BLOCK_RECORD'); pair(5, '4'); pair(100, 'AcDbSymbolTable'); pair(70, 2);
  for (const [name, id] of [['*Model_Space', '5'], ['*Paper_Space', '6']]) {
    pair(0, 'BLOCK_RECORD'); pair(5, id); pair(330, '4'); pair(100, 'AcDbSymbolTableRecord'); pair(100, 'AcDbBlockTableRecord'); pair(2, name);
  }
  pair(0, 'ENDTAB'); pair(0, 'ENDSEC');
  section('BLOCKS');
  for (const [name, id] of [['*Model_Space', '5'], ['*Paper_Space', '6']]) {
    pair(0, 'BLOCK'); pair(5, nextHandle()); pair(330, id); pair(100, 'AcDbEntity'); pair(8, '0'); pair(100, 'AcDbBlockBegin');
    pair(2, name); pair(70, 0); pair(10, 0); pair(20, 0); pair(30, 0); pair(3, name); pair(1, '');
    pair(0, 'ENDBLK'); pair(5, nextHandle()); pair(330, id); pair(100, 'AcDbEntity'); pair(8, '0'); pair(100, 'AcDbBlockEnd');
  }
  pair(0, 'ENDSEC');
  section('ENTITIES');
  for (const outline of outlines) {
    // Reflect the app's downward Y into CAD's upward Y; keep full precision
    // until serialization. Remove duplicates introduced by rounding/zero edges.
    const points = outline.points.map((point) => {
      finitePoint(point);
      return { x: Number(point.x.toFixed(6)), y: Number((-point.y).toFixed(6)) };
    }).filter((point, index, all) => {
      const previous = all[(index + all.length - 1) % all.length];
      return point.x !== previous.x || point.y !== previous.y;
    });
    const area = points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0);
    if (points.length < 3 || Math.abs(area) < 0.000001) {
      throw new Error(`${outline.layer} has a collapsed outline. Correct it before exporting.`);
    }
    pair(0, 'LWPOLYLINE'); pair(5, nextHandle()); pair(330, '5'); pair(100, 'AcDbEntity'); pair(8, outline.layer);
    pair(100, 'AcDbPolyline'); pair(90, points.length); pair(70, 1);
    for (const point of points) { pair(10, point.x); pair(20, point.y); }
  }
  pair(0, 'ENDSEC'); pair(0, 'EOF');
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadDXFFile(projectName: string, content: string): void {
  const slug = projectName.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'axe-shaper';
  const url = URL.createObjectURL(new Blob([content], { type: 'application/dxf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}.dxf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL alive while the browser starts consuming the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
