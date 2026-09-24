import type { PathAnchor, SymmetryConfig, Vector2D } from '../types/guitar';
import { distanceVector, findClosestSegment } from './bezier';

/** Anything closer to the centerline than this is treated as sitting on it, not off to one side. */
const CENTERLINE_EPSILON_MM = 1;

/**
 * How close a candidate's position has to be to a moved anchor's exact
 * mirrored position to be trusted as its geometric partner. Deliberately
 * tight - this only exists to auto-link anchors that are already
 * (near-)symmetric, e.g. from hand-placed template points or older saves.
 * Anything looser starts guessing, which is the bug this replaces.
 */
const MIRROR_MATCH_TOLERANCE_MM = 5;

/**
 * Apply live centerline symmetry to an anchor list: whichever anchor the
 * user just moved, mirror that change onto its paired anchor on the other
 * side of X=0.
 *
 * Pairing is resolved through `mirrorId`, not recomputed from scratch on
 * every call - re-deriving "the opposite node" from array index or role
 * alone breaks the moment anchors are added, removed, or simply don't
 * follow a symmetric ordering (which most hand-authored templates don't).
 * An anchor missing its `mirrorId` (older saves, template points that
 * predate this field) gets bootstrapped once, here, by role or by proximity
 * to its mirrored position - and if nothing matches closely enough, it's
 * left unpaired rather than guessed at.
 *
 * `draggedHandle` names the handle the gesture moved, when it was a handle
 * rather than the node. It only matters for an anchor on the centerline, which
 * has no partner: its own two handles are each other's mirror image, so the
 * one that was not touched is rewritten from the one that was.
 */
export function applyLiveSymmetry(
  anchors: PathAnchor[],
  movedAnchorId: string,
  symmetry: SymmetryConfig,
  draggedHandle?: 'in' | 'out'
): PathAnchor[] {
  if (symmetry.mode !== 'live_centerline') return anchors;

  const movedIndex = anchors.findIndex((a) => a.id === movedAnchorId);
  if (movedIndex === -1) return anchors;

  const source = anchors[movedIndex];

  // An anchor on the centerline has no partner - it mirrors itself, so just
  // constrain it there instead of looking for one.
  if (Math.abs(source.position.x) < CENTERLINE_EPSILON_MM) {
    let self = source;
    if (source.semanticRole === 'tail_center') {
      self = { ...self, position: { ...self.position, x: 0 } };
    }
    if (draggedHandle === 'out' && self.handleOut) {
      self = { ...self, handleIn: { x: -self.handleOut.x, y: self.handleOut.y } };
    } else if (draggedHandle === 'in' && self.handleIn) {
      self = { ...self, handleOut: { x: -self.handleIn.x, y: self.handleIn.y } };
    }
    if (self === source) return anchors;
    const updated = [...anchors];
    updated[movedIndex] = self;
    return updated;
  }

  const resolved = resolveMirrorPair(anchors, source);
  if (!resolved) return anchors; // unpaired, or a dangling link - move only this side
  const { working, partnerIndex } = resolved;

  const partner = working[partnerIndex];
  if (partner.locked) return working; // never let mirroring drag a locked node (e.g. the neck pocket)

  const mirroredPosition: Vector2D = { x: -source.position.x, y: source.position.y };
  const mirroredHandleIn: Vector2D | undefined = source.handleOut
    ? { x: -source.handleOut.x, y: source.handleOut.y }
    : undefined;
  const mirroredHandleOut: Vector2D | undefined = source.handleIn
    ? { x: -source.handleIn.x, y: source.handleIn.y }
    : undefined;

  const result = [...working];
  result[partnerIndex] = {
    ...partner,
    position: mirroredPosition,
    handleIn: mirroredHandleIn,
    handleOut: mirroredHandleOut,
    handleMode: source.handleMode,
  };
  return result;
}

