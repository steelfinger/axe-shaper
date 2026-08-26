import { REFERENCE_TEMPLATES } from '../constants/templates';
import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import type { GuitarProject, InstrumentType, ReferenceTemplate } from '../types/guitar';
import { defaultStringCount } from './instrument';
import { bridgePresetFields, defaultNeckJointMechanism, neckPresetFieldsForNewTemplate } from './presets';
import { getUserTemplate, userTemplateInstrument } from './userTemplates';

/**
 * The one place a new project is constructed.
 *
 * It used to be a module-level `INITIAL_PROJECT` literal in `App.tsx`, which
 * had two problems beyond not taking a blueprint: it hardcoded the S-style
 * body, and it was evaluated at *import* time, so `metadata.created` was the
 * timestamp of the page load rather than of the project. Both go away here.
 *
 * The instrument axis comes from the chosen blueprint, not from a parameter -
 * a body belongs to exactly one instrument, so letting a caller pass a
 * conflicting `instrumentType` would create a second answer to a question the
 * blueprint already settles. The New Design screen (milestone W3) picks the
 * *blueprint*; the Guitar/Bass control there filters which blueprints it can
 * pick from.
 */

/** The blueprint a new design starts on when the caller has no opinion. */
export const DEFAULT_TEMPLATE_ID = 's_style';

export const DEFAULT_APP_VERSION = '1.0.0';
export const DEFAULT_AUTHOR = 'Axe Shaper Luthier';

interface CreateProjectOptions {
  /** A built-in blueprint id or a user template id. Defaults to `DEFAULT_TEMPLATE_ID`. */
  templateId?: string;
  /** Overrides the `Custom <blueprint name>` default. */
  name?: string;
  author?: string;
  /** Injectable so tests and fixtures can pin a timestamp. */
  now?: () => Date;
}

type TemplateSource = Pick<
  ReferenceTemplate,
  | 'name'
  | 'neckPresetId'
  | 'bridgePresetId'
  | 'defaultAnchors'
  | 'edgeProfile'
  | 'defaultPickups'
  | 'defaultPickguards'
  | 'defaultFrontRoutes'
  | 'defaultBackRoutes'
> & { instrumentType: InstrumentType; stringCount: number };

/**
 * The template a new project starts from, as a built-in blueprint or a
 * user-saved one, falling back to the default blueprint for an id neither
 * table knows. A user template carries no instrument axis on disk (see
 * `utils/userTemplates.ts`), so its instrument is a default-when-absent read.
 */
function templateSource(templateId: string): TemplateSource {
  const builtIn = REFERENCE_TEMPLATES[templateId];
  if (builtIn) return builtIn;

  const saved = getUserTemplate(templateId);
  if (saved) return { ...saved, ...userTemplateInstrument(saved) };

  return REFERENCE_TEMPLATES[DEFAULT_TEMPLATE_ID];
}

export function createProject(options: CreateProjectOptions = {}): GuitarProject {
  const templateId = options.templateId ?? DEFAULT_TEMPLATE_ID;
  const template = templateSource(templateId);
  const timestamp = (options.now?.() ?? new Date()).toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appVersion: DEFAULT_APP_VERSION,
    instrumentType: template.instrumentType,
    stringCount: template.stringCount ?? defaultStringCount(template.instrumentType),
    metadata: {
      created: timestamp,
      modified: timestamp,
      author: options.author ?? DEFAULT_AUTHOR,
    },
    settings: {
      name: options.name ?? `Custom ${template.name}`,
      unitDisplay: 'mm',
      canvasOrientation: 'vertical',
      symmetry: {
        mode: 'none',
        sourceSide: 'left',
      },
      showCenterAxis: true,
      showGhostGuide: true,
      showHardwareCavities: true,
      showDimensions: true,
      showGrid: true,
      gridSizeMm: 50,
      snapToGridEnabled: false,
      finishStyle: 'sunburst',
      bodyColor: '#3b82f6',
      secondaryColor: '#f59e0b',
      bodyFillOpacity: 0.35,
      pickguardEnabled: true,
      pickguardColor: '#ffffff',
    },
    activeTemplateId: templateId,
    // Deep-copied for the same reason handleSelectTemplate copies: the
    // template tables are module-level singletons, and the editor mutates the
    // project's contour in place on every drag.
    contour: {
      anchors: structuredClone(template.defaultAnchors),
      closed: true,
    },
    edgeProfile: template.edgeProfile ? structuredClone(template.edgeProfile) : undefined,
    ...neckPresetFieldsForNewTemplate(template.neckPresetId, templateId, template.instrumentType),
    neckJointMechanism: defaultNeckJointMechanism(templateId),
    ...bridgePresetFields(template.bridgePresetId),
    pickups: structuredClone(template.defaultPickups),
    pickguards: structuredClone(template.defaultPickguards ?? []),
    frontRoutes: structuredClone(template.defaultFrontRoutes ?? []),
    backRoutes: structuredClone(template.defaultBackRoutes ?? []),
  };
}
