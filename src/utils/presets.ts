import {
  BRIDGE_PRESETS,
  CURATED_NECK_PRESETS,
  DEFAULT_NECK_JOINT_MECHANISM,
  FINGERBOARD_OVERHANG_MM,
  GENERIC_POCKET_SPEC,
  NECK_PRESETS,
  PICKUP_SPECIFICATIONS,
  TEMPLATE_NECK_POCKET_SPEC,
} from '../constants/hardware';
import { PROJECT_SCHEMA_VERSION, isSupportedSchemaVersion, requiredSchemaVersion } from '../constants/schema';
import type {
  BridgePreset,
  GuitarProject,
  InstrumentType,
  NeckJointGeometry,
  NeckJointMechanism,
  NeckPreset,
  NeckPlacement,
  PickupPlacement,
  PickupRoutSpec,
  PickupType,
  StoredProject,
} from '../types/guitar';
import {
  LEGACY_INSTRUMENT_TYPE,
  bridgePresetInstrument,
  defaultStringCount,
  fingerboardReferenceFret,
  isInstrumentType,
  isSupportedInstrument,
  neckPresetInstrument,
  pickupTypeInstrument,
  resolveInstrument,
} from './instrument';
import { getFretDistanceFromNutMm } from './scaleMath';
import {
  NeckJointContractError,
  nutToBodyEdgeFromPlacement,
  updateCustomNeckJoint,
  validateNeckJointContract,
} from './neckJointGeometry';

const BOLT_ON_SIDE_TAPER_RADIANS = 0.84 * Math.PI / 180;
const BOLT_ON_DEEP_CORNER_RADIUS_MM = 6.35;
const BOLT_ON_CLOSING_ARC_RADIUS_MM = 127;
const BOLT_ON_DEFAULT_MOUTH_WIDTH_MM = 53.64553921225705;
const BOLT_ON_DEFAULT_PLAN_LENGTH_MM = 76.2;

const BUNDLED_GUITAR_JOINT_BASELINES: Record<string, Pick<NeckJointGeometry, 'mechanism' | 'planShape' | 'parameters'>> = {
  gibson_explorer: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 122.06, endCornerRadiusMm: 8, endTreatment: 'square', endRoundnessMm: 0 } },
  gibson_firebird: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 82, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  gibson_flying_v: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 67, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  gretsch_thunderbird: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 76.2, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  jag_style: { mechanism: 'bolt_on', planShape: 'bolt_on_pocket', parameters: { mouthWidthMm: 55.56, deepEndWidthMm: 57.794460787742956, planLengthMm: 76.2, endCornerRadiusMm: 6.35, endTreatment: 'compound', endRoundnessMm: 127 } },
  prs_style: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 54.3, planLengthMm: 68, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  semi_hollow_double_cut: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 101.6, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  semi_hollow_single_cut: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 101.6, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  sg_style: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 76.2, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
  single_cut: { mechanism: 'glued', planShape: 'straight_mortise', parameters: { mouthWidthMm: 38.1, planLengthMm: 101.6, endCornerRadiusMm: 6.35, endTreatment: 'square', endRoundnessMm: 0 } },
};

function boltOnParametersForTemplate(
  templateId: string,
  mouthWidthMm: number,
  planLengthMm: number,
): NeckJointGeometry['parameters'] {
  const deepEndWidthMm = mouthWidthMm + 2 * planLengthMm * Math.tan(BOLT_ON_SIDE_TAPER_RADIANS);
  const isStraightEnd = templateId === 't_style';
  return {
    mouthWidthMm,
    deepEndWidthMm,
    planLengthMm,
    endCornerRadiusMm: BOLT_ON_DEEP_CORNER_RADIUS_MM,
    endTreatment: isStraightEnd ? 'square' : 'compound',
    endRoundnessMm: isStraightEnd ? 0 : BOLT_ON_CLOSING_ARC_RADIUS_MM,
  };
}

/**
 * A bass bolt-on starts as the measured 63.5 x 98.425 mm rectangle, untapered
 * and square-ended. The guitar's 0.84 degree taper and compound S-style end
 * are guitar heel geometry; applying them would silently reshape a bass rout
 * on conversion. Both width stations are stored so the editor's taper-keeping
 * controls start from zero taper.
 */
function rectangularBassBoltOnParameters(
  mouthWidthMm: number,
  planLengthMm: number,
  cornerRadiusMm: number,
): NeckJointGeometry['parameters'] {
  return {
    mouthWidthMm,
    deepEndWidthMm: mouthWidthMm,
    planLengthMm,
    endCornerRadiusMm: cornerRadiusMm,
    endTreatment: 'square',
    endRoundnessMm: 0,
  };
}

/**
 * Construction is not a conversion of the old mortise. When a builder elects
 * to make a glued-neck body bolt-on, start with the common 3 in tapered
 * bolt-on envelope and let the normal numeric controls refine it for the
 * actual heel. T-style bodies retain their straight deep edge; every other
 * guitar body begins with the rounded compound end.
 */
function defaultBoltOnParametersForTemplate(
  templateId: string,
  instrumentType: InstrumentType,
): NeckJointGeometry['parameters'] {
  if (instrumentType === 'bass') {
    const pocket = GENERIC_POCKET_SPEC.bass.bolt_on;
    return rectangularBassBoltOnParameters(pocket.jointWidthMm, pocket.jointDepthMm, pocket.jointCornerRadiusMm);
  }
  return boltOnParametersForTemplate(
    templateId,
    BOLT_ON_DEFAULT_MOUTH_WIDTH_MM,
    BOLT_ON_DEFAULT_PLAN_LENGTH_MM,
  );
}

/**
 * Hardware resolution for a project.
 *
 * A project stores hardware twice: the preset *id* (what the user picked, and
 * what the dropdowns select on) and an embedded *copy* of the preset itself
 * (the geometry the design was actually drawn against). The embedded copy
 * wins.
 *
 * That ordering is the whole point. Bridge position is derived from the neck's
 * scale length and the bridge's compensation, so a reader that resolves an
 * unknown id by falling back to a default does not fail loudly - it draws a
 * plausible guitar with the saddle line in the wrong place, on a document
 * whose entire purpose is to be printed 1:1 and cut into wood. Preferring the
 * embedded copy means a file drawn against hardware this build has never heard
 * of still comes out dimensionally correct.
 *
 * The consequence, which is intended: correcting a published spec in
 * hardware.ts does not retroactively move the bridge on existing saves. The
 * file describes what was designed. Re-picking the preset adopts the new spec.
 */

