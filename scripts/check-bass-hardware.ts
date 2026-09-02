/**
 * Milestone W2's exit criteria, as assertions: the bass half of the
 * catalogue exists, is complete, and cannot leak guitar hardware into a bass
 * project.
 *
 * The failure this guards against is quiet. Substituting a guitar neck
 * pocket, bridge or pickup rout into a bass design resolves, draws, saves and
 * prints without complaining - it is simply wrong by 8mm here and 30mm there
 * on a plan whose whole purpose is to be printed 1:1 and cut into wood. None
 * of it surfaces as an error, so it has to surface as a test.
 *
 * Usage:
 *   npm run bass:check
 *
 * Modules load through Vite's SSR pipeline for the same reason as
 * generate-golden-corpus.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = join(ROOT, 'tests', 'golden', 'geometry-corpus.json');
const BASE_BLUEPRINT = join(ROOT, 'src', 'constants', 'blueprints', 's_style.axe.svg');

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

function decodePayload(path: string): any {
  const match = readFileSync(path, 'utf8').match(/<project:data>([\s\S]*?)<\/project:data>/);
  invariant(match, `no <project:data> in ${path}`);
  return JSON.parse(Buffer.from(match![1].trim(), 'base64').toString('utf8'));
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
    const hardware = await load('/src/constants/hardware.ts');
    const presets = await load('/src/utils/presets.ts');
    const instrument = await load('/src/utils/instrument.ts');
    const pickupEditing = await load('/src/utils/pickupEditing.ts');
    const scaleMath = await load('/src/utils/scaleMath.ts');
    const bridgeDrawing = await load('/src/utils/bridgeDrawing.ts');
    const exporter = await load('/src/utils/svgExporter.ts');
    const manifest = await load('/src/constants/blueprintManifest.ts');
    const bezier = await load('/src/utils/bezier.ts');
    const projectNaming = await load('/src/utils/projectNaming.ts');

    const bassNecks = presets.offeredNeckPresets('bass');
    const bassBridges = presets.offeredBridgePresets('bass');
    const bassPickups = presets.offeredPickupTypes('bass');

    console.log('catalogue');

    check('the four bass scale lengths are all present and exact', () => {
      // The catalogue the plan commits to: 30", 30.5", 33.25" and 34".
      const scales = bassNecks.map((n: any) => n.scaleLengthMm).sort((a: number, b: number) => a - b);
      deepStrictEqual(scales, [762, 774.7, 844.55, 863.6]);
      for (const neck of bassNecks) {
        const inches = neck.scaleLengthMm / 25.4;
        invariant(
          Math.abs(inches - Number(inches.toFixed(3))) < 1e-9,
          `${neck.id} is ${inches}" - not an exact inch conversion`
        );
      }
    });

    check('bass necks and bridges carry the fields bass makes load-bearing', () => {
      for (const neck of bassNecks) {
        invariant(neck.nutStringSpacingMm! > 0, `${neck.id} has no nutStringSpacingMm`);
      }
      for (const bridge of bassBridges) {
        invariant(bridge.stringSpacingMm! > 0, `${bridge.id} has no stringSpacingMm`);
        invariant(bridge.heightMm! > 0, `${bridge.id} has no heightMm`);
      }
    });

    check('string spacing reads as a total spread, not a per-string pitch', () => {
      // The single most consequential ambiguity in the shared format
      // (docs/AXE_SVG_FORMAT.md). A four-string bass at ~19mm pitch is ~57mm
      // of spread; anything near 19 here means someone wrote the pitch.
      for (const bridge of bassBridges) {
        const pitch = bridge.stringSpacingMm! / 3; // 4 strings, 3 intervals
        invariant(
          pitch > 15 && pitch < 22,
          `${bridge.id} stringSpacingMm ${bridge.stringSpacingMm} implies a ${pitch.toFixed(1)}mm pitch - ` +
            `written as a pitch instead of a total spread?`
        );
      }
      for (const neck of bassNecks) {
        const pitch = neck.nutStringSpacingMm! / 3;
        invariant(pitch > 8 && pitch < 13, `${neck.id} nutStringSpacingMm implies a ${pitch.toFixed(1)}mm nut pitch`);
      }
    });

    console.log('the neck pocket is a bass pocket');

    check('a bass pocket is never the guitar pocket, on either mechanism', () => {
      const guitar = hardware.GENERIC_POCKET_SPEC.guitar;
      for (const mechanism of ['bolt_on', 'glued'] as const) {
        const pocket = hardware.GENERIC_POCKET_SPEC.bass[mechanism];
        invariant(
          pocket.jointWidthMm !== guitar[mechanism].jointWidthMm,
          `bass ${mechanism} pocket width still matches the guitar's ${guitar[mechanism].jointWidthMm}mm`
        );
      }
      // The measured Fender four-string pocket, 2-1/2" x 3-7/8".
      deepStrictEqual(hardware.GENERIC_POCKET_SPEC.bass.bolt_on.jointWidthMm, 63.5);
      deepStrictEqual(hardware.GENERIC_POCKET_SPEC.bass.bolt_on.jointDepthMm, 98.425);
    });

    check('resolving a bass neck routs the bass pocket, not bolt_on’s guitar value', () => {
      for (const neck of bassNecks) {
        for (const mechanism of ['bolt_on', 'glued'] as const) {
          const fields = presets.neckPresetFieldsForTemplate(neck.id, 'p_bass_style', mechanism, 'bass');
          deepStrictEqual(fields.neckPreset.jointWidthMm, 63.5);
          deepStrictEqual(fields.neckPreset.pocketWidthMm, 63.5);
        }
      }
      // ...and a guitar is untouched by the new axis.
      const guitarFields = presets.neckPresetFieldsForTemplate('fender_scale', 's_style', 'bolt_on', 'guitar');
      deepStrictEqual(guitarFields.neckPreset.jointWidthMm, 55.56);

      const rStyleGlued = presets.neckPresetFieldsForTemplate('bass_medium_33_25', 'r_bass_style', 'glued', 'bass');
      deepStrictEqual(rStyleGlued.neckPreset.jointWidthMm, 40);
      deepStrictEqual(rStyleGlued.neckPreset.pocketWidthMm, 40);
      const rStyleBoltOn = presets.neckPresetFieldsForTemplate('bass_medium_33_25', 'r_bass_style', 'bolt_on', 'bass');
      deepStrictEqual(rStyleBoltOn.neckPreset.jointWidthMm, 63.5);
    });

    check('every bass blueprint has an explicit neck joint mechanism', () => {
      // An omitted entry silently yields bolt-on, which is wrong for four of
      // these. The ids are the shared contract column with iOS.
      const expected = {
        p_bass_style: 'bolt_on',
        j_bass_style: 'bolt_on',
        mm_bass_style: 'bolt_on',
        r_bass_style: 'glued',
        thunderbird_bass_style: 'glued',
        mustang_bass_style: 'bolt_on',
        sg_bass_style: 'glued',
        streamer_bass_style: 'bolt_on',
      };
      for (const [id, mechanism] of Object.entries(expected)) {
        deepStrictEqual(hardware.DEFAULT_NECK_JOINT_MECHANISM[id], mechanism, `${id} resolves to the wrong mechanism`);
      }
    });

    check('every bass blueprint locks its neck-pocket anchors to the joint line', () => {
      for (const id of manifest.BLUEPRINT_ORDER.filter((id: string) => manifest.BLUEPRINT_MANIFEST[id].instrumentType === 'bass')) {
        const raw = readFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`), 'utf8');
        const encoded = raw.match(/<project:data>([\s\S]*?)<\/project:data>/)?.[1];
        invariant(encoded, `${id}: no project payload`);
        const project = JSON.parse(Buffer.from(encoded!.trim(), 'base64').toString('utf8'));
        const pocketAnchors = project.contour.anchors.filter((anchor: { semanticRole?: string }) =>
          anchor.semanticRole === 'neck_pocket_left' || anchor.semanticRole === 'neck_pocket_right'
        );
        invariant(pocketAnchors.length === 2, `${id}: expected two neck-pocket anchors`);
        invariant(
          pocketAnchors.every((anchor: { locked?: boolean; position: { y: number } }) => anchor.locked === true && anchor.position.y === 0),
          `${id}: neck-pocket anchors must be locked at Y=0`
        );
      }
    });

    console.log('selectors offer only compatible hardware');

    check('no selector returns an entry belonging to the other instrument', () => {
      for (const type of instrument.INSTRUMENT_TYPES) {
        for (const neck of presets.offeredNeckPresets(type)) {
          deepStrictEqual(instrument.neckPresetInstrument(neck.id), type, `neck ${neck.id} offered for ${type}`);
        }
        for (const bridge of presets.offeredBridgePresets(type)) {
          deepStrictEqual(instrument.bridgePresetInstrument(bridge.id), type, `bridge ${bridge.id} offered for ${type}`);
        }
        for (const pickup of presets.offeredPickupTypes(type)) {
          deepStrictEqual(instrument.pickupTypeInstrument(pickup), type, `pickup ${pickup} offered for ${type}`);
        }
      }
      invariant(bassNecks.length > 0 && bassBridges.length > 0 && bassPickups.length > 0, 'the bass catalogue is empty');
    });

    check('the guitar catalogue is unchanged by the split', () => {
      deepStrictEqual(
        presets.offeredNeckPresets('guitar').map((n: any) => n.id),
        ['baritone_scale', 'fender_scale', 'gibson_scale', 'jaguar_scale']
      );
      deepStrictEqual(presets.offeredBridgePresets('guitar').map((b: any) => b.id), [
        'hardtail_6',
        'tremolo_strat',
        'tune_o_matic',
        'tele_bridge_plate',
      ]);
    });

    check('a template from the other instrument is not applicable', () => {
      const bassProject = { instrumentType: 'bass', stringCount: 4 };
      invariant(
        !presets.isTemplateCompatible({ instrumentType: 'guitar', stringCount: 6 }, bassProject),
        'a guitar blueprint was offered to a bass project'
      );
      invariant(
        presets.isTemplateCompatible({ instrumentType: 'bass', stringCount: 4 }, bassProject),
        'a bass blueprint was refused by a bass project'
      );
      // An untagged user template - no instrumentType on the record - reads
      // as Guitar/6, so it must not apply to a bass project either.
      invariant(!presets.isTemplateCompatible({}, bassProject), 'an untagged template was offered to a bass project');
    });

    console.log('bass pickups: create, resize, save, reload, delete');

    // A synthetic Bass/4 project. The contour is the S-Style's - this
    // exercises the hardware, not the body; real bass outlines arrive at W6.
    const baseline = presets.migrateProject(decodePayload(BASE_BLUEPRINT));
    const bassProject = {
      ...baseline,
      instrumentType: 'bass',
      stringCount: 4,
      pickups: [],
      ...presets.neckPresetFieldsForTemplate('bass_long_34', 'p_bass_style', 'bolt_on', 'bass'),
      ...presets.bridgePresetFields('bass_vintage_plate'),
      settings: { ...baseline.settings, name: 'Synthetic Bass/4' },
    };

    for (const type of bassPickups) {
      check(`${type}: created, resized, saved, reloaded and deleted`, () => {
        const added = pickupEditing.addingPickup(bassProject, type);
        const pickup = added.project.pickups.at(-1);
        invariant(pickup.type === type, `created a ${pickup.type} instead`);
        invariant(pickup.widthMm > 0 && pickup.heightMm > 0, 'created a non-positive rout');
        invariant(pickup.anchors?.length >= 4, 'created a rout with no outline');

        const resized = pickupEditing.settingPickupWidth(added.project, added.id, pickup.widthMm * 1.5);
        const resizedPickup = resized.pickups.at(-1);
        const spec = presets.resolvePickupSpec(resizedPickup);
        invariant(
          Math.abs(spec.widthMm - pickup.widthMm * 1.5) < 1e-9,
          `resize reported ${spec.widthMm}, expected ${pickup.widthMm * 1.5}`
        );
        const widest = Math.max(...spec.anchors.map((a: any) => Math.abs(a.position.x))) * 2;
        invariant(
          Math.abs(widest - spec.widthMm) < 0.01,
          `the outline is ${widest.toFixed(3)}mm wide but the rout claims ${spec.widthMm}mm`
        );

        const reloaded = presets.migrateProject(
          JSON.parse(
            Buffer.from(
              exporter.exportProjectToSVG(resized).match(/<project:data>([\s\S]*?)<\/project:data>/)![1].trim(),
              'base64'
            ).toString('utf8')
          )
        );
        deepStrictEqual(reloaded.pickups, resized.pickups);
        deepStrictEqual(reloaded.instrumentType, 'bass');

        deepStrictEqual(pickupEditing.removingPickup(reloaded, added.id).pickups, []);
      });
    }

    check('a guitar pickup type cannot be seeded into a bass project', () => {
      // The catalogue-substitution hazard, from both directions.
      const added = pickupEditing.addingPickup(bassProject, 'humbucker');
      const seeded = added.project.pickups.at(-1);
      invariant(
        instrument.pickupTypeInstrument(seeded.type) === 'bass',
        `adding a guitar humbucker to a bass project produced a ${seeded.type}`
      );
      const retyped = pickupEditing.settingPickupType(added.project, added.id, 'tele_bridge');
      invariant(
        instrument.pickupTypeInstrument(retyped.pickups.at(-1).type) === 'bass',
        'retyping to a guitar pickup was honoured in a bass project'
      );
    });

    console.log('the fingerboard-overhang reference fret');

    check('guitar is still fret 22, so no existing body moves', () => {
      deepStrictEqual(instrument.FINGERBOARD_REFERENCE_FRET.guitar, 22);
      // Every value in FINGERBOARD_OVERHANG_MM was computed with 22 against
      // its body's own native neck. Recomputing it must return the native
      // nutToBodyEdgeMm exactly - if this drifts, every bundled guitar body
      // has slid along its neck.
      const native: Record<string, string> = {
        single_cut: 'gibson_lp_22',
        sg_style: 'gibson_sg_22',
        s_style: 'fender_strat_21',
        t_style: 'fender_tele_22',
        gibson_firebird: 'gibson_firebird_19',
        gretsch_thunderbird: 'gretsch_thunderbird_22',
        gibson_flying_v: 'gibson_flying_v_22',
        jag_style: 'jaguar_22',
      };
      for (const [bodyId, neckId] of Object.entries(native)) {
        const neck = hardware.NECK_PRESETS[neckId];
        const overhang = hardware.FINGERBOARD_OVERHANG_MM[bodyId];
        invariant(neck && overhang !== undefined, `${bodyId}/${neckId} is missing`);
        const recomputed = scaleMath.getFretDistanceFromNutMm(22, neck.scaleLengthMm) - overhang;
        invariant(
          Math.abs(recomputed - neck.nutToBodyEdgeMm) < 1e-3,
          `${bodyId}: recomputes to ${recomputed.toFixed(4)}, native is ${neck.nutToBodyEdgeMm}`
        );
      }
    });

    check('the derivation cancels: a same-scale neck reproduces the body exactly', () => {
      // The property the whole scheme rests on, and the reason the reference
      // fret is a *rate* rather than a claim about where a fingerboard ends.
      // s_style is the sharpest case: its overhang is derived from the
      // 21-fret fender_strat_21 using fret 22, and attaching the 22-fret
      // fender_scale at the same 647.7mm must still land on 390.7.
      const fields = presets.neckPresetFieldsForTemplate('fender_scale', 's_style', 'bolt_on', 'guitar');
      invariant(
        Math.abs(fields.neckPreset.nutToBodyEdgeMm - 390.7) < 1e-3,
        `same-scale swap moved the joint to ${fields.neckPreset.nutToBodyEdgeMm}`
      );
    });

    check('bass uses fret 20, and that is the right rate for four-string necks', () => {
      deepStrictEqual(instrument.FINGERBOARD_REFERENCE_FRET.bass, 20);
      // Every bass neck this build offers has 19-21 frets, so 22 would be
      // the wrong rate. Guard the premise rather than the number: if a
      // 22-fret bass neck is ever added, this choice deserves rethinking.
      for (const neck of bassNecks) {
        invariant(
          neck.frets >= 19 && neck.frets <= 21,
          `${neck.id} has ${neck.frets} frets - reconsider FINGERBOARD_REFERENCE_FRET.bass`
        );
      }
    });

    check('the reference fret is never read off the neck itself', () => {
      // Deriving with one fret count and consuming with another breaks the
      // cancellation above. Two necks of the same scale but different fret
      // counts must resolve a body identically; if this fails, someone has
      // made the reference fret neck-owned.
      const a = presets.neckPresetFieldsForTemplate('fender_strat_21', 's_style', 'bolt_on', 'guitar');
      const b = presets.neckPresetFieldsForTemplate('fender_tele_22', 's_style', 'bolt_on', 'guitar');
      invariant(a.neckPreset.frets !== b.neckPreset.frets, 'the fixture necks no longer differ in fret count');
      deepStrictEqual(a.neckPreset.scaleLengthMm, b.neckPreset.scaleLengthMm);
      deepStrictEqual(a.neckPreset.nutToBodyEdgeMm, b.neckPreset.nutToBodyEdgeMm);
    });

    console.log('the eight bass blueprints (milestone W6)');

    check('every bass blueprint decodes, is non-self-intersecting, and exports without clipping', () => {
      // The bundled files themselves, not a synthetic stand-in - the same
      // segment-intersection sweep the geometry is verified with elsewhere,
      // plus the real assertNoClipping run against each file's own real
      // contour/hardware/pickups, both orientations.
      const bassBlueprintIds = Object.keys(hardware.DEFAULT_NECK_JOINT_MECHANISM).filter((id) =>
        id.includes('bass')
      );
      invariant(bassBlueprintIds.length === 8, `expected 8 bass blueprint ids, found ${bassBlueprintIds.length}`);

      const segmentsIntersect = (p1: any, p2: any, p3: any, p4: any) => {
        const d = (a: any, b: any, c: any) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
        return (d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0) && (d3 > 0 && d4 < 0 || d3 < 0 && d4 > 0);
      };

      for (const id of bassBlueprintIds) {
        const raw = readFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`), 'utf8');
        const match = raw.match(/<project:data>([\s\S]*?)<\/project:data>/);
        invariant(match, `${id}: no <project:data> in the blueprint file`);
        const project = JSON.parse(Buffer.from(match![1].trim(), 'base64').toString('utf8'));
        invariant(project.instrumentType === 'bass' && project.stringCount === 4, `${id}: not tagged Bass/4`);

        const anchors = project.contour.anchors;
        const closed = project.contour.closed;
        const count = bezier.segmentCount(anchors, closed);
        const poly: any[] = [];
        for (let i = 0; i < count; i++) {
          const cps = bezier.getSegmentControlPoints(anchors, i, closed);
          for (let s = 0; s < 30; s++) poly.push(bezier.evaluateCubicBezier(cps[0], cps[1], cps[2], cps[3], s / 30));
        }
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue;
            invariant(
              !segmentsIntersect(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]),
              `${id}: contour self-intersects between sample ${i} and ${j}`
            );
          }
        }

        for (const orientation of ['vertical', 'horizontal'] as const) {
          assertNoClipping({ ...project, settings: { ...project.settings, canvasOrientation: orientation } }, `${id}/${orientation}`);
        }
      }
    });

    console.log('an imported Bass/4 project stays a bass');

    check('opens in bass mode even when every preset id is unknown', () => {
      // The W4 criterion, and the reason the instrument axis is project-level
      // rather than derived from the hardware: a file naming presets this
      // build has never heard of must still open as what it says it is, with
      // its own embedded measurements driving the drawing.
      const foreign = {
        ...bassProject,
        neckPresetId: 'some_future_bass_neck',
        bridgePresetId: 'some_future_bass_bridge',
        neckPreset: { ...bassProject.neckPreset, id: 'some_future_bass_neck', scaleLengthMm: 880, nutToBodyEdgeMm: 550 },
        bridgePreset: { ...bassProject.bridgePreset, id: 'some_future_bass_bridge', compensationMm: { treble: 4, bass: 11 } },
      };
      const written = exporter.exportProjectToSVG(foreign);
      const result = presets.loadProject(
        JSON.parse(Buffer.from(written.match(/<project:data>([\s\S]*?)<\/project:data>/)![1].trim(), 'base64').toString('utf8'))
      );
      invariant(result.ok, `the file was refused: ${!result.ok ? result.message : ''}`);
      deepStrictEqual(result.project.instrumentType, 'bass');
      deepStrictEqual(result.project.stringCount, 4);

      // Embedded physical values still win over any catalogue lookup.
      const neck = presets.resolveNeckPreset(result.project);
      const bridge = presets.resolveBridgePreset(result.project);
      deepStrictEqual(neck.scaleLengthMm, 880);
      deepStrictEqual(neck.nutToBodyEdgeMm, 550);
      deepStrictEqual(bridge.compensationMm.treble, 4);
      deepStrictEqual(scaleMath.getTheoreticalSaddleYMm(neck), 330);
    });

    check('an unknown bass preset id is not offered as a choice', () => {
      // Resolving it and offering it are different questions. The file above
      // draws correctly; its ids simply are not in any picker.
      invariant(
        !presets.offeredNeckPresets('bass').some((n: any) => n.id === 'some_future_bass_neck'),
        'an unknown id leaked into the neck picker'
      );
      deepStrictEqual(instrument.neckPresetInstrument('some_future_bass_neck'), undefined);
    });

    check('every blueprint is offered to its own instrument only (W6: 8 guitar, 8 bass)', () => {
      // W4's version of this check asserted no bass blueprint was offered to
      // a bass project, because none existed. W6 bundles eight; this is the
      // same cross-instrument guard, both directions, now that there is
      // something on each side to get wrong.
      //
      // Read from BLUEPRINT_MANIFEST rather than REFERENCE_TEMPLATES: the
      // manifest is where the instrument tag actually lives, and
      // constants/templates.ts decodes the .axe.svg files through a DOMParser
      // that Node does not have.
      const bassDoc = { instrumentType: 'bass', stringCount: 4 };
      const guitarDoc = { instrumentType: 'guitar', stringCount: 6 };
      const entries = Object.entries<any>(manifest.BLUEPRINT_MANIFEST);
      const byInstrument = { guitar: 0, bass: 0 };
      for (const [id, entry] of entries) {
        const template = {
          instrumentType: entry.instrumentType,
          stringCount: instrument.defaultStringCount(entry.instrumentType),
        };
        const ownDoc = entry.instrumentType === 'bass' ? bassDoc : guitarDoc;
        const otherDoc = entry.instrumentType === 'bass' ? guitarDoc : bassDoc;
        invariant(presets.isTemplateCompatible(template, ownDoc), `blueprint ${id} is not offered to its own instrument`);
        invariant(!presets.isTemplateCompatible(template, otherDoc), `blueprint ${id} is offered to the other instrument`);
        byInstrument[entry.instrumentType as 'guitar' | 'bass']++;
      }
      deepStrictEqual(byInstrument, { guitar: 8, bass: 8 });
    });

    console.log('no clipping in the printable export, at bass scale lengths');

    // Every risk to "no clipping" is instrument-agnostic by construction:
    // exportProjectToSVG's page size is derived from getContentBoundsMm,
    // which sweeps the contour, pickguards/routes, the neck pocket, the
    // bridge geometry and the saddle line dynamically - not from any
    // guitar-shaped constant. This turns that reasoning into a checked fact
    // rather than leaving it as an assumption: for each of the bass necks,
    // paired with the bass bridge, the elements most likely to exceed a
    // page sized for a shorter guitar scale - the saddle line, the wider
    // 63.5mm pocket, the bridge footprint - are independently derived here
    // via the same exported primitives the exporter itself calls, then
    // checked against the *actual rendered* viewBox, in both orientations.
    //
    // A rotate(90) transform is applied to the geometry group in horizontal
    // orientation (svgExporter.ts's own documented "(x, y) -> (-y, x)"), so
    // horizontal points are rotated the same way before the containment
    // check - this mirrors the transform, it does not guess at it.
    function parseViewBox(svg: string) {
      const match = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
      invariant(match, 'no viewBox in the exported SVG');
      const [minX, minY, width, height] = match!.slice(1).map(Number);
      return { minX, minY, maxX: minX + width, maxY: minY + height };
    }

    function containedIn(box: { minX: number; minY: number; maxX: number; maxY: number }) {
      return (x: number, y: number, label: string) => {
        invariant(
          x >= box.minX - 1e-6 && x <= box.maxX + 1e-6 && y >= box.minY - 1e-6 && y <= box.maxY + 1e-6,
          `${label} at (${x.toFixed(2)}, ${y.toFixed(2)}) falls outside the printed page ` +
            `[${box.minX.toFixed(2)}, ${box.maxX.toFixed(2)}] x [${box.minY.toFixed(2)}, ${box.maxY.toFixed(2)}]`
        );
      };
    }

    // Deliberately tiny - 60mm x 100mm, Y in [0, 100] - so the body contour
    // itself covers none of a bass's ~300-330mm saddle position. A real
    // bass body (arriving at W6) is not guaranteed to reach that far either;
    // this is the actual case "verify 1:1 export bounds for the longer bass
    // scale" has to mean, since the page must expand to fit the *hardware*,
    // not assume the body outline already does. Reusing a full-size guitar
    // contour here would make this check pass by coincidence - the guitar
    // body is long enough to cover the bass bridge position on its own,
    // which was confirmed by temporarily deleting the exporter's bridge-
    // bounds inclusion and finding these checks still green.
    const undersizedContour = {
      closed: true,
      anchors: [
        { id: 'tiny_0', position: { x: -30, y: 0 }, handleMode: 'corner' as const },
        { id: 'tiny_1', position: { x: 30, y: 0 }, handleMode: 'corner' as const },
        { id: 'tiny_2', position: { x: 30, y: 100 }, handleMode: 'corner' as const },
        { id: 'tiny_3', position: { x: -30, y: 100 }, handleMode: 'corner' as const },
      ],
    };

    function assertNoClipping(project: any, label: string) {
      const neck = presets.resolveNeckPreset(project);
      const bridge = presets.resolveBridgePreset(project);
      const svg = exporter.exportProjectToSVG(project);
      const fullBox = parseViewBox(svg);
      // The geometry group's own bottom edge - where the "Title, Specs &
      // Calibration Band" begins (svgExporter.ts's own `bandTopY`,
      // read back off the `.band-rule` line it draws exactly there).
      // Checking against the *full* viewBox height would be too lenient: it
      // includes the fixed 181mm info band below the geometry, which for a
      // small placeholder body can be large enough to mask a real
      // content-bounds gap by coincidence rather than by the geometry
      // actually fitting - confirmed by a deliberate regression that broke
      // bridge-bounds inclusion and still passed against the full box.
      const bandRuleMatch = svg.match(/<line x1="[-\d.]+" y1="([-\d.]+)"[^>]*class="band-rule"/);
      invariant(bandRuleMatch, `${label}: no band-rule line in the export`);
      const box = { ...fullBox, maxY: Number(bandRuleMatch![1]) };
      const isHorizontal = project.settings.canvasOrientation === 'horizontal';
      // The exporter's own rotation, applied here to every point under test
      // rather than only to the viewBox - see the comment above.
      const rotate = (x: number, y: number): [number, number] => (isHorizontal ? [-y, x] : [x, y]);
      const check = containedIn(box);
      const at = (x: number, y: number, what: string) => {
        const [rx, ry] = rotate(x, y);
        check(rx, ry, `${label}: ${what}`);
      };

      // Body contour - anchors and their handles.
      for (const a of project.contour.anchors) {
        at(a.position.x, a.position.y, 'a contour anchor');
        if (a.handleIn) at(a.position.x + a.handleIn.x, a.position.y + a.handleIn.y, 'a contour handle');
        if (a.handleOut) at(a.position.x + a.handleOut.x, a.position.y + a.handleOut.y, 'a contour handle');
      }

      // The neck pocket rect: (-jointWidthMm/2, 0) to (jointWidthMm/2, jointDepthMm).
      at(-neck.jointWidthMm / 2, 0, 'the neck pocket');
      at(neck.jointWidthMm / 2, neck.jointDepthMm, 'the neck pocket');

      // The bridge silhouette, via the same bounds helper the exporter itself
      // calls for its own page-sizing.
      const geometry = bridgeDrawing.getBridgeDrawingGeometry(neck, bridge);
      for (const point of bridgeDrawing.bridgeDrawingBoundsPoints(geometry)) {
        at(point.x, point.y, 'the bridge silhouette');
      }

      // The theoretical (uncompensated) scale-length reference line.
      at(0, scaleMath.getTheoreticalSaddleYMm(neck), 'the scale-length reference line');

      // Mounting points, if this bridge preset has any.
      const mountingOriginY = scaleMath.getMountingPointOriginYMm(neck, bridge);
      for (const pt of bridge.mountingPoints ?? []) {
        at(pt.x, mountingOriginY + pt.y, 'a bridge mounting point');
      }

      // Pickup routs, by the diagonal reach around their own centre - the
      // same conservative bound getContentBoundsMm uses, so any rotation
      // angle stays covered.
      for (const p of project.pickups ?? []) {
        const spec = presets.resolvePickupSpec(p);
        const reach = Math.hypot(spec.widthMm, spec.heightMm) / 2;
        at(p.offsetXMm - reach, p.offsetYMm - reach, `pickup ${p.id}`);
        at(p.offsetXMm + reach, p.offsetYMm + reach, `pickup ${p.id}`);
      }
    }

    check('a baseline guitar export has no clipping, in both orientations (regression baseline)', () => {
      const project = { ...baseline, contour: undersizedContour, pickups: [], pickguards: [], frontRoutes: [], backRoutes: [] };
      for (const orientation of ['vertical', 'horizontal'] as const) {
        assertNoClipping(
          { ...project, settings: { ...project.settings, canvasOrientation: orientation } },
          `guitar/${orientation}`
        );
      }
    });

    for (const neck of bassNecks) {
      check(`${neck.id} x bass_vintage_plate: no clipping in either orientation`, () => {
        const project = {
          ...bassProject,
          contour: undersizedContour,
          // bassProject inherits s_style's own pickguard/routes via ...baseline
          // (bassProject itself only clears `pickups`) - a real S-style
          // pickguard reaches far enough down the body to mask exactly the
          // gap this check exists to catch, which is how the first version
          // of this check passed against a deliberately broken exporter.
          pickguards: [],
          frontRoutes: [],
          backRoutes: [],
          ...presets.neckPresetFieldsForTemplate(neck.id, 'p_bass_style', 'bolt_on', 'bass'),
        };
        for (const orientation of ['vertical', 'horizontal'] as const) {
          assertNoClipping(
            { ...project, settings: { ...project.settings, canvasOrientation: orientation } },
            `${neck.id}/${orientation}`
          );
        }
      });
    }

    check('the calibration box is on the page for every scale, both orientations', () => {
      // Structurally guaranteed rather than instrument-dependent - the info
      // band is appended in page space (INFO_BAND_MM, never rotated) and the
      // page width is floored at MIN_PAGE_WIDTH_MM regardless of content -
      // but asserted here as a checked fact rather than left as an
      // unverified property of the source.
      for (const neck of [...bassNecks, presets.resolveNeckPreset(baseline)]) {
        for (const orientation of ['vertical', 'horizontal'] as const) {
          const project = {
            ...bassProject,
            pickguards: [],
            frontRoutes: [],
            backRoutes: [],
            ...presets.neckPresetFieldsForTemplate(neck.id, 'p_bass_style', 'bolt_on', 'bass'),
            settings: { ...bassProject.settings, canvasOrientation: orientation },
          };
          const svg = exporter.exportProjectToSVG(project);
          const box = parseViewBox(svg);
          const match = svg.match(/CALIBRATION BOX[\s\S]*?<\/g>/);
          invariant(match, `${neck.id}/${orientation}: no calibration box in the export`);
          // The box's own translate() origin, read back out of the markup.
          const originMatch = svg.match(/<g transform="translate\(([-\d.]+), ([-\d.]+)\)">\s*<rect x="0" y="0" width="100" height="100"/);
          invariant(originMatch, `${neck.id}/${orientation}: calibration rect not found`);
          const [ox, oy] = originMatch!.slice(1).map(Number);
          const c = containedIn(box);
          c(ox, oy, `${neck.id}/${orientation}: calibration box top-left`);
          c(ox + 100, oy + 100, `${neck.id}/${orientation}: calibration box bottom-right`);
        }
      }
    });

    console.log('output is type-aware, and instrument travels to the 3D viewer link');

    check('default project names add Custom exactly once', () => {
      deepStrictEqual(projectNaming.projectNameFromTemplate('S-Style Standard'), 'Custom S-Style Standard');
      deepStrictEqual(
        projectNaming.projectNameFromTemplate('Custom P-Style Bass Blueprint'),
        'Custom P-Style Bass Blueprint'
      );
      deepStrictEqual(projectNaming.projectNameFromTemplate('custom one-off'), 'custom one-off');
      deepStrictEqual(projectNaming.projectNameFromTemplate('Customizer'), 'Custom Customizer');
    });

    check('the exported SVG names the instrument, not a hardcoded "Guitar"', () => {
      const guitarSVG = exporter.exportProjectToSVG(baseline);
      invariant(guitarSVG.includes('<!-- Guitar Geometry Group -->'), 'guitar export lost its label');
      const bassSVG = exporter.exportProjectToSVG(bassProject);
      invariant(bassSVG.includes('<!-- Bass Geometry Group -->'), 'bass export still says Guitar');
      invariant(!bassSVG.includes('<!-- Guitar Geometry Group -->'), 'bass export contains a stray guitar label');
    });

    check('a saved filename differs by blueprint, not by a hardcoded instrument word', () => {
      // buildProjectFilename takes only the project name, which is already
      // blueprint-derived ("Custom P-Style Bass" vs "Custom S-Style
      // Standard") - type-aware by construction, verified rather than
      // assumed. No separate "insert the instrument into the filename" logic
      // exists or is needed.
      const guitarName = exporter.buildProjectFilename(baseline.settings.name);
      const bassName = exporter.buildProjectFilename(bassProject.settings.name);
      invariant(guitarName.startsWith('s-style-standard-'), `unexpected guitar filename: ${guitarName}`);
      invariant(bassName.startsWith('synthetic-bass'), `unexpected bass filename: ${bassName}`);
    });

    check('instrumentType and stringCount reach the 3D viewer link unchanged', () => {
      // buildViewer3DPath just deflates the whole serialized project
      // (viewer3dLink.ts), so this is close to free - verified rather than
      // assumed, since "nearly free" is exactly the kind of claim worth a
      // test. withEmbeddedPresets is what App.tsx's handleView3D actually
      // calls before building the link.
      const embedded = presets.withEmbeddedPresets(bassProject);
      deepStrictEqual(embedded.instrumentType, 'bass');
      deepStrictEqual(embedded.stringCount, 4);
      const decompressed = JSON.parse(JSON.stringify(embedded));
      deepStrictEqual(decompressed.instrumentType, 'bass');
      deepStrictEqual(decompressed.stringCount, 4);
    });

    check('blueprint binding reaches the 3D viewer link unchanged', () => {
      // App.tsx passes withEmbeddedPresets(project) directly to
      // buildViewer3DPath. Guard the two blueprints whose authored default is
      // top-only binding, so a template-to-project regression cannot quietly
      // remove the detail before the viewer sees it.
      for (const id of ['single_cut', 'r_bass_style']) {
        const blueprint = decodePayload(join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`));
        deepStrictEqual(blueprint.binding, { appliesTo: 'top_only' }, `${id} blueprint has the wrong binding`);
        deepStrictEqual(
          presets.withEmbeddedPresets(blueprint).binding,
          blueprint.binding,
          `${id} binding was lost before the viewer link`
        );
      }
    });

    console.log('golden corpus');

    check('the scale matrix covers every bass neck x bass bridge pairing', () => {
      const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
      const rows = new Set(
        corpus.scaleMathMatrix.map((r: any) => `${r.neckPresetId} x ${r.bridgePresetId}`)
      );
      for (const neck of bassNecks) {
        for (const bridge of bassBridges) {
          invariant(rows.has(`${neck.id} x ${bridge.id}`), `${neck.id} x ${bridge.id} is missing from the corpus`);
        }
      }
    });

    check('the corpus pairs no bass neck with a guitar bridge, or the reverse', () => {
      const corpus = JSON.parse(readFileSync(CORPUS, 'utf8'));
      for (const row of corpus.scaleMathMatrix) {
        const neckInstrument = instrument.neckPresetInstrument(row.neckPresetId);
        const bridgeInstrument = instrument.bridgePresetInstrument(row.bridgePresetId);
        invariant(
          neckInstrument === bridgeInstrument,
          `${row.neckPresetId} (${neckInstrument}) is paired with ${row.bridgePresetId} (${bridgeInstrument})`
        );
      }
    });

    check('every bass master retains its approved theoretical scale line and bridge', () => {
      const expected: Record<string, { scaleLineMm: number; bridgeId: string }> = {
        p_bass_style: { scaleLineMm: 365, bridgeId: 'bass_vintage_plate' },
        j_bass_style: { scaleLineMm: 365, bridgeId: 'bass_vintage_plate' },
        mm_bass_style: { scaleLineMm: 350, bridgeId: 'bass_vintage_plate' },
        r_bass_style: { scaleLineMm: 290, bridgeId: 'bass_r_style_plate' },
        thunderbird_bass_style: { scaleLineMm: 412, bridgeId: 'bass_vintage_plate' },
        mustang_bass_style: { scaleLineMm: 346, bridgeId: 'bass_vintage_plate' },
        sg_bass_style: { scaleLineMm: 340, bridgeId: 'bass_vintage_plate' },
        streamer_bass_style: { scaleLineMm: 315, bridgeId: 'bass_vintage_plate' },
      };
      for (const [id, target] of Object.entries(expected)) {
        const raw = readFileSync(join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`), 'utf8');
        const encoded = raw.match(/<project:data>([\s\S]*?)<\/project:data>/)?.[1];
        invariant(encoded, `${id}: no project payload`);
        const project = JSON.parse(Buffer.from(encoded!.trim(), 'base64').toString('utf8'));
        invariant(project.bridgePresetId === target.bridgeId, `${id}: bridge is ${project.bridgePresetId}`);
        const theoretical = scaleMath.getTheoreticalSaddleYMm(project.neckPreset);
        invariant(
          Math.abs(theoretical - target.scaleLineMm) < 1e-6,
          `${id}: theoretical saddle Y is ${theoretical}, expected ${target.scaleLineMm}`
        );
        invariant(
          Math.abs(scaleMath.getSaddleYMm(project.neckPreset, project.bridgePreset) - (target.scaleLineMm + 3.2)) < 1e-6,
          `${id}: treble compensation is not being applied`
        );
      }
      const rStyle = JSON.parse(Buffer.from(readFileSync(join(ROOT, 'src', 'constants', 'blueprints', 'r_bass_style.axe.svg'), 'utf8').match(/<project:data>([\s\S]*?)<\/project:data>/)![1].trim(), 'base64').toString('utf8'));
      const rStyleJointAnchors = rStyle.contour.anchors.filter((anchor: { id: string }) => anchor.id === 's_pocket_left' || anchor.id === 's_pocket_right');
      invariant(rStyleJointAnchors.length === 2 && rStyleJointAnchors.every((anchor: { position: { y: number } }) => anchor.position.y === 0), 'R-style joint anchors must remain at Y=0');
      invariant(rStyleJointAnchors.find((anchor: { id: string }) => anchor.id === 's_pocket_left')?.position.x === -20, 'R-style left joint anchor must remain at X=-20');
      invariant(rStyleJointAnchors.find((anchor: { id: string }) => anchor.id === 's_pocket_right')?.position.x === 20, 'R-style right joint anchor must remain at X=20');
      invariant(Math.abs(rStyle.contour.anchors.find((anchor: { id: string }) => anchor.id === 's_tail_center').position.y - 375.0001219913025) < 1e-6, 'R-style contour was not shifted 78mm toward the joint');
      invariant(Math.abs(rStyle.pickups[0].offsetYMm - 62.161983286631965) < 1e-6, 'R-style neck pickup was not shifted 78mm toward the joint');
      invariant(Math.abs(rStyle.pickups[1].offsetYMm - 181.86731580326693) < 1e-6, 'R-style bridge pickup was not shifted 78mm toward the joint');
      invariant(Math.abs(rStyle.pickguards[0].contour.anchors[0].position.y - 16.049278064377972) < 1e-6, 'R-style pickguard was not shifted 78mm toward the joint');
      invariant(Math.abs(rStyle.frontRoutes[0].contour.anchors[0].position.y - 152.14868899439634) < 1e-6, 'R-style front route was not shifted 78mm toward the joint');
      invariant(rStyle.frontRoutes.length === 1, 'R-style bridge marker still exists as a front route');
      invariant(rStyle.bridgePreset.outlineMm?.length === 4, 'R-style tapered bridge outline was not embedded');
      const legacyRBridge = presets.resolveBridgePreset({
        bridgePresetId: 'bass_r_style_plate',
        bridgePreset: { ...rStyle.bridgePreset, outlineMm: undefined },
      });
      invariant(legacyRBridge.outlineMm?.length === 4, 'legacy R-style projects still resolve to a rectangular bridge');
    });
  } finally {
    await server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nBass hardware foundations hold.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
