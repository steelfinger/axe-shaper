import type {
  BodyContour,
  InstrumentType,
  NeckJointGeometry,
  NeckJointPlanParameters,
  NeckPlacement,
  Vector2D,
} from '../types/guitar';
import { fingerboardReferenceFret } from './instrument';

/**
 * A deterministic polyline approximation of a joint outline. The format stores
 * numeric parameters, never these points; consumers regenerate them at their
 * own requested tolerance for SVG/DXF/canvas output.
 */
export interface NeckJointOutline {
  points: Vector2D[];
  closed: true;
}

export class NeckJointContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeckJointContractError';
  }
}

const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const finiteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function validateParameters(parameters: NeckJointPlanParameters, tapered: boolean): void {
  if (!finitePositive(parameters.mouthWidthMm)) throw new NeckJointContractError('Neck joint mouth width must be a positive finite number.');
  if (!finitePositive(parameters.planLengthMm)) throw new NeckJointContractError('Neck joint plan length must be a positive finite number.');
  if (!finiteNonNegative(parameters.endCornerRadiusMm)) throw new NeckJointContractError('Neck joint end-corner radius must be non-negative.');
  if (!finiteNonNegative(parameters.endRoundnessMm)) throw new NeckJointContractError('Neck joint end roundness must be non-negative.');
  if (parameters.endTreatment !== 'square' && parameters.endTreatment !== 'rounded') {
    throw new NeckJointContractError('Neck joint end treatment must be square or rounded.');
  }
  if (tapered && !finitePositive(parameters.deepEndWidthMm)) {
    throw new NeckJointContractError('A tapered mortise needs a positive deep-end width.');
  }
  if (!tapered && parameters.deepEndWidthMm !== undefined) {
    throw new NeckJointContractError('Only a tapered mortise may carry a deep-end width.');
  }
  const deepWidth = parameters.deepEndWidthMm ?? parameters.mouthWidthMm;
  const activeRadius = parameters.endTreatment === 'rounded'
    ? parameters.endRoundnessMm
    : parameters.endCornerRadiusMm;
  if (activeRadius > Math.min(deepWidth / 2, parameters.planLengthMm)) {
    throw new NeckJointContractError('Neck joint end roundness exceeds the available plan width or length.');
  }
}

