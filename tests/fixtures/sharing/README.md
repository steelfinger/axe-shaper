# Sharing contract fixtures

`jcs-digest-vectors.json` checks canonical JSON and SHA-256 independently of
project admission. These values are not necessarily valid designs.

`schema8-known-jacks.json` is a complete saved project derived from the committed
`../web-written-v8/output_jacks.axe.svg`: only the two known mounting styles are
retained and the title identifies the new fixture. The original SVG is unchanged.
This positive case is accepted under `project-upload-v2` at ceiling 8 and refused
at ceiling 7.

The admission tests also decode `../ios-written-v5/s_style.axe.svg` directly as
the schema-7 positive baseline. The original web v8 file, its native return
`../ios-written-v5/web_roundtrip_output_jacks.axe.svg`, and the native
`../ios-written-v5/output_jacks.axe.svg` all reject unknown vocabulary at ceiling
8. Their existing tolerant file round-trip assertions remain in force.

Run `npx vitest run src/sharing`. Tests check validation without mutation,
digest/export equality, every bundled full save payload, unknown fields at each
recursive object, enum/schema failures, embedded hardware, complexity and bytes.

`creation-v1.json` and `envelope-v1.json` wrap the unchanged native schema-7
baseline. The deterministic keys are public test bytes (32 bytes of `01` and
`02`), never real credentials. `creation-v1-hashes.json` pins the private hashes
and retry digest, calculated independently using Node SHA-256 and direct JCS
serialization. `support-manifest-v1.json` is synthetic compatibility data, not
verified live iPad evidence or a deployed release manifest. Its schema-8 native
minimum is explicitly unknown. Original SVG fixtures remain unchanged.

Tests mutate these fixtures to check rejected requests/envelopes, exact transport
limits, schema gates, previews, integrity and public/private separation. No endpoint
or independent viewer/iPad verification is claimed.

`policy-fingerprints.json` pins each admission revision's definition, including
recursive field sets, all enums, numeric/text/list bounds, safety limits and
compatibility tables. Treat entries as immutable: policy drift requires a new
revision and retained historical readers, not replacing the old fingerprint.
Custom validation logic still needs reviewed semantics and regression cases.

`project-upload-v2-definition.json` exports the same data-only definition for an
independent viewer interpreter. Web tests check equality with the compiled rules
and fingerprint every retained definition. `node scripts/write-sharing-policy.ts`
exports a missing definition and refuses to overwrite a changed existing revision;
add `--check` to verify only. It does not replace fingerprint entries.

The viewer vendors all sharing JSON artifacts under `contracts/sharing`, with
file SHA-256 pins in its own contract manifest. Its independent JSON/JCS/envelope
checks now run in `npm run check`. Neither repository's normal tests/build require
the sibling checkout. Native iPad sharing-adapter checks and endpoints remain pending.
