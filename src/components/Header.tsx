import React from 'react';
import { Save, Upload, Undo2, Redo2, RotateCcw, Share2, Box, CircleHelp, Info, Menu, Printer, FilePlus2 } from 'lucide-react';
import type { PrintPaper } from '../utils/tiledPrint';
import type { GuitarProject } from '../types/guitar';
import { snapGridToUnit } from '../utils/units';
import { instrumentLabel } from '../utils/instrument';

interface HeaderProps {
  project: GuitarProject;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  onEndEdit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetTemplate: () => void;
  /** Back to the New Design screen. Distinct from Reset, which reloads the
   *  current blueprint's baseline into the document that is already open. */
  onNewDesign: () => void;
  onSave: () => void;
  onShare: () => void;
  onView3D: () => void;
  onPrintTiled: (paper: PrintPaper) => void;
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
  onNewDesign,
  onSave,
  onShare,
  onView3D,
  onPrintTiled,
  onShowWelcome,
  onShowAbout,
  onOpenFile,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="app-header">
      <a className="brand-title" href="/" aria-label="Axe Shaper product site">
        <img className="brand-icon" src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" />
        <span>Axe Shaper</span>
        <span className="brand-badge">2D Luthier</span>
      </a>

      <div className="header-project-controls">
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

        {/* Project context, not a control. The instrument is fixed for the
            life of a document - changing it replaces the contour and every
            piece of hardware, which is New..., not a toggle - so this states
            what is being designed rather than offering to change it. */}
        <span className="header-instrument" title="Set when the design was created. Use New… to design the other instrument.">
          {instrumentLabel(project.instrumentType)}
          <span className="header-instrument-strings">{project.stringCount}-string</span>
        </span>

        <div className="header-unit-controls" style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
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

        <div className="header-orientation-controls" style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
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

        <button className="btn btn-sm header-secondary-action" onClick={onNewDesign} title="Start a new design">
          <FilePlus2 size={15} /> New&hellip;
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onResetTemplate} title="Reset to baseline blueprint">
          <RotateCcw size={15} /> Reset
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".axe.svg,.svg"
          onChange={onOpenFile}
        />
        <button className="btn btn-sm header-secondary-action" onClick={() => fileInputRef.current?.click()} title="Open a .axe.svg project file">
          <Upload size={15} /> Open
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onShare} title="Share the current .axe.svg project file">
          <Share2 size={15} /> Share
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onView3D} title="Open this design in the 3D viewer">
          <Box size={15} /> View in 3D
        </button>

        <details className="help-menu header-secondary-action">
          <summary className="btn btn-sm" aria-label="Print or save a tiled PDF">
            <Printer size={15} /> Print
          </summary>
          <div className="help-menu-popover">
            <button onClick={() => onPrintTiled('a4')}><Printer size={15} /> Tiled PDF / print (A4)</button>
            <button onClick={() => onPrintTiled('letter')}><Printer size={15} /> Tiled PDF / print (Letter)</button>
          </div>
        </details>

        <details className="help-menu header-secondary-action">
          <summary className="btn btn-sm" aria-label="Help and product information">
            <CircleHelp size={15} /> Help
          </summary>
          <div className="help-menu-popover">
            <button onClick={onShowWelcome}><CircleHelp size={15} /> Welcome guide</button>
            <button onClick={onShowAbout}><Info size={15} /> About Axe Shaper</button>
          </div>
        </details>

        <details className="header-overflow">
          <summary className="btn btn-sm" aria-label="Open editor menu" title="Editor menu"><Menu size={18} /></summary>
          <div className="header-overflow-popover">
            <div className="header-overflow-settings">
              <label htmlFor="mobile-project-name">Project name</label>
              <input
                id="mobile-project-name"
                type="text"
                value={project.settings.name}
                onChange={(e) =>
                  onUpdateProject(
                    (prev) => ({ ...prev, settings: { ...prev.settings, name: e.target.value } }),
                    'settings.name'
                  )
                }
                onBlur={onEndEdit}
                className="form-input"
              />
              <span>Units</span>
              <div className="header-overflow-toggle">
                <button
                  className={project.settings.unitDisplay === 'mm' ? 'active' : ''}
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
                  mm
                </button>
                <button
                  className={project.settings.unitDisplay === 'inches' ? 'active' : ''}
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
                  in
                </button>
              </div>
              <span>Canvas orientation</span>
              <div className="header-overflow-toggle">
                <button
                  className={project.settings.canvasOrientation === 'vertical' ? 'active' : ''}
                  onClick={() =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, canvasOrientation: 'vertical' },
                    }))
                  }
                >
                  Vertical
                </button>
                <button
                  className={project.settings.canvasOrientation === 'horizontal' ? 'active' : ''}
                  onClick={() =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, canvasOrientation: 'horizontal' },
                    }))
                  }
                >
                  Horizontal
                </button>
              </div>
            </div>
            <button onClick={onNewDesign}><FilePlus2 size={15} /> New design&hellip;</button>
            <button onClick={onResetTemplate}><RotateCcw size={15} /> Reset blueprint</button>
            <button onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Open project</button>
            <button onClick={onShare}><Share2 size={15} /> Share project</button>
            <button onClick={onView3D}><Box size={15} /> View in 3D</button>
            <button onClick={() => onPrintTiled('a4')}><Printer size={15} /> Print tiled PDF (A4)</button>
            <button onClick={() => onPrintTiled('letter')}><Printer size={15} /> Print tiled PDF (Letter)</button>
            <button onClick={onShowWelcome}><CircleHelp size={15} /> Welcome guide</button>
            <button onClick={onShowAbout}><Info size={15} /> About Axe Shaper</button>
          </div>
        </details>

        <button className="btn btn-accent" onClick={onSave} title="Save as a 1:1 true-scale .axe.svg project file">
          <Save size={16} /> Save
        </button>
      </div>
    </header>
  );
};
