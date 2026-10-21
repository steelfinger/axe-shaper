/**
 * Build-time feature flags.
 *
 * `SCHEMA_9_AUTHORING_ENABLED` gates *introducing* the fields that raise a
 * save above 7: placing an output jack (schema 8) and choosing a body
 * material or finish (schema 9). They ship together in one coordinated
 * release, so one flag covers both and the two cannot be half enabled.
 * Reading, drawing and editing a file that already carries them is never
 * gated - a v8 or v9 file must open and re-save intact whatever this says.
 *
 * The staging and release workflows build with it on - the release lane from
 * `v1.3.2`, once iPad 1.3.2, which reads schema 9, was live. A save that uses
 * either field stamps 8 or 9, and an older iPad build opens that read-only.
 * Local builds, `verify` and PR previews leave it off; enable it with
 * `VITE_SCHEMA_9_AUTHORING=1`.
 */
export const SCHEMA_9_AUTHORING_ENABLED = import.meta.env.VITE_SCHEMA_9_AUTHORING === '1';

/**
 * `SHARING_ENABLED` turns the Share action into the Create link / Share project
 * file dialog. It needs the `/api/**` sharing backend, which only the staging
 * project has (firebase.staging.json), so only the staging lane builds with it.
 * Off, Share keeps sharing the .axe.svg file directly. Enable locally with
 * `VITE_SHARING=1 npm run dev` (the dev server proxies /api to staging).
 */
export const SHARING_ENABLED = import.meta.env.VITE_SHARING === '1';
