import { PICKUP_SPECIFICATIONS } from '../constants/hardware';
import type { GuitarProject, PickupPlacement, PickupType, Vector2D } from '../types/guitar';
import { scaleAnchors } from './bezier';
import { DEFAULT_PICKUP_TYPE, resolvePickupSpec } from './presets';

/**
 * Pickup editing as pure functions on `GuitarProject`, the same shape as
 * layerShapes.ts's contour helpers - gesture state lives in CanvasWorkspace,
 * this is the testable vocabulary it calls. Mirrors the iOS app's
 * Canvas/PickupEditing.swift, including its two deliberate constraints: a
 * pickup's X is always pinned to the centreline on any interactive move
 * (only Y is honoured), and drag-to-rotate snaps to a fixed step
 * unconditionally - numeric entry does not snap.
 */

export const PICKUP_ROTATION_SNAP_DEGREES = 5;

/** How far the rotation handle sits beyond the pickup's top edge, in mm. */
export const PICKUP_ROTATION_GRIP_DISTANCE_MM = 10;

function generatePickupId(): string {
  return `pickup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Roughly the middle of the corpus's own pickup Y range - just a starting point; dragging or the inspector's Y field is how it actually gets placed. */
const DEFAULT_POSITION: Vector2D = { x: 0, y: 150 };

/** Adds a pickup seeded from `type`'s catalogue dimensions. Returns the edited project and the new pickup's id, so the caller can select it immediately. */
export function addingPickup(project: GuitarProject, type: PickupType): { project: GuitarProject; id: string } {
  const spec = PICKUP_SPECIFICATIONS[type] ?? PICKUP_SPECIFICATIONS[DEFAULT_PICKUP_TYPE];
  const id = generatePickupId();
  const pickup: PickupPlacement = {
    id,
    type,
    offsetXMm: DEFAULT_POSITION.x,
    offsetYMm: DEFAULT_POSITION.y,
    angleDegrees: spec.defaultAngleDegrees ?? 0,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    anchors: structuredClone(spec.anchors),
  };
  return { project: { ...project, pickups: [...project.pickups, pickup] }, id };
}

export function removingPickup(project: GuitarProject, id: string): GuitarProject {
  return { ...project, pickups: project.pickups.filter((p) => p.id !== id) };
}

function updatingPickup(
  project: GuitarProject,
  id: string,
  change: (pickup: PickupPlacement) => PickupPlacement
): GuitarProject {
  const index = project.pickups.findIndex((p) => p.id === id);
  if (index === -1) return project;
  const pickups = [...project.pickups];
  pickups[index] = change(pickups[index]);
  return { ...project, pickups };
}

/**
 * A drag or a numeric-field move - same operation. `x` is always pinned to
 * the centreline: every pickup in the corpus sits at offsetXMm 0 (it's
 * centred under strings that are themselves symmetric about the
 * centreline), and a rout drifting off it is not a design a canvas drag
 * should be able to produce by accident. Only `y` is honoured. A file loaded
 * with a genuinely off-centre pickup keeps that position until the user
 * next moves it (this never runs on load).
 */
export function movingPickup(project: GuitarProject, id: string, y: number): GuitarProject {
  return updatingPickup(project, id, (p) => ({ ...p, offsetXMm: 0, offsetYMm: y }));
}

export function settingPickupAngle(project: GuitarProject, id: string, degrees: number): GuitarProject {
  return updatingPickup(project, id, (p) => ({ ...p, angleDegrees: degrees }));
}

/** The clockwise-from-up angle (degrees) of `point` as seen from `center` - matches SVG rotate()/Konva's rotation convention, since Y grows downward. */
export function angleDegreesOf(point: Vector2D, center: Vector2D): number {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * Rotate a pickup so its rotation handle sits directly under `touchPoint`,
 * snapped to the nearest PICKUP_ROTATION_SNAP_DEGREES - a direct
 * assignment, not an offset-preserving drag: the handle snaps to wherever
 * the touch is rather than tracking a relative offset from where the drag
 * started.
 *
 * Numeric entry (the inspector's Angle field) does not go through this
 * function and does not snap - typed input is the precision escape hatch
 * for whatever the gesture can't land exactly.
 *
 * A `touchPoint` exactly on the pickup's own centre has no defined angle;
 * the project is returned unchanged rather than snapping to an arbitrary
 * atan2(0, 0).
 */
export function rotatingPickupToward(project: GuitarProject, id: string, touchPoint: Vector2D): GuitarProject {
  const pickup = project.pickups.find((p) => p.id === id);
  if (!pickup) return project;
  const center = { x: pickup.offsetXMm, y: pickup.offsetYMm };
  if (touchPoint.x === center.x && touchPoint.y === center.y) return project;
  const raw = angleDegreesOf(touchPoint, center);
  const snapped = Math.round(raw / PICKUP_ROTATION_SNAP_DEGREES) * PICKUP_ROTATION_SNAP_DEGREES;
  return settingPickupAngle(project, id, snapped);
}

/** Resizes the actual routed shape to match, not just the reported number - see resolvePickupSpec in presets.ts for the same scaling applied to legacy files that predate embedded anchors. */
export function settingPickupWidth(project: GuitarProject, id: string, widthMm: number): GuitarProject {
  return updatingPickup(project, id, (p) => {
    const current = resolvePickupSpec(p);
    const scaleX = current.widthMm !== 0 ? widthMm / current.widthMm : 1;
    return { ...p, widthMm, anchors: scaleAnchors(current.anchors, scaleX, 1) };
  });
}

export function settingPickupHeight(project: GuitarProject, id: string, heightMm: number): GuitarProject {
  return updatingPickup(project, id, (p) => {
    const current = resolvePickupSpec(p);
    const scaleY = current.heightMm !== 0 ? heightMm / current.heightMm : 1;
    return { ...p, heightMm, anchors: scaleAnchors(current.anchors, 1, scaleY) };
  });
}

/**
 * Also reseeds width/height/anchors/angle to the new type's catalogue rout -
 * picking a different pickup type here means "I have a different pickup
 * now", so the cavity that actually gets routed should change with it, not
 * just its label. Angle only matters for the one type that's installed
 * canted (see defaultAngleDegrees on tele_bridge); every other type defaults
 * to 0. The fields stay independently editable afterwards (see
 * settingPickupWidth/Height above), so this is a starting point for the new
 * type, not a lock.
 */
export function settingPickupType(project: GuitarProject, id: string, type: PickupType): GuitarProject {
  const spec = PICKUP_SPECIFICATIONS[type] ?? PICKUP_SPECIFICATIONS[DEFAULT_PICKUP_TYPE];
  return updatingPickup(project, id, (p) => ({
    ...p,
    type,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    anchors: structuredClone(spec.anchors),
    angleDegrees: spec.defaultAngleDegrees ?? 0,
  }));
}

function rotatePoint(point: Vector2D, center: Vector2D, degrees: number): Vector2D {
  const rad = (degrees * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * Where the rotation handle sits for `pickup`: beyond its top edge, rotated
 * along with it. Reads the top edge from the anchors themselves rather than
 * assuming heightMm/2 above center - some cavities (single_coil, tele_neck)
 * aren't symmetric about their own placement/rotation origin, so the top
 * edge can sit closer to (or farther from) center than half the height. A
 * value read back via `angleDegreesOf` feeds straight into
 * `rotatingPickupToward`/`settingPickupAngle`.
 */
export function pickupRotationHandlePosition(pickup: PickupPlacement): Vector2D {
  const { anchors } = resolvePickupSpec(pickup);
  const topOffsetY = Math.min(...anchors.map((a) => a.position.y));
  const center = { x: pickup.offsetXMm, y: pickup.offsetYMm };
  const restPoint = { x: center.x, y: center.y + topOffsetY - PICKUP_ROTATION_GRIP_DISTANCE_MM };
  return rotatePoint(restPoint, center, pickup.angleDegrees);
}
