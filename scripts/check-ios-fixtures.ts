/**
 * Guarantee 2 (payload compatibility), the direction the blueprints can't
 * cover: fixture .axe.svg files written by the *iOS* app, decoded here by the
 * web app. The blueprints are this app's half of the guarantee; the iOS suite
 * decodes them there.
 *
 * Reads tests/fixtures/ios-written/*.axe.svg — copies of the files the iOS
 * writer produces, synced from the iOS repo by its
 * Scripts/sync-fixtures-to-web.sh and kept byte-identical to the writer's
 * output by a test on that side.
 *
 * Per file this asserts:
 *   - the payload decodes, is schemaVersion current, and agrees with the
 *     <project:schemaVersion> element;
 *   - structural sanity a router cares about: unique anchor ids, mirrorIds
 *     that resolve, finite coordinates, positive pickup dimensions;
 *   - loading is a no-op: migrateProject() deep-equals the payload, so a
 *     current, fully-embedded file round-trips untouched;
 *   - the drawn body path equals anchorsToSVGPath() of the decoded payload —
 *     drawn geometry is the one thing plan §3 pins across implementations.
 *
 * Usage:
 *   npm run fixtures:check
 *
 * Modules are loaded through Vite's SSR pipeline rather than imported
 * directly, for the same reason as generate-golden-corpus.ts: the app's
 * sources use extensionless specifiers bare Node cannot resolve. Only
 * DOM-free modules are loaded.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'ios-written');

/** The synthetic fixture the blueprints can't be: live symmetry with mirrorIds. */
const SYNTHETIC_FIXTURES = ['live_symmetry.axe.svg'];

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok    ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${label}: ${(error as Error).message}`);
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Mirrors the iOS SVGPayloadScanner: the two namespaced elements, by string match. */
function scan(svg: string) {
  const version = svg.match(/<project:schemaVersion>(\d+)<\/project:schemaVersion>/);
  const data = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  invariant(data, 'no <project:data> element');
  return {
    metadataSchemaVersion: version ? Number(version[1]) : null,
    project: JSON.parse(Buffer.from(data![1].trim(), 'base64').toString('utf8')),
  };
}

/** The body outline as drawn by the iOS writer. */
function drawnBodyPath(svg: string): string {
  const match = svg.match(/<path class="outline" d="([^"]*)"\s*\/>/);
  invariant(match, 'no <path class="outline"> in the drawing');
  return match![1];
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
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
    const load = (p: string) => server.ssrLoadModule(p);
    const presets = await load('/src/utils/presets.ts');
    const bezier = await load('/src/utils/bezier.ts');
    const scaleMath = await load('/src/utils/scaleMath.ts');
    const manifest = await load('/src/constants/blueprintManifest.ts');
    const schema = await load('/src/constants/schema.ts');

    invariant(existsSync(FIXTURE_DIR), `fixture directory missing: ${FIXTURE_DIR} — run the iOS repo's Scripts/sync-fixtures-to-web.sh`);

    const expected = new Set([
      ...manifest.BLUEPRINT_ORDER.map((id: string) => `${id}.axe.svg`),
      ...SYNTHETIC_FIXTURES,
    ]);
    const present = new Set(
      readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.axe.svg'))
    );

    check('fixture set is complete', () => {
      const missing = [...expected].filter((f) => !present.has(f));
      const extra = [...present].filter((f) => !expected.has(f));
      invariant(
        missing.length === 0 && extra.length === 0,
        `missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}`
      );
    });

    for (const fileName of [...present].sort()) {
      console.log(fileName);
      const svg = readFileSync(join(FIXTURE_DIR, fileName), 'utf8');

      check('payload decodes at the current schema version', () => {
        const { metadataSchemaVersion, project } = scan(svg);
        invariant(
          project.schemaVersion === schema.PROJECT_SCHEMA_VERSION,
          `payload schemaVersion is ${project.schemaVersion}, expected ${schema.PROJECT_SCHEMA_VERSION}`
        );
        invariant(
          metadataSchemaVersion === project.schemaVersion,
          `metadata element says ${metadataSchemaVersion}, payload says ${project.schemaVersion}`
        );
      });

      const { project } = scan(svg);

      check('contour is structurally sound', () => {
        const anchors = project.contour?.anchors ?? [];
        invariant(anchors.length >= 3, `only ${anchors.length} anchors`);
        const ids = new Set(anchors.map((a: any) => a.id));
        invariant(ids.size === anchors.length, 'duplicate anchor ids');
        for (const a of anchors) {
          invariant(finite(a.position?.x) && finite(a.position?.y), `anchor ${a.id} has a non-finite position`);
          for (const handle of ['handleIn', 'handleOut'] as const) {
            const h = a[handle];
            if (h) invariant(finite(h.x) && finite(h.y), `anchor ${a.id} has a non-finite ${handle}`);
          }
          if (a.mirrorId) invariant(ids.has(a.mirrorId), `anchor ${a.id} mirrors missing ${a.mirrorId}`);
        }
      });

      check('embedded hardware resolves and places the bridge', () => {
        const neck = presets.resolveNeckPreset(project);
        const bridge = presets.resolveBridgePreset(project);
        invariant(neck === project.neckPreset, 'neck resolved to a table entry instead of the embedded copy');
        invariant(bridge === project.bridgePreset, 'bridge resolved to a table entry instead of the embedded copy');
        const theoretical = scaleMath.getTheoreticalSaddleYMm(neck);
        const saddle = scaleMath.getSaddleYMm(neck, bridge);
        const plateTop = scaleMath.getBridgePlateTopYMm(neck, bridge);
        invariant(finite(theoretical) && theoretical > 0, `theoretical saddle Y is ${theoretical}`);
        invariant(finite(saddle), `saddle Y is ${saddle}`);
        invariant(finite(plateTop), `bridge plate top Y is ${plateTop}`);
      });

      check('every pickup rout resolves from the placement itself', () => {
        for (const p of project.pickups ?? []) {
          const spec = presets.resolvePickupSpec(p);
          invariant(finite(p.offsetXMm) && finite(p.offsetYMm), `pickup ${p.id} has a non-finite centre`);
          invariant(spec.widthMm > 0 && spec.heightMm > 0, `pickup ${p.id} routs a non-positive hole`);
          invariant(spec.widthMm === p.widthMm && spec.heightMm === p.heightMm, `pickup ${p.id} fell back to the type table`);
        }
      });

      check('loading is a no-op for a current file', () => {
        deepStrictEqual(presets.migrateProject(project), project);
      });

      check('drawn body path matches the decoded payload', () => {
        const expectedPath = bezier.anchorsToSVGPath(project.contour.anchors, project.contour.closed ?? true);
        deepStrictEqual(drawnBodyPath(svg), expectedPath);
      });
    }
  } finally {
    await server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll iOS-written fixtures decode cleanly.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
