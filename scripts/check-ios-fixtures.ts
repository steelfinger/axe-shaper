/**
 * Guarantee 2 (payload compatibility), the direction the blueprints can't
 * cover: fixture .axe.svg files written by the *iOS* app, decoded here by the
 * web app. The blueprints are this app's half of the guarantee; the iOS suite
 * decodes them there.
 *
 * Reads copies of the files the iOS writer produces, synced from the iOS
 * repo by its Scripts/sync-fixtures-to-web.sh and kept byte-identical to the
 * writer's output by a test on that side. Two directories:
 *
 *   - tests/fixtures/ios-written/ — the frozen schema version 2 set, checked
 *     as *legacy* payloads: readable, and migrating to a semantically
 *     identical Guitar/6 version 3 project.
 *   - tests/fixtures/ios-written-v3/ — the schema version 3 set iOS has
 *     written since its milestone M24. Checked as *current* payloads: a
 *     strict no-op load, with the instrument axis present and inside the
 *     supported matrix. See the "iOS-written version 3 fixtures" section at
 *     the end.
 *
 * Per file this asserts:
 *   - the payload decodes, is at a schemaVersion this build supports, and
 *     agrees with the <project:schemaVersion> element;
 *   - structural sanity a router cares about: unique anchor ids, mirrorIds
 *     that resolve, finite coordinates, positive pickup dimensions;
 *   - loading changes nothing but the version: migrateProject() deep-equals
 *     the payload apart from the schemaVersion stamp and the two fields
 *     version 3 adds, so a fully-embedded file's geometry, hardware and
 *     settings round-trip untouched;
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
 * Where iOS's schema version 3 fixtures land (synced since its milestone
 * M24). If the directory is ever missing the check below reports that rather
 * than passing silently, so "iOS version 3 decoding is covered" cannot
 * become true by omission.
 */
