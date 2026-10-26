import type { GuitarProject } from '../types/guitar';
import { BLOCKED_MESSAGES, SHARE_TERMS } from './createShare';
import { shareFailureMessage } from './shareErrors';
import { shareUrl } from './shareLinkClient';
import type { PendingShare, SharePreflight, ShareSendResult } from './shareLinkClient';

/**
 * Create link for the 3D viewer, done here in the editor.
 *
 * The viewer only holds `projectForViewerLink`'s projection of a design - no
 * metadata, a subset of settings - so a link created there would store a
 * reduced design. Instead the viewer tab this editor opened asks over
 * `postMessage`: `hello` returns the consent text and whether the design has
 * changed since View in 3D; `create` runs the same checks, recovery record and
 * key handling as the Share dialog, with this editor's exact project, and
 * returns the short link. Nothing secret crosses; the management key stays in
 * this origin's storage, which the viewer's Manage link reads.
 *
 * Only windows registered by View in 3D, on this origin, are answered. The
 * viewer side is `src/core/editorBridge.ts` in axe-shaper-3D-viewer; the two
 * must agree on `SHARE_BRIDGE` and the message shapes below.
 */
export const SHARE_BRIDGE = Object.freeze({ channel: 'axe-shaper/share', version: 1 } as const);

export interface ViewerRequest { type: 'hello' | 'create'; requestId: string }

export type BridgeReply = { channel: typeof SHARE_BRIDGE.channel; version: typeof SHARE_BRIDGE.version; requestId: string } & (
  | { type: 'hello'; available: true; title: string; author: string | null; terms: string[]; changedSinceView: boolean }
  | { type: 'hello'; available: false; message: string }
  | { type: 'create'; ok: true; id: string; url: string }
  | { type: 'create'; ok: false; message: string; retryable: boolean }
);

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function readViewerRequest(data: unknown): ViewerRequest | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;
  if (message.channel !== SHARE_BRIDGE.channel || message.version !== SHARE_BRIDGE.version) return null;
  if (message.type !== 'hello' && message.type !== 'create') return null;
  if (typeof message.requestId !== 'string' || !REQUEST_ID.test(message.requestId)) return null;
  return { type: message.type, requestId: message.requestId };
}

export interface ViewerBridgeDeps {
  origin: string;
  currentProject: () => GuitarProject;
  /** What View in 3D hands the viewer, as JSON, to tell whether the design changed since. */
  viewerProjection: (project: GuitarProject) => string;
  check: (project: GuitarProject) => Promise<SharePreflight>;
  begin: (preflight: Extract<SharePreflight, { ok: true }>) => PendingShare;
  save: (pending: PendingShare, title: string) => boolean;
  send: (pending: PendingShare, title: string) => Promise<ShareSendResult>;
}

interface ViewerTab {
  handoff: string;
  busy: boolean;
  /** A confirmed request whose send failed retryably; a retry resends it rather than creating another. */
  retry?: { pending: PendingShare; title: string };
}

export interface BridgeEvent { data: unknown; origin: string; source: MessageEventSource | null }

export function createViewerShareBridge(deps: ViewerBridgeDeps) {
  const viewers = new Map<Window, ViewerTab>();
  const reply = (requestId: string, body: Record<string, unknown>) =>
    ({ channel: SHARE_BRIDGE.channel, version: SHARE_BRIDGE.version, requestId, ...body }) as BridgeReply;

  const hello = async (viewer: ViewerTab, requestId: string): Promise<BridgeReply> => {
    const project = deps.currentProject();
    const preflight = await deps.check(project);
    if (!preflight.ok) return reply(requestId, { type: 'hello', available: false, message: BLOCKED_MESSAGES[preflight.reason] });
    return reply(requestId, {
      type: 'hello', available: true, title: project.settings.name, author: project.metadata?.author?.trim() || null,
      terms: [...SHARE_TERMS], changedSinceView: deps.viewerProjection(project) !== viewer.handoff,
    });
  };

  const create = async (viewer: ViewerTab, requestId: string): Promise<BridgeReply> => {
    const failed = (message: string, retryable: boolean) => reply(requestId, { type: 'create', ok: false, message, retryable });
    if (viewer.busy) return failed('A link is already being created for this view.', true);
    viewer.busy = true;
    try {
      let attempt = viewer.retry;
      if (!attempt) {
        const project = deps.currentProject();
        const preflight = await deps.check(project);
        if (!preflight.ok) return failed(BLOCKED_MESSAGES[preflight.reason], false);
        attempt = { pending: deps.begin(preflight), title: project.settings.name };
        if (!deps.save(attempt.pending, attempt.title)) {
          return failed('This browser could not save the recovery details, so nothing was uploaded. Allow browser storage or share the project file.', false);
        }
      }
      const result = await deps.send(attempt.pending, attempt.title);
      viewer.retry = !result.ok && result.retryable ? attempt : undefined;
      return result.ok
        ? reply(requestId, { type: 'create', ok: true, id: result.id, url: shareUrl(deps.origin, result.id) })
        : failed(shareFailureMessage(result.code), result.retryable);
    } finally {
      viewer.busy = false;
    }
  };

  return {
    /** Called by View in 3D with the tab it opened and the projection it handed over. */
    register(tab: Window, handoff: string): void {
      for (const known of viewers.keys()) if (known.closed) viewers.delete(known);
      viewers.set(tab, { handoff, busy: false });
    },
    async handle(event: BridgeEvent): Promise<void> {
      if (event.origin !== deps.origin || !event.source) return;
      const tab = event.source as Window;
      const viewer = viewers.get(tab);
      const request = viewer && readViewerRequest(event.data);
      if (!viewer || !request) return;
      const response = request.type === 'hello' ? await hello(viewer, request.requestId) : await create(viewer, request.requestId);
      tab.postMessage(response, deps.origin);
    },
  };
}
