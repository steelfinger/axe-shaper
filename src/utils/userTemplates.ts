import type {
  EdgeProfile,
  InstrumentType,
  LengthMm,
  PathAnchor,
  PickupPlacement,
  PickguardPlacement,
  RoutedCavity,
} from '../types/guitar';
import { LEGACY_INSTRUMENT_TYPE, defaultStringCount, isInstrumentType } from './instrument';

/**
 * A user-saved starting point, structurally the same fields as
 * ReferenceTemplate needs to be usable by handleSelectTemplate - so the two
 * can be looked up and applied through one code path.
 */
export interface UserTemplate {
  id: string;
  name: string;
  /**
   * Which instrument this template is for. Optional, and this is the one
   * place in the app where that is a genuine hazard rather than a formality:
   * `UserTemplate` has no version field to migrate on, and unlike a .axe.svg
   * it stores hardware as preset **ids only**, with no embedded copy - so a
   * bass template resolves its neck and bridge purely through the catalogue,
   * the one path where "the embedded copy wins" cannot rescue a wrong lookup.
   *
   * Records already in localStorage carry neither field. Reads default them
   * to Guitar/6 via `userTemplateInstrument()`; templates saved from here on
   * carry both. Nothing rewrites existing records - that would be a migration
   * with no version to key it on.
   */
  instrumentType?: InstrumentType;
  stringCount?: number;
  neckPresetId: string;
  bridgePresetId: string;
  defaultAnchors: PathAnchor[];
  edgeProfile?: EdgeProfile;
  bodyThicknessMm?: LengthMm;
  defaultPickups: PickupPlacement[];
  defaultPickguards?: PickguardPlacement[];
  defaultFrontRoutes?: RoutedCavity[];
  defaultBackRoutes?: RoutedCavity[];
  createdAt: string;
}

const STORAGE_KEY = 'axe-shaper:user-templates';

export function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(templates: UserTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function saveUserTemplate(template: UserTemplate): UserTemplate[] {
  const templates = [...loadUserTemplates().filter((t) => t.id !== template.id), template];
  persist(templates);
  return templates;
}

export function deleteUserTemplate(id: string): UserTemplate[] {
  const templates = loadUserTemplates().filter((t) => t.id !== id);
  persist(templates);
  return templates;
}

export function getUserTemplate(id: string): UserTemplate | undefined {
  return loadUserTemplates().find((t) => t.id === id);
}

/**
 * A stored template's instrument axis, defaulted when absent. Untagged
 * records predate the instrument axis, and every template saved before it was
 * a six-string guitar - the app could not draw anything else - so this is a
 * default-when-absent read, not a guess. An unrecognised stored string is
 * treated the same way rather than trusted, since nothing validated it on the
 * way in.
 */
export function userTemplateInstrument(
  template: Pick<UserTemplate, 'instrumentType' | 'stringCount'>
): { instrumentType: InstrumentType; stringCount: number } {
  const instrumentType = isInstrumentType(template.instrumentType)
    ? template.instrumentType
    : LEGACY_INSTRUMENT_TYPE;
  return {
    instrumentType,
    stringCount:
      typeof template.stringCount === 'number' && Number.isFinite(template.stringCount)
        ? template.stringCount
        : defaultStringCount(instrumentType),
  };
}
