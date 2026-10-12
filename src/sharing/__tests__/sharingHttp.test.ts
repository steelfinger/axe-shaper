import { describe, expect, it, vi } from 'vitest';
import errorVectors from '../../../tests/fixtures/sharing/http-errors-v1.json';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import { createSharingHttpHandler } from '../sharingHttp';
import { createSnapshotService } from '../snapshotService';
import { UPLOAD_POLICY_REVISION } from '../projectAdmission';
import { MAX_CREATION_REQUEST_BYTES, SHARE_OPERATION_TTL_MS, SHARING_ERROR_STATUS } from '../sharingContract';
import { projectDigest } from '../canonicalJson';
import { MemoryStore } from './helpers/memorySnapshotStore';

const clientKey = `sha256:${'1'.repeat(64)}` as const;
const context = { clientKey };
const raw = JSON.stringify(requestFixture);
function setup() {
  const store = new MemoryStore();
  let time = Date.parse('2026-10-12T10:00:00.000Z');
  const service = createSnapshotService({ releaseTag: 'v1.2.0',
    admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 7 },
    quotas: { globalPerDay: 100, clientPerHour: 10, clientPerDay: 25 },
  }, { store, now: () => time, allocateId: () => 'A0000000000000000001' });
  const verifyAppCheck = vi.fn(async (token: string) => token === 'valid-attestation');
  const allowRequest = vi.fn(async () => true);
  const handle = createSharingHttpHandler({ service, verifyAppCheck, allowRequest });
  return { store, service, verifyAppCheck, allowRequest, handle, advance: (ms: number) => { time += ms; } };
}
function request(path: string, method = 'GET', headers: Record<string, string> = {}, body?: string) {
  return new Request(`https://sharing.example${path}`, { method, headers, body });
}
function create(body = raw, headers: Record<string, string> = {}) {
  return request('/api/shares', 'POST', { 'content-type': 'application/json', 'x-firebase-appcheck': 'valid-attestation', ...headers }, body);
}
const authorization = { authorization: `Bearer ${requestFixture.managementSecret}` };
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ error: { code } });
}

