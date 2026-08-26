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
    const exporter = await load('/src/utils/svgExporter.ts');

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

    check('bass scale math lands where the fret-17 joint convention says', () => {
      // Guards the whole chain - scale length, nutToBodyEdgeMm and the
      // bridge's own compensation - against a silent regression in any link.
      const neck = bassNecks.find((n: any) => n.id === 'bass_long_34');
      const bridge = bassBridges.find((b: any) => b.id === 'bass_vintage_plate');
      const theoretical = scaleMath.getTheoreticalSaddleYMm(neck);
      invariant(
        Math.abs(theoretical - 323.4845) < 1e-3,
        `34" bass theoretical saddle Y is ${theoretical}, expected ~323.4845`
      );
      const saddle = scaleMath.getSaddleYMm(neck, bridge);
      invariant(Math.abs(saddle - (theoretical + 3.2)) < 1e-9, 'treble compensation is not being applied');
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
