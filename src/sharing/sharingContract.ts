import type { GuitarProject } from '../types/guitar';
import { canonicalizeJson, canonicalJsonDigest, CanonicalJsonError, parseSharingJson } from './canonicalJson';
import { UPLOAD_POLICY_REVISION, validateProjectUpload } from './projectAdmission';
import type { ProjectAdmissionPolicy } from './projectAdmission';
import { parseSharingReleaseTag } from './releasePolicy';

export const SHARE_FORMAT_VERSION = 1;
export const MAX_CREATION_REQUEST_BYTES = 512 * 1024;
export type ProjectDigest = `sha256:${string}`;
export type SharingErrorCode = 'malformed-request' | 'invalid-id' | 'unsupported-share-format' |
  'unsupported-policy' | 'unsupported-schema' | 'invalid-project' | 'digest-mismatch' |
  'too-large' | 'conflict' | 'not-found' | 'revoked' | 'quota-exceeded' | 'unavailable';
export const SHARING_ERROR_STATUS = {
  'malformed-request': 400, 'invalid-id': 400, 'unsupported-share-format': 422,
  'unsupported-policy': 422, 'unsupported-schema': 422, 'invalid-project': 422,
  'digest-mismatch': 422, 'too-large': 413, conflict: 409, 'not-found': 404,
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
/** Public compatibility data; null means native edit support is not confirmed. */
export interface SharingClientSupportManifest {
  shareFormatVersion: 1;
  releaseTag: string;
  webReadSchema: number;
  viewerReadSchema: number;
  minimumEditableIpadVersionBySchema: Record<3 | 4 | 5 | 6 | 7 | 8, string | null>;
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
function admittedProject(value: unknown, policy: ProjectAdmissionPolicy) {
  const result = validateProjectUpload(value, policy);
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
    if (typeof ceiling !== 'number' || !Number.isSafeInteger(ceiling) || ceiling < 3 || ceiling > 8) fail('unsupported-schema');
  }
  const versions = exact(manifest.minimumEditableIpadVersionBySchema, ['3', '4', '5', '6', '7', '8']);
  for (const version of Object.values(versions)) {
    if (version === null) continue;
    if (typeof version !== 'string') fail('malformed-request');
    const tag = parseSharingReleaseTag(`v${version}`);
    if (!tag || tag.hotfix) fail('malformed-request');
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
  const admitted = admittedProject(request.project, policy);
  freeze(admitted.project);
  const projectDigest = await digest(admitted.canonicalJson);
  if (projectDigest !== request.projectDigest) fail('digest-mismatch');
  const operationKeyHash = await secretHash('axe-sharing-operation-v1', request.operationKey);
  const managementSecretHash = await secretHash('axe-sharing-management-v1', request.managementSecret);
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
  maxReadableProjectSchema: number): Promise<SharedProjectEnvelope> {
  if (!isShareId(expectedId)) fail('invalid-id');
  if (!Number.isSafeInteger(maxReadableProjectSchema) || maxReadableProjectSchema < 3 || maxReadableProjectSchema > 8) {
    fail('unsupported-schema');
  }
  const envelope = exact(parse(source), keysFor<SharedProjectEnvelope>({
    shareFormatVersion: true, id: true, createdAt: true, uploadPolicyRevision: true,
    digestCanonicalization: true, projectDigest: true, project: true, requirements: true, preview: true,
  }));
  if (envelope.shareFormatVersion !== SHARE_FORMAT_VERSION) fail('unsupported-share-format');
  if (envelope.id !== expectedId) fail('invalid-id');
  if (envelope.uploadPolicyRevision !== UPLOAD_POLICY_REVISION) fail('unsupported-policy');
  if (typeof envelope.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(envelope.createdAt) ||
    !Number.isFinite(Date.parse(envelope.createdAt)) || new Date(envelope.createdAt).toISOString() !== envelope.createdAt) fail('malformed-request');
  if (envelope.digestCanonicalization !== 'rfc8785' || typeof envelope.projectDigest !== 'string' ||
    !DIGEST.test(envelope.projectDigest)) fail('malformed-request');
  const requirements = exact(envelope.requirements, ['projectSchema', 'supportManifest']);
  if (!isManifestPath(requirements.supportManifest)) fail('malformed-request');
  const admitted = admittedProject(envelope.project, { revision: UPLOAD_POLICY_REVISION,
    maxAcceptedProjectSchema: maxReadableProjectSchema });
  if (requirements.projectSchema !== admitted.project.schemaVersion) fail('invalid-project');
  validatePreview(envelope.preview, expectedId);
  freeze(envelope);
  if (await digest(admitted.canonicalJson) !== envelope.projectDigest) fail('digest-mismatch');
  return envelope as unknown as SharedProjectEnvelope;
}

/** Explicit projection prevents private transaction/control fields leaking into GET responses. */
export async function buildSharedProjectEnvelope(creation: AdmittedShareCreation,
  metadata: { id: string; createdAt: string; releaseTag: string }): Promise<SharedProjectEnvelope> {
  const envelope: SharedProjectEnvelope = {
    shareFormatVersion: SHARE_FORMAT_VERSION, id: metadata.id, createdAt: metadata.createdAt,
    uploadPolicyRevision: creation.uploadPolicyRevision, digestCanonicalization: 'rfc8785',
    projectDigest: creation.projectDigest, project: creation.project,
    requirements: { projectSchema: creation.project.schemaVersion, supportManifest: supportManifestPath(metadata.releaseTag) },
    preview: { kind: 'generic' },
  };
  return readSharedProjectEnvelope(JSON.stringify(envelope), metadata.id, 8);
}
