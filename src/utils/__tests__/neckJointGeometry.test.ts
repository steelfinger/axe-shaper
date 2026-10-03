import { describe, expect, it } from 'vitest';
import type { NeckJointGeometry, NeckPlacement } from '../../types/guitar';
import {
  NeckJointContractError,
  boltOnMouthWidthForTaper,
  boltOnSideTaperRadians,
  deriveBoltOnPocketWidthsFromNeckTaper,
  generateNeckJointOutline,
  neckJointCutterWarnings,
  neckJointOutlineToSVGPath,
  nutToBodyEdgeFromPlacement,
  requiredPocketWidthForHeelFit,
  setCustomNeckJointMouthWidth,
  updateCustomNeckJoint,
  updateCustomNeckPlacement,
  validateNeckJointContract,
  validateNeckJointGeometry,
} from '../neckJointGeometry';

/** A custom bolt-on pocket: the editable kind, with no profile snapshot to match. */
const customPocket = (overrides: Partial<NeckJointGeometry> = {}): NeckJointGeometry => ({
  mode: 'custom',
  derivedFromProfileId: 'test_profile',
  mechanism: 'bolt_on',
  planShape: 'bolt_on_pocket',
  parameters: {
    mouthWidthMm: 56,
    deepEndWidthMm: 57,
    planLengthMm: 70,
    endCornerRadiusMm: 6,
    endTreatment: 'rounded',
    endRoundnessMm: 12,
  },
  ...overrides,
});

const gluedMortise = (overrides: Partial<NeckJointGeometry> = {}): NeckJointGeometry => ({
  mode: 'custom',
  derivedFromProfileId: 'test_mortise',
  mechanism: 'glued',
  planShape: 'straight_mortise',
  parameters: { mouthWidthMm: 50, planLengthMm: 60, endCornerRadiusMm: 0, endTreatment: 'square', endRoundnessMm: 0 },
  ...overrides,
});

const guitarPlacement: NeckPlacement = {
  mode: 'blueprint',
  referenceFret: 22,
  jointToReferenceFretMm: 20,
  provenance: 'test',
};

describe('validateNeckJointGeometry', () => {
  it('accepts a well-formed custom pocket and mortise', () => {
    expect(() => validateNeckJointGeometry(customPocket())).not.toThrow();
    expect(() => validateNeckJointGeometry(gluedMortise())).not.toThrow();
  });

  it.each([
    ['a non-positive mouth width', { mouthWidthMm: 0 }],
    ['a NaN plan length', { planLengthMm: NaN }],
    ['a negative end radius', { endCornerRadiusMm: -1 }],
    ['an unknown end treatment', { endTreatment: 'bevelled' as never }],
    ['a rounding radius larger than the pocket', { endRoundnessMm: 400 }],
  ])('rejects %s', (_label, parameters) => {
    const geometry = customPocket();
    geometry.parameters = { ...geometry.parameters, ...parameters };
    expect(() => validateNeckJointGeometry(geometry)).toThrow(NeckJointContractError);
  });

  it('rejects a bolt-on pocket on a glued neck and a mortise on a bolt-on neck', () => {
    expect(() => validateNeckJointGeometry(customPocket({ mechanism: 'glued' }))).toThrow(NeckJointContractError);
    expect(() => validateNeckJointGeometry(gluedMortise({ mechanism: 'bolt_on' }))).toThrow(NeckJointContractError);
  });

  it('rejects a bolt-on whose deep end is narrower than its mouth', () => {
    const geometry = customPocket();
    geometry.parameters = { ...geometry.parameters, deepEndWidthMm: 50 };
    expect(() => validateNeckJointGeometry(geometry)).toThrow(/narrower/);
  });

  it('rejects a custom joint that carries a locked snapshot, or lacks its source', () => {
    expect(() => validateNeckJointGeometry(customPocket({ derivedFromProfileId: undefined }))).toThrow(NeckJointContractError);
    expect(() => validateNeckJointGeometry(customPocket({ profileSnapshot: {} as never }))).toThrow(NeckJointContractError);
  });

  it('rejects a locked joint with no embedded profile snapshot', () => {
    expect(() => validateNeckJointGeometry(customPocket({ mode: 'locked', derivedFromProfileId: undefined }))).toThrow(
      /snapshot/
    );
  });

  it('requires a fit target before accepting a clearance', () => {
    expect(() => validateNeckJointGeometry(customPocket({ fittingClearanceMm: 0.2 }))).toThrow(/target heel width/);
  });

  it('rejects a deep end that cannot hold the measured heel plus clearance on both sides', () => {
    expect(() =>
      validateNeckJointGeometry(customPocket({ targetHeelWidthMm: 57, fittingClearanceMm: 0.5 }))
    ).toThrow(/fit the measured heel/);
    expect(() =>
      validateNeckJointGeometry(customPocket({ targetHeelWidthMm: 55.5, fittingClearanceMm: 0.5 }))
    ).not.toThrow();
  });

  it('allows a neck angle only on a glued joint', () => {
    expect(() => validateNeckJointGeometry(gluedMortise({ neckAngleDegrees: 3 }))).not.toThrow();
    expect(() => validateNeckJointGeometry(customPocket({ neckAngleDegrees: 3 }))).toThrow(NeckJointContractError);
  });
});

