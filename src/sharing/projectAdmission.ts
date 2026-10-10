import type { GuitarProject } from '../types/guitar';
import { PROJECT_SCHEMA_VERSION, requiredSchemaVersion } from '../constants/schema';
import { NeckJointContractError, validateNeckJointContract } from '../utils/neckJointGeometry';
import { canonicalizeJson, CanonicalJsonError } from './canonicalJson';

/** Change the revision when changing accepted vocabulary or resource bounds. */
export const UPLOAD_POLICY_REVISION = 'project-upload-v1';
export const PROJECT_UPLOAD_LIMITS = {
  maxProjectBytes: 384 * 1024,
  maxAnchors: 2048,
  maxAnchorsPerContour: 512,
  maxPlacements: 128,
  maxCoordinateMm: 5000,
} as const;

export interface ProjectAdmissionPolicy {
  revision: string;
  maxAcceptedProjectSchema: number;
}
export type ProjectAdmissionErrorCode = 'unsupported-policy' | 'unsupported-schema' |
  'schema-mismatch' | 'unknown-vocabulary' | 'invalid-project' | 'resource-limit';
export type ProjectAdmissionResult =
  | { ok: true; project: GuitarProject }
  | { ok: false; code: ProjectAdmissionErrorCode; path: string };

class AdmissionError extends Error {
  readonly code: ProjectAdmissionErrorCode;
  readonly path: string;
  constructor(code: ProjectAdmissionErrorCode, path: string) {
    super(code);
    this.code = code;
    this.path = path;
  }
}
function reject(code: ProjectAdmissionErrorCode, path: string): never { throw new AdmissionError(code, path); }
interface Context { anchors: number; placements: number }
type Rule = (value: unknown, path: string, context: Context) => void;
type Field = { rule: Rule; optional: true } | Rule;
const optional = (rule: Rule): Field => ({ rule, optional: true });

const number = (min: number, max: number, integer = false): Rule => (value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
    (integer && !Number.isSafeInteger(value))) reject('invalid-project', path);
};
const text = (max: number, nonblank = false): Rule => (value, path) => {
  if (typeof value !== 'string') reject('invalid-project', path);
  if (value.length > max) reject('resource-limit', path);
  if (nonblank && !value.trim()) reject('invalid-project', path);
};
const boolean: Rule = (value, path) => { if (typeof value !== 'boolean') reject('invalid-project', path); };
const choice = (...values: string[]): Rule => (value, path) => {
  if (typeof value !== 'string') reject('invalid-project', path);
  if (!values.includes(value)) reject('unknown-vocabulary', path);
};
const object = (fields: Record<string, Field>): Rule => (value, path, context) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('invalid-project', path);
  const record = value as Record<string, unknown>;
  // Unknown names are deliberately not reflected into errors or logs.
  for (const key of Object.keys(record)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(fields, key)) reject('unknown-vocabulary', path);
  }
  for (const [key, field] of Object.entries(fields)) {
    const required = typeof field === 'function';
    if (!Object.hasOwn(record, key)) {
      if (required) reject('invalid-project', `${path}.${key}`);
      continue;
    }
    (required ? field : field.rule)(record[key], `${path}.${key}`, context);
  }
};
const list = (rule: Rule, min: number, max: number, budget?: keyof Context): Rule => (value, path, context) => {
  if (!Array.isArray(value) || value.length < min) reject('invalid-project', path);
  if (value.length > max) reject('resource-limit', path);
  if (budget) {
    context[budget] += value.length;
    const ceiling = budget === 'anchors' ? PROJECT_UPLOAD_LIMITS.maxAnchors : PROJECT_UPLOAD_LIMITS.maxPlacements;
    if (context[budget] > ceiling) reject('resource-limit', path);
  }
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    rule(item, itemPath, context);
    if (item && typeof item === 'object' && Object.hasOwn(item, 'id')) {
      const id = item.id as string;
      if (ids.has(id)) reject('invalid-project', `${itemPath}.id`);
      ids.add(id);
    }
  });
};

