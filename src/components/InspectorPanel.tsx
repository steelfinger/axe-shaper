import React from 'react';
import { MousePointer, Trash2, PlusCircle, Ruler, Spline, Slash } from 'lucide-react';
import type { GuitarProject, HandleMode } from '../types/guitar';
import { distanceVector, isSegmentStraight, updateAnchorHandle } from '../utils/bezier';

interface InspectorPanelProps {
  project: GuitarProject;
  selectedAnchorId: string | null;
  selectedSegmentIndex: number | null;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  /** Close a typing gesture so the next edit is its own undo step. */
  onEndEdit: () => void;
  onDeleteSelectedAnchor: () => void;
  onAddAnchorOnSegment: () => void;
  onToggleSegmentStraight: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedAnchorId,
  selectedSegmentIndex,
  onUpdateProject,
  onEndEdit,
  onDeleteSelectedAnchor,
  onAddAnchorOnSegment,
  onToggleSegmentStraight,
}) => {
  const { contour, settings } = project;
  const isMm = settings.unitDisplay === 'mm';
  const unitLabel = isMm ? 'mm' : 'in';
  const factor = isMm ? 1 : 1 / 25.4;

  const selectedAnchor = contour.anchors.find((a) => a.id === selectedAnchorId);

  const segment =
    selectedSegmentIndex !== null && selectedSegmentIndex < contour.anchors.length
      ? {
          from: contour.anchors[selectedSegmentIndex],
          to: contour.anchors[(selectedSegmentIndex + 1) % contour.anchors.length],
          straight: isSegmentStraight(contour.anchors, selectedSegmentIndex, contour.closed),
        }
      : null;

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

    onUpdateProject(
      (prev) => ({
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
      }),
      // One step for the whole number you type, not one per digit
      `anchor.position:${selectedAnchorId}:${axis}`
    );
  };

  const handleModeChange = (mode: HandleMode) => {
    if (!selectedAnchorId) return;
    onUpdateProject((prev) => ({
      ...prev,
      contour: {
        ...prev.contour,
        anchors: prev.contour.anchors.map((a) => {
          if (a.id !== selectedAnchorId) return a;
          const updated = { ...a, handleMode: mode };
          if (mode !== 'corner' && a.handleOut) {
            return updateAnchorHandle(updated, 'out', a.handleOut);
          }
          return updated;
        }),
      },
    }));
  };

  return (
    <aside className="app-inspector">
      {/* NODE EDITOR SECTION */}
      <div className="panel-section">
        <div className="section-title">
          {segment && !selectedAnchor ? (
            <>
              <Slash size={16} /> Segment Inspector
            </>
          ) : (
            <>
              <MousePointer size={16} /> Node Inspector
            </>
          )}
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
                  onBlur={onEndEdit}
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
                  onBlur={onEndEdit}
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
              >
                <option value="smooth">Smooth Handle (Independent Lengths)</option>
                <option value="symmetric">Symmetric Handle (Equal Lengths)</option>
                <option value="corner">Sharp Corner (Disconnected Handles)</option>
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
        ) : segment ? (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Edge{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {segment.from.semanticRole || 'custom'} &rarr; {segment.to.semanticRole || 'custom'}
              </strong>
              <br />
              End-to-end span: {(distanceVector(segment.from.position, segment.to.position) * factor).toFixed(1)}{' '}
              {unitLabel}
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label">Edge Shape</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn btn-sm ${!segment.straight ? 'btn-primary' : ''}`}
                  onClick={() => segment.straight && onToggleSegmentStraight()}
                  title="Give this edge bezier handles to curve it"
                >
                  <Spline size={14} /> Curved
                </button>
                <button
                  className={`btn btn-sm ${segment.straight ? 'btn-primary' : ''}`}
                  onClick={() => !segment.straight && onToggleSegmentStraight()}
                  title="Retract the handles so this edge is a straight line"
                >
                  <Slash size={14} /> Straight
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
              Straightening retracts the two handles that shape this edge and sets both ends to Sharp
              Corner, so curving a neighbouring edge cannot pull it back out.
            </p>

            <button
              className="btn btn-sm"
              onClick={onAddAnchorOnSegment}
              title="Split this edge: add a new anchor point at its midpoint"
            >
              <PlusCircle size={14} /> Add Node Here
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click any blue anchor circle to inspect coordinates and edit Bezier handles, or click the
            body outline between two anchors to select that edge and make it straight or curved.
            Double-click the outline to add a node where you clicked.
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
