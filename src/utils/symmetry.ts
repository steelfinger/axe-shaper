import type { PathAnchor, SymmetryConfig, Vector2D } from '../types/guitar';

/**
 * Apply live centerline symmetry to an anchor list.
 * For any anchor with semantic role ending in '_left' or with x < 0,
 * it updates or matches the corresponding '_right' anchor with mirrored X coordinates.
 */
export function applyLiveSymmetry(
  anchors: PathAnchor[],
  movedAnchorId: string,
  symmetry: SymmetryConfig
): PathAnchor[] {
  if (symmetry.mode !== 'live_centerline') return anchors;

  const movedIndex = anchors.findIndex((a) => a.id === movedAnchorId);
  if (movedIndex === -1) return anchors;

  const source = anchors[movedIndex];
  
  // If moving an anchor on the centerline (x == 0), constrain x to 0
  if (Math.abs(source.position.x) < 1 && source.semanticRole === 'tail_center') {
    const updated = [...anchors];
    updated[movedIndex] = {
      ...source,
      position: { ...source.position, x: 0 },
    };
    return updated;
  }

  // Find partner anchor by role or index mirror
  const partnerRole = getPartnerRole(source.semanticRole);
  let partnerIndex = -1;

  if (partnerRole) {
    partnerIndex = anchors.findIndex((a) => a.semanticRole === partnerRole);
  } else {
    // Fallback: match by index offset relative to closed path
    const n = anchors.length;
    partnerIndex = (n - movedIndex) % n;
  }

  if (partnerIndex === -1 || partnerIndex === movedIndex) return anchors;

  const partner = anchors[partnerIndex];

  // Mirror position: x -> -x, y -> y
  const mirroredPosition: Vector2D = {
    x: -source.position.x,
    y: source.position.y,
  };

  // Mirror handleIn: x -> -x, y -> y (and swap handleIn with partner's handleOut if needed)
  const mirroredHandleIn: Vector2D | undefined = source.handleOut
    ? { x: -source.handleOut.x, y: source.handleOut.y }
    : undefined;

  const mirroredHandleOut: Vector2D | undefined = source.handleIn
    ? { x: -source.handleIn.x, y: source.handleIn.y }
    : undefined;

  const updatedPartner: PathAnchor = {
    ...partner,
    position: mirroredPosition,
    handleIn: mirroredHandleIn,
    handleOut: mirroredHandleOut,
  };

  const result = [...anchors];
  result[partnerIndex] = updatedPartner;
  return result;
}

function getPartnerRole(role?: string): string | undefined {
  if (!role) return undefined;
  if (role.endsWith('_left')) return role.replace('_left', '_right');
  if (role.endsWith('_right')) return role.replace('_right', '_left');
  return undefined;
}
