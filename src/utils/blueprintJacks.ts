import table from '../constants/blueprints/blueprint-jacks.json' with { type: 'json' };
import type { OutputJackPlacement, PickguardPlacement, PotentiometerPlacement } from '../types/guitar';

/**
 * Output jacks for the bundled blueprints (schema 8).
 *
 * They live in `constants/blueprints/blueprint-jacks.json`, not in the
 * blueprint files, on purpose: a blueprint that carried a jack would stamp
 * every new design from it 8, and until an iPad release that reads 8 is live
 * that file is read-only on the iPad. So the data is applied here, only while
 * `OUTPUT_JACKS_ENABLED`, and the blueprint files stay at 7. The same JSON is
 * synced to axe-shaper-ios (`Scripts/sync-contract.sh`), which applies it
 * behind its own gate in `BlueprintLibrary.load`.
 */
interface BlueprintJackEntry {
  jacks?: OutputJackPlacement[];
  removePotentiometerIds?: string[];
  addPickguards?: PickguardPlacement[];
}

export interface BlueprintJackParts {
  potentiometers: PotentiometerPlacement[];
  pickguards: PickguardPlacement[];
  jacks: OutputJackPlacement[];
}

const ENTRIES = (table as { blueprints: Record<string, BlueprintJackEntry> }).blueprints;

/**
 * What a blueprint's hardware becomes once its jack is placed: the jacks, the
 * potentiometers that the jack replaces removed, and any extra pickguard (the
 * Flying V's round jack guard) appended. Returns the input untouched when
 * disabled or when the blueprint has no entry.
 */
export function applyBlueprintJacks(
  templateId: string,
  parts: BlueprintJackParts,
  enabled: boolean
): BlueprintJackParts {
  const entry = enabled ? ENTRIES[templateId] : undefined;
  if (!entry) return parts;
  const removed = new Set(entry.removePotentiometerIds ?? []);
  const existingGuardIds = new Set(parts.pickguards.map((guard) => guard.id));
  return {
    jacks: structuredClone(entry.jacks ?? []),
    potentiometers: parts.potentiometers.filter((pot) => !removed.has(pot.id)),
    pickguards: [
      ...parts.pickguards,
      ...structuredClone(entry.addPickguards ?? []).filter((guard) => !existingGuardIds.has(guard.id)),
    ],
  };
}

export function blueprintJackIds(): string[] {
  return Object.keys(ENTRIES);
}
