import { describe, expect, it } from 'vitest';
import type { GuitarProject } from '../../types/guitar';
import { archedTopConstructionForTemplate, isArchedTop } from '../bodyTop';
import {
  FALLBACK_BODY_THICKNESS_MM,
  resolvedBodyThickness,
} from '../bodyThickness';
import {
  defaultHeadstockShape,
  legacyInstrumentAppearance,
  resolveInstrumentAppearance,
} from '../instrumentAppearance';
import { neckJointFabricationDisclosure } from '../neckJointDisclosure';

describe('bodyThickness', () => {
  it.each([
    [undefined, FALLBACK_BODY_THICKNESS_MM],
    [NaN, FALLBACK_BODY_THICKNESS_MM],
    [Infinity, FALLBACK_BODY_THICKNESS_MM],
    [0, FALLBACK_BODY_THICKNESS_MM],
    [-3, FALLBACK_BODY_THICKNESS_MM],
    [44, 44],
    [9999, 500],
  ])('resolves %s to %s', (input, expected) => {
    expect(resolvedBodyThickness({ bodyThicknessMm: input as never })).toBe(expected);
  });
});

describe('bodyTop', () => {
  it('uses the carved cap only for a single-cut', () => {
    expect(archedTopConstructionForTemplate('single_cut')).toBe('carved_cap');
    expect(archedTopConstructionForTemplate('s_style')).toBe('solid_body_carve');
    expect(archedTopConstructionForTemplate(undefined)).toBe('solid_body_carve');
  });

  it('recognises only the two constructions', () => {
    expect(isArchedTop('carved_cap')).toBe(true);
    expect(isArchedTop('solid_body_carve')).toBe(true);
    expect(isArchedTop('flat')).toBe(false);
    expect(isArchedTop(undefined)).toBe(false);
  });
});

describe('instrumentAppearance', () => {
  it('picks a headstock per template, then per instrument, then the generic default', () => {
    expect(defaultHeadstockShape('gibson_flying_v', 'guitar')).toBe('flying_v');
    expect(defaultHeadstockShape('p_bass_style', 'bass')).toBe('bass_f');
    expect(defaultHeadstockShape('unknown_bass', 'bass')).toBe('bass_f');
    expect(defaultHeadstockShape('sg_style', 'guitar')).toBe('gibson');
    expect(defaultHeadstockShape('mystery', 'guitar')).toBe('strat_style');
    expect(defaultHeadstockShape(undefined, 'guitar')).toBe('strat_style');
  });

  it('gives Gibson-family and glued necks a rosewood board, everything else maple', () => {
    expect(legacyInstrumentAppearance('sg_style', 'guitar').fingerboard).toBe('rosewood');
    expect(legacyInstrumentAppearance('s_style', 'guitar', 'glued').fingerboard).toBe('rosewood');
    expect(legacyInstrumentAppearance('s_style', 'guitar', 'bolt_on').fingerboard).toBe('maple');
  });

  it('prefers a persisted appearance over the legacy fallback', () => {
    const persisted = { ...legacyInstrumentAppearance('s_style', 'guitar'), fingerboard: 'ebony' } as never;
    const project = {
      instrumentAppearance: persisted,
      activeTemplateId: 'sg_style',
      instrumentType: 'guitar',
    } as Pick<GuitarProject, 'instrumentAppearance' | 'activeTemplateId' | 'instrumentType' | 'neckJointMechanism'>;
    expect(resolveInstrumentAppearance(project)).toBe(persisted);
    expect(resolveInstrumentAppearance({ ...project, instrumentAppearance: undefined }).fingerboard).toBe('rosewood');
  });
});

describe('neckJointFabricationDisclosure', () => {
  const withJoint = (geometry: unknown) => ({ neckJointGeometry: geometry }) as GuitarProject;

  it('says nothing for a legacy project, so its SVG/DXF bytes do not change', () => {
    expect(neckJointFabricationDisclosure({} as GuitarProject)).toBeNull();
  });

  it('always warns for a custom joint', () => {
    expect(neckJointFabricationDisclosure(withJoint({ mode: 'custom' }))).toMatch(/^Custom neck joint/);
  });

  it.each([
    ['verified', null],
    ['documented', /^Documented/],
    ['measured', /^Measured/],
    [undefined, /^Unverified/],
  ])('locked joint with %s evidence', (evidenceLevel, expected) => {
    const result = neckJointFabricationDisclosure(
      withJoint({ mode: 'locked', profileSnapshot: { evidenceLevel } })
    );
    if (expected === null) expect(result).toBeNull();
    else expect(result).toMatch(expected);
  });
});
