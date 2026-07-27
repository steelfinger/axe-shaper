import type { ReferenceTemplate } from '../types/guitar';
import { extractProjectFromSVG } from '../utils/svgExporter';
import { BLUEPRINT_MANIFEST, BLUEPRINT_ORDER } from './blueprintManifest';

// Each built-in blueprint is a real .axe.svg file - the same format Save
// produces - so it can be authored in the app itself instead of hand-edited
// as a TypeScript array. See blueprintManifest.ts for how the id maps to a
// file here and to its sidebar description/category/tier.
const blueprintFiles = import.meta.glob('./blueprints/*.axe.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function idFromPath(path: string): string | null {
  return path.match(/([^/]+)\.axe\.svg$/)?.[1] ?? null;
}

const rawById = new Map<string, string>();
for (const [path, raw] of Object.entries(blueprintFiles)) {
  const id = idFromPath(path);
  if (id) rawById.set(id, raw);
}

function buildReferenceTemplates(): Record<string, ReferenceTemplate> {
  const templates: Record<string, ReferenceTemplate> = {};

  for (const id of BLUEPRINT_ORDER) {
    const raw = rawById.get(id);
    const manifestEntry = BLUEPRINT_MANIFEST[id];
    if (!raw || !manifestEntry) {
      console.error(`Blueprint "${id}" is missing its .axe.svg file or manifest entry - skipping.`);
      continue;
    }

    const project = extractProjectFromSVG(raw);
    if (!project) {
      console.error(`Blueprint "${id}" could not be decoded from blueprints/${id}.axe.svg - skipping.`);
      continue;
    }

    templates[id] = {
      id,
      name: project.settings.name,
      ...manifestEntry,
      neckPresetId: project.neckPresetId,
      bridgePresetId: project.bridgePresetId,
      defaultAnchors: project.contour.anchors,
      defaultPickups: project.pickups,
    };
  }

  return templates;
}

export const REFERENCE_TEMPLATES: Record<string, ReferenceTemplate> = buildReferenceTemplates();