export const DEFAULT_NECK_PRESET_ID = 'fender_strat_21';
export const DEFAULT_BRIDGE_PRESET_ID = 'tremolo_strat';
export const DEFAULT_PICKUP_TYPE: PickupType = 'single_coil';
export const FALLBACK_NECK_JOINT_MECHANISM: NeckJointMechanism = 'bolt_on';

type NeckRef = Pick<GuitarProject, 'neckPresetId' | 'neckPreset'>;
type BridgeRef = Pick<GuitarProject, 'bridgePresetId' | 'bridgePreset'>;

/**
 * The effective `NeckJointMechanism` for display and for resolving a chosen
 * neck's pocket shape: the project's own explicit choice, else the active
 * body's own real-world default, else bolt-on. Never writes anything back -
 * `neckJointMechanism` stays absent on a file that never set it, per the
 * type's own "loading is a no-op" comment.
 */
export function resolvedNeckJointMechanism(
  project: Pick<GuitarProject, 'neckJointMechanism' | 'neckJointGeometry' | 'activeTemplateId'>
): NeckJointMechanism {
  return (
    project.neckJointGeometry?.mechanism ??
    project.neckJointMechanism ??
    DEFAULT_NECK_JOINT_MECHANISM[project.activeTemplateId] ??
    FALLBACK_NECK_JOINT_MECHANISM
  );
}

/** Effective neck geometry: the project's embedded copy, else the built-in table, else the default. */
export function resolveNeckPreset(ref: NeckRef): NeckPreset {
  return (
    ref.neckPreset ??
    NECK_PRESETS[ref.neckPresetId] ??
    CURATED_NECK_PRESETS[ref.neckPresetId] ??
    NECK_PRESETS[DEFAULT_NECK_PRESET_ID]
  );
}

/** Effective bridge geometry: the project's embedded copy, else the built-in table, else the default. */
export function resolveBridgePreset(ref: BridgeRef): BridgePreset {
  // R-style files saved before the master-geometry correction contain the
  // former rectangular approximation as their embedded preset. The named
  // preset is an authoritative physical plate, so upgrade that one stale
  // representation at read time instead of continuing to draw a box.
  if (ref.bridgePresetId === 'bass_r_style_plate' && !ref.bridgePreset?.outlineMm) {
    return BRIDGE_PRESETS.bass_r_style_plate;
  }
  return (
    ref.bridgePreset ?? BRIDGE_PRESETS[ref.bridgePresetId] ?? BRIDGE_PRESETS[DEFAULT_BRIDGE_PRESET_ID]
  );
}

/**
 * The id/copy pair for a newly chosen neck preset, to spread into a project
 * update. Changing the id alone would be a no-op - resolveNeckPreset() reads
 * the embedded copy first, so the two have to move together.
 */
export function neckPresetFields(id: string): Required<NeckRef> {
  const preset = NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id] ?? NECK_PRESETS[DEFAULT_NECK_PRESET_ID];
  return { neckPresetId: id, neckPreset: structuredClone(preset) };
}

/**
 * As `neckPresetFields`, except:
 *
 * - When `activeTemplateId` names one of the 8 bundled bodies (has an entry
 *   in `FINGERBOARD_OVERHANG_MM`): `nutToBodyEdgeMm` is recomputed for
 *   *that* body rather than taking the chosen preset's own stored value
 *   verbatim. Without this, attaching a curated neck (or any neck not that
 *   body's own native one) to, say, the SG would put the bridge wherever
 *   that neck's *donor* body's joint sits - exactly the "two facts
 *   competing" class of bug the SG/Firebird/Flying V comments in
 *   `constants/hardware.ts` document being fixed once already, reintroduced
 *   the moment necks stopped being 1:1 with bodies. A custom/unrecognized
 *   `activeTemplateId` (no table entry) leaves the chosen preset's own
 *   `nutToBodyEdgeMm` untouched - the same "leave it exactly as decoded"
 *   fallback as axe-shaper-ios's own equivalent. `nutToJointMm` is left as
 *   the chosen preset's own value either way - it's sidebar display only
 *   (see `scaleMath.ts`'s warning against using it for saddle Y), not part
 *   of this correction.
 * - The pocket shape (`jointWidthMm`/`jointDepthMm`/`jointCornerRadiusMm`,
 *   and their `pocket*` iOS-writer-named duplicates) always comes from
 *   `GENERIC_POCKET_SPEC[instrumentType][mechanism]`, never from the chosen
 *   preset's own stored pocket fields - pocket shape is instrument- and
 *   mechanism-owned, not neck-owned (see `GENERIC_POCKET_SPEC`'s own comment
 *   for why), applied unconditionally because both always have a concrete
 *   value by the time they reach this function (the caller resolves them,
 *   typically via `resolvedNeckJointMechanism` and the project's own
 *   `instrumentType`).
 *
 *   `instrumentType` is the axis added for bass. Without it a bass project
 *   routed the 55.56mm Fender *guitar* pocket for a 63.5mm bass heel - the
 *   table used to be keyed by mechanism alone and described itself as
 *   independent of which neck was attached, which was true only while every
 *   neck was a guitar neck.
 *
 * The fingerboard-overhang reference fret comes from
 * `FINGERBOARD_REFERENCE_FRET[instrumentType]` (22 for guitar, 20 for bass),
 * *not* from the chosen neck's own `frets`. It is a rate, not a claim about
 * where a fingerboard ends, and it has to be the same number on the way in
 * and the way out or the derivation stops cancelling - see that constant's
 * own comment, and docs/AXE_SVG_FORMAT.md, which pins it for both platforms.
 */
