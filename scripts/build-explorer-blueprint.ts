/**
 * Builds src/constants/blueprints/gibson_explorer.axe.svg.
 *
 * The body outline and pickguard are read straight out of a 1958 Explorer
 * plan (docs/guitar-blueprint-evidence/explorer-58-plan-trace.json - vector
 * paths converted to app millimetres, not an eyeballed trace), and the pickup,
 * pot and toggle positions come from the same plan. Everything else -
 * neck, bridge, pickup routs - is stamped from the live catalogue.
 *
 * Like p_bass_style this carries the traced contour through verbatim, so
 * rerunning it after a hardware.ts change is safe; rerunning it after someone
 * has hand-edited the blueprint is not, it rewrites the file from scratch.
 *
 * Usage: npx tsx scripts/build-explorer-blueprint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'gibson_explorer';

async function main() {
  const trace = JSON.parse(
    readFileSync(join(ROOT, 'docs', 'guitar-blueprint-evidence', 'explorer-58-plan-trace.json'), 'utf8')
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
    schemaVersion: 4,
    appVersion: '1.0.0',
    instrumentType: 'guitar',
    stringCount: 6,
    metadata: { created: now, modified: now, author: 'Axe Shaper Luthier' },
    settings: {
      name: 'Explorer-Style',
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
      finishStyle: 'natural_wood',
      bodyColor: '#3b82f6',
      secondaryColor: '#f59e0b',
      bodyFillOpacity: 0.2,
      pickguardEnabled: true,
      pickguardColor: '#ffffff',
    },
    activeTemplateId: ID,
    contour: trace.contour,
    edgeProfile: { kind: 'slab', easeMm: 0 },
    bodyThicknessMm: trace.measured.bodyThicknessMm,
    ...neckFields,
    neckJointMechanism: hardware.DEFAULT_NECK_JOINT_MECHANISM[ID] ?? 'glued',
    ...presets.bridgePresetFields('tune_o_matic'),
    pickups,
    pickguards: [
      { id: 'explorer_pickguard', name: 'Pickguard', contour: trace.pickguard, colorHex: '#ffffff' },
    ],
    frontRoutes: [],
    backRoutes: [],
    potentiometers: trace.placements.potentiometers.map((p: any, i: number) => ({
      id: `explorer_pot_${i + 1}`,
      position: { x: p.x, y: p.y },
      bodyDiameterMm: 24,
      knobStyleId: 'generic',
    })),
    switches: [
      {
        id: 'explorer_toggle',
        type: 'gibson_toggle',
        position: { x: trace.placements.toggle.x, y: trace.placements.toggle.y },
        angleDegrees: 90,
      },
    ],
  };

  writeFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${ID}.axe.svg`), svgExporter.exportProjectToSVG(project));
  console.log(
    `wrote ${ID}: ${trace.contour.anchors.length} body anchors, ${trace.pickguard.anchors.length} pickguard anchors, ` +
      `nutToBodyEdgeMm ${neckFields.neckPreset.nutToBodyEdgeMm}, pocket ${neckFields.neckPreset.jointDepthMm}mm deep`
  );
  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
