import type {
  GuitarProject,
  JackMountingStyleId,
  OutputJackPlacement,
  SelectedHardwarePlacement,
  Vector2D,
} from '../types/guitar';
import { JACK_DRAWING_GEOMETRY } from '../constants/planDrawingStyle';
import { nextControlPosition } from './controlEditing';

export type KnownJackStyle = 'strat_plate' | 'direct';

export const JACK_STYLE_LABELS: Record<KnownJackStyle, string> = {
  strat_plate: 'Strat plate',
  direct: 'Direct (washer + nut)',
};

export function isKnownJackStyle(style: JackMountingStyleId): style is KnownJackStyle {
  return style === 'strat_plate' || style === 'direct';
}

/**
 * Only a Strat plate has a meaningful rotation. An unknown style is not
 * rotatable either: the editor cannot know what the angle means for it.
 */
export function isJackRotatable(jack: OutputJackPlacement): boolean {
  return jack.mountingStyle === 'strat_plate';
}

/** Half the longest dimension of what is drawn, for page bounds and hit areas. */
export function jackExtentRadiusMm(jack: OutputJackPlacement): number {
  if (jack.mountingStyle !== 'strat_plate') return JACK_DRAWING_GEOMETRY.washerDiameterMm / 2;
  return Math.hypot(JACK_DRAWING_GEOMETRY.plateLengthMm, JACK_DRAWING_GEOMETRY.plateWidthMm) / 2;
}

/** Vertices of the 13 mm across-flats nut, centred on the origin, points on the X axis. */
export function jackNutVertices(): Vector2D[] {
  const circumradius = JACK_DRAWING_GEOMETRY.nutAcrossFlatsMm / Math.sqrt(3);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (index * Math.PI) / 3;
    return { x: Math.cos(angle) * circumradius, y: Math.sin(angle) * circumradius };
  });
}

/** The two screw centres of a plate, in the plate's own (unrotated) frame. */
export function jackPlateScrewCentres(): [Vector2D, Vector2D] {
  const half = JACK_DRAWING_GEOMETRY.plateScrewSpacingMm / 2;
  return [{ x: -half, y: 0 }, { x: half, y: 0 }];
}

function placementId(): string {
  return `jack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function addingJack(
  project: GuitarProject,
  mountingStyle: KnownJackStyle = 'strat_plate'
): { project: GuitarProject; selection: SelectedHardwarePlacement } {
  const id = placementId();
  const jack: OutputJackPlacement = {
    id,
    position: nextControlPosition(project),
    mountingStyle,
    angleDegrees: 0,
  };
  return {
    project: { ...project, jacks: [...(project.jacks ?? []), jack] },
    selection: { kind: 'jack', id },
  };
}

function mappingJack(
  project: GuitarProject,
  id: string,
  update: (jack: OutputJackPlacement) => OutputJackPlacement
): GuitarProject {
  return {
    ...project,
    jacks: (project.jacks ?? []).map((item) => (item.id === id ? update(item) : item)),
  };
}

export function movingJack(project: GuitarProject, id: string, position: Vector2D): GuitarProject {
  return mappingJack(project, id, (jack) => ({ ...jack, position }));
}

/**
 * Changes only `mountingStyle`. The angle is kept, so plate -> direct -> plate
 * restores the rotation. An unknown style is left alone.
 */
export function settingJackStyle(
  project: GuitarProject,
  id: string,
  mountingStyle: KnownJackStyle
): GuitarProject {
  return mappingJack(project, id, (jack) => (isKnownJackStyle(jack.mountingStyle) ? { ...jack, mountingStyle } : jack));
}

export function settingJackAngle(project: GuitarProject, id: string, angleDegrees: number): GuitarProject {
  return mappingJack(project, id, (jack) => (isJackRotatable(jack) ? { ...jack, angleDegrees } : jack));
}

/** Same clockwise-from-up convention, 5 degree snap, as pickups and switches. */
export function rotatingJackToward(project: GuitarProject, id: string, point: Vector2D): GuitarProject {
  const jack = (project.jacks ?? []).find((item) => item.id === id);
  if (!jack || !isJackRotatable(jack)) return project;
  const dx = point.x - jack.position.x;
  const dy = point.y - jack.position.y;
  if (dx === 0 && dy === 0) return project;
  const rawDegrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return settingJackAngle(project, id, Math.round(rawDegrees / 5) * 5);
}

export function jackRotationHandlePosition(jack: OutputJackPlacement): Vector2D {
  const radians = (jack.angleDegrees * Math.PI) / 180;
  // Just beyond the plate's short side, which faces "up" at angle 0.
  const distance = JACK_DRAWING_GEOMETRY.plateWidthMm / 2 + 10;
  return {
    x: jack.position.x + Math.sin(radians) * distance,
    y: jack.position.y - Math.cos(radians) * distance,
  };
}
