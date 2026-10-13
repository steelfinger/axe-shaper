import type {
  GuitarProject, Vector2D, PathAnchor, BodyContour, NeckJointPlanParameters,
  NeckJointGeometry, NeckJointProfileSnapshot, ProjectSettings, InstrumentAppearance, BodyAppearance,
  HeadstockShapeId, BodyNodeRole, SymmetryConfig, BodyTop, NeckPreset, NeckTaper,
  BridgePreset, NeckPlacement, PickupPlacement, PotentiometerPlacement,
  SwitchPlacement, OutputJackPlacement, PickguardPlacement, RoutedCavity,
  PickupType, InstrumentType, NeckJointMechanism, NeckJointPlanShape,
} from '../types/guitar';
import { PROJECT_SCHEMA_VERSION, requiredSchemaVersion } from '../constants/schema';
import { PICKUP_TYPE_INSTRUMENT } from '../constants/hardware';
import { isSupportedInstrument, SUPPORTED_STRING_COUNTS } from '../utils/instrument';
import { NeckJointContractError, validateNeckJointContract } from '../utils/neckJointGeometry';
import { canonicalizeJson, CanonicalJsonError, SHARING_JSON_LIMITS } from './canonicalJson';
import type { CanonicalJsonText } from './canonicalJson';

/** Change the revision when changing accepted vocabulary or resource bounds. */
export const UPLOAD_POLICY_REVISION = 'project-upload-v3';
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
  | { ok: true; project: GuitarProject; canonicalJson: CanonicalJsonText }
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

const definitions = new WeakMap<Rule, unknown>();
function described(rule: Rule, definition: unknown): Rule { definitions.set(rule, definition); return rule; }
const definitionOf = (rule: Rule): unknown => definitions.get(rule) ?? { kind: 'custom' };

const number = (min: number, max: number, integer = false): Rule => described((value, path) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
    (integer && !Number.isSafeInteger(value))) reject('invalid-project', path);
}, { kind: 'number', min, max, integer });
const text = (max: number, nonblank = false): Rule => described((value, path) => {
  if (typeof value !== 'string') reject('invalid-project', path);
  if (value.length > max) reject('resource-limit', path);
  if (nonblank && !value.trim()) reject('invalid-project', path);
}, { kind: 'text', max, nonblank });
const boolean: Rule = described((value, path) => { if (typeof value !== 'boolean') reject('invalid-project', path); }, { kind: 'boolean' });
const choice = (...values: string[]): Rule => described((value, path) => {
  if (typeof value !== 'string') reject('invalid-project', path);
  if (!values.includes(value)) reject('unknown-vocabulary', path);
}, { kind: 'choice', values });
// Closed enum maps must list every member, so union changes fail type-checking.
const completeChoice = <T extends string>(members: Record<T, null>): Rule => choice(...Object.keys(members));
const object = (fields: Record<string, Field>): Rule => described((value, path, context) => {
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
}, { kind: 'object', fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key,
  typeof field === 'function' ? { optional: false, rule: definitionOf(field) } : { optional: true, rule: definitionOf(field.rule) }])) });
// Every declared property needs a deliberate required/optional/refusal rule.
const objectFor = <T,>(fields: Record<keyof T, Field>): Rule => object(fields);
const list = (rule: Rule, min: number, max: number, budget?: keyof Context): Rule => described((value, path, context) => {
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
}, { kind: 'list', min, max, budget: budget ?? null, item: definitionOf(rule) });

