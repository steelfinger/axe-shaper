import { afterEach, describe, expect, it, vi } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import envelopeFixture from '../../../tests/fixtures/sharing/envelope-v1.json';
import schema8 from '../../../tests/fixtures/sharing/schema8-known-jacks.json';
import manifestFixture from '../../../tests/fixtures/sharing/support-manifest-v1.json';
import hashesFixture from '../../../tests/fixtures/sharing/creation-v1-hashes.json';
import { parseSharingJson, projectDigest } from '../canonicalJson';
import { UPLOAD_POLICY_REVISION, validateProjectUpload } from '../projectAdmission';
import { PROJECT_SCHEMA_VERSION } from '../../constants/schema';
import { admitShareCreation, buildSharedProjectEnvelope, compareShareCreationRetry,
  generateShareCreationSecrets, MAX_CREATION_REQUEST_BYTES, readSharedProjectEnvelope,
  SharingContractError, SHARING_ERROR_STATUS, supportManifestPath, readSharingClientSupportManifest,
  serializeShareCreationRequest, SHARING_PROJECT_SCHEMAS } from '../sharingContract';
import type { ShareCreationRequest } from '../sharingContract';

const policy = { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 };
const rawRequest = () => JSON.stringify(requestFixture);
const id = envelopeFixture.id;
const read = (value: unknown = envelopeFixture, ceiling = 7) => readSharedProjectEnvelope(JSON.stringify(value), id, ceiling);
afterEach(() => vi.unstubAllGlobals());

