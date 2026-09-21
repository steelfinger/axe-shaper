import React from 'react';
import { Save, Upload, Undo2, Redo2, RotateCcw, Share2, Box, CircleHelp, Info, Menu, Printer, FilePlus2, Copy, Download } from 'lucide-react';
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
  onSwitchBlueprint: () => void;
  /** Back to the New Design screen. Distinct from Reset, which reloads the
   *  current blueprint's baseline into the document that is already open. */
  onNewDesign: () => void;
  onSave: () => void;
  onExportDXF: () => void;
  onShare: () => void;
  onView3D: () => void;
  /**
   * Whether this project can be opened in 3D. The viewer supports both
   * Guitar/6 and Bass/4; the editor currently enables it for every project.
   */
  view3DAvailable: boolean;
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
  onSwitchBlueprint,
  onNewDesign,
  onSave,
  onExportDXF,
  onShare,
  onView3D,
  view3DAvailable,
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

        {/* The instrument a document was created as - and the way back to the
            chooser to design the other one. The instrument is fixed for the
            life of a document (changing it replaces the contour and every
            piece of hardware), so this opens the New Design screen rather than
            toggling in place - `onNewDesign` runs the unsaved-changes confirm
            and seeds the chooser with this design. No icon here on purpose:
            the box keeps the exact footprint of the old static chip, so the
            header-degradation tiers in index.css don't need re-measuring. */}
        <button
          type="button"
          className="header-instrument"
          onClick={onNewDesign}
          title="Change instrument or blueprint — starts a new design"
        >
          {instrumentLabel(project.instrumentType)}
          <span className="header-instrument-strings">{project.stringCount}-string</span>
        </button>

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
          <FilePlus2 size={15} /> <span className="header-action-label">New&hellip;</span>
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onSwitchBlueprint} title="Switch the current design to another blueprint">
          <Copy size={15} /> <span className="header-action-label">Blueprint&hellip;</span>
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onResetTemplate} title="Reset to baseline blueprint">
          <RotateCcw size={15} /> <span className="header-action-label">Reset</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".axe.svg,.svg"
          onChange={onOpenFile}
        />
        <button className="btn btn-sm header-secondary-action" onClick={() => fileInputRef.current?.click()} title="Open a .axe.svg project file">
          <Upload size={15} /> <span className="header-action-label">Open</span>
        </button>

        <button className="btn btn-sm header-secondary-action" onClick={onShare} title="Share the current .axe.svg project file">
          <Share2 size={15} /> <span className="header-action-label">Share</span>
        </button>

        <button
          className="btn btn-sm header-secondary-action"
          onClick={onView3D}
          disabled={!view3DAvailable}
          title={
            view3DAvailable
              ? 'Open this design in the 3D viewer'
              : 'The 3D preview is unavailable for this design.'
          }
        >
          <Box size={15} /> <span className="header-action-label">View in 3D</span>
        </button>

        <details className="help-menu header-secondary-action">
          <summary className="btn btn-sm" aria-label="Export DXF or print a tiled PDF" title="Export DXF or print a tiled PDF">
            <Download size={15} /> <span className="header-action-label">Export</span>
          </summary>
          <div className="help-menu-popover">
            <button onClick={onExportDXF}><Download size={15} /> Export DXF (.dxf)</button>
            <p className="dxf-export-note">1:1 outlines in mm; visible shapes only. Hardware and edge profiles excluded. Back routes stay in front-view alignment. Define cutting depths and setups in CAD/CAM. Keep .axe.svg for editing.</p>
            <button onClick={() => onPrintTiled('a4')}><Printer size={15} /> Tiled PDF / print (A4)</button>
            <button onClick={() => onPrintTiled('letter')}><Printer size={15} /> Tiled PDF / print (Letter)</button>
          </div>
        </details>

        <details className="help-menu header-secondary-action">
          <summary className="btn btn-sm" aria-label="Help and product information">
            <CircleHelp size={15} /> <span className="header-action-label">Help</span>
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
            <button
              onClick={(event) => {
                event.currentTarget.closest('details')?.removeAttribute('open');
                onSwitchBlueprint();
              }}
            >
              <Copy size={15} /> Switch blueprint&hellip;
            </button>
            <button onClick={onResetTemplate}><RotateCcw size={15} /> Reset blueprint</button>
            <button onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Open project</button>
            <button onClick={onShare}><Share2 size={15} /> Share project</button>
            <button onClick={onExportDXF}><Download size={15} /> Export DXF (.dxf)</button>
            <p className="dxf-export-note">1:1 outlines in mm; visible shapes only. Hardware and edge profiles excluded. Back routes stay in front-view alignment. Define cutting depths and setups in CAD/CAM. Keep .axe.svg for editing.</p>
            <button
              onClick={onView3D}
              disabled={!view3DAvailable}
              title={view3DAvailable ? undefined : 'The 3D preview is unavailable for this design.'}
            >
              <Box size={15} /> View in 3D
            </button>
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
