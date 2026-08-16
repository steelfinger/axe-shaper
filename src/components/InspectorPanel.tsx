import React from 'react';
import { MousePointer, Trash2, PlusCircle, Ruler, Spline, Slash, Zap, Crosshair } from 'lucide-react';
import { MIN_ANCHOR_COUNT } from '../App';
import { PICKUP_SPECIFICATIONS } from '../constants/hardware';
import type { GuitarProject, HandleMode, PickupType, Vector2D } from '../types/guitar';
import { distanceVector, isSegmentStraight, updateAnchorHandle } from '../utils/bezier';
import { type ActiveLayer, getActiveContour, withActiveContour } from '../utils/layerShapes';
import {
  settingPickupAngle,
  settingPickupCornerRadius,
  settingPickupHeight,
  settingPickupType,
  settingPickupWidth,
  movingPickup,
} from '../utils/pickupEditing';
import { formatLength } from '../utils/units';

interface InspectorPanelProps {
  project: GuitarProject;
  selectedAnchorIds: Set<string>;
  selectedSegmentIndex: number | null;
  selectedPickupId: string | null;
  /** Live model-space cursor position over the canvas, null while the pointer is off it. */
  cursorPos: Vector2D | null;
  onUpdateProject: (updater: (prev: GuitarProject) => GuitarProject, coalesceKey?: string) => void;
  /** Close a typing gesture so the next edit is its own undo step. */
  onEndEdit: () => void;
  onDeleteSelectedAnchors: () => void;
  onAddAnchorOnSegment: () => void;
  onToggleSegmentStraight: () => void;
  onDeleteSelectedPickup: () => void;
  /** Which contour the selected anchor/segment - and any edit below - belongs to. */
  activeLayer: ActiveLayer;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedAnchorIds,
  selectedSegmentIndex,
  selectedPickupId,
  cursorPos,
  onUpdateProject,
  onEndEdit,
  onDeleteSelectedAnchors,
  onAddAnchorOnSegment,
  onToggleSegmentStraight,
  onDeleteSelectedPickup,
  activeLayer,
}) => {
  const { contour, settings } = project;
  const isMm = settings.unitDisplay === 'mm';
  const unitLabel = isMm ? 'mm' : 'in';
  const factor = isMm ? 1 : 1 / 25.4;

  // The contour the current selection belongs to - the real body when body is
  // active, a pickguard/route's own contour otherwise.
  const activeContour = getActiveContour(project, activeLayer) ?? contour;

  // Only meaningful when exactly one anchor is selected - the per-node
  // fields below (Position X/Y, Handle Mode) have no sane single value to
  // show or edit across a multi-selection.
  const selectedAnchorId = selectedAnchorIds.size === 1 ? [...selectedAnchorIds][0] : null;
  const selectedAnchor = activeContour.anchors.find((a) => a.id === selectedAnchorId);

  const segment =
    selectedSegmentIndex !== null && selectedSegmentIndex < activeContour.anchors.length
      ? {
          from: activeContour.anchors[selectedSegmentIndex],
          to: activeContour.anchors[(selectedSegmentIndex + 1) % activeContour.anchors.length],
          straight: isSegmentStraight(activeContour.anchors, selectedSegmentIndex, activeContour.closed),
        }
      : null;

  const selectedPickup = project.pickups.find((p) => p.id === selectedPickupId) ?? null;

  const mmFromInput = (raw: string) => {
    const val = parseFloat(raw) || 0;
    return isMm ? val : val * 25.4;
  };

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
      (prev) => {
        const prevContour = getActiveContour(prev, activeLayer);
        if (!prevContour) return prev;
        return withActiveContour(prev, activeLayer, {
          ...prevContour,
          anchors: prevContour.anchors.map((a) => {
            if (a.id !== selectedAnchorId) return a;
            return {
              ...a,
              position: {
                ...a.position,
                [axis]: mmVal,
              },
            };
          }),
        });
      },
      // One step for the whole number you type, not one per digit
      `anchor.position:${selectedAnchorId}:${axis}`
    );
  };

  const handleModeChange = (mode: HandleMode) => {
    if (!selectedAnchorId) return;
    onUpdateProject((prev) => {
      const prevContour = getActiveContour(prev, activeLayer);
      if (!prevContour) return prev;
      return withActiveContour(prev, activeLayer, {
        ...prevContour,
        anchors: prevContour.anchors.map((a) => {
          if (a.id !== selectedAnchorId) return a;
          const updated = { ...a, handleMode: mode };
          if (mode !== 'corner' && a.handleOut) {
            return updateAnchorHandle(updated, 'out', a.handleOut);
          }
          return updated;
        }),
      });
    });
  };

  return (
    <aside className="app-inspector">
      {/* CURSOR POSITION - live readout so a precise mm figure can be read off the
          canvas and quoted back, instead of eyeballing gridlines or a screenshot. */}
      <div className="panel-section">
        <div className="section-title">
          <Crosshair size={16} /> Cursor Position
        </div>
        {cursorPos ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>X: </span>
              <strong>
                {formatLength(cursorPos.x, settings.unitDisplay)} {unitLabel}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Y: </span>
              <strong>
                {formatLength(cursorPos.y, settings.unitDisplay)} {unitLabel}
              </strong>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Move the cursor over the canvas.</p>
        )}
      </div>

      {/* NODE EDITOR SECTION */}
      <div className="panel-section">
        <div className="section-title">
          {selectedPickup ? (
            <>
              <Zap size={16} /> Pickup Inspector
            </>
          ) : segment && !selectedAnchor ? (
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
                disabled={selectedAnchor.locked || activeContour.anchors.length <= MIN_ANCHOR_COUNT}
                onClick={onDeleteSelectedAnchors}
                title="Delete selected anchor point"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ) : selectedAnchorIds.size > 1 ? (
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedAnchorIds.size} nodes selected</strong>
            </div>
            <button
              className="btn btn-sm"
              style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
              disabled={activeContour.anchors.length - selectedAnchorIds.size < MIN_ANCHOR_COUNT}
              onClick={onDeleteSelectedAnchors}
              title="Delete selected anchor points"
            >
              <Trash2 size={14} /> Delete ({selectedAnchorIds.size})
            </button>
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
        ) : selectedPickup ? (
          <div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Pickup Type</label>
              <select
                value={selectedPickup.type}
                onChange={(e) =>
                  onUpdateProject((prev) =>
                    settingPickupType(prev, selectedPickup.id, e.target.value as PickupType)
                  )
                }
                className="form-select"
              >
                {(Object.keys(PICKUP_SPECIFICATIONS) as PickupType[]).map((type) => (
                  <option key={type} value={type}>
                    {PICKUP_SPECIFICATIONS[type].name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
              <div className="form-group">
                <label className="form-label">X ({unitLabel})</label>
                <input
                  type="number"
                  className="form-input"
                  disabled
                  value={(selectedPickup.offsetXMm * factor).toFixed(2)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Y ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  className="form-input"
                  value={(selectedPickup.offsetYMm * factor).toFixed(2)}
                  onChange={(e) =>
                    onUpdateProject(
                      (prev) => movingPickup(prev, selectedPickup.id, mmFromInput(e.target.value)),
                      `pickup.y:${selectedPickup.id}`
                    )
                  }
                  onBlur={onEndEdit}
                />
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              X stays locked to the centreline - every pickup here is centred under strings that are
              themselves symmetric about it.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Width ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  className="form-input"
                  value={(selectedPickup.widthMm * factor).toFixed(2)}
                  onChange={(e) =>
                    onUpdateProject(
                      (prev) => settingPickupWidth(prev, selectedPickup.id, mmFromInput(e.target.value)),
                      `pickup.width:${selectedPickup.id}`
                    )
                  }
                  onBlur={onEndEdit}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Height ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  className="form-input"
                  value={(selectedPickup.heightMm * factor).toFixed(2)}
                  onChange={(e) =>
                    onUpdateProject(
                      (prev) => settingPickupHeight(prev, selectedPickup.id, mmFromInput(e.target.value)),
                      `pickup.height:${selectedPickup.id}`
                    )
                  }
                  onBlur={onEndEdit}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Corner Radius ({unitLabel})</label>
                <input
                  type="number"
                  step={isMm ? '0.5' : '0.05'}
                  className="form-input"
                  value={((selectedPickup.cornerRadiusMm ?? 0) * factor).toFixed(2)}
                  onChange={(e) =>
                    onUpdateProject(
                      (prev) => settingPickupCornerRadius(prev, selectedPickup.id, mmFromInput(e.target.value)),
                      `pickup.radius:${selectedPickup.id}`
                    )
                  }
                  onBlur={onEndEdit}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Angle (deg)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  value={selectedPickup.angleDegrees.toFixed(1)}
                  onChange={(e) =>
                    onUpdateProject(
                      (prev) => settingPickupAngle(prev, selectedPickup.id, parseFloat(e.target.value) || 0),
                      `pickup.angle:${selectedPickup.id}`
                    )
                  }
                  onBlur={onEndEdit}
                />
              </div>
            </div>

            <button
              className="btn btn-sm"
              style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
              onClick={onDeleteSelectedPickup}
              title="Delete this pickup"
            >
              <Trash2 size={14} /> Delete Pickup
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click any blue anchor circle to inspect coordinates and edit Bezier handles, click a green
            pickup rout to move or rotate it, or click the{' '}
            {activeLayer.kind === 'body' ? 'body outline' : 'outline'} between two anchors to select
            that edge and make it straight or curved. Double-click the outline to add a node where you
            clicked.
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