describe('version 1 creation contract', () => {
  it('admits the fixed native payload unchanged, returning only frozen data and private hashes', async () => {
    const result = await admitShareCreation(rawRequest(), policy);
    expect(result.project).toEqual(requestFixture.project);
    expect(result.projectDigest).toBe(requestFixture.projectDigest);
    expect(result).toMatchObject(hashesFixture);
    expect(Object.isFrozen(result.project.contour.anchors[0])).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['managementSecretHash', 'operationKeyHash', 'project',
      'projectDigest', 'requestDigest', 'uploadPolicyRevision']);
    expect(result.operationKeyHash).not.toBe(result.managementSecretHash);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(requestFixture.operationKey);
    expect(serialized).not.toContain(requestFixture.managementSecret);
  });
  it('compares reordered retries while binding project content and management authority', async () => {
    const initial = await admitShareCreation(rawRequest(), policy);
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(requestFixture).reverse()), null, 2);
    expect(compareShareCreationRetry(initial, await admitShareCreation(reordered, policy))).toBe('same-request');
    const keys = generateShareCreationSecrets();
    const changedKey = await admitShareCreation(JSON.stringify({ ...requestFixture, managementSecret: keys.managementSecret }), policy);
    expect(compareShareCreationRetry(initial, changedKey)).toBe('conflict');
    const project = structuredClone(requestFixture.project);
    project.metadata.author = 'Changed snapshot';
    const changedProject = await admitShareCreation(JSON.stringify({ ...requestFixture, project,
      projectDigest: await projectDigest(project) }), policy);
    expect(compareShareCreationRetry(initial, changedProject)).toBe('conflict');
    const otherOperation = await admitShareCreation(JSON.stringify({ ...requestFixture, operationKey: keys.operationKey }), policy);
    expect(compareShareCreationRetry(initial, otherOperation)).toBe('different-operation');
  });
  it('refuses a forged digest and never echoes metadata or secrets in errors', async () => {
    try {
      await admitShareCreation(JSON.stringify({ ...requestFixture, projectDigest: `sha256:${'0'.repeat(64)}` }), policy);
      throw new Error('Expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(SharingContractError);
      expect(error).toMatchObject({ code: 'digest-mismatch', message: 'digest-mismatch', status: 422 });
    }
  });
  it('reports the project byte limit before unsupported schema', async () => {
    const project = { ...requestFixture.project, schemaVersion: 9,
      metadata: { ...requestFixture.project.metadata, author: 'x'.repeat(384 * 1024) } };
    await expect(admitShareCreation(JSON.stringify({ ...requestFixture, project }), policy)).rejects.toMatchObject({ code: 'too-large' });
  });
  it.each([
    [{ shareFormatVersion: 2 }, 'unsupported-share-format'],
    [{ uploadPolicyRevision: 'future' }, 'unsupported-policy'],
    [{ digestCanonicalization: 'other' }, 'malformed-request'],
    [{ operationKey: 'short' }, 'malformed-request'],
    [{ managementSecret: 'A'.repeat(42) + 'B' }, 'malformed-request'],
    [{ managementSecret: requestFixture.operationKey }, 'malformed-request'],
    [{ secretExtra: 'DO NOT ECHO' }, 'malformed-request'],
  ])('rejects invalid creation fields %#', async (change, code) => {
    await expect(admitShareCreation(JSON.stringify({ ...requestFixture, ...change }), policy)).rejects.toMatchObject({ code });
  });
  it('refuses duplicate decoded names and invalid Unicode before normal parsing loses them', async () => {
    await expect(admitShareCreation('{"project":1,"\\u0070roject":2}', policy)).rejects.toMatchObject({ code: 'malformed-request' });
    await expect(admitShareCreation('{"project":"\\ud800"}', policy)).rejects.toMatchObject({ code: 'malformed-request' });
  });
  it('enforces the raw 512 KiB budget including whitespace and multibyte UTF-8', async () => {
    const body = rawRequest();
    const size = new TextEncoder().encode(body).length;
    await expect(admitShareCreation(body + ' '.repeat(MAX_CREATION_REQUEST_BYTES - size), policy)).resolves.toMatchObject({ projectDigest: requestFixture.projectDigest });
    await expect(admitShareCreation(body + ' '.repeat(MAX_CREATION_REQUEST_BYTES - size + 1), policy)).rejects.toMatchObject({ code: 'too-large', status: 413 });
    const utf8 = '"' + 'é'.repeat(16) + '"';
    expect(parseSharingJson(utf8, 34)).toBe('é'.repeat(16));
    expect(() => parseSharingJson(utf8, 33)).toThrow('resource-limit');
    expect(serializeShareCreationRequest(requestFixture as unknown as ShareCreationRequest)).toBe(body);
    const oversized = { ...requestFixture, operationKey: 'x'.repeat(MAX_CREATION_REQUEST_BYTES) };
    expect(() => serializeShareCreationRequest(oversized as unknown as ShareCreationRequest)).toThrow('too-large');
  });
  it('generates two distinct canonical 256-bit secrets and requires secure crypto', () => {
    const keys = generateShareCreationSecrets();
    for (const key of Object.values(keys)) {
      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(atob(key.replaceAll('-', '+').replaceAll('_', '/') + '=')).toHaveLength(32);
    }
    expect(keys.operationKey).not.toBe(keys.managementSecret);
    vi.stubGlobal('crypto', undefined);
    expect(() => generateShareCreationSecrets()).toThrow('unavailable');
  });
  it('maps absent digest crypto to service unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(admitShareCreation(rawRequest(), policy)).rejects.toMatchObject({ code: 'unavailable', status: 503 });
  });
});