/** Reject malformed v7 data before it reaches an editable project. */
export function validateNeckJointGeometry(geometry: NeckJointGeometry): void {
  if (geometry.mode !== 'locked' && geometry.mode !== 'custom') {
    throw new NeckJointContractError('Neck joint mode must be locked or custom.');
  }
  if (geometry.mechanism !== 'bolt_on' && geometry.mechanism !== 'glued') {
    throw new NeckJointContractError('Neck joint mechanism must be bolt-on or glued.');
  }
  if (!Array.isArray(geometry.mouthAnchorIds) || geometry.mouthAnchorIds.length !== 2
    || !geometry.mouthAnchorIds.every((id) => typeof id === 'string' && id.length > 0)
    || geometry.mouthAnchorIds[0] === geometry.mouthAnchorIds[1]) {
    throw new NeckJointContractError('Neck joint must identify two distinct mouth anchors.');
  }
  if (geometry.mode === 'locked' && (!geometry.profileId || !geometry.profileSnapshot)) {
    throw new NeckJointContractError('A locked neck joint must include its profile id and embedded profile snapshot.');
  }
  if (geometry.mode === 'locked' && geometry.profileSnapshot) {
    const snapshot = geometry.profileSnapshot;
    const sameParameters = snapshot.parameters.mouthWidthMm === geometry.parameters.mouthWidthMm
      && snapshot.parameters.planLengthMm === geometry.parameters.planLengthMm
      && snapshot.parameters.endCornerRadiusMm === geometry.parameters.endCornerRadiusMm
      && snapshot.parameters.endTreatment === geometry.parameters.endTreatment
      && snapshot.parameters.endRoundnessMm === geometry.parameters.endRoundnessMm
      && snapshot.parameters.deepEndWidthMm === geometry.parameters.deepEndWidthMm;
    if (snapshot.id !== geometry.profileId || snapshot.mechanism !== geometry.mechanism
      || snapshot.planShape !== geometry.planShape || !sameParameters) {
      throw new NeckJointContractError('A locked neck joint must match its immutable embedded profile snapshot.');
    }
  }
  if (geometry.mode === 'custom' && (!geometry.derivedFromProfileId || geometry.profileSnapshot)) {
    throw new NeckJointContractError('A custom neck joint must record its source profile without carrying a locked snapshot.');
  }
  const tapered = geometry.planShape === 'tapered_mortise';
  if (geometry.planShape === 'bolt_on_pocket' && geometry.mechanism !== 'bolt_on') {
    throw new NeckJointContractError('bolt_on_pocket geometry requires a bolt-on neck mechanism.');
  }
  if ((geometry.planShape === 'straight_mortise' || tapered) && geometry.mechanism !== 'glued') {
    throw new NeckJointContractError('Mortise geometry requires a glued neck mechanism.');
  }
  if (!['bolt_on_pocket', 'straight_mortise', 'tapered_mortise'].includes(geometry.planShape)) {
    throw new NeckJointContractError('Neck joint plan shape is not supported by this version.');
  }
  validateParameters(geometry.parameters, tapered);
  for (const [label, value] of [
    ['target heel width', geometry.targetHeelWidthMm],
    ['fitting clearance', geometry.fittingClearanceMm],
    ['cutter diameter', geometry.cutterDiameterMm],
  ] as const) {
    if (value !== undefined && !finiteNonNegative(value)) {
      throw new NeckJointContractError(`Neck joint ${label} must be non-negative when present.`);
    }
  }
  if (geometry.neckAngleDegrees !== undefined) {
    if (geometry.mechanism !== 'glued' || !Number.isFinite(geometry.neckAngleDegrees)) {
      throw new NeckJointContractError('A finite neck angle is allowed only for a glued joint.');
    }
  }
}

/** Validate the paired v7 root objects and their instrument-specific reference fret. */
export function validateNeckJointContract(
  geometry: NeckJointGeometry | undefined,
  placement: NeckPlacement | undefined,
  instrumentType: InstrumentType
): void {
  if (!geometry || !placement) {
    throw new NeckJointContractError('Schema 7 requires both neckJointGeometry and neckPlacement.');
  }
  validateNeckJointGeometry(geometry);
  if (placement.mode !== 'blueprint' && placement.mode !== 'custom') {
    throw new NeckJointContractError('Neck placement mode must be blueprint or custom.');
  }
  if (placement.referenceFret !== fingerboardReferenceFret(instrumentType)) {
    throw new NeckJointContractError(`Neck placement reference fret must be ${fingerboardReferenceFret(instrumentType)} for this instrument.`);
  }
  if (!Number.isFinite(placement.jointToReferenceFretMm)) {
    throw new NeckJointContractError('Neck placement must contain a finite joint-to-reference-fret distance.');
  }
  if (typeof placement.provenance !== 'string' || placement.provenance.trim().length === 0) {
    throw new NeckJointContractError('Neck placement must record its provenance.');
  }
}

/**
 * Attachment is separate from the numeric shape: a valid profile must bind to
 * the two explicitly mapped body anchors, at the exact Y=0 mouth. We never
 * infer a shoulder from proximity because that would make a fabricated
 * manufacturing decision on bodies with different contour treatment.
 */