export function neckPresetFieldsForTemplate(
  id: string,
  activeTemplateId: string,
  mechanism: NeckJointMechanism,
  instrumentType: InstrumentType
): Required<NeckRef> {
  const base = NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id] ?? NECK_PRESETS[DEFAULT_NECK_PRESET_ID];
  const overhang = FINGERBOARD_OVERHANG_MM[activeTemplateId];
  const referenceFret = fingerboardReferenceFret(instrumentType);
  const nutToBodyEdgeMm =
    overhang === undefined
      ? base.nutToBodyEdgeMm
      : getFretDistanceFromNutMm(referenceFret, base.scaleLengthMm) - overhang;
  const templatePocket = TEMPLATE_NECK_POCKET_SPEC[activeTemplateId];
  const pocket = templatePocket?.mechanism === mechanism
    ? templatePocket
    : GENERIC_POCKET_SPEC[instrumentType][mechanism];
  return {
    neckPresetId: id,
    neckPreset: {
      ...structuredClone(base),
      nutToBodyEdgeMm,
      jointWidthMm: pocket.jointWidthMm,
      jointDepthMm: pocket.jointDepthMm,
      jointCornerRadiusMm: pocket.jointCornerRadiusMm,
      pocketWidthMm: pocket.jointWidthMm,
      pocketDepthMm: pocket.jointDepthMm,
      pocketCornerRadiusMm: pocket.jointCornerRadiusMm,
    },
  };
}

/**
 * What the pickers may offer for a given instrument.
 *
 * Pure functions over the catalogue, kept together because they answer one
 * question - "what can this project legally use?" - and because getting any
 * of them wrong has the same consequence: guitar hardware substituted into a
 * bass project, which resolves, draws, saves and prints without complaining
 * and is wrong by tens of millimetres.
 *
 * None of these take part in resolving a *file's* geometry. An id these
 * tables have never heard of still opens and still draws from its embedded
 * copy; it simply is not offered as a choice. That separation is the whole
 * reason compatibility lives in side-tables rather than on the presets.
 */

/**
 * The necks offered for `instrumentType`, in catalogue order.
 *
 * Asymmetric between the two instruments, for a historical reason worth
 * stating: guitar has nine legacy per-body necks in `NECK_PRESETS` that
 * remain *resolvable* (every bundled blueprint names one) but are no longer
 * *offered*, so its picker shows the four `CURATED_NECK_PRESETS` instead.
 * The bass necks were authored as scale-length-only entries from the start,
 * so there is no legacy half to hide and the same four entries serve both
 * jobs.
 */
export function offeredNeckPresets(instrumentType: InstrumentType): NeckPreset[] {
  if (instrumentType === 'guitar') return Object.values(CURATED_NECK_PRESETS);
  return Object.values(NECK_PRESETS).filter((neck) => neckPresetInstrument(neck.id) === instrumentType);
}

/** The bridges offered for `instrumentType`, in catalogue order. */
export function offeredBridgePresets(instrumentType: InstrumentType): BridgePreset[] {
  return Object.values(BRIDGE_PRESETS).filter((bridge) => bridgePresetInstrument(bridge.id) === instrumentType);
}

/** The pickup types offered for `instrumentType`, in catalogue order. */
export function offeredPickupTypes(instrumentType: InstrumentType): PickupType[] {
  return (Object.keys(PICKUP_SPECIFICATIONS) as PickupType[]).filter(
    (type) => pickupTypeInstrument(type) === instrumentType
  );
}

/**
 * Whether a template - a bundled blueprint or a user-saved one - can be
 * applied to a project of this instrument. Switching blueprint replaces the
 * contour and the hardware, so crossing instruments is a new design, not an
 * edit (milestone W4).
 */
export function isTemplateCompatible(
  template: { instrumentType?: InstrumentType; stringCount?: number },
  project: Pick<GuitarProject, 'instrumentType' | 'stringCount'>
): boolean {
  const instrumentType = template.instrumentType ?? LEGACY_INSTRUMENT_TYPE;
  const stringCount = template.stringCount ?? defaultStringCount(instrumentType);
  return instrumentType === project.instrumentType && stringCount === project.stringCount;
}

/**
 * The default hardware a new project of this instrument starts on: the first
 * offered entry, falling back to the guitar defaults for an instrument with
 * an empty catalogue (which cannot happen today, and would be a catalogue
 * bug rather than a document problem if it did).
 */
export function defaultNeckPresetId(instrumentType: InstrumentType): string {
  return offeredNeckPresets(instrumentType)[0]?.id ?? DEFAULT_NECK_PRESET_ID;
}

export function defaultBridgePresetId(instrumentType: InstrumentType): string {
  return offeredBridgePresets(instrumentType)[0]?.id ?? DEFAULT_BRIDGE_PRESET_ID;
}

export function defaultPickupType(instrumentType: InstrumentType): PickupType {
  return offeredPickupTypes(instrumentType)[0] ?? DEFAULT_PICKUP_TYPE;
}

/**
 * The curated neck sharing a scale length with an arbitrary preset id -
 * every one of the 9 legacy `NECK_PRESETS` shares its exact `scaleLengthMm`
 * with exactly one of the 4 `CURATED_NECK_PRESETS` by construction (that
 * table is "one per real scale length in use"), so this reliably turns a
 * legacy id into its curated equivalent. Falls back to the original id when
 * nothing matches (a genuinely custom scale length) - the caller then keeps
 * showing that id as-is, same as an already-open file naming a legacy id.
 */
function curatedNeckIdMatchingScaleLength(id: string, instrumentType: InstrumentType): string {
  const preset = NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id];
  if (!preset) return id;
  const match = offeredNeckPresets(instrumentType).find((n) => n.scaleLengthMm === preset.scaleLengthMm);
  return match?.id ?? id;
}

/**
 * The id/copy pair for starting a *new* project on `activeTemplateId` -
 * creating a document, or Switch Template/reset-to-baseline. `nativeNeckId`
 * is the template's own `neckPresetId`, one of the 9 legacy ids every
 * bundled blueprint embeds; this remaps it to its curated equivalent first
 * (so the Neck picker lands on one of the 4 offered choices, not a foreign
 * 5th row) and then applies the same per-body correction as
 * `neckPresetFieldsForTemplate`, using the body's own default
 * `NeckJointMechanism` (`DEFAULT_NECK_JOINT_MECHANISM`) - a no-op for
 * `nutToBodyEdgeMm` here by construction, since a bundled template's own
 * native pairing already reproduces its exact stored value; the pocket
 * fields do change from whatever the legacy preset's own numbers were to
 * the mechanism's generic ones, matching what the caller should separately
 * store as the project's own `neckJointMechanism` (see
 * `defaultNeckJointMechanism`).
 */
