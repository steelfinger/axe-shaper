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
 *   - the drawn body path equals anchorsToSVGPath() of the decoded payload;
 *   - every visible pickguard/front/back route has the same path as its
 *     payload contour, and the printable route palette stays aligned;
 *   - the Beveled/German-Carve inset path is byte-equal to the iOS writer's
 *     path, pinning the flattening, intensity spline, and polygon offset;
 *   - saving is lossless: running this app's own writer over the decoded
 *     payload and re-reading it returns the same object, including keys this
 *     app has no model for (guideImage, which the iOS app persists and this
 *     one does not). Loading was never the risk; a save that rebuilds the
 *     project instead of spreading it is.
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

/**
 * The synthetic fixtures the blueprints can't be: live symmetry with
 * mirrorIds, a `guideImage` — a payload object this app has no model for at
 * all (its own guide image is session-only and never saved) — and
 * `canvasOrientation: horizontal`, which no bundled blueprint sets.
 */
const SYNTHETIC_FIXTURES = ['live_symmetry.axe.svg', 'guide_image.axe.svg', 'horizontal_orientation.axe.svg'];

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

function drawnBevelInsetPath(svg: string): string | null {
  return svg.match(/<path class="edge-inset" d="([^"]*)"\s*\/>/)?.[1] ?? null;
}

function drawnLayerPaths(svg: string, className: string): string[] {
  return [...svg.matchAll(new RegExp(`<path class="${className}"(?: style="[^"]*")? d="([^"]*)"\\s*/>`, 'g'))]
    .map((match) => match[1]);
}

