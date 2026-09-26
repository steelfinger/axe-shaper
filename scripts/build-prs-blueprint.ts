/**
 * Builds src/constants/blueprints/prs_style.axe.svg.
 *
 * The body outline and the pickup, pot, toggle and stud positions come from a
 * PRS Custom 22 plan (docs/guitar-blueprint-evidence/prs-custom-24-plan-trace.json,
 * read out of the plan's vector paths). The Custom 24 has the same body. The
 * neck, bridge and pickup routs are stamped from the live catalogue, and the
 * arched top is the carved_cap construction.
 *
 * Like the Explorer this carries the traced contour through verbatim, so
 * rerunning it after a hardware.ts change is safe and rerunning it after a
 * hand edit of the blueprint is not.
 *
 * SUPERSEDED (Sep 2026): the blueprint was hand-refined in the editor after
 * this script produced it - new contour, hand-drawn routes and hardware
 * positions - and the committed file is now the source of truth. Rerunning
 * this rebuilds the raw trace and discards all of that. Kept as the record
 * of how the first draft was made.
 *
 * Usage: npx tsx scripts/build-prs-blueprint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = 'prs_style';

async function main() {
  const trace = JSON.parse(
    readFileSync(join(ROOT, 'docs', 'guitar-blueprint-evidence', 'prs-custom-24-plan-trace.json'), 'utf8')
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

  const neckFields = presets.neckPresetFieldsForNewTemplate('prs_scale', ID, 'guitar');
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
      name: 'PRS-Style',
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
    ...neckFields,
    neckJointMechanism: hardware.DEFAULT_NECK_JOINT_MECHANISM[ID] ?? 'glued',
    ...presets.bridgePresetFields('prs_stoptail'),
    pickups,
    pickguards: [],
    frontRoutes: [],
    backRoutes: [],
    potentiometers: trace.placements.potentiometers.map((p: any, i: number) => ({
      id: `prs_pot_${i + 1}`,
      position: { x: p.x, y: p.y },
      bodyDiameterMm: 24,
      knobStyleId: 'generic',
    })),
    switches: [
      {
        id: 'prs_toggle',
        type: 'gibson_toggle',
        position: { x: trace.placements.toggle.x, y: trace.placements.toggle.y },
        angleDegrees: 90,
      },
    ],
  };

  writeFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${ID}.axe.svg`), svgExporter.exportProjectToSVG(project));
  console.log(
    `wrote ${ID}: ${trace.contour.anchors.length} body anchors, nutToBodyEdgeMm ${neckFields.neckPreset.nutToBodyEdgeMm}, ` +
      `pocket ${neckFields.neckPreset.jointWidthMm} x ${neckFields.neckPreset.jointDepthMm}mm`
  );
  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
