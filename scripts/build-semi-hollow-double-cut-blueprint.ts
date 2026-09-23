/**
 * Builds src/constants/blueprints/semi_hollow_double_cut.axe.svg (ES-335 style).
 *
 * Outline, F-holes and hardware positions are a pixel trace of a raster ES-335
 * plan (docs/guitar-blueprint-evidence/es-335-plan-trace.json), about 1 mm per
 * pixel, so treat the body as a first draft to refine by hand. This app does
 * not design hollow bodies: the F-holes are two 2 cm front routes on a carved
 * solid body, the inner chambering is not modelled, and the arched top is the
 * carved_cap construction.
 *
 * Carries the traced contour through verbatim, so rerunning after a
 * hardware.ts change is safe and rerunning after a hand edit of the
 * blueprint is not.
 *
 * Usage: npx tsx scripts/build-semi-hollow-double-cut-blueprint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'semi_hollow_double_cut';

async function main() {
  const trace = JSON.parse(
    readFileSync(join(ROOT, 'docs', 'guitar-blueprint-evidence', 'es-335-plan-trace.json'), 'utf8')
  );

  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  const load = (p: string) => server.ssrLoadModule(p);
  const presets = await load('/src/utils/presets.ts');
  const hardware = await load('/src/constants/hardware.ts');
  const svgExporter = await load('/src/utils/svgExporter.ts');

  const neckFields = presets.neckPresetFieldsForNewTemplate('gibson_scale', ID, 'guitar');
  neckFields.neckPreset.nutToBodyEdgeMm = Math.round(neckFields.neckPreset.nutToBodyEdgeMm * 1e4) / 1e4;

  const pickups = trace.placements.pickups.map((p: any) => {
    const spec = hardware.PICKUP_SPECIFICATIONS[p.type];
    return {
      id: p.id,
      type: p.type,
      offsetXMm: p.offsetXMm,
      offsetYMm: p.offsetYMm,
      angleDegrees: 0,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      cornerRadiusMm: spec.cornerRadiusMm,
      anchors: spec.anchors,
    };
  });

  const now = new Date().toISOString();
  const project = {
    schemaVersion: 5,
    appVersion: '1.0.0',
    instrumentType: 'guitar',
    stringCount: 6,
    metadata: { created: now, modified: now, author: 'Axe Shaper Luthier' },
    settings: {
      name: 'Semi-Hollow Double Cut',
      unitDisplay: 'mm',
      canvasOrientation: 'vertical',
      symmetry: { mode: 'none', sourceSide: 'left' },
      showCenterAxis: true,
      showGhostGuide: true,
      showHardwareCavities: true,
      showDimensions: true,
      showGrid: true,
      gridSizeMm: 50,
      snapToGridEnabled: false,
      finishStyle: 'sunburst',
      bodyColor: '#3b82f6',
      secondaryColor: '#f59e0b',
      bodyFillOpacity: 0.2,
      pickguardEnabled: false,
      pickguardColor: '#ffffff',
    },
    activeTemplateId: ID,
    contour: trace.contour,
    edgeProfile: { kind: 'slab', easeMm: 0 },
    bodyThicknessMm: trace.measured.bodyThicknessMm,
    bodyTop: { construction: 'carved_cap' },
    binding: { appliesTo: 'top_and_back' },
    ...neckFields,
    neckJointMechanism: hardware.DEFAULT_NECK_JOINT_MECHANISM[ID] ?? 'glued',
    ...presets.bridgePresetFields('tune_o_matic'),
    pickups,
    pickguards: [],
    frontRoutes: trace.holes.map((hole: any) => ({
      id: hole.id,
      name: hole.id === 'es335_f_hole_bass' ? 'F-hole (bass)' : 'F-hole (treble)',
      contour: hole.contour,
      depthMm: trace.measured.fHoleDepthMm,
    })),
    backRoutes: [],
    potentiometers: trace.placements.potentiometers.map((p: any, i: number) => ({
      id: `es335_pot_${i + 1}`,
      position: { x: p.x, y: p.y },
      bodyDiameterMm: 24,
      knobStyleId: 'generic',
    })),
    switches: [
      {
        id: 'es335_toggle',
        type: 'gibson_toggle',
        position: { x: trace.placements.toggle.x, y: trace.placements.toggle.y },
        angleDegrees: 90,
      },
    ],
  };

  writeFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${ID}.axe.svg`), svgExporter.exportProjectToSVG(project));
  console.log(
    `wrote ${ID}: ${trace.contour.anchors.length} body anchors, ${trace.holes.length} F-holes, ` +
      `nutToBodyEdgeMm ${neckFields.neckPreset.nutToBodyEdgeMm}`
  );
  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
