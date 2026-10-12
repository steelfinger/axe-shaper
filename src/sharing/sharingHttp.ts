import { MAX_CREATION_REQUEST_BYTES, isShareId, SharingContractError } from './sharingContract';
import type { ProjectDigest } from './sharingContract';
import type { createSnapshotService } from './snapshotService';

export type SharingRequestKind = 'create' | 'status' | 'read' | 'manage' | 'revoke';
/** Supplied by the server adapter from trusted proxy metadata, never request JSON/headers. */
export interface SharingHttpContext { clientKey: ProjectDigest }
export interface SharingHttpDependencies {
  service: ReturnType<typeof createSnapshotService>;
  /** False means invalid/missing attestation; infrastructure errors must throw. */
  verifyAppCheck(token: string): Promise<boolean>;
  /** Required ingress limiter, independent of accepted-creation quotas. */
  allowRequest(kind: SharingRequestKind, context: SharingHttpContext, id?: string): Promise<boolean>;
}

function fail(code: ConstructorParameters<typeof SharingContractError>[0]): never {
  throw new SharingContractError(code);
}
function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extraHeaders,
  } });
}

/** Read at most the whole-request budget before decoding/parsing. No Request.text(). */
async function creationBody(request: Request): Promise<string> {
  if (!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(request.headers.get('content-type') ?? '')) {
    fail('malformed-request');
  }
  const encoding = request.headers.get('content-encoding');
  if (encoding && encoding.toLowerCase() !== 'identity') fail('malformed-request');
  const length = request.headers.get('content-length');
  let declared: number | undefined;
  if (length !== null) {
    if (!/^\d{1,20}$/.test(length)) fail('malformed-request');
    declared = Number(length);
    if (declared > MAX_CREATION_REQUEST_BYTES) fail('too-large');
  }
  if (!request.body) fail('malformed-request');
  const reader = request.body.getReader();
  const body = new Uint8Array(MAX_CREATION_REQUEST_BYTES);
  let bytes = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  request.signal.addEventListener('abort', cancel, { once: true });
  try {
    if (request.signal.aborted) fail('malformed-request');
    while (true) {
      const chunk = await reader.read();
      if (request.signal.aborted) fail('malformed-request');
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_CREATION_REQUEST_BYTES) fail('too-large');
      // Copy into one bounded buffer, even for many tiny chunks or a producer
      // that reuses its chunk buffer.
      body.set(chunk.value, bytes - chunk.value.byteLength);
    }
    if (declared !== undefined && declared !== bytes) fail('malformed-request');
    // Preserve a BOM so the strict JSON parser refuses it, rather than silently
    // changing the submitted text. Malformed UTF-8 never becomes replacement text.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body.subarray(0, bytes));
  } catch (error) {
    cancel();
    if (error instanceof SharingContractError) throw error;
    return fail('malformed-request');
  } finally { request.signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}

function managementKey(request: Request): string {
  // Bound credentials and refuse query/body transport. The service checks the
  // canonical base64url encoding and hashes this capability before storage.
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) fail('unauthorized');
  return match[1];
}

/**
 * Fetch-compatible local HTTP adapter. The hosting bridge must impose timeouts,
 * header limits, trusted-origin/CORS policy and limits before framework buffering.
 * No Firebase SDK, proxy-header trust, production credentials or deployment here.
 */
export function createSharingHttpHandler(dependencies: SharingHttpDependencies) {
  const { service, verifyAppCheck, allowRequest } = dependencies;
  return async (request: Request, context: SharingHttpContext): Promise<Response> => {
    try {
      const url = new URL(request.url);
      // APIs have no query parameters, especially no creator keys in URLs.
      if (url.search) fail('malformed-request');
      let kind: SharingRequestKind;
      let allowed: string;
      let id: string | undefined;
      if (url.pathname === '/api/shares') { kind = 'create'; allowed = 'POST'; }
      else if (url.pathname === '/api/sharing-status') { kind = 'status'; allowed = 'GET'; }
      else {
        const match = /^\/api\/shares\/([^/]+)(\/manage)?$/.exec(url.pathname);
        if (!match) fail('not-found');
        id = match[1];
        if (!isShareId(id)) fail('invalid-id');
        if (match[2]) { kind = 'manage'; allowed = 'GET'; }
        else { kind = request.method === 'DELETE' ? 'revoke' : 'read'; allowed = 'GET, DELETE'; }
      }
      if (!allowed.split(', ').includes(request.method)) {
        return json({ error: { code: 'method-not-allowed' } }, 405, { Allow: allowed });
      }
      if (kind !== 'create' && request.body) fail('malformed-request');
      if (!context || !/^sha256:[0-9a-f]{64}$/.test(context.clientKey)) fail('unavailable');
      if (!await allowRequest(kind, context, id)) fail('quota-exceeded');
      if (kind === 'create') {
        const token = request.headers.get('x-firebase-appcheck');
        if (!token || token.length > 8192 || !await verifyAppCheck(token)) fail('unauthorized');
        const result = await service.create(await creationBody(request), context.clientKey);
        return json(result, result.replayed ? 200 : 201);
      }
      if (kind === 'status') return json(await service.status());
      if (kind === 'read') return json(await service.read(id!));
      const key = managementKey(request);
      return json(kind === 'manage' ? await service.managementStatus(id!, key) : await service.revoke(id!, key));
    } catch (error) {
      if (error instanceof SharingContractError) return json({ error: { code: error.code } }, error.status);
      // Never serialize stack traces or SDK/limiter/verifier errors.
      return json({ error: { code: 'unavailable' } }, 503);
    } finally {
      // Rejections before body reading must also stop the unused input stream.
      if (request.body && !request.body.locked) void request.body.cancel().catch(() => undefined);
    }
  };
}
