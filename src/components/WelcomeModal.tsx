import { FileUp, MousePointer2, Printer, Ruler, X } from 'lucide-react';

/**
 * The editor's primer, reachable from the Help menu.
 *
 * It used to auto-open on first run and was the app's startup surface, which
 * is why its only action was "Start with S-Style" - the S-Style project had
 * already been built behind it, so there was nothing else it could offer.
 * NewDesignScreen is that surface now and carries the same three steps below
 * its choices; this is contextual help for someone already in the editor.
 */

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="app-modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <button className="modal-close" onClick={onClose} aria-label="Close welcome guide"><X size={18} /></button>
        <div className="welcome-mark"><Ruler size={24} /></div>
        <h2 id="welcome-title">From first curve to full-scale plan.</h2>
        <p className="welcome-intro">Axe Shaper links body geometry to the hardware that makes the instrument playable. Your blueprint is loaded and ready to shape.</p>
        <div className="welcome-steps">
          <div><MousePointer2 size={20} /><strong>Shape</strong><span>Select an outline segment or anchor on the canvas.</span></div>
          <div><Ruler size={20} /><strong>Measure</strong><span>Set the neck, scale, bridge, pickups, and routes in millimetres.</span></div>
          <div><Printer size={20} /><strong>Build</strong><span>Save a 1:1 <code>.axe.svg</code> and verify its calibration square.</span></div>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={onClose}>Back to the canvas</button>
          <span><FileUp size={14} /> Already have a project? Use <strong>Open</strong> in the header.</span>
        </div>
      </section>
    </div>
  );
}
