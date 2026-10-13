import { useEffect, useRef } from 'react';
import { Palette, X } from 'lucide-react';
import type { BodyAppearance, GuitarProject, HeadstockShapeId, InstrumentAppearance } from '../types/guitar';
import { resolveBodyAppearance, resolveInstrumentAppearance } from '../utils/instrumentAppearance';
import { SCHEMA_9_AUTHORING_ENABLED } from '../constants/features';

interface InstrumentAppearanceModalProps {
  isOpen: boolean;
  project: GuitarProject;
  onClose: () => void;
  onEndEdit: () => void;
  onUpdateProject: (updater: (previous: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
}

const guitarHeadstocks: Array<[HeadstockShapeId, string]> = [
  ['strat_style', 'Strat-style'], ['t_style', 'T-style'], ['gibson', 'Gibson-style'],
  ['explorer', 'Explorer-style'], ['firebird', 'Firebird-style'], ['flying_v', 'Flying V-style'],
];

const bassHeadstocks: Array<[HeadstockShapeId, string]> = [
  ['bass_f', 'F-style'], ['bass_mm', 'MM-style'], ['bass_r', 'R-style'], ['bass_sg', 'SG-style'],
];

const legacyHeadstockLabels: Partial<Record<HeadstockShapeId, string>> = {
  // Thunderbird was stored by early v6 builds. It now renders as Gibson-style
  // for new projects, but an existing saved choice must remain visible rather
  // than leaving the select blank.
  thunderbird: 'Thunderbird-style (Gibson-style)',
};

export function InstrumentAppearanceModal({
  isOpen,
  project,
  onClose,
  onEndEdit,
  onUpdateProject,
}: InstrumentAppearanceModalProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [isOpen]);
  if (!isOpen) return null;

  // Choosing a material or finish stamps the save 9. Until that is released,
  // only a document that already has one gets these controls; the rest keep
  // the legacy finish, which saves at the version they already have.
  const bodyAuthoring = SCHEMA_9_AUTHORING_ENABLED || !!project.instrumentAppearance?.body;
  const updateSettings = (patch: Partial<GuitarProject['settings']>, coalesceKey?: string) => onUpdateProject(
    (previous) => ({ ...previous, settings: { ...previous.settings, ...patch } }),
    coalesceKey
  );
  const body = resolveBodyAppearance(project);
  const burst = body.finish.startsWith('sunburst');
  const updateBody = (patch: Partial<BodyAppearance>) => onUpdateProject((previous) => ({
    ...previous,
    instrumentAppearance: { ...resolveInstrumentAppearance(previous), body: { ...resolveBodyAppearance(previous), ...patch } },
  }), `bodyAppearance.${Object.keys(patch)[0]}`);
  const appearance = resolveInstrumentAppearance(project);
  const update = (patch: Partial<InstrumentAppearance>) => onUpdateProject(
    (previous) => ({
      ...previous,
      instrumentAppearance: { ...resolveInstrumentAppearance(previous), ...patch },
    }),
    'instrumentAppearance'
  );
  const compatibleHeadstocks = project.instrumentType === 'bass' ? bassHeadstocks : guitarHeadstocks;
  const headstocks = compatibleHeadstocks.some(([value]) => value === appearance.headstockShape)
    ? compatibleHeadstocks
    : [...compatibleHeadstocks, [
      appearance.headstockShape,
      legacyHeadstockLabels[appearance.headstockShape] ?? `Saved choice: ${appearance.headstockShape}`,
    ]];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} onBlur={onEndEdit} onPointerUp={onEndEdit} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, select, input') ?? []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} className="app-modal instrument-appearance-modal" role="dialog" aria-modal="true" aria-labelledby="instrument-appearance-title">
        <button className="modal-close" onClick={onClose} aria-label="Close Instrument Appearance"><X size={18} /></button>
        <div className="instrument-appearance-heading">
          <Palette size={22} aria-hidden="true" />
          <div>
            <h2 id="instrument-appearance-title">Instrument Appearance</h2>
            <p>Saved with this project and shown in 3D. It never changes the printable plan.</p>
          </div>
        </div>

