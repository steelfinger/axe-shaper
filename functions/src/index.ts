import { createHmac } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import type { Request as FunctionsRequest } from 'firebase-functions/v2/https';
import { UPLOAD_POLICY_REVISION } from '../../src/sharing/projectAdmission';
import { createSharingHttpHandler } from '../../src/sharing/sharingHttp';
import type { SharingRequestKind } from '../../src/sharing/sharingHttp';
import { SharingContractError } from '../../src/sharing/sharingContract';
import type { ProjectDigest } from '../../src/sharing/sharingContract';
import { createSnapshotService } from '../../src/sharing/snapshotService';
import type { SnapshotStore } from '../../src/sharing/snapshotService';
import { createFirestoreSnapshotStore } from './firestoreSnapshotStore';

/**
 * The sharing API behind Hosting's `/api/**` rewrite (firebase.staging.json).
 * This is the staging slice: the production project has no such rewrite and
 * this codebase is never deployed there yet.
 */
const RELEASE_TAG = defineString('SHARING_RELEASE_TAG');
const MAX_SCHEMA = defineInt('SHARING_MAX_ACCEPTED_SCHEMA');
/** `enforce` verifies tokens; `staging-bypass` accepts any non-empty token and is refused on production. */
const APP_CHECK_MODE = defineString('SHARING_APP_CHECK_MODE', { default: 'enforce' });
/** HMAC key that turns the client IP into an opaque quota key. Never stored with records. */
const CLIENT_KEY_SECRET = defineSecret('SHARING_CLIENT_KEY_SECRET');
const PRODUCTION_PROJECT = 'axe-shaper-web';

initializeApp();

/** Ingress limits per instance. Cheap and approximate by design: maxInstances bounds the total. */
const INGRESS_PER_MINUTE: Record<SharingRequestKind, number> = { create: 6, status: 60, read: 120, manage: 30, revoke: 10 };
const ingress = new Map<string, { windowStart: number; count: number }>();
function allowIngress(kind: SharingRequestKind, clientKey: string): boolean {
  const now = Date.now();
  const windowStart = now - (now % 60_000);
  if (ingress.size > 10_000) ingress.clear();
  const key = `${kind}:${clientKey}`;
  const entry = ingress.get(key);
  if (!entry || entry.windowStart !== windowStart) { ingress.set(key, { windowStart, count: 1 }); return true; }
  return ++entry.count <= INGRESS_PER_MINUTE[kind];
}

/**
 * The client address as Google's front end saw it. Firebase Hosting and the
 * Google front end each append to X-Forwarded-For, so the entries a client can
 * forge are on the LEFT; the last two are infrastructure-written
 * ("<client>, <hosting proxy>"). Never use the leftmost entry.
 */
export function clientAddress(forwardedFor: string | undefined): string | null {
  const hops = (forwardedFor ?? '').split(',').map(hop => hop.trim()).filter(Boolean);
  return hops.length >= 2 ? hops[hops.length - 2] : null;
}

/** The service answers every storage failure with a fixed `unavailable`; the cause goes to private logs only. */
function loggedStore(store: SnapshotStore): SnapshotStore {
  return {
    async transaction(action) {
      try { return await store.transaction(action); } catch (error) {
        if (!(error instanceof SharingContractError)) logger.error('sharing store transaction failed', error);
        throw error;
      }
    },
  };
}

let handler: ReturnType<typeof createSharingHttpHandler> | undefined;
function sharingHandler() {
  if (handler) return handler;
  const project = process.env.GCLOUD_PROJECT;
  const mode = APP_CHECK_MODE.value();
  if (mode !== 'enforce' && (mode !== 'staging-bypass' || project === PRODUCTION_PROJECT)) {
    throw new Error(`refusing App Check mode ${mode} on ${project}`);
  }
  const service = createSnapshotService({
    releaseTag: RELEASE_TAG.value(),
    admission: { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: MAX_SCHEMA.value() },
    quotas: { globalPerDay: 100, clientPerHour: 10, clientPerDay: 25 },
  }, { store: loggedStore(createFirestoreSnapshotStore(getFirestore())) });
  handler = createSharingHttpHandler({
    service,
    async verifyAppCheck(token) {
      if (mode === 'staging-bypass') return true;
      try { await getAppCheck().verifyToken(token); return true; } catch { return false; }
    },
    async allowRequest(kind, context) { return allowIngress(kind, context.clientKey); },
  });
  return handler;
}

/** Express (already buffered by the Functions framework) -> Fetch Request. */
function toFetchRequest(req: FunctionsRequest, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
  }
  const raw = req.rawBody as Buffer | undefined;
  // The adapter contract: an absent or zero-byte body is null, never an empty stream.
  const body = raw && raw.byteLength > 0 ? new Uint8Array(raw) : null;
  if (body) headers.set('content-length', String(body.byteLength));
  return new Request(new URL(req.originalUrl, `https://${req.hostname}`), { method: req.method, headers, body, signal });
}

export const sharingApi = onRequest({
  region: 'europe-north1',
  maxInstances: 2,
  concurrency: 20,
  timeoutSeconds: 20,
  memory: '256MiB',
  invoker: 'public',
  secrets: [CLIENT_KEY_SECRET],
}, async (req, res) => {
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableFinished) abort.abort(); });
  let response: Response;
  const address = clientAddress(req.get('x-forwarded-for'));
  // TEMPORARY (staging verification of the hop layout; remove after checking).
  logger.info('sharing forwarded-for', { forwardedFor: req.get('x-forwarded-for') ?? null });
  if (!address) {
    logger.warn('sharing request without a trusted client address');
    response = new Response(JSON.stringify({ error: { code: 'unavailable' } }), { status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  } else {
    const clientKey = `sha256:${createHmac('sha256', CLIENT_KEY_SECRET.value()).update(address).digest('hex')}` as ProjectDigest;
    try { response = await sharingHandler()(toFetchRequest(req, abort.signal), { clientKey }); } catch (error) {
      logger.error('sharing handler failed', error);
      response = new Response(JSON.stringify({ error: { code: 'unavailable' } }), { status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  }
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.send(Buffer.from(await response.arrayBuffer()));
});
