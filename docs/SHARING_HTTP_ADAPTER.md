# Local sharing HTTP adapter

Implemented 2026-10-12 in `src/sharing/sharingHttp.ts`. The Fetch-compatible
handler connects the snapshot service to the Release A API routes. It is exercised
locally with real Request/Response streams and the service's test transaction
adapter. There is no deployed route, Firebase verifier, production limiter or
production storage implementation yet.

| Route | Behavior |
| --- | --- |
| `POST /api/shares` | Attested creation; 201 for new shares, 200 for identical replay |
| `GET /api/sharing-status` | Advisory release tag, upload-policy revision, schema ceiling and availability |
| `GET /api/shares/:id` | Original complete public snapshot |
| `GET /api/shares/:id/manage` | Creator status with header capability |
| `DELETE /api/shares/:id` | Idempotent creator revocation with header capability |

The handler accepts no query parameters and validates public ID syntax before
service lookup. It returns 404 for unknown routes and 405 with `Allow` for unsupported
methods. Noncreation routes accept no request body. It does not fall through to an
editor, fragment or default project, and generates no absolute URLs from Host.
Every response, including errors and status, is JSON with `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.

## Creation ingress

The server hosting bridge supplies `SharingHttpContext.clientKey`, an
environment-owned keyed digest derived from verified ingress/proxy metadata.
The handler never derives that key from a body or arbitrary forwarded/client
headers. `allowRequest` is a required ingress-throttling hook for all supported
routes, separate from accepted-creation quotas; false returns 429 and a thrown
failure returns 503. The bridge must provide an actual limiter, not an always-true
production stub. Missing trusted context fails closed.

Creation additionally requires a bounded `X-Firebase-AppCheck` token and the
required `verifyAppCheck` hook. Missing/invalid tokens return `unauthorized` (401).
Verifier infrastructure errors return `unavailable` (503). The production hook
must validate the correct isolated Firebase project/app audience; this local
adapter is not evidence of actual attestation enforcement. Public reads/status
and creator management need no App Check, but still pass through the limiter.

Creation accepts `application/json` with optional UTF-8 charset and only absent
or identity content encoding. A malformed declared length is refused; a declared
length over 512 KiB is rejected before consuming the stream. The reader counts
actual bytes and cancels oversize input before storage. It uses one bounded buffer
rather than retaining an unbounded number of small chunk objects, handles split
UTF-8 characters, refuses malformed UTF-8/BOM input, and cancels a pending read
when the Request signal aborts. Early rejections cancel unused bodies without
pulling their bytes. If a length was supplied it must equal the actual
length. The normal strict JSON/admission/digest boundary then processes the text.

The hosting bridge must enforce header/body limits before framework buffering,
connect client disconnects/timeouts to the Request signal, impose bounded read and
verification/limiter timeouts, and reject unsupported compressed payloads before
a middleware decompresses or buffers them. A bounded adapter buffer cannot undo
upstream buffering or impose the provider's ingress limits. Real concurrency,
timeouts, App Check, throttling and emulator tests remain adapter work.

## Creator capabilities and errors

Creator actions use `Authorization: Bearer <managementSecret>` exclusively.
Missing/malformed bearer headers return 401; the service validates the canonical
secret encoding and hashes it before storage. A well-formed wrong capability is
indistinguishable from a missing record (404). Query/body capability transport is
refused. The bridge must redact authorization/App Check headers, bodies and query
strings from logs; the handler emits no logs.

Errors expose exactly `{ "error": { "code": "<known-code>" } }`. The shared `http-errors-v1.json` vectors pin every code/status pair and nested
error body for the web and independent viewer readers. The viewer independently
recognizes `unauthorized` (401) and `method-not-allowed` (405) along with the existing
service errors. Unexpected verifier, limiter or service exceptions become fixed
`unavailable` responses, with no exception message or stack.

The production bridge still needs the selected Functions runtime and database
adapter, explicit region, trusted-origin/CORS policy (no permissive CORS is emitted
here), canonical-origin configuration for landing pages, bounded negative caching
for missing public IDs, environment identities and deployment/emulator wiring.
This adapter does not implement HTML landing pages, pending-operation storage,
client consent, hosted fetch, iPad integration or Phase 0 provisioning.
