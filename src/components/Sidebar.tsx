import React, { useState } from 'react';
import { Layers, Sliders, Palette, Shield } from 'lucide-react';
import { BRIDGE_PRESETS, NECK_PRESETS } from '../constants/hardware';
import { REFERENCE_TEMPLATES } from '../constants/templates';
import type { GuitarProject, SymmetryMode } from '../types/guitar';

interface SidebarProps {
  project: GuitarProject;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject) => void;
  onSelectTemplate: (templateId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ project, onUpdateProject, onSelectTemplate }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'hardware' | 'finishes' | 'layers'>('templates');

  const { settings, neckPresetId, bridgePresetId } = project;
  const currentNeck = NECK_PRESETS[neckPresetId] || NECK_PRESETS.fender_strat_21;
  const currentBridge = BRIDGE_PRESETS[bridgePresetId] || BRIDGE_PRESETS.tremolo_strat;

  return (
    <aside className="app-sidebar">
      <div className="sidebar-tabs">
        <div
          className={`sidebar-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          Hardware
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'finishes' ? 'active' : ''}`}
          onClick={() => setActiveTab('finishes')}
        >
          Finishes
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </div>
      </div>

      <div className="sidebar-content">
        {/* TEMPLATES TAB */}
        {activeTab === 'templates' && (
          <div>
            <div className="panel-section">
              <div className="section-title">
                <Sliders size={16} /> Reference Blueprints
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Select a baseline guitar blueprint to initialize editable Bezier nodes and hardware alignment.
              </p>

              {Object.values(REFERENCE_TEMPLATES).map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => onSelectTemplate(tmpl.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background: project.activeTemplateId === tmpl.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-primary)',
                    border: project.activeTemplateId === tmpl.id ? '1px solid var(--accent-amber)' : '1px solid var(--panel-border)',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tmpl.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tmpl.category}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{tmpl.description}</p>
                </div>
              ))}
            </div>

            <div className="panel-section">
              <div className="section-title">
                <Shield size={16} /> Live Centerline Symmetry
              </div>
              <div className="form-group">
                <label className="form-label">Symmetry Mode</label>
                <select
                  value={settings.symmetry.mode}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        symmetry: { ...prev.settings.symmetry, mode: e.target.value as SymmetryMode },
                      },
                    }))
                  }
                  className="form-select"
                >
                  <option value="none">Free-Form Asymmetrical Editing (Default)</option>
                  <option value="live_centerline">Live Centerline Mirroring</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* HARDWARE TAB */}
        {activeTab === 'hardware' && (
          <div>
            <div className="panel-section">
              <div className="section-title">Neck & Joint Presets</div>

              <div className="form-group">
                <label className="form-label">Neck & Scale Length</label>
                <select
                  value={neckPresetId}
                  onChange={(e) =>
                    onUpdateProject((prev) => {
                      const newNeckId = e.target.value;
                      const newNeck = NECK_PRESETS[newNeckId];
                      // Auto-snap shoulder anchors to new joint width
                      const halfWidth = newNeck.jointWidthMm / 2;
                      const updatedAnchors = prev.contour.anchors.map((a) => {
                        if (a.semanticRole === 'neck_pocket_left') {
                          return { ...a, position: { ...a.position, x: -halfWidth } };
                        }
                        if (a.semanticRole === 'neck_pocket_right') {
                          return { ...a, position: { ...a.position, x: halfWidth } };
                        }
                        return a;
                      });
                      return {
                        ...prev,
                        neckPresetId: newNeckId,
                        contour: { ...prev.contour, anchors: updatedAnchors },
                      };
                    })
                  }
                  className="form-select"
                >
                  {Object.values(NECK_PRESETS).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <div>• Scale Length: <strong>{currentNeck.scaleLengthMm} mm</strong> ({(currentNeck.scaleLengthMm / 25.4).toFixed(2)}")</div>
                <div>• Joint Pocket Width: <strong>{currentNeck.jointWidthMm} mm</strong></div>
                <div>• Nut-to-Joint: <strong>{currentNeck.nutToJointMm} mm</strong></div>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">Bridge & Intonation Math</div>

              <div className="form-group">
                <label className="form-label">Bridge Hardware Type</label>
                <select
                  value={bridgePresetId}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({ ...prev, bridgePresetId: e.target.value }))
                  }
                  className="form-select"
                >
                  {Object.values(BRIDGE_PRESETS).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <div>• Theoretical Saddle Y: <strong>{(currentNeck.scaleLengthMm - currentNeck.nutToJointMm).toFixed(1)} mm</strong></div>
                <div>• Treble Compensation: <strong>+{currentBridge.compensationMm.treble} mm</strong></div>
                <div>• Bass Compensation: <strong>+{currentBridge.compensationMm.bass} mm</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* FINISHES TAB */}
        {activeTab === 'finishes' && (
          <div>
            <div className="panel-section">
              <div className="section-title">
                <Palette size={16} /> Wood Finish & Color
              </div>

              <div className="form-group">
                <label className="form-label">Finish Style</label>
                <select
                  value={settings.finishStyle}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, finishStyle: e.target.value as any },
                    }))
                  }
                  className="form-select"
                >
                  <option value="sunburst">Vintage 3-Tone Sunburst</option>
                  <option value="flame_maple">Amber Flame Maple</option>
                  <option value="natural_wood">Natural Mahogany Wood</option>
                  <option value="solid">Solid Gloss Color</option>
                </select>
              </div>

              {settings.finishStyle === 'solid' && (
                <div className="form-group">
                  <label className="form-label">Body Color</label>
                  <input
                    type="color"
                    value={settings.bodyColor}
                    onChange={(e) =>
                      onUpdateProject((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, bodyColor: e.target.value },
                      }))
                    }
                    style={{ width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* LAYERS TAB */}
        {activeTab === 'layers' && (
          <div>
            <div className="panel-section">
              <div className="section-title">
                <Layers size={16} /> Visibility Toggles
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Center Alignment Axis</span>
                <input
                  type="checkbox"
                  checked={settings.showCenterAxis}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showCenterAxis: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Ghost Reference Guide</span>
                <input
                  type="checkbox"
                  checked={settings.showGhostGuide}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showGhostGuide: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Hardware Cavities & Routs</span>
                <input
                  type="checkbox"
                  checked={settings.showHardwareCavities}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showHardwareCavities: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Live Dimensions Overlay</span>
                <input
                  type="checkbox"
                  checked={settings.showDimensions}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showDimensions: e.target.checked },
                    }))
                  }
                />
              </div>

              <div className="toggle-row">
                <span style={{ fontSize: '0.85rem' }}>Background Grid</span>
                <input
                  type="checkbox"
                  checked={settings.showGrid}
                  onChange={(e) =>
                    onUpdateProject((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, showGrid: e.target.checked },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
