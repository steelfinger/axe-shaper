/**
 * Generates tests/golden/geometry-corpus.json - the reference output of this
 * app's geometry code, for a second implementation to assert against.
 *
 * Code is not shared between the web app and any native port; the .axe.svg
 * format and this corpus are the contract instead. If a Swift or Kotlin port
 * reproduces every number in here, its curves, its bridge placement and its
 * symmetry behave identically to the web app - and if it stops reproducing
 * them, the diff says exactly which function drifted.
 *
 * It doubles as a regression test for the web app: `npm run corpus:check`
 * fails if the committed corpus no longer matches what the code produces, so
 * an accidental change to curve evaluation or scale math cannot land quietly.
 *
 * Usage:
 *   npm run corpus          regenerate and write
 *   npm run corpus:check    verify the committed file is current (CI)
 *
 * Modules are loaded through Vite's SSR pipeline rather than imported
 * directly: the app's sources use extensionless specifiers that bare Node
 * cannot resolve. Only DOM-free modules are loaded - blueprint files are
 * decoded here (see decodeBlueprint) instead of via svgExporter, which needs
 * DOMParser.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'tests', 'golden', 'geometry-corpus.json');

/** Samples per Bezier segment. t = i/SAMPLES_PER_SEGMENT, so both endpoints land exactly. */
const SAMPLES_PER_SEGMENT = 128;

/** Decimal places retained in the corpus. 6dp of a millimetre is a nanometre. */
const DECIMALS = 6;

/**
 * Comparison tolerance a port should use. Well above float noise from a
 * different order of operations, far below anything that matters in wood.
 */
const TOLERANCE_MM = 1e-6;

/** Deterministic edit applied in the live-symmetry case, in mm. */
const SYMMETRY_DRAG_MM = { x: 7.5, y: -3.25 };

type Vec = { x: number; y: number };

function round(n: number): number {
  if (!Number.isFinite(n)) throw new Error(`non-finite value in corpus: ${n}`);
  const v = Number(n.toFixed(DECIMALS));
  return v === 0 ? 0 : v; // collapse -0, which JSON preserves and comparisons trip over
}

const vec = (v: Vec): [number, number] => [round(v.x), round(v.y)];

/**
 * Pull the embedded project payload out of a .axe.svg. Mirrors
 * extractProjectFromSVG, but by string match rather than DOMParser, which
 * Node does not have. Safe here because these are files this app wrote.
 */
function decodeBlueprint(path: string): any {
  const svg = readFileSync(path, 'utf8');
  const match = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  if (!match) throw new Error(`no <project:data> in ${path}`);
  return JSON.parse(Buffer.from(match[1].trim(), 'base64').toString('utf8'));
}

/**
 * Replace ids minted during an operation with stable tokens, so the corpus is
 * reproducible - insertAnchorOnSegment seeds ids from Date.now() and
 * Math.random(). Cross-references in mirrorId are remapped to match.
 */
function normalizeGeneratedIds(anchors: any[], knownIds: Set<string>): any[] {
  const remap = new Map<string, string>();
  for (const a of anchors) {
    if (!knownIds.has(a.id) && !remap.has(a.id)) remap.set(a.id, `generated:${remap.size}`);
  }
  return anchors.map((a) => ({
    ...a,
    id: remap.get(a.id) ?? a.id,
    ...(a.mirrorId ? { mirrorId: remap.get(a.mirrorId) ?? a.mirrorId } : {}),
  }));
}

/** Canonical anchor shape: fixed key order, rounded, optionals omitted when absent. */
function serializeAnchor(a: any) {
  return {
    id: a.id,
    position: vec(a.position),
    ...(a.handleIn ? { handleIn: vec(a.handleIn) } : {}),
    ...(a.handleOut ? { handleOut: vec(a.handleOut) } : {}),
    handleMode: a.handleMode,
    ...(a.locked ? { locked: true } : {}),
    ...(a.semanticRole ? { semanticRole: a.semanticRole } : {}),
    ...(a.mirrorId ? { mirrorId: a.mirrorId } : {}),
  };
}

