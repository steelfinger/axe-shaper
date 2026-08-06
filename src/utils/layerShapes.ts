import type { BodyContour, GuitarProject } from '../types/guitar';

/**
 * Which contour a canvas gesture or inspector edit currently targets. Default
 * is `.body` - every file today, and every session that never touches the
 * pickguard/routing-layer feature, resolves every helper below to exactly
 * what it did before this type existed.
 */
export type ActiveLayer =
  | { kind: 'body' }
  | { kind: 'pickguard'; id: string }
  | { kind: 'frontRoute'; id: string }
  | { kind: 'backRoute'; id: string };

export function activeLayersEqual(a: ActiveLayer, b: ActiveLayer): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'body' || b.kind === 'body') return true;
  return 'id' in a && 'id' in b && a.id === b.id;
}

/** The contour a gesture should read, or null if the active layer's shape no longer exists (e.g. deleted mid-edit). */
export function getActiveContour(project: GuitarProject, layer: ActiveLayer): BodyContour | null {
  switch (layer.kind) {
    case 'body':
      return project.contour;
    case 'pickguard':
      return (project.pickguards ?? []).find((p) => p.id === layer.id)?.contour ?? null;
    case 'frontRoute':
      return (project.frontRoutes ?? []).find((r) => r.id === layer.id)?.contour ?? null;
    case 'backRoute':
      return (project.backRoutes ?? []).find((r) => r.id === layer.id)?.contour ?? null;
  }
}

/** Writes a new contour back through whichever array the active layer names, leaving every other shape untouched. */
export function withActiveContour(project: GuitarProject, layer: ActiveLayer, contour: BodyContour): GuitarProject {
  switch (layer.kind) {
    case 'body':
      return { ...project, contour };
    case 'pickguard':
      return {
        ...project,
        pickguards: (project.pickguards ?? []).map((p) => (p.id === layer.id ? { ...p, contour } : p)),
      };
    case 'frontRoute':
      return {
        ...project,
        frontRoutes: (project.frontRoutes ?? []).map((r) => (r.id === layer.id ? { ...r, contour } : r)),
      };
    case 'backRoute':
      return {
        ...project,
        backRoutes: (project.backRoutes ?? []).map((r) => (r.id === layer.id ? { ...r, contour } : r)),
      };
  }
}

function generateShapeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateAnchorId(): string {
  return `anchor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** A small default rectangle, centered on the given point, for a freshly-added shape. */
function defaultRectContour(centerX: number, centerY: number, halfWidth = 40, halfHeight = 30): BodyContour {
  return {
    closed: true,
    anchors: [
      { id: generateAnchorId(), position: { x: centerX - halfWidth, y: centerY - halfHeight }, handleMode: 'corner' },
      { id: generateAnchorId(), position: { x: centerX + halfWidth, y: centerY - halfHeight }, handleMode: 'corner' },
      { id: generateAnchorId(), position: { x: centerX + halfWidth, y: centerY + halfHeight }, handleMode: 'corner' },
      { id: generateAnchorId(), position: { x: centerX - halfWidth, y: centerY + halfHeight }, handleMode: 'corner' },
    ],
  };
}

/** Centroid of the body's own anchors, so a newly-added shape lands somewhere sensible instead of at the origin. */
function bodyCentroid(project: GuitarProject): { x: number; y: number } {
  const anchors = project.contour.anchors;
  if (anchors.length === 0) return { x: 0, y: 150 };
  const sum = anchors.reduce(
    (acc, a) => ({ x: acc.x + a.position.x, y: acc.y + a.position.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / anchors.length, y: sum.y / anchors.length };
}

export function addingPickguard(project: GuitarProject): { project: GuitarProject; layer: ActiveLayer } {
  const center = bodyCentroid(project);
  const id = generateShapeId('pickguard');
  const project2: GuitarProject = {
    ...project,
    pickguards: [
      ...(project.pickguards ?? []),
      { id, contour: defaultRectContour(center.x, center.y), colorHex: '#ffffff', visible: true, locked: false },
    ],
  };
  return { project: project2, layer: { kind: 'pickguard', id } };
}

export function addingFrontRoute(project: GuitarProject): { project: GuitarProject; layer: ActiveLayer } {
  const center = bodyCentroid(project);
  const id = generateShapeId('route');
  const project2: GuitarProject = {
    ...project,
    frontRoutes: [
      ...(project.frontRoutes ?? []),
      { id, contour: defaultRectContour(center.x, center.y), visible: true, locked: false },
    ],
  };
  return { project: project2, layer: { kind: 'frontRoute', id } };
}

export function addingBackRoute(project: GuitarProject): { project: GuitarProject; layer: ActiveLayer } {
  const center = bodyCentroid(project);
  const id = generateShapeId('route');
  const project2: GuitarProject = {
    ...project,
    backRoutes: [
      ...(project.backRoutes ?? []),
      { id, contour: defaultRectContour(center.x, center.y), visible: true, locked: false },
    ],
  };
  return { project: project2, layer: { kind: 'backRoute', id } };
}

export function deletingLayerShape(
  project: GuitarProject,
  layer: Exclude<ActiveLayer, { kind: 'body' }>
): GuitarProject {
  switch (layer.kind) {
    case 'pickguard':
      return { ...project, pickguards: (project.pickguards ?? []).filter((p) => p.id !== layer.id) };
    case 'frontRoute':
      return { ...project, frontRoutes: (project.frontRoutes ?? []).filter((r) => r.id !== layer.id) };
    case 'backRoute':
      return { ...project, backRoutes: (project.backRoutes ?? []).filter((r) => r.id !== layer.id) };
  }
}

/** True once a layer's shape stops existing - the delete-out-from-under-you case the active layer needs to fall back from. */
export function layerShapeExists(project: GuitarProject, layer: ActiveLayer): boolean {
  return getActiveContour(project, layer) !== null;
}
