import React, { useState } from 'react';
import { Copy, Check, X, Code2 } from 'lucide-react';
import type { GuitarProject } from '../types/guitar';

interface TemplateCodeModalProps {
  project: GuitarProject;
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateCodeModal: React.FC<TemplateCodeModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const constName = `${project.settings.name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')}_ANCHORS`;

  const tsCode = `// ${project.settings.name} Custom Template Blueprint
export const ${constName}: PathAnchor[] = ${JSON.stringify(
    project.contour.anchors,
    null,
    2
  )};
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tsCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

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
          maxWidth: '750px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <Code2 size={18} className="text-amber-500" />
            <span>Export Template TypeScript Code</span>
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
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Copy this TypeScript code array into <code style={{ color: 'var(--accent-amber)' }}>src/constants/templates.ts</code> to hardcode your custom guitar design as a default baseline template!
          </p>

          <pre
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '16px',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              overflowX: 'auto',
              maxHeight: '380px',
              lineHeight: 1.5,
            }}
          >
            {tsCode}
          </pre>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottomLeftRadius: 'var(--radius-md)',
            borderBottomRightRadius: 'var(--radius-md)',
          }}
        >
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? (
              <>
                <Check size={16} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} /> Copy TypeScript Code
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