function rootFrame(svg: string) {
  const tag = svg.match(/<svg\b([\s\S]*?)>/)?.[1] ?? '';
  const attribute = (name: string) => tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] ?? null;
  return {
    width: attribute('width'),
    height: attribute('height'),
    viewBox: attribute('viewBox'),
  };
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
    // exportProjectToSVG is DOM-free (TextEncoder + btoa); only
    // extractProjectFromSVG in the same module needs a DOMParser, and this
    // script does its own scanning rather than calling it.
    const exporter = await load('/src/utils/svgExporter.ts');
    const bevelGeometry = await load('/src/utils/bevelIntensity.ts');

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
          // Current-format placements (carrying their own anchors) must
          // resolve from themselves - "embedded copy wins", same as
          // neck/bridge presets. A placement saved before anchors existed is
          // the one documented exception: resolvePickupSpec ignores its
          // stale widthMm/heightMm entirely and returns the type's real
          // catalogue rout instead (presets.ts, tests/golden/README.md), so
          // it's expected to disagree with the placement's own numbers here -
          // the iOS-written fixtures predate the anchors field.
          if (p.anchors && p.anchors.length > 0) {
            invariant(
              spec.widthMm === p.widthMm && spec.heightMm === p.heightMm,
              `pickup ${p.id} fell back to the type table despite carrying its own anchors`
            );
          }
        }
      });

      check('loading is a no-op for a current file', () => {
        // Pickups carry the one documented exception to "no-op": a placement
        // saved before anchors existed gets backfilled with its type's real
        // catalogue rout on load (resolvePickupSpec/withEmbeddedPickupSpecs
        // in presets.ts) rather than round-tripping its stale numbers -
        // exactly what these iOS-written fixtures still have. Comparing
        // against that same production helper (rather than the raw payload)
        // keeps this a no-op check for every other field while still
        // catching any pickup drift migrateProject doesn't account for.
        const expected = { ...project, pickups: presets.withEmbeddedPickupSpecs(project.pickups ?? []) };
        deepStrictEqual(presets.migrateProject(project), expected);
      });

      check('drawn body path matches the decoded payload', () => {
        const expectedPath = bezier.anchorsToSVGPath(project.contour.anchors, project.contour.closed ?? true);
        deepStrictEqual(drawnBodyPath(svg), expectedPath);
      });

      check('drawn construction layers match the decoded payload', () => {
        const expectedPaths = (shapes: any[]) => (shapes ?? [])
          .filter((shape) => shape.visible !== false)
          .map((shape) => bezier.anchorsToSVGPath(shape.contour.anchors, shape.contour.closed ?? true));
        deepStrictEqual(drawnLayerPaths(svg, 'pickguard'), expectedPaths(project.pickguards));
        deepStrictEqual(drawnLayerPaths(svg, 'front-route'), expectedPaths(project.frontRoutes));
        deepStrictEqual(drawnLayerPaths(svg, 'back-route'), expectedPaths(project.backRoutes));
        invariant(svg.includes('.front-route{fill:#ccfbf1;stroke:#0f766e;stroke-width:0.30}'), 'front-route print style drifted');
        invariant(svg.includes('.back-route{fill:#f3e8ff;stroke:#7e22ce;stroke-width:0.30;stroke-dasharray:3.00 2.00}'), 'back-route print style drifted');
        invariant(svg.includes('.neck-pocket{fill:#e5e7eb;stroke:#374151;stroke-width:0.40}'), 'neck-pocket print style drifted');
      });

      check('print framing, annotations and hardware layering match the web exporter', () => {
        const webSVG = exporter.exportProjectToSVG(project);
        // Current production documents embed both hardware presets. A few
        // deliberately synthetic compatibility fixtures omit them; the web
        // writer fills catalogue defaults while iOS correctly refuses to
        // guess manufacturing geometry, so their page frames intentionally
        // differ and are outside this visual parity assertion.
        const hasProductionHardware = !SYNTHETIC_FIXTURES.includes(fileName)
          && project.neckPreset
          && project.bridgePreset;
        if (hasProductionHardware) {
          deepStrictEqual(rootFrame(svg), rootFrame(webSVG));
        }
        const markers = ['1:1 Scale Print Template', 'CALIBRATION BOX'];
        if (hasProductionHardware) markers.push('Y=0 (Joint Line)', 'Scale Line (');
        for (const marker of markers) {
          invariant(svg.includes(marker), `iOS SVG is missing ${marker}`);
          invariant(webSVG.includes(marker), `web SVG is missing ${marker}`);
        }

        const assertLayering = (drawing: string, frontMarker: string, pickupMarker: string, bridgeMarker: string) => {
          const frontIndex = drawing.lastIndexOf(frontMarker);
          const pickupIndex = drawing.indexOf(pickupMarker);
          const bridgeIndex = drawing.indexOf(bridgeMarker);
          if ((project.frontRoutes ?? []).some((route: any) => route.visible !== false) && (project.pickups ?? []).length > 0) {
            invariant(frontIndex >= 0 && pickupIndex > frontIndex, 'pickup routs are hidden below a filled front route');
          }
          if ((project.pickups ?? []).length > 0) {
            invariant(bridgeIndex > pickupIndex, 'bridge hardware is not the top printable hardware layer');
          }
        };
        assertLayering(svg, 'class="front-route"', 'class="pickup-rout"', '<g id="bridge">');
        assertLayering(webSVG, 'class="front-route"', 'class="pickup-rout"', '<g id="bridge-hardware">');
      });

      check('bevel inset calculation and web export match the iOS drawing', () => {
        const points = bevelGeometry.bevelInsetLoop(project);
        const expectedPath = points ? bevelGeometry.closedPolylineToSVGPath(points) : null;
        deepStrictEqual(drawnBevelInsetPath(svg), expectedPath);
        const webSVG = exporter.exportProjectToSVG(project);
        const webPath = webSVG.match(/<path d="([^"]*)" class="edge-inset"\s*\/>/)?.[1] ?? null;
        deepStrictEqual(webPath, expectedPath);
      });

      // Loading is not where an iOS-only field gets lost — *saving* is. This
      // app writes whatever object it is holding, so a field it has no model
      // for survives only as long as every update path spreads the parsed
      // object rather than rebuilding it. That is currently true, and it is
      // true by habit rather than by design, which is exactly the kind of
      // thing that stops being true in a refactor nobody connects to the
      // iPad. Running the real writer is what turns it into a checked fact.
      check('a save preserves the whole payload, including fields this app has no model for', () => {
        const written = scan(exporter.exportProjectToSVG(project)).project;
        deepStrictEqual(written, presets.migrateProject(project));
      });

      // Called out separately from the whole-payload check above: a
      // deepStrictEqual diff over an entire project is unreadable, and this
      // is the field with something real at stake — a scanned, calibrated
      // reference photo the user cannot casually recreate, carrying its own
      // image bytes.
      if (project.guideImage) {
        check('the iOS guide image survives a save byte-for-byte', () => {
          const written = scan(exporter.exportProjectToSVG(project)).project;
          invariant(written.guideImage, 'the guide image was dropped by the writer');
          deepStrictEqual(written.guideImage, project.guideImage);
        });
      }
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