describe('tagged public client support manifest', () => {
  const readManifest = (value: unknown) => readSharingClientSupportManifest(JSON.stringify(value), 'v1.2.0');
  it('preserves explicit unknown native support without inventing edit capability', () => {
    const manifest = readManifest(manifestFixture);
    expect(manifest).toEqual(manifestFixture);
    expect(manifest.minimumEditableIpadVersionBySchema[8]).toBeNull();
    expect(Object.isFrozen(manifest.minimumEditableIpadVersionBySchema)).toBe(true);
  });
  it('derives its complete schema range from the central project schema version', () => {
    expect(SHARING_PROJECT_SCHEMAS).toEqual(Array.from({ length: PROJECT_SCHEMA_VERSION - 2 }, (_, i) => i + 3));
  });
  it('reads older and newer release manifests independently of installed schema capability', () => {
    const older = { ...manifestFixture, webReadSchema: 7, viewerReadSchema: 7,
      minimumEditableIpadVersionBySchema: Object.fromEntries(Object.entries(manifestFixture.minimumEditableIpadVersionBySchema).filter(([key]) => key !== '8')) };
    expect(readManifest(older)).toEqual(older);
    const newer = { ...manifestFixture, webReadSchema: 9,
      minimumEditableIpadVersionBySchema: { ...manifestFixture.minimumEditableIpadVersionBySchema, '9': null } };
    expect(readManifest(newer)).toEqual(newer);
  });
  it.each([
    { ...manifestFixture, minimumEditableIpadVersionBySchema: { '3': null, '5': null } },
    { ...manifestFixture, webReadSchema: Number.MAX_SAFE_INTEGER },
  ])('refuses gaps and ceilings beyond the manifest map %#', value => {
    expect(() => readManifest(value)).toThrow(SharingContractError);
  });
  it('allows equal or increasing minimum versions across confirmed schemas', () => {
    const versions = { '3': '1.2.0', '4': '1.2.0', '5': '1.2.9', '6': '1.2.10', '7': '1.10.0', '8': '2.0.0' };
    expect(readManifest({ ...manifestFixture, minimumEditableIpadVersionBySchema: versions }).minimumEditableIpadVersionBySchema).toEqual(versions);
  });
  it('compares version components without binary64 rounding', () => {
    const versions = Object.fromEntries(SHARING_PROJECT_SCHEMAS.map(schema => [schema, '9007199254740992.0.0']));
    versions[7] = '9007199254740993.0.0';
    versions[8] = '9007199254740992.0.0';
    expect(() => readManifest({ ...manifestFixture, minimumEditableIpadVersionBySchema: versions })).toThrow('malformed-request');
  });
  it.each([
    { ...manifestFixture.minimumEditableIpadVersionBySchema, '6': null },
    { ...manifestFixture.minimumEditableIpadVersionBySchema, '7': '1.3.0', '8': '1.2.0' },
    { ...manifestFixture.minimumEditableIpadVersionBySchema, '7': '1.2.0', '8': '1.1.9' },
  ])('refuses contradictory native support %#', versions => {
    expect(() => readManifest({ ...manifestFixture, minimumEditableIpadVersionBySchema: versions })).toThrow('malformed-request');
  });
  it.each([
    { releaseTag: 'v1.3.0' }, { webReadSchema: 9 }, { viewerReadSchema: 2 },
    { minimumEditableIpadVersionBySchema: { '7': '1.2.0' } },
    { minimumEditableIpadVersionBySchema: { ...manifestFixture.minimumEditableIpadVersionBySchema, '8': '1.2.0-web.1' } },
    { minimumEditableIpadVersionBySchema: { ...manifestFixture.minimumEditableIpadVersionBySchema, '8': true } },
    { privateEvidence: 'must stay private' },
  ])('refuses invalid or incomplete public support data %#', change => {
    expect(() => readManifest({ ...manifestFixture, ...change })).toThrow(SharingContractError);
  });
});

