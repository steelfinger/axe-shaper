import React from 'react';
import { Save, Upload, Undo2, Redo2, RotateCcw, Share2, Box, CircleHelp, Info, Home } from 'lucide-react';
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
  onSave: () => void;
  onShare: () => void;
  onView3D: () => void;
  onShowWelcome: () => void;
  onShowAbout: () => void;
  onOpenFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  onSave,
  onShare,
  onView3D,
  onShowWelcome,
  onShowAbout,
  onOpenFile,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <div className="brand-title">
        <img className="brand-icon" src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" />
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

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".axe.svg,.svg"
          onChange={onOpenFile}
        />
        <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()} title="Open a .axe.svg project file">
          <Upload size={15} /> Open
        </button>

        <button className="btn btn-sm" onClick={onShare} title="Share the current .axe.svg project file">
          <Share2 size={15} /> Share
        </button>

        <button className="btn btn-sm" onClick={onView3D} title="Open this design in the 3D viewer">
          <Box size={15} /> View in 3D
        </button>

        <details className="help-menu">
          <summary className="btn btn-sm" aria-label="Help and product information">
            <CircleHelp size={15} /> Help
          </summary>
          <div className="help-menu-popover">
            <button onClick={onShowWelcome}><CircleHelp size={15} /> Welcome guide</button>
            <button onClick={onShowAbout}><Info size={15} /> About Axe Shaper</button>
            <a href="/"><Home size={15} /> Product site</a>
          </div>
        </details>

        <button className="btn btn-accent" onClick={onSave} title="Save as a 1:1 true-scale .axe.svg project file">
          <Save size={16} /> Save
        </button>
      </div>
    </header>
  );
};
