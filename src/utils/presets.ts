import {
  BRIDGE_PRESETS,
  CURATED_NECK_PRESETS,
  DEFAULT_NECK_JOINT_MECHANISM,
  FINGERBOARD_OVERHANG_MM,
  GENERIC_POCKET_SPEC,
  NECK_PRESETS,
  PICKUP_SPECIFICATIONS,
} from '../constants/hardware';
import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import type {
  BridgePreset,
  GuitarProject,
  NeckJointMechanism,
  NeckPreset,
  PickupPlacement,
  PickupRoutSpec,
} from '../types/guitar';
import { getFretDistanceFromNutMm } from './scaleMath';

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
export const DEFAULT_PICKUP_TYPE = 'single_coil';
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
  project: Pick<GuitarProject, 'neckJointMechanism' | 'activeTemplateId'>
): NeckJointMechanism {
  return (
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
 *   `GENERIC_POCKET_SPEC[mechanism]`, never from the chosen preset's own
 *   stored pocket fields - pocket shape is mechanism-owned, not neck-owned
 *   (see `GENERIC_POCKET_SPEC`'s own comment for why), applied
 *   unconditionally because `mechanism` always has a concrete value by the
 *   time it reaches this function (the caller resolves it, typically via
 *   `resolvedNeckJointMechanism`).
 */
export function neckPresetFieldsForTemplate(
  id: string,
  activeTemplateId: string,
  mechanism: NeckJointMechanism
): Required<NeckRef> {
  const base = NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id] ?? NECK_PRESETS[DEFAULT_NECK_PRESET_ID];
  const overhang = FINGERBOARD_OVERHANG_MM[activeTemplateId];
  const nutToBodyEdgeMm =
    overhang === undefined ? base.nutToBodyEdgeMm : getFretDistanceFromNutMm(22, base.scaleLengthMm) - overhang;
  const pocket = GENERIC_POCKET_SPEC[mechanism];
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
 * The curated neck sharing a scale length with an arbitrary preset id -
 * every one of the 9 legacy `NECK_PRESETS` shares its exact `scaleLengthMm`
 * with exactly one of the 4 `CURATED_NECK_PRESETS` by construction (that
 * table is "one per real scale length in use"), so this reliably turns a
 * legacy id into its curated equivalent. Falls back to the original id when
 * nothing matches (a genuinely custom scale length) - the caller then keeps
 * showing that id as-is, same as an already-open file naming a legacy id.
 */
function curatedNeckIdMatchingScaleLength(id: string): string {
  const preset = NECK_PRESETS[id] ?? CURATED_NECK_PRESETS[id];
  if (!preset) return id;
  const match = Object.values(CURATED_NECK_PRESETS).find((n) => n.scaleLengthMm === preset.scaleLengthMm);
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
export function neckPresetFieldsForNewTemplate(nativeNeckId: string, activeTemplateId: string): Required<NeckRef> {
  return neckPresetFieldsForTemplate(
    curatedNeckIdMatchingScaleLength(nativeNeckId),
    activeTemplateId,
    defaultNeckJointMechanism(activeTemplateId)
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
 * Defensive against missing fields despite the types: decoded JSON is not
 * checked at runtime, and a rout is a hole cut in a finished body.
 */
export function resolvePickupSpec(placement: PickupPlacement): PickupRoutSpec {
  const defaults = PICKUP_SPECIFICATIONS[placement.type] ?? PICKUP_SPECIFICATIONS[DEFAULT_PICKUP_TYPE];
  return {
    widthMm: placement.widthMm ?? defaults.widthMm,
    heightMm: placement.heightMm ?? defaults.heightMm,
    cornerRadiusMm: placement.cornerRadiusMm ?? defaults.cornerRadiusMm,
  };
}

/** Stamp each placement with its resolved rout, leaving existing values alone. */
export function withEmbeddedPickupSpecs(pickups: PickupPlacement[]): PickupPlacement[] {
  return pickups.map((p) => ({ ...p, ...resolvePickupSpec(p) }));
}

/**
 * Backfill the embedded presets without disturbing any that are already there.
 * Safe to call on a project of any schema version.
 */
export function withEmbeddedPresets(project: GuitarProject): GuitarProject {
  return {
    ...project,
    neckPreset: resolveNeckPreset(project),
    bridgePreset: resolveBridgePreset(project),
    // ?? [] rather than trusting the type: a hand-edited or foreign file can
    // omit this, and every consumer maps over it.
    pickups: withEmbeddedPickupSpecs(project.pickups ?? []),
    // pickguards/frontRoutes/backRoutes are deliberately NOT backfilled here,
    // unlike pickups: they're optional on GuitarProject precisely so a file
    // that predates them decodes with the key genuinely absent, and loading
    // it is a no-op (see the type's own comment). They pass through via the
    // ...project spread above; every reader guards with `?? []` instead.
  };
}

/**
 * Bring a project loaded from a file up to the current schema. A version 1
 * file has ids but no embedded presets; resolving them against this build's
 * table is the best available answer and matches what version 1 readers did
 * implicitly.
 */
export function migrateProject(project: GuitarProject): GuitarProject {
  return {
    ...withEmbeddedPresets(project),
    schemaVersion: PROJECT_SCHEMA_VERSION,
  };
}
