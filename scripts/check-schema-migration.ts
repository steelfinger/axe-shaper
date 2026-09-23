/**
 * The current schema contract: the instrument axis, visible controls, the
 * migration of older files, and the two gates that keep a payload this build does not
 * understand out of the editable project path.
 *
 * Cases are built in memory from the bundled s_style blueprint rather than
 * committed as fixture files, because three of them are payloads this app
 * cannot produce (a version 1 file, a future-version file, a Bass/6 file) and
 * a committed file that no writer can write is a file nobody can regenerate.
 * The cross-platform fixture corpus is a separate, later job (milestone W7);
 * this script is the local contract test.
 *
 * Usage:
 *   npm run schema:check
 *
 * Modules are loaded through Vite's SSR pipeline for the same reason as
 * generate-golden-corpus.ts, and payloads are scanned by string match rather
 * than through extractProjectFromSVG, which needs a DOMParser Node lacks.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINT_DIR = join(ROOT, 'src', 'constants', 'blueprints');
const BASE_BLUEPRINT = join(BLUEPRINT_DIR, 's_style.axe.svg');

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

function decodePayload(svg: string): any {
  const match = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  invariant(match, 'no <project:data> element');
  return JSON.parse(Buffer.from(match![1].trim(), 'base64').toString('utf8'));
}

function metadataElement(svg: string, name: string): string | null {
  return svg.match(new RegExp(`<project:${name}>([^<]*)</project:${name}>`))?.[1] ?? null;
}

/** Everything except the fields schema version 3 adds and the version stamp itself. */
function withoutInstrumentAxis(project: any): any {
  const { instrumentType: _type, stringCount: _count, schemaVersion: _version, ...rest } = project;
  return rest;
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
    const instrument = await load('/src/utils/instrument.ts');
    const schema = await load('/src/constants/schema.ts');
    const exporter = await load('/src/utils/svgExporter.ts');
    const userTemplates = await load('/src/utils/userTemplates.ts');
    const hardware = await load('/src/constants/hardware.ts');
    const templates = await load('/src/constants/templates.ts');
    const projectFactory = await load('/src/utils/projectFactory.ts');
    const bodyThickness = await load('/src/utils/bodyThickness.ts');
    const controls = await load('/src/utils/controlEditing.ts');

    const currentBlueprint = decodePayload(readFileSync(BASE_BLUEPRINT, 'utf8'));
    // Strict equality against each blueprint's *own* answer, not a range and
    // not PROJECT_SCHEMA_VERSION. The bundled blueprints are what this build
    // writes, so each must carry the lowest version that can represent it
    // (`requiredSchemaVersion`) - which is 4 for sixteen of them and 5 only
    // for single_cut, prs_style and semi_hollow_double_cut, the three with a bodyTop. Accepting any supported version
    // here is how one quietly stays behind until the difference shows up as a
    // field the app injects but the file lacks; accepting only the newest is
    // how the stamping rule silently reverts.
    // Remedy: npx tsx scripts/refresh-blueprint-presets.ts
    const bundledBlueprints = readdirSync(BLUEPRINT_DIR)
      .filter((file) => file.endsWith('.axe.svg'))
      .sort();
    invariant(bundledBlueprints.length === 19, `expected 19 bundled blueprints, found ${bundledBlueprints.length}`);
    const misstamped = bundledBlueprints
      .map((file) => ({ file, payload: decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8')) }))
      .filter(({ payload }) => payload.schemaVersion !== schema.requiredSchemaVersion(payload))
      .map(({ file, payload }) => (
        `${file} (says ${payload.schemaVersion}, needs ${schema.requiredSchemaVersion(payload)})`
      ));
    invariant(
      misstamped.length === 0,
      `every bundled blueprint must carry the lowest version that can represent it; wrong: ${misstamped.join(', ')}`
        + ' - re-export the bundled blueprints (npx tsx scripts/refresh-blueprint-presets.ts)'
    );

    // The rule is only worth anything if the set actually spans versions: a
    // day when every blueprint happens to use a version 5 field would make
    // the check above pass while proving nothing about stamping down.
    const bundledVersions = new Set(bundledBlueprints.map((file) => (
      decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8')).schemaVersion
    )));
    invariant(
      bundledVersions.size > 1,
      `the bundled blueprints are all at schema ${[...bundledVersions][0]}, so they no longer demonstrate`
        + ' version-on-demand stamping - add a blueprint that uses no version 5 field, or drop this check'
    );

    // Production blueprints now carry schema-v4 controls, so derive the
    // historical v2 shape explicitly instead of requiring the shipped assets
    // to remain frozen at an obsolete version just to exercise migration.
    const {
      instrumentType: _instrumentType,
      stringCount: _stringCount,
      potentiometers: _potentiometers,
      switches: _switches,
      ...withoutV3AndV4Fields
    } = currentBlueprint;
    const {
      showControls: _showControls,
      snapToGridEnabled: _snapToGridEnabled,
      ...v2Settings
    } = withoutV3AndV4Fields.settings;
    const v2 = {
      ...withoutV3AndV4Fields,
      schemaVersion: 2,
      settings: v2Settings,
    };

    console.log('version 2 -> current (the bundled blueprints and every existing save)');

    check('migrates to a Guitar/6 project at version 3, not at the newest version', () => {
      const migrated = presets.migrateProject(v2);
      // 3, not PROJECT_SCHEMA_VERSION: the backfill adds version 3's fields
      // and nothing above them, so 3 is what the result actually is. This
      // fixture has its potentiometers and switches stripped above and no
      // bodyTop, which is the whole point - a file that uses none of the
      // newer fields must stay openable by a build that predates them.
      deepStrictEqual(migrated.schemaVersion, schema.BASE_SCHEMA_VERSION);
      deepStrictEqual(migrated.instrumentType, 'guitar');
      deepStrictEqual(migrated.stringCount, 6);
    });

    check('changes nothing else - same geometry, same hardware, same settings', () => {
      const migrated = presets.migrateProject(v2);
      deepStrictEqual(withoutInstrumentAxis(migrated), {
        ...withoutInstrumentAxis(v2),
        // The one pre-existing exception to "loading is a no-op", unchanged by
        // version 3: a placement saved before `anchors` existed is backfilled
        // with its type's real catalogue rout (see resolvePickupSpec).
        pickups: presets.withEmbeddedPickupSpecs(v2.pickups ?? []),
      });
    });

    console.log('version 5: optional body-top construction');

    check('preserves the flat top when a legacy payload has no bodyTop field', () => {
      const migrated = presets.migrateProject(v2);
      invariant(migrated.bodyTop === undefined, 'migration added a body-top construction to a legacy plan');
    });

    check('round-trips a named body-top construction without adding raw carve controls', () => {
      const arched = {
        ...presets.migrateProject(v2),
        bodyTop: { construction: 'carved_cap' },
      };
      const reloaded = presets.migrateProject(decodePayload(exporter.exportProjectToSVG(arched)));
      deepStrictEqual(reloaded.bodyTop, { construction: 'carved_cap' });
      invariant(!('riseMm' in reloaded.bodyTop), 'the document stored a renderer-specific rise value');
    });

    console.log('version 1 -> current (ids only, no embedded hardware)');

    // A real version 1 payload: preset ids, no embedded copies, no instrument
    // axis. This app has not written one since schema version 2 shipped.
    const v1 = (() => {
      const { neckPreset: _neckPreset, bridgePreset: _bridgePreset, ...rest } = v2;
      return { ...rest, schemaVersion: 1 };
    })();

    check('backfills the embedded hardware from the ids', () => {
      const migrated = presets.migrateProject(v1);
      deepStrictEqual(migrated.neckPreset?.id, v1.neckPresetId);
      deepStrictEqual(migrated.bridgePreset?.id, v1.bridgePresetId);
    });

    check('lands on the same Guitar/6 project a version 2 file does', () => {
      const fromV1 = presets.migrateProject(v1);
      const fromV2 = presets.migrateProject(v2);
      deepStrictEqual(fromV1.instrumentType, fromV2.instrumentType);
      deepStrictEqual(fromV1.stringCount, fromV2.stringCount);
      deepStrictEqual(fromV1.contour, fromV2.contour);
      // The version 1 file's hardware is resolved from this build's table;
      // the version 2 file's is its own embedded copy. For a bundled
      // blueprint naming known ids those are the same measurements, which is
      // what makes the two files semantically identical.
      deepStrictEqual(fromV1.neckPreset, fromV2.neckPreset);
      deepStrictEqual(fromV1.bridgePreset, fromV2.bridgePreset);
    });

    console.log('Bass/4 (synthetic - no bass blueprint exists until milestone W6)');

    // Deliberately reuses the S-style contour: this asserts that the
    // instrument axis survives a round trip, not that the body is a
    // plausible bass. Real bass geometry arrives with the bass hardware.
    const bass = {
      ...presets.migrateProject(v2),
      instrumentType: 'bass',
      stringCount: 4,
      settings: { ...v2.settings, name: 'Synthetic Bass/4' },
    };

    check('round-trips through a save without changing type, count or geometry', () => {
      const written = exporter.exportProjectToSVG(bass);
      const reloaded = presets.migrateProject(decodePayload(written));
      deepStrictEqual(reloaded.instrumentType, 'bass');
      deepStrictEqual(reloaded.stringCount, 4);
      deepStrictEqual(reloaded.contour, bass.contour);
      deepStrictEqual(reloaded, bass);
    });

    check('the metadata elements mirror the payload rather than restating a default', () => {
      const written = exporter.exportProjectToSVG(bass);
      deepStrictEqual(metadataElement(written, 'instrumentType'), 'bass');
      deepStrictEqual(metadataElement(written, 'stringCount'), '4');
      deepStrictEqual(metadataElement(written, 'schemaVersion'), String(schema.requiredSchemaVersion(bass)));
    });

    check('a version 2 payload saved now is stamped Guitar/6 in both places', () => {
      const written = exporter.exportProjectToSVG(v2);
      deepStrictEqual(metadataElement(written, 'instrumentType'), 'guitar');
      deepStrictEqual(metadataElement(written, 'stringCount'), '6');
      deepStrictEqual(decodePayload(written).instrumentType, 'guitar');
      deepStrictEqual(decodePayload(written).stringCount, 6);
    });

    console.log('rejections');

    const rejects = (label: string, payload: any, reason: string) =>
      check(label, () => {
        const result = presets.loadProject(payload);
        invariant(result.ok === false, 'the payload was accepted into the editable project path');
        deepStrictEqual(result.reason, reason);
        invariant(result.message.length > 0, 'the refusal carried no message to show');
        let threw = false;
        try {
          presets.migrateProject(payload);
        } catch (error) {
          threw = error instanceof presets.UnsupportedProjectError;
        }
        invariant(threw, 'migrateProject accepted a payload loadProject refused');
      });

    // The gate that did not exist before version 3: migrateProject stamped
    // PROJECT_SCHEMA_VERSION unconditionally, so a future payload was
    // previously accepted, editable, and written back as an older version.
    rejects(
      'a future schema version cannot enter the editable project path',
      { ...v2, schemaVersion: schema.PROJECT_SCHEMA_VERSION + 1 },
      'unsupported-version'
    );
    rejects(
      'a known instrument with an unsupported string count is refused (Bass/6)',
      { ...v2, schemaVersion: 3, instrumentType: 'bass', stringCount: 6 },
      'unsupported-instrument'
    );
    rejects(
      'a known instrument with an unsupported string count is refused (Guitar/4)',
      { ...v2, schemaVersion: 3, instrumentType: 'guitar', stringCount: 4 },
      'unsupported-instrument'
    );
    rejects(
      'an unrecognised instrument type is refused rather than treated as a guitar',
      { ...v2, schemaVersion: 3, instrumentType: 'ukulele', stringCount: 4 },
      'unsupported-instrument'
    );

    check('decoding preserves an unknown instrument verbatim; only editing is refused', () => {
      // The two halves of "decode tolerantly, refuse to edit". A save of such
      // a payload still round-trips the value it did not understand, and the
      // refusal happens at the edit door rather than at the parser.
      const unknown = { ...v2, schemaVersion: 3, instrumentType: 'ukulele', stringCount: 4 };
      const written = exporter.exportProjectToSVG(unknown);
      deepStrictEqual(decodePayload(written).instrumentType, 'ukulele');
      deepStrictEqual(metadataElement(written, 'instrumentType'), 'ukulele');
      deepStrictEqual(presets.loadProject(decodePayload(written)).ok, false);
    });

    check('a payload that is not a project at all is refused', () => {
      deepStrictEqual(presets.loadProject(null).ok, false);
      deepStrictEqual(presets.loadProject({ schemaVersion: 3 } as any).ok, false);
    });

    console.log('supported matrix and default-when-absent reads');

    check('the supported matrix is Guitar/6 and Bass/4', () => {
      deepStrictEqual(instrument.SUPPORTED_STRING_COUNTS, { guitar: [6], bass: [4] });
      deepStrictEqual(instrument.defaultStringCount('guitar'), 6);
      deepStrictEqual(instrument.defaultStringCount('bass'), 4);
    });

    check('an untagged user template reads as Guitar/6', () => {
      deepStrictEqual(userTemplates.userTemplateInstrument({}), { instrumentType: 'guitar', stringCount: 6 });
      deepStrictEqual(userTemplates.userTemplateInstrument({ instrumentType: 'bass' }), {
        instrumentType: 'bass',
        stringCount: 4,
      });
      // Nothing validated localStorage on the way in, so a nonsense value is
      // defaulted rather than trusted.
      deepStrictEqual(userTemplates.userTemplateInstrument({ instrumentType: 'ukulele' as any }), {
        instrumentType: 'guitar',
        stringCount: 6,
      });
    });

    check('every catalogue id declares an instrument', () => {
      // Guards the corpus pairing filter and every future picker: an id with
      // no compatibility entry pairs with everything, which is the safe
      // default for an unknown *file's* id but a bug for a catalogue entry.
      const missing = [
        ...Object.keys(hardware.NECK_PRESETS).filter((id) => !hardware.NECK_PRESET_INSTRUMENT[id]),
        ...Object.keys(hardware.CURATED_NECK_PRESETS).filter((id) => !hardware.NECK_PRESET_INSTRUMENT[id]),
        ...Object.keys(hardware.BRIDGE_PRESETS).filter((id) => !hardware.BRIDGE_PRESET_INSTRUMENT[id]),
        ...Object.keys(hardware.PICKUP_SPECIFICATIONS).filter((t) => !hardware.PICKUP_TYPE_INSTRUMENT[t]),
      ];
      invariant(missing.length === 0, `no instrument declared for: ${missing.join(', ')}`);
    });

    console.log('blueprint-authored body thickness');

    check('the SG template retains its authored 35mm thickness', () => {
      deepStrictEqual(templates.REFERENCE_TEMPLATES.sg_style.bodyThicknessMm, 35);
    });

    check('a new SG project carries 35mm into the editable document', () => {
      const project = projectFactory.createProject({
        templateId: 'sg_style',
        now: () => new Date('2026-01-01T00:00:00.000Z'),
      });
      deepStrictEqual(project.bodyThicknessMm, 35);
      deepStrictEqual(bodyThickness.resolvedBodyThickness(project), 35);
    });

    check('thickness survives a project save and legacy files still preview at 45mm', () => {
      const project = projectFactory.createProject({ templateId: 'sg_style' });
      const written = exporter.exportProjectToSVG(project);
      deepStrictEqual(decodePayload(written).bodyThicknessMm, 35);
      deepStrictEqual(
        bodyThickness.resolvedBodyThickness({ bodyThicknessMm: undefined }),
        bodyThickness.FALLBACK_BODY_THICKNESS_MM
      );
      deepStrictEqual(bodyThickness.FALLBACK_BODY_THICKNESS_MM, 45);
    });

    console.log('visible controls');

    check('new projects copy the blueprint control collections', () => {
      const project = projectFactory.createProject({ templateId: 's_style' });
      deepStrictEqual(project.potentiometers, templates.REFERENCE_TEMPLATES.s_style.defaultPotentiometers);
      deepStrictEqual(project.switches, templates.REFERENCE_TEMPLATES.s_style.defaultSwitches);
      invariant(project.potentiometers.length > 0, 'the bundled S-style blueprint has no potentiometers');
      invariant(project.switches.length > 0, 'the bundled S-style blueprint has no switch');
    });

    check('new potentiometers use a 24mm body and generic knob appearance', () => {
      const project = {
        ...projectFactory.createProject({ templateId: 's_style' }),
        potentiometers: [],
        switches: [],
      };
      const added = controls.addingPotentiometer(project);
      deepStrictEqual(added.selection.kind, 'potentiometer');
      deepStrictEqual(added.project.potentiometers.length, 1);
      deepStrictEqual(added.project.potentiometers[0].bodyDiameterMm, 24);
      deepStrictEqual(added.project.potentiometers[0].knobStyleId, 'generic');
    });

    check('both switch families are freely placeable and editable', () => {
      const project = {
        ...projectFactory.createProject({ templateId: 's_style' }),
        potentiometers: [],
        switches: [],
      };
      const gibson = controls.addingSwitch(project, 'gibson_toggle');
      const fender = controls.addingSwitch(gibson.project, 'fender_blade');
      const moved = controls.movingSwitch(fender.project, fender.selection.id, { x: 72, y: 245 });
      const rotated = controls.settingSwitchAngle(moved, fender.selection.id, 35);
      const selector = rotated.switches.find((item: any) => item.id === fender.selection.id);
      deepStrictEqual(selector.type, 'fender_blade');
      deepStrictEqual(selector.position, { x: 72, y: 245 });
      deepStrictEqual(selector.angleDegrees, 35);
      deepStrictEqual(rotated.switches[0].type, 'gibson_toggle');
    });

    check('controls survive SVG save/reload and produce visible SVG groups', () => {
      let project = {
        ...projectFactory.createProject({ templateId: 's_style' }),
        potentiometers: [],
        switches: [],
      };
      project = controls.addingPotentiometer(project).project;
      project = controls.addingSwitch(project, 'fender_blade').project;
      const written = exporter.exportProjectToSVG(project);
      const payload = decodePayload(written);
      deepStrictEqual(payload.potentiometers, project.potentiometers);
      deepStrictEqual(payload.switches, project.switches);
      invariant(written.includes('id="control-knobs"'), 'print SVG omitted the knob group');
      invariant(written.includes('id="control-switches"'), 'print SVG omitted the switch group');
      invariant(written.includes('data-switch-type="fender_blade"'), 'print SVG omitted the blade drawing');
      invariant(written.includes('r="12.00" class="control-body"'), 'print SVG omitted the 24mm pot body');
      invariant(written.includes('r="10.00" class="control-outline"'), 'print SVG omitted the 20mm knob');
      invariant(written.includes('r="4.50" class="control-outline"'), 'print SVG omitted the 9mm shaft hole');
      invariant(written.includes('.control-outline { fill: none;'), 'print SVG controls are not outline-only');
      invariant(written.includes('.control-cap { fill: none;'), 'print SVG switch caps are not outline-only');
    });

    console.log('\nversion-on-demand stamping');

    // The rule: a save carries the lowest version that can represent the
    // document, never the newest version this build knows. It exists because
    // the two implementations ship on different clocks - the web deploys in
    // minutes, the iPad app waits on App Store review - so an unconditional
    // stamp makes every file saved on the newer side unopenable on the older
    // one, including files that use none of the new fields.
    const plain = {
      ...projectFactory.createProject({ templateId: 's_style' }),
      potentiometers: [],
      switches: [],
      bodyTop: undefined,
    };

    const savedVersion = (project: any) => decodePayload(exporter.exportProjectToSVG(project)).schemaVersion;

    check('a project using no version 4 or 5 field saves at version 3', () => {
      deepStrictEqual(savedVersion(plain), 3);
      deepStrictEqual(metadataElement(exporter.exportProjectToSVG(plain), 'schemaVersion'), '3');
    });

    check('placing a control lifts the stamp to 4, and removing it drops back to 3', () => {
      const withPot = controls.addingPotentiometer(plain).project;
      deepStrictEqual(savedVersion(withPot), 4);
      deepStrictEqual(savedVersion(controls.addingSwitch(plain, 'gibson_toggle').project), 4);
      // Dropping back matters as much as climbing: a document that loses its
      // controls has no version 4 content left, and keeping the stamp would
      // hold it hostage to a build it no longer needs.
      deepStrictEqual(savedVersion({ ...withPot, potentiometers: [] }), 3);
    });

    check('an arched top lifts the stamp to 5 regardless of what it loaded as', () => {
      deepStrictEqual(savedVersion({ ...plain, bodyTop: { construction: 'carved_cap' } }), 5);
      deepStrictEqual(savedVersion({ ...plain, bodyTop: { construction: 'solid_body_carve' } }), 5);
      // The editor's own case: loaded as 3, an arched top chosen, saved. The
      // in-memory stamp is stale by then, so the version has to be computed
      // on the way out rather than carried.
      const loaded = presets.migrateProject(v2);
      deepStrictEqual(loaded.schemaVersion, 3);
      deepStrictEqual(savedVersion({ ...loaded, bodyTop: { construction: 'carved_cap' } }), 5);
    });

    check('the single_cut blueprint is the one bundled file that needs version 5', () => {
      const singleCut = decodePayload(readFileSync(join(BLUEPRINT_DIR, 'single_cut.axe.svg'), 'utf8'));
      deepStrictEqual(singleCut.schemaVersion, 5);
      invariant(singleCut.bodyTop, 'single_cut no longer carries a bodyTop, so it is no longer the version 5 witness');
      const sStyle = decodePayload(readFileSync(BASE_BLUEPRINT, 'utf8'));
      deepStrictEqual(sStyle.schemaVersion, 4);
    });

    check('re-saving an untouched file does not move its version', () => {
      // The failure this guards against is a save that quietly upgrades a
      // document nobody edited - the exact way an unconditional stamp spreads
      // a new version across a library.
      for (const file of readdirSync(BLUEPRINT_DIR).filter((f) => f.endsWith('.axe.svg')).sort()) {
        const payload = decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8'));
        deepStrictEqual(savedVersion(presets.migrateProject(payload)), payload.schemaVersion, file);
      }
    });

    check('a payload newer than this build keeps its own version through an export', () => {
      // migrateProject refuses it, but exportProjectToSVG is reachable
      // without it. Stamping such a payload down would describe a file as
      // something this build cannot actually vouch for.
      const future = { ...v2, schemaVersion: schema.PROJECT_SCHEMA_VERSION + 1 };
      deepStrictEqual(savedVersion(future), schema.PROJECT_SCHEMA_VERSION + 1);
    });
  } finally {
    await server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nCurrent schema contract holds.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
