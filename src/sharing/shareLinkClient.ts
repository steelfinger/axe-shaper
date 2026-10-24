import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import type { GuitarProject, StoredProject } from '../types/guitar';
import { loadProject } from '../utils/presets';
import type { ProjectLoadResult } from '../utils/presets';
import { appCheckConfigured } from './appCheck';
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
export async function preflightShare(project: StoredProject, status: SharingStatus | null,
  attestationAvailable: boolean = appCheckConfigured()): Promise<SharePreflight> {
  if (!status || status.uploadPolicyRevision !== UPLOAD_POLICY_REVISION || !attestationAvailable) {
    return { ok: false, reason: 'unavailable' };
  }
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
  | { ok: false; code: SharingErrorCode | 'network' | 'attestation'; retryable: boolean };

/** Same-body retries are always safe; these are the failures a retry can fix. */
const RETRYABLE = new Set<string>(['network', 'unavailable', 'quota-exceeded', 'attestation', 'unauthorized']);
/** Retry-safe, but not in the next few seconds - left to the person's Try again. */
const MANUAL_ONLY = new Set<string>(['quota-exceeded', 'attestation', 'unauthorized']);
const AUTOMATIC_ATTEMPTS = [0, 1_000, 3_000];

/**
 * Send (and automatically resend) one pending creation. Safe to call again with
 * the same pending share. Each attempt carries a fresh App Check token; without
 * one nothing is sent.
 */
export async function sendShare(pending: PendingShare, fetchImpl: FetchLike, appCheckToken: () => Promise<string | null>,
  now: () => number = Date.now,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<ShareSendResult> {
  let last: ShareSendResult = { ok: false, code: 'network', retryable: true };
  for (const delay of AUTOMATIC_ATTEMPTS) {
    if (delay) await wait(delay);
    if (now() >= pending.deadline) return { ok: false, code: 'operation-expired', retryable: false };
    const token = await appCheckToken();
    if (!token) return { ok: false, code: 'attestation', retryable: true };
    if (now() >= pending.deadline) return { ok: false, code: 'operation-expired', retryable: false };
    try {
      const response = await fetchImpl('/api/shares', { method: 'POST', body: pending.body,
        signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': token } });
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
    // Quota, attestation and rejections will not clear in seconds; only transient failures auto-retry.
    if (!last.retryable || MANUAL_ONLY.has(last.code)) return last;
  }
  return last;
}

/** The one public URL for a share (docs/DESIGN_SHARING_AND_GALLERY_PLAN.md, "Public and creator routes"). */
export function shareUrl(origin: string, id: string): string {
  return `${origin}/share/${id}`;
}

/**
 * Share ID from a browser route: `/app/share/:id` (editable copy),
 * `/download/share/:id` (project download) or `/manage/share/:id` (creator
 * management), or null. `/share/:id` itself is the
 * server-rendered landing page, never an SPA route.
 */
export function shareIdFromPath(pathname: string, route: 'app' | 'download' | 'manage' = 'app'): string | null {
  const match = new RegExp(`^/${route}/share/([^/]+)/?$`).exec(pathname);
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
    `Manage it at: ${new URL(url).origin}/manage/share/${id}`,
    '',
    'Keep this file private. Anyone with the management key can remove this link.',
    'The link itself is safe to share; it does not contain this key.',
    '',
  ].join('\n');
}

const MANAGEMENT_KEY = /^[A-Za-z0-9_-]{43}$/;

/**
 * A management key from what the creator pastes: the bare key, or the whole
 * recovery file. Null when there is no well-formed key in it.
 */
export function managementKeyFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (MANAGEMENT_KEY.test(trimmed)) return trimmed;
  const line = /^Management key:\s*([A-Za-z0-9_-]{43})\s*$/m.exec(input);
  return line ? line[1] : null;
}

/** Keys for links created on this device. A convenience only - the recovery file is the durable copy. */
export interface StoredShareKey { managementSecret: string; title: string; createdAt: string }
type KeyStorage = Pick<Storage, 'getItem' | 'setItem'>;
const KEY_STORE = 'axe-shaper.sharing.keys.v1';

function readKeys(storage: KeyStorage | null): Record<string, StoredShareKey> {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY_STORE) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, StoredShareKey> : {};
  } catch {
    return {};
  }
}
export function rememberShareKey(storage: KeyStorage | null, id: string, key: StoredShareKey): boolean {
  try {
    if (!storage) return false;
    // Per-share records avoid a read/modify/write race between tabs.
    const name = `${KEY_STORE}.${id}`;
    const value = JSON.stringify(key);
    storage.setItem(name, value);
    return storage.getItem(name) === value;
  } catch { return false; }
}
export function storedShareKey(storage: KeyStorage | null, id: string): StoredShareKey | null {
  let entry = readKeys(storage)[id];
  try {
    const saved = storage?.getItem(`${KEY_STORE}.${id}`);
    if (saved !== null && saved !== undefined) entry = JSON.parse(saved);
  } catch { /* Legacy key remains usable. */ }
  return entry && typeof entry.managementSecret === 'string' && MANAGEMENT_KEY.test(entry.managementSecret) ? entry : null;
}
export function forgetShareKey(storage: KeyStorage | null, id: string): void {
  const keys = readKeys(storage);
  delete keys[id];
  try {
    storage?.setItem(`${KEY_STORE}.${id}`, 'null');
    storage?.setItem(KEY_STORE, JSON.stringify(keys));
  } catch { /* nothing to undo */ }
}

export type ManagedShare = { ok: true; state: 'active' | 'revoked'; revokedAt: string | null } | { ok: false; message: string };

/**
 * Creator status (`GET`) or removal (`DELETE`). The key travels only in the
 * Authorization header - never a URL. A wrong key and an unknown share answer
 * the same, so neither reveals whether the other exists.
 */
export async function manageShare(id: string, managementSecret: string, action: 'status' | 'revoke',
  fetchImpl: FetchLike): Promise<ManagedShare> {
  try {
    const response = await fetchImpl(action === 'status' ? `/api/shares/${id}/manage` : `/api/shares/${id}`, {
      method: action === 'status' ? 'GET' : 'DELETE', cache: 'no-store',
      headers: { Authorization: `Bearer ${managementSecret}` },
    });
    const payload = await response.json().catch(() => null) as
      { state?: unknown; revokedAt?: unknown; error?: { code?: unknown } } | null;
    if (response.ok && (payload?.state === 'active' || payload?.state === 'revoked')) {
      return { ok: true, state: payload.state, revokedAt: typeof payload.revokedAt === 'string' ? payload.revokedAt : null };
    }
    const code = payload?.error?.code;
    if (code === 'not-found' || code === 'unauthorized') {
      return { ok: false, message: 'That key does not match this link. Check that you pasted the key for this design.' };
    }
    if (code === 'quota-exceeded') return { ok: false, message: 'Too many attempts. Wait a minute and try again.' };
    return { ok: false, message: 'The sharing service did not respond. Try again in a moment.' };
  } catch {
    return { ok: false, message: 'The sharing service could not be reached. Check your connection and try again.' };
  }
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
