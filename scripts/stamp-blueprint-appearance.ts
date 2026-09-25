/**
 * One-time schema-v6 migration for the bundled blueprint corpus.
 *
 * The old manifest carried body-finish defaults while every blueprint carried
 * geometry. This stamps the manifest's existing answer into each document,
 * adds the instrument axis and the complete persisted instrument appearance,
 * then writes normal Axe SVG output. Future refreshes preserve these values
 * from the document itself.
 *
 * Usage: npx tsx scripts/stamp-blueprint-appearance.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

  try {
    const load = (path: string) => server.ssrLoadModule(path);
    const manifest = await load('/src/constants/blueprintManifest.ts');
    const exporter = await load('/src/utils/svgExporter.ts');
    const instrument = await load('/src/utils/instrument.ts');
    const { legacyInstrumentAppearance } = await load('/src/utils/instrumentAppearance.ts');

    for (const id of manifest.BLUEPRINT_ORDER) {
      const path = join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`);
      const project = decodeBlueprint(path);
      const entry = manifest.BLUEPRINT_MANIFEST[id];
      const stamped = {
        ...project,
        instrumentType: entry.instrumentType,
        stringCount: instrument.defaultStringCount(entry.instrumentType),
        settings: project.settings,
        instrumentAppearance: legacyInstrumentAppearance(id, entry.instrumentType, project.neckJointMechanism),
      };
      writeFileSync(path, exporter.exportProjectToSVG(stamped));
      console.log(`stamped ${id}`);
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
