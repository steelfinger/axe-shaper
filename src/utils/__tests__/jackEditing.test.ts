import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import { hardwarePlacementExists, removingHardwarePlacement } from '../controlEditing';
import {
  addingJack,
  isJackRotatable,
  jackExtentRadiusMm,
  jackNutVertices,
  jackPlateScrewCentres,
  movingJack,
  rotatingJackToward,
  settingJackAngle,
  settingJackStyle,
} from '../jackEditing';
import { requiredSchemaVersion } from '../../constants/schema';
import { withEmbeddedPresets } from '../presets';
import type { GuitarProject } from '../../types/guitar';

const withUnknownJack = (project: GuitarProject): GuitarProject => ({
  ...project,
  jacks: [{ id: 'u', position: { x: 1, y: 2 }, mountingStyle: 'side_mounted', angleDegrees: 7 }],
});

describe('jack editing', () => {
  it('adds a selected strat plate at angle 0 and stamps the document 8', () => {
    const { project, selection } = addingJack(createProject());
    expect(project.jacks).toHaveLength(1);
    expect(project.jacks![0]).toMatchObject({ mountingStyle: 'strat_plate', angleDegrees: 0 });
    expect(selection).toEqual({ kind: 'jack', id: project.jacks![0].id });
    expect(requiredSchemaVersion(project)).toBe(8);
  });

  it('removing the last jack puts the document back at 7 and drops the list on save', () => {
    const { project, selection } = addingJack(createProject());
    const removed = removingHardwarePlacement(project, selection);
    expect(hardwarePlacementExists(removed, selection)).toBe(false);
    expect(withEmbeddedPresets(removed).schemaVersion).toBe(7);
    expect('jacks' in withEmbeddedPresets(removed)).toBe(false);
  });

  it('moves a jack without touching the others', () => {
    const first = addingJack(createProject());
    const second = addingJack(first.project, 'direct');
    const moved = movingJack(second.project, first.selection.id, { x: 5, y: 6 });
    expect(moved.jacks![0].position).toEqual({ x: 5, y: 6 });
    expect(moved.jacks![1].position).toEqual(second.project.jacks![1].position);
  });

  it('keeps the angle through plate -> direct -> plate', () => {
    const { project, selection } = addingJack(createProject());
    let edited = settingJackAngle(project, selection.id, 35);
    edited = settingJackStyle(edited, selection.id, 'direct');
    expect(edited.jacks![0]).toMatchObject({ mountingStyle: 'direct', angleDegrees: 35 });
    edited = settingJackStyle(edited, selection.id, 'strat_plate');
    expect(edited.jacks![0]).toMatchObject({ mountingStyle: 'strat_plate', angleDegrees: 35 });
  });

  it('only a strat plate rotates', () => {
    const { project, selection } = addingJack(createProject(), 'direct');
    expect(isJackRotatable(project.jacks![0])).toBe(false);
    expect(settingJackAngle(project, selection.id, 40).jacks).toEqual(project.jacks);
    expect(rotatingJackToward(project, selection.id, { x: 100, y: 0 })).toBe(project);
  });

  it('rotates a plate toward a point, clockwise from up, snapped to 5 degrees', () => {
    const { project, selection } = addingJack(createProject());
    const at = project.jacks![0].position;
    expect(rotatingJackToward(project, selection.id, { x: at.x + 10, y: at.y }).jacks![0].angleDegrees).toBe(90);
    expect(rotatingJackToward(project, selection.id, { x: at.x, y: at.y - 10 }).jacks![0].angleDegrees).toBe(0);
    expect(rotatingJackToward(project, selection.id, { x: at.x + 10, y: at.y - 9 }).jacks![0].angleDegrees).toBe(50);
  });

  it('leaves an unknown style unrestyled and unrotated, but selectable and deletable', () => {
    const project = withUnknownJack(createProject());
    expect(settingJackStyle(project, 'u', 'direct').jacks![0]).toEqual(project.jacks![0]);
    expect(settingJackAngle(project, 'u', 90).jacks![0]).toEqual(project.jacks![0]);
    expect(hardwarePlacementExists(project, { kind: 'jack', id: 'u' })).toBe(true);
    expect(removingHardwarePlacement(project, { kind: 'jack', id: 'u' }).jacks).toEqual([]);
    expect(jackExtentRadiusMm(project.jacks![0])).toBe(7.5);
  });

  it('does not raise the stamp beyond 8 for an unknown style', () => {
    expect(requiredSchemaVersion(withUnknownJack(createProject()))).toBe(8);
  });
});

describe('jack drawing geometry', () => {
  it('draws a 13 mm across-flats hexagon', () => {
    const vertices = jackNutVertices();
    expect(vertices).toHaveLength(6);
    // Opposite vertices are 2R apart; across flats is R * sqrt(3).
    const circumdiameter = Math.hypot(vertices[0].x - vertices[3].x, vertices[0].y - vertices[3].y);
    expect((circumdiameter / 2) * Math.sqrt(3)).toBeCloseTo(13, 9);
  });

  it('puts plate screws 71 mm apart', () => {
    const [a, b] = jackPlateScrewCentres();
    expect(b.x - a.x).toBeCloseTo(71, 9);
  });

  it('sizes a plate by its diagonal', () => {
    const { project } = addingJack(createProject());
    expect(jackExtentRadiusMm(project.jacks![0])).toBeCloseTo(Math.hypot(80.5, 31.3) / 2, 9);
  });
});
