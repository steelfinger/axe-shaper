import type {
  BodyContour,
  InstrumentType,
  NeckJointGeometry,
  NeckJointPlanParameters,
  NeckPlacement,
  NeckPreset,
  Vector2D,
} from '../types/guitar';
import { fingerboardReferenceFret } from './instrument';
import { evaluateCubicBezier } from './bezier';

/**
 * A deterministic polyline approximation of a joint outline. The format stores
 * numeric parameters, never these points; consumers regenerate them at their
 * own requested tolerance for SVG/DXF/canvas output.
 */
export interface NeckJointOutline {
  points: Vector2D[];
  closed: true;
}

/**
 * Phase-0 geometry spike for the documented 1962 S-style pocket. It is
 * intentionally not a v7 `planShape` yet: the persisted contract must wait
 * for iOS and viewer parity. The pocket mouth is open/body-owned; this shape
 * starts at its two locked mouth anchors and models only the fitting walls and
 * compound deep end.
 */
export interface CompoundBoltOnPocketPrototypeParameters {
  mouthWidthMm: number;
  deepEndWidthMm: number;
  planLengthMm: number;
  deepEndCornerRadiusMm: number;
  deepEndArcRadiusMm: number;
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
  if (!['square', 'rounded', 'compound'].includes(parameters.endTreatment)) {
    throw new NeckJointContractError('Neck joint end treatment must be square, rounded, or compound.');
  }
  if (tapered && !finitePositive(parameters.deepEndWidthMm)) {
    throw new NeckJointContractError('A tapered mortise needs a positive deep-end width.');
  }
  if (!tapered && parameters.deepEndWidthMm !== undefined && !finitePositive(parameters.deepEndWidthMm)) {
    throw new NeckJointContractError('A supplied deep-end width must be positive.');
  }
  const deepWidth = parameters.deepEndWidthMm ?? parameters.mouthWidthMm;
  if (parameters.endTreatment === 'compound') {
    if (parameters.endCornerRadiusMm <= 0
      || parameters.endRoundnessMm <= parameters.endCornerRadiusMm) {
      throw new NeckJointContractError('A compound deep end needs positive corner fillets and a larger closing arc.');
    }
    return;
  }
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
  if (geometry.parameters.endTreatment === 'compound' && geometry.planShape !== 'bolt_on_pocket') {
    throw new NeckJointContractError('A compound deep end is supported only for bolt-on pockets.');
  }
  validateParameters(geometry.parameters, tapered);
  if (!tapered && geometry.planShape !== 'bolt_on_pocket'
    && geometry.parameters.deepEndWidthMm !== undefined) {
    throw new NeckJointContractError('Only tapered mortises and bolt-on pockets may specify a deep-end width.');
  }
  if (geometry.planShape === 'bolt_on_pocket'
    && geometry.parameters.deepEndWidthMm !== undefined
    && geometry.parameters.deepEndWidthMm < geometry.parameters.mouthWidthMm) {
    throw new NeckJointContractError('A bolt-on deep-end width must not be narrower than its mouth.');
  }
  if (geometry.targetHeelWidthMm !== undefined && !finitePositive(geometry.targetHeelWidthMm)) {
    throw new NeckJointContractError('Neck joint target heel width must be positive when present.');
  }
  if (geometry.targetHeelWidthMm === undefined && geometry.fittingClearanceMm !== undefined) {
    throw new NeckJointContractError('Neck joint fitting clearance requires a target heel width.');
  }
  for (const [label, value] of [
    ['fitting clearance', geometry.fittingClearanceMm],
    ['cutter diameter', geometry.cutterDiameterMm],
  ] as const) {
    if (value !== undefined && !finiteNonNegative(value)) {
      throw new NeckJointContractError(`Neck joint ${label} must be non-negative when present.`);
    }
  }
  if (geometry.targetHeelWidthMm !== undefined) {
    const deepWidth = geometry.parameters.deepEndWidthMm ?? geometry.parameters.mouthWidthMm;
    const requiredWidth = requiredPocketWidthForHeelFit(geometry);
    if (requiredWidth !== undefined && deepWidth < requiredWidth) {
      throw new NeckJointContractError('Neck joint deep-end width must fit the measured heel plus twice the per-side clearance.');
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

const CLEARANCE_SAMPLE_SPACING_MM = 0.25;
const CLEARANCE_BOUNDARY_EPSILON_MM = 0.1;

function absoluteHandle(anchor: BodyContour['anchors'][number], side: 'in' | 'out'): Vector2D {
  const handle = side === 'in' ? anchor.handleIn : anchor.handleOut;
  return handle
    ? { x: anchor.position.x + handle.x, y: anchor.position.y + handle.y }
    : anchor.position;
}

/** Flatten the editable body path tightly enough for a routing-clearance decision. */
function bodyContourPolygon(contour: BodyContour): Vector2D[] {
  if (!contour.closed || contour.anchors.length < 3) {
    throw new NeckJointContractError('Neck joint clearance needs a closed body contour with at least three anchors.');
  }
  const polygon: Vector2D[] = [];
  for (let index = 0; index < contour.anchors.length; index += 1) {
    const start = contour.anchors[index];
    const end = contour.anchors[(index + 1) % contour.anchors.length];
    const p0 = start.position;
    const p1 = absoluteHandle(start, 'out');
    const p2 = absoluteHandle(end, 'in');
    const p3 = end.position;
    const controlLength = Math.hypot(p1.x - p0.x, p1.y - p0.y)
      + Math.hypot(p2.x - p1.x, p2.y - p1.y)
      + Math.hypot(p3.x - p2.x, p3.y - p2.y);
    // Normal body segments use the requested 0.25mm spacing. The ceiling only
    // protects the editor from a hand-authored million-millimetre handle.
    const steps = Math.max(1, Math.min(4096, Math.ceil(controlLength / CLEARANCE_SAMPLE_SPACING_MM)));
    if (index === 0) polygon.push(p0);
    for (let step = 1; step <= steps; step += 1) {
      polygon.push(evaluateCubicBezier(p0, p1, p2, p3, step / steps));
    }
  }
  return polygon;
}

function pointOnSegment(point: Vector2D, start: Vector2D, end: Vector2D): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y) <= CLEARANCE_BOUNDARY_EPSILON_MM;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy)) <= CLEARANCE_BOUNDARY_EPSILON_MM;
}

