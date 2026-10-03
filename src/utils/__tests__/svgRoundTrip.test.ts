import { describe, expect, it } from 'vitest';
import { REFERENCE_TEMPLATES } from '../../constants/templates';
import { PROJECT_SCHEMA_VERSION } from '../../constants/schema';
import { createProject } from '../projectFactory';
import { loadProject } from '../presets';
import { buildProjectFilename, exportProjectToSVG, extractProjectFromSVG } from '../svgExporter';

const reload = (svg: string) => {
  const result = loadProject(extractProjectFromSVG(svg));
  if (!result.ok) throw new Error(`reload refused: ${result.message}`);
  return result.project;
};

describe('save and reopen', () => {
  it.each(Object.keys(REFERENCE_TEMPLATES))('blueprint %s round-trips', (templateId) => {
    const project = createProject({ templateId });
    const reopened = reload(exportProjectToSVG(project));
    expect(reopened.instrumentType).toBe(project.instrumentType);
    expect(reopened.stringCount).toBe(project.stringCount);
    expect(reopened.activeTemplateId).toBe(project.activeTemplateId);
    expect(reopened.contour.anchors.map((a) => [a.id, a.position])).toEqual(
      project.contour.anchors.map((a) => [a.id, a.position])
    );
    expect(reopened.pickups).toHaveLength(project.pickups.length);
  });

  it('is stable: saving a reopened file again changes nothing that matters', () => {
    const first = exportProjectToSVG(createProject({ templateId: 'p_bass_style' }));
    const second = exportProjectToSVG(reload(first));
    expect(reload(second)).toEqual(reload(first));
  });

  it('carries the embedded hardware, so the bridge cannot move on reopen', () => {
    const project = createProject();
    const reopened = reload(exportProjectToSVG(project));
    expect(reopened.neckPreset).toEqual(project.neckPreset);
    expect(reopened.bridgePreset).toEqual(project.bridgePreset);
  });

  it('stamps new designs at the current version, since every blueprint carries the v7 joint pair', () => {
    for (const templateId of Object.keys(REFERENCE_TEMPLATES)) {
      const saved = extractProjectFromSVG(exportProjectToSVG(createProject({ templateId })))!;
      expect(saved.schemaVersion, templateId).toBe(PROJECT_SCHEMA_VERSION);
    }
  });

  it('refuses to save a project that has only half of the v7 joint pair', () => {
    const project = createProject();
    expect(() => exportProjectToSVG({ ...project, neckPlacement: undefined })).toThrow(/neckJointGeometry and neckPlacement/);
  });

  it('keeps a name with XML metacharacters intact', () => {
    const project = createProject();
    const named = { ...project, settings: { ...project.settings, name: `Tom & Jerry's <"Axe">` } };
    const svg = exportProjectToSVG(named);
    expect(svg).toContain('<project:name>Tom &amp; Jerry');
    expect(svg).not.toContain('<"Axe">');
    expect(reload(svg).settings.name).toBe(`Tom & Jerry's <"Axe">`);
  });

  it('refuses a file that is not an Axe Shaper project', () => {
    expect(extractProjectFromSVG('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull();
    expect(extractProjectFromSVG('not even xml')).toBeNull();
    expect(extractProjectFromSVG('')).toBeNull();
  });
});

describe('buildProjectFilename', () => {
  it('slugs the name and adds a date and a time token', () => {
    const date = new Date(2026, 9, 3, 1, 2, 3, 450); // local time: Oct 3, 01:02:03.450
    expect(buildProjectFilename('My Cool  Guitar', date)).toBe('my-cool-guitar-2026-10-03-037234.axe.svg');
  });

  it('sorts same-day saves chronologically as strings', () => {
    const early = buildProjectFilename('x', new Date(2026, 0, 1, 0, 0, 1));
    const late = buildProjectFilename('x', new Date(2026, 0, 1, 23, 59, 59));
    expect(early < late).toBe(true);
  });
});
