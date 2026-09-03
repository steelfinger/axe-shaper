import type { ReferenceTemplate } from '../types/guitar';
import { defaultStringCount } from '../utils/instrument';
import { PICKUP_SPECIFICATIONS } from './hardware';
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
      // Derived, not stored per entry: the supported string counts per
      // instrument are one table (`utils/instrument.ts`), and a manifest that
      // could disagree with it would be a second answer to the same question.
      stringCount: defaultStringCount(manifestEntry.instrumentType),
      neckPresetId: project.neckPresetId,
      bridgePresetId: project.bridgePresetId,
      defaultAnchors: project.contour.anchors,
      // Keep the profile with the outline: per-anchor bevelIntensity values
      // only have meaning against the blueprint's own Beveled/German-Carve
      // dimensions. An absent profile deliberately means Slab.
      edgeProfile: project.edgeProfile,
      // Thickness is authored alongside the outline and edge treatment. The
      // 3D viewer already reads this field; omitting it here made every
      // blueprint-created project fall back to 45mm, including the 35mm SG.
      bodyThicknessMm: project.bodyThicknessMm,
      // Binding is a body-level blueprint choice, just like its edge
      // treatment. Preserve it so new designs and the 3D viewer handoff use
      // the blueprint's intended top-only or two-sided binding.
      binding: project.binding,
      // Position and orientation are authored by the blueprint; the rout
      // geometry comes from the live catalogue. Blueprint SVGs are durable
      // documents and may contain an older embedded anchor set, whereas a
      // built-in template is expected to pick up an approved catalogue
      // correction such as a newly traced pickup cavity. This deliberate
      // exception does not apply to user-saved projects, whose embedded rout
      // geometry remains authoritative.
      defaultPickups: project.pickups.map((pickup) => {
        const spec = PICKUP_SPECIFICATIONS[pickup.type];
        return spec ? { ...pickup, ...structuredClone(spec) } : pickup;
      }),
      // `?? []` - no bundled blueprint carries these yet, and
      // extractProjectFromSVG does a raw JSON.parse with no field defaulting.
      defaultPickguards: project.pickguards ?? [],
      defaultFrontRoutes: project.frontRoutes ?? [],
      defaultBackRoutes: project.backRoutes ?? [],
    };
  }

  return templates;
}

export const REFERENCE_TEMPLATES: Record<string, ReferenceTemplate> = buildReferenceTemplates();
