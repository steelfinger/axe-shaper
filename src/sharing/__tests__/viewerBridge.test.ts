import { describe, expect, it } from 'vitest';
import requestFixture from '../../../tests/fixtures/sharing/creation-v1.json';
import type { GuitarProject } from '../../types/guitar';
import { SHARE_TERMS } from '../createShare';
import type { PendingShare, SharePreflight, ShareSendResult } from '../shareLinkClient';
import { SHARE_BRIDGE, createViewerShareBridge, readViewerRequest } from '../viewerBridge';
import type { BridgeReply, ViewerBridgeDeps } from '../viewerBridge';

const origin = 'https://axeshaper.com';
const base = requestFixture.project as unknown as GuitarProject;
const ready = { ok: true, project: base, digest: requestFixture.projectDigest, policyRevision: 'project-upload-v3' } as unknown as SharePreflight;
const pending: PendingShare = { body: '{}', managementSecret: 'A'.repeat(43), deadline: 1 };

function tab() {
  const sent: BridgeReply[] = [];
  return { sent, window: { closed: false, postMessage: (message: BridgeReply, target: string) => { if (target === origin) sent.push(message); } } as unknown as Window };
}

function bridge(overrides: Partial<ViewerBridgeDeps> = {}) {
  let project = { ...base, settings: { ...base.settings, name: 'Flame Maple' }, metadata: { ...base.metadata, author: ' Tero ' } } as GuitarProject;
  const calls = { begun: 0, saved: 0, sent: 0 };
  const deps: ViewerBridgeDeps = {
    origin,
    currentProject: () => project,
    viewerProjection: (current) => JSON.stringify(current.settings),
    check: async () => ready,
    begin: () => { calls.begun++; return pending; },
    save: () => { calls.saved++; return true; },
    send: async (): Promise<ShareSendResult> => { calls.sent++; return { ok: true, id: 'AbCdEfGhIjKlMnOpQrSt', createdAt: '2026-10-26T00:00:00Z' }; },
    ...overrides,
  };
  const instance = createViewerShareBridge(deps);
  return { instance, calls, edit: (name: string) => { project = { ...project, settings: { ...project.settings, name } }; },
    handoff: () => JSON.stringify(project.settings) };
}

const message = (type: string, requestId = 'request-0001') => ({ channel: SHARE_BRIDGE.channel, version: SHARE_BRIDGE.version, type, requestId });

describe('viewer share bridge', () => {
  it('accepts only well-formed requests on its channel', () => {
    expect(readViewerRequest(message('hello'))).toEqual({ type: 'hello', requestId: 'request-0001' });
    expect(readViewerRequest({ ...message('hello'), version: 2 })).toBeNull();
    expect(readViewerRequest({ ...message('hello'), channel: 'other' })).toBeNull();
    expect(readViewerRequest(message('delete'))).toBeNull();
    expect(readViewerRequest(message('create', 'x'))).toBeNull();
    expect(readViewerRequest('hello')).toBeNull();
  });

  it('answers hello with the dialog consent text and notices edits since View in 3D', async () => {
    const { instance, edit, handoff } = bridge();
    const viewer = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('hello'), origin, source: viewer.window });
    expect(viewer.sent[0]).toEqual({ ...message('hello'), available: true, title: 'Flame Maple', author: 'Tero',
      terms: [...SHARE_TERMS], changedSinceView: false });
    edit('Flame Maple v2');
    await instance.handle({ data: message('hello', 'request-0002'), origin, source: viewer.window });
    expect(viewer.sent[1]).toMatchObject({ available: true, title: 'Flame Maple v2', changedSinceView: true });
  });

  it('ignores other origins, unregistered windows and malformed messages', async () => {
    const { instance, handoff } = bridge();
    const viewer = tab();
    const stranger = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('hello'), origin: 'https://evil.example', source: viewer.window });
    await instance.handle({ data: message('hello'), origin, source: stranger.window });
    await instance.handle({ data: { type: 'hello' }, origin, source: viewer.window });
    expect(viewer.sent).toEqual([]);
    expect(stranger.sent).toEqual([]);
  });

  it('reports why a design cannot be shared', async () => {
    const { instance, handoff, calls } = bridge({ check: async () => ({ ok: false, reason: 'paused' }) });
    const viewer = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('hello'), origin, source: viewer.window });
    await instance.handle({ data: message('create', 'request-0002'), origin, source: viewer.window });
    expect(viewer.sent[0]).toMatchObject({ available: false, message: expect.stringContaining('paused') });
    expect(viewer.sent[1]).toMatchObject({ ok: false, retryable: false });
    expect(calls.begun).toBe(0);
  });

  it('creates the link from the editor project and returns only the short link', async () => {
    const { instance, handoff, calls } = bridge();
    const viewer = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('create'), origin, source: viewer.window });
    expect(viewer.sent[0]).toEqual({ ...message('create'), ok: true, id: 'AbCdEfGhIjKlMnOpQrSt', url: `${origin}/share/AbCdEfGhIjKlMnOpQrSt` });
    expect(JSON.stringify(viewer.sent[0])).not.toContain(pending.managementSecret);
    expect(calls).toEqual({ begun: 1, saved: 1, sent: 1 });
  });

  it('never uploads when the recovery record cannot be saved', async () => {
    const { instance, handoff, calls } = bridge({ save: () => false });
    const viewer = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('create'), origin, source: viewer.window });
    expect(viewer.sent[0]).toMatchObject({ ok: false, retryable: false });
    expect(calls.sent).toBe(0);
  });

  it('retries the same confirmed request after a retryable failure', async () => {
    const results: ShareSendResult[] = [{ ok: false, code: 'network', retryable: true },
      { ok: true, id: 'AbCdEfGhIjKlMnOpQrSt', createdAt: '2026-10-26T00:00:00Z' }];
    const { instance, handoff, calls } = bridge({ send: async () => { calls.sent++; return results.shift()!; } });
    const viewer = tab();
    instance.register(viewer.window, handoff());
    await instance.handle({ data: message('create'), origin, source: viewer.window });
    await instance.handle({ data: message('create', 'request-0002'), origin, source: viewer.window });
    expect(viewer.sent[0]).toMatchObject({ ok: false, retryable: true });
    expect(viewer.sent[1]).toMatchObject({ ok: true });
    expect(calls.begun).toBe(1);
    expect(calls.sent).toBe(2);
  });

  it('refuses a second create while one is in flight', async () => {
    let finish: (result: ShareSendResult) => void = () => undefined;
    const { instance, handoff, calls } = bridge({ send: () => { calls.sent++; return new Promise(resolve => { finish = resolve; }); } });
    const viewer = tab();
    instance.register(viewer.window, handoff());
    const first = instance.handle({ data: message('create'), origin, source: viewer.window });
    await new Promise(resolve => setTimeout(resolve, 0));
    await instance.handle({ data: message('create', 'request-0002'), origin, source: viewer.window });
    finish({ ok: true, id: 'AbCdEfGhIjKlMnOpQrSt', createdAt: '2026-10-26T00:00:00Z' });
    await first;
    expect(viewer.sent.map(reply => reply.requestId)).toEqual(['request-0002', 'request-0001']);
    expect(viewer.sent[0]).toMatchObject({ ok: false, retryable: true });
    expect(calls.sent).toBe(1);
  });
});
