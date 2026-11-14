import { describe, expect, it } from 'vitest';
import { CURATED_NECK_PRESETS } from '../../constants/hardware';
import { createProject } from '../projectFactory';
import {
  applyNeckFretCount,
  neckNameWithoutFretCount,
  neckWithFretCount,
  resolveBridgePreset,
  resolveNeckPreset,
} from '../presets';
import { getFretDistanceFromNutMm, getSaddleYMm } from '../scaleMath';

const fender = CURATED_NECK_PRESETS.fender_scale;

describe('neckWithFretCount', () => {
  it('ends the fingerboard past the new last fret and renames the copy', () => {
    const neck = neckWithFretCount(fender, 24);
    expect(neck.frets).toBe(24);
    expect(neck.name).toBe('Fender Scale (25.5" Scale, 24 Frets)');
    expect(neck.nutToJointMm).toBeCloseTo(getFretDistanceFromNutMm(24, 647.7) + 6, 10);
  });

  it('leaves scale, body joint and pocket alone', () => {
    const { frets: _f, name: _n, nutToJointMm: _j, ...changed } = neckWithFretCount(fender, 24);
    const { frets: _f2, name: _n2, nutToJointMm: _j2, ...original } = fender;
    expect(changed).toEqual(original);
  });

  it('returns to the catalogue entry exactly when its own count is chosen again', () => {
    expect(neckWithFretCount(neckWithFretCount(fender, 24), 22)).toEqual(fender);
  });
});

describe('applyNeckFretCount', () => {
  const project = createProject({ templateId: 's_style' });

  it('does not move the saddle line', () => {
    const edited = applyNeckFretCount(project, 24);
    expect(resolveNeckPreset(edited).frets).toBe(24);
    expect(getSaddleYMm(resolveNeckPreset(edited), resolveBridgePreset(edited))).toBe(
      getSaddleYMm(resolveNeckPreset(project), resolveBridgePreset(project))
    );
    expect(edited.neckPlacement).toEqual(project.neckPlacement);
    expect(edited.neckJointGeometry).toEqual(project.neckJointGeometry);
    expect(edited.contour).toEqual(project.contour);
  });

  it('keeps the schema stamp and the preset id', () => {
    const edited = applyNeckFretCount(project, 24);
    expect(edited.schemaVersion).toBe(project.schemaVersion);
    expect(edited.neckPresetId).toBe(project.neckPresetId);
  });

  it('ignores a missing count rather than writing one', () => {
    expect(applyNeckFretCount(project, undefined as never)).toBe(project);
  });
});

describe('neckNameWithoutFretCount', () => {
  it('drops only the fret count', () => {
    expect(neckNameWithoutFretCount('Fender Scale (25.5" Scale, 22 Frets)')).toBe('Fender Scale (25.5" Scale)');
    expect(neckNameWithoutFretCount('Firebird-Style (24.75" Scale, 22 Frets, Fret 19 Joint Line)')).toBe(
      'Firebird-Style (24.75" Scale, Fret 19 Joint Line)'
    );
  });
});
