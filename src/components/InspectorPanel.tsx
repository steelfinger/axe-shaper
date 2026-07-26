import React from 'react';
import { MousePointer, Trash2, PlusCircle, Ruler } from 'lucide-react';
import type { GuitarProject, HandleMode } from '../types/guitar';

interface InspectorPanelProps {
  project: GuitarProject;
  selectedAnchorId: string | null;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject) => void;
  onDeleteSelectedAnchor: () => void;
  onAddAnchorOnSegment: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedAnchorId,
  onUpdateProject,
  onDeleteSelectedAnchor,
  onAddAnchorOnSegment,
}) => {
  const { contour, settings } = project;
  const isMm = settings.unitDisplay === 'mm';
  const unitLabel = isMm ? 'mm' : 'in';
  const factor = isMm ? 1 : 1 / 25.4;

  const selectedAnchor = contour.anchors.find((a) => a.id === selectedAnchorId);

  // Compute live body measurements
  const xPositions = contour.anchors.map((a) => Math.abs(a.position.x));
  const maxHalfWidth = Math.max(...xPositions, 0);
  const maxBodyWidth = maxHalfWidth * 2;

  const yPositions = contour.anchors.map((a) => a.position.y);
  const minY = Math.min(...yPositions, 0);
  const maxY = Math.max(...yPositions, 0);
  const totalBodyLength = maxY - minY;

  const handlePositionChange = (axis: 'x' | 'y', val: number) => {
    if (!selectedAnchorId) return;
    const mmVal = isMm ? val : val * 25.4;

    onUpdateProject((prev) => ({
      ...prev,
      contour: {
        ...prev.contour,
        anchors: prev.contour.anchors.map((a) => {
          if (a.id !== selectedAnchorId) return a;
          return {
            ...a,
            position: {
              ...a.position,
              [axis]: mmVal,
            },
          };
        }),
      },
    }));
  };

  const handleModeChange = (mode: HandleMode) => {
    if (!selectedAnchorId) return;
    onUpdateProject((prev) => ({
      ...prev,
      contour: {
        ...prev.contour,
        anchors: prev.contour.anchors.map((a) =>
          a.id === selectedAnchorId ? { ...a, handleMode: mode } : a
        ),
      },
    }));
  };

  return (
    <aside className="app-inspector">
      {/* NODE EDITOR SECTION */}
      <div className="panel-section">
        <div className="section-title">
          <MousePointer size={16} /> Node Inspector
        </div>

        {selectedAnchor ? (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Role: <strong style={{ color: 'var(--text-primary)' }}>{selectedAnchor.semanticRole || 'Custom Anchor'}</strong>
              {selectedAnchor.locked && <span style={{ color: 'var(--accent-red)', marginLeft: '6px' }}>(Locked)</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Position X ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  disabled={selectedAnchor.locked}
                  value={(selectedAnchor.position.x * factor).toFixed(2)}
                  onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Position Y ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  disabled={selectedAnchor.locked}
                  value={(selectedAnchor.position.y * factor).toFixed(2)}
                  onChange={(e) => handlePositionChange('y', parseFloat(e.target.value) || 0)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Handle Mode</label>
              <select
                value={selectedAnchor.handleMode}
                onChange={(e) => handleModeChange(e.target.value as HandleMode)}
                className="form-select"
                disabled={selectedAnchor.locked}
              >
                <option value="smooth">Smooth Handle</option>
                <option value="symmetric">Symmetric Handle</option>
                <option value="corner">Sharp Corner</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-sm"
                onClick={onAddAnchorOnSegment}
                title="Subdivide curve: Add new anchor point on this segment"
              >
                <PlusCircle size={14} /> Add Node
              </button>
              <button
                className="btn btn-sm"
                style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                disabled={selectedAnchor.locked || contour.anchors.length <= 4}
                onClick={onDeleteSelectedAnchor}
                title="Delete selected anchor point"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click any blue anchor circle on the canvas to inspect coordinates and edit Bezier handles.
          </p>
        )}
      </div>

      {/* LIVE MEASUREMENTS SECTION */}
      <div className="panel-section">
        <div className="section-title">
          <Ruler size={16} /> Live Body Dimensions
        </div>

        <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Max Body Width:</span>
            <span style={{ fontWeight: 600 }}>{(maxBodyWidth * factor).toFixed(1)} {unitLabel}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Body Length:</span>
            <span style={{ fontWeight: 600 }}>{(totalBodyLength * factor).toFixed(1)} {unitLabel}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Contour Nodes:</span>
            <span style={{ fontWeight: 600 }}>{contour.anchors.length} anchors</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
