import type { PathAnchor, PickupPlacement } from '../types/guitar';

/**
 * A user-saved starting point, structurally the same fields as
 * ReferenceTemplate needs to be usable by handleSelectTemplate - so the two
 * can be looked up and applied through one code path.
 */
export interface UserTemplate {
  id: string;
  name: string;
  neckPresetId: string;
  bridgePresetId: string;
  defaultAnchors: PathAnchor[];
  defaultPickups: PickupPlacement[];
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
