import type { GuitarProject } from '../types/guitar';
import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import { canonicalizeJson, canonicalJsonDigest, CanonicalJsonError, parseSharingJson } from './canonicalJson';
import { validateProjectUpload, PROJECT_REVISION_READERS } from './projectAdmission';
import type { ProjectAdmissionPolicy, ProjectAdmissionResult, ProjectRevisionReaders } from './projectAdmission';
import { parseSharingReleaseTag } from './releasePolicy';

export const SHARE_FORMAT_VERSION = 1;
export const MAX_CREATION_REQUEST_BYTES = 512 * 1024;
/** Fixed v1 protection window, known before sending even if every response is lost. */
export const SHARE_OPERATION_TTL_MS = 24 * 60 * 60 * 1000;
export const SHARE_RETRY_SAFETY_MARGIN_MS = 60 * 1000;
/** Persist with the pending operation BEFORE its first send; never extend on retry. */
export function shareCreationRetryDeadline(startedAt: number): number {
  const deadline = startedAt + SHARE_OPERATION_TTL_MS - SHARE_RETRY_SAFETY_MARGIN_MS;
  if (!Number.isSafeInteger(startedAt) || startedAt < 0 || !Number.isSafeInteger(deadline)) {
    throw new SharingContractError('malformed-request');
  }
  return deadline;
}
export type ProjectDigest = `sha256:${string}`;
export type SharingErrorCode = 'unauthorized' | 'method-not-allowed' | 'malformed-request' | 'invalid-id' | 'unsupported-share-format' |
  'unsupported-policy' | 'unsupported-schema' | 'invalid-project' | 'digest-mismatch' |
  'too-large' | 'conflict' | 'operation-expired' | 'not-found' | 'revoked' | 'quota-exceeded' | 'unavailable';
export const SHARING_ERROR_STATUS = {
  unauthorized: 401, 'method-not-allowed': 405, 'malformed-request': 400, 'invalid-id': 400, 'unsupported-share-format': 422,
  'unsupported-policy': 422, 'unsupported-schema': 422, 'invalid-project': 422,
  'digest-mismatch': 422, 'too-large': 413, conflict: 409, 'operation-expired': 409, 'not-found': 404,
  revoked: 410, 'quota-exceeded': 429, unavailable: 503,
} as const satisfies Record<SharingErrorCode, number>;

/** Fixed messages: never include request metadata, keys or arbitrary field names. */
export class SharingContractError extends Error {
  readonly code: SharingErrorCode;
  constructor(code: SharingErrorCode) { super(code); this.name = 'SharingContractError'; this.code = code; }
  get status(): number { return SHARING_ERROR_STATUS[this.code]; }
}
function fail(code: SharingErrorCode): never { throw new SharingContractError(code); }

export interface ShareCreationRequest {
  shareFormatVersion: 1;
  uploadPolicyRevision: string;
  digestCanonicalization: 'rfc8785';
  project: GuitarProject;
  projectDigest: ProjectDigest;
  operationKey: string;
  managementSecret: string;
}
/** Private transaction input. Plaintext keys do not survive validation. */
export interface AdmittedShareCreation {
  project: GuitarProject;
  projectDigest: ProjectDigest;
  uploadPolicyRevision: string;
  operationKeyHash: ProjectDigest;
  managementSecretHash: ProjectDigest;
  requestDigest: ProjectDigest;
}
export type SharePreview = { kind: 'generic' } |
  { kind: 'generated'; status: 'pending' | 'failed' } |
  { kind: 'generated'; status: 'ready'; url: string };
export interface SharedProjectEnvelope {
  shareFormatVersion: 1;
  id: string;
  createdAt: string;
  uploadPolicyRevision: string;
  digestCanonicalization: 'rfc8785';
  projectDigest: ProjectDigest;
  project: GuitarProject;
  requirements: { projectSchema: number; supportManifest: string };
  preview: SharePreview;
}
type SchemaRange<Max extends number, Values extends number[] = []> = Values['length'] extends Max
  ? Values[number] | Max : SchemaRange<Max, [...Values, Values['length']]>;
export type SharingProjectSchema = Exclude<SchemaRange<typeof PROJECT_SCHEMA_VERSION>, 0 | 1 | 2>;
export const SHARING_PROJECT_SCHEMAS = Object.freeze(Array.from({ length: PROJECT_SCHEMA_VERSION - 2 },
  (_, index) => index + 3) as SharingProjectSchema[]);

