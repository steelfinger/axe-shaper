import type { PathAnchor, SymmetryConfig, Vector2D } from '../types/guitar';
import { applyLiveSymmetry } from './symmetry';

/** Arrow-key step, and the step with Shift held. Always millimetres, whatever the display unit. */
export const NUDGE_STEP_MM = 1;
export const NUDGE_STEP_LARGE_MM = 10;

const ARROW_DIRECTIONS: Record<string, Vector2D> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/**
 * The model-space move for an arrow key, or null for any other key.
 *
 * The arrow names a direction on screen, so it is turned back through the
 * canvas rotation: with the body drawn horizontally, Up is model +X, not -Y.
 */
export function nudgeDeltaForKey(key: string, shiftKey: boolean, canvasRotationDegrees: number): Vector2D | null {
  const direction = ARROW_DIRECTIONS[key];
  if (!direction) return null;
  const step = shiftKey ? NUDGE_STEP_LARGE_MM : NUDGE_STEP_MM;
  const rad = (-canvasRotationDegrees * Math.PI) / 180;
  // Rounded so a quarter turn gives exact millimetres, not 6e-17.
  const exact = (value: number) => Math.round(value * step * 1e6) / 1e6 || 0;
  return {
    x: exact(direction.x * Math.cos(rad) - direction.y * Math.sin(rad)),
    y: exact(direction.x * Math.sin(rad) + direction.y * Math.cos(rad)),
  };
}

/**
 * Move the selected anchors by `delta`, following the same rules as dragging
 * them: a locked anchor stays put, one anchor on the body carries its mirror
 * partner under live symmetry (pass `symmetry` only for the body), and a
 * multi-selection moves as a rigid group with no mirroring side effects.
 * Returns the input array itself when nothing moved.
 */
export function nudgeAnchors(
  anchors: PathAnchor[],
  selectedIds: ReadonlySet<string>,
  delta: Vector2D,
  symmetry?: SymmetryConfig
): PathAnchor[] {
  const movable = anchors.filter((anchor) => selectedIds.has(anchor.id) && !anchor.locked);
  if (movable.length === 0 || (delta.x === 0 && delta.y === 0)) return anchors;

  const moved = anchors.map((anchor) =>
    movable.includes(anchor)
      ? { ...anchor, position: { x: anchor.position.x + delta.x, y: anchor.position.y + delta.y } }
      : anchor
  );
  return selectedIds.size === 1 && symmetry ? applyLiveSymmetry(moved, movable[0].id, symmetry) : moved;
}