describe('generateNeckJointOutline', () => {
  it('starts at the left mouth point on Y=0 and runs into the body', () => {
    const outline = generateNeckJointOutline(gluedMortise());
    expect(outline.closed).toBe(true);
    expect(outline.points[0]).toEqual({ x: -25, y: 0 });
    expect(outline.points[1]).toEqual({ x: 25, y: 0 });
    expect(Math.max(...outline.points.map((p) => p.y))).toBe(60);
    expect(Math.min(...outline.points.map((p) => p.y))).toBe(0);
  });

  it('is symmetric about the centreline', () => {
    const outline = generateNeckJointOutline(customPocket());
    const key = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`;
    const points = new Set(outline.points.map((p) => key(p.x, p.y)));
    for (const p of outline.points) expect(points.has(key(-p.x, p.y))).toBe(true);
  });

  it('tapers: the walls widen from the mouth to the deep end', () => {
    const outline = generateNeckJointOutline(customPocket());
    const widest = Math.max(...outline.points.map((p) => p.x));
    expect(widest).toBeCloseTo(28.5, 6);
  });

  it('refuses geometry that fails validation rather than drawing it', () => {
    expect(() => generateNeckJointOutline(customPocket({ mechanism: 'glued' }))).toThrow(NeckJointContractError);
  });

  it('uses more points at a tighter tolerance for a rounded end', () => {
    const coarse = generateNeckJointOutline(customPocket(), 0.5).points.length;
    const fine = generateNeckJointOutline(customPocket(), 0.001).points.length;
    expect(fine).toBeGreaterThan(coarse);
  });

  it('serialises as a closed path', () => {
    const path = neckJointOutlineToSVGPath(generateNeckJointOutline(gluedMortise()));
    expect(path.startsWith('M -25.000000 0.000000')).toBe(true);
    expect(path.endsWith(' Z')).toBe(true);
  });
});

describe('editing a custom joint', () => {
  it('refuses to edit a locked joint', () => {
    expect(() => updateCustomNeckJoint(customPocket({ mode: 'locked' }), {})).toThrow(/Convert a locked/);
  });

  it('updates parameters without mutating the input', () => {
    const original = customPocket();
    const updated = setCustomNeckJointMouthWidth(original, 55);
    expect(updated.parameters.mouthWidthMm).toBe(55);
    expect(original.parameters.mouthWidthMm).toBe(56);
  });

  it('null removes an optional field, undefined leaves it', () => {
    const withCutter = customPocket({ cutterDiameterMm: 6 });
    expect(updateCustomNeckJoint(withCutter, {}).cutterDiameterMm).toBe(6);
    expect(updateCustomNeckJoint(withCutter, { cutterDiameterMm: null }).cutterDiameterMm).toBeUndefined();
  });

  it('rejects an update whose result cannot be built', () => {
    expect(() => updateCustomNeckJoint(customPocket(), { parameters: { mouthWidthMm: 70 } })).toThrow(
      NeckJointContractError
    );
  });

  it('drops pre-release contour attachment on edit', () => {
    const attached = customPocket({ mouthAnchorIds: ['a', 'b'] });
    expect(updateCustomNeckJoint(attached, {}).mouthAnchorIds).toBeUndefined();
  });
});

describe('bolt-on taper and heel fit', () => {
  it('preserves an authored taper when length and deep width change', () => {
    const { parameters } = customPocket();
    const radians = boltOnSideTaperRadians(parameters);
    const mouth = boltOnMouthWidthForTaper(parameters, 60, 100);
    const rebuilt = { mouthWidthMm: mouth, deepEndWidthMm: 60, planLengthMm: 100 };
    expect(boltOnSideTaperRadians(rebuilt)).toBeCloseTo(radians, 10);
  });

  it('requires the heel plus clearance twice, and nothing without a target', () => {
    expect(requiredPocketWidthForHeelFit({ targetHeelWidthMm: 56, fittingClearanceMm: 0.25 })).toBe(56.5);
    expect(requiredPocketWidthForHeelFit({ targetHeelWidthMm: 56 })).toBe(56);
    expect(requiredPocketWidthForHeelFit({})).toBeUndefined();
  });

  it('warns when the cutter is too big for the internal radius, and only then', () => {
    // The rounded end's own radius is 12mm, so a 30mm cutter (15mm radius) cannot reach it.
    const tight = customPocket({ cutterDiameterMm: 30 });
    expect(neckJointCutterWarnings(tight)).toHaveLength(1);
    expect(neckJointCutterWarnings(customPocket({ cutterDiameterMm: 6 }))).toEqual([]);
    expect(neckJointCutterWarnings(customPocket())).toEqual([]);
  });

  it('derives pocket widths from a linear neck taper', () => {
    const neck = { scaleLengthMm: 648, neckTaper: { nutWidthMm: 42, heelWidthMm: 56, nutToHeelMm: 600 } };
    const placement: NeckPlacement = { ...guitarPlacement, jointToReferenceFretMm: 0 };
    const mouthStation = nutToBodyEdgeFromPlacement(placement, 648);
    const widths = deriveBoltOnPocketWidthsFromNeckTaper(neck as never, placement, 70);
    expect(widths.mouthWidthMm).toBeCloseTo(42 + (14 * mouthStation) / 600, 10);
    expect(widths.deepEndWidthMm! - widths.mouthWidthMm).toBeCloseTo((14 * 70) / 600, 10);
  });

  it('rejects a pocket that runs past the end of the taper', () => {
    const neck = { scaleLengthMm: 648, neckTaper: { nutWidthMm: 42, heelWidthMm: 56, nutToHeelMm: 400 } };
    expect(() => deriveBoltOnPocketWidthsFromNeckTaper(neck as never, guitarPlacement, 70)).toThrow(/outside/);
  });
});

describe('neck placement', () => {
  it('converts the reference-fret datum to nut-to-body-edge', () => {
    const edge = nutToBodyEdgeFromPlacement(guitarPlacement, 647.7);
    expect(edge).toBeCloseTo(647.7 * (1 - Math.pow(2, -22 / 12)) - 20, 10);
  });

  it('rejects a non-positive scale length', () => {
    expect(() => nutToBodyEdgeFromPlacement(guitarPlacement, 0)).toThrow(NeckJointContractError);
  });

  it('only accepts the instrument\'s own reference fret', () => {
    expect(() => updateCustomNeckPlacement(guitarPlacement, 'bass', 864, 10)).toThrow(/reference fret must be 20/);
    expect(updateCustomNeckPlacement(guitarPlacement, 'guitar', 647.7, 10)).toMatchObject({
      mode: 'custom',
      jointToReferenceFretMm: 10,
      provenance: 'user:joint-to-reference-fret',
    });
  });

  it('refuses a registration that puts the nut past the joint line', () => {
    expect(() => updateCustomNeckPlacement(guitarPlacement, 'guitar', 647.7, 5000)).toThrow(/nut before the body/);
    expect(() => updateCustomNeckPlacement(guitarPlacement, 'guitar', 647.7, -1)).toThrow(NeckJointContractError);
  });
});

describe('validateNeckJointContract', () => {
  it('needs both the geometry and the placement', () => {
    expect(() => validateNeckJointContract(undefined, guitarPlacement, 'guitar')).toThrow(/both/);
    expect(() => validateNeckJointContract(customPocket(), undefined, 'guitar')).toThrow(/both/);
  });

  it('accepts a matching pair and rejects a wrong reference fret or blank provenance', () => {
    expect(() => validateNeckJointContract(customPocket(), guitarPlacement, 'guitar')).not.toThrow();
    expect(() => validateNeckJointContract(customPocket(), guitarPlacement, 'bass')).toThrow(/reference fret/);
    expect(() => validateNeckJointContract(customPocket(), { ...guitarPlacement, provenance: ' ' }, 'guitar')).toThrow(
      /provenance/
    );
  });
});