/**
 * The segment that mirrors `segmentIndex` across the centerline, or null when
 * there is none to act on: an end without a partner, a locked partner, or a
 * segment that is its own mirror (it spans the centerline). Used to make a
 * segment edit - straighten / curve - land on both halves of the body.
 *
 * A centerline node is its own partner, so a segment running out of one
 * mirrors to the segment running out of it on the other side.
 */
export function mirroredSegmentIndex(
  anchors: PathAnchor[],
  segmentIndex: number,
  closed: boolean,
  symmetry: SymmetryConfig
): number | null {
  if (symmetry.mode !== 'live_centerline') return null;
  const count = anchors.length;
  if (segmentIndex < 0 || segmentIndex >= (closed ? count : count - 1)) return null;

  const partnerOf = (index: number): number | null => {
    const anchor = anchors[index];
    if (Math.abs(anchor.position.x) < CENTERLINE_EPSILON_MM) return index;
    const partnerId = anchor.mirrorId ?? findMirrorPartner(anchors, anchor)?.id;
    const partnerIndex = anchors.findIndex((a) => a.id === partnerId);
    if (partnerIndex === -1 || anchors[partnerIndex].locked) return null;
    return partnerIndex;
  };

  const startIndex = segmentIndex;
  const endIndex = (segmentIndex + 1) % count;
  const p = partnerOf(startIndex);
  const q = partnerOf(endIndex);
  if (p === null || q === null) return null;

  // The mirror runs the other way round the contour: it is the segment whose
  // ends are {p, q}, in either order.
  const mirrored = (from: number, to: number) => (closed || from + 1 < count) && (from + 1) % count === to ? from : null;
  const candidate = mirrored(q, p) ?? mirrored(p, q);
  return candidate === null || candidate === segmentIndex ? null : candidate;
}

/**
 * Resolve `source`'s partner, bootstrapping the `mirrorId` link on both
 * anchors the first time they are paired. Returns the (possibly relinked)
 * anchor list with the partner's index, or null when there is nothing close
 * enough to trust or the stored link is dangling - in both of those cases the
 * caller keeps the original list, since a bootstrap only ever happens when a
 * partner was in fact found.
 */
function resolveMirrorPair(
  anchors: PathAnchor[],
  source: PathAnchor
): { working: PathAnchor[]; partnerIndex: number } | null {
  let working = anchors;
  let mirrorId = source.mirrorId;

  if (!mirrorId) {
    const partner = findMirrorPartner(working, source);
    if (!partner) return null;
    mirrorId = partner.id;
    working = working.map((a) => {
      if (a.id === source.id) return { ...a, mirrorId: partner.id };
      if (a.id === partner.id) return { ...a, mirrorId: source.id };
      return a;
    });
  }

  const partnerIndex = working.findIndex((a) => a.id === mirrorId);
  return partnerIndex === -1 ? null : { working, partnerIndex };
}

/**
 * Mirror one anchor's bevel intensity onto its partner.
 *
 * Unlike a position there is no sign to flip - intensity is a scalar
 * multiplier on the edge width, so the partner takes the same number. Kept
 * separate from `applyLiveSymmetry` because the two are driven by different
 * gestures: that one runs on a drag, this one on the Node Inspector slider.
 */
export function withMirroredBevelIntensity(
  anchors: PathAnchor[],
  sourceId: string,
  symmetry: SymmetryConfig
): PathAnchor[] {
  if (symmetry.mode !== 'live_centerline') return anchors;

  const source = anchors.find((a) => a.id === sourceId);
  if (!source) return anchors;

  // A node on the centerline is its own mirror - there is no other side to
  // copy to, and the bevel there is shared by both halves anyway.
  if (Math.abs(source.position.x) < CENTERLINE_EPSILON_MM) return anchors;

  const resolved = resolveMirrorPair(anchors, source);
  if (!resolved) return anchors;
  const { working, partnerIndex } = resolved;

  const partner = working[partnerIndex];
  if (partner.locked) return working; // the neck pocket's bevel is fixed at 0 regardless

  const mirrored = { ...partner };
  // Absent means the 1.0 default, so clear the key rather than writing
  // `undefined` into a file that would otherwise not carry it at all.
  if (source.bevelIntensity === undefined) delete mirrored.bevelIntensity;
  else mirrored.bevelIntensity = source.bevelIntensity;

  const result = [...working];
  result[partnerIndex] = mirrored;
  return result;
}

