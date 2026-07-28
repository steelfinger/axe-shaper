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
 */
export const PROJECT_SCHEMA_VERSION = 2;
