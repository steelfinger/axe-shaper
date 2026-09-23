/**
 * Re-stamps every bundled blueprint's embedded neckPreset/bridgePreset copy
 * from the current NECK_PRESETS/BRIDGE_PRESETS tables, by id - the same
 * refresh a user gets by re-picking the same preset from the UI (see
 * neckPresetFields/bridgePresetFields in src/utils/presets.ts, "the two have
 * to move together").
 *
 * Needed whenever a hardware.ts value changes: schemaVersion 2 blueprints
 * embed their own copy, and "the embedded copy wins" (presets.ts's own doc
 * comment) - resolveNeckPreset/resolveBridgePreset read it before ever
 * consulting the live table. generate-golden-corpus.ts does the same:
 * decodeBlueprint() reads project.neckPreset directly. Editing hardware.ts
 * alone leaves every bundled blueprint's on-disk copy stale, which then
 * leaks into the golden corpus, into what a fresh "open this blueprint" load
 * draws, and into whatever iOS pulls down via Scripts/sync-contract.sh.
 *
 * Usage: npx tsx scripts/refresh-blueprint-presets.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Mirrors decodeBlueprint in generate-golden-corpus.ts - no DOMParser needed. */
function decodeBlueprint(path: string): any {
  const svg = readFileSync(path, 'utf8');
  const match = svg.match(/<project:data>([\s\S]*?)<\/project:data>/);
  if (!match) throw new Error(`no <project:data> in ${path}`);
  return JSON.parse(Buffer.from(match[1].trim(), 'base64').toString('utf8'));
}

async function main() {
  const server = await createServer({
    root: ROOT,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const load = (p: string) => server.ssrLoadModule(p);
  const presets = await load('/src/utils/presets.ts');
  // exportProjectToSVG itself is DOM-free (only extractProjectFromSVG and
  // downloadSVGFile need DOMParser/document) - safe to load and call here.
  const svgExporter = await load('/src/utils/svgExporter.ts');
  const manifest = await load('/src/constants/blueprintManifest.ts');
  const hardware = await load('/src/constants/hardware.ts');

  for (const id of manifest.BLUEPRINT_ORDER) {
    const path = join(ROOT, 'src', 'constants', 'blueprints', `${id}.axe.svg`);
    const project = decodeBlueprint(path);
    const neck = presets.neckPresetFields(project.neckPresetId);
    // For bass blueprints, nutToBodyEdgeMm has a per-body answer in
    // FINGERBOARD_OVERHANG_MM (p_bass_style's is not the fret-17 value) - take
    // it from there, the way the in-app neck re-pick does, so a refresh does
    // not silently reset the bridge. Guitar blueprints already match their
    // native-neck value, so this changes nothing for them; scoping it to bass
    // keeps their pocket fields untouched too.
    if (project.instrumentType === 'bass') {
      const templateEdge = presets.neckPresetFieldsForTemplate(
        project.neckPresetId,
        id,
        presets.defaultNeckJointMechanism(id),
        'bass'
      ).neckPreset.nutToBodyEdgeMm;
      // 4dp, matching generate-bass-blueprint-drafts.ts and the hand-written
      // NECK_PRESETS constants - so the non-P bass bodies re-embed unchanged,
      // with one known exception: sg_bass_style stores 434.70000000000005 and
      // rounds to 434.7, so a refresh always emits that one-line diff. It is
      // float noise, ~5e-14mm, not a geometry change - deliberately left in
      // the committed file rather than spending a corpus
      // --allow-scale-math-change on a saddle that has not moved. Expect it;
      // it does not mean the refresh broke something.
      neck.neckPreset.nutToBodyEdgeMm = Math.round(templateEdge * 1e4) / 1e4;
    }
    // `neckPresetFields` reads NECK_PRESETS by id alone, which is body-blind.
    // That is right for the pocket everywhere except a body with an entry in
    // TEMPLATE_NECK_POCKET_SPEC, where the catalogue's answer for *this body*
    // deliberately overrides the generic one while its native mechanism is
    // selected - r_bass_style's 40mm neck-through centre strip against the
    // 63.5mm generic bass mortise. Without this, a refresh silently widened
    // that rout to 63.5mm: 11.75mm proud of the contour on each side, whose
    // own `s_pocket_left`/`s_pocket_right` anchors sit at X=+/-20 (both facts
    // asserted by `npm run bass:check`). Taking the pocket from the same
    // template-aware call the in-app re-pick uses keeps the two in step; it
    // is a no-op for every body without an entry.
    const mechanism = project.neckJointMechanism ?? presets.defaultNeckJointMechanism(id);
    const templatePocket = hardware.TEMPLATE_NECK_POCKET_SPEC[id];
    if (templatePocket?.mechanism === mechanism) {
      const pocket = presets.neckPresetFieldsForTemplate(
        project.neckPresetId,
        id,
        mechanism,
        project.instrumentType ?? 'guitar'
      ).neckPreset;
      for (const key of [
        'jointWidthMm',
        'jointDepthMm',
        'jointCornerRadiusMm',
        'pocketWidthMm',
        'pocketDepthMm',
        'pocketCornerRadiusMm',
      ] as const) {
        neck.neckPreset[key] = pocket[key];
      }
    }
    // Through migrateProject - the same door every other read goes through.
    // The schema stamp no longer depends on it: exportProjectToSVG stamps
    // requiredSchemaVersion (constants/schema.ts) on the way out, so each
    // blueprint lands on the lowest version that can represent it, which is 4
    // for sixteen of them and 5 only for single_cut. Routing through the
    // version and instrument gates anyway keeps a blueprint this build would
    // refuse to *open* from being silently rewritten by a refresh.
    const refreshed = presets.migrateProject({
      ...project,
      ...neck,
      ...presets.bridgePresetFields(project.bridgePresetId),
    });
    const svg = svgExporter.exportProjectToSVG(refreshed);
    writeFileSync(path, svg);
    console.log(`refreshed ${id} (neck: ${project.neckPresetId}, bridge: ${project.bridgePresetId})`);
  }

  await server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
