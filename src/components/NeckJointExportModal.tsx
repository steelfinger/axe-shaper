import React, { useEffect, useRef } from 'react';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const proceedButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!disclosure) return undefined;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    return () => previouslyFocusedRef.current?.focus();
  }, [disclosure]);

  if (!disclosure) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [closeButtonRef.current, cancelButtonRef.current, proceedButtonRef.current]
      .filter((element): element is HTMLButtonElement => element !== null);
    const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

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
        onKeyDown={handleKeyDown}
        className="neck-joint-export-modal"
      >
        <header className="neck-joint-export-header">
          <AlertTriangle size={18} className="neck-joint-export-warning-icon" />
          <h2 id="neck-joint-export-title">Verify neck-joint fit</h2>
          <button ref={closeButtonRef} type="button" className="btn btn-sm neck-joint-export-close" onClick={onCancel} aria-label="Cancel export">
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
          <button ref={cancelButtonRef} type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button ref={proceedButtonRef} type="button" className="btn btn-primary" onClick={onProceed}>Export {destination}</button>
        </footer>
      </section>
    </div>
  );
};
