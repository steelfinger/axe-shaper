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
import { deepStrictEqual, throws } from 'node:assert';
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
    const manifest = await load('/src/constants/blueprintManifest.ts');
    const templates = await load('/src/constants/templates.ts');
    const projectFactory = await load('/src/utils/projectFactory.ts');
    const bodyThickness = await load('/src/utils/bodyThickness.ts');
    const controls = await load('/src/utils/controlEditing.ts');
    const neckJoint = await load('/src/utils/neckJointGeometry.ts');

    const currentBlueprint = decodePayload(readFileSync(BASE_BLUEPRINT, 'utf8'));
    // Strict equality against each blueprint's *own* answer, not a range and
    // not PROJECT_SCHEMA_VERSION. The bundled blueprints are what this build
    // writes, so each must carry the lowest version that can represent it
    // (`requiredSchemaVersion`) - which is 4 for sixteen of them and 5 only
    // for single_cut, prs_style and the two semi-hollows, the four with a bodyTop. Accepting any supported version
    // here is how one quietly stays behind until the difference shows up as a
    // field the app injects but the file lacks; accepting only the newest is
    // how the stamping rule silently reverts.
    // Remedy: npx tsx scripts/refresh-blueprint-presets.ts
    const bundledBlueprints = readdirSync(BLUEPRINT_DIR)
      .filter((file) => file.endsWith('.axe.svg'))
      .sort();
    invariant(bundledBlueprints.length === 20, `expected 20 bundled blueprints, found ${bundledBlueprints.length}`);
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

    // Every product-owned guitar now carries the paired v7 neck-joint and
    // placement contract. Bass pockets remain intentionally legacy pending
    // their own research, so they retain their v6 appearance-only payload.
    for (const file of bundledBlueprints) {
      const payload = decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8'));
      const expectedVersion = payload.instrumentType === 'guitar' ? 7 : 6;
      invariant(payload.schemaVersion === expectedVersion,
        `${file} must be schema ${expectedVersion}; found ${payload.schemaVersion}`);
    }

    check('blueprint appearance is encoded and new projects inherit it', () => {
      for (const id of manifest.BLUEPRINT_ORDER) {
        const payload = decodePayload(readFileSync(join(BLUEPRINT_DIR, `${id}.axe.svg`), 'utf8'));
        const created = projectFactory.createProject({ templateId: id });
        deepStrictEqual(
          {
            finishStyle: created.settings.finishStyle,
            bodyColor: created.settings.bodyColor,
          },
          {
            finishStyle: payload.settings.finishStyle,
            bodyColor: payload.settings.bodyColor,
          },
          `${id}: new project did not inherit the blueprint appearance`
        );
        deepStrictEqual(
          created.instrumentAppearance,
          payload.instrumentAppearance,
          `${id}: new project did not inherit the blueprint instrument appearance`
        );
      }
    });

    // Production blueprints now carry schema-v4 controls, so derive the
    // historical v2 shape explicitly instead of requiring the shipped assets
    // to remain frozen at an obsolete version just to exercise migration.
    const {
      instrumentType: _instrumentType,
      stringCount: _stringCount,
      instrumentAppearance: _instrumentAppearance,
      potentiometers: _potentiometers,
      switches: _switches,
      neckJointGeometry: _neckJointGeometry,
      neckPlacement: _neckPlacement,
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
      // Keep this as a genuine historical v2 fixture rather than inheriting
      // v7's compatibility mirrors from the current bundled S-style file.
      ...presets.neckPresetFields(currentBlueprint.neckPresetId),
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
    const createdSStyle = projectFactory.createProject({ templateId: 's_style' });
    const { neckJointGeometry: _plainJoint, neckPlacement: _plainPlacement, ...plainBeforeV7 } = createdSStyle;
    const plain = {
      ...plainBeforeV7,
      schemaVersion: 3,
      potentiometers: [],
      switches: [],
      bodyTop: undefined,
      instrumentAppearance: undefined,
    };

    const savedVersion = (project: any) => decodePayload(exporter.exportProjectToSVG(project)).schemaVersion;

    check('a project using no version 4, 5 or 6 field saves at version 3', () => {
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

    check('persisted instrument appearance lifts the stamp to 6', () => {
      deepStrictEqual(savedVersion({ ...plain, instrumentAppearance: {
        neckFinish: 'natural_maple', fingerboard: 'maple', fretboardBinding: false, fretboardInlay: 'dots', headstockShape: 'strat_style',
      } }), 6);
    });

    console.log('version 7: paired neck-joint geometry and placement');

    const documentedSStyleJoint = {
      mode: 'locked' as const,
      profileId: 's-style-rounded-v1',
      mechanism: 'bolt_on' as const,
      planShape: 'bolt_on_pocket' as const,
      parameters: {
        mouthWidthMm: 53.64553921225705,
        planLengthMm: 76.2,
        endCornerRadiusMm: 0,
        endTreatment: 'rounded' as const,
        endRoundnessMm: 26,
      },
      mouthAnchorIds: ['s_pocket_left', 's_pocket_right'] as [string, string],
      profileSnapshot: {
        id: 's-style-rounded-v1',
        name: 'S-style rounded',
        mechanism: 'bolt_on' as const,
        planShape: 'bolt_on_pocket' as const,
        parameters: {
          mouthWidthMm: 53.64553921225705,
          planLengthMm: 76.2,
          endCornerRadiusMm: 0,
          endTreatment: 'rounded' as const,
          endRoundnessMm: 26,
        },
        evidenceLevel: 'documented' as const,
        provenance: 'schema test fixture',
      },
    };
    const v7 = {
      ...plain,
      schemaVersion: 7,
      neckJointGeometry: documentedSStyleJoint,
      neckPlacement: {
        mode: 'blueprint' as const,
        referenceFret: 22,
        jointToReferenceFretMm: 75.2453,
        provenance: 'FINGERBOARD_OVERHANG_MM:s_style',
      },
    };

    check('requires and round-trips the paired v7 joint contract', () => {
      const migrated = presets.migrateProject(v7);
      deepStrictEqual(migrated.schemaVersion, 7);
      deepStrictEqual(migrated.neckJointGeometry, documentedSStyleJoint);
      deepStrictEqual(migrated.neckPlacement, v7.neckPlacement);
      deepStrictEqual(savedVersion(v7), 7);
      // The legacy fields survive only as output mirrors; v7 resolution uses
      // the paired fields even when a stale embedded preset disagrees.
      deepStrictEqual(migrated.neckPreset.jointWidthMm, 53.64553921225705);
      deepStrictEqual(migrated.neckPreset.nutToBodyEdgeMm,
        neckJoint.nutToBodyEdgeFromPlacement(v7.neckPlacement, migrated.neckPreset.scaleLengthMm));
      invariant(exporter.exportProjectToSVG(v7).includes('<path d="M -26.822770 0.000000'), 'v7 SVG did not render generated joint geometry');
    });

    check('custom neck placement moves only the scale-linked neck and bridge datum', () => {
      const customPlacement = neckJoint.updateCustomNeckPlacement(
        v7.neckPlacement,
        'guitar',
        v7.neckPreset.scaleLengthMm,
        v7.neckPlacement.jointToReferenceFretMm + 4,
      );
      deepStrictEqual(customPlacement.mode, 'custom');
      deepStrictEqual(customPlacement.provenance, 'user:joint-to-reference-fret');
      deepStrictEqual(customPlacement.jointToReferenceFretMm, v7.neckPlacement.jointToReferenceFretMm + 4);
      deepStrictEqual(
        neckJoint.nutToBodyEdgeFromPlacement(customPlacement, v7.neckPreset.scaleLengthMm),
        neckJoint.nutToBodyEdgeFromPlacement(v7.neckPlacement, v7.neckPreset.scaleLengthMm) - 4,
      );
      throws(
        () => neckJoint.updateCustomNeckPlacement(v7.neckPlacement, 'guitar', v7.neckPreset.scaleLengthMm, -0.1),
        /non-negative/,
      );
      throws(
        () => neckJoint.updateCustomNeckPlacement(
          v7.neckPlacement,
          'guitar',
          v7.neckPreset.scaleLengthMm,
          v7.neckPreset.scaleLengthMm * (1 - Math.pow(2, -22 / 12)),
        ),
        /nut before the body joint line/,
      );
      deepStrictEqual(
        presets.documentedBlueprintNeckPlacement({ activeTemplateId: 's_style', instrumentType: 'guitar' }),
        v7.neckPlacement,
        'blueprint reset did not restore the documented S-style datum',
      );
      deepStrictEqual(
        presets.documentedBlueprintNeckPlacement({ activeTemplateId: undefined, instrumentType: 'guitar' }),
        undefined,
        'a custom body unexpectedly received a blueprint reset datum',
      );
    });

    check('discloses only non-verified v7 neck joints in printable SVG', () => {
      const legacySvg = exporter.exportProjectToSVG(plain);
      const documentedSvg = exporter.exportProjectToSVG(v7);
      const customSvg = exporter.exportProjectToSVG({
        ...v7,
        neckJointGeometry: {
          ...documentedSStyleJoint,
          mode: 'custom' as const,
          profileId: undefined,
          profileSnapshot: undefined,
          derivedFromProfileId: documentedSStyleJoint.profileId,
        },
      });
      invariant(!legacySvg.includes('verify against the physical neck'), 'legacy SVG output gained a v7 fit disclosure');
      invariant(documentedSvg.includes('Documented neck joint — verify against the physical neck before cutting.'), 'documented v7 SVG has no fit disclosure');
      invariant(customSvg.includes('Custom neck joint — verify against the physical neck before cutting.'), 'custom v7 SVG has no fit disclosure');
    });

    check('derives a bolt-on pocket taper from neck geometry', () => {
      const neckWithTaper = {
        scaleLengthMm: 647.7,
        neckTaper: {
          nutWidthMm: 41.275,
          heelWidthMm: 55.5625,
          nutToHeelMm: 468.3125,
        },
      };
      const widths = neckJoint.deriveBoltOnPocketWidthsFromNeckTaper(
        neckWithTaper,
        v7.neckPlacement,
        76.2,
      );
      const expectedWidening = 76.2 * (55.5625 - 41.275) / 468.3125;
      invariant(Math.abs((widths.deepEndWidthMm - widths.mouthWidthMm) - expectedWidening) < 0.000000001,
        'bolt-on taper did not widen by the linear neck-taper amount');
      const taperedBoltOn = {
        ...documentedSStyleJoint,
        // The published S-style source does not establish its exact end
        // radius. Keep this taper fixture independent of that provisional
        // full-radius value.
        parameters: { ...documentedSStyleJoint.parameters, ...widths, endRoundnessMm: 20 },
        profileSnapshot: {
          ...documentedSStyleJoint.profileSnapshot,
          parameters: { ...documentedSStyleJoint.profileSnapshot.parameters, ...widths, endRoundnessMm: 20 },
        },
      };
      neckJoint.validateNeckJointGeometry(taperedBoltOn);
      const outline = neckJoint.generateNeckJointOutline(taperedBoltOn).points;
      invariant(outline[2].x > outline[1].x, 'bolt-on deep end did not widen relative to its mouth');
      invariant(outline[outline.length - 1].x < outline[0].x, 'bolt-on taper was not symmetric about the centreline');
    });

    check('round-trips the documented compound S-style pocket end in v7', () => {
      // Fender Body, Vintage Stratocaster 1962, part 019574: use the selected
      // maximum deep-end target and nominal 0.84° side angle. The open-mouth
      // 3/16 in fillets are locked body-template geometry, not this profile.
      const planLengthMm = 76.2;
      const deepEndWidthMm = 55.88;
      const mouthWidthMm = deepEndWidthMm - 2 * planLengthMm * Math.tan(0.84 * Math.PI / 180);
      const outline = neckJoint.generateCompoundBoltOnPocketPrototypeOutline({
        mouthWidthMm,
        deepEndWidthMm,
        planLengthMm,
        deepEndCornerRadiusMm: 6.35,
        deepEndArcRadiusMm: 127,
      }).points;
      invariant(Math.abs(mouthWidthMm - 53.64553921225705) < 0.000000001,
        'documented S-style mouth width was not derived from its taper');
      invariant(Math.abs(outline[0].x + mouthWidthMm / 2) < 0.000000001 && outline[0].y === 0,
        'compound pocket did not begin at the left mouth anchor');
      invariant(Math.abs(outline[1].x - mouthWidthMm / 2) < 0.000000001 && outline[1].y === 0,
        'compound pocket did not begin at the right mouth anchor');
      invariant(Math.abs(Math.max(...outline.map((point: any) => point.y)) - planLengthMm) < 0.000000001,
        'compound pocket did not retain the source plan length at its closing-arc apex');
      invariant(outline[2].x > outline[1].x && outline[2].y > 0,
        'compound pocket did not retain its straight tapered right wall');
      const leftSideEnd = outline[outline.length - 1];
      invariant(Math.abs(leftSideEnd.x + outline[2].x) < 0.000000001
        && Math.abs(leftSideEnd.y - outline[2].y) < 0.000000001,
      'compound pocket lost its mirrored straight-side construction');
      invariant(outline.length < 50,
        'compound pocket traversed the left fillet around the long arc instead of the tangent fillet');
      const compoundJoint = {
        ...documentedSStyleJoint,
        parameters: {
          mouthWidthMm,
          deepEndWidthMm,
          planLengthMm,
          endCornerRadiusMm: 6.35,
          endTreatment: 'compound' as const,
          endRoundnessMm: 127,
        },
        profileSnapshot: {
          ...documentedSStyleJoint.profileSnapshot,
          parameters: {
            mouthWidthMm,
            deepEndWidthMm,
            planLengthMm,
            endCornerRadiusMm: 6.35,
            endTreatment: 'compound' as const,
            endRoundnessMm: 127,
          },
        },
      };
      neckJoint.validateNeckJointGeometry(compoundJoint);
      deepStrictEqual(neckJoint.generateNeckJointOutline(compoundJoint).points,
        neckJoint.generateCompoundBoltOnPocketPrototypeOutline({
          mouthWidthMm, deepEndWidthMm, planLengthMm, deepEndCornerRadiusMm: 6.35, deepEndArcRadiusMm: 127,
        }).points,
      'v7 compound end diverged from the documented tangent construction');
      const reset = presets.blueprintNeckJointProfile({
        activeTemplateId: 's_style', instrumentType: 'guitar', contour: v7.contour,
      });
      invariant(reset?.parameters.endTreatment === 'compound', 'S-style blueprint reset has no compound pocket');
      const resetHalfWidth = reset!.parameters.mouthWidthMm / 2;
      const resetProject = presets.withEmbeddedPresets({
        ...v7,
        contour: {
          ...v7.contour,
          anchors: v7.contour.anchors.map((anchor: any) => anchor.id === reset!.mouthAnchorIds[0]
            ? { ...anchor, locked: true, position: { ...anchor.position, x: -resetHalfWidth, y: 0 } }
            : anchor.id === reset!.mouthAnchorIds[1]
              ? { ...anchor, locked: true, position: { ...anchor.position, x: resetHalfWidth, y: 0 } }
              : anchor),
        },
        neckJointGeometry: reset!,
      });
      invariant(resetProject.neckJointGeometry?.mode === 'locked', 'S-style blueprint reset did not produce a valid locked joint');
    });

    check('preserves a custom compound bolt-on side taper across dimension edits', () => {
      const before = {
        mouthWidthMm: 53.64553921225705,
        deepEndWidthMm: 55.88,
        planLengthMm: 76.2,
      };
      const originalTaper = neckJoint.boltOnSideTaperRadians(before);
      const after = {
        mouthWidthMm: neckJoint.boltOnMouthWidthForTaper(before, 57.1, 80),
        deepEndWidthMm: 57.1,
        planLengthMm: 80,
      };
      invariant(Math.abs(neckJoint.boltOnSideTaperRadians(after) - originalTaper) < 1e-12,
        'compound bolt-on dimension edit changed the stored side taper');
    });

    check('builds the unverified straight-end T-style product profile from the shared bolt-on stations', () => {
      const reset = presets.blueprintNeckJointProfile({
        activeTemplateId: 't_style', instrumentType: 'guitar', contour: v7.contour,
      });
      invariant(reset?.profileId === 't-style-product-straight-end-v1',
        'T-style blueprint reset did not select the product profile');
      invariant(reset.profileSnapshot?.evidenceLevel === 'unverified',
        'T-style product geometry was incorrectly labelled as source-backed');
      invariant(reset.parameters.endTreatment === 'square'
        && reset.parameters.planLengthMm === 76.2
        && reset.parameters.endCornerRadiusMm === 6.35,
      'T-style product geometry did not retain the specified straight deep edge, span, and fillets');
      invariant(reset.parameters.mouthWidthMm === 53.64553921225705
        && reset.parameters.deepEndWidthMm === 55.88,
      'T-style product geometry did not retain the S-style taper stations');
      const outline = neckJoint.generateNeckJointOutline(reset).points;
      const straightHalfWidth = reset.parameters.deepEndWidthMm! / 2 - reset.parameters.endCornerRadiusMm;
      invariant(outline.some((point: any) => Math.abs(point.y - 76.2) < 0.000000001
        && Math.abs(point.x - straightHalfWidth) < 0.000000001)
        && outline.some((point: any) => Math.abs(point.y - 76.2) < 0.000000001
          && Math.abs(point.x + straightHalfWidth) < 0.000000001),
        'T-style product geometry did not retain a straight deep edge between its corner fillets');
    });

    check('validates custom joint mouth attachments across every convertible guitar body without changing handle offsets', () => {
      const blueprints = readdirSync(BLUEPRINT_DIR)
        .filter((file) => file.endsWith('.axe.svg'))
        .filter((file) => decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8')).instrumentType === 'guitar');
      invariant(blueprints.length > 0, 'no bundled blueprints available for the mouth-width spike');
      for (const file of blueprints) {
        const project = decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8'));
        const left = project.contour.anchors.find((anchor: any) => anchor.semanticRole === 'neck_pocket_left');
        const right = project.contour.anchors.find((anchor: any) => anchor.semanticRole === 'neck_pocket_right');
        invariant(left && right && left.locked && right.locked, `${file}: missing locked neck-pocket anchors`);
        const currentWidth = right.position.x - left.position.x;
        const boltOn = project.neckJointMechanism === 'bolt_on';
        const custom = {
          mode: 'custom' as const,
          derivedFromProfileId: 'phase-0-attachment-spike',
          mechanism: boltOn ? 'bolt_on' as const : 'glued' as const,
          planShape: boltOn ? 'bolt_on_pocket' as const : 'straight_mortise' as const,
          parameters: {
            mouthWidthMm: currentWidth,
            planLengthMm: 76.2,
            endCornerRadiusMm: 0,
            endTreatment: 'square' as const,
            endRoundnessMm: 0,
            ...(boltOn ? { deepEndWidthMm: currentWidth + 2 } : {}),
          },
          mouthAnchorIds: [left.id, right.id] as [string, string],
        };
        // An unchanged width still passes through the one authoritative
        // operation. The bodies do not all have room for an arbitrary +1mm
        // widening, which is precisely what clearance validation must catch.
        const targetWidth = currentWidth;
        let resized: any;
        try {
          resized = neckJoint.setCustomNeckJointMouthWidth(custom, project.contour, targetWidth);
        } catch (error) {
          throw new Error(`${file}: ${(error as Error).message}`);
        }
        const resizedLeft = resized.contour.anchors.find((anchor: any) => anchor.id === left.id)!;
        const resizedRight = resized.contour.anchors.find((anchor: any) => anchor.id === right.id)!;
        invariant(resizedLeft.position.x === -targetWidth / 2 && resizedLeft.position.y === 0
          && resizedRight.position.x === targetWidth / 2 && resizedRight.position.y === 0,
        `${file}: mouth anchors did not move symmetrically on Y=0`);
        deepStrictEqual(resizedLeft.handleIn, left.handleIn, `${file}: left handle offset changed`);
        deepStrictEqual(resizedLeft.handleOut, left.handleOut, `${file}: left handle offset changed`);
        deepStrictEqual(resizedRight.handleIn, right.handleIn, `${file}: right handle offset changed`);
        deepStrictEqual(resizedRight.handleOut, right.handleOut, `${file}: right handle offset changed`);
        if (left.handleIn) {
          const oldControlX = left.position.x + left.handleIn.x;
          const newControlX = resizedLeft.position.x + resizedLeft.handleIn!.x;
          invariant(newControlX - oldControlX === resizedLeft.position.x - left.position.x,
            `${file}: left absolute handle did not translate with its anchor`);
        }
      }
      throws(() => neckJoint.setCustomNeckJointMouthWidth(documentedSStyleJoint, v7.contour, 56), /Convert a locked/,
        'locked profiles must not permit a numeric mouth-width edit');
    });

    check('explicitly converts a legacy joint before its numeric mouth width can change', () => {
      const legacy = presets.migrateProject(v2);
      invariant(!legacy.neckJointGeometry && !legacy.neckPlacement, 'legacy fixture unexpectedly already has a v7 joint');
      const converted = presets.convertLegacyNeckJointToCustom(legacy);
      invariant(converted.schemaVersion === 7, 'custom-joint conversion did not raise the document to v7');
      invariant(converted.neckJointGeometry?.mode === 'custom', 'conversion did not create a custom joint');
      invariant(converted.neckJointGeometry?.derivedFromProfileId === 'legacy-frozen-adapter:s_style',
        'conversion did not record the frozen legacy adapter source');
      invariant(converted.neckPlacement?.jointToReferenceFretMm === hardware.FINGERBOARD_OVERHANG_MM.s_style,
        'conversion did not seed the body placement from the S-style overhang constant');
      invariant(converted.neckJointGeometry?.parameters.endTreatment === 'compound'
        && converted.neckJointGeometry.parameters.deepEndWidthMm! > converted.neckJointGeometry.parameters.mouthWidthMm,
      'non-T bolt-on conversion did not use the rounded tapered default');
      const asGlued = {
        ...converted,
        neckJointMechanism: 'glued' as const,
        neckJointGeometry: {
          ...converted.neckJointGeometry!,
          mechanism: 'glued' as const,
          planShape: 'straight_mortise' as const,
          parameters: {
            mouthWidthMm: converted.neckJointGeometry!.parameters.mouthWidthMm,
            planLengthMm: converted.neckJointGeometry!.parameters.planLengthMm,
            endCornerRadiusMm: 6.35,
            endTreatment: 'square' as const,
            endRoundnessMm: 0,
          },
        },
      };
      const roundedBoltOn = presets.changeCustomNeckJointMechanism(asGlued, 'bolt_on');
      invariant(roundedBoltOn.neckJointGeometry?.planShape === 'bolt_on_pocket'
        && roundedBoltOn.neckJointGeometry.parameters.endTreatment === 'compound'
        && roundedBoltOn.neckJointGeometry.parameters.mouthWidthMm === 53.64553921225705
        && roundedBoltOn.neckJointGeometry.parameters.planLengthMm === 76.2,
      'changing a glued joint to bolt-on did not replace its mortise dimensions with the rounded-end bolt-on default');
      const roundedLeft = roundedBoltOn.contour.anchors.find((anchor) => anchor.semanticRole === 'neck_pocket_left')!;
      const roundedRight = roundedBoltOn.contour.anchors.find((anchor) => anchor.semanticRole === 'neck_pocket_right')!;
      invariant(roundedLeft.position.x === -53.64553921225705 / 2 && roundedRight.position.x === 53.64553921225705 / 2,
        'changing a glued joint to bolt-on did not reset the body mouth anchors to the bolt-on default');
      const straightBoltOn = presets.changeCustomNeckJointMechanism({ ...asGlued, activeTemplateId: 't_style' }, 'bolt_on');
      invariant(straightBoltOn.neckJointGeometry?.parameters.endTreatment === 'square',
        'changing a T-style glued joint to bolt-on did not select the straight-end default');
      const initialWidth = converted.neckJointGeometry!.parameters.mouthWidthMm;
      const resized = neckJoint.setCustomNeckJointMouthWidth(
        converted.neckJointGeometry!, converted.contour, initialWidth + 0.5,
      );
      const saved = presets.withEmbeddedPresets({ ...converted, contour: resized.contour, neckJointGeometry: resized.geometry });
      invariant(saved.neckJointGeometry!.parameters.mouthWidthMm === initialWidth + 0.5,
        'numeric mouth width did not survive the v7 compatibility write');
      invariant(saved.neckPreset.jointWidthMm === saved.neckJointGeometry!.parameters.deepEndWidthMm,
        'legacy width mirror was not derived from the custom v7 deep-end width');
      const savedLeft = saved.contour.anchors.find((anchor) => anchor.semanticRole === 'neck_pocket_left')!;
      const savedRight = saved.contour.anchors.find((anchor) => anchor.semanticRole === 'neck_pocket_right')!;
      invariant(savedLeft.position.x === -(initialWidth + 0.5) / 2 && savedRight.position.x === (initialWidth + 0.5) / 2,
        'numeric mouth width did not move the paired mouth anchors symmetrically');
      for (const file of readdirSync(BLUEPRINT_DIR)
        .filter((name) => name.endsWith('.axe.svg'))
        .filter((name) => decodePayload(readFileSync(join(BLUEPRINT_DIR, name), 'utf8')).instrumentType === 'guitar')
        .sort()) {
        const bundled = decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8'));
        const { neckJointGeometry: _geometry, neckPlacement: _placement, ...legacyPayload } = bundled;
        const source = presets.migrateProject({ ...legacyPayload, schemaVersion: 6 });
        const convertedBody = presets.convertLegacyNeckJointToCustom(source);
        invariant(convertedBody.schemaVersion === 7 && convertedBody.neckJointGeometry?.mode === 'custom',
          `${file}: conversion did not produce an editable custom v7 joint`);
        try {
          neckJoint.validateNeckJointWithinBody(convertedBody.neckJointGeometry, convertedBody.contour);
        } catch (error) {
          throw new Error(`${file}: ${(error as Error).message}`);
        }
      }
      const bass = presets.migrateProject({ ...v2, instrumentType: 'bass', stringCount: 4 });
      throws(() => presets.convertLegacyNeckJointToCustom(bass), /bass neck pockets remain legacy-only/,
        'bass must not silently enter the generic custom-joint editor');
    });

    check('keeps numeric custom-joint edits inside the body and warns about an incompatible cutter', () => {
      const converted = presets.convertLegacyNeckJointToCustom(presets.migrateProject(v2));
      const current = converted.neckJointGeometry!;
      const tapered = neckJoint.updateCustomNeckJoint(current, converted.contour, {
        parameters: { deepEndWidthMm: current.parameters.mouthWidthMm + 0.1 },
      });
      invariant(tapered.geometry.parameters.deepEndWidthMm === current.parameters.mouthWidthMm + 0.1,
        'deep-end width did not persist through the custom joint operation');
      const cutterChecked = neckJoint.updateCustomNeckJoint(tapered.geometry, tapered.contour, { cutterDiameterMm: 20 });
      invariant(neckJoint.neckJointCutterWarnings(cutterChecked.geometry).length === 1,
        'an oversized cutter did not produce an advisory warning');
      const fitted = neckJoint.updateCustomNeckJoint(current, converted.contour, {
        targetHeelWidthMm: current.parameters.deepEndWidthMm! - 0.4,
        fittingClearanceMm: 0.1,
      });
      invariant(Math.abs(neckJoint.requiredPocketWidthForHeelFit(fitted.geometry) - (current.parameters.deepEndWidthMm! - 0.2)) < 0.000000001,
        'per-side clearance was not added twice to the required heel-fit width');
      throws(() => neckJoint.updateCustomNeckJoint(fitted.geometry, fitted.contour, {
        fittingClearanceMm: 0.3,
      }), /twice the per-side clearance/, 'a heel fit with insufficient pocket width was accepted');
      throws(() => neckJoint.updateCustomNeckJoint(current, converted.contour, {
        parameters: { deepEndWidthMm: 1000 },
      }), /leaves the body/, 'a joint that leaves the body was accepted');
    });

    check('rejects a v7 payload whose paired joint contract is stripped or corrupt', () => {
      const missingPlacement = presets.loadProject({ ...v7, neckPlacement: undefined });
      invariant(!missingPlacement.ok && missingPlacement.reason === 'malformed-neck-joint', 'missing v7 placement was accepted');
      const wrongReferenceFret = presets.loadProject({ ...v7, neckPlacement: { ...v7.neckPlacement, referenceFret: 21 } });
      invariant(!wrongReferenceFret.ok && wrongReferenceFret.reason === 'malformed-neck-joint', 'wrong v7 reference fret was accepted');
      const looseMouth = presets.loadProject({
        ...v7,
        contour: { ...v7.contour, anchors: v7.contour.anchors.map((anchor: any) => (
          anchor.id === 's_pocket_left' ? { ...anchor, locked: false } : anchor
        )) },
      });
      invariant(!looseMouth.ok && looseMouth.reason === 'malformed-neck-joint', 'unlocked v7 mouth anchor was accepted');
    });

    check('stores a glued neck angle without treating an arched top as geometry', () => {
      const glued = {
        ...v7,
        neckJointGeometry: {
          ...documentedSStyleJoint,
          profileId: 'straight-mortise-v1',
          mechanism: 'glued' as const,
          planShape: 'straight_mortise' as const,
          profileSnapshot: {
            ...documentedSStyleJoint.profileSnapshot,
            id: 'straight-mortise-v1', mechanism: 'glued' as const, planShape: 'straight_mortise' as const,
          },
          neckAngleDegrees: 4,
        },
        bodyTop: { construction: 'carved_cap' as const },
      };
      const flatOutline = neckJoint.generateNeckJointOutline(glued.neckJointGeometry).points;
      const archedOutline = neckJoint.generateNeckJointOutline({ ...glued.neckJointGeometry, neckAngleDegrees: 4 }).points;
      deepStrictEqual(archedOutline, flatOutline);
      deepStrictEqual(presets.migrateProject(glued).neckJointGeometry.neckAngleDegrees, 4);
      const customGlued = {
        ...glued.neckJointGeometry,
        mode: 'custom' as const,
        profileId: undefined,
        profileSnapshot: undefined,
        derivedFromProfileId: 'straight-mortise-v1',
      };
      const editedAngle = neckJoint.updateCustomNeckJoint(customGlued, v7.contour, { neckAngleDegrees: 3.5 });
      deepStrictEqual(editedAngle.geometry.neckAngleDegrees, 3.5);
    });

    check('bundled guitar blueprints are version 7 witnesses with body-specific placement', () => {
      const singleCut = decodePayload(readFileSync(join(BLUEPRINT_DIR, 'single_cut.axe.svg'), 'utf8'));
      deepStrictEqual(singleCut.schemaVersion, 7);
      invariant(singleCut.instrumentAppearance, 'single_cut no longer carries persisted instrument appearance');
      deepStrictEqual(singleCut.neckPlacement?.jointToReferenceFretMm, hardware.FINGERBOARD_OVERHANG_MM.single_cut);
      invariant(singleCut.neckJointGeometry?.mode === 'custom', 'single_cut must retain a conservative custom glued joint');
      deepStrictEqual(singleCut.neckJointGeometry?.derivedFromProfileId, 'blueprint-baseline:single_cut');
      invariant(presets.isBlueprintNeckJointBaseline(singleCut), 'single_cut must begin behind the Customize Joint action');
      const customizedSingleCut = presets.customizeBlueprintNeckJoint(singleCut);
      invariant(!presets.isBlueprintNeckJointBaseline(customizedSingleCut), 'Customize Joint did not unlock the single-cut baseline');
      deepStrictEqual(customizedSingleCut.neckJointGeometry?.derivedFromProfileId, 'blueprint-custom:single_cut');
      const resetSingleCut = presets.blueprintNeckJointBaseline(customizedSingleCut);
      deepStrictEqual(resetSingleCut?.mechanism, 'glued');
      deepStrictEqual(resetSingleCut?.parameters.planLengthMm, 101.6);
      const sStyle = decodePayload(readFileSync(BASE_BLUEPRINT, 'utf8'));
      deepStrictEqual(sStyle.schemaVersion, 7);
      invariant(sStyle.neckJointGeometry?.mode === 'locked', 'S-style must use its locked compound bolt-on profile');
      deepStrictEqual(sStyle.neckJointGeometry?.parameters.endTreatment, 'compound');
      invariant(presets.isBlueprintNeckJointBaseline(sStyle), 'S-style must begin behind the Customize Joint action');
      const customizedSStyle = presets.customizeBlueprintNeckJoint(sStyle);
      deepStrictEqual(customizedSStyle.neckJointGeometry?.mode, 'custom');
      deepStrictEqual(customizedSStyle.neckJointGeometry?.derivedFromProfileId, 's-style-1962-fender-019574-v1');
      const tStyle = decodePayload(readFileSync(join(BLUEPRINT_DIR, 't_style.axe.svg'), 'utf8'));
      invariant(tStyle.neckJointGeometry?.mode === 'locked', 'T-style must use its locked straight bolt-on profile');
      deepStrictEqual(tStyle.neckJointGeometry?.parameters.endTreatment, 'square');

      const sgStyle = presets.customizeBlueprintNeckJoint(
        decodePayload(readFileSync(join(BLUEPRINT_DIR, 'sg_style.axe.svg'), 'utf8')),
      );
      const boltOnSG = presets.changeCustomNeckJointMechanism(sgStyle, 'bolt_on');
      const restoredSG = presets.changeCustomNeckJointMechanism(boltOnSG, 'glued');
      const sgDefault = presets.neckPresetFieldsForTemplate(
        restoredSG.neckPresetId, 'sg_style', 'glued', 'guitar',
      ).neckPreset;
      deepStrictEqual(restoredSG.neckJointGeometry?.mechanism, 'glued');
      deepStrictEqual(restoredSG.neckJointGeometry?.parameters.mouthWidthMm, sgDefault.jointWidthMm);
      deepStrictEqual(restoredSG.neckJointGeometry?.parameters.planLengthMm, sgDefault.jointDepthMm);
      deepStrictEqual(restoredSG.neckJointGeometry?.parameters.endCornerRadiusMm, sgDefault.jointCornerRadiusMm);

      for (const file of ['single_cut.axe.svg', 'gretsch_thunderbird.axe.svg', 'gibson_flying_v.axe.svg']) {
        const gluedBlueprint = presets.customizeBlueprintNeckJoint(
          decodePayload(readFileSync(join(BLUEPRINT_DIR, file), 'utf8')),
        );
        const boltOn = presets.changeCustomNeckJointMechanism(gluedBlueprint, 'bolt_on');
        invariant(boltOn.neckJointGeometry?.mechanism === 'bolt_on'
          && boltOn.neckJointGeometry.parameters.endTreatment === 'compound',
        `${file}: bolt-on conversion did not retain a valid rounded S-style end`);
      }
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