/**
 * Find `source`'s mirror partner with no prior link: an explicit role match
 * first (authoritative even if the two aren't currently symmetric - that's
 * the point of dragging one side into line with the other), otherwise the
 * nearest anchor on the opposite side to source's exact mirrored position,
 * if one is within MIRROR_MATCH_TOLERANCE_MM.
 */
function findMirrorPartner(anchors: PathAnchor[], source: PathAnchor): PathAnchor | null {
  const partnerRole = getPartnerRole(source.semanticRole);
  if (partnerRole) {
    const byRole = anchors.find((a) => a.semanticRole === partnerRole);
    if (byRole) return byRole;
  }

  const mirroredPosition: Vector2D = { x: -source.position.x, y: source.position.y };
  let best: PathAnchor | null = null;
  let bestDist = Infinity;

  for (const candidate of anchors) {
    if (candidate.id === source.id) continue;
    if (candidate.mirrorId && candidate.mirrorId !== source.id) continue; // already spoken for
    if (Math.abs(candidate.position.x) < CENTERLINE_EPSILON_MM) continue; // centerline points don't pair
    if (Math.sign(candidate.position.x) === Math.sign(source.position.x)) continue; // must be the opposite side

    const dist = distanceVector(candidate.position, mirroredPosition);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best && bestDist <= MIRROR_MATCH_TOLERANCE_MM ? best : null;
}

function getPartnerRole(role?: string): string | undefined {
  if (!role) return undefined;
  if (role.endsWith('_left')) return role.replace('_left', '_right');
  if (role.endsWith('_right')) return role.replace('_right', '_left');
  return undefined;
}

/**
 * When live-centerline symmetry is on, creating a node should create its
 * mirror twin too - otherwise the pair only exists on one side until
 * someone drags it, which is what made new nodes feel broken. Finds the
 * nearest point on the opposite side of the contour to the new anchor's
 * mirrored position, splits the curve there, and links the two anchors via
 * `mirrorId` so subsequent drags on either one move both.
 *
 * No-op outside live-centerline mode, or for a centerline anchor (nothing
 * to mirror).
 */
export function withMirroredInsertion(
  anchors: PathAnchor[],
  newAnchorId: string,
  symmetry: SymmetryConfig,
  closed: boolean
): PathAnchor[] {
  if (symmetry.mode !== 'live_centerline') return anchors;

  const sourceIndex = anchors.findIndex((a) => a.id === newAnchorId);
  if (sourceIndex === -1) return anchors;
  const source = anchors[sourceIndex];
  if (Math.abs(source.position.x) < CENTERLINE_EPSILON_MM) return anchors;

  const mirroredPosition: Vector2D = { x: -source.position.x, y: source.position.y };
  const hit = findClosestSegment(anchors, closed, mirroredPosition);
  if (!hit) return anchors;

  const mirrorAnchor: PathAnchor = {
    id: `anchor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    position: mirroredPosition,
    handleIn: source.handleOut ? { x: -source.handleOut.x, y: source.handleOut.y } : undefined,
    handleOut: source.handleIn ? { x: -source.handleIn.x, y: source.handleIn.y } : undefined,
    handleMode: source.handleMode,
    semanticRole: 'custom',
    mirrorId: source.id,
  };

  const result = [...anchors];
  result[sourceIndex] = { ...source, mirrorId: mirrorAnchor.id };
  result.splice(hit.index + 1, 0, mirrorAnchor);
  return result;
}