/** Public compatibility data; null means native edit support is not confirmed. */
export interface SharingClientSupportManifest {
  shareFormatVersion: 1;
  releaseTag: string;
  webReadSchema: number;
  viewerReadSchema: number;
  minimumEditableIpadVersionBySchema: Record<number, string | null>;
}

const ID = /^[A-Za-z0-9]{20}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
// Canonical unpadded base64url for exactly 32 bytes (256 bits).
const SECRET = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export function isShareId(value: unknown): value is string { return typeof value === 'string' && ID.test(value); }
export function supportManifestPath(releaseTag: string): string {
  if (!parseSharingReleaseTag(releaseTag)) fail('malformed-request');
  return `/sharing/releases/${releaseTag}.json`;
}
function isManifestPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^\/sharing\/releases\/([^/]+)\.json$/.exec(value);
  return !!match && !!parseSharingReleaseTag(match[1]);
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('malformed-request');
  const names = Object.keys(value);
  if (names.length !== keys.length || names.some(key => !keys.includes(key))) fail('malformed-request');
  return value as Record<string, unknown>;
}
// Adding a contract field must update its boundary's field set deliberately.
function keysFor<T>(fields: Record<keyof T, true>): string[] { return Object.keys(fields); }
function freeze(value: unknown): void {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
}
function parse(source: string, limit?: number): unknown {
  try { return parseSharingJson(source, limit); } catch (error) { return mapError(error); }
}
function mapError(error: unknown): never {
  if (error instanceof CanonicalJsonError) {
    fail(error.code === 'resource-limit' ? 'too-large' : error.code === 'crypto-unavailable' ? 'unavailable' : 'malformed-request');
  }
  throw error;
}
function requireAdmitted(result: ProjectAdmissionResult) {
  if (!result.ok) {
    fail(result.code === 'unsupported-schema' || result.code === 'unsupported-policy' ? result.code :
      result.code === 'resource-limit' ? 'too-large' : 'invalid-project');
  }
  return result;
}
async function digest(text: ReturnType<typeof canonicalizeJson>): Promise<ProjectDigest> {
  try { return await canonicalJsonDigest(text); } catch (error) { return mapError(error); }
}
async function secretHash(domain: string, secret: string): Promise<ProjectDigest> {
  return digest(canonicalizeJson({ domain, secret }));
}

/** Header-supplied creator capability, using the same domain as creation. */
export async function hashShareManagementSecret(secret: string): Promise<ProjectDigest> {
  if (typeof secret !== 'string' || !SECRET.test(secret)) fail('malformed-request');
  return secretHash('axe-sharing-management-v1', secret);
}

/** Generate both keys before persisting a pending operation or sending a request. */
export function generateShareCreationSecrets(): Pick<ShareCreationRequest, 'operationKey' | 'managementSecret'> {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues || !crypto.subtle) fail('unavailable');
  const key = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const operationKey = key();
  const managementSecret = key();
  if (managementSecret === operationKey) fail('unavailable');
  return { operationKey, managementSecret };
}

/** Client transport preflight on the exact body sent; admission remains server-authoritative. */
export function serializeShareCreationRequest(request: ShareCreationRequest): string {
  const source = JSON.stringify(request);
  parse(source, MAX_CREATION_REQUEST_BYTES);
  return source;
}

