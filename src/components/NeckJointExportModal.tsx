import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface NeckJointExportModalProps {
  disclosure: string | null;
  destination: 'DXF' | 'tiled print';
  onCancel: () => void;
  onProceed: () => void;
}

/** A deliberate, one-action check before a non-verified joint reaches a cutter. */
export const NeckJointExportModal: React.FC<NeckJointExportModalProps> = ({
  disclosure,
  destination,
  onCancel,
  onProceed,
}) => {
  if (!disclosure) return null;

  return (
    <div
      role="presentation"
      onMouseDown={onCancel}
      className="modal-backdrop neck-joint-export-backdrop"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="neck-joint-export-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="neck-joint-export-modal"
      >
        <header className="neck-joint-export-header">
          <AlertTriangle size={18} className="neck-joint-export-warning-icon" />
          <h2 id="neck-joint-export-title">Verify neck-joint fit</h2>
          <button type="button" className="btn btn-sm neck-joint-export-close" onClick={onCancel} aria-label="Cancel export">
            <X size={18} />
          </button>
        </header>
        <div className="neck-joint-export-body">
          <p>{disclosure}</p>
          <p className="neck-joint-export-help">
            Check the actual neck and routing setup before making this cut. The exported template will carry the same note; a DXF filename is marked <code>-unverified</code>.
          </p>
        </div>
        <footer className="neck-joint-export-footer">
          <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onProceed}>Export {destination}</button>
        </footer>
      </section>
    </div>
  );
};