const V3_FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'ios-written-v3');

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
    const instrument = await load('/src/utils/instrument.ts');
    // exportProjectToSVG is DOM-free (TextEncoder + btoa); only
    // extractProjectFromSVG in the same module needs a DOMParser, and this
    // script does its own scanning rather than calling it.
    const exporter = await load('/src/utils/svgExporter.ts');
    const bevelGeometry = await load('/src/utils/bevelIntensity.ts');

    invariant(existsSync(FIXTURE_DIR), `fixture directory missing: ${FIXTURE_DIR} — run the iOS repo's Scripts/sync-fixtures-to-web.sh`);

    // Guitar blueprints only. iOS syncs a fixture per BLUEPRINT_ORDER entry
    // it can actually write, and its own bass catalogue (M24) does not exist
    // yet - the eight bass ids below are real on this side (milestone W6)
    // but have nothing to sync from until iOS's own Step 2 lands. That is
    // reported as a pending gap, the same way the ios-written-v3 section
    // below reports schema v3 itself as pending, not failed - a fixture set
    // missing only bass ids is not this repository's bug to fix.
    const bassBlueprintIds = new Set(
      Object.entries(manifest.BLUEPRINT_MANIFEST)
        .filter(([, entry]: [string, any]) => entry.instrumentType === 'bass')
        .map(([id]) => id)
    );
    const expected = new Set([
      ...manifest.BLUEPRINT_ORDER.filter((id: string) => !bassBlueprintIds.has(id)).map((id: string) => `${id}.axe.svg`),
      ...SYNTHETIC_FIXTURES,
    ]);
    const present = new Set(
      readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.axe.svg'))
    );

    check('fixture set is complete for guitar', () => {
      const missing = [...expected].filter((f) => !present.has(f));
      const extra = [...present].filter((f) => !expected.has(f));
      invariant(
        missing.length === 0 && extra.length === 0,
        `missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}`
      );
    });

    const bassFixtureNames = [...bassBlueprintIds].map((id) => `${id}.axe.svg`);
    const bassFixturesPresent = bassFixtureNames.filter((f) => present.has(f));
    if (bassFixturesPresent.length === 0) {
      console.log(`  pending  no iOS-written bass fixtures yet - sync them into ${FIXTURE_DIR} when iOS M24 Step 2 lands`);
    } else {
      check('bass fixture set is complete', () => {
        const missing = bassFixtureNames.filter((f) => !present.has(f));
        invariant(missing.length === 0, `missing: ${missing.join(', ')}`);
      });
    }

    for (const fileName of [...present].sort()) {
      console.log(fileName);
      const svg = readFileSync(join(FIXTURE_DIR, fileName), 'utf8');

      check('payload decodes at a supported schema version', () => {
        const { metadataSchemaVersion, project } = scan(svg);
        invariant(
          schema.isSupportedSchemaVersion(project.schemaVersion),
          `payload schemaVersion is ${project.schemaVersion}, which this build cannot read ` +
            `(supports ${schema.MIN_SUPPORTED_SCHEMA_VERSION}-${schema.PROJECT_SCHEMA_VERSION})`
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

      check('loading changes nothing but the schema version and what it adds', () => {
        // Two documented exceptions to "loading is a no-op", and nothing else
        // may differ:
        //
        // - Pickups: a placement saved before `anchors` existed gets
        //   backfilled with its type's real catalogue rout on load
        //   (resolvePickupSpec/withEmbeddedPickupSpecs in presets.ts) rather
        //   than round-tripping its stale numbers - exactly what these
        //   iOS-written fixtures still have. Comparing against that same
        //   production helper keeps this a no-op check for every other field.
        // - The version stamp and the instrument axis version 3 introduces.
        //   These fixtures predate it, so they migrate to Guitar/6; that is
        //   the migration itself, asserted here rather than assumed.
        const expected = {
          ...project,
          pickups: presets.withEmbeddedPickupSpecs(project.pickups ?? []),
          schemaVersion: schema.PROJECT_SCHEMA_VERSION,
          ...instrument.resolveInstrument(project),
        };
        const migrated = presets.migrateProject(project);
        deepStrictEqual(migrated, expected);
        if (project.schemaVersion < 3) {
          invariant(project.instrumentType === undefined, 'a pre-version-3 payload should not carry instrumentType');
          deepStrictEqual(migrated.instrumentType, 'guitar');
          deepStrictEqual(migrated.stringCount, 6);
        }
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
        // Saves what the editor would actually be holding - the *migrated*
        // project - rather than the raw legacy payload. Writing a version 2
        // payload straight back out is not something the app does, and
        // comparing that against its migration would only be comparing
        // version stamps.
        const loaded = presets.migrateProject(project);
        const written = scan(exporter.exportProjectToSVG(loaded)).project;
        deepStrictEqual(written, loaded);
      });

      // Called out separately from the whole-payload check above: a
      // deepStrictEqual diff over an entire project is unreadable, and this
      // is the field with something real at stake — a scanned, calibrated
      // reference photo the user cannot casually recreate, carrying its own
      // image bytes.
      if (project.guideImage) {
        check('the iOS guide image survives a save byte-for-byte', () => {
          const written = scan(exporter.exportProjectToSVG(presets.migrateProject(project))).project;
          invariant(written.guideImage, 'the guide image was dropped by the writer');
          deepStrictEqual(written.guideImage, project.guideImage);
        });
      }
    }
    // --- iOS-written version 3 fixtures (M24) ---------------------------
    //
    // The web half of the version 3 contract: iOS writes the instrument axis
    // and its fixtures land here, asserted rather than assumed. A missing
    // directory is still reported as a gap rather than quietly passing, so
    // "iOS version 3 decoding is covered" never becomes true by omission.
    console.log('\ntests/fixtures/ios-written-v3/ (iOS milestone M24)');
    if (!existsSync(V3_FIXTURE_DIR)) {
      console.log(
        `  pending  no iOS-written version ${schema.PROJECT_SCHEMA_VERSION} fixtures yet - ` +
          `sync them into ${V3_FIXTURE_DIR} when iOS M24 lands`
      );
    } else {
      const v3Files = readdirSync(V3_FIXTURE_DIR).filter((f) => f.endsWith('.axe.svg'));
      check('the version 3 fixture directory is not empty', () => {
        invariant(v3Files.length > 0, `${V3_FIXTURE_DIR} exists but holds no .axe.svg files`);
      });
      for (const fileName of v3Files.sort()) {
        const project = scan(readFileSync(join(V3_FIXTURE_DIR, fileName), 'utf8')).project;
        check(`${fileName}: is a version 3 payload carrying its own instrument axis`, () => {
          deepStrictEqual(project.schemaVersion, schema.PROJECT_SCHEMA_VERSION);
          invariant(
            instrument.isInstrumentType(project.instrumentType),
            `instrumentType is ${String(project.instrumentType)}`
          );
          invariant(
            instrument.isSupportedInstrument(project.instrumentType, project.stringCount),
            `${project.stringCount}-string ${project.instrumentType} is outside the supported matrix`
          );
        });
        check(`${fileName}: loading a current file is a no-op`, () => {
          // No migration is due at the current version, so unlike the legacy
          // fixtures above this is the original, strict no-op assertion.
          deepStrictEqual(presets.migrateProject(project), {
            ...project,
            pickups: presets.withEmbeddedPickupSpecs(project.pickups ?? []),
          });
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
