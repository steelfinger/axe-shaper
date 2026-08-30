/**
 * One-time generator for the eight bass blueprints' FIRST-DRAFT bodies
 * (milestone W6, docs/BASS_BODY_DESIGN_MILESTONES.md).
 *
 * These are explicitly NOT traced, photo-accurate replicas. Per the product
 * decision recorded there: an AI agent cannot produce a well-optimised
 * bezier trace of a reference photo the way a person can, so each body here
 * is instead an existing SHIPPED guitar contour (already a valid, smooth,
 * non-self-intersecting closed curve) affine-scaled to a bass's own sourced
 * envelope dimensions and repositioned onto real bass hardware - a
 * structurally-correct, immediately-editable starting point, meant for
 * hand refinement in the app once its editor is open on it. Never rerun
 * this script to "fix" a blueprint after a person has started editing it -
 * it would silently discard their work.
 *
 * The affine transform targets the sourced *overall body width*, not the
 * neck pocket - an earlier version of this script scaled X to pin the pocket
 * width instead, on the reasoning that neck_pocket_left/right sit at exactly
 * (-jointWidthMm/2, 0) / (+jointWidthMm/2, 0) in every source file. That is
 * true, but wrong to scale by: sg_style and gretsch_thunderbird are glued-
 * neck sources with a narrow 38.1mm mortise, and scaling their *whole body*
 * by the same ~1.67x needed to reach a bass's 63.5mm pocket produced a
 * ~530mm-wide body against a ~330mm sourced target - the pocket is real
 * hardware whose width has nothing to do with how wide the lower bout is.
 * X now scales to the sourced overall width instead, and the two neck-pocket
 * anchors are overridden to the exact bass pocket half-width afterward,
 * decoupled from body scale, which is physically the correct relationship.
 * Y scales independently so the tail lands at the sourced body length, with
 * Y=0 (the joint line) as the fixed point - matching this app's own
 * coordinate convention (CLAUDE.md, "Coordinate system"). Bezier handles are
 * offsets relative to their own anchor, so the same per-axis scale factors
 * apply to them directly; affine transforms preserve curve simplicity, so a
 * non-self-intersecting source stays non-self-intersecting - the one
 * exception being the post-hoc pocket-anchor override, checked separately.
 *
 * No pickguard/front-route/back-route/edge-profile is authored here - those
 * need their own sourced shapes and are deliberately left for the person
 * refining the draft, not guessed.
 *
 * Usage: npx tsx scripts/generate-bass-blueprint-drafts.ts [id ...]
 * With no args, regenerates every draft; with ids, only those.
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

const round = (n: number) => Math.round(n * 1000) / 1000;

function scaleContour(anchors: any[], scaleX: number, scaleY: number): any[] {
  const scaleVec = (v: { x: number; y: number }) => ({ x: round(v.x * scaleX), y: round(v.y * scaleY) });
  return anchors.map((a) => ({
    id: a.id,
    position: scaleVec(a.position),
    ...(a.handleIn ? { handleIn: scaleVec(a.handleIn) } : {}),
    ...(a.handleOut ? { handleOut: scaleVec(a.handleOut) } : {}),
    handleMode: a.handleMode,
    ...(a.semanticRole ? { semanticRole: a.semanticRole } : {}),
  }));
}

interface DraftSpec {
  id: string;
  name: string;
  sourceBlueprintId: string;
  bodyLengthMm: number;
  bodyWidthMm: number;
  neckId: 'bass_long_34' | 'bass_medium_33_25' | 'bass_short_30_5' | 'bass_short_30';
  // Defaults to bass_vintage_plate; the P/Mustang Fender-style bodies use the
  // measured bass_precision_plate.
  bridgeId?: 'bass_vintage_plate' | 'bass_precision_plate' | 'bass_r_style_plate';
  pickups: Array<{ type: string; offsetYMm: number }>;
}

// bodyLengthMm is Y=0 (joint line) to tail, matching this app's own
// convention - sourced where noted; each is repeated in the evidence
// packet under docs/bass-blueprint-evidence/.
const DRAFTS: DraftSpec[] = [
  // p_bass_style is NOT here: its body outline, pickguard and control-cavity
  // front route are traced from photos of a real Precision, not a scaled donor
  // shape. It is built by scripts/build-p-bass-blueprint.ts instead; rerunning
  // this generator must not touch it.
  {
    id: 'j_bass_style',
    name: 'J-Style Bass',
    sourceBlueprintId: 's_style',
    bodyLengthMm: 511, // matches recommended J-Bass build-blank length (20.5" min)
    bodyWidthMm: 355.6, // 14" - published Jazz Bass lower-bout width
    neckId: 'bass_long_34',
    pickups: [{ type: 'bass_j_single_coil', offsetYMm: 220 }, { type: 'bass_j_single_coil', offsetYMm: 320 }],
  },
  {
    id: 'mm_bass_style',
    name: 'MM-Style Bass',
    sourceBlueprintId: 's_style',
    bodyLengthMm: 495, // ESTIMATED - no published body-only length found; StingRay overall instrument length (44-7/8") runs ~25mm shorter than a P-Bass's (45-7/8"), scaled down proportionally
    bodyWidthMm: 342.9, // 13.5" - published StingRay overall width
    neckId: 'bass_long_34',
    // 186.7mm: 12th-fret-to-pickup-centre (11-5/8") plus this scale's own
    // nut-to-12th-fret distance minus nutToBodyEdgeMm - see evidence packet.
    pickups: [{ type: 'bass_humbucker', offsetYMm: 186.7 }],
  },
  {
    id: 'r_bass_style',
    name: 'R-Style Bass',
    sourceBlueprintId: 'jag_style',
    bodyLengthMm: 478, // ESTIMATED - Rickenbacker publishes only overall instrument length (44-13/16"); no body-only figure found
    bodyWidthMm: 342.9, // 13.5" - published Rickenbacker 4003 overall width
    neckId: 'bass_medium_33_25',
    bridgeId: 'bass_r_style_plate',
    pickups: [{ type: 'bass_r_toaster', offsetYMm: 210 }, { type: 'bass_r_horseshoe', offsetYMm: 310 }],
  },
  {
    id: 'thunderbird_bass_style',
    name: 'Thunderbird-Style Bass',
    sourceBlueprintId: 'gretsch_thunderbird',
    bodyLengthMm: 508, // 20" - published reverse-body Thunderbird body length (mid-1970s reissue reference)
    bodyWidthMm: 330, // 13" - published reverse-body Thunderbird width (see body-length note above)
    neckId: 'bass_long_34',
    pickups: [{ type: 'bass_mini_humbucker', offsetYMm: 230 }, { type: 'bass_mini_humbucker', offsetYMm: 320 }],
  },
  {
    id: 'mustang_bass_style',
    name: 'Mustang-Style Bass',
    sourceBlueprintId: 'jag_style',
    bodyLengthMm: 431.8, // 17" - published as "neck pocket to bottom of body," exactly this app's own Y=0-to-tail convention
    bodyWidthMm: 305, // 12" - published Mustang Bass lower-bout width ("just over 12 inches")
    neckId: 'bass_short_30',
    bridgeId: 'bass_precision_plate',
    pickups: [{ type: 'bass_split_coil', offsetYMm: 230 }],
  },
  {
    id: 'sg_bass_style',
    name: 'SG-Style Bass',
    sourceBlueprintId: 'sg_style',
    bodyLengthMm: 432, // 17" - published 1961 EB-3 body length; EB-3 is independently documented as sharing the SG guitar's body
    bodyWidthMm: 330, // 13" - published 1961 EB-3 body width
    neckId: 'bass_short_30_5',
    pickups: [{ type: 'bass_mudbucker', offsetYMm: 200 }, { type: 'bass_mudbucker', offsetYMm: 280 }],
  },
  {
    id: 'streamer_bass_style',
    name: 'Streamer-Style Bass',
    sourceBlueprintId: 's_style',
    bodyLengthMm: 500, // ESTIMATED - no published body dimension found at all; generic 34"-class envelope
    bodyWidthMm: 340, // ESTIMATED - no published width found; generic 34"-class envelope
    neckId: 'bass_long_34',
    pickups: [{ type: 'bass_soapbar', offsetYMm: 225 }, { type: 'bass_soapbar', offsetYMm: 310 }],
  },
];

async function main() {
  // Optional positional filter: regenerate only the named blueprint ids,
  // leaving the rest (and their metadata timestamps) untouched.
  const only = new Set(process.argv.slice(2));
  const drafts = only.size > 0 ? DRAFTS.filter((d) => only.has(d.id)) : DRAFTS;
  if (only.size > 0 && drafts.length !== only.size) {
    const known = new Set(DRAFTS.map((d) => d.id));
    const bad = [...only].filter((id) => !known.has(id));
    throw new Error(`unknown blueprint id(s): ${bad.join(', ')}`);
  }

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

  for (const draft of drafts) {
    const outPath = join(ROOT, 'src', 'constants', 'blueprints', `${draft.id}.axe.svg`);
    // Keep the R-style bridge marker, which was authored separately from this
    // first-draft generator, when refreshing that template's pickup layout.
    const existing = draft.id === 'r_bass_style' ? decodeBlueprint(outPath) : undefined;
    const sourcePath = join(ROOT, 'src', 'constants', 'blueprints', `${draft.sourceBlueprintId}.axe.svg`);
    const source = decodeBlueprint(sourcePath);
    const sourceXs = source.contour.anchors.map((a: any) => a.position.x);
    const sourceWidth = Math.max(...sourceXs) - Math.min(...sourceXs);
    const sourceMaxY = Math.max(...source.contour.anchors.map((a: any) => a.position.y));

    const scaleX = draft.bodyWidthMm / sourceWidth;
    const scaleY = draft.bodyLengthMm / sourceMaxY;

    const contour = { closed: true, anchors: scaleContour(source.contour.anchors, scaleX, scaleY) };

    // Neck pocket width is real hardware, independent of how wide the
    // scaled-up/down body ends up - decoupled from the body-width scale
    // above, not proportional to it. See the module comment for why scaling
    // this by the pocket ratio instead produced a ~530mm-wide body.
    const targetJointHalf = hardware.GENERIC_POCKET_SPEC.bass.bolt_on.jointWidthMm / 2; // 31.75mm
    for (const a of contour.anchors) {
      if (a.semanticRole === 'neck_pocket_left') a.position.x = -targetJointHalf;
      if (a.semanticRole === 'neck_pocket_right') a.position.x = targetJointHalf;
    }

    // Template-aware neck fields, so the embedded neckPreset copy carries the
    // per-body nutToBodyEdgeMm from FINGERBOARD_OVERHANG_MM (p_bass_style's is
    // a user-measured 507.6, not the fret-17 value) - matching what New Design
    // produces via neckPresetFieldsForNewTemplate. Rounded to 4dp like the
    // hand-written NECK_PRESETS constants, so bodies whose overhang still
    // equals fret20-fret17 (every one but P) re-embed their exact prior value.
    const neckFields = presets.neckPresetFieldsForNewTemplate(draft.neckId, draft.id, 'bass');
    neckFields.neckPreset.nutToBodyEdgeMm = Math.round(neckFields.neckPreset.nutToBodyEdgeMm * 1e4) / 1e4;

    const now = new Date().toISOString();
    const pickups = draft.pickups.map((p, i) => {
      const spec = hardware.PICKUP_SPECIFICATIONS[p.type];
      return {
        id: `${draft.id}_pickup_${i}`,
        type: p.type,
        offsetXMm: 0,
        offsetYMm: p.offsetYMm,
        angleDegrees: 0,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
        anchors: spec.anchors,
      };
    });

    const project = {
      schemaVersion: 3,
      appVersion: '1.0.0',
      instrumentType: 'bass',
      stringCount: 4,
      metadata: { created: now, modified: now, author: 'Axe Shaper Luthier' },
      settings: {
        name: draft.name,
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
        pickguardEnabled: false,
        pickguardColor: '#ffffff',
      },
      activeTemplateId: draft.id,
      contour,
      ...neckFields,
      neckJointMechanism: hardware.DEFAULT_NECK_JOINT_MECHANISM[draft.id] ?? 'bolt_on',
      ...presets.bridgePresetFields(draft.bridgeId ?? 'bass_vintage_plate'),
      pickups,
      pickguards: [],
      frontRoutes: existing?.frontRoutes ?? [],
      backRoutes: [],
    };

    const svg = svgExporter.exportProjectToSVG(project);
    writeFileSync(outPath, svg);
    console.log(`wrote ${draft.id} (from ${draft.sourceBlueprintId}, scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)})`);
  }

  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
