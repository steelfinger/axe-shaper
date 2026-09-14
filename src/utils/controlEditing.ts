import type {
  GuitarProject,
  PotentiometerPlacement,
  SelectedHardwarePlacement,
  SwitchPlacement,
  SwitchType,
  Vector2D,
} from '../types/guitar';

export const DEFAULT_POTENTIOMETER_BODY_DIAMETER_MM = 24;
export const DEFAULT_KNOB_STYLE_ID = 'generic';
export const SWITCH_TYPE_LABELS: Record<SwitchType, string> = {
  gibson_toggle: 'Gibson Toggle',
  fender_blade: 'Fender Blade',
};

function placementId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function bodyCentroid(project: GuitarProject): Vector2D {
  const anchors = project.contour.anchors;
  if (anchors.length === 0) return { x: 45, y: 250 };
  const sum = anchors.reduce(
    (total, anchor) => ({
      x: total.x + anchor.position.x,
      y: total.y + anchor.position.y,
    }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / anchors.length, y: sum.y / anchors.length };
}

/** Offset successive controls so adding several never produces an invisible stack. */
function nextControlPosition(project: GuitarProject): Vector2D {
  const center = bodyCentroid(project);
  const count = (project.potentiometers ?? []).length + (project.switches ?? []).length;
  return {
    x: center.x + 38 + (count % 3) * 18,
    y: center.y + 35 + Math.floor(count / 3) * 24,
  };
}

export function addingPotentiometer(
  project: GuitarProject
): { project: GuitarProject; selection: SelectedHardwarePlacement } {
  const id = placementId('pot');
  const potentiometer: PotentiometerPlacement = {
    id,
    position: nextControlPosition(project),
    bodyDiameterMm: DEFAULT_POTENTIOMETER_BODY_DIAMETER_MM,
    knobStyleId: DEFAULT_KNOB_STYLE_ID,
  };
  return {
    project: { ...project, potentiometers: [...(project.potentiometers ?? []), potentiometer] },
    selection: { kind: 'potentiometer', id },
  };
}

export function addingSwitch(
  project: GuitarProject,
  type: SwitchType
): { project: GuitarProject; selection: SelectedHardwarePlacement } {
  const id = placementId('switch');
  const selector: SwitchPlacement = {
    id,
    type,
    position: nextControlPosition(project),
    angleDegrees: 0,
  };
  return {
    project: { ...project, switches: [...(project.switches ?? []), selector] },
    selection: { kind: 'switch', id },
  };
}

export function movingPotentiometer(
  project: GuitarProject,
  id: string,
  position: Vector2D
): GuitarProject {
  return {
    ...project,
    potentiometers: (project.potentiometers ?? []).map((item) =>
      item.id === id ? { ...item, position } : item
    ),
  };
}

export function settingPotentiometerBodyDiameter(
  project: GuitarProject,
  id: string,
  bodyDiameterMm: number
): GuitarProject {
  return {
    ...project,
    potentiometers: (project.potentiometers ?? []).map((item) =>
      item.id === id ? { ...item, bodyDiameterMm } : item
    ),
  };
}

export function movingSwitch(project: GuitarProject, id: string, position: Vector2D): GuitarProject {
  return {
    ...project,
    switches: (project.switches ?? []).map((item) =>
      item.id === id ? { ...item, position } : item
    ),
  };
}

export function settingSwitchAngle(project: GuitarProject, id: string, angleDegrees: number): GuitarProject {
  return {
    ...project,
    switches: (project.switches ?? []).map((item) =>
      item.id === id ? { ...item, angleDegrees } : item
    ),
  };
}

/** Direct-manipulation rotation uses the same clockwise-from-up convention as pickups. */
export function rotatingSwitchToward(project: GuitarProject, id: string, point: Vector2D): GuitarProject {
  const selector = (project.switches ?? []).find((item) => item.id === id);
  if (!selector) return project;
  const dx = point.x - selector.position.x;
  const dy = point.y - selector.position.y;
  if (dx === 0 && dy === 0) return project;
  const rawDegrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return settingSwitchAngle(project, id, Math.round(rawDegrees / 5) * 5);
}

export function switchRotationHandlePosition(selector: SwitchPlacement): Vector2D {
  const radians = (selector.angleDegrees * Math.PI) / 180;
  const distance = 22;
  return {
    x: selector.position.x + Math.sin(radians) * distance,
    y: selector.position.y - Math.cos(radians) * distance,
  };
}

export function settingSwitchType(project: GuitarProject, id: string, type: SwitchType): GuitarProject {
  return {
    ...project,
    switches: (project.switches ?? []).map((item) =>
      item.id === id ? { ...item, type } : item
    ),
  };
}

export function removingHardwarePlacement(
  project: GuitarProject,
  selection: SelectedHardwarePlacement
): GuitarProject {
  switch (selection.kind) {
    case 'pickup':
      return { ...project, pickups: project.pickups.filter((item) => item.id !== selection.id) };
    case 'potentiometer':
      return {
        ...project,
        potentiometers: (project.potentiometers ?? []).filter((item) => item.id !== selection.id),
      };
    case 'switch':
      return { ...project, switches: (project.switches ?? []).filter((item) => item.id !== selection.id) };
  }
}

export function hardwarePlacementExists(
  project: GuitarProject,
  selection: SelectedHardwarePlacement | null
): boolean {
  if (!selection) return false;
  switch (selection.kind) {
    case 'pickup':
      return project.pickups.some((item) => item.id === selection.id);
    case 'potentiometer':
      return (project.potentiometers ?? []).some((item) => item.id === selection.id);
    case 'switch':
      return (project.switches ?? []).some((item) => item.id === selection.id);
  }
}
