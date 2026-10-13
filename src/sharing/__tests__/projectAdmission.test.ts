import { describe, expect, it } from 'vitest';
import baselineSvg from '../../../tests/fixtures/ios-written-v5/s_style.axe.svg?raw';
import webV8Svg from '../../../tests/fixtures/web-written-v8/output_jacks.axe.svg?raw';
import returnedV8Svg from '../../../tests/fixtures/ios-written-v5/web_roundtrip_output_jacks.axe.svg?raw';
import nativeV8Svg from '../../../tests/fixtures/ios-written-v5/output_jacks.axe.svg?raw';
import schema8 from '../../../tests/fixtures/sharing/schema8-known-jacks.json';
import { PROJECT_UPLOAD_LIMITS, UPLOAD_POLICY_REVISION, validateProjectUpload, PROJECT_UPLOAD_POLICY_DEFINITION,
  PROJECT_REVISION_READERS } from '../projectAdmission';
import policyFingerprints from '../../../tests/fixtures/sharing/policy-fingerprints.json';
import { parseSharingJson, projectDigest } from '../canonicalJson';
import { createProject } from '../../utils/projectFactory';
import { withEmbeddedPresets } from '../../utils/presets';
import { exportProjectToSVG } from '../../utils/svgExporter';
import { REFERENCE_TEMPLATES } from '../../constants/templates';
import type { GuitarProject } from '../../types/guitar';
import { PICKUP_TYPE_INSTRUMENT } from '../../constants/hardware';
import { SUPPORTED_STRING_COUNTS } from '../../utils/instrument';
import { removeAnchorsAndUnlinkMirrors } from '../../utils/symmetry';

const policy7 = { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 };
const policy8 = { ...policy7, maxAcceptedProjectSchema: 8 };
const policyDefinitions = import.meta.glob<unknown>('../../../tests/fixtures/sharing/project-upload-*-definition.json',
  { eager: true, import: 'default' });
const definitionFor = (revision: string) => Object.entries(policyDefinitions)
  .find(([path]) => path.endsWith(`/${revision}-definition.json`))?.[1];
function fromSvg(svg: string): GuitarProject {
  const encoded = svg.match(/<project:data>([\s\S]*?)<\/project:data>/)?.[1];
  if (!encoded) throw new Error('Missing fixture project');
  return parseSharingJson(new TextDecoder().decode(Uint8Array.from(atob(encoded.trim()), char => char.charCodeAt(0)))) as unknown as GuitarProject;
}
const baseline = fromSvg(baselineSvg);
const fresh = () => structuredClone(baseline);
const preflight = (project: unknown) => validateProjectUpload(project, policy8);
function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

