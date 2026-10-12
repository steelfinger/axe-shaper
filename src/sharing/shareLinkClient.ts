import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import type { GuitarProject, StoredProject } from '../types/guitar';
import { loadProject } from '../utils/presets';
import type { ProjectLoadResult } from '../utils/presets';
import { prepareSharedProject } from './prepareSharedProject';
import { UPLOAD_POLICY_REVISION } from './projectAdmission';
import {
  generateShareCreationSecrets, isShareId, readSharedProjectEnvelope, serializeShareCreationRequest,
  SHARE_FORMAT_VERSION, shareCreationRetryDeadline, SharingContractError,
} from './sharingContract';
import type { ProjectDigest, SharingErrorCode } from './sharingContract';

/**
 * Browser side of "Create link" and of opening a shared design. Pure apart from
 * the injected fetch/clock, so it is unit-tested without a DOM.
 */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The web app has no App Check yet. Staging's Function runs in
 * `staging-bypass` and accepts any non-empty token; it refuses that mode on
 * axe-shaper-web, so this can never authorize a production creation. Replace
 * with a real App Check token before sharing ships live.
 */
const APP_CHECK_PLACEHOLDER_TOKEN = 'unattested';

export interface SharingStatus {
  uploadPolicyRevision: string;
  maxAcceptedProjectSchema: number;
  creationAvailable: boolean;
  projectReadAvailable: boolean;
}

/** Advisory only - the server re-checks everything. Null when it cannot be read. */
export async function fetchSharingStatus(fetchImpl: FetchLike): Promise<SharingStatus | null> {
  try {
    const response = await fetchImpl('/api/sharing-status', { cache: 'no-store' });
    if (!response.ok) return null;
    const status = await response.json() as Partial<SharingStatus>;
    if (typeof status.uploadPolicyRevision !== 'string' || !Number.isInteger(status.maxAcceptedProjectSchema) ||
      typeof status.creationAvailable !== 'boolean' || typeof status.projectReadAvailable !== 'boolean') return null;
    return status as SharingStatus;
  } catch {
    return null;
  }
}

export type ShareBlockReason = 'unavailable' | 'paused' | 'newer-fields' | 'unsupported-schema' | 'invalid' | 'too-large';
export type SharePreflight =
  | { ok: true; project: GuitarProject; digest: ProjectDigest; policyRevision: string }
  | { ok: false; reason: ShareBlockReason };

/** Run the server's own admission rules on the exact payload before asking for consent. */
export async function preflightShare(project: StoredProject, status: SharingStatus | null): Promise<SharePreflight> {
  if (!status || status.uploadPolicyRevision !== UPLOAD_POLICY_REVISION) return { ok: false, reason: 'unavailable' };
  if (!status.creationAvailable) return { ok: false, reason: 'paused' };
  const prepared = await prepareSharedProject(project, {
    revision: status.uploadPolicyRevision, maxAcceptedProjectSchema: status.maxAcceptedProjectSchema,
  });
  if (prepared.ok) {
    return { ok: true, project: prepared.project, digest: prepared.digest as ProjectDigest, policyRevision: status.uploadPolicyRevision };
  }
  switch (prepared.code) {
    case 'unknown-vocabulary': return { ok: false, reason: 'newer-fields' };
    case 'unsupported-schema': return { ok: false, reason: 'unsupported-schema' };
    case 'resource-limit': return { ok: false, reason: 'too-large' };
    case 'crypto-unavailable': case 'unsupported-policy': return { ok: false, reason: 'unavailable' };
    default: return { ok: false, reason: 'invalid' };
  }
}

/**
 * One confirmed creation. The body (and so the operation key) is fixed here and
 * reused by every retry, which is what makes a retry return the same share
 * instead of a second one. The deadline is fixed before the first send and
 * never extended.
 */
export interface PendingShare { body: string; managementSecret: string; deadline: number }

export function beginShare(prepared: Extract<SharePreflight, { ok: true }>, now: number): PendingShare {
  const secrets = generateShareCreationSecrets();
  const body = serializeShareCreationRequest({
    shareFormatVersion: SHARE_FORMAT_VERSION, uploadPolicyRevision: prepared.policyRevision,
    digestCanonicalization: 'rfc8785', project: prepared.project, projectDigest: prepared.digest, ...secrets,
  });
  return { body, managementSecret: secrets.managementSecret, deadline: shareCreationRetryDeadline(now) };
}

