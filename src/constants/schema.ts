/**
 * Version of the project payload embedded in a .axe.svg file.
 *
 * The file format - not the code - is the contract between this app and any
 * other implementation (an iPad build, a future Android build). Anything that
 * changes the meaning of a saved field belongs here, with a note, so a second
 * implementation can tell what it is looking at.
 *
 * History:
 *   1 - Initial format. Hardware is referenced by id only (`neckPresetId`,
 *       `bridgePresetId`), resolved against whatever table the reading app
 *       happens to ship.
 *   2 - Adds `neckPreset` / `bridgePreset`: the full resolved presets, stored
 *       alongside the ids. The file now carries the geometry it was drawn
 *       with, so a reader that has never heard of the id still places the
 *       bridge correctly instead of silently falling back to a default. Ids
 *       are kept for UI selection and round-tripping. Version 1 files load
 *       unchanged - migrateProject() backfills the presets from the id.
 *   3 - Adds the instrument axis: `instrumentType` ('guitar' | 'bass') and
 *       `stringCount`, both required and both project-level. Hardware
 *       compatibility is derived from the pair; neither is duplicated inside
 *       the embedded neck or bridge, where two copies could disagree. The
 *       supported matrix is Guitar/6 and Bass/4 (`SUPPORTED_STRING_COUNTS`,
 *       `utils/instrument.ts`); a version 3 payload outside it is rejected
 *       rather than opened. Version 1 and 2 files decode as Guitar/6 -
 *       nothing else was drawable - and migrateProject() backfills them.
 *
 *       Also reserves three optional hardware measurements under the
 *       spellings axe-shaper-ios already uses, so both sides can start
 *       writing them at this version: `BridgePreset.stringSpacingMm`,
 *       `BridgePreset.heightMm` and `NeckPreset.nutStringSpacingMm`. Both
 *       string-spacing fields are the *total spread* across all strings, not
 *       the per-string pitch (docs/AXE_SVG_FORMAT.md).
 *   4 - Adds independently placed potentiometers and selector switches.
 *       Potentiometers store a 24mm default body diameter but draw only their
 *       knob during normal editing; switch types are Gibson toggle and Fender
 *       blade. Electrical values and switch state are intentionally absent.
 *
 *       Note that the version bump is not a bass-only event: from this build
 *       on, every saved *guitar* project is version 3 too, and reaches iOS
 *       and the 3D viewer as version 3.
 *   5 - Adds the optional `bodyTop.construction` choice. `carved_cap` and
 *       `solid_body_carve` select application-owned construction profiles for
 *       the 3D preview; their numeric carve and neck-placement defaults are
 *       deliberately not independent document fields. An absent `bodyTop`
 *       remains the existing flat body, including old `edgeProfile.kind =
 *       carved_top` payloads.
 */
export const PROJECT_SCHEMA_VERSION = 5;

/**
 * The oldest payload this build can read. Nothing has been dropped yet, so
 * every version from 1 up is still openable; the constant exists so the day
 * something is dropped there is one place to say so.
 */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Whether this build understands a payload well enough to *edit* it.
 *
 * A payload from a future version may name fields that change what existing
 * ones mean. Editing one and saving it back would rewrite it as if this build
 * understood it - silently discarding whatever the newer writer knew - so a
 * future version is refused at the read boundary instead. Version 3 is the
 * first release with any such gate; before it, `extractProjectFromSVG` did a
 * bare `JSON.parse` and `migrateProject` unconditionally stamped the current
 * version, so a version 4 file would have been accepted, edited and saved
 * back out as version 2.
 */
export function isSupportedSchemaVersion(version: unknown): version is number {
  return (
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version >= MIN_SUPPORTED_SCHEMA_VERSION &&
    version <= PROJECT_SCHEMA_VERSION
  );
}
