# Sharing contract fixtures

`jcs-digest-vectors.json` checks canonical JSON and SHA-256 independently of
project admission. These values are not necessarily valid designs.

`schema8-known-jacks.json` is a complete saved project derived from the committed
`../web-written-v8/output_jacks.axe.svg`: only the two known mounting styles are
retained and the title identifies the new fixture. The original SVG is unchanged.
This positive case is accepted under `project-upload-v1` at ceiling 8 and refused
at ceiling 7.

The admission tests also decode `../ios-written-v5/s_style.axe.svg` directly as
the schema-7 positive baseline. The original web v8 file, its native return
`../ios-written-v5/web_roundtrip_output_jacks.axe.svg`, and the native
`../ios-written-v5/output_jacks.axe.svg` all reject unknown vocabulary at ceiling
8. Their existing tolerant file round-trip assertions remain in force.

Run `npx vitest run src/sharing`. Tests check validation without mutation,
digest/export equality, every bundled full save payload, unknown fields at each
recursive object, enum/schema failures, embedded hardware, complexity and bytes.
There are no API/envelope fixtures or deployed endpoint claims yet.
