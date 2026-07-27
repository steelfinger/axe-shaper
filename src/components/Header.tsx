import React from 'react';
import { Download, Upload, Undo2, Redo2, RotateCcw, FileCode, Disc } from 'lucide-react';
import type { GuitarProject } from '../types/guitar';
import { snapGridToUnit } from '../utils/units';

interface HeaderProps {
  project: GuitarProject;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  onEndEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetTemplate: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenTemplateCodeModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onUpdateProject,
  onEndEdit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetTemplate,
  onExportSVG,
  onExportJSON,
  onImportJSON,
  onOpenTemplateCodeModal,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <div className="brand-title">
        <Disc className="w-5 h-5 text-amber-500" />
        <span>Axe Shaper</span>
        <span className="brand-badge">2D Luthier</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <input
          type="text"
          value={project.settings.name}
          onChange={(e) =>
            onUpdateProject(
              (prev) => ({ ...prev, settings: { ...prev.settings, name: e.target.value } }),
              // One undo step for the whole name, not one per keystroke
              'settings.name'
            )
          }
          onBlur={onEndEdit}
          className="form-input"
          style={{ width: '220px', fontWeight: 600 }}
          placeholder="Project Name..."
        />

        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          <button
            className={`btn btn-sm ${project.settings.unitDisplay === 'mm' ? 'btn-primary' : ''}`}
            onClick={() =>
              onUpdateProject((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  unitDisplay: 'mm',
                  gridSizeMm: snapGridToUnit(prev.settings.gridSizeMm, 'mm'),
                },
              }))
            }
          >
            MM
          </button>
          <button
            className={`btn btn-sm ${project.settings.unitDisplay === 'inches' ? 'btn-primary' : ''}`}
            onClick={() =>
              onUpdateProject((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  unitDisplay: 'inches',
                  gridSizeMm: snapGridToUnit(prev.settings.gridSizeMm, 'inches'),
                },
              }))
            }
          >
            IN
          </button>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          <button
            className={`btn btn-sm ${project.settings.canvasOrientation === 'vertical' ? 'btn-primary' : ''}`}
            title="Vertical Layout (Neck at Top)"
            onClick={() =>
              onUpdateProject((prev) => ({
                ...prev,
                settings: { ...prev.settings, canvasOrientation: 'vertical' },
              }))
            }
          >
            ↕ Vertical
          </button>
          <button
            className={`btn btn-sm ${project.settings.canvasOrientation === 'horizontal' ? 'btn-primary' : ''}`}
            title="Horizontal Layout (Neck at Left)"
            onClick={() =>
              onUpdateProject((prev) => ({
                ...prev,
                settings: { ...prev.settings, canvasOrientation: 'horizontal' },
              }))
            }
          >
            ↔ Horizontal
          </button>
        </div>
      </div>

      <div className="header-actions">
        <button className="btn btn-sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button className="btn btn-sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </button>

        <button className="btn btn-sm" onClick={onResetTemplate} title="Reset to baseline blueprint">
          <RotateCcw size={15} /> Reset
        </button>

        <button className="btn btn-sm" onClick={onOpenTemplateCodeModal} title="Export TypeScript code for this design as a baseline template">
          <FileCode size={15} /> Export Template TS
        </button>

        <button className="btn btn-sm" onClick={onExportJSON} title="Save project as JSON file">
          <Download size={15} /> Save JSON
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".guitar,.json"
          onChange={onImportJSON}
        />
        <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()} title="Open JSON project file">
          <Upload size={15} /> Open JSON
        </button>

        <button className="btn btn-accent" onClick={onExportSVG} title="Export 1:1 True-Scale Printable SVG">
          <Download size={16} /> Export 1:1 SVG
        </button>
      </div>
    </header>
  );
};