describe('sharing HTTP boundary', () => {
  it('pins all status/code pairs and the nested wire shape against independent-client vectors', () => {
    expect(Object.fromEntries(errorVectors.cases.map(vector => [vector.body.error.code, vector.status])))
      .toEqual(SHARING_ERROR_STATUS);
  });
  it.each([false, true])('cancels an unread rejection body without pulling bytes (attested=%s)', async attested => {
    const { handle, store } = setup();
    const pull = vi.fn(); const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
    const req = new Request('https://sharing.example/api/shares', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-firebase-appcheck': attested ? 'valid-attestation' : 'bad',
        'content-length': String(MAX_CREATION_REQUEST_BYTES + 1) }, body: stream, duplex: 'half' } as RequestInit);
    await expectError(await handle(req, context), attested ? 413 : 401, attested ? 'too-large' : 'unauthorized');
    expect(pull).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalled(); expect(store.calls).toBe(0);
  });
  it('creates, replays, reads, manages and revokes a complete saved snapshot', async () => {
    const { handle, store, verifyAppCheck } = setup();
    const created = await handle(create(raw, { 'content-length': String(new TextEncoder().encode(raw).length) }), context);
    expect(created.status).toBe(201);
    const { id } = await created.json();
    const replay = await handle(create(), context);
    expect(replay.status).toBe(200); expect(await replay.json()).toMatchObject({ id, replayed: true });
    const read = await handle(request(`/api/shares/${id}`), context);
    expect(read.status).toBe(200); expect((await read.json()).project).toEqual(requestFixture.project);
    expect(read.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(read.headers.get('x-content-type-options')).toBe('nosniff');
    expect(read.headers.get('referrer-policy')).toBe('no-referrer');
    const manage = await handle(request(`/api/shares/${id}/manage`, 'GET', authorization), context);
    expect(await manage.json()).toEqual({ id, state: 'active', revokedAt: null });
    const revoked = await handle(request(`/api/shares/${id}`, 'DELETE', authorization), context);
    expect(revoked.status).toBe(200); expect((await revoked.json()).state).toBe('revoked');
    await expectError(await handle(request(`/api/shares/${id}`), context), 410, 'revoked');
    await expectError(await handle(create(), context), 410, 'revoked');
    expect(store.shares.size).toBe(1);
    expect(verifyAppCheck).toHaveBeenCalledTimes(3); // public/management calls need no attestation
  });
  it('publishes only advisory availability and the release-owned preflight policy', async () => {
    const { handle, store } = setup(); store.controls = { creationEnabled: false, projectReadsEnabled: true };
    const response = await handle(request('/api/sharing-status'), context);
    expect(await response.json()).toEqual({ releaseTag: 'v1.2.0', uploadPolicyRevision: UPLOAD_POLICY_REVISION,
      maxAcceptedProjectSchema: 7, creationAvailable: false, projectReadAvailable: true });
  });
  it.each(['', 'invalid-attestation', 'x'.repeat(8193)])('refuses missing/invalid/bounded App Check before reading a body', async token => {
    const { handle, store } = setup();
    const req = create(raw, { 'x-firebase-appcheck': token });
    await expectError(await handle(req, context), 401, 'unauthorized');
    expect(store.calls).toBe(0);
  });
  it('throttles before attestation, body reading or service calls using trusted context', async () => {
    const { handle, store, verifyAppCheck, allowRequest } = setup(); allowRequest.mockResolvedValue(false);
    const req = create();
    await expectError(await handle(req, context), 429, 'quota-exceeded');
    expect(allowRequest).toHaveBeenCalledWith('create', context, undefined);
    expect(verifyAppCheck).not.toHaveBeenCalled(); expect(store.calls).toBe(0);
  });
  it('ignores spoofed quota headers and passes only server-provided identity', async () => {
    const { handle, allowRequest } = setup();
    await handle(create(raw, { 'x-forwarded-for': 'evil', 'x-client-key': 'evil' }), context);
    expect(allowRequest).toHaveBeenCalledWith('create', context, undefined);
  });
  it.each([
    ['/api/shares', 'GET', 'POST'], ['/api/sharing-status', 'POST', 'GET'],
    ['/api/shares/A0000000000000000001', 'POST', 'GET, DELETE'],
    ['/api/shares/A0000000000000000001/manage', 'DELETE', 'GET'],
  ])('returns method refusal and Allow for %s %s', async (path, method, allow) => {
    const { handle, store } = setup(); const response = await handle(request(path, method), context);
    expect(response.headers.get('allow')).toBe(allow);
    await expectError(response, 405, 'method-not-allowed'); expect(store.calls).toBe(0);
  });
  it.each(['/api/shares?secret=oops', '/api/sharing-status?other=1', '/api/shares/A0000000000000000001?managementSecret=oops'])
    ('refuses query transport without service access: %s', async path => {
      const { handle, store } = setup(); await expectError(await handle(request(path), context), 400, 'malformed-request');
      expect(store.calls).toBe(0);
    });
  it.each(['/api/shares/not-an-id', '/api/shares/%41' + '0'.repeat(19), '/api/shares/short/manage'])
    ('validates IDs before lookup: %s', async path => {
      const { handle, store } = setup(); await expectError(await handle(request(path), context), 400, 'invalid-id'); expect(store.calls).toBe(0);
    });
  it('refuses unknown routes without falling through to an editor/default', async () => {
    const { handle, store } = setup(); await expectError(await handle(request('/api/gallery'), context), 404, 'not-found'); expect(store.calls).toBe(0);
  });
  it.each([{}, { authorization: requestFixture.managementSecret }, { authorization: `Basic ${requestFixture.managementSecret}` }] as Record<string, string>[])
    ('requires a bearer capability in the header', async headers => {
      const { handle, store } = setup(); await expectError(await handle(request('/api/shares/A0000000000000000001/manage', 'GET', headers), context), 401, 'unauthorized');
      expect(store.calls).toBe(0);
    });
  it('refuses bodies on status/read/management routes rather than accepting credential transport', async () => {
    const { handle, store } = setup();
    const req = request('/api/shares/A0000000000000000001', 'DELETE', authorization,
      JSON.stringify({ managementSecret: requestFixture.managementSecret }));
    await expectError(await handle(req, context), 400, 'malformed-request');
    expect(store.calls).toBe(0);
  });
  it.each(['', new Uint8Array(0)])('requires the bridge to normalize zero-byte revoke input to null (%#)', async empty => {
    const { handle } = setup();
    await handle(create(), context);
    const url = 'https://sharing.example/api/shares/A0000000000000000001';
    const headers = { ...authorization, 'content-length': '0' };
    await expectError(await handle(new Request(url, { method: 'DELETE', headers, body: empty }), context),
      400, 'malformed-request');
    const normalized = await handle(new Request(url, { method: 'DELETE', headers, body: null }), context);
    expect(normalized.status).toBe(200);
    expect((await normalized.json()).state).toBe('revoked');
  });
  it('distinguishes operation expiry for the client', async () => {
    const { handle, advance } = setup(); await handle(create(), context); advance(SHARE_OPERATION_TTL_MS);
    await expectError(await handle(create(), context), 409, 'operation-expired');
  });
  it.each([
    { 'content-type': 'text/plain' }, { 'content-encoding': 'gzip' }, { 'content-length': '-1' },
    { 'content-length': '1' },
  ] as Record<string, string>[])('refuses unsupported encoding, malformed lengths and mismatched transport', async headers => {
    const { handle, store } = setup(); await expectError(await handle(create(raw, headers), context), 400, 'malformed-request'); expect(store.calls).toBe(0);
  });
  it('rejects an oversized declared body without consuming it', async () => {
    const { handle, store } = setup(); const req = create(raw, { 'content-length': String(MAX_CREATION_REQUEST_BYTES + 1) });
    await expectError(await handle(req, context), 413, 'too-large'); expect(store.calls).toBe(0);
  });
  it('bounds streamed bytes, cancels oversize input and never touches storage', async () => {
    const { handle, store } = setup(); const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array(MAX_CREATION_REQUEST_BYTES)); controller.enqueue(new Uint8Array(1));
    }, cancel });
    const req = new Request('https://sharing.example/api/shares', { method: 'POST', headers: { 'content-type': 'application/json', 'x-firebase-appcheck': 'valid-attestation' },
      body: stream, duplex: 'half' } as RequestInit);
    await expectError(await handle(req, context), 413, 'too-large'); expect(cancel).toHaveBeenCalled(); expect(store.calls).toBe(0);
  });
  it('accepts exact transport size with padding and valid UTF-8 across tiny chunks', async () => {
    const { handle } = setup();
    const body = raw + ' '.repeat(MAX_CREATION_REQUEST_BYTES - new TextEncoder().encode(raw).length);
    const response = await handle(create(body), context); expect(response.status).toBe(201);
    const project = structuredClone(requestFixture.project);
    project.metadata.author = 'A😀é';
    const unicodeRaw = JSON.stringify({ ...requestFixture, project, projectDigest: await projectDigest(project) });
    const bytes = new TextEncoder().encode(unicodeRaw);
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3)); controller.close();
    } });
    const req = new Request('https://sharing.example/api/shares', { method: 'POST', headers: { 'content-type': 'application/json; charset="utf-8"', 'x-firebase-appcheck': 'valid-attestation' },
      body: stream, duplex: 'half' } as RequestInit);
    // A distinct operation is needed because the payload differs from the first creation.
    const second = setup();
    expect((await second.handle(req, context)).status).toBe(201);
    const read = await second.handle(request('/api/shares/A0000000000000000001'), context);
    expect((await read.json()).project.metadata.author).toBe('A😀é');
  });
  it('cancels a pending body read when the request is aborted', async () => {
    const { handle, store } = setup();
    const cancel = vi.fn();
    let notifyRead!: () => void;
    const reading = new Promise<void>(resolve => { notifyRead = resolve; });
    const stream = new ReadableStream<Uint8Array>({ pull() { notifyRead(); }, cancel }, { highWaterMark: 0 });
    const abort = new AbortController();
    const req = new Request('https://sharing.example/api/shares', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-firebase-appcheck': 'valid-attestation' },
      body: stream, signal: abort.signal, duplex: 'half' } as RequestInit);
    const pending = handle(req, context);
    await reading; abort.abort();
    await expectError(await pending, 400, 'malformed-request');
    expect(cancel).toHaveBeenCalled(); expect(store.calls).toBe(0);
  });
  it('does not replace invalid UTF-8 or silently consume a BOM', async () => {
    const { handle, store } = setup();
    for (const bytes of [new Uint8Array([0xff]), new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(raw)])]) {
      const req = new Request('https://sharing.example/api/shares', { method: 'POST', headers: { 'content-type': 'application/json', 'x-firebase-appcheck': 'valid-attestation' }, body: bytes });
      await expectError(await handle(req, context), 400, 'malformed-request');
    }
    expect(store.calls).toBe(0);
  });
  it('never exposes verifier, limiter, or store exception details', async () => {
    const { handle, store, verifyAppCheck, allowRequest } = setup();
    verifyAppCheck.mockRejectedValueOnce(new Error('private verifier detail'));
    await expectError(await handle(create(), context), 503, 'unavailable');
    allowRequest.mockRejectedValueOnce(new Error('private limiter detail'));
    await expectError(await handle(request('/api/sharing-status'), context), 503, 'unavailable');
    store.failCommit = true;
    await expectError(await handle(create(), context), 503, 'unavailable');
  });
});
