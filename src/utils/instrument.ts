import {
  BRIDGE_PRESET_INSTRUMENT,
  NECK_PRESET_INSTRUMENT,
  PICKUP_TYPE_INSTRUMENT,
} from '../constants/hardware';
import type { InstrumentType, PickupType, StoredProject } from '../types/guitar';

/**
 * The instrument axis: which instruments exist, how many strings each may
 * have, and how to read those two facts off a project that may predate them.
 *
 * Kept in one module, importing nothing but the catalogue's compatibility
 * side-tables and the types, because three other modules need it and one of
 * them (`utils/presets.ts`) is already at the centre of an import graph that
 * has a real cycle hazard in it (see `FINGERBOARD_OVERHANG_MM`'s comment in
 * `constants/hardware.ts`).
 */

/** Display order for the instrument picker; also the set of known wire values. */
export const INSTRUMENT_TYPES: readonly InstrumentType[] = ['guitar', 'bass'];

/**
 * What a schema version 1 or 2 file is. Those files predate the instrument
 * axis entirely, and every one of them is a six-string guitar - the app could
 * not draw anything else - so this is a default-when-absent read, not a guess.
 */
export const LEGACY_INSTRUMENT_TYPE: InstrumentType = 'guitar';

/**
 * The supported instrument/string-count matrix for this release: Guitar/6 and
 * Bass/4. Five-string basses, seven-string guitars and multiscale are
 * explicitly deferred (docs/BASS_BODY_DESIGN_MILESTONES.md), so a version 3
 * file claiming a known type with a count that is not listed here is rejected
 * rather than opened - see `migrateProject()`.
 *
 * Arrays rather than single values because the follow-ups add counts to an
 * existing type; nothing outside this table should hardcode 6 or 4.
 */
export const SUPPORTED_STRING_COUNTS: Record<InstrumentType, readonly number[]> = {
  guitar: [6],
  bass: [4],
};

/** The string count a new design of this type starts with. */
export function defaultStringCount(type: InstrumentType): number {
  return SUPPORTED_STRING_COUNTS[type][0];
}

export function isInstrumentType(value: unknown): value is InstrumentType {
  return typeof value === 'string' && (INSTRUMENT_TYPES as readonly string[]).includes(value);
}

/** Whether this build supports designing this instrument with this many strings. */
export function isSupportedInstrument(type: InstrumentType, stringCount: number): boolean {
  return SUPPORTED_STRING_COUNTS[type].includes(stringCount);
}

/** Sentence-case label for UI copy: "Guitar" / "Bass". */
export function instrumentLabel(type: InstrumentType): string {
  return type === 'bass' ? 'Bass' : 'Guitar';
}

/**
 * The instrument a decoded payload describes. Absent fields mean a version 1
 * or 2 file, which is Guitar/6; an unrecognised `instrumentType` string is
 * *not* silently coerced here - `migrateProject()` rejects those before they
 * reach the editor, and this function is not the place to decide that a file
 * this build does not understand is a guitar.
 */
export function resolveInstrument(
  project: Pick<StoredProject, 'instrumentType' | 'stringCount'>
): { instrumentType: InstrumentType; stringCount: number } {
  const instrumentType = isInstrumentType(project.instrumentType)
    ? project.instrumentType
    : LEGACY_INSTRUMENT_TYPE;
  const stringCount =
    typeof project.stringCount === 'number' && Number.isFinite(project.stringCount)
      ? project.stringCount
      : defaultStringCount(instrumentType);
  return { instrumentType, stringCount };
}

/**
 * Catalogue compatibility: which instrument each *catalogue id* belongs to.
 *
 * This is metadata about the tables, not about any one project's hardware -
 * "the embedded preset remains the physical source of truth" is unchanged, so
 * these never take part in resolving a file's geometry. They exist so a
 * picker can refuse to offer a 34" bass neck for a guitar, and so the golden
 * corpus can skip meaningless neck x bridge pairings.
 *
 * `undefined` for an id this build has never heard of: an unknown id is not a
 * guitar by default, it is simply not in the catalogue, and a caller filtering
 * a list has nothing to offer for it. Files naming unknown ids still open -
 * their embedded copy wins - and that path never comes through here.
 */
export function neckPresetInstrument(id: string): InstrumentType | undefined {
  return NECK_PRESET_INSTRUMENT[id];
}

export function bridgePresetInstrument(id: string): InstrumentType | undefined {
  return BRIDGE_PRESET_INSTRUMENT[id];
}

export function pickupTypeInstrument(type: PickupType): InstrumentType | undefined {
  return PICKUP_TYPE_INSTRUMENT[type];
}
