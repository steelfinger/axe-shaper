import { Palette, X } from 'lucide-react';
import type { GuitarProject, HeadstockShapeId, InstrumentAppearance } from '../types/guitar';
import { resolveInstrumentAppearance } from '../utils/instrumentAppearance';

interface InstrumentAppearanceModalProps {
  isOpen: boolean;
  project: GuitarProject;
  onClose: () => void;
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
  onUpdateProject,
}: InstrumentAppearanceModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

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
      <section className="app-modal instrument-appearance-modal" role="dialog" aria-modal="true" aria-labelledby="instrument-appearance-title">
        <button className="modal-close" onClick={onClose} aria-label="Close Instrument Appearance"><X size={18} /></button>
        <div className="instrument-appearance-heading">
          <Palette size={22} aria-hidden="true" />
          <div>
            <h2 id="instrument-appearance-title">Instrument Appearance</h2>
            <p>Saved with this project and shown in 3D. It never changes the printable plan.</p>
          </div>
        </div>

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
      </section>
    </div>
  );
}
