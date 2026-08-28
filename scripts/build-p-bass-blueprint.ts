/**
 * Builds src/constants/blueprints/p_bass_style.axe.svg.
 *
 * p_bass_style has graduated out of scripts/generate-bass-blueprint-drafts.ts:
 * its body outline, pickguard and control-cavity front route are traced from
 * photos of a real Precision (docs/bass-blueprint-evidence/
 * p_bass_style-traced-source.axe.svg, supplied by the user), not an affine-
 * scaled donor shape. Re-running the draft generator would discard that trace,
 * so p_bass_style is no longer in its DRAFTS list.
 *
 * This script is the reproducible seam instead: it takes the traced contour /
 * pickguard / front routes verbatim and re-stamps the hardware from the live
 * catalogue - the neck via FINGERBOARD_OVERHANG_MM (nutToBodyEdgeMm 495.6, so
 * the saddle line lands at 368mm), the bass_precision_plate bridge, and the
 * one traced bass_split_coil cavity. Run it after any hardware.ts change that
 * touches those; the contour is never regenerated, only carried through.
 *
 * Usage: npx tsx scripts/build-p-bass-blueprint.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function decode(path: string): any {
  const svg = readFileSync(path, 'utf8');
  const match = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  if (!match) throw new Error(`no <project:data> in ${path}`);
  return JSON.parse(Buffer.from(match[1].trim(), 'base64').toString('utf8'));
}

async function main() {
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

  const source = decode(join(ROOT, 'docs', 'bass-blueprint-evidence', 'p_bass_style-traced-source.axe.svg'));

  const neckFields = presets.neckPresetFieldsForNewTemplate('bass_long_34', 'p_bass_style', 'bass');
  neckFields.neckPreset.nutToBodyEdgeMm =
    Math.round(neckFields.neckPreset.nutToBodyEdgeMm * 1e4) / 1e4;

  const splitCoil = hardware.PICKUP_SPECIFICATIONS.bass_split_coil;
  // Keep the traced pickup's own centre (positioned against the traced body and
  // pickguard); replace only its shape/size with the current catalogue rout.
  const sourcePickup = source.pickups?.[0];
  const pickups = [
    {
      id: 'p_bass_style_pickup_0',
      type: 'bass_split_coil',
      offsetXMm: 0,
      offsetYMm: sourcePickup ? sourcePickup.offsetYMm : 220,
      angleDegrees: 0,
      widthMm: splitCoil.widthMm,
      heightMm: splitCoil.heightMm,
      anchors: splitCoil.anchors,
    },
  ];

  const now = new Date().toISOString();
  const project = {
    schemaVersion: 3,
    appVersion: '1.0.0',
    instrumentType: 'bass',
    stringCount: 4,
    metadata: { created: now, modified: now, author: 'Axe Shaper Luthier' },
    settings: {
      name: 'P-Style Bass',
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
      bodyFillOpacity: 0.15,
      pickguardEnabled: true,
      pickguardColor: '#ffffff',
    },
    activeTemplateId: 'p_bass_style',
    contour: source.contour,
    ...neckFields,
    neckJointMechanism: hardware.DEFAULT_NECK_JOINT_MECHANISM.p_bass_style ?? 'bolt_on',
    ...presets.bridgePresetFields('bass_precision_plate'),
    pickups,
    pickguards: source.pickguards ?? [],
    frontRoutes: source.frontRoutes ?? [],
    backRoutes: [],
  };

  const svg = svgExporter.exportProjectToSVG(project);
  writeFileSync(join(ROOT, 'src', 'constants', 'blueprints', 'p_bass_style.axe.svg'), svg);
  console.log(
    `wrote p_bass_style (traced body ${source.contour.anchors.length} anchors, ` +
      `${(source.pickguards ?? []).length} pickguard, ${(source.frontRoutes ?? []).length} front route, ` +
      `saddle line ${(863.6 - neckFields.neckPreset.nutToBodyEdgeMm).toFixed(1)}mm)`
  );

  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