const id = text(160, true);
const name = text(200);
const provenance = text(2048, true);
const dimension = number(0.01, 2000);
const nonnegative = number(0, 2000);
const coordinate = number(-PROJECT_UPLOAD_LIMITS.maxCoordinateMm, PROJECT_UPLOAD_LIMITS.maxCoordinateMm);
const angle = number(-3600, 3600);
const vector = objectFor<Vector2D>({ x: coordinate, y: coordinate });
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const color: Rule = described((value, path) => {
  if (typeof value !== 'string' || !colorPattern.test(value)) reject('invalid-project', path);
}, { kind: 'color', pattern: colorPattern.source });
const timestampText = text(40);
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const timestamp: Rule = described((value, path) => {
  timestampText(value, path, { anchors: 0, placements: 0 });
  if (!timestampPattern.test(value as string) ||
    !Number.isFinite(Date.parse(value as string))) reject('invalid-project', path);
}, { kind: 'timestamp', text: definitionOf(timestampText), pattern: timestampPattern.source });
const anchor = objectFor<PathAnchor>({
  id, position: vector, handleMode: completeChoice<PathAnchor['handleMode']>({ corner: null, smooth: null, symmetric: null }),
  handleIn: optional(vector), handleOut: optional(vector), locked: optional(boolean),
  semanticRole: optional(completeChoice<BodyNodeRole>({ neck_pocket_left: null, neck_pocket_right: null,
    upper_horn_left: null, upper_horn_right: null, waist_left: null, waist_right: null,
    lower_bout_left: null, lower_bout_right: null, tail_center: null, custom: null })),
  mirrorId: optional(id), bevelIntensity: optional(number(0, 2)),
});
const anchorList = list(anchor, 3, PROJECT_UPLOAD_LIMITS.maxAnchorsPerContour, 'anchors');
const anchors: Rule = described((value, path, context) => {
  anchorList(value, path, context);
  const entries = value as Array<{ id: string; mirrorId?: string }>;
  for (const [index, entry] of entries.entries()) {
    // Missing partners are harmless saved state handled by live symmetry.
    if (entry.mirrorId === entry.id) reject('invalid-project', `${path}[${index}].mirrorId`);
  }
}, { kind: 'anchors', list: definitionOf(anchorList), selfMirror: 'refuse', missingMirror: 'preserve' });
const contour = objectFor<BodyContour>({ anchors, closed: described((value, path) => {
  if (value !== true) reject('invalid-project', path);
}, { kind: 'literal', value: true }) });
const parameters = objectFor<NeckJointPlanParameters>({
  mouthWidthMm: dimension, planLengthMm: dimension, endCornerRadiusMm: nonnegative,
  endTreatment: completeChoice<NeckJointPlanParameters['endTreatment']>({ square: null, rounded: null, compound: null }), endRoundnessMm: nonnegative,
  deepEndWidthMm: optional(dimension),
});
const mechanism = completeChoice<NeckJointMechanism>({ bolt_on: null, glued: null });
const planShape = completeChoice<NeckJointPlanShape>({ bolt_on_pocket: null, straight_mortise: null, tapered_mortise: null });
const joint = objectFor<NeckJointGeometry>({
  mode: completeChoice<NeckJointGeometry['mode']>({ locked: null, custom: null }), profileId: optional(id), derivedFromProfileId: optional(id),
  mechanism, planShape, parameters,
  profileSnapshot: optional(objectFor<NeckJointProfileSnapshot>({ id, name, mechanism, planShape, parameters,
    evidenceLevel: completeChoice<NeckJointProfileSnapshot['evidenceLevel']>({ documented: null, measured: null, verified: null, unverified: null }), provenance })),
  targetHeelWidthMm: optional(dimension), fittingClearanceMm: optional(number(0, 20)),
  cutterDiameterMm: optional(number(0, 100)), neckAngleDegrees: optional(number(-15, 15)),
  // Known pre-release field; its presence is deliberately refused on upload.
  mouthAnchorIds: optional(described((_value, path) => reject('unknown-vocabulary', path), { kind: 'refused' })),
});
const placements = (rule: Rule) => optional(list(rule, 0, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements'));
// Frozen for project-upload-v2; catalogue drift requires a new policy revision.
const pickupType = completeChoice<PickupType>({
  humbucker: null, mini_humbucker: null, single_coil: null, lipstick: null,
  p90_soapbar: null, p90_dogear: null, tele_neck: null, tele_bridge: null,
  bass_split_coil: null, bass_j_single_coil: null, bass_humbucker: null, bass_soapbar: null,
  bass_r_toaster: null, bass_r_horseshoe: null, bass_mudbucker: null, bass_mini_humbucker: null,
});
const routes = objectFor<RoutedCavity>({ id, name: optional(name), contour, depthMm: optional(number(0, 150)),
  visible: optional(boolean), locked: optional(boolean) });

/**
 * Explicit recursive vocabulary; no extension dictionaries or catalogue resolution.
 * Plain choice() is reserved for intentionally open string types (jack/knob IDs,
 * edge/binding bags); every closed model union uses completeChoice().
 */
const makeProjectRule = (bodyAppearance: boolean) => object({
  schemaVersion: number(3, bodyAppearance ? PROJECT_SCHEMA_VERSION : 8, true), appVersion: text(80, true),
  instrumentType: completeChoice<InstrumentType>({ guitar: null, bass: null }), stringCount: number(1, 32, true),
  jacks: optional(list(objectFor<OutputJackPlacement>({ id, position: vector, mountingStyle: choice('strat_plate', 'direct'), angleDegrees: angle }),
    0, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements')),
  metadata: objectFor<GuitarProject['metadata']>({ created: timestamp, modified: timestamp, author: text(200) }),
  settings: objectFor<ProjectSettings & { snapToGrid?: boolean }>({
    name, unitDisplay: completeChoice<ProjectSettings['unitDisplay']>({ mm: null, inches: null }), canvasOrientation: completeChoice<ProjectSettings['canvasOrientation']>({ vertical: null, horizontal: null }),
    symmetry: objectFor<SymmetryConfig>({ mode: completeChoice<SymmetryConfig['mode']>({ none: null, live_centerline: null, copy_once: null }), sourceSide: completeChoice<SymmetryConfig['sourceSide']>({ left: null, right: null }) }),
    showCenterAxis: boolean, showGhostGuide: boolean, showHardwareCavities: boolean,
    showDimensions: boolean, showGrid: boolean, gridSizeMm: number(0.1, 100), snapToGridEnabled: boolean,
    // Historical iOS setting is preserved alongside the current spelling.
    snapToGrid: optional(boolean),
    finishStyle: completeChoice<ProjectSettings['finishStyle']>({ solid: null, sunburst: null, flame_maple: null, natural_wood: null }),
    bodyColor: color, secondaryColor: color, bodyFillOpacity: number(0, 1),
    pickguardEnabled: boolean, pickguardColor: color, showPickguard: optional(boolean),
    showFrontRoutes: optional(boolean), showBackRoutes: optional(boolean), showControls: optional(boolean),
  }),
  instrumentAppearance: optional(objectFor<Omit<InstrumentAppearance, 'body'>>({
    ...(bodyAppearance ? { body: optional(objectFor<BodyAppearance>({
      material: completeChoice<BodyAppearance['material']>({ mahogany: null, flame_maple: null, swamp_ash: null }),
      finish: completeChoice<BodyAppearance['finish']>({ natural: null, solid: null, sunburst_2: null, sunburst_3: null }),
      color, middleColor: color, edgeColor: color, opacity: number(0, 1),
    })) } : {}),
    neckFinish: completeChoice<InstrumentAppearance['neckFinish']>({ natural_maple: null, body_matched: null }), fingerboard: completeChoice<InstrumentAppearance['fingerboard']>({ maple: null, rosewood: null }),
    fretboardBinding: boolean, fretboardInlay: completeChoice<InstrumentAppearance['fretboardInlay']>({ dots: null, trapezoids: null, blocks: null, sharkfins: null }),
    headstockShape: completeChoice<HeadstockShapeId>({ strat_style: null, t_style: null, gibson: null,
      explorer: null, firebird: null, thunderbird: null, flying_v: null, bass_f: null,
      bass_mm: null, bass_r: null, bass_sg: null }),
  })),
  activeTemplateId: id, contour,
  edgeProfile: optional(object({
    kind: choice('slab', 'contoured', 'beveled', 'german_carve', 'carved_top'),
    widthMm: optional(nonnegative), angleDegrees: optional(angle),
    appliesTo: optional(choice('top_only', 'top_and_back')), insetMm: optional(nonnegative),
    dropMm: optional(nonnegative), channelRadiusMm: optional(nonnegative), easeMm: optional(nonnegative),
    baseRadiusMm: optional(nonnegative), previewFallback: optional(choice('beveled', 'german_carve')),
  })),
  bodyThicknessMm: optional(number(5, 150)), bodyTop: optional(objectFor<BodyTop>({ construction: completeChoice<BodyTop['construction']>({ carved_cap: null, solid_body_carve: null }) })),
  binding: optional(object({ appliesTo: choice('top_only', 'top_and_back') })),
  neckPresetId: id, bridgePresetId: id,
  // Embedded hardware is required even when its ID is unfamiliar.
  neckPreset: objectFor<NeckPreset>({
    id, name, scaleLengthMm: number(200, 1500), nutToBodyEdgeMm: coordinate, nutToJointMm: coordinate,
    frets: number(1, 36, true), jointWidthMm: dimension, jointDepthMm: dimension, jointCornerRadiusMm: nonnegative,
    style: completeChoice<NeckPreset['style']>({ fender_style: null, gibson_style: null, baritone: null }), pocketWidthMm: optional(dimension),
    pocketDepthMm: optional(dimension), pocketCornerRadiusMm: optional(nonnegative),
    nutStringSpacingMm: optional(dimension),
    neckTaper: optional(objectFor<NeckTaper>({ nutWidthMm: dimension, heelWidthMm: dimension, nutToHeelMm: dimension })),
  }),
  bridgePreset: objectFor<BridgePreset>({
    id, name, scaleReference: completeChoice<BridgePreset['scaleReference']>({ saddle_line: null, post_line: null, plate_origin: null }),
    compensationMm: objectFor<BridgePreset['compensationMm']>({ treble: coordinate, bass: coordinate }),
    mountingPoints: optional(list(vector, 0, 32)), widthMm: dimension, lengthMm: dimension,
    saddleOffsetYMm: optional(coordinate), singlePlate: optional(boolean), outlineMm: optional(list(vector, 3, 128)),
    stringSpacingMm: optional(dimension), heightMm: optional(dimension),
  }),
  neckJointMechanism: optional(mechanism), neckJointGeometry: optional(joint),
  neckPlacement: optional(objectFor<NeckPlacement>({ mode: completeChoice<NeckPlacement['mode']>({ blueprint: null, custom: null }), referenceFret: number(1, 36, true),
    jointToReferenceFretMm: coordinate, provenance })),
  pickups: list(objectFor<PickupPlacement & { name?: string; cornerRadiusMm?: number; defaultAngleDegrees?: number }>({ id, name: optional(name), cornerRadiusMm: optional(nonnegative),
    defaultAngleDegrees: optional(angle),
    type: pickupType, offsetYMm: coordinate, offsetXMm: coordinate, angleDegrees: angle,
    widthMm: dimension, heightMm: dimension, anchors }), 0, PROJECT_UPLOAD_LIMITS.maxPlacements, 'placements'),
  potentiometers: placements(objectFor<PotentiometerPlacement>({ id, position: vector, bodyDiameterMm: dimension, knobStyleId: choice('generic') })),
  switches: placements(objectFor<SwitchPlacement>({ id, type: completeChoice<SwitchPlacement['type']>({ gibson_toggle: null, fender_blade: null }), position: vector, angleDegrees: angle })),
  pickguards: placements(objectFor<PickguardPlacement>({ id, name: optional(name), contour, colorHex: optional(color),
    visible: optional(boolean), locked: optional(boolean) })),
  frontRoutes: placements(routes), backRoutes: placements(routes),
} satisfies Record<keyof GuitarProject, Field>);

const projectRule = makeProjectRule(true);
const legacyProjectRule = makeProjectRule(false);

/** Data-only definition used by the revision fingerprint; custom semantics still need review. */
export const PROJECT_UPLOAD_POLICY_DEFINITION = JSON.parse(canonicalizeJson({
  limits: PROJECT_UPLOAD_LIMITS,
  jsonSafetyLimits: SHARING_JSON_LIMITS,
  rule: definitionOf(projectRule),
  supportedStringCounts: SUPPORTED_STRING_COUNTS,
  pickupInstruments: PICKUP_TYPE_INSTRUMENT,
  semantics: { schemaStamp: 'exact-required', jointPair: 'when-present-or-schema-7', embeddedPresets: 'required' },
})) as unknown;

/** Retain old validator implementations here when introducing a deployed revision. */
export type ProjectRevisionValidator = (input: unknown, maxReadableProjectSchema: number) => ProjectAdmissionResult;
export type ProjectRevisionReaders = Readonly<Record<string, ProjectRevisionValidator>>;
export const PROJECT_REVISION_READERS: ProjectRevisionReaders = Object.freeze({
  'project-upload-v3': (input: unknown, ceiling: number) => validateProjectUpload(input,
    { revision: 'project-upload-v3', maxAcceptedProjectSchema: ceiling }),
  'project-upload-v2': (input: unknown, ceiling: number) => validateProjectUpload(input,
    { revision: 'project-upload-v2', maxAcceptedProjectSchema: ceiling }),
});

/**
 * Shared upload preflight/admission. Never fills defaults, migrates, rounds,
 * stamps schemas, resolves presets or mutates the received project.
 * Parse raw requests with parseSharingJson first to detect duplicate names.
 */
export function validateProjectUpload(input: unknown, policy: ProjectAdmissionPolicy): ProjectAdmissionResult {
  if (!['project-upload-v2', UPLOAD_POLICY_REVISION].includes(policy.revision) || !Number.isInteger(policy.maxAcceptedProjectSchema) ||
    policy.maxAcceptedProjectSchema < 3 || policy.maxAcceptedProjectSchema > PROJECT_SCHEMA_VERSION) {
    return { ok: false, code: 'unsupported-policy', path: 'policy' };
  }
  try {
    // Reject JS-only values/getters before accessing the structural fields.
    const canonicalJson = canonicalizeJson(input, PROJECT_UPLOAD_LIMITS.maxProjectBytes);
    if (!input || typeof input !== 'object' || Array.isArray(input)) reject('invalid-project', 'project');
    const project = input as GuitarProject;
    if (!Number.isInteger(project.schemaVersion) || project.schemaVersion < 3 ||
      project.schemaVersion > policy.maxAcceptedProjectSchema) reject('unsupported-schema', 'project.schemaVersion');
    (policy.revision === 'project-upload-v2' ? legacyProjectRule : projectRule)(project, 'project', { anchors: 0, placements: 0 });
    if (!isSupportedInstrument(project.instrumentType, project.stringCount)) reject('invalid-project', 'project.stringCount');
    for (const [index, pickup] of project.pickups.entries()) {
      if (PICKUP_TYPE_INSTRUMENT[pickup.type] !== project.instrumentType) reject('invalid-project', `project.pickups[${index}].type`);
    }
    if (project.neckJointGeometry || project.neckPlacement || project.schemaVersion === 7) {
      try { validateNeckJointContract(project.neckJointGeometry, project.neckPlacement, project.instrumentType); }
      catch (error) {
        if (error instanceof NeckJointContractError) reject('invalid-project', 'project.neckJointGeometry');
        throw error;
      }
    }
    if (project.schemaVersion !== requiredSchemaVersion(project)) reject('schema-mismatch', 'project.schemaVersion');
    return { ok: true, project, canonicalJson };
  } catch (error) {
    if (error instanceof AdmissionError) return { ok: false, code: error.code, path: error.path };
    if (error instanceof CanonicalJsonError) return { ok: false,
      code: error.code === 'resource-limit' ? 'resource-limit' : 'invalid-project', path: 'project' };
    throw error;
  }
}
