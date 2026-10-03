import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import {
  addingPickup,
  movingPickup,
  removingPickup,
  rotatingPickupToward,
  settingPickupType,
  settingPickupWidth,
} from '../pickupEditing';
import {
  addingPotentiometer,
  addingSwitch,
  hardwarePlacementExists,
  removingHardwarePlacement,
  rotatingSwitchToward,
} from '../controlEditing';
import { offeredPickupTypes } from '../presets';

describe('pickup editing', () => {
  const guitar = createProject();
  const bass = createProject({ templateId: 'p_bass_style' });

  it('adds a pickup seeded from the catalogue and returns its id', () => {
    const type = offeredPickupTypes('guitar')[0];
    const { project, id } = addingPickup(guitar, type);
    expect(project.pickups).toHaveLength(guitar.pickups.length + 1);
    expect(project.pickups.at(-1)?.id).toBe(id);
    expect(guitar.pickups.some((p) => p.id === id)).toBe(false); // input not mutated
  });

  it('redirects a pickup type from the other instrument rather than routing it', () => {
    const guitarType = offeredPickupTypes('guitar')[0];
    const { project } = addingPickup(bass, guitarType);
    const added = project.pickups.at(-1)!;
    expect(offeredPickupTypes('bass')).toContain(added.type);
  });

  it('pins X to the centreline on a move', () => {
    const { project, id } = addingPickup(guitar, offeredPickupTypes('guitar')[0]);
    const off = { ...project, pickups: project.pickups.map((p) => ({ ...p, offsetXMm: 12 })) };
    const moved = movingPickup(off, id, 222).pickups.find((p) => p.id === id)!;
    expect(moved.offsetXMm).toBe(0);
    expect(moved.offsetYMm).toBe(222);
  });

  it('returns the same project for an unknown id', () => {
    expect(movingPickup(guitar, 'nope', 10)).toBe(guitar);
    expect(rotatingPickupToward(guitar, 'nope', { x: 0, y: 0 })).toBe(guitar);
  });

  it('snaps drag rotation to 5 degrees, clockwise from up', () => {
    const { project, id } = addingPickup(guitar, offeredPickupTypes('guitar')[0]);
    const pickup = project.pickups.find((p) => p.id === id)!;
    const right = { x: pickup.offsetXMm + 50, y: pickup.offsetYMm };
    expect(rotatingPickupToward(project, id, right).pickups.find((p) => p.id === id)!.angleDegrees).toBe(90);
    const nearlyUp = { x: pickup.offsetXMm + 2, y: pickup.offsetYMm - 50 };
    expect(rotatingPickupToward(project, id, nearlyUp).pickups.find((p) => p.id === id)!.angleDegrees).toBe(0);
  });

  it('leaves the project unchanged when the touch is on the pickup centre', () => {
    const { project, id } = addingPickup(guitar, offeredPickupTypes('guitar')[0]);
    const p = project.pickups.find((x) => x.id === id)!;
    expect(rotatingPickupToward(project, id, { x: p.offsetXMm, y: p.offsetYMm })).toBe(project);
  });

  it('resizes the routed shape along with the reported width', () => {
    const { project, id } = addingPickup(guitar, offeredPickupTypes('guitar')[0]);
    const before = project.pickups.find((p) => p.id === id)!;
    const after = settingPickupWidth(project, id, before.widthMm * 2).pickups.find((p) => p.id === id)!;
    const span = (anchors: typeof before.anchors) =>
      Math.max(...anchors!.map((a) => a.position.x)) - Math.min(...anchors!.map((a) => a.position.x));
    expect(span(after.anchors)).toBeCloseTo(span(before.anchors) * 2, 6);
  });

  it('reseeds dimensions when the type changes', () => {
    const types = offeredPickupTypes('guitar');
    const { project, id } = addingPickup(guitar, types[0]);
    const other = types.find((t) => t !== types[0]);
    if (!other) return;
    const retyped = settingPickupType(project, id, other).pickups.find((p) => p.id === id)!;
    expect(retyped.type).toBe(other);
  });

  it('removes only the named pickup', () => {
    const a = addingPickup(guitar, offeredPickupTypes('guitar')[0]);
    const b = addingPickup(a.project, offeredPickupTypes('guitar')[0]);
    const removed = removingPickup(b.project, a.id);
    expect(removed.pickups.some((p) => p.id === a.id)).toBe(false);
    expect(removed.pickups.some((p) => p.id === b.id)).toBe(true);
  });
});

describe('control editing', () => {
  const base = createProject();

  it('adds pots and switches and selects them', () => {
    const pot = addingPotentiometer(base);
    expect(pot.project.potentiometers).toHaveLength((base.potentiometers?.length ?? 0) + 1);
    expect(hardwarePlacementExists(pot.project, pot.selection)).toBe(true);

    const sw = addingSwitch(pot.project, 'toggle_3_way' as never);
    expect(sw.selection.kind).toBe('switch');
    expect(hardwarePlacementExists(sw.project, sw.selection)).toBe(true);
  });

  it('removes a placement, after which it no longer exists', () => {
    const { project, selection } = addingPotentiometer(base);
    const removed = removingHardwarePlacement(project, selection);
    expect(hardwarePlacementExists(removed, selection)).toBe(false);
  });

  it('treats a null selection as nonexistent', () => {
    expect(hardwarePlacementExists(base, null)).toBe(false);
  });

  it('rotates a switch toward a point, clockwise from up, snapped to 5 degrees', () => {
    const { project, selection } = addingSwitch(base, 'toggle_3_way' as never);
    const sw = project.switches!.find((s) => s.id === selection.id)!;
    const toward = { x: sw.position.x + 30, y: sw.position.y };
    const rotated = rotatingSwitchToward(project, sw.id, toward).switches!.find((s) => s.id === sw.id)!;
    expect(rotated.angleDegrees).toBe(90);
  });
});
