import { describe, expect, it } from 'vitest';
import baselineSvg from '../../../tests/fixtures/ios-written-v5/s_style.axe.svg?raw';
import webV8Svg from '../../../tests/fixtures/web-written-v8/output_jacks.axe.svg?raw';
import returnedV8Svg from '../../../tests/fixtures/ios-written-v5/web_roundtrip_output_jacks.axe.svg?raw';
import nativeV8Svg from '../../../tests/fixtures/ios-written-v5/output_jacks.axe.svg?raw';
import schema8 from '../../../tests/fixtures/sharing/schema8-known-jacks.json';
import { PROJECT_UPLOAD_LIMITS, UPLOAD_POLICY_REVISION, validateProjectUpload } from '../projectAdmission';
import { parseSharingJson, projectDigest } from '../canonicalJson';
import { createProject } from '../../utils/projectFactory';
import { withEmbeddedPresets } from '../../utils/presets';
import { exportProjectToSVG } from '../../utils/svgExporter';
import { REFERENCE_TEMPLATES } from '../../constants/templates';
import type { GuitarProject } from '../../types/guitar';

const policy7 = { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 };
const policy8 = { ...policy7, maxAcceptedProjectSchema: 8 };
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
    for (const ceiling of [2, 9, 7.5, NaN]) {
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
      project => { project.contour.anchors[0].mirrorId = 'missing'; },
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
});
