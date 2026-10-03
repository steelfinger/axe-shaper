import { describe, expect, it } from 'vitest';
import { BRIDGE_PRESETS, NECK_PRESETS } from '../../constants/hardware';
import {
  getBridgePlateTopYMm,
  getFretDistanceFromNutMm,
  getSaddleYMm,
  getTheoreticalSaddleYMm,
} from '../scaleMath';

const neck = NECK_PRESETS['fender_strat_21'];
const tremolo = BRIDGE_PRESETS['tremolo_strat'];

describe('scaleMath', () => {
  it('measures the theoretical saddle from the joint line, not the fingerboard end', () => {
    expect(getTheoreticalSaddleYMm(neck)).toBe(neck.scaleLengthMm - neck.nutToBodyEdgeMm!);
  });

  it('adds treble-side compensation to get the actual saddle line', () => {
    expect(getSaddleYMm(neck, tremolo)).toBeCloseTo(
      getTheoreticalSaddleYMm(neck) + tremolo.compensationMm.treble,
      10
    );
  });

  it('anchors the bridge plate to the uncompensated line', () => {
    // Regression: anchoring to the compensated saddle pulled a TOM's plate
    // onto the saddle line. The plate must not move when compensation does.
    const more = { ...tremolo, compensationMm: { ...tremolo.compensationMm, treble: 40 } };
    expect(getBridgePlateTopYMm(neck, more)).toBe(getBridgePlateTopYMm(neck, tremolo));
  });

  it('falls back to a default nut-to-body-edge when a neck has none', () => {
    const bare = { ...neck, nutToBodyEdgeMm: undefined } as unknown as typeof neck;
    expect(getTheoreticalSaddleYMm(bare)).toBeCloseTo(neck.scaleLengthMm - 390.7, 10);
  });

  it('puts the 12th fret at half the scale length and the nut at zero', () => {
    expect(getFretDistanceFromNutMm(0, 647.7)).toBe(0);
    expect(getFretDistanceFromNutMm(12, 647.7)).toBeCloseTo(647.7 / 2, 10);
  });
});
