import { Code2, Disc, ExternalLink, Ruler, Tablet, X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="app-modal about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <button className="modal-close" onClick={onClose} aria-label="Close About Axe Shaper"><X size={18} /></button>
        <div className="about-heading">
          <img className="about-brand-mark" src="/brand/axe-shaper-mark.png" alt="" aria-hidden="true" />
          <div><h2 id="about-title">Axe Shaper</h2><span>Web editor · version 1.0</span></div>
        </div>
        <p>A precision 2D workbench for designing solid-body electric guitar and bass bodies, then exporting the drawing you can actually build from.</p>
        <div className="about-facts">
          <div><Ruler size={18} /><span><strong>Measured throughout</strong>Geometry is stored in physical millimetres.</span></div>
          <div><Disc size={18} /><span><strong>One portable file</strong>The printable SVG also carries the editable project.</span></div>
          <div><Tablet size={18} /><span><strong>Two native workbenches</strong>The web and upcoming iPad apps agree through the same file contract and geometry corpus.</span></div>
        </div>
        <div className="about-links">
          <a href="/" target="_blank">Product site <ExternalLink size={14} /></a>
          <a href="https://github.com/steelfinger/axe-shaper" target="_blank">GitHub <Code2 size={14} /></a>
          <a href="/privacy" target="_blank">Privacy <ExternalLink size={14} /></a>
          <a href="/support" target="_blank">Support <ExternalLink size={14} /></a>
        </div>
        <p className="about-license">Open-source web app · MIT License</p>
      </section>
    </div>
  );
}