export function neckPresetFieldsForNewTemplate(
  nativeNeckId: string,
  activeTemplateId: string,
  instrumentType: InstrumentType
): Required<NeckRef> {
  return neckPresetFieldsForTemplate(
    curatedNeckIdMatchingScaleLength(nativeNeckId, instrumentType),
    activeTemplateId,
    defaultNeckJointMechanism(activeTemplateId),
    instrumentType
  );
}

/** The body's own real-world default `NeckJointMechanism`, or bolt-on for a custom/unrecognized body. */
export function defaultNeckJointMechanism(activeTemplateId: string): NeckJointMechanism {
  return DEFAULT_NECK_JOINT_MECHANISM[activeTemplateId] ?? FALLBACK_NECK_JOINT_MECHANISM;
}

/** As neckPresetFields, for the bridge. */
export function bridgePresetFields(id: string): Required<BridgeRef> {
  const preset = BRIDGE_PRESETS[id] ?? BRIDGE_PRESETS[DEFAULT_BRIDGE_PRESET_ID];
  return { bridgePresetId: id, bridgePreset: structuredClone(preset) };
}

/**
 * Rout dimensions for one pickup. The placement's own fields win; `type` only
 * supplies what is missing.
 *
 * Same hazard as the neck and bridge presets, and one extra: widthMm and
 * heightMm have always been *stored* on the placement but were never read -
 * every call site went to PICKUP_SPECIFICATIONS[type] instead. A file
 * therefore carried two answers for the size of a rout, and the obvious one to
 * read was the one nothing used. Reading the placement first collapses that to
 * one answer, and leaves room for a per-pickup size override later.
 *
 * A placement saved before `anchors` existed is a different case, not just a
 * missing field: its widthMm/heightMm described a simplified pickup-cover
 * outline, never a real cavity measurement, so there is no "declared size" of
 * the rout worth preserving - use the type's real catalogue rout entirely
 * (size and shape together) rather than reading a widthMm/heightMm that was
 * never the rout size to begin with, or scaling the real shape down to fit
 * it. This is the one place that decision has to live: every reader (canvas,
 * SVG export, the golden corpus) calls this function, not all of them go
 * through withEmbeddedPickupSpecs first.
 *
 * Defensive against missing fields despite the types: decoded JSON is not
 * checked at runtime, and a rout is a hole cut in a finished body.
 *
 * The `DEFAULT_PICKUP_TYPE` fallback here stays a *guitar* single coil, and
 * deliberately does not gain an instrument axis the way `addingPickup` did.
 * It is only reachable for a placement with no embedded anchors *and* a type
 * this build has never heard of - which means a file predating the anchors
 * field, and every one of those is Guitar/6, because that is all the schema
 * versions without an instrument axis could describe.
 */
export function resolvePickupSpec(placement: PickupPlacement): PickupRoutSpec {
  const defaults = PICKUP_SPECIFICATIONS[placement.type] ?? PICKUP_SPECIFICATIONS[DEFAULT_PICKUP_TYPE];
  if (!placement.anchors || placement.anchors.length === 0) {
    return { widthMm: defaults.widthMm, heightMm: defaults.heightMm, anchors: defaults.anchors };
  }
  return {
    widthMm: placement.widthMm ?? defaults.widthMm,
    heightMm: placement.heightMm ?? defaults.heightMm,
    anchors: placement.anchors,
  };
}

/**
 * Pre-split files used a single generic `'p90'` type. The rout survived
 * unchanged - widthMm/heightMm/anchors are the placement's own fields,
 * resolved above before any type-keyed default - but the type string itself
 * needs remapping to a real PickupType, or the inspector's dropdown has no
 * matching option to show selected. `'p90'` was always the soapbar shape
 * (see the old PICKUP_SPECIFICATIONS.p90 name).
 */
const LEGACY_PICKUP_TYPES: Record<string, PickupPlacement['type']> = {
  p90: 'p90_soapbar',
};

function migratedPickupType(type: string): PickupPlacement['type'] {
  return LEGACY_PICKUP_TYPES[type] ?? (type as PickupPlacement['type']);
}

/** Stamp each placement with its resolved rout and a current type string, leaving existing values alone. */
export function withEmbeddedPickupSpecs(pickups: PickupPlacement[]): PickupPlacement[] {
  return pickups.map((p) => {
    const type = migratedPickupType(p.type);
    return { ...p, type, ...structuredClone(resolvePickupSpec({ ...p, type })) };
  });
}

/**
 * The one resettable source for a body template's scale datum. A custom body
 * has no hidden generic answer: callers leave its local placement intact.
 */
export function documentedBlueprintNeckPlacement(project: Pick<GuitarProject,
  'activeTemplateId' | 'instrumentType'
>): NeckPlacement | undefined {
  const templateId = project.activeTemplateId;
  if (!templateId) return undefined;
  const jointToReferenceFretMm = FINGERBOARD_OVERHANG_MM[templateId];
  if (jointToReferenceFretMm === undefined) return undefined;
  return {
    mode: 'blueprint',
    referenceFret: fingerboardReferenceFret(project.instrumentType),
    jointToReferenceFretMm,
    provenance: `FINGERBOARD_OVERHANG_MM:${templateId}`,
  };
}

/**
 * Return the selected body template's locked joint profile when the product
 * has one. The S-style profile is documented by Fender drawing 019574. The
 * T-style profile is a clearly-labelled product definition: it intentionally
 * shares the S-style span, width stations, taper and 1/4 in deep fillets, but
 * uses a straight deep edge. It is unverified, never source provenance.
 */