const id = text(160, true);
const name = text(200);
const provenance = text(2048, true);
const dimension = number(0.01, 2000);
const nonnegative = number(0, 2000);
const coordinate = number(-PROJECT_UPLOAD_LIMITS.maxCoordinateMm, PROJECT_UPLOAD_LIMITS.maxCoordinateMm);
const angle = number(-3600, 3600);
const vector = object({ x: coordinate, y: coordinate });
const color: Rule = (value, path) => {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) reject('invalid-project', path);
};
const timestamp: Rule = (value, path) => {
  text(40)(value, path, { anchors: 0, placements: 0 });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value as string) ||
    !Number.isFinite(Date.parse(value as string))) reject('invalid-project', path);
};
const anchor = object({
  id, position: vector, handleMode: choice('corner', 'smooth', 'symmetric'),
  handleIn: optional(vector), handleOut: optional(vector), locked: optional(boolean),
  semanticRole: optional(choice('neck_pocket_left', 'neck_pocket_right', 'upper_horn_left', 'upper_horn_right',
    'waist_left', 'waist_right', 'lower_bout_left', 'lower_bout_right', 'tail_center', 'custom')),
  mirrorId: optional(id), bevelIntensity: optional(number(0, 2)),
});
const anchors: Rule = (value, path, context) => {
  list(anchor, 3, PROJECT_UPLOAD_LIMITS.maxAnchorsPerContour, 'anchors')(value, path, context);
  const entries = value as Array<{ id: string; mirrorId?: string }>;
  const ids = new Set(entries.map(entry => entry.id));
  for (const [index, entry] of entries.entries()) {
    if (entry.mirrorId && (entry.mirrorId === entry.id || !ids.has(entry.mirrorId))) reject('invalid-project', `${path}[${index}].mirrorId`);
  }
};
const contour = object({ anchors, closed: (value, path) => { if (value !== true) reject('invalid-project', path); } });
const parameters = object({
  mouthWidthMm: dimension, planLengthMm: dimension, endCornerRadiusMm: nonnegative,
  endTreatment: choice('square', 'rounded', 'compound'), endRoundnessMm: nonnegative,
  deepEndWidthMm: optional(dimension),
});
const mechanism = choice('bolt_on', 'glued');
const planShape = choice('bolt_on_pocket', 'straight_mortise', 'tapered_mortise');
const joint = object({
  mode: choice('locked', 'custom'), profileId: optional(id), derivedFromProfileId: optional(id),
  mechanism, planShape, parameters,
  profileSnapshot: optional(object({ id, name, mechanism, planShape, parameters,
    evidenceLevel: choice('documented', 'measured', 'verified', 'unverified'), provenance })),
  targetHeelWidthMm: optional(dimension), fittingClearanceMm: optional(number(0, 20)),
  cutterDiameterMm: optional(number(0, 100)), neckAngleDegrees: optional(number(-15, 15)),
});
const placements = (rule: Rule) => optional(list(rule, 0, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements'));
const pickupType = choice('humbucker', 'mini_humbucker', 'single_coil', 'lipstick', 'p90_soapbar', 'p90_dogear',
  'tele_neck', 'tele_bridge', 'bass_split_coil', 'bass_j_single_coil', 'bass_humbucker', 'bass_soapbar',
  'bass_r_toaster', 'bass_r_horseshoe', 'bass_mudbucker', 'bass_mini_humbucker');
const routes = object({ id, name: optional(name), contour, depthMm: optional(number(0, 150)),
  visible: optional(boolean), locked: optional(boolean) });

/** Explicit recursive vocabulary; no extension dictionaries or catalogue resolution. */
const projectRule = object({
  schemaVersion: number(3, PROJECT_SCHEMA_VERSION, true), appVersion: text(80, true),
  instrumentType: choice('guitar', 'bass'), stringCount: number(4, 6, true),
  jacks: optional(list(object({ id, position: vector, mountingStyle: choice('strat_plate', 'direct'), angleDegrees: angle }),
    1, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements')),
  metadata: object({ created: timestamp, modified: timestamp, author: text(200) }),
  settings: object({
    name, unitDisplay: choice('mm', 'inches'), canvasOrientation: choice('vertical', 'horizontal'),
    symmetry: object({ mode: choice('none', 'live_centerline', 'copy_once'), sourceSide: choice('left', 'right') }),
    showCenterAxis: boolean, showGhostGuide: boolean, showHardwareCavities: boolean,
    showDimensions: boolean, showGrid: boolean, gridSizeMm: number(0.1, 100), snapToGridEnabled: boolean,
    // Historical iOS setting is preserved alongside the current spelling.
    snapToGrid: optional(boolean),
    finishStyle: choice('solid', 'sunburst', 'flame_maple', 'natural_wood'),
    bodyColor: color, secondaryColor: color, bodyFillOpacity: number(0, 1),
    pickguardEnabled: boolean, pickguardColor: color, showPickguard: optional(boolean),
    showFrontRoutes: optional(boolean), showBackRoutes: optional(boolean), showControls: optional(boolean),
  }),
  instrumentAppearance: optional(object({
    neckFinish: choice('natural_maple', 'body_matched'), fingerboard: choice('maple', 'rosewood'),
    fretboardBinding: boolean, fretboardInlay: choice('dots', 'trapezoids', 'blocks', 'sharkfins'),
    headstockShape: choice('strat_style', 't_style', 'gibson', 'explorer', 'firebird', 'thunderbird',
      'flying_v', 'bass_f', 'bass_mm', 'bass_r', 'bass_sg'),
  })),
  activeTemplateId: id, contour,
  edgeProfile: optional(object({
    kind: choice('slab', 'contoured', 'beveled', 'german_carve', 'carved_top'),
    widthMm: optional(nonnegative), angleDegrees: optional(angle),
    appliesTo: optional(choice('top_only', 'top_and_back')), insetMm: optional(nonnegative),
    dropMm: optional(nonnegative), channelRadiusMm: optional(nonnegative), easeMm: optional(nonnegative),
    baseRadiusMm: optional(nonnegative), previewFallback: optional(choice('beveled', 'german_carve')),
  })),
  bodyThicknessMm: optional(number(5, 150)), bodyTop: optional(object({ construction: choice('carved_cap', 'solid_body_carve') })),
  binding: optional(object({ appliesTo: choice('top_only', 'top_and_back') })),
  neckPresetId: id, bridgePresetId: id,
  // Embedded hardware is required even when its ID is unfamiliar.
  neckPreset: object({
    id, name, scaleLengthMm: number(200, 1500), nutToBodyEdgeMm: coordinate, nutToJointMm: coordinate,
    frets: number(1, 36, true), jointWidthMm: dimension, jointDepthMm: dimension, jointCornerRadiusMm: nonnegative,
    style: choice('fender_style', 'gibson_style', 'baritone'), pocketWidthMm: optional(dimension),
    pocketDepthMm: optional(dimension), pocketCornerRadiusMm: optional(nonnegative),
    nutStringSpacingMm: optional(dimension),
    neckTaper: optional(object({ nutWidthMm: dimension, heelWidthMm: dimension, nutToHeelMm: dimension })),
  }),
  bridgePreset: object({
    id, name, scaleReference: choice('saddle_line', 'post_line', 'plate_origin'),
    compensationMm: object({ treble: coordinate, bass: coordinate }),
    mountingPoints: optional(list(vector, 0, 32)), widthMm: dimension, lengthMm: dimension,
    saddleOffsetYMm: optional(coordinate), singlePlate: optional(boolean), outlineMm: optional(list(vector, 3, 128)),
    stringSpacingMm: optional(dimension), heightMm: optional(dimension),
  }),
  neckJointMechanism: optional(mechanism), neckJointGeometry: optional(joint),
  neckPlacement: optional(object({ mode: choice('blueprint', 'custom'), referenceFret: number(1, 36, true),
    jointToReferenceFretMm: coordinate, provenance })),
  pickups: list(object({ id, name: optional(name), cornerRadiusMm: optional(nonnegative),
    defaultAngleDegrees: optional(angle),
    type: pickupType, offsetYMm: coordinate, offsetXMm: coordinate, angleDegrees: angle,
    widthMm: dimension, heightMm: dimension, anchors }), 0, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements'),
  potentiometers: placements(object({ id, position: vector, bodyDiameterMm: dimension, knobStyleId: choice('generic') })),
  switches: placements(object({ id, type: choice('gibson_toggle', 'fender_blade'), position: vector, angleDegrees: angle })),
  pickguards: placements(object({ id, name: optional(name), contour, colorHex: optional(color),
    visible: optional(boolean), locked: optional(boolean) })),
  frontRoutes: placements(routes), backRoutes: placements(routes),
} satisfies Record<keyof GuitarProject, Field>);

/**
 * Shared upload preflight/admission. Never fills defaults, migrates, rounds,
 * stamps schemas, resolves presets or mutates the received project.
 * Parse raw requests with parseSharingJson first to detect duplicate names.
 */
export function validateProjectUpload(input: unknown, policy: ProjectAdmissionPolicy): ProjectAdmissionResult {
  if (policy.revision !== UPLOAD_POLICY_REVISION || !Number.isInteger(policy.maxAcceptedProjectSchema) ||
    policy.maxAcceptedProjectSchema < 3 || policy.maxAcceptedProjectSchema > PROJECT_SCHEMA_VERSION) {
    return { ok: false, code: 'unsupported-policy', path: 'policy' };
  }
  try {
    // Reject JS-only values/getters before accessing the structural fields.
    const canonical = canonicalizeJson(input);
    if (new TextEncoder().encode(canonical).byteLength > PROJECT_UPLOAD_LIMITS.maxProjectBytes) reject('resource-limit', 'project');
    if (!input || typeof input !== 'object' || Array.isArray(input)) reject('invalid-project', 'project');
    const project = input as GuitarProject;
    if (!Number.isInteger(project.schemaVersion) || project.schemaVersion < 3 ||
      project.schemaVersion > policy.maxAcceptedProjectSchema) reject('unsupported-schema', 'project.schemaVersion');
    projectRule(project, 'project', { anchors: 0, placements: 0 });
    if (project.stringCount !== (project.instrumentType === 'guitar' ? 6 : 4)) reject('invalid-project', 'project.stringCount');
    for (const [index, pickup] of project.pickups.entries()) {
      if (pickup.type.startsWith('bass_') !== (project.instrumentType === 'bass')) reject('invalid-project', `project.pickups[${index}].type`);
    }
    if (project.neckJointGeometry || project.neckPlacement || project.schemaVersion >= 7) {
      try { validateNeckJointContract(project.neckJointGeometry, project.neckPlacement, project.instrumentType); }
      catch (error) {
        if (error instanceof NeckJointContractError) reject('invalid-project', 'project.neckJointGeometry');
        throw error;
      }
    }
    if (project.schemaVersion !== requiredSchemaVersion(project)) reject('schema-mismatch', 'project.schemaVersion');
    return { ok: true, project };
  } catch (error) {
    if (error instanceof AdmissionError) return { ok: false, code: error.code, path: error.path };
    if (error instanceof CanonicalJsonError) return { ok: false,
      code: error.code === 'resource-limit' ? 'resource-limit' : 'invalid-project', path: 'project' };
    throw error;
  }
}
