import { describe, expect, it } from 'vitest';
import { buildViewer3DPath, projectForViewerLink } from '../viewer3dLink';
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
  const withJack = {
    ...createProject(),
    jacks: [{ id: 'j', position: { x: 0, y: 0 }, mountingStyle: 'strat_plate', angleDegrees: 0 }],
    schemaVersion: 8,
  };

  it('omits jacks and hands the viewer a version it reads, not the 8 the document carries', () => {
    const link = projectForViewerLink(withJack);
    expect(link).not.toHaveProperty('jacks');
    expect(link.schemaVersion).toBe(7);
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
