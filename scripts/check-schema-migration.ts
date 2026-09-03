/**
 * Schema version 3's contract: the instrument axis, the migration of older
 * files onto it, and the two gates that keep a payload this build does not
 * understand out of the editable project path.
 *
 * Cases are built in memory from the bundled s_style blueprint rather than
 * committed as fixture files, because three of them are payloads this app
 * cannot produce (a version 1 file, a version 4 file, a Bass/6 file) and a
 * committed file that no writer can write is a file nobody can regenerate.
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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

    const v2 = decodePayload(readFileSync(BASE_BLUEPRINT, 'utf8'));
    invariant(v2.schemaVersion === 2, `expected the bundled blueprint to still be version 2, got ${v2.schemaVersion}`);

    console.log('version 2 -> 3 (the bundled blueprints and every existing save)');

    check('migrates to a Guitar/6 project at the current version', () => {
      const migrated = presets.migrateProject(v2);
      deepStrictEqual(migrated.schemaVersion, schema.PROJECT_SCHEMA_VERSION);
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

    console.log('version 1 -> 3 (ids only, no embedded hardware)');

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
      deepStrictEqual(metadataElement(written, 'schemaVersion'), String(schema.PROJECT_SCHEMA_VERSION));
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
    // PROJECT_SCHEMA_VERSION unconditionally, so this payload was previously
    // accepted, editable, and written back out as version 2.
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
  } finally {
    await server.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSchema version 3 contract holds.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