export function blueprintNeckJointProfile(project: Pick<GuitarProject,
  'activeTemplateId' | 'instrumentType'
>): NeckJointGeometry | undefined {
  if ((project.activeTemplateId !== 's_style' && project.activeTemplateId !== 't_style')
    || project.instrumentType !== 'guitar') return undefined;
  const isSStyle = project.activeTemplateId === 's_style';
  // Keep the locked source-derived profile in its stated dimensions. The
  // editable construction default below derives the deep station from the
  // rounded 0.84° taper instead.
  const parameters = {
    mouthWidthMm: BOLT_ON_DEFAULT_MOUTH_WIDTH_MM,
    deepEndWidthMm: 55.88,
    planLengthMm: BOLT_ON_DEFAULT_PLAN_LENGTH_MM,
    endCornerRadiusMm: BOLT_ON_DEEP_CORNER_RADIUS_MM,
    endTreatment: isSStyle ? 'compound' as const : 'square' as const,
    endRoundnessMm: isSStyle ? BOLT_ON_CLOSING_ARC_RADIUS_MM : 0,
  };
  const snapshot = {
    id: isSStyle ? 's-style-1962-fender-019574-v1' : 't-style-product-straight-end-v1',
    name: isSStyle ? 'S-style 1962 compound pocket' : 'T-style straight-end pocket',
    mechanism: 'bolt_on' as const,
    planShape: 'bolt_on_pocket' as const,
    parameters,
    evidenceLevel: isSStyle ? 'documented' as const : 'unverified' as const,
    provenance: isSStyle
      ? 'Fender Vintage Stratocaster 1962 body, part 019574 (released 1982)'
      : 'Axe Shaper product geometry: S-style 76.2mm span, width stations, 0.84° taper and 6.35mm deep fillets; straight deep edge (2026-09-29)',
  };
  return {
    mode: 'locked',
    profileId: snapshot.id,
    mechanism: 'bolt_on',
    planShape: 'bolt_on_pocket',
    parameters,
    profileSnapshot: snapshot,
  };
}

/**
 * A bundled bass body's joint baseline: its frozen legacy pocket, expressed as
 * a numeric rout. Bass has no documented profile yet, so nothing here claims
 * more than the existing 63.5 x 98.425 mm (or R-style 40 mm) dimensions.
 */
function bundledBassJointBaseline(
  templateId: string,
): Pick<NeckJointGeometry, 'mechanism' | 'planShape' | 'parameters'> | undefined {
  if (!templateId.endsWith('_bass_style') || FINGERBOARD_OVERHANG_MM[templateId] === undefined) return undefined;
  const mechanism = defaultNeckJointMechanism(templateId);
  const templatePocket = TEMPLATE_NECK_POCKET_SPEC[templateId];
  const pocket = templatePocket?.mechanism === mechanism
    ? templatePocket
    : GENERIC_POCKET_SPEC.bass[mechanism];
  return {
    mechanism,
    planShape: mechanism === 'bolt_on' ? 'bolt_on_pocket' : 'straight_mortise',
    parameters: mechanism === 'bolt_on'
      ? rectangularBassBoltOnParameters(pocket.jointWidthMm, pocket.jointDepthMm, pocket.jointCornerRadiusMm)
      : {
          mouthWidthMm: pocket.jointWidthMm,
          planLengthMm: pocket.jointDepthMm,
          endCornerRadiusMm: pocket.jointCornerRadiusMm,
          endTreatment: 'square',
          endRoundnessMm: 0,
        },
  };
}

/** The authored reset target for every bundled template. */
export function blueprintNeckJointBaseline(project: Pick<GuitarProject,
  'activeTemplateId' | 'instrumentType'
>): NeckJointGeometry | undefined {
  const profile = blueprintNeckJointProfile(project);
  if (profile) return profile;
  const baseline = project.instrumentType === 'guitar'
    ? BUNDLED_GUITAR_JOINT_BASELINES[project.activeTemplateId]
    : bundledBassJointBaseline(project.activeTemplateId);
  if (!baseline) return undefined;
  return {
    mode: 'custom',
    derivedFromProfileId: `blueprint-baseline:${project.activeTemplateId}`,
    mechanism: baseline.mechanism,
    planShape: baseline.planShape,
    parameters: structuredClone(baseline.parameters),
  };
}

/**
 * Give a bundled guitar or bass its first explicit v7 joint contract. The S/T
 * templates carry their read-only bolt-on product profiles; every other
 * guitar retains its legacy dimensions as a conservative custom joint. In
 * both cases placement comes from the body template's existing datum, never
 * from a presumed common neck length.
 *
 * This is deliberately for product-owned blueprints and newly created
 * built-in designs. Loading an ordinary legacy file remains non-mutating
 * until its owner explicitly chooses Convert to Custom Joint.
 */
export function withBundledNeckJointContract(project: GuitarProject): GuitarProject {
  if (project.neckJointGeometry || project.neckPlacement) {
    return project;
  }
  const profile = blueprintNeckJointProfile(project);
  const placement = documentedBlueprintNeckPlacement(project);
  if (profile && placement) {
    return withEmbeddedPresets({
      ...project,
      neckJointMechanism: profile.mechanism,
      neckJointGeometry: profile,
      neckPlacement: placement,
    });
  }
  const converted = convertLegacyNeckJointToCustom(project);
  // These are product-owned blueprint baselines, not user-authored custom
  // work. Persist that distinction so a fresh built-in design starts with a
  // single Customize Joint action, while a saved custom joint reopens in its
  // numeric editor.
  return {
    ...converted,
    neckJointGeometry: {
      ...converted.neckJointGeometry!,
      derivedFromProfileId: `blueprint-baseline:${project.activeTemplateId}`,
    },
  };
}

/** A bundled blueprint has not entered joint editing until its baseline is explicitly customized. */
export function isBlueprintNeckJointBaseline(project: GuitarProject): boolean {
  const joint = project.neckJointGeometry;
  if (!joint) return false;
  if (joint.mode === 'locked') return true;
  return joint.derivedFromProfileId === `blueprint-baseline:${project.activeTemplateId}`;
}

/**
 * Make the template's starting joint locally editable. Locked S/T snapshots
 * become ordinary custom copies; the other guitar templates already carry a
 * conservative custom shape, so only their baseline marker changes.
 */