const serializeAnchors = (anchors: any[]) => anchors.map(serializeAnchor);

/**
 * The four corners of a pickup rout in model space, rotated about the
 * placement origin. Pins down the rotation convention, which is the easy thing
 * to get backwards when porting: positive angleDegrees turns clockwise,
 * because Y grows downward - matching SVG's rotate() and Konva's rotation.
 */
function routCorners(p: any, spec: { widthMm: number; heightMm: number }) {
  const rad = (p.angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = spec.widthMm / 2;
  const hh = spec.heightMm / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) =>
    vec({ x: p.offsetXMm + x * cos - y * sin, y: p.offsetYMm + x * sin + y * cos })
  );
}

function anchorBounds(anchors: any[]) {
  const xs = anchors.map((a: any) => a.position.x);
  const ys = anchors.map((a: any) => a.position.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

async function build() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const load = (p: string) => server.ssrLoadModule(p);
  const presets = await load('/src/utils/presets.ts');
  const bezier = await load('/src/utils/bezier.ts');
  const scaleMath = await load('/src/utils/scaleMath.ts');
  const symmetry = await load('/src/utils/symmetry.ts');
  const units = await load('/src/utils/units.ts');
  const hardware = await load('/src/constants/hardware.ts');
  const manifest = await load('/src/constants/blueprintManifest.ts');
  const schema = await load('/src/constants/schema.ts');

  const { NECK_PRESETS, BRIDGE_PRESETS, PICKUP_SPECIFICATIONS } = hardware;

  // --- Scale math over every neck x bridge combination -----------------------
  // The single most important thing for a port to get right, and small enough
  // to cover exhaustively rather than by sampling.
  const scaleMathMatrix = [];
  for (const neckId of Object.keys(NECK_PRESETS)) {
    for (const bridgeId of Object.keys(BRIDGE_PRESETS)) {
      const neck = NECK_PRESETS[neckId];
      const bridge = BRIDGE_PRESETS[bridgeId];
      scaleMathMatrix.push({
        neckPresetId: neckId,
        bridgePresetId: bridgeId,
        theoreticalSaddleYMm: round(scaleMath.getTheoreticalSaddleYMm(neck)),
        saddleYMm: round(scaleMath.getSaddleYMm(neck, bridge)),
        bridgePlateTopYMm: round(scaleMath.getBridgePlateTopYMm(neck, bridge)),
      });
    }
  }

  // --- Unit conversion ------------------------------------------------------
  const unitSamples = [0, 1, 6.35, 25.4, 42.5, 100, 647.7, 1000];
  const unitConversions = unitSamples.map((mm) => ({
    mm,
    inches: round(units.toDisplayUnits(mm, 'inches')),
    formattedMm: units.formatLength(mm, 'mm'),
    formattedInches: units.formatLength(mm, 'inches'),
    mmRoundTrip: round(units.toMm(units.toDisplayUnits(mm, 'inches'), 'inches')),
  }));
  const gridSnapping = [10, 25, 25.4, 40, 50, 60, 100, 101.6].flatMap((mm) =>
    (['mm', 'inches'] as const).map((unit) => ({
      inputMm: mm,
      unit,
      snappedMm: round(units.snapGridToUnit(mm, unit)),
      minorDivisor: units.gridMinorDivisor(unit),
    }))
  );

  // --- Per-blueprint geometry ----------------------------------------------
  const cases = [];
  for (const id of manifest.BLUEPRINT_ORDER) {
    const path = join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`);
    if (!existsSync(path)) throw new Error(`blueprint file missing: ${path}`);

    const project = decodeBlueprint(path);
    const anchors = project.contour.anchors;
    const closed = project.contour.closed ?? true;
    const knownIds = new Set<string>(anchors.map((a: any) => a.id));

    const neck = project.neckPreset ?? NECK_PRESETS[project.neckPresetId];
    const bridge = project.bridgePreset ?? BRIDGE_PRESETS[project.bridgePresetId];
    if (!neck || !bridge) throw new Error(`blueprint ${id} references unknown hardware`);

    // Every segment, densely sampled - the curve evaluation contract.
    const count = bezier.segmentCount(anchors, closed);
    const segments = [];
    for (let i = 0; i < count; i++) {
      const cps = bezier.getSegmentControlPoints(anchors, i, closed);
      const samples = [];
      for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
        const t = s / SAMPLES_PER_SEGMENT;
        samples.push(vec(bezier.evaluateCubicBezier(cps[0], cps[1], cps[2], cps[3], t)));
      }
      segments.push({
        index: i,
        straight: bezier.isSegmentStraight(anchors, i, closed),
        controlPoints: cps.map(vec),
        samples,
      });
    }

    // findClosestSegment probes at fixed fractions of the anchor bounding box,
    // plus one point outside it, so hit-testing is pinned down too.
    const b = anchorBounds(anchors);
    const at = (fx: number, fy: number): Vec => ({
      x: b.minX + (b.maxX - b.minX) * fx,
      y: b.minY + (b.maxY - b.minY) * fy,
    });
    const probes = [at(0.5, 0.5), at(0.25, 0.2), at(0.75, 0.6), at(0.1, 0.9), at(1.4, -0.3)].map(
      (point) => {
        const hit = bezier.findClosestSegment(anchors, closed, point);
        return {
          point: vec(point),
          index: hit.index,
          t: round(hit.t),
          closestPoint: vec(hit.point),
          distanceMm: round(hit.distance),
        };
      }
    );

    // Deterministic edits. Each starts from the pristine blueprint anchors.
    const inserted = bezier.insertAnchorOnSegment(anchors, 0, 0.5);
    const insertedId = inserted[1].id;

    const liveSymmetry = { mode: 'live_centerline', sourceSide: 'left' };
    const movable = anchors.find((a: any) => Math.abs(a.position.x) >= 1 && !a.locked);
    let symmetryCase = null;
    if (movable) {
      const dragged = anchors.map((a: any) =>
        a.id === movable.id
          ? {
              ...a,
              position: {
                x: a.position.x + SYMMETRY_DRAG_MM.x,
                y: a.position.y + SYMMETRY_DRAG_MM.y,
              },
            }
          : a
      );
      symmetryCase = {
        movedAnchorId: movable.id,
        dragMm: [SYMMETRY_DRAG_MM.x, SYMMETRY_DRAG_MM.y],
        anchors: serializeAnchors(
          normalizeGeneratedIds(symmetry.applyLiveSymmetry(dragged, movable.id, liveSymmetry), knownIds)
        ),
      };
    }

    cases.push({
      id,
      name: project.settings.name,
      neckPresetId: project.neckPresetId,
      bridgePresetId: project.bridgePresetId,
      scaleMath: {
        theoreticalSaddleYMm: round(scaleMath.getTheoreticalSaddleYMm(neck)),
        saddleYMm: round(scaleMath.getSaddleYMm(neck, bridge)),
        bridgePlateTopYMm: round(scaleMath.getBridgePlateTopYMm(neck, bridge)),
      },
      input: { closed, anchors: serializeAnchors(anchors) },
      pickups: (project.pickups ?? []).map((p: any) => {
        const spec = presets.resolvePickupSpec(p);
        return {
          id: p.id,
          type: p.type,
          offsetXMm: round(p.offsetXMm),
          offsetYMm: round(p.offsetYMm),
          angleDegrees: round(p.angleDegrees),
          rout: {
            widthMm: round(spec.widthMm),
            heightMm: round(spec.heightMm),
            cornerRadiusMm: round(spec.cornerRadiusMm),
          },
          corners: routCorners(p, spec),
        };
      }),
      expected: {
        svgPath: bezier.anchorsToSVGPath(anchors, closed),
        segmentCount: count,
        segments,
        closestSegmentProbes: probes,
        operations: {
          insertAnchorOnSegment: {
            segmentIndex: 0,
            t: 0.5,
            anchors: serializeAnchors(normalizeGeneratedIds(inserted, knownIds)),
          },
          straightenSegment: {
            segmentIndex: 0,
            anchors: serializeAnchors(bezier.straightenSegment(anchors, 0, closed)),
          },
          curveSegment: {
            segmentIndex: 0,
            anchors: serializeAnchors(bezier.curveSegment(anchors, 0, closed)),
          },
          resetAnchorHandleOut: {
            anchorIndex: 0,
            anchors: serializeAnchors(bezier.resetAnchorHandle(anchors, 0, 'out', closed)),
          },
          resetAnchorHandleIn: {
            anchorIndex: 0,
            anchors: serializeAnchors(bezier.resetAnchorHandle(anchors, 0, 'in', closed)),
          },
          withMirroredInsertion: {
            insertedOnSegment: 0,
            t: 0.5,
            anchors: serializeAnchors(
              normalizeGeneratedIds(
                symmetry.withMirroredInsertion(inserted, insertedId, liveSymmetry, closed),
                knownIds
              )
            ),
          },
          applyLiveSymmetry: symmetryCase,
        },
      },
    });
  }

  await server.close();

  return {
    formatVersion: 1,
    generator: 'scripts/generate-golden-corpus.ts',
    projectSchemaVersion: schema.PROJECT_SCHEMA_VERSION,
    conventions: {
      units: 'millimetres',
      xZero: 'body centreline',
      yZero: 'neck-pocket joint line; Y grows toward the tail',
      handles: 'handleIn/handleOut are offsets relative to their own anchor, not absolute points',
      toleranceMm: TOLERANCE_MM,
      samplesPerSegment: SAMPLES_PER_SEGMENT,
      generatedIds:
        'ids minted by an operation are rewritten to generated:<n> in order of appearance; a port should compare geometry, not ids',
    },
    constants: {
      mmPerInch: units.MM_PER_INCH,
      neckPresets: NECK_PRESETS,
      bridgePresets: BRIDGE_PRESETS,
      pickupSpecifications: PICKUP_SPECIFICATIONS,
    },
    unitConversions,
    gridSnapping,
    scaleMathMatrix,
    cases,
  };
}

/**
 * Collapse [x, y] pairs onto one line. Pretty-printing puts every coordinate
 * on its own line, which quadruples the file and makes it unreadable; the
 * structure stays indented, the points read as points, and a diff shows one
 * line per changed coordinate pair.
 */
const compactPairs = (s: string) =>
  s.replace(/\[\s+(-?[\d.eE+]+),\s+(-?[\d.eE+]+)\s+\]/g, '[$1, $2]');

const isCheck = process.argv.includes('--check');
const corpus = await build();
const json = `${compactPairs(JSON.stringify(corpus, null, 2))}\n`;
const digest = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

if (isCheck) {
  if (!existsSync(OUT_PATH)) {
    console.error(`Golden corpus missing at ${OUT_PATH}. Run: npm run corpus`);
    process.exit(1);
  }
  const existing = readFileSync(OUT_PATH, 'utf8');
  if (existing !== json) {
    console.error(
      `Golden corpus is out of date (committed ${digest(existing)}, generated ${digest(json)}).\n` +
        `Geometry output has changed. If that was intentional, run: npm run corpus`
    );
    process.exit(1);
  }
  console.log(`Golden corpus up to date (${digest(json)}, ${corpus.cases.length} blueprints).`);
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, json);
  const segments = corpus.cases.reduce((n, c) => n + c.expected.segmentCount, 0);
  console.log(
    `Wrote ${OUT_PATH}\n` +
      `  ${corpus.cases.length} blueprints, ${segments} segments, ` +
      `${segments * (SAMPLES_PER_SEGMENT + 1)} sampled points\n` +
      `  ${scaleMathMatrixSize(corpus)} scale-math combinations, sha ${digest(json)}`
  );
}

function scaleMathMatrixSize(c: Awaited<ReturnType<typeof build>>): number {
  return c.scaleMathMatrix.length;
}
