/*
 * SUPERSEDED, 21 September 2026. Kept as the record of what the 20 September
 * review measured; do not read a failure here as a regression.
 *
 * These are diagnostic reproductions of defects that existed on the reviewed
 * revisions, so they assert the *broken* behaviour. Three of the four have
 * since been fixed, and those three now fail by design. Re-run against
 * axe-shaper-3D-viewer at `8f7eb65` (copy into its `tests/`, then
 * `npx vitest run tests/arched-review-probes.test.ts`) and you get:
 *
 *   PASS  stage mounts and explains the fallback
 *         - was already fixed when the review ran, and still is.
 *   FAIL  solves first with incorrect parameters
 *         - expects two solves (rise 14/core, then 8/overall); there is now
 *           one (8/overall). Closed by viewer `368e496`.
 *   FAIL  solid-carve back binding left below the new body back
 *         - expects the strip below -38mm; it now spans -37.05..-30.65 around
 *           a body back at -37. Closed by viewer `6386b78` and iOS `d9cbaef`.
 *   FAIL  cap preview triangle statistics undercount rendered bands
 *         - expects reported < rendered; both are now 9,702. Closed by viewer
 *           `6386b78`, which counts capBand + coreBand.
 *
 * The status table in `arched-top-review.md` beside this file is a snapshot of
 * the same date and has drifted the same way. Later findings, and the contract
 * boundary that settled the arched-parity question, are in the viewer's
 * `docs/MESH_PARITY.md` and iOS's `docs/m22-cross-platform-3d-mesh-corpus.md`.
 *
 * This file is not compiled or linted here: `tsconfig.app.json` includes only
 * `src`, so it cannot affect this repository's build or CI.
 */
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseAxeSvg } from '../src/core/axeSvg';
import { buildArchedInstrument } from '../src/core/archedInstrument';
import { archedPreviewProfile } from '../src/core/archedProfiles';
import { archPreview, defaultArchView } from '../src/core/archPreview';
import { loadDesignFromLocation } from '../src/core/shareLink';
import App from '../src/App';
vi.mock('../src/core/shareLink', async original => ({ ...await original<object>(), loadDesignFromLocation: vi.fn() }));
vi.mock('../src/core/archedInstrument', async original => {
  const actual = await original<typeof import('../src/core/archedInstrument')>();
  return { ...actual, buildArchedInstrument: vi.fn(actual.buildArchedInstrument) };
});
vi.mock('../src/components/ViewerStage', () => ({ ViewerStage: () => createElement('div', { 'data-stage': true }) }));
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ''; vi.clearAllMocks(); });
function design(thickness: number) {
  const loaded = parseAxeSvg(readFileSync('public/contracts/blueprints/s_style.axe.svg', 'utf8'), 'Review.axe.svg');
  loaded.project.bodyTop = { construction: 'solid_body_carve' };
  loaded.project.bodyThicknessMm = thickness;
  return loaded;
}
async function mount(loaded: ReturnType<typeof design>) {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(loadDesignFromLocation).mockResolvedValue({ design: loaded, origin: 'handoff' });
  const container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(App)); });
}
it('latest viewer mounts the stage and explains the fallback', async () => {
  await mount(design(12));
  expect(document.querySelector('[data-stage]')).not.toBeNull();
  expect(document.querySelector('.tag-note')?.textContent).toContain('shown flat');
});
it('latest viewer still solves first with incorrect parameters', async () => {
  await mount(design(45));
  const inputs = vi.mocked(buildArchedInstrument).mock.calls.map(call => ({ rise: call[1].riseMm, basis: call[1].thicknessBasis }));
  expect(inputs).toEqual([{ rise: 14, basis: 'core' }, { rise: 8, basis: 'overall' }]);
  console.log('Build inputs', inputs);
});
it('solid-carve back binding is left below the new body back', () => {
  const project = design(45).project;
  project.edgeProfile = { kind: 'slab' };
  project.binding = { appliesTo: 'top_and_back' };
  const built = buildArchedInstrument(project, archedPreviewProfile(project).parameters);
  const z = (id: string) => built.assembly.parts.find(p => p.id === id)!.mesh.positions.filter((_, i) => i % 3 === 2);
  const bodyBack = Math.min(...z('body-bottom'));
  const bindingTop = Math.max(...z('binding-back'));
  console.log('Body back Z', bodyBack, 'back-binding Z range', Math.min(...z('binding-back')), bindingTop);
  expect(bindingTop).toBeLessThan(bodyBack - 1);
});
it('cap preview triangle statistics undercount rendered bands', () => {
  const project = design(45).project;
  project.bodyTop = { construction: 'carved_cap' };
  const built = buildArchedInstrument(project, archedPreviewProfile(project).parameters);
  const preview = archPreview(built.body, project, { ...defaultArchView, mode: 'flat' });
  const actual = preview.assembly.parts.reduce((sum, p) => sum + p.mesh.indices.length / 3, 0);
  console.log('Reported triangles', preview.assembly.triangleCount, 'rendered', actual);
  expect(preview.assembly.triangleCount).toBeLessThan(actual);
});
