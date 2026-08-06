import { BRIDGE_PRESETS, NECK_PRESETS, PICKUP_SPECIFICATIONS } from '../constants/hardware';
import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import type {
  BridgePreset,
  GuitarProject,
  NeckPreset,
  PickupPlacement,
  PickupRoutSpec,
} from '../types/guitar';

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

type NeckRef = Pick<GuitarProject, 'neckPresetId' | 'neckPreset'>;
type BridgeRef = Pick<GuitarProject, 'bridgePresetId' | 'bridgePreset'>;

/** Effective neck geometry: the project's embedded copy, else the built-in table, else the default. */
export function resolveNeckPreset(ref: NeckRef): NeckPreset {
  return ref.neckPreset ?? NECK_PRESETS[ref.neckPresetId] ?? NECK_PRESETS[DEFAULT_NECK_PRESET_ID];
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
  const preset = NECK_PRESETS[id] ?? NECK_PRESETS[DEFAULT_NECK_PRESET_ID];
  return { neckPresetId: id, neckPreset: structuredClone(preset) };
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
