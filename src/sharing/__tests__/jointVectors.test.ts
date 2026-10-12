import { describe, expect, it } from 'vitest';
import vectors from '../../../tests/fixtures/sharing/joint-contract-vectors.json';
import { generateNeckJointOutline, validateNeckJointContract } from '../../utils/neckJointGeometry';
import type { InstrumentType, NeckJointGeometry, NeckPlacement } from '../../types/guitar';

describe('independently consumed joint contract vectors', () => {
  for (const vector of vectors.cases) {
    it(vector.id, () => {
      const geometry = vector.geometry as NeckJointGeometry;
      const placement = vector.placement as NeckPlacement;
      const check = () => validateNeckJointContract(geometry, placement, vector.instrumentType as InstrumentType);
      if (vector.accepted) {
        expect(check).not.toThrow();
        const outline = generateNeckJointOutline(geometry);
        expect(outline.closed).toBe(true);
        expect(outline.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
      } else expect(check).toThrow();
    });
  }
});