export function validateNeckJointAttachment(geometry: NeckJointGeometry, contour: BodyContour): void {
  const [leftId, rightId] = geometry.mouthAnchorIds;
  const left = contour.anchors.find((anchor) => anchor.id === leftId);
  const right = contour.anchors.find((anchor) => anchor.id === rightId);
  if (!left || !right) throw new NeckJointContractError('Neck joint mouth-anchor ids do not exist on this body.');
  if (left.semanticRole !== 'neck_pocket_left' || right.semanticRole !== 'neck_pocket_right') {
    throw new NeckJointContractError('Neck joint mouth anchors must use the explicit left/right neck-pocket roles.');
  }
  const epsilon = 0.000001;
  const halfWidth = geometry.parameters.mouthWidthMm / 2;
  if (!left.locked || !right.locked
    || Math.abs(left.position.y) > epsilon || Math.abs(right.position.y) > epsilon
    || Math.abs(left.position.x + halfWidth) > epsilon || Math.abs(right.position.x - halfWidth) > epsilon) {
    throw new NeckJointContractError('Neck joint mouth anchors must be locked at Y=0 and match the authored symmetric width.');
  }
}

function appendArc(points: Vector2D[], center: Vector2D, radius: number, from: number, to: number, toleranceMm: number): void {
  if (radius === 0) {
    points.push({ x: center.x + Math.cos(to) * radius, y: center.y + Math.sin(to) * radius });
    return;
  }
  const boundedTolerance = Math.max(0.000001, toleranceMm);
  const stepAngle = 2 * Math.acos(Math.max(-1, 1 - boundedTolerance / radius));
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / stepAngle));
  for (let step = 1; step <= steps; step += 1) {
    const angle = from + ((to - from) * step) / steps;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
}

/**
 * Generate the closed outline in model coordinates: Y=0 is the mouth, and
 * positive Y goes into the body. Side walls remain mathematically straight.
 * The first point is always the left mouth point and the final closing edge is
 * implicit, matching DXF closed-polyline semantics.
 */
export function generateNeckJointOutline(geometry: NeckJointGeometry, toleranceMm = 0.01): NeckJointOutline {
  validateNeckJointGeometry(geometry);
  const { mouthWidthMm, planLengthMm, endCornerRadiusMm, endTreatment, endRoundnessMm } = geometry.parameters;
  const deepWidthMm = geometry.parameters.deepEndWidthMm ?? mouthWidthMm;
  const halfMouth = mouthWidthMm / 2;
  const halfDeep = deepWidthMm / 2;
  const radius = endTreatment === 'rounded' ? endRoundnessMm : endCornerRadiusMm;
  const points: Vector2D[] = [{ x: -halfMouth, y: 0 }, { x: halfMouth, y: 0 }];

  // The initial v7 shapes are symmetric. A tapered mortise uses straight
  // flanks down to the deep-end treatment; a rounded end carries a straight
  // centre section when its radius is smaller than half the deep-end width.
  points.push({ x: halfDeep, y: planLengthMm - radius });
  if (radius > 0) {
    appendArc(points, { x: halfDeep - radius, y: planLengthMm - radius }, radius, 0, Math.PI / 2, toleranceMm);
    points.push({ x: -halfDeep + radius, y: planLengthMm });
    appendArc(points, { x: -halfDeep + radius, y: planLengthMm - radius }, radius, Math.PI / 2, Math.PI, toleranceMm);
  } else {
    points.push({ x: halfDeep, y: planLengthMm }, { x: -halfDeep, y: planLengthMm });
  }
  points.push({ x: -halfDeep, y: planLengthMm - radius });

  return {
    points: points.filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y),
    closed: true,
  };
}

/** Serialize a generated outline for SVG without introducing editable path data. */
export function neckJointOutlineToSVGPath(outline: NeckJointOutline): string {
  return `${outline.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(6)} ${point.y.toFixed(6)}`).join(' ')} Z`;
}

/** The v7 placement datum is converted to the legacy bridge-math input here. */
export function nutToBodyEdgeFromPlacement(placement: NeckPlacement, scaleLengthMm: number): number {
  if (!Number.isFinite(scaleLengthMm) || scaleLengthMm <= 0) {
    throw new NeckJointContractError('Scale length must be a positive finite number.');
  }
  return scaleLengthMm * (1 - Math.pow(2, -placement.referenceFret / 12)) - placement.jointToReferenceFretMm;
}
