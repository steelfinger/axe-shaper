import React from 'react';
import { X, Info } from 'lucide-react';

interface SaveInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const SaveInfoModal: React.FC<SaveInfoModalProps> = ({ isOpen, onClose, onContinue }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--panel-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <Info size={18} style={{ color: 'var(--accent-amber)' }} />
            <span>About your saved file</span>
          </div>
          <button
            className="btn btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Your project saves as a real <code style={{ color: 'var(--accent-amber)' }}>.axe.svg</code> file — a
            standard, true-to-scale SVG. That means it doubles as a 1:1 print template: open it in any browser or
            image viewer, print it at 100% scale, and it's an accurately sized paper plan for your build.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            The project data lives inside that same SVG file, so this app can reopen it too. Editing or re-saving
            the file in another SVG editor (Illustrator, Inkscape, etc.) can strip that embedded data — the file
            will still open and print fine everywhere, but it may no longer be editable here.
          </p>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--panel-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottomLeftRadius: 'var(--radius-md)',
            borderBottomRightRadius: 'var(--radius-md)',
          }}
        >
          <button className="btn btn-primary" onClick={onContinue}>
            Got it, save
          </button>
        </div>
      </div>
    </div>
  );
};