export function customizeBlueprintNeckJoint(project: GuitarProject): GuitarProject {
  const joint = project.neckJointGeometry;
  if (!joint || !isBlueprintNeckJointBaseline(project)) return project;
  if (joint.mode === 'locked') {
    const customJoint = { ...joint };
    const profileId = customJoint.profileId;
    delete customJoint.profileId;
    delete customJoint.profileSnapshot;
    delete customJoint.mouthAnchorIds;
    return withEmbeddedPresets({
      ...project,
      neckJointGeometry: {
        ...customJoint,
        mode: 'custom',
        derivedFromProfileId: profileId ?? `blueprint-profile:${project.activeTemplateId}`,
      },
    });
  }
  return withEmbeddedPresets({
    ...project,
    neckJointGeometry: {
      ...joint,
      derivedFromProfileId: `blueprint-custom:${project.activeTemplateId}`,
    },
  });
}

/**
 * v7 was revised before release: no joint rout owns contour anchors.
 * Normalise pre-revision local drafts on load/save, releasing the old named
 * anchors while preserving the numeric rout exactly.
 */
function decoupleNeckJointAttachment(project: StoredProject): StoredProject {
  const joint = project.neckJointGeometry;
  const attachedAnchorIDs = new Set(joint?.mouthAnchorIds ?? []);
  const hasLockedPocketAnchor = Boolean(joint) && project.contour.anchors.some((anchor) => (
    anchor.locked && (anchor.semanticRole === 'neck_pocket_left' || anchor.semanticRole === 'neck_pocket_right')
  ));
  if (!joint || (attachedAnchorIDs.size === 0 && !hasLockedPocketAnchor)) return project;
  const geometry = { ...joint };
  delete geometry.mouthAnchorIds;
  return {
    ...project,
    contour: {
      ...project.contour,
      anchors: project.contour.anchors.map((anchor) => (
        attachedAnchorIDs.has(anchor.id)
          || anchor.semanticRole === 'neck_pocket_left'
          || anchor.semanticRole === 'neck_pocket_right'
          ? { ...anchor, locked: false }
          : anchor
      )),
    },
    neckJointGeometry: geometry,
  };
}

/**
 * What a settings object must carry for the editor to dereference it. Mirrors
 * the literal in `createProject` (projectFactory.ts, which imports this module
 * and so cannot be imported here); `settingsDefaults.test.ts` pins the two
 * together. Only the required `ProjectSettings` fields: the optional
 * `show*` flags stay absent, because absent already means on.
 */
const SETTINGS_READ_DEFAULTS = {
  unitDisplay: 'mm',
  canvasOrientation: 'vertical',
  symmetry: { mode: 'none', sourceSide: 'left' },
  showCenterAxis: true,
  showGhostGuide: true,
  showHardwareCavities: true,
  showDimensions: true,
  showGrid: true,
  gridSizeMm: 50,
  snapToGridEnabled: false,
  finishStyle: 'sunburst',
  bodyColor: '#3b82f6',
  secondaryColor: '#f59e0b',
  bodyFillOpacity: 0.35,
  pickguardEnabled: true,
  pickguardColor: '#ffffff',
} as const;

/**
 * Fill in the `ProjectSettings` fields a file left out, and nothing else: a
 * value the file carries is kept verbatim, so a complete settings object comes
 * back as the same reference and a save does not change its bytes. iOS's
 * synthetic fixtures carry only name, unitDisplay, gridSizeMm and
 * snapToGrid; without this the editor dereferences `settings.symmetry.mode`
 * and the page goes blank.
 */
export function withSettingsDefaults(settings: GuitarProject['settings']): GuitarProject['settings'] {
  const missing = (Object.keys(SETTINGS_READ_DEFAULTS) as Array<keyof typeof SETTINGS_READ_DEFAULTS>)
    .filter((key) => settings[key] === undefined);
  if (missing.length === 0) return settings;
  const filled: Record<string, unknown> = { ...settings };
  for (const key of missing) filled[key] = structuredClone(SETTINGS_READ_DEFAULTS[key]);
  return filled as unknown as GuitarProject['settings'];
}

/**
 * Backfill the embedded presets and the instrument axis without disturbing
 * anything already there. Safe to call on a project of any schema version -
 * this is what turns a decoded `StoredProject` into a `GuitarProject`.
 */
export function withEmbeddedPresets(project: StoredProject): GuitarProject {
  project = decoupleNeckJointAttachment(project);
  if (project.jacks && project.jacks.length === 0) {
    // An empty list is the same document as none: drop it rather than write it.
    const { jacks: _emptyJacks, ...withoutJacks } = project;
    project = withoutJacks;
  }
  const instrumentDefaults = resolveInstrument(project);
  const instrumentType = project.instrumentType ?? instrumentDefaults.instrumentType;
  // A v7 joint is atomic. Validate it before resolving the output mirrors so
  // a malformed modern payload never silently falls back to legacy geometry.
  if (project.neckJointGeometry || project.neckPlacement || project.schemaVersion === 7) {
    validateNeckJointContract(project.neckJointGeometry, project.neckPlacement, instrumentType);
  }
  const resolvedNeck = resolveNeckPreset(project);
  const v7Joint = project.neckJointGeometry;
  const v7Placement = project.neckPlacement;
  const mirroredNeck = v7Joint && v7Placement
    ? {
        ...resolvedNeck,
        // Compatibility only: v7 readers never use these to resolve the
        // joint or placement. Older consumers retain a conservative bounding
        // rectangle rather than receiving stale, contradictory values.
        jointWidthMm: Math.max(v7Joint.parameters.mouthWidthMm, v7Joint.parameters.deepEndWidthMm ?? 0),
        jointDepthMm: v7Joint.parameters.planLengthMm,
        jointCornerRadiusMm: v7Joint.parameters.endTreatment === 'rounded'
          ? v7Joint.parameters.endRoundnessMm
          : v7Joint.parameters.endCornerRadiusMm,
        pocketWidthMm: Math.max(v7Joint.parameters.mouthWidthMm, v7Joint.parameters.deepEndWidthMm ?? 0),
        pocketDepthMm: v7Joint.parameters.planLengthMm,
        pocketCornerRadiusMm: v7Joint.parameters.endTreatment === 'rounded'
          ? v7Joint.parameters.endRoundnessMm
          : v7Joint.parameters.endCornerRadiusMm,
        nutToBodyEdgeMm: nutToBodyEdgeFromPlacement(v7Placement, resolvedNeck.scaleLengthMm),
        // The legacy mirror is also consumed by older 3D readers as the
        // fingerboard-end station. Keep it at least as far as v7's datum
        // fret while retaining a longer authored 24-fret end.
        nutToJointMm: Math.max(
          resolvedNeck.nutToJointMm,
          getFretDistanceFromNutMm(v7Placement.referenceFret, resolvedNeck.scaleLengthMm),
        ),
      }
    : resolvedNeck;
  return {
    ...project,
    // The lowest version that can describe what this payload actually holds,
    // not the newest this build knows (`requiredSchemaVersion`,
    // `constants/schema.ts`). Stamped here rather than only in
    // migrateProject() for the same reason the fields below are: this runs on
    // the way out too, so the version follows the document even when the
    // editor added an arched top to something loaded as version 3.
    schemaVersion: requiredSchemaVersion(project),
    // A version 1 or 2 file has neither field; both are Guitar/6 by
    // construction, since that is all the app could draw. Resolved here
    // rather than only in migrateProject() so that *saving* also stamps them:
    // exportProjectToSVG runs this over whatever it is handed.
    //
    // Defaults fill in what is *absent*; a value the file actually carried is
    // written back verbatim, including one this build does not recognise.
    // That is the "decode tolerantly" half of the rule - a save must not
    // quietly relabel an unknown instrument as a guitar - and it is why this
    // does not simply spread resolveInstrument(), which coerces.
    // migrateProject() is what stops such a payload reaching the editor.
    instrumentType,
    stringCount: project.stringCount ?? instrumentDefaults.stringCount,
    neckPreset: mirroredNeck,
    bridgePreset: resolveBridgePreset(project),
    // ?? [] rather than trusting the type: a hand-edited or foreign file can
    // omit this, and every consumer maps over it.
    pickups: withEmbeddedPickupSpecs(project.pickups ?? []),
    settings: withSettingsDefaults(project.settings),
    // pickguards/frontRoutes/backRoutes are deliberately NOT backfilled here,
    // unlike pickups: they're optional on GuitarProject precisely so a file
    // that predates them decodes with the key genuinely absent, and loading
    // it is a no-op (see the type's own comment). They pass through via the
    // ...project spread above; every reader guards with `?? []` instead.
  };
}