function pointInOrOnPolygon(point: Vector2D, polygon: Vector2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const crossesRay = (currentPoint.y > point.y) !== (previousPoint.y > point.y);
    if (crossesRay) {
      const intersectionX = (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)
        / (previousPoint.y - currentPoint.y) + currentPoint.x;
      if (point.x < intersectionX) inside = !inside;
    }
  }
  return inside;
}

/**
 * Reject a custom rout that leaves the body. The mouth's closing edge is not
 * sampled: it is the open, body-owned perimeter edge, whose two endpoints and
 * width are already checked by `validateNeckJointAttachment`.
 */
export function validateNeckJointWithinBody(geometry: NeckJointGeometry, contour: BodyContour): void {
  const body = bodyContourPolygon(contour);
  const outline = generateNeckJointOutline(geometry, 0.025).points;
  for (let index = 0; index < outline.length - 1; index += 1) {
    const start = outline[index];
    const end = outline[index + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / CLEARANCE_SAMPLE_SPACING_MM));
    for (let step = 0; step <= steps; step += 1) {
      const point = {
        x: start.x + ((end.x - start.x) * step) / steps,
        y: start.y + ((end.y - start.y) * step) / steps,
      };
      if (!pointInOrOnPolygon(point, body)) {
        throw new NeckJointContractError('Neck joint outline leaves the body; reduce its width, length, taper or end radius.');
      }
    }
  }
}

/** Cutter compatibility is advisory: a valid drawing may still need a smaller bit or hand cleanup. */
export function neckJointCutterWarnings(geometry: NeckJointGeometry): string[] {
  if (!geometry.cutterDiameterMm) return [];
  const activeRadius = geometry.parameters.endTreatment === 'rounded'
    ? geometry.parameters.endRoundnessMm
    : geometry.parameters.endCornerRadiusMm;
  if (activeRadius < geometry.cutterDiameterMm / 2) {
    return [`A ${geometry.cutterDiameterMm.toFixed(3)} mm cutter cannot route the ${activeRadius.toFixed(3)} mm internal end radius without cleanup.`];
  }
  return [];
}

/**
 * A fit target is measured at the deep end of the heel. Clearance is stored
 * per side, so it contributes twice to the required pocket width.
 */
export function requiredPocketWidthForHeelFit(geometry: Pick<NeckJointGeometry,
  'targetHeelWidthMm' | 'fittingClearanceMm'
>): number | undefined {
  if (geometry.targetHeelWidthMm === undefined) return undefined;
  return geometry.targetHeelWidthMm + 2 * (geometry.fittingClearanceMm ?? 0);
}

