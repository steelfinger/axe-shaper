import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import { displayedPickguardFinish, settingKnobStyle, settingPickguardFinish } from '../controlEditing';
import {
  FALLBACK_KNOB_STYLE,
  HARDWARE_FINISHES,
  PICKGUARD_FINISH_COLOR_HEX,
  resolvedKnobStyle,
} from '../../constants/knobStyles';
import { requiredSchemaVersion } from '../../constants/schema';
import { exportProjectToSVG, extractProjectFromSVG } from '../svgExporter';
import { loadProject } from '../presets';
import type { GuitarProject, PickguardPlacement } from '../../types/guitar';

// Schema 10 (docs/AXE_SVG_FORMAT.md, "Version 10"). The iPad app's
// M34PickguardFinishTests and M34 knob tests pin the same behaviour.

const guard = (id: string, fields: Partial<PickguardPlacement> = {}): PickguardPlacement => ({
  id,
  contour: { closed: true, anchors: [] },
  colorHex: '#ffffff',
  ...fields,
});

const withGuards = (...guards: PickguardPlacement[]): GuitarProject => ({
  ...createProject({ templateId: 's_style' }),
  pickguards: guards,
});

describe('knob styles', () => {
  it('resolves generic to the blueprint family, and type and finish independently', () => {
    expect(resolvedKnobStyle({ knobStyleId: 'generic' }, 's_style')).toEqual({ type: 'skirted', finish: 'white' });
    expect(resolvedKnobStyle({ knobStyleId: 'generic', knobFinish: 'gold' }, 's_style')).toEqual({ type: 'skirted', finish: 'gold' });
    expect(resolvedKnobStyle({ knobStyleId: 'dome' }, 'single_cut')).toEqual({ type: 'dome', finish: 'gold' });
    // Unknown values fall back, and so does an unknown family.
    expect(resolvedKnobStyle({ knobStyleId: 'chicken_head', knobFinish: 'pearl' }, 't_style')).toEqual({ type: 'dome', finish: 'chrome' });
    expect(resolvedKnobStyle({ knobStyleId: 'generic' }, 'user_template_1')).toEqual(FALLBACK_KNOB_STYLE);
    expect(resolvedKnobStyle(undefined, 'constructor')).toEqual(FALLBACK_KNOB_STYLE);
  });

  it('sets every knob together and stamps 10', () => {
    const project = createProject({ templateId: 's_style' });
    expect((project.potentiometers ?? []).length).toBeGreaterThan(1);
    expect(requiredSchemaVersion(project)).toBeLessThan(10);
    const styled = settingKnobStyle(project, { type: 'top_hat', finish: 'black' });
    for (const pot of styled.potentiometers ?? []) {
      expect(pot).toMatchObject({ knobStyleId: 'top_hat', knobFinish: 'black' });
    }
    expect(requiredSchemaVersion(styled)).toBe(10);
    // Positions and bodies are untouched.
    expect(styled.potentiometers?.map(({ id, position, bodyDiameterMm }) => ({ id, position, bodyDiameterMm })))
      .toEqual(project.potentiometers?.map(({ id, position, bodyDiameterMm }) => ({ id, position, bodyDiameterMm })));
  });
});

describe('pickguard finish', () => {
  it('writes the finish and its hex on the named guard only', () => {
    const edited = settingPickguardFinish(withGuards(guard('main'), guard('plate', { colorHex: '#123456' })), 'main', 'chrome');
    expect(edited.pickguards?.[0]).toMatchObject({ finish: 'chrome', colorHex: '#c9ccd1' });
    expect(edited.pickguards?.[1]).toEqual(guard('plate', { colorHex: '#123456' }));
    expect(requiredSchemaVersion(edited)).toBe(10);
    const missing = settingPickguardFinish(edited, 'missing', 'gold');
    expect(missing.pickguards).toEqual(edited.pickguards);
  });

  it('pins the hex table the viewer and iPad app use', () => {
    expect(HARDWARE_FINISHES.map((finish) => PICKGUARD_FINISH_COLOR_HEX[finish]))
      .toEqual(['#ffffff', '#f0e6c8', '#111111', '#d4af37', '#c9ccd1']);
  });

  it('shows the finish a guard names or its colour matches, else custom', () => {
    expect(displayedPickguardFinish(guard('a'))).toBe('white');
    expect(displayedPickguardFinish(guard('a', { colorHex: '#F0E6C8' }))).toBe('cream');
    expect(displayedPickguardFinish(guard('a', { finish: 'black' }))).toBe('black');
    expect(displayedPickguardFinish(guard('a', { colorHex: '#123456' }))).toBeNull();
    expect(displayedPickguardFinish(guard('a', { colorHex: undefined }))).toBeNull();
    // An unknown finish is not passed off as the colour's.
    expect(displayedPickguardFinish(guard('a', { finish: 'tortoise' }))).toBeNull();
  });

  it('round-trips known and unknown schema 10 values through a save and load', () => {
    let project = settingKnobStyle(createProject({ templateId: 's_style' }), { type: 'speed', finish: 'cream' });
    project = {
      ...project,
      potentiometers: [...(project.potentiometers ?? []), { id: 'odd', position: { x: 0, y: 300 }, bodyDiameterMm: 24, knobStyleId: 'chicken_head', knobFinish: 'pearl' }],
      pickguards: [guard('main', { colorHex: '#d4af37', finish: 'gold' }), guard('plate', { colorHex: '#123456', finish: 'tortoise' })],
    };
    const reloaded = loadProject(extractProjectFromSVG(exportProjectToSVG(project)));
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;
    expect(reloaded.project.schemaVersion).toBe(10);
    expect(reloaded.project.potentiometers).toEqual(project.potentiometers);
    expect(reloaded.project.pickguards).toEqual(project.pickguards);
  });
});
