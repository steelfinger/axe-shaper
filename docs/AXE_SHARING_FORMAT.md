# Axe Shaper sharing format — draft

**Status:** Canonical JSON/hash foundation implemented; admission and endpoint/envelope implementation pending

Companion to [the product plan](DESIGN_SHARING_AND_GALLERY_PLAN.md) and
[the saved-project contract](AXE_SVG_FORMAT.md). This defines hosted-sharing
admission and hashing without changing `.axe.svg` decoding or saving.

## Payload and admission

The client prepares the normal full saved project with `withEmbeddedPresets()`.
The server stores the received validated project value without migration,
catalogue lookup, default filling, coercion, rounding or schema repair. Embedded
neck/bridge presets are required; unknown IDs with valid known geometry are allowed.

Client preflight and server admission use the same pure strict validator and
policy revision: known recursive fields/enums, required embedded data, structure,
numeric/resource limits, and declared/required schema within the release ceiling.
The status endpoint identifies the active policy revision and admission ceiling.
If the client does not support that revision, offer an app update/file sharing
before consent. The server remains authoritative for every write.

Tolerant file saving may preserve future vocabulary that hosted admission rejects.
Client preflight must detect this and offer the file fallback before upload consent;
it must not erase vocabulary to obtain an admissible project.

## Project digest

The algorithm is **RFC 8785 JSON Canonicalization Scheme (JCS)**, UTF-8 encoding,
then SHA-256. The wire digest is `sha256:` followed by 64 lowercase hexadecimal
digits. Declare `digestCanonicalization: "rfc8785"` in the versioned sharing
contract. Hash the entire project value, including its metadata, not the share
envelope, creator key, operation key, server ID/time, preview or licence envelope.
All clients and the server recompute the same scope; readers can verify integrity.

JCS recursively sorts object names by UTF-16 code units, preserves array order,
uses ECMAScript binary64 number serialization and string escaping, and emits no
insignificant whitespace. It does not normalize Unicode. Signed zero hashes as
zero. Reject duplicate object names, nonfinite numbers and invalid Unicode,
including lone surrogates. Inspect raw request JSON for duplicate names before
a normal parser discards them. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)

Canonicalization produces hash bytes only; it never overwrites the stored project.
JCS-equivalent number spellings/key orders yield the same digest. This is content
identity under the defined JSON/binary64 model, not original source-file bytes.
Retain supported geometry precision; integers that must be exact stay within the
safe binary64 integer range. Application bounds may be stricter than JCS bounds.

`src/sharing/canonicalJson.ts` implements the browser/server canonicalizer,
bounded raw JSON parsing and Web Crypto hashing. Its tests consume the fixed
vectors, including duplicate decoded names and invalid Unicode. Sorting keys
and calling ordinary Swift `JSONEncoder` is insufficient.
Raw JSON requests are limited to 1 MiB of UTF-8, depth 64 and 100,000 value
nodes. Canonical output has a separate 6 MiB ceiling to allow number expansion
such as `1e20` becoming `100000000000000000000`. Whitespace and equivalent
number spellings can still affect the raw transport limit; that limit protects
request handling, while the canonical ceiling protects serialization memory.
Canonicalization counts output bytes incrementally, including escaped strings,
and stops before building an oversized result. These are transport/serialization
bounds; the project admission policy and deployment storage bounds remain pending.

Hashing requires Web Crypto, available on HTTPS and trusted localhost contexts.
Plain HTTP over a LAN may lack it. `projectDigest()` returns the typed
`crypto-unavailable` error in that case so the sharing UI can offer file sharing
or explain that a secure connection is needed.
Do not introduce application-specific number rounding. The future iPad adapter
uses JCS-compatible serialization, independent of its normal file encoder.

## Fixture expectations

`tests/fixtures/sharing/jcs-digest-vectors.json` fixes input JSON, canonical UTF-8
text and SHA-256 digests. Cases cover `0.1`, `1e21`, `-0`, exponent thresholds,
rounding, numeric-looking object keys, UTF-16 sorting, unnormalized Unicode and
nested array ordering. Invalid inputs name the expected rejection.

These are canonicalization vectors, not valid design uploads: large test numbers
may exceed geometry limits. Phase 1 separately adds full envelope/project admission
fixtures, marking each policy ceiling and expected result explicitly:

| Source/case | Expected hosted admission |
| --- | --- |
| `tests/fixtures/ios-written-v5/s_style.axe.svg` | Known schema-7 positive baseline; validate complete fields against final limits |
| New `schema8-known-jacks` fixture | Known styles/fields only; accept at ceiling 8, refuse at ceiling 7 |
| `tests/fixtures/web-written-v8/output_jacks.axe.svg` | Reject unknown `side_mounted` and `futureField` at ceiling 8 |
| `tests/fixtures/ios-written-v5/web_roundtrip_output_jacks.axe.svg` | Same rejection; retain the independent tolerant round-trip test |
| `tests/fixtures/ios-written-v5/output_jacks.axe.svg` | Reject unknown `side_mounted` at ceiling 8 |

For negative vocabulary cases, test at ceiling 8 to ensure a schema-ceiling error
does not mask the strict validator result. Never change those original fixtures
or weaken the existing preservation assertions. Add independent unknown-key and
unknown-enum cases so each rule is tested on its own.

Web unit checks now consume the digest vectors. Functions/admission checks
remain pending. Sync the vectors and admission matrix into
the viewer's own `npm run check` inputs, and require iPad digest/adapter checks
when that client is added. Record fixture revision/digests across repositories.

## Phase 1 completion

Finalize the versioned envelope, upload-policy revision, support manifest, preview
variants, error codes and idempotency request comparison. Add full accepted and
rejected envelope fixtures and run the independent client checks. Preserve the
project-digest algorithm defined here; change it only through an explicit versioned
contract migration that keeps older snapshots/verifiers usable.
