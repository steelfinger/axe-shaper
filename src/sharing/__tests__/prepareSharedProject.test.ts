import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSharedProject } from '../prepareSharedProject';
import { UPLOAD_POLICY_REVISION, validateProjectUpload } from '../projectAdmission';
import { projectDigest } from '../canonicalJson';
import { createProject } from '../../utils/projectFactory';
import { withEmbeddedPresets } from '../../utils/presets';

const policy = { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 };
describe('client shared-project preparation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('freezes the complete save payload before async hashing and leaves editing independent', async () => {
    const working = createProject({ templateId: 's_style', now: () => new Date('2026-10-10T10:00:00Z') });
    // Normal in-memory optional fields are omitted by the saved JSON representation.
    working.binding = undefined;
    const original = JSON.parse(JSON.stringify(withEmbeddedPresets(working)));
    const pending = prepareSharedProject(working, policy);
    working.settings.name = 'Edited while hashing';
    working.contour.anchors[0].position.x += 5;
    const result = await pending;
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    expect(result.project).toEqual(original);
    expect(result.digest).toBe(await projectDigest(original));
    expect(Object.isFrozen(result.project.settings)).toBe(true);
    expect(Object.isFrozen(result.project.contour.anchors[0].position)).toBe(true);
    expect(validateProjectUpload(result.project, policy)).toMatchObject({ ok: true });
    expect(working.settings.name).toBe('Edited while hashing');
  });
  it('rejects future vocabulary without erasing it to obtain acceptance', async () => {
    const working = createProject({ templateId: 's_style' });
    working.edgeProfile = { kind: 'slab', futureField: 'preserve in file' };
    const before = JSON.stringify(working);
    expect(await prepareSharedProject(working, policy)).toMatchObject({ ok: false, code: 'unknown-vocabulary' });
    expect(JSON.stringify(working)).toBe(before);
  });
  it('returns policy/schema errors for the file-sharing fallback', async () => {
    const working = createProject({ templateId: 's_style' });
    expect(await prepareSharedProject(working, { ...policy, revision: 'future' }))
      .toMatchObject({ ok: false, code: 'unsupported-policy' });
    working.jacks = [{ id: 'jack', position: { x: 0, y: 0 }, mountingStyle: 'direct', angleDegrees: 0 }];
    expect(await prepareSharedProject(working, policy)).toMatchObject({ ok: false, code: 'unsupported-schema' });
  });
  it('returns a typed crypto fallback after local admission', async () => {
    vi.stubGlobal('crypto', undefined);
    expect(await prepareSharedProject(createProject({ templateId: 's_style' }), policy))
      .toMatchObject({ ok: false, code: 'crypto-unavailable' });
  });
});