// Compare validated SemVer numeric components without losing integer precision.
function compareMarketingVersions(left: string, right: string): number {
  const a = left.split('.');
  const b = right.split('.');
  for (let i = 0; i < 3; i++) {
    if (a[i].length !== b[i].length) return a[i].length - b[i].length;
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

/** Structural check only: deployed native-version evidence must be independently verified. */
export function readSharingClientSupportManifest(source: string, expectedReleaseTag: string): SharingClientSupportManifest {
  supportManifestPath(expectedReleaseTag);
  const manifest = exact(parse(source), keysFor<SharingClientSupportManifest>({
    shareFormatVersion: true, releaseTag: true, webReadSchema: true, viewerReadSchema: true,
    minimumEditableIpadVersionBySchema: true,
  }));
  if (manifest.shareFormatVersion !== SHARE_FORMAT_VERSION) fail('unsupported-share-format');
  if (manifest.releaseTag !== expectedReleaseTag) fail('malformed-request');
  for (const ceiling of [manifest.webReadSchema, manifest.viewerReadSchema]) {
    if (typeof ceiling !== 'number' || !Number.isSafeInteger(ceiling) || ceiling < 3) fail('unsupported-schema');
  }
  // The manifest describes its release, independently of this installed reader.
  const versions = manifest.minimumEditableIpadVersionBySchema;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) fail('malformed-request');
  const count = Object.keys(versions).length;
  if (!count || !Array.from({ length: count }, (_, index) => String(index + 3))
    .every(key => Object.hasOwn(versions, key))) fail('malformed-request');
  const maximum = count + 2;
  if ((manifest.webReadSchema as number) > maximum || (manifest.viewerReadSchema as number) > maximum) fail('malformed-request');
  let previousVersion: string | undefined;
  let unconfirmed = false;
  for (let schema = 3; schema <= maximum; schema++) {
    const version = (versions as Record<string, unknown>)[String(schema)];
    if (version === null) { unconfirmed = true; continue; }
    if (unconfirmed) fail('malformed-request');
    if (typeof version !== 'string') fail('malformed-request');
    const tag = parseSharingReleaseTag(`v${version}`);
    if (!tag || tag.hotfix) fail('malformed-request');
    if (previousVersion && compareMarketingVersions(version, previousVersion) < 0) fail('malformed-request');
    previousVersion = version;
  }
  freeze(manifest);
  return manifest as unknown as SharingClientSupportManifest;
}

/**
 * Raw JSON boundary for POST /api/shares. Enforce the whole transport budget
 * before parsing; recompute content identity rather than trusting the client.
 * The returned value contains only hashes for storage/transaction comparison.
 */
export async function admitShareCreation(source: string, policy: ProjectAdmissionPolicy): Promise<AdmittedShareCreation> {
  const request = exact(parse(source, MAX_CREATION_REQUEST_BYTES), keysFor<ShareCreationRequest>({
    shareFormatVersion: true, uploadPolicyRevision: true, digestCanonicalization: true, project: true,
    projectDigest: true, operationKey: true, managementSecret: true,
  }));
  if (request.shareFormatVersion !== SHARE_FORMAT_VERSION) fail('unsupported-share-format');
  if (request.uploadPolicyRevision !== policy.revision) fail('unsupported-policy');
  if (request.digestCanonicalization !== 'rfc8785' || typeof request.projectDigest !== 'string' ||
    !DIGEST.test(request.projectDigest)) fail('malformed-request');
  if (typeof request.operationKey !== 'string' || !SECRET.test(request.operationKey) ||
    typeof request.managementSecret !== 'string' || !SECRET.test(request.managementSecret) ||
    request.operationKey === request.managementSecret) fail('malformed-request');
  const admitted = requireAdmitted(validateProjectUpload(request.project, policy));
  freeze(admitted.project);
  const projectDigest = await digest(admitted.canonicalJson);
  if (projectDigest !== request.projectDigest) fail('digest-mismatch');
  const operationKeyHash = await secretHash('axe-sharing-operation-v1', request.operationKey);
  const managementSecretHash = await hashShareManagementSecret(request.managementSecret);
  // Compare under the operation-key hash; bind content AND management authority.
  const requestDigest = await digest(canonicalizeJson({
    domain: 'axe-sharing-creation-v1', shareFormatVersion: SHARE_FORMAT_VERSION,
    uploadPolicyRevision: policy.revision, digestCanonicalization: 'rfc8785',
    projectDigest, managementSecretHash,
  }));
  return Object.freeze({ project: admitted.project, projectDigest, uploadPolicyRevision: policy.revision,
    operationKeyHash, managementSecretHash, requestDigest });
}

/** Transaction adapters must check revoked state too; matching hashes never revive a share. */
export function compareShareCreationRetry(previous: Pick<AdmittedShareCreation, 'operationKeyHash' | 'requestDigest'>,
  next: Pick<AdmittedShareCreation, 'operationKeyHash' | 'requestDigest'>): 'different-operation' | 'same-request' | 'conflict' {
  if (previous.operationKeyHash !== next.operationKeyHash) return 'different-operation';
  return previous.requestDigest === next.requestDigest ? 'same-request' : 'conflict';
}

function validatePreview(value: unknown, id: string): SharePreview {
  const preview = value as Partial<SharePreview> | null;
  if (preview?.kind === 'generic') { exact(value, ['kind']); return value as SharePreview; }
  if (preview?.kind !== 'generated') fail('malformed-request');
  if (preview.status === 'pending' || preview.status === 'failed') {
    exact(value, ['kind', 'status']); return value as SharePreview;
  }
  const ready = exact(value, ['kind', 'status', 'url']);
  if (ready.status !== 'ready' || ready.url !== `/media/shares/${id}/v1.jpg`) fail('malformed-request');
  return value as SharePreview;
}

/** Reader capabilities belong to the installed client, never to the received envelope. */
export async function readSharedProjectEnvelope(source: string, expectedId: string,
  maxReadableProjectSchema: number, revisionReaders: ProjectRevisionReaders = PROJECT_REVISION_READERS): Promise<SharedProjectEnvelope> {
  if (!isShareId(expectedId)) fail('invalid-id');
  if (!Number.isSafeInteger(maxReadableProjectSchema) || maxReadableProjectSchema < 3 || maxReadableProjectSchema > PROJECT_SCHEMA_VERSION) {
    fail('unsupported-schema');
  }
  const envelope = exact(parse(source), keysFor<SharedProjectEnvelope>({
    shareFormatVersion: true, id: true, createdAt: true, uploadPolicyRevision: true,
    digestCanonicalization: true, projectDigest: true, project: true, requirements: true, preview: true,
  }));
  if (envelope.shareFormatVersion !== SHARE_FORMAT_VERSION) fail('unsupported-share-format');
  if (envelope.id !== expectedId) fail('invalid-id');
  const revision = envelope.uploadPolicyRevision;
  if (typeof revision !== 'string' || !Object.hasOwn(revisionReaders, revision)) fail('unsupported-policy');
  const reader = revisionReaders[revision];
  if (typeof envelope.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(envelope.createdAt) ||
    !Number.isFinite(Date.parse(envelope.createdAt)) || new Date(envelope.createdAt).toISOString() !== envelope.createdAt) fail('malformed-request');
  if (envelope.digestCanonicalization !== 'rfc8785' || typeof envelope.projectDigest !== 'string' ||
    !DIGEST.test(envelope.projectDigest)) fail('malformed-request');
  const requirements = exact(envelope.requirements, ['projectSchema', 'supportManifest']);
  if (!isManifestPath(requirements.supportManifest)) fail('malformed-request');
  const admitted = requireAdmitted(reader(envelope.project, maxReadableProjectSchema));
  // Retained validators may have their own historical ceiling; installed
  // reader capability is still authoritative at the shared envelope boundary.
  if (admitted.project.schemaVersion > maxReadableProjectSchema) fail('unsupported-schema');
  if (requirements.projectSchema !== admitted.project.schemaVersion) fail('invalid-project');
  validatePreview(envelope.preview, expectedId);
  freeze(envelope);
  if (await digest(admitted.canonicalJson) !== envelope.projectDigest) fail('digest-mismatch');
  return envelope as unknown as SharedProjectEnvelope;
}

/**
 * Explicit projection prevents private fields leaking into GET responses. The
 * deliberate read-back self-check repeats admission/hash work to verify exactly
 * what will be served, including serialization and server-assigned metadata.
 */
export async function buildSharedProjectEnvelope(creation: AdmittedShareCreation,
  metadata: { id: string; createdAt: string; releaseTag: string }): Promise<SharedProjectEnvelope> {
  const envelope: SharedProjectEnvelope = {
    shareFormatVersion: SHARE_FORMAT_VERSION, id: metadata.id, createdAt: metadata.createdAt,
    uploadPolicyRevision: creation.uploadPolicyRevision, digestCanonicalization: 'rfc8785',
    projectDigest: creation.projectDigest, project: creation.project,
    requirements: { projectSchema: creation.project.schemaVersion, supportManifest: supportManifestPath(metadata.releaseTag) },
    preview: { kind: 'generic' },
  };
  return readSharedProjectEnvelope(JSON.stringify(envelope), metadata.id, PROJECT_SCHEMA_VERSION);
}
