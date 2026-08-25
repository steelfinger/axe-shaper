import type { Vector2D } from '../types/guitar';

/**
 * A browser-local Bézier-handle drag aid. It intentionally stays out of the
 * project schema: snapping changes how a person edits, not the guitar they
 * designed, so sharing an .axe.svg must not change another person's input.
 */
export interface HandleAngleSnapPreference {
  enabled: boolean;
  incrementDegrees: 15 | 30;
}

const STORAGE_KEY = 'axe-shaper:handle-angle-snap';
export const DEFAULT_HANDLE_ANGLE_SNAP: HandleAngleSnapPreference = {
  enabled: false,
  incrementDegrees: 15,
};

export function loadHandleAngleSnapPreference(): HandleAngleSnapPreference {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<HandleAngleSnapPreference>;
    return {
      enabled: saved.enabled === true,
      incrementDegrees: saved.incrementDegrees === 30 ? 30 : 15,
    };
  } catch {
    return DEFAULT_HANDLE_ANGLE_SNAP;
  }
}

export function saveHandleAngleSnapPreference(preference: HandleAngleSnapPreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
}

/** Round a handle direction without changing its length, matching the iOS editor. */
export function snapHandleAngle(offset: Vector2D, incrementDegrees: number | null): Vector2D {
  if (!incrementDegrees || !Number.isFinite(incrementDegrees) || incrementDegrees <= 0 || incrementDegrees >= 360) {
    return offset;
  }

  const length = Math.hypot(offset.x, offset.y);
  if (length === 0) return offset;

  const stepRadians = (incrementDegrees * Math.PI) / 180;
  const snappedAngle = Math.round(Math.atan2(offset.y, offset.x) / stepRadians) * stepRadians;
  return { x: Math.cos(snappedAngle) * length, y: Math.sin(snappedAngle) * length };
}