export interface CustomNeckJointUpdate {
  parameters?: Partial<NeckJointPlanParameters>;
  /** `null` removes the optional measured heel and its side-clearance target. */
  targetHeelWidthMm?: number | null;
  /** Stored per side; required pocket width adds this value twice. */
  fittingClearanceMm?: number | null;
  /** `null` explicitly removes the optional cutter declaration. */
  cutterDiameterMm?: number | null;
  /** `null` explicitly removes an optional glued-joint construction angle. */
  neckAngleDegrees?: number | null;
}

/**
 * The only mutation path for a custom v7 joint. It preserves the body-owned,
 * locked mouth attachment when width changes and verifies the generated rout
 * remains wholly inside the body before returning an editable candidate.
 */
export function updateCustomNeckJoint(
  geometry: NeckJointGeometry,
  contour: BodyContour,
  update: CustomNeckJointUpdate,
): { geometry: NeckJointGeometry; contour: BodyContour } {
  if (geometry.mode !== 'custom') {
    throw new NeckJointContractError('Convert a locked neck joint to Custom before changing its dimensions.');
  }
  validateNeckJointGeometry(geometry);
  validateNeckJointAttachment(geometry, contour);
  const updatedGeometry: NeckJointGeometry = {
    ...geometry,
    parameters: { ...geometry.parameters, ...update.parameters },
    ...(Object.prototype.hasOwnProperty.call(update, 'cutterDiameterMm')
      ? { cutterDiameterMm: update.cutterDiameterMm ?? undefined }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'targetHeelWidthMm')
      ? { targetHeelWidthMm: update.targetHeelWidthMm ?? undefined }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'fittingClearanceMm')
      ? { fittingClearanceMm: update.fittingClearanceMm ?? undefined }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'neckAngleDegrees')
      ? { neckAngleDegrees: update.neckAngleDegrees ?? undefined }
      : {}),
  };
  const [leftId, rightId] = geometry.mouthAnchorIds;
  const mouthWidthMm = updatedGeometry.parameters.mouthWidthMm;
  const updatedContour: BodyContour = {
    ...contour,
    anchors: contour.anchors.map((anchor) => {
      if (anchor.id === leftId) return { ...anchor, position: { ...anchor.position, x: -mouthWidthMm / 2 } };
      if (anchor.id === rightId) return { ...anchor, position: { ...anchor.position, x: mouthWidthMm / 2 } };
      return anchor;
    }),
  };
  validateNeckJointGeometry(updatedGeometry);
  validateNeckJointAttachment(updatedGeometry, updatedContour);
  validateNeckJointWithinBody(updatedGeometry, updatedContour);
  return { geometry: updatedGeometry, contour: updatedContour };
}

/**
 * Release-B's numeric mouth-width operation, extracted for the Phase-0
 * attachment spike. Anchor handles are offsets, so their values stay fixed:
 * moving an anchor translates its absolute Bézier control point by the same
 * delta. A locked profile is immutable; callers must explicitly convert it to
 * a custom joint before invoking this operation.
 */
