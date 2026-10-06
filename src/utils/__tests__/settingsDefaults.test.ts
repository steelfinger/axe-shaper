import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import { loadProject, withSettingsDefaults } from '../presets';

const stored = (project: unknown) => JSON.parse(JSON.stringify(project));

describe('settings backfill at the read boundary', () => {
  it('opens a payload whose settings are the four iOS synthetic fields', () => {
    const base = stored(createProject());
    const minimal = {
      ...base,
      settings: { gridSizeMm: 25, name: 'Minimal', snapToGrid: true, unitDisplay: 'mm' },
    };
    const result = loadProject(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { settings } = result.project;
    expect(settings.symmetry).toEqual({ mode: 'none', sourceSide: 'left' });
    // What the file carried wins over the default.
    expect(settings.gridSizeMm).toBe(25);
    expect(settings.name).toBe('Minimal');
    expect((settings as unknown as Record<string, unknown>).snapToGrid).toBe(true);
  });

  it('agrees with the settings createProject writes', () => {
    const created = createProject({ templateId: 's_style' }).settings;
    const filled = withSettingsDefaults({ name: created.name } as typeof created);
    // The blueprint's own finish is the one thing a default may not know.
    const { finishStyle: _f, bodyColor: _b, ...rest } = created;
    expect(filled).toMatchObject(
      Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'name' && k in filled))
    );
  });

  it('leaves a complete settings object untouched, by reference', () => {
    const { settings } = createProject();
    expect(withSettingsDefaults(settings)).toBe(settings);
    const loaded = loadProject(stored(createProject()));
    expect(loaded.ok && loaded.project.settings).toEqual(createProject().settings);
  });
});