export type ShareSendResult =
  | { ok: true; id: string; createdAt: string }
  | { ok: false; code: SharingErrorCode | 'network'; retryable: boolean };

const RETRYABLE = new Set<string>(['network', 'unavailable', 'quota-exceeded']);
const AUTOMATIC_ATTEMPTS = [0, 1_000, 3_000];

/** Send (and automatically resend) one pending creation. Safe to call again with the same pending share. */
export async function sendShare(pending: PendingShare, fetchImpl: FetchLike, now: () => number = Date.now,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<ShareSendResult> {
  let last: ShareSendResult = { ok: false, code: 'network', retryable: true };
  for (const delay of AUTOMATIC_ATTEMPTS) {
    if (delay) await wait(delay);
    if (now() >= pending.deadline) return { ok: false, code: 'operation-expired', retryable: false };
    try {
      const response = await fetchImpl('/api/shares', { method: 'POST', body: pending.body,
        headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': APP_CHECK_PLACEHOLDER_TOKEN } });
      const payload = await response.json().catch(() => null) as
        { id?: unknown; createdAt?: unknown; error?: { code?: unknown } } | null;
      if (response.ok && isShareId(payload?.id) && typeof payload?.createdAt === 'string') {
        return { ok: true, id: payload.id, createdAt: payload.createdAt };
      }
      const code = (typeof payload?.error?.code === 'string' ? payload.error.code : 'unavailable') as SharingErrorCode;
      last = { ok: false, code, retryable: RETRYABLE.has(code) };
    } catch {
      last = { ok: false, code: 'network', retryable: true };
    }
    // Quota and rejections will not clear in seconds; only transient failures auto-retry.
    if (!last.retryable || last.code === 'quota-exceeded') return last;
  }
  return last;
}

/** The one public URL for a share (docs/DESIGN_SHARING_AND_GALLERY_PLAN.md, "Public and creator routes"). */
export function shareUrl(origin: string, id: string): string {
  return `${origin}/share/${id}`;
}

/** Share ID from `/share/:id` or `/app/share/:id`, or null. */
export function shareIdFromPath(pathname: string): string | null {
  const match = /^(?:\/app)?\/share\/([^/]+)\/?$/.exec(pathname);
  return match && isShareId(match[1]) ? match[1] : null;
}

/** What the creator keeps to manage or revoke the link later. Never sent anywhere. */
export function recoveryKeyText(url: string, id: string, managementSecret: string, title: string): string {
  return [
    'Axe Shaper shared link - recovery key',
    '',
    `Design: ${title}`,
    `Link: ${url}`,
    `Share ID: ${id}`,
    `Management key: ${managementSecret}`,
    '',
    'Keep this file private. Anyone with the management key can remove this link.',
    'The link itself is safe to share; it does not contain this key.',
    '',
  ].join('\n');
}

/** Fetch a share and run it through the same gate as every other open. */
export async function loadSharedProject(id: string, fetchImpl: FetchLike): Promise<ProjectLoadResult> {
  const failed = (message: string): ProjectLoadResult => ({ ok: false, reason: 'unreadable', message });
  let text: string;
  try {
    const response = await fetchImpl(`/api/shares/${id}`, { cache: 'no-store' });
    text = await response.text();
    if (!response.ok) {
      const code = (JSON.parse(text) as { error?: { code?: string } }).error?.code;
      if (code === 'revoked') return failed('This shared design has been removed by the person who shared it.');
      if (code === 'not-found' || code === 'invalid-id') return failed('This share link does not point to a design.');
      return failed('The shared design could not be opened right now. Try again in a moment.');
    }
  } catch {
    return failed('The shared design could not be opened. Check your connection and try again.');
  }
  try {
    const envelope = await readSharedProjectEnvelope(text, id, PROJECT_SCHEMA_VERSION);
    return loadProject(envelope.project);
  } catch (error) {
    if (error instanceof SharingContractError && error.code === 'unsupported-schema') {
      return failed('This design was shared from a newer version of Axe Shaper. Reload the page to update, then try again.');
    }
    return failed('The shared design could not be read.');
  }
}
