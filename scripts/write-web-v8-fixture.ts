/**
 * Writes tests/fixtures/web-written-v8/output_jacks.axe.svg: a schema 8 file
 * produced by the *web* writer, for the iPad app to decode, re-save and hand
 * back (axe-shaper-ios syncs it; see Scripts/sync-contract.sh there). It is the
 * other half of the cross-writer evidence: the iOS fixtures prove the web reads
 * what iOS writes, this proves the reverse.
 *
 * It carries the cases a round trip can lose: a Strat plate, a direct jack with
 * a non-zero angle (not drawn, but kept verbatim), and an unknown mounting style
 * with an unknown field on its entry.
 *
 *   node scripts/write-web-v8-fixture.ts          write
 *   node scripts/write-web-v8-fixture.ts --check  verify the committed payload is current
 *
 * `--check` compares the decoded payload, not the bytes: the web writer stamps
 * today's date into the printable plan.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'fixtures', 'web-written-v8', 'output_jacks.axe.svg');

function payloadOf(svg: string): unknown {
  const match = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  if (!match) throw new Error('no <project:data>');
  return JSON.parse(Buffer.from(match[1].trim(), 'base64').toString('utf8'));
}

async function main() {
  const check = process.argv.includes('--check');
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const factory = await server.ssrLoadModule('/src/utils/projectFactory.ts');
    const exporter = await server.ssrLoadModule('/src/utils/svgExporter.ts');
    const project = factory.createProject({
      templateId: 's_style',
      now: () => new Date('2026-10-05T12:00:00Z'),
    });
    project.settings.name = 'Web-written output jack fixture';
    project.jacks = [
      { id: 'plate', position: { x: 93.2, y: 317.7 }, mountingStyle: 'strat_plate', angleDegrees: 40 },
      { id: 'direct', position: { x: 30, y: 360 }, mountingStyle: 'direct', angleDegrees: 33 },
      { id: 'odd', position: { x: 60, y: 380 }, mountingStyle: 'side_mounted', angleDegrees: 0, futureField: { keep: 'me' } },
    ];
    const svg: string = exporter.exportProjectToSVG(project);
    if (check) {
      if (!existsSync(OUT)) throw new Error(`missing ${OUT}; run without --check`);
      const committed = JSON.stringify(payloadOf(readFileSync(OUT, 'utf8')));
      if (committed !== JSON.stringify(payloadOf(svg))) {
        console.error('Web-written v8 fixture is stale. Run: node scripts/write-web-v8-fixture.ts');
        process.exit(1);
      }
      console.log('Web-written v8 fixture is current.');
      return;
    }
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, svg);
    console.log(`Wrote ${OUT}`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
