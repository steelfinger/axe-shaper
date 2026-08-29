/**
 * Imports the user-maintained bass master SVGs, then re-emits both those
 * masters and the app's bundled blueprints through the one SVG writer. This
 * keeps visible bridge geometry, encoded project data and catalogue maths in
 * agreement. The master files own all contour, route, pickup and pickguard
 * data; this script changes only the approved scale line / bridge fields.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER_ROOT = '/Users/teroaarnio/Library/CloudStorage/Dropbox/Guitars/axe-shaper/blueprints';

const MASTERS = {
  p_bass_style: { file: 'p-style-blueprint.axe.svg', scaleLineMm: 365 },
  j_bass_style: { file: 'j-style-blueprint.axe.svg', scaleLineMm: 365 },
  mm_bass_style: { file: 'mm-style-blueprint.axe.svg', scaleLineMm: 350 },
  r_bass_style: { file: 'r-style-blueprint.axe.svg', scaleLineMm: 368, bridgeId: 'bass_r_style_plate' },
  thunderbird_bass_style: { file: 'thunderbird-style-blueprint.axe.svg', scaleLineMm: 412 },
  mustang_bass_style: { file: 'mustang-style-blueprint.axe.svg', scaleLineMm: 346 },
  sg_bass_style: { file: 'sg-style-blueprint.axe.svg', scaleLineMm: 340 },
  streamer_bass_style: { file: 'streamer-style-blueprint.axe.svg', scaleLineMm: 315 },
} as const;

function decode(path: string): any {
  const encoded = readFileSync(path, 'utf8').match(/<project:data>([\s\S]*?)<\/project:data>/)?.[1];
  if (!encoded) throw new Error(`No project payload in ${path}`);
  return JSON.parse(Buffer.from(encoded.trim(), 'base64').toString('utf8'));
}

async function main() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const hardware = await server.ssrLoadModule('/src/constants/hardware.ts');
    const exporter = await server.ssrLoadModule('/src/utils/svgExporter.ts');

    for (const [templateId, rule] of Object.entries(MASTERS)) {
      const masterPath = join(MASTER_ROOT, rule.file);
      const project = decode(masterPath);
      if (project.activeTemplateId !== templateId) {
        throw new Error(`${rule.file} declares ${project.activeTemplateId}, expected ${templateId}`);
      }
      const bridgePresetId = rule.bridgeId ?? 'bass_vintage_plate';
      project.neckPreset.nutToBodyEdgeMm = project.neckPreset.scaleLengthMm - rule.scaleLineMm;
      project.bridgePresetId = bridgePresetId;
      project.bridgePreset = structuredClone(hardware.BRIDGE_PRESETS[bridgePresetId]);
      // The second R-style front route is a supplied bridge-plate marker, not
      // a machinable body route. Its geometry now lives in bass_r_style_plate.
      if (templateId === 'r_bass_style') project.frontRoutes = project.frontRoutes.filter((_: unknown, index: number) => index !== 1);

      const svg = exporter.exportProjectToSVG(project);
      writeFileSync(masterPath, svg);
      writeFileSync(join(ROOT, 'src/constants/blueprints', `${templateId}.axe.svg`), svg);
      console.log(`${templateId}: scale line ${rule.scaleLineMm}mm, ${bridgePresetId}`);
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