export function setCustomNeckJointMouthWidth(
  geometry: NeckJointGeometry,
  contour: BodyContour,
  mouthWidthMm: number,
): { geometry: NeckJointGeometry; contour: BodyContour } {
  return updateCustomNeckJoint(geometry, contour, { parameters: { mouthWidthMm } });
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
 * Produce the tangent-continuous compound deep end used by the documented
 * vintage S-style drawing. The nominal deep width is the intersection of the
 * straight side-wall extensions at `planLengthMm`; the actual walls terminate
 * earlier in two equal fillets that join the large closing arc. That lets the
 * source retain its measured taper, 1/4 in deep corners, and 5 in heel arc
 * without treating the open mouth's body-template fillets as joint data.
 */
export function generateCompoundBoltOnPocketPrototypeOutline(
  parameters: CompoundBoltOnPocketPrototypeParameters,
  toleranceMm = 0.01,
): NeckJointOutline {
  const {
    mouthWidthMm,
    deepEndWidthMm,
    planLengthMm,
    deepEndCornerRadiusMm,
    deepEndArcRadiusMm,
  } = parameters;
  for (const [label, value] of [
    ['mouth width', mouthWidthMm],
    ['deep-end width', deepEndWidthMm],
    ['plan length', planLengthMm],
    ['deep-end corner radius', deepEndCornerRadiusMm],
    ['deep-end arc radius', deepEndArcRadiusMm],
  ] as const) {
    if (!finitePositive(value)) throw new NeckJointContractError(`Compound bolt-on ${label} must be a positive finite number.`);
  }
  if (deepEndWidthMm < mouthWidthMm) {
    throw new NeckJointContractError('A compound bolt-on pocket must not narrow toward its deep end.');
  }
  if (deepEndArcRadiusMm <= deepEndCornerRadiusMm) {
    throw new NeckJointContractError('A compound bolt-on closing arc must be larger than its deep-end corner radius.');
  }

  // A side is defined by the two nominal width stations. `inwardNormal`
  // points from the right wall into the pocket and offsets the small corner
  // fillet centre from that wall.
  const sideAngle = Math.atan2((deepEndWidthMm - mouthWidthMm) / 2, planLengthMm);
  const sideDirection = { x: Math.sin(sideAngle), y: Math.cos(sideAngle) };
  const inwardNormal = { x: -sideDirection.y, y: sideDirection.x };
  const rightMouth = { x: mouthWidthMm / 2, y: 0 };
  const closingCenter = { x: 0, y: planLengthMm - deepEndArcRadiusMm };
  const offsetLineStart = {
    x: rightMouth.x + deepEndCornerRadiusMm * inwardNormal.x,
    y: rightMouth.y + deepEndCornerRadiusMm * inwardNormal.y,
  };
  const toClosingCenter = {
    x: offsetLineStart.x - closingCenter.x,
    y: offsetLineStart.y - closingCenter.y,
  };
  const tangentCentreDistance = deepEndArcRadiusMm - deepEndCornerRadiusMm;
  const b = 2 * (toClosingCenter.x * sideDirection.x + toClosingCenter.y * sideDirection.y);
  const c = toClosingCenter.x ** 2 + toClosingCenter.y ** 2 - tangentCentreDistance ** 2;
  const discriminant = b ** 2 - 4 * c;
  if (discriminant < 0) {
    throw new NeckJointContractError('Compound bolt-on radii cannot form tangent deep-end geometry.');
  }
  const roots = [(-b - Math.sqrt(discriminant)) / 2, (-b + Math.sqrt(discriminant)) / 2]
    .filter((distance) => distance > 0);
  const sideDistance = Math.min(...roots);
  if (!Number.isFinite(sideDistance)) {
    throw new NeckJointContractError('Compound bolt-on geometry has no forward tangent point.');
  }
  const rightFilletCenter = {
    x: offsetLineStart.x + sideDistance * sideDirection.x,
    y: offsetLineStart.y + sideDistance * sideDirection.y,
  };
  const rightSideEnd = {
    x: rightFilletCenter.x - deepEndCornerRadiusMm * inwardNormal.x,
    y: rightFilletCenter.y - deepEndCornerRadiusMm * inwardNormal.y,
  };
  if (rightSideEnd.y > planLengthMm + 0.000001) {
    throw new NeckJointContractError('Compound bolt-on fillet begins beyond its plan length.');
  }
  const vectorToFillet = {
    x: rightFilletCenter.x - closingCenter.x,
    y: rightFilletCenter.y - closingCenter.y,
  };
  const distanceToFillet = Math.hypot(vectorToFillet.x, vectorToFillet.y);
  const rightArcStart = {
    x: closingCenter.x + deepEndArcRadiusMm * vectorToFillet.x / distanceToFillet,
    y: closingCenter.y + deepEndArcRadiusMm * vectorToFillet.y / distanceToFillet,
  };
  const rightFilletStartAngle = Math.atan2(
    rightSideEnd.y - rightFilletCenter.y,
    rightSideEnd.x - rightFilletCenter.x,
  );
  const rightFilletEndAngle = Math.atan2(
    rightArcStart.y - rightFilletCenter.y,
    rightArcStart.x - rightFilletCenter.x,
  );
  const rightClosingAngle = Math.atan2(
    rightArcStart.y - closingCenter.y,
    rightArcStart.x - closingCenter.x,
  );
  if (rightFilletEndAngle <= rightFilletStartAngle || rightClosingAngle >= Math.PI / 2) {
    throw new NeckJointContractError('Compound bolt-on tangent order is invalid.');
  }

  const leftMouth = { x: -rightMouth.x, y: 0 };
  const leftArcStart = { x: -rightArcStart.x, y: rightArcStart.y };
  const leftFilletCenter = { x: -rightFilletCenter.x, y: rightFilletCenter.y };
  const leftSideEnd = { x: -rightSideEnd.x, y: rightSideEnd.y };
  const leftFilletStartAngle = Math.atan2(
    leftArcStart.y - leftFilletCenter.y,
    leftArcStart.x - leftFilletCenter.x,
  );
  const leftFilletEndAngle = Math.atan2(
    leftSideEnd.y - leftFilletCenter.y,
    leftSideEnd.x - leftFilletCenter.x,
  );
  const points: Vector2D[] = [leftMouth, rightMouth, rightSideEnd];
  appendArc(points, rightFilletCenter, deepEndCornerRadiusMm, rightFilletStartAngle, rightFilletEndAngle, toleranceMm);
  appendArc(points, closingCenter, deepEndArcRadiusMm, rightClosingAngle, Math.PI / 2, toleranceMm);
  appendArc(points, closingCenter, deepEndArcRadiusMm, Math.PI / 2, Math.PI - rightClosingAngle, toleranceMm);
  appendArc(points, leftFilletCenter, deepEndCornerRadiusMm, leftFilletStartAngle, leftFilletEndAngle, toleranceMm);

  return { points, closed: true };
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
  if (endTreatment === 'compound') {
    return generateCompoundBoltOnPocketPrototypeOutline({
      mouthWidthMm,
      deepEndWidthMm: geometry.parameters.deepEndWidthMm ?? mouthWidthMm,
      planLengthMm,
      deepEndCornerRadiusMm: endCornerRadiusMm,
      deepEndArcRadiusMm: endRoundnessMm,
    }, toleranceMm);
  }
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

/**
 * Make the body-owned scale datum an explicit local choice. The generated
 * neck-joint outline is deliberately not involved: changing registration
 * moves the neck and scale-linked bridge, never the pocket or pickups.
 */
export function updateCustomNeckPlacement(
  placement: NeckPlacement,
  instrumentType: InstrumentType,
  scaleLengthMm: number,
  jointToReferenceFretMm: number,
): NeckPlacement {
  if (!finiteNonNegative(jointToReferenceFretMm)) {
    throw new NeckJointContractError('Joint-to-reference-fret distance must be a finite non-negative number.');
  }
  if (placement.referenceFret !== fingerboardReferenceFret(instrumentType)) {
    throw new NeckJointContractError(`Neck placement reference fret must be ${fingerboardReferenceFret(instrumentType)} for this instrument.`);
  }
  const candidate: NeckPlacement = {
    ...placement,
    mode: 'custom',
    jointToReferenceFretMm,
    provenance: 'user:joint-to-reference-fret',
  };
  if (!(nutToBodyEdgeFromPlacement(candidate, scaleLengthMm) > 0)) {
    throw new NeckJointContractError('Neck placement must keep the nut before the body joint line.');
  }
  return candidate;
}

/**
 * Derive the two bolt-on width stations from a neck with straight, linearly
 * tapered sides. The result is snapshot-ready v7 geometry: callers persist
 * the two widths in `parameters`, so a later catalogue correction cannot
 * silently change an existing design.
 */
export function deriveBoltOnPocketWidthsFromNeckTaper(
  neck: Pick<NeckPreset, 'scaleLengthMm' | 'neckTaper'>,
  placement: NeckPlacement,
  planLengthMm: number,
): Pick<NeckJointPlanParameters, 'mouthWidthMm' | 'deepEndWidthMm'> {
  const taper = neck.neckTaper;
  if (!taper
    || !finitePositive(taper.nutWidthMm)
    || !finitePositive(taper.heelWidthMm)
    || !finitePositive(taper.nutToHeelMm)
    || taper.heelWidthMm < taper.nutWidthMm) {
    throw new NeckJointContractError('A linear bolt-on taper needs finite nut width, heel width, and nut-to-heel run.');
  }
  if (!finitePositive(planLengthMm)) {
    throw new NeckJointContractError('Bolt-on plan length must be positive and finite.');
  }
  const mouthStationMm = nutToBodyEdgeFromPlacement(placement, neck.scaleLengthMm);
  const deepStationMm = mouthStationMm + planLengthMm;
  if (mouthStationMm < 0 || deepStationMm > taper.nutToHeelMm) {
    throw new NeckJointContractError('The bolt-on pocket lies outside the selected neck taper run.');
  }
  const widthAt = (stationMm: number) => taper.nutWidthMm
    + ((taper.heelWidthMm - taper.nutWidthMm) * stationMm / taper.nutToHeelMm);
  return { mouthWidthMm: widthAt(mouthStationMm), deepEndWidthMm: widthAt(deepStationMm) };
}
