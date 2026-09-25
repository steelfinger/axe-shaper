import type { GuitarProject, HeadstockShapeId, InstrumentAppearance, InstrumentType } from '../types/guitar';

const GIBSON_DEFAULT_TEMPLATES = new Set([
  'single_cut', 'sg_style', 'gretsch_thunderbird', 'gibson_explorer', 'prs_style',
  'semi_hollow_double_cut', 'semi_hollow_single_cut',
]);

const HEADSTOCK_BY_TEMPLATE: Record<string, HeadstockShapeId> = {
  s_style: 'strat_style', t_style: 't_style', gibson_firebird: 'firebird', gibson_flying_v: 'flying_v',
  p_bass_style: 'bass_f', j_bass_style: 'bass_f', mustang_bass_style: 'bass_f', mm_bass_style: 'bass_mm',
  r_bass_style: 'bass_r', sg_bass_style: 'bass_sg', streamer_bass_style: 'bass_sg', thunderbird_bass_style: 'bass_sg',
};

export function defaultHeadstockShape(templateId: string | undefined, instrumentType: InstrumentType): HeadstockShapeId {
  const selected = templateId ? HEADSTOCK_BY_TEMPLATE[templateId] : undefined;
  if (selected) return selected;
  if (templateId === 'gibson_explorer') return 'explorer';
  if (templateId === 'gretsch_thunderbird') return 'gibson';
  if (instrumentType === 'bass') return 'bass_f';
  return GIBSON_DEFAULT_TEMPLATES.has(templateId ?? '') ? 'gibson' : 'strat_style';
}

/** Fallback for a legacy document that predates `instrumentAppearance`. */
export function legacyInstrumentAppearance(
  templateId: string | undefined,
  instrumentType: InstrumentType,
  neckJointMechanism?: GuitarProject['neckJointMechanism']
): InstrumentAppearance {
  const gibson = GIBSON_DEFAULT_TEMPLATES.has(templateId ?? '') || neckJointMechanism === 'glued';
  return {
    neckFinish: gibson ? 'body_matched' : 'natural_maple',
    fingerboard: gibson ? 'rosewood' : 'maple',
    fretboardBinding: false,
    fretboardInlay: 'dots',
    headstockShape: defaultHeadstockShape(templateId, instrumentType),
  };
}

export function resolveInstrumentAppearance(
  project: Pick<GuitarProject, 'instrumentAppearance' | 'activeTemplateId' | 'instrumentType' | 'neckJointMechanism'>
): InstrumentAppearance {
  return project.instrumentAppearance ?? legacyInstrumentAppearance(
    project.activeTemplateId, project.instrumentType, project.neckJointMechanism
  );
}
