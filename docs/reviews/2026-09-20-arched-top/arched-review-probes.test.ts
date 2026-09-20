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