/**
 * Promote a legacy rectangle to the deliberately conservative v7 custom
 * joint. This is an explicit user action: loading a legacy document continues
 * to use the frozen legacy adapter and does not raise its format version.
 *
 * Its frozen legacy dimensions seed the numeric rout; the converted rout does
 * not attach to or reshape the body contour.
 * The template's recorded reference-fret overhang supplies placement where it
 * is available; a user template falls back to its already-resolved legacy
 * neck datum. Neither answer is guessed from the new plan shape.
 */
export function convertLegacyNeckJointToCustom(project: GuitarProject): GuitarProject {
  if (project.neckJointGeometry) return project;
  const mechanism = resolvedNeckJointMechanism(project);
  const neck = resolveNeckPreset(project);
  const templatePocket = TEMPLATE_NECK_POCKET_SPEC[project.activeTemplateId];
  const frozenPocket = templatePocket?.mechanism === mechanism
    ? templatePocket
    : GENERIC_POCKET_SPEC[project.instrumentType][mechanism];
  // `pocket*` is the iOS wire spelling. Prefer it where both compatibility
  // mirrors are present so legacy-to-custom conversion is cross-client stable.
  const mouthWidthMm = neck.pocketWidthMm ?? neck.jointWidthMm ?? frozenPocket.jointWidthMm;

  const referenceFret = fingerboardReferenceFret(project.instrumentType);
  // A bass is derived from its own datum at full precision. The table stores
  // 4dp, and a bass bridge is held to its approved theoretical line: a
  // rounded overhang would move the saddle ~5e-5mm just by converting.
  const jointToReferenceFretMm = project.instrumentType === 'bass'
    || FINGERBOARD_OVERHANG_MM[project.activeTemplateId] === undefined
    ? getFretDistanceFromNutMm(referenceFret, neck.scaleLengthMm) - neck.nutToBodyEdgeMm
    : FINGERBOARD_OVERHANG_MM[project.activeTemplateId];
  const planLengthMm = neck.pocketDepthMm ?? neck.jointDepthMm ?? frozenPocket.jointDepthMm;
  const geometry: NeckJointGeometry = {
    mode: 'custom',
    derivedFromProfileId: `legacy-frozen-adapter:${project.activeTemplateId}`,
    mechanism,
    planShape: mechanism === 'bolt_on' ? 'bolt_on_pocket' : 'straight_mortise',
    parameters: mechanism === 'bolt_on'
      ? (project.instrumentType === 'bass'
          ? rectangularBassBoltOnParameters(
              mouthWidthMm,
              planLengthMm,
              neck.pocketCornerRadiusMm ?? neck.jointCornerRadiusMm ?? frozenPocket.jointCornerRadiusMm,
            )
          : boltOnParametersForTemplate(project.activeTemplateId, mouthWidthMm, planLengthMm))
      : {
          mouthWidthMm,
          planLengthMm,
          endCornerRadiusMm: neck.pocketCornerRadiusMm ?? neck.jointCornerRadiusMm ?? frozenPocket.jointCornerRadiusMm,
          endTreatment: 'square',
          endRoundnessMm: 0,
        },
  };
  const placement = {
    mode: 'blueprint' as const,
    referenceFret,
    jointToReferenceFretMm,
    provenance: FINGERBOARD_OVERHANG_MM[project.activeTemplateId] === undefined
      ? `legacy-neck-datum:${project.activeTemplateId}`
      : `FINGERBOARD_OVERHANG_MM:${project.activeTemplateId}`,
  };
  return withEmbeddedPresets({
    ...project,
    neckJointMechanism: mechanism,
    neckJointGeometry: geometry,
    neckPlacement: placement,
  });
}

/**
 * Replace the construction of an already-custom joint. Bolt-on conversion
 * always starts from the two useful heel families: the T-style straight end,
 * or the rounded S-style compound end for every other body. This deliberately
 * replaces a glued mortise's dimensions: it resets the numeric mouth to
 * the shared bolt-on starting width, and derives the deep station from the
 * standard taper.
 */
