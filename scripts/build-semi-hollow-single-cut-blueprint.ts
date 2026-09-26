/**
 * Builds src/constants/blueprints/semi_hollow_single_cut.axe.svg (ES-225T /
 * ES-295 style).
 *
 * Unlike the Explorer, PRS and ES-335 there is no plan behind this one: the
 * outline, F-holes, pickguard and hardware positions are a pixel trace of a
 * studio photo (docs/guitar-blueprint-evidence/es-225t-photo-trace.json), so
 * they carry the photo's perspective. Treat the body as a first draft to
 * refine by hand. The joint is at the 14th fret, not the 15th the owner named:
 * see the evidence file. This app does not design hollow bodies: the F-holes
 * are two 2 cm front routes on a carved solid body.
 *
 * Carries the traced contour through verbatim, so rerunning after a
 * hardware.ts change is safe and rerunning after a hand edit is not.
 *
 * SUPERSEDED (Sep 2026): the blueprint was hand-refined in the editor after
 * this script produced it - new contour, hand-drawn routes and hardware
 * positions - and the committed file is now the source of truth. Rerunning
 * this rebuilds the raw trace and discards all of that. Kept as the record
 * of how the first draft was made.
 *
 * Usage: npx tsx scripts/build-semi-hollow-single-cut-blueprint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'semi_hollow_single_cut';

async function main() {
  const trace = JSON.parse(
    readFileSync(join(ROOT, 'docs', 'guitar-blueprint-evidence', 'es-225t-photo-trace.json'), 'utf8')
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

  const p = trace.placements.pickup;
  const spec = hardware.PICKUP_SPECIFICATIONS[p.type];
  const pickups = [
    {
      id: p.id,
      type: p.type,
      offsetXMm: p.offsetXMm,
      offsetYMm: p.offsetYMm,
      angleDegrees: p.angleDegrees,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      cornerRadiusMm: spec.cornerRadiusMm,
      anchors: spec.anchors,
    },
  ];

  const now = new Date().toISOString();
  const project = {
    schemaVersion: 5,
    appVersion: '1.0.0',
    instrumentType: 'guitar',
    stringCount: 6,
    metadata: { created: now, modified: now, author: 'Axe Shaper Luthier' },
    settings: {
      name: 'Semi-Hollow Single Cut',
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
      pickguardEnabled: true,
      pickguardColor: '#111111',
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
    pickguards: [{ id: 'es225_pickguard', name: 'Pickguard', contour: trace.pickguard, colorHex: '#111111' }],
    frontRoutes: trace.holes.map((hole: any) => ({
      id: hole.id,
      name: hole.id === 'es225_f_hole_bass' ? 'F-hole (bass)' : 'F-hole (treble)',
      contour: hole.contour,
      depthMm: trace.measured.fHoleDepthMm,
    })),
    backRoutes: [],
    potentiometers: trace.placements.potentiometers.map((q: any, i: number) => ({
      id: `es225_pot_${i + 1}`,
      position: { x: q.x, y: q.y },
      bodyDiameterMm: 24,
      knobStyleId: 'generic',
    })),
    switches: [],
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
