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
  r_bass_style: { file: 'r-style-blueprint.axe.svg', scaleLineMm: 290, bridgeId: 'bass_r_style_plate' },
  thunderbird_bass_style: { file: 'thunderbird-style-blueprint.axe.svg', scaleLineMm: 412 },
  mustang_bass_style: { file: 'mustang-style-blueprint.axe.svg', scaleLineMm: 346 },
  sg_bass_style: { file: 'sg-style-blueprint.axe.svg', scaleLineMm: 340 },
  streamer_bass_style: { file: 'streamer-style-blueprint.axe.svg', scaleLineMm: 315 },
} as const;

/**
 * The master files own placement, count and orientation. The catalogue owns
 * the rout geometry. Keep those responsibilities separate when a master is
 * re-imported so its older placeholder type cannot undo the supported bass
 * pickup vocabulary.
 */
const PICKUP_TYPES_BY_TEMPLATE: Partial<Record<keyof typeof MASTERS, string[]>> = {
  r_bass_style: ['bass_r_toaster', 'bass_r_horseshoe'],
  thunderbird_bass_style: ['bass_mini_humbucker'],
  sg_bass_style: ['bass_mudbucker'],
};

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

    const requested = new Set(process.argv.slice(2));
    const masters = Object.entries(MASTERS).filter(([templateId]) => requested.size === 0 || requested.has(templateId));
    if (requested.size && masters.length !== requested.size) {
      const known = new Set(Object.keys(MASTERS));
      throw new Error(`Unknown template id(s): ${[...requested].filter((id) => !known.has(id)).join(', ')}`);
    }
    for (const [templateId, rule] of masters) {
      const masterPath = join(MASTER_ROOT, rule.file);
      const project = decode(masterPath);
      if (project.activeTemplateId !== templateId) {
        throw new Error(`${rule.file} declares ${project.activeTemplateId}, expected ${templateId}`);
      }
      const bridgePresetId = rule.bridgeId ?? 'bass_vintage_plate';
      project.neckPreset.nutToBodyEdgeMm = project.neckPreset.scaleLengthMm - rule.scaleLineMm;
      project.bridgePresetId = bridgePresetId;
      project.bridgePreset = structuredClone(hardware.BRIDGE_PRESETS[bridgePresetId]);
      const pickupTypes = PICKUP_TYPES_BY_TEMPLATE[templateId as keyof typeof MASTERS];
      project.pickups = project.pickups.map((pickup: any, index: number) => {
        // Preserve the master pickup identity unless this template deliberately
        // substitutes one of the curated bass-specific types. In both cases,
        // regenerate its rout from the catalogue so literal SVG contours are
        // written to every blueprint payload and visible SVG path.
        const type = pickupTypes?.[Math.min(index, pickupTypes.length - 1)] ?? pickup.type;
        const spec = hardware.PICKUP_SPECIFICATIONS[type];
        if (!spec) throw new Error(`${templateId} references unsupported pickup type ${type}`);
        return { ...pickup, type, widthMm: spec.widthMm, heightMm: spec.heightMm, anchors: structuredClone(spec.anchors) };
      });
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
