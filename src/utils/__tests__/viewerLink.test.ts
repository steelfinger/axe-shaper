import { describe, expect, it } from 'vitest';
import { buildViewer3DPath, PINNED_VIEWER_READ_SCHEMA, projectForViewerLink } from '../viewer3dLink';
import { requiredSchemaVersion } from '../../constants/schema';
import { createProject } from '../projectFactory';

async function decodePath(path: string): Promise<unknown> {
  const payload = new URLSearchParams(path.split('#')[1]).get('d')!;
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

describe('projectForViewerLink', () => {
  const project = createProject();
  const link = projectForViewerLink(project);

  it('carries both instrument fields and the embedded hardware', () => {
    expect(link.instrumentType).toBe(project.instrumentType);
    expect(link.stringCount).toBe(project.stringCount);
    expect(link.neckPreset).toBe(project.neckPreset);
    expect(link.bridgePreset).toBe(project.bridgePreset);
    expect(link.contour).toBe(project.contour);
  });

  it('leaves out editor state the renderer does not need', () => {
    expect(link).not.toHaveProperty('metadata');
    expect(link).not.toHaveProperty('backRoutes');
    expect(link).not.toHaveProperty('neckPresetId');
    expect(Object.keys(link.settings).sort()).toEqual(
      ['bodyColor', 'finishStyle', 'name', 'pickguardColor', 'showControls', 'showPickguard']
    );
  });
});

describe('projectForViewerLink and jacks', () => {
  const jack = { id: 'j', position: { x: 0, y: 0 }, mountingStyle: 'strat_plate', angleDegrees: 0 } as const;
  const withJack = { ...createProject(), jacks: [jack], schemaVersion: 8 };

  it('hands the viewer the jacks and the 8 they need', () => {
    const link = projectForViewerLink(withJack);
    expect(link.jacks).toEqual([jack]);
    expect(link.schemaVersion).toBe(8);
  });

  it('leaves jacks out, and stays at the version its other fields need, when there are none', () => {
    expect(projectForViewerLink(createProject())).not.toHaveProperty('jacks', expect.anything());
    const empty = projectForViewerLink({ ...createProject(), jacks: [] });
    expect(empty.jacks).toBeUndefined();
    expect(empty.schemaVersion).toBe(7);
  });

  it('survives the compressed link round trip', async () => {
    const decoded = await decodePath(await buildViewer3DPath(withJack)) as { jacks: unknown[]; schemaVersion: number };
    expect(decoded.jacks).toEqual([jack]);
    expect(decoded.schemaVersion).toBe(8);
  });
});

describe('projectForViewerLink and schema 10', () => {
  const styled = () => {
    const project = createProject({ templateId: 's_style' });
    project.potentiometers = [
      { id: 'v', position: { x: 40, y: 200 }, bodyDiameterMm: 24, knobStyleId: 'dome', knobFinish: 'gold' },
      { id: 't', position: { x: 40, y: 230 }, bodyDiameterMm: 24, knobStyleId: 'chicken_head' },
    ];
    project.pickguards = [{ id: 'g', contour: project.contour, colorHex: '#c9ccd1', finish: 'chrome' }];
    project.schemaVersion = requiredSchemaVersion(project);
    return project;
  };

  it('holds knob and pickguard finishes out while the pinned viewer reads below 10', () => {
    if (PINNED_VIEWER_READ_SCHEMA >= 10) return;
    const project = styled();
    expect(project.schemaVersion).toBe(10);
    const handoff = projectForViewerLink(project);
    expect(handoff.potentiometers).toEqual([
      { id: 'v', position: { x: 40, y: 200 }, bodyDiameterMm: 24, knobStyleId: 'generic' },
      // Not schema 10's: an unknown id is what version 4 already allowed.
      { id: 't', position: { x: 40, y: 230 }, bodyDiameterMm: 24, knobStyleId: 'chicken_head' },
    ]);
    // The hex a finish writes alongside itself still reaches the viewer.
    expect(handoff.pickguards?.[0]).toMatchObject({ colorHex: '#c9ccd1' });
    expect(handoff.pickguards?.[0]).not.toHaveProperty('finish');
    expect(handoff.schemaVersion).toBeLessThanOrEqual(PINNED_VIEWER_READ_SCHEMA);
    // The document itself is untouched.
    expect(project.potentiometers?.[0].knobFinish).toBe('gold');
    expect(project.pickguards?.[0].finish).toBe('chrome');
  });

  it('never stamps the handoff above what the pinned viewer reads', () => {
    expect(projectForViewerLink(styled()).schemaVersion).toBeLessThanOrEqual(PINNED_VIEWER_READ_SCHEMA);
  });
});

describe('buildViewer3DPath', () => {
  it('builds a self-contained #v=2&d= fragment that decodes back to the viewer projection', async () => {
    const project = createProject({ templateId: 'p_bass_style' });
    const path = await buildViewer3DPath(project);
    expect(path.startsWith('/viewer3d/#v=2&d=')).toBe(true);
    // base64url: no characters that need escaping inside a fragment
    expect(path.split('d=')[1]).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = (await decodePath(path)) as { instrumentType: string; stringCount: number };
    expect(decoded).toEqual(JSON.parse(JSON.stringify(projectForViewerLink(project))));
    expect(decoded.instrumentType).toBe('bass');
    expect(decoded.stringCount).toBe(4);
  });
});
