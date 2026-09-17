import { strict as assert } from 'node:assert';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import DxfParser from 'dxf-parser';
import type { BodyContour, GuitarProject, Vector2D } from '../src/types/guitar.ts';

const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
const parser = new DxfParser();
type Polyline = { type: string; layer: string; shape: boolean; vertices: Vector2D[] };
function read(text: string) {
  const drawing = parser.parseSync(text)!;
  assert.equal(drawing.header.$INSUNITS, 4);
  assert.equal(drawing.header.$ACADVER, 'AC1015');
  const entities = drawing.entities as unknown as Polyline[];
  assert(entities.length >= 2);
  for (const entity of entities) {
    assert.equal(entity.type, 'LWPOLYLINE');
    assert.equal(entity.shape, true);
    assert(entity.vertices.length >= 3);
    for (const [i, point] of entity.vertices.entries()) {
      assert(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.notDeepEqual(point, entity.vertices[(i + 1) % entity.vertices.length]);
    }
  }
  return entities;
}
function contour(points: number[][]): BodyContour {
  return { closed: true, anchors: points.map(([x, y], i) => ({ id: String(i), handleMode: 'corner', position: { x, y } })) };
}
function distanceToSegment(p: Vector2D, a: Vector2D, b: Vector2D) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

try {
  const { exportProjectToDXF, DXF_CURVE_TOLERANCE_MM } = await server.ssrLoadModule('/src/utils/dxfExporter.ts');
  const { createProject } = await server.ssrLoadModule('/src/utils/projectFactory.ts');
  const { REFERENCE_TEMPLATES } = await server.ssrLoadModule('/src/constants/templates.ts');
  const { evaluateCubicBezier } = await server.ssrLoadModule('/src/utils/bezier.ts');
  const { loadProject } = await server.ssrLoadModule('/src/utils/presets.ts');
  const { extractProjectFromSVG } = await server.ssrLoadModule('/src/utils/svgExporter.ts');
  const outputDirectory = process.env.DXF_CHECK_OUTPUT;
  if (outputDirectory) mkdirSync(outputDirectory, { recursive: true });
  for (const templateId of Object.keys(REFERENCE_TEMPLATES)) {
    const project: GuitarProject = createProject({ templateId });
    const before = JSON.stringify(project);
    const dxf = exportProjectToDXF(project);
    const entities = read(dxf);
    assert.equal(JSON.stringify(project), before, 'export must not mutate the saved design');
    assert.equal(entities.filter(e => e.layer === 'PICKUP_CAVITIES').length, project.pickups.length);
    assert.equal(entities.length, 2 + project.pickups.length +
      [...project.frontRoutes, ...project.backRoutes, ...project.pickguards].filter(s => s.visible !== false).length);
    assert.equal(exportProjectToDXF({ ...project, settings: { ...project.settings, unitDisplay: 'inches', canvasOrientation: 'horizontal' } }), dxf);
    if (outputDirectory) writeFileSync(resolve(outputDirectory, `${templateId}.dxf`), dxf);
  }
  // Saved iOS contours also pass through the normal version/migration gate.
  let fixtureCount = 0;
  let rejectedFixtures = 0;
  for (const folder of ['ios-written', 'ios-written-v3']) {
    for (const file of readdirSync(`tests/fixtures/${folder}`).filter(f => f.endsWith('.axe.svg'))) {
      const raw = extractProjectFromSVG(readFileSync(`tests/fixtures/${folder}/${file}`, 'utf8'));
      const loaded = loadProject(raw);
      assert(loaded.ok, file);
      // Synthetic legacy fixtures deliberately have a partial neck preset.
      // Export must reject missing physical dimensions, not invent a pocket.
      if (!Number.isFinite(loaded.project.neckPreset.jointWidthMm)) {
        assert.throws(() => exportProjectToDXF(loaded.project), /neck pocket dimensions/);
        rejectedFixtures++;
        continue;
      }
      read(exportProjectToDXF(loaded.project));
      fixtureCount++;
    }
  }

  const project: GuitarProject = createProject();
  project.contour = contour([[0, 0], [100, 0], [100, 50], [0, 50]]);
  project.neckPreset = { ...project.neckPreset!, jointWidthMm: 60, jointDepthMm: 80, jointCornerRadiusMm: 0 };
  project.frontRoutes = [{ id: 'front', contour: contour([[10, 10], [20, 10], [20, 20], [10, 20]]), depthMm: 15 }];
  project.backRoutes = [{ id: 'back', contour: contour([[30, 10], [40, 10], [40, 20], [30, 20]]) }];
  project.pickguards = [{ id: 'hidden', visible: false, contour: { anchors: [], closed: false } }];
  project.pickups = [{ ...project.pickups[0], widthMm: 10, heightMm: 20, anchors: contour([[-5, -10], [5, -10], [5, 10], [-5, 10]]).anchors, offsetXMm: 30, offsetYMm: 40, angleDegrees: 90 }];
  let entities = read(exportProjectToDXF(project));
  const vertices = (layer: string) => entities.find(e => e.layer === layer)!.vertices.map(({ x, y }) => [x, y]);
  assert.deepEqual(vertices('BODY_OUTLINE'), [[0, 0], [100, 0], [100, -50], [0, -50]]);
  assert.deepEqual(vertices('NECK_POCKET'), [[-30, 0], [30, 0], [30, -80], [-30, -80]]);
  assert.deepEqual(vertices('PICKUP_CAVITIES'), [[40, -35], [40, -45], [20, -45], [20, -35]]);
  assert.deepEqual(vertices('BACK_ROUTES')[0], [30, -10], 'back routes must not be mirrored for a speculative flip setup');
  assert(!entities.some(e => e.layer === 'PICKGUARDS'));
  assert.equal(entities.length, 5, 'no hardware illustrations or guessed drill holes');

  // Dense independent sampling bounds deviation of a strongly curved edge.
  const a = { x: 0, y: 0 }, b = { x: -40, y: -90 }, c = { x: 140, y: -90 }, d = { x: 100, y: 0 };
  project.contour.anchors[0].handleOut = b;
  project.contour.anchors[1].handleIn = { x: 40, y: -90 };
  entities = read(exportProjectToDXF(project));
  const poly = entities.find(e => e.layer === 'BODY_OUTLINE')!.vertices;
  for (let i = 0; i <= 2000; i++) {
    const point = evaluateCubicBezier(a, b, c, d, i / 2000);
    point.y = -point.y;
    const distance = Math.min(...poly.map((p, index) => distanceToSegment(point, p, poly[(index + 1) % poly.length])));
    assert(distance <= DXF_CURVE_TOLERANCE_MM + 0.000001, `curve error ${distance} mm`);
  }
  // Collinear handles extending beyond the chord must not collapse to one line.
  project.contour.anchors[0].handleOut = { x: -100, y: 0 };
  project.contour.anchors[1].handleIn = { x: 100, y: 0 };
  entities = read(exportProjectToDXF(project));
  const xs = entities[0].vertices.map(p => p.x);
  assert(Math.min(...xs) < -20 && Math.max(...xs) > 120);

  assert.throws(() => exportProjectToDXF({ ...project, contour: { ...project.contour, closed: false } }), /closed outline/);
  assert.throws(() => exportProjectToDXF({ ...project, contour: contour([[0, 0], [0, 0], [0, 0]]) }), /collapsed/);
  assert.throws(() => exportProjectToDXF({ ...project, pickups: [{ ...project.pickups[0], angleDegrees: NaN }] }), /invalid coordinates/);
  assert.throws(() => exportProjectToDXF({ ...project, frontRoutes: [{ ...project.frontRoutes[0], contour: { anchors: [], closed: false } }] }), /closed outline/);
  console.log(`DXF: ${Object.keys(REFERENCE_TEMPLATES).length} blueprints, ${fixtureCount} iOS fixtures, ${rejectedFixtures} incomplete fixtures rejected; scale, axes, rotation, visibility, curve tolerance and invalid-outline checks passed.`);
} finally {
  await server.close();
}
