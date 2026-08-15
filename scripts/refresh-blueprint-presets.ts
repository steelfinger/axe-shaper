/**
 * Re-stamps every bundled blueprint's embedded neckPreset/bridgePreset copy
 * from the current NECK_PRESETS/BRIDGE_PRESETS tables, by id - the same
 * refresh a user gets by re-picking the same preset from the UI (see
 * neckPresetFields/bridgePresetFields in src/utils/presets.ts, "the two have
 * to move together").
 *
 * Needed whenever a hardware.ts value changes: schemaVersion 2 blueprints
 * embed their own copy, and "the embedded copy wins" (presets.ts's own doc
 * comment) - resolveNeckPreset/resolveBridgePreset read it before ever
 * consulting the live table. generate-golden-corpus.ts does the same:
 * decodeBlueprint() reads project.neckPreset directly. Editing hardware.ts
 * alone leaves every bundled blueprint's on-disk copy stale, which then
 * leaks into the golden corpus, into what a fresh "open this blueprint" load
 * draws, and into whatever iOS pulls down via Scripts/sync-contract.sh.
 *
 * Usage: npx tsx scripts/refresh-blueprint-presets.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Mirrors decodeBlueprint in generate-golden-corpus.ts - no DOMParser needed. */
function decodeBlueprint(path: string): any {
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
  // exportProjectToSVG itself is DOM-free (only extractProjectFromSVG and
  // downloadSVGFile need DOMParser/document) - safe to load and call here.
  const svgExporter = await load('/src/utils/svgExporter.ts');
  const manifest = await load('/src/constants/blueprintManifest.ts');

  for (const id of manifest.BLUEPRINT_ORDER) {
    const path = join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`);
    const project = decodeBlueprint(path);
    const refreshed = {
      ...project,
      ...presets.neckPresetFields(project.neckPresetId),
      ...presets.bridgePresetFields(project.bridgePresetId),
    };
    const svg = svgExporter.exportProjectToSVG(refreshed);
    writeFileSync(path, svg);
    console.log(`refreshed ${id} (neck: ${project.neckPresetId}, bridge: ${project.bridgePresetId})`);
  }

  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