describe('public snapshot envelope', () => {
  it('dispatches stored revisions independently of the current creation policy', async () => {
    const historical = { ...envelopeFixture, uploadPolicyRevision: 'historical-test-revision' };
    const historicalReader = vi.fn((project: unknown, _ceiling: number) =>
      validateProjectUpload(project, { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 }));
    await expect(readSharedProjectEnvelope(JSON.stringify(historical), id, 7, {
      'historical-test-revision': historicalReader,
    })).resolves.toEqual(historical);
    expect(historicalReader).toHaveBeenCalledOnce();
    expect(historicalReader).toHaveBeenCalledWith(historical.project, 7);
    await expect(readSharedProjectEnvelope(JSON.stringify(historical), id, 6, {
      'historical-test-revision': historicalReader,
    })).rejects.toMatchObject({ code: 'unsupported-schema' });
    await expect(readSharedProjectEnvelope(JSON.stringify(historical), id, 7)).rejects.toMatchObject({ code: 'unsupported-policy' });
    await expect(read({ ...envelopeFixture, uploadPolicyRevision: 'constructor' })).rejects.toMatchObject({ code: 'unsupported-policy' });
  });
  it('reads the fixed envelope with independent content verification', async () => {
    const envelope = await read();
    expect(envelope).toEqual(envelopeFixture);
    expect(Object.isFrozen(envelope.preview)).toBe(true);
  });
  it('projects admitted data into a generic public envelope without management fields', async () => {
    const admitted = await admitShareCreation(rawRequest(), policy);
    const result = await buildSharedProjectEnvelope(admitted, { id, createdAt: envelopeFixture.createdAt, releaseTag: 'v1.2.0' });
    expect(result).toEqual(envelopeFixture);
    expect(JSON.stringify(result)).not.toContain(admitted.managementSecretHash);
    expect(JSON.stringify(result)).not.toContain(admitted.operationKeyHash);
    expect(JSON.stringify(result)).not.toContain(admitted.requestDigest);
  });
  it.each([
    [{ shareFormatVersion: 2 }, 'unsupported-share-format'],
    [{ id: 'Z'.repeat(20) }, 'invalid-id'],
    [{ createdAt: '2026-02-30T00:00:00.000Z' }, 'malformed-request'],
    [{ uploadPolicyRevision: 'future' }, 'unsupported-policy'],
    [{ requirements: { projectSchema: 8, supportManifest: envelopeFixture.requirements.supportManifest } }, 'invalid-project'],
    [{ requirements: { projectSchema: 7, supportManifest: 'https://evil.test/manifest.json' } }, 'malformed-request'],
    [{ managementSecretHash: 'private' }, 'malformed-request'],
    [{ projectDigest: `sha256:${'0'.repeat(64)}` }, 'digest-mismatch'],
  ])('rejects invalid envelope fields %#', async (change, code) => {
    await expect(read({ ...envelopeFixture, ...change })).rejects.toMatchObject({ code });
  });
  it('uses the installed reader ceiling rather than trusting envelope requirements', async () => {
    const envelope = { ...envelopeFixture, project: schema8, projectDigest: await projectDigest(schema8),
      requirements: { ...envelopeFixture.requirements, projectSchema: 8 } };
    await expect(read(envelope)).rejects.toMatchObject({ code: 'unsupported-schema' });
    await expect(read(envelope, 8)).resolves.toEqual(envelope);
    await expect(readSharedProjectEnvelope('{}', '../bad', 8)).rejects.toMatchObject({ code: 'invalid-id' });
  });
  it.each([{ kind: 'generated', status: 'pending' }, { kind: 'generated', status: 'failed' },
    { kind: 'generated', status: 'ready', url: `/media/shares/${id}/v1.jpg` }])('accepts explicit generated preview variants %#', async preview => {
    await expect(read({ ...envelopeFixture, preview })).resolves.toMatchObject({ preview });
  });
  it.each([{ kind: 'generic', url: '/private' }, { kind: 'generated', status: 'pending', url: '/private' },
    { kind: 'generated', status: 'ready', url: 'https://evil.test/image.jpg' },
    { kind: 'generated', status: 'ready', url: `/media/shares/${'Z'.repeat(20)}/v1.jpg` },
    { kind: 'generated', status: 'ready' }])('rejects malformed or cross-share preview URLs %#', async preview => {
    await expect(read({ ...envelopeFixture, preview })).rejects.toMatchObject({ code: 'malformed-request' });
  });
  it('has stable status codes that distinguish revocation, absence, quotas and service failure', () => {
    expect(SHARING_ERROR_STATUS).toMatchObject({ 'not-found': 404, revoked: 410, 'quota-exceeded': 429, unavailable: 503, conflict: 409 });
    expect(supportManifestPath('v1.2.0-web.1')).toBe('/sharing/releases/v1.2.0-web.1.json');
    expect(() => supportManifestPath('../private')).toThrow('malformed-request');
  });
});
