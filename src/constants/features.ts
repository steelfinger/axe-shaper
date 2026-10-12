/**
 * Build-time feature flags.
 *
 * `OUTPUT_JACKS_ENABLED` gates *authoring* an output jack (the Output Jack
 * action). Reading, drawing and saving a file that already carries `jacks`
 * is never gated - a v8 file must open and re-save intact whatever this says.
 *
 * It stays off until an iPad release that reads schema 8 is live: placing a
 * jack stamps the file 8, and an older iPad build opens that read-only. No
 * `v*` tag may turn it on before then (docs/OUTPUT_JACKS_SCHEMA_8_PLAN.md,
 * "Status and release gate"). Enable locally with `VITE_OUTPUT_JACKS=1`.
 */
export const OUTPUT_JACKS_ENABLED = import.meta.env.VITE_OUTPUT_JACKS === '1';

/**
 * `SHARING_ENABLED` turns the Share action into the Create link / Share project
 * file dialog. It needs the `/api/**` sharing backend, which only the staging
 * project has (firebase.staging.json), so only the staging lane builds with it.
 * Off, Share keeps sharing the .axe.svg file directly. Enable locally with
 * `VITE_SHARING=1 npm run dev` (the dev server proxies /api to staging).
 */
export const SHARING_ENABLED = import.meta.env.VITE_SHARING === '1';