        <fieldset className="appearance-section">
          <legend>Body</legend>
          {bodyAuthoring ? <>
          <div className="instrument-appearance-grid">
            <label className="form-group">
              <span className="form-label">Material</span>
              <select className="form-select" value={body.material} onChange={(event) => updateBody({ material: event.target.value as BodyAppearance['material'] })}>
                <option value="mahogany">Mahogany</option>
                <option value="flame_maple">Flame maple</option>
                <option value="swamp_ash">Swamp ash</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Finish</span>
              <select className="form-select" value={body.finish} onChange={(event) => updateBody({ finish: event.target.value as BodyAppearance['finish'] })}>
                <option value="natural">Natural / clear</option>
                <option value="solid">Single color</option>
                <option value="sunburst_2">2-color sunburst</option>
                <option value="sunburst_3">3-color sunburst</option>
              </select>
            </label>
          </div>
          {body.finish !== 'natural' && <>
            <div className="appearance-colors">
              {([
                ['color', burst ? 'Center color' : 'Finish color'],
                ...(body.finish === 'sunburst_3' ? [['middleColor', 'Middle color']] : []),
                ...(burst ? [['edgeColor', 'Edge color']] : []),
              ] as Array<['color' | 'middleColor' | 'edgeColor', string]>).map(([key, label]) => (
                <label className="form-group" key={key}>
                  <span className="form-label">{label}</span>
                  <input className="body-color-input" type="color" value={body[key]} onChange={(event) => updateBody({ [key]: event.target.value })} />
                </label>
              ))}
            </div>
            <label className="appearance-opacity">
              <span className="form-label">Finish opacity <strong>{Math.round(body.opacity * 100)}%</strong></span>
              <input type="range" min="0" max="1" step="0.01" value={body.opacity} onChange={(event) => updateBody({ opacity: Number(event.target.value) })} aria-describedby="finish-opacity-help" />
            </label>
            <p id="finish-opacity-help" className="appearance-help">{burst ? 'Show the grain through the inner colors. The outer edge stays opaque.' : 'Lower the opacity to reveal the wood grain beneath the color.'}</p>
          </>}
          </> : (
          <div className="instrument-appearance-grid">
            <label className="form-group">
              <span className="form-label">Finish style</span>
              <select className="form-select" value={project.settings.finishStyle} onChange={(event) => updateSettings({ finishStyle: event.target.value as GuitarProject['settings']['finishStyle'] })}>
                <option value="sunburst">Vintage 3-Tone Sunburst</option>
                <option value="flame_maple">Amber Flame Maple</option>
                <option value="natural_wood">Natural Mahogany Wood</option>
                <option value="solid">Solid Gloss Color</option>
              </select>
            </label>
            {project.settings.finishStyle === 'solid' && (
              <label className="form-group">
                <span className="form-label">Body color</span>
                <input className="body-color-input" type="color" value={project.settings.bodyColor} onChange={(event) => updateSettings({ bodyColor: event.target.value }, 'settings.bodyColor')} />
              </label>
            )}
          </div>
          )}
        </fieldset>
        <fieldset className="appearance-section">
          <legend>Neck & headstock</legend>
        <div className="instrument-appearance-grid">
          <label className="form-group">
            <span className="form-label">Neck finish</span>
            <select className="form-select" value={appearance.neckFinish} onChange={(event) => update({ neckFinish: event.target.value as InstrumentAppearance['neckFinish'] })}>
              <option value="natural_maple">Natural maple</option>
              <option value="body_matched">Body-matched</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Fingerboard</span>
            <select className="form-select" value={appearance.fingerboard} onChange={(event) => update({ fingerboard: event.target.value as InstrumentAppearance['fingerboard'] })}>
              <option value="maple">Maple</option>
              <option value="rosewood">Rosewood</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Fretboard inlays</span>
            <select className="form-select" value={appearance.fretboardInlay} onChange={(event) => update({ fretboardInlay: event.target.value as InstrumentAppearance['fretboardInlay'] })}>
              <option value="dots">Dots</option>
              <option value="trapezoids">Trapezoids</option>
              <option value="blocks">Blocks</option>
              <option value="sharkfins">Sharkfins</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Headstock</span>
            <select className="form-select" value={appearance.headstockShape} onChange={(event) => update({ headstockShape: event.target.value as HeadstockShapeId })}>
              {headstocks.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <label className="instrument-appearance-toggle">
          <input type="checkbox" checked={appearance.fretboardBinding} onChange={(event) => update({ fretboardBinding: event.target.checked })} />
          <span><strong>Cream fretboard binding</strong><small>Preview-only; binding colour is intentionally fixed.</small></span>
        </label>
        </fieldset>
      </section>
    </div>
  );
}