export function changeCustomNeckJointMechanism(
  project: GuitarProject,
  mechanism: NeckJointMechanism,
): GuitarProject {
  const joint = project.neckJointGeometry;
  if (!joint || joint.mode !== 'custom') {
    throw new NeckJointContractError('Convert the neck joint to Custom before changing its construction.');
  }
  if (joint.mechanism === mechanism) return project;
  const returningToTemplateDefault = mechanism === defaultNeckJointMechanism(project.activeTemplateId);
  const templateDefault = returningToTemplateDefault
    ? neckPresetFieldsForTemplate(
        project.neckPresetId,
        project.activeTemplateId,
        mechanism,
        project.instrumentType,
      ).neckPreset
    : undefined;
  const parameters = mechanism === 'bolt_on'
    ? defaultBoltOnParametersForTemplate(project.activeTemplateId, project.instrumentType)
    : {
        mouthWidthMm: templateDefault?.jointWidthMm ?? joint.parameters.mouthWidthMm,
        planLengthMm: templateDefault?.jointDepthMm ?? joint.parameters.planLengthMm,
        endCornerRadiusMm: templateDefault?.jointCornerRadiusMm ?? joint.parameters.endCornerRadiusMm,
        endTreatment: 'square' as const,
        endRoundnessMm: 0,
      };
  const replacement: NeckJointGeometry = {
    ...joint,
    mechanism,
    planShape: mechanism === 'bolt_on' ? 'bolt_on_pocket' : 'straight_mortise',
    parameters,
    neckAngleDegrees: mechanism === 'bolt_on' ? undefined : joint.neckAngleDegrees,
  };
  const resized = updateCustomNeckJoint(replacement, {});
  return withEmbeddedPresets({
    ...project,
    neckJointMechanism: mechanism,
    neckJointGeometry: resized,
  });
}

/**
 * A payload this build must not edit. Thrown by `migrateProject()`, which is
 * the one door into the editable project path; `loadProject()` turns it into
 * a message for the UI. `reason` is for callers that want to react
 * differently (a viewer could still render a future-version file); `message`
 * is written to be shown to a person as-is.
 */
export class UnsupportedProjectError extends Error {
  readonly reason: 'unsupported-version' | 'unsupported-instrument' | 'malformed-neck-joint';

  constructor(reason: UnsupportedProjectError['reason'], message: string) {
    super(message);
    this.name = 'UnsupportedProjectError';
    this.reason = reason;
  }
}

/**
 * Bring a project loaded from a file up to the current schema, or refuse it.
 *
 * A version 1 file has ids but no embedded presets; resolving them against
 * this build's table is the best available answer and matches what version 1
 * readers did implicitly. A version 1 or 2 file also has no instrument axis,
 * and becomes Guitar/6.
 *
 * Two payloads are refused rather than migrated, and refusing here rather
 * than at each call site is the point - this function is the only way into
 * the editable project path:
 *
 * - **A future schema version.** Before version 3 there was no gate at all:
 *   this function stamped `PROJECT_SCHEMA_VERSION` unconditionally, so a
 *   version 4 file was accepted, edited and written back out as version 2,
 *   discarding whatever the newer writer knew. Viewing or exporting such a
 *   file may become safe later; editing it never is.
 * - **An instrument this build cannot draw**, meaning an unrecognised
 *   `instrumentType` or a known type with a string count outside
 *   `SUPPORTED_STRING_COUNTS`. Opening a Bass/5 file as if it were a Bass/4
 *   would put the outer strings, and anything derived from their spacing, in
 *   the wrong place on a drawing whose whole purpose is to be printed 1:1 and
 *   cut.
 */
export function migrateProject(project: StoredProject): GuitarProject {
  if (!isSupportedSchemaVersion(project.schemaVersion)) {
    throw new UnsupportedProjectError(
      'unsupported-version',
      `This design was saved by a newer version of Axe Shaper (file format ${String(
        project.schemaVersion
      )}; this build reads up to ${PROJECT_SCHEMA_VERSION}). Update the app to open it.`
    );
  }

  // Only a version 3+ payload can carry these fields, so this validates what
  // a file actually claims rather than what the migration defaults supply.
  if (project.instrumentType !== undefined && !isInstrumentType(project.instrumentType)) {
    throw new UnsupportedProjectError(
      'unsupported-instrument',
      `This design is for an instrument this build doesn't support (${String(project.instrumentType)}).`
    );
  }

  const instrument = resolveInstrument(project);
  if (!isSupportedInstrument(instrument.instrumentType, instrument.stringCount)) {
    throw new UnsupportedProjectError(
      'unsupported-instrument',
      `This design is a ${instrument.stringCount}-string ${instrument.instrumentType}, which this build doesn't support yet.`
    );
  }

  // withEmbeddedPresets() stamps the version, because it is also what runs on
  // the way out. A migrated version 1 or 2 payload therefore lands at 3 - the
  // fields that function backfills - and climbs only if the document itself
  // uses a version 4 or 5 field.
  try {
    return withEmbeddedPresets(project);
  } catch (error) {
    if (error instanceof NeckJointContractError) {
      throw new UnsupportedProjectError('malformed-neck-joint', `This version 7 neck-joint data is invalid: ${error.message}`);
    }
    throw error;
  }
}

/** What `loadProject()` returns: a project ready to edit, or why not. */
export type ProjectLoadResult =
  | { ok: true; project: GuitarProject }
  | { ok: false; reason: UnsupportedProjectError['reason'] | 'unreadable'; message: string };

/**
 * The read boundary for every path that opens a document - Open File, a
 * `?plan=` link, a drop. Wraps `migrateProject()` so a refusal is a value the
 * caller can show rather than an exception it has to remember to catch, and
 * so the "is this even a project" shape check lives next to the version and
 * instrument checks instead of being repeated at each call site.
 */
export function loadProject(stored: StoredProject | null | undefined): ProjectLoadResult {
  if (!stored || !stored.contour || !stored.settings) {
    return { ok: false, reason: 'unreadable', message: 'This file does not contain Axe Shaper project data.' };
  }
  try {
    return { ok: true, project: migrateProject(stored) };
  } catch (error) {
    if (error instanceof UnsupportedProjectError) {
      return { ok: false, reason: error.reason, message: error.message };
    }
    throw error;
  }
}