describe('strict project upload admission', () => {
  it('pins bounds, recursive field sets, enum vocabulary and compatibility tables to the policy revision', async () => {
    const fingerprints: Record<string, string> = policyFingerprints;
    expect(definitionFor(UPLOAD_POLICY_REVISION), 'Keep the independently consumed definition equal to the compiled rules')
      .toEqual(PROJECT_UPLOAD_POLICY_DEFINITION);
    expect(Object.keys(PROJECT_REVISION_READERS).sort(), 'Keep a reader for every fingerprinted revision')
      .toEqual(Object.keys(fingerprints).sort());
    expect(Object.hasOwn(fingerprints, UPLOAD_POLICY_REVISION), 'New policies need a fingerprint and retained historical readers').toBe(true);
    expect(await projectDigest(PROJECT_UPLOAD_POLICY_DEFINITION), 'Policy drift requires a new revision; do not replace an existing fingerprint')
      .toBe(fingerprints[UPLOAD_POLICY_REVISION]);
    for (const [revision, fingerprint] of Object.entries(fingerprints)) {
      expect(definitionFor(revision), `Keep the immutable ${revision} definition`).toBeDefined();
      expect(await projectDigest(definitionFor(revision))).toBe(fingerprint);
    }
  });
  it('accepts the complete native v7 fixture unchanged with equal digest/export payload', async () => {
    const project = fresh();
    freeze(project);
    const before = JSON.stringify(project);
    const result = validateProjectUpload(project, policy7);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error(result.code);
    expect(result.project).toBe(project);
    expect(await projectDigest(result.project)).toBe(await projectDigest(baseline));
    expect(fromSvg(exportProjectToSVG(result.project))).toEqual(baseline);
    expect(JSON.stringify(project)).toBe(before);
  });
  it('accepts known v8 vocabulary at ceiling 8 and refuses it at ceiling 7', () => {
    expect(preflight(schema8)).toMatchObject({ ok: true });
    expect(fromSvg(exportProjectToSVG(schema8 as GuitarProject))).toEqual(schema8);
    expect(validateProjectUpload(schema8, policy7)).toMatchObject({ ok: false, code: 'unsupported-schema' });
  });
  for (const [name, svg] of [['web v8', webV8Svg], ['returned v8', returnedV8Svg], ['native v8', nativeV8Svg]]) {
    it(`rejects future vocabulary in ${name} at ceiling 8 without stripping it`, () => {
      const project = fromSvg(svg);
      const before = JSON.stringify(project);
      expect(preflight(project)).toMatchObject({ ok: false, code: 'unknown-vocabulary' });
      expect(JSON.stringify(project)).toBe(before);
    });
  }
  it('accepts current full save payloads from every guitar and bass blueprint', () => {
    for (const template of Object.values(REFERENCE_TEMPLATES)) {
      const project = createProject({ templateId: template.id, now: () => new Date('2026-10-10T10:00:00Z') });
      const payload = JSON.parse(JSON.stringify(withEmbeddedPresets(project)));
      expect(preflight(payload), `${template.id}: ${JSON.stringify(preflight(payload))}`).toMatchObject({ ok: true });
    }
  });
  it('preserves unfamiliar embedded hardware without resolving a catalogue entry', async () => {
    const project = fresh();
    project.neckPresetId = project.neckPreset!.id = 'custom-neck-unlisted';
    project.bridgePresetId = project.bridgePreset!.id = 'custom-bridge-unlisted';
    project.neckPreset!.scaleLengthMm = 647.123456789;
    project.bridgePreset!.compensationMm.treble = 2.123456789;
    // As in the real client, prepare the full saved value before admission.
    const payload = JSON.parse(JSON.stringify(withEmbeddedPresets(project)));
    const before = structuredClone(payload);
    expect(preflight(payload)).toMatchObject({ ok: true });
    expect(payload).toEqual(before);
    expect(await projectDigest(payload)).toBe(await projectDigest(fromSvg(exportProjectToSVG(payload))));
  });
  it('rejects missing embedded presets rather than filling them from IDs', () => {
    for (const key of ['neckPreset', 'bridgePreset'] as const) {
      const project = fresh(); delete project[key];
      expect(preflight(project)).toMatchObject({ ok: false, code: 'invalid-project', path: `project.${key}` });
      expect(project[key]).toBeUndefined();
    }
    const missingRout = fresh(); delete missingRout.pickups[0].anchors;
    expect(preflight(missingRout)).toMatchObject({ ok: false, code: 'invalid-project', path: 'project.pickups[0].anchors' });
  });
  it('checks declared, required and release schema versions independently', () => {
    const project = structuredClone(schema8);
    project.schemaVersion = 7;
    expect(validateProjectUpload(project, policy7)).toMatchObject({ ok: false, code: 'schema-mismatch' });
    const partial = fresh(); delete partial.neckPlacement;
    expect(preflight(partial)).toMatchObject({ ok: false, code: 'invalid-project' });
    const lower = fresh(); lower.schemaVersion = 6;
    expect(preflight(lower)).toMatchObject({ ok: false, code: 'schema-mismatch' });
    const legacy = fresh();
    delete legacy.neckJointGeometry; delete legacy.neckPlacement; delete legacy.instrumentAppearance;
    delete legacy.potentiometers; delete legacy.switches; delete legacy.bodyTop;
    legacy.schemaVersion = 3;
    expect(preflight(legacy).ok).toBe(true);
    for (const version of [2, 9, 7.5, NaN]) expect(preflight({ ...baseline, schemaVersion: version }).ok).toBe(false);
  });
  it('fails closed on unknown policy revisions and invalid release ceilings', () => {
    expect(validateProjectUpload(baseline, { ...policy7, revision: 'future-policy' })).toMatchObject({ ok: false, code: 'unsupported-policy' });
    for (const ceiling of [2, 10, 7.5, NaN]) {
      expect(validateProjectUpload(baseline, { ...policy7, maxAcceptedProjectSchema: ceiling })).toMatchObject({ ok: false, code: 'unsupported-policy' });
    }
  });
  it('rejects unknown names in every recursive object without reflecting the names', () => {
    const objectPaths: Array<Array<string | number>> = [];
    const visit = (value: unknown, path: Array<string | number>) => {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value)) objectPaths.push(path);
      for (const [key, child] of Object.entries(value)) visit(child, [...path, Array.isArray(value) ? Number(key) : key]);
    };
    visit(schema8, []);
    for (const path of objectPaths) {
      const project = structuredClone(schema8);
      let target = project as unknown as Record<string, unknown>;
      for (const key of path) target = target[key] as Record<string, unknown>;
      target['secret-like-unknown-name'] = 'private';
      const result = preflight(project);
      expect(result).toMatchObject({ ok: false, code: 'unknown-vocabulary' });
      expect(JSON.stringify(result)).not.toContain('secret-like-unknown-name');
    }
    expect(preflight(parseSharingJson(JSON.stringify(baseline).replace('"author":', '"__proto__":{},"author":'))))
      .toMatchObject({ ok: false, code: 'unknown-vocabulary' });
  });
  it('rejects unknown enums independently from unknown fields', () => {
    const jack = structuredClone(schema8); jack.jacks[0].mountingStyle = 'side_mounted';
    expect(preflight(jack)).toMatchObject({ ok: false, code: 'unknown-vocabulary', path: 'project.jacks[0].mountingStyle' });
    const appearance = fresh(); appearance.instrumentAppearance!.fingerboard = 'future-wood' as never;
    expect(preflight(appearance)).toMatchObject({ ok: false, code: 'unknown-vocabulary' });
    const edge = fresh(); edge.edgeProfile!.futureField = true;
    expect(preflight(edge)).toMatchObject({ ok: false, code: 'unknown-vocabulary', path: 'project.edgeProfile' });
  });
  it('validates instrument combinations and joint geometry without repair', () => {
    const wrongStrings = fresh(); wrongStrings.stringCount = 4;
    expect(preflight(wrongStrings)).toMatchObject({ ok: false, code: 'invalid-project', path: 'project.stringCount' });
    const wrongPickup = fresh(); wrongPickup.pickups[0].type = 'bass_j_single_coil';
    expect(preflight(wrongPickup)).toMatchObject({ ok: false, code: 'invalid-project' });
    const wrongFret = fresh(); wrongFret.neckPlacement!.referenceFret = 20;
    expect(preflight(wrongFret)).toMatchObject({ ok: false, code: 'invalid-project' });
    const wrongSnapshot = fresh(); wrongSnapshot.neckJointGeometry!.profileSnapshot!.parameters.mouthWidthMm += 1;
    expect(preflight(wrongSnapshot)).toMatchObject({ ok: false, code: 'invalid-project' });
  });
  it('rejects invalid types, geometry, local state, duplicate IDs and unresolved mirrors', () => {
    const mutations: Array<(project: GuitarProject) => void> = [
      project => { project.settings.showGrid = 'yes' as never; },
      project => { project.contour.closed = false; },
      project => { project.contour.anchors[0].position.x = PROJECT_UPLOAD_LIMITS.maxCoordinateMm + 1; },
      project => { project.contour.anchors[0].position.y = Infinity; },
      project => { project.pickups[0].widthMm = 0; },
      project => { project.contour.anchors[1].id = project.contour.anchors[0].id; },
      project => { project.contour.anchors[0].mirrorId = project.contour.anchors[0].id; },
      project => { project.settings.bodyColor = 'url(https://example.com/image)'; },
      project => { Object.assign(project, { guideImage: { imageUrl: 'blob:local' } }); },
    ];
    for (const mutate of mutations) { const project = fresh(); mutate(project); expect(preflight(project).ok).toBe(false); }
  });
  it('enforces aggregate anchor and placement budgets as well as project bytes', () => {
    const tooMany = fresh();
    tooMany.jacks = Array.from({ length: PROJECT_UPLOAD_LIMITS.maxPlacements }, (_, i) => ({
      id: `jack-${i}`, mountingStyle: 'direct', position: { x: 0, y: 0 }, angleDegrees: 0,
    }));
    tooMany.schemaVersion = 8;
    expect(preflight(tooMany)).toMatchObject({ ok: false, code: 'resource-limit' });
    const manyAnchors = fresh();
    manyAnchors.frontRoutes = Array.from({ length: 5 }, (_, i) => ({ id: `route-${i}`, contour: {
      closed: true, anchors: Array.from({ length: 450 }, (_, j) => ({ id: `anchor-${j}`, handleMode: 'corner', position: { x: 0, y: 0 } })),
    } }));
    expect(preflight(manyAnchors)).toMatchObject({ ok: false, code: 'resource-limit' });
    expect(preflight({ ...baseline, metadata: { ...baseline.metadata, author: 'x'.repeat(PROJECT_UPLOAD_LIMITS.maxProjectBytes) } }))
      .toMatchObject({ ok: false, code: 'resource-limit', path: 'project' });
  });
  it('admits older saved dangling mirror links and cleans them on explicit deletion', () => {
    const project = fresh();
    project.settings.symmetry.mode = 'none';
    const [first, partner] = project.contour.anchors;
    first.mirrorId = partner.id;
    partner.mirrorId = first.id;
    partner.locked = true;
    // Historical editor saves can carry a partner that was deleted while symmetry was off.
    const historical = structuredClone(project);
    historical.contour.anchors = historical.contour.anchors.filter(anchor => anchor.id !== first.id);
    expect(preflight(historical)).toMatchObject({ ok: true });
    expect(historical.contour.anchors[0].mirrorId).toBe(first.id);
    // The helper now used by both editor deletion branches removes only the link.
    project.contour.anchors = removeAnchorsAndUnlinkMirrors(project.contour.anchors, new Set([first.id]));
    expect(project.contour.anchors[0].mirrorId).toBeUndefined();
    expect(project.contour.anchors[0].locked).toBe(true);
    expect(project.contour.anchors[0].position).toEqual(partner.position);
    expect(preflight(project)).toMatchObject({ ok: true });
  });
  it('admits a legacy v5 project after the normal save path adds a jack without a v7 joint', () => {
    const legacy = fresh();
    delete legacy.neckJointGeometry; delete legacy.neckPlacement; delete legacy.instrumentAppearance;
    legacy.bodyTop = { construction: 'carved_cap' };
    legacy.schemaVersion = 5;
    expect(preflight(JSON.parse(JSON.stringify(withEmbeddedPresets(legacy))))).toMatchObject({ ok: true });
    legacy.jacks = [{ id: 'new-jack', mountingStyle: 'direct', position: { x: 0, y: 0 }, angleDegrees: 0 }];
    const saved = JSON.parse(JSON.stringify(withEmbeddedPresets(legacy)));
    expect(saved.schemaVersion).toBe(8);
    expect(saved.neckJointGeometry).toBeUndefined();
    expect(preflight(saved)).toMatchObject({ ok: true });
    expect(validateProjectUpload(saved, policy7)).toMatchObject({ ok: false, code: 'unsupported-schema' });
    const partial = { ...saved, neckPlacement: baseline.neckPlacement };
    expect(preflight(partial)).toMatchObject({ ok: false, code: 'invalid-project' });
  });
  it('accepts an empty jack list without rewriting it and independently checks its schema stamp', () => {
    const project = fresh(); project.jacks = [];
    const result = validateProjectUpload(project, policy7);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error(result.code);
    expect(result.project).toBe(project);
    expect(result.project.jacks).toEqual([]);
    // Empty jacks alone do not justify schema 8 under the exact save-stamp rule.
    project.schemaVersion = 8;
    expect(preflight(project)).toMatchObject({ ok: false, code: 'schema-mismatch' });
  });
  it('tracks the central instrument and pickup compatibility tables', () => {
    for (const [instrument, counts] of Object.entries(SUPPORTED_STRING_COUNTS)) {
      for (const count of counts) {
        const project = fresh();
        project.instrumentType = instrument as GuitarProject['instrumentType'];
        project.stringCount = count;
        project.neckPlacement!.referenceFret = instrument === 'bass' ? 20 : 22;
        project.pickups = [];
        expect(preflight(project)).toMatchObject({ ok: true });
        for (const [type, compatibleInstrument] of Object.entries(PICKUP_TYPE_INSTRUMENT)) {
          project.pickups = [{ ...baseline.pickups[0], type: type as GuitarProject['pickups'][number]['type'] }];
          expect(preflight(project).ok, `${instrument}/${type}`).toBe(instrument === compatibleInstrument);
        }
      }
    }
  });
});
