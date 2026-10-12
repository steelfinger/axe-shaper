import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, FileUp, Link2, X } from 'lucide-react';
import type { GuitarProject } from '../types/guitar';
import {
  beginShare, fetchSharingStatus, preflightShare, recoveryKeyText, rememberShareKey, sendShare, shareUrl,
} from '../sharing/shareLinkClient';
import type { PendingShare, ShareBlockReason, SharePreflight, ShareSendResult } from '../sharing/shareLinkClient';

interface ShareLinkModalProps {
  /**
   * The design as it was when Share was chosen, or null when closed. The
   * editor keeps changing underneath; this snapshot is what gets checked and
   * uploaded.
   */
  project: GuitarProject | null;
  onClose: () => void;
  /** The existing .axe.svg share/download, always offered as the alternative. */
  onShareFile: () => void;
}

type ShareLinkState =
  | { kind: 'checking' }
  | { kind: 'ready'; preflight: Extract<SharePreflight, { ok: true }> }
  | { kind: 'blocked'; reason: ShareBlockReason }
  | { kind: 'creating'; pending: PendingShare }
  | { kind: 'failed'; pending: PendingShare; result: Extract<ShareSendResult, { ok: false }> }
  | { kind: 'created'; id: string; url: string; managementSecret: string };

const BLOCKED_MESSAGES: Record<ShareBlockReason, string> = {
  unavailable: 'Link sharing is not available right now. You can still share the project file.',
  paused: 'Creating new links is paused for the moment. You can still share the project file.',
  'newer-fields': 'This design contains fields from a newer app. Share the project file instead.',
  'unsupported-schema': 'This design uses features that the current iPad app cannot open yet, so it cannot be shared as a link. Share the project file instead.',
  invalid: 'This design could not be prepared for a link. Share the project file instead.',
  'too-large': 'This design is too large to share as a link. Share the project file instead.',
};

function failureMessage(result: Extract<ShareSendResult, { ok: false }>): string {
  switch (result.code) {
    case 'network': return 'The link could not be created because the connection failed. Trying again will not create a duplicate.';
    case 'quota-exceeded': return 'Too many links have been created recently. Try again later - trying again will not create a duplicate.';
    case 'operation-expired': return 'This attempt has expired. Close this dialog and create the link again.';
    case 'unavailable': return 'The sharing service did not respond. Trying again will not create a duplicate.';
    default: return 'The link could not be created. Share the project file instead.';
  }
}

/**
 * "Create link": consent, one confirmed upload, then the link and its recovery key.
 * Plan: docs/DESIGN_SHARING_AND_GALLERY_PLAN.md, "Create an editable link".
 */
export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ project, onClose, onShareFile }) => {
  const [state, setState] = useState<ShareLinkState>({ kind: 'checking' });
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isOpen = project !== null;

  useEffect(() => {
    if (!project) return undefined;
    setState({ kind: 'checking' });
    setCopied(false);
    let cancelled = false;
    void (async () => {
      const status = await fetchSharingStatus((input, init) => fetch(input, init));
      const preflight = await preflightShare(project, status);
      if (cancelled) return;
      setState(preflight.ok ? { kind: 'ready', preflight } : { kind: 'blocked', reason: preflight.reason });
    })();
    return () => { cancelled = true; };
  }, [project]);

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previouslyFocusedRef.current?.focus();
  }, [isOpen]);

  // Move focus to the main action of each step so keyboard users land on it.
  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [isOpen, state.kind]);

  if (!project) return null;

  const busy = state.kind === 'creating' || state.kind === 'checking';
  const close = () => { if (state.kind !== 'creating') onClose(); };

  const send = async (pending: PendingShare) => {
    setState({ kind: 'creating', pending });
    const result = await sendShare(pending, (input, init) => fetch(input, init));
    if (result.ok && project) {
      // So Manage this link works on this device without the recovery file.
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { /* blocked storage: the recovery file still works */ }
      rememberShareKey(storage, result.id, { managementSecret: pending.managementSecret, title: project.settings.name,
        createdAt: result.createdAt });
    }
    setState(result.ok
      ? { kind: 'created', id: result.id, url: shareUrl(window.location.origin, result.id), managementSecret: pending.managementSecret }
      : { kind: 'failed', pending, result });
  };

  const handleCreate = () => {
    if (state.kind !== 'ready') return;
    void send(beginShare(state.preflight, Date.now()));
  };

  const handleCopy = async () => {
    if (state.kind !== 'created') return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
    } catch {
      dialogRef.current?.querySelector<HTMLInputElement>('.share-link-url')?.select();
    }
  };

  const handleSaveKey = () => {
    if (state.kind !== 'created') return;
    const text = recoveryKeyText(state.url, state.id, state.managementSecret, project.settings.name);
    const href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `axe-shaper-link-${state.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const handleShareFile = () => {
    onClose();
    onShareFile();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input'));
    if (focusable.length === 0) return;
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    const next = event.shiftKey
      ? (index <= 0 ? focusable.length - 1 : index - 1)
      : (index === focusable.length - 1 ? 0 : index + 1);
    event.preventDefault();
    focusable[next].focus();
  };

  const author = project.metadata?.author?.trim();
  const fileButton = (primary: boolean) => (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn btn-sm'} onClick={handleShareFile}
      disabled={state.kind === 'creating'} data-autofocus={primary || undefined}>
      <FileUp size={15} /> Share project file
    </button>
  );

  return (
    <div role="presentation" onMouseDown={close} className="modal-backdrop share-link-backdrop">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-link-title"
        aria-busy={busy}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="share-link-modal"
      >
        <header className="share-link-header">
          <Link2 size={18} className="share-link-icon" />
          <h2 id="share-link-title">{state.kind === 'created' ? 'Your link is ready' : 'Share this design'}</h2>
          <button type="button" className="btn btn-sm share-link-close" onClick={close}
            disabled={state.kind === 'creating'} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="share-link-body" aria-live="polite">
          {state.kind === 'checking' && <p className="share-link-muted" role="status">Checking this design&hellip;</p>}

          {(state.kind === 'ready' || state.kind === 'creating') && (
            <>
              <dl className="share-link-summary">
                <dt>Design</dt><dd>{project.settings.name}</dd>
                <dt>Author</dt><dd>{author || <span className="share-link-muted">Not set</span>}</dd>
              </dl>
              <ul className="share-link-terms">
                <li>Anyone with the link can view this design in 3D, download it, edit their own copy, and pass the link on.</li>
                <li>Their edits never change your design. Later edits you make are not shared - create a new link for those.</li>
                <li>The design is stored on Axe Shaper&rsquo;s servers. A guide image you traced from stays on this device.</li>
              </ul>
            </>
          )}
          {state.kind === 'creating' && <p className="share-link-muted" role="status">Creating link&hellip;</p>}

          {state.kind === 'blocked' && <p>{BLOCKED_MESSAGES[state.reason]}</p>}

          {state.kind === 'failed' && <p role="alert">{failureMessage(state.result)}</p>}

          {state.kind === 'created' && (
            <>
              <div className="share-link-url-row">
                <input className="share-link-url" type="text" readOnly value={state.url} aria-label="Share link"
                  onFocus={(event) => event.currentTarget.select()} />
                <button type="button" className="btn btn-primary" onClick={() => void handleCopy()} data-autofocus>
                  {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}
                </button>
              </div>
              <p className="share-link-muted">
                This browser remembers the key to manage or remove the link. Save the recovery key too - it is the
                only way to manage the link from another device or after clearing this browser. Keep it private.
              </p>
            </>
          )}
        </div>

        <footer className="share-link-footer">
          {(state.kind === 'ready' || state.kind === 'creating') && (
            <>
              {fileButton(false)}
              <button type="button" className="btn btn-primary" onClick={handleCreate}
                disabled={state.kind === 'creating'} data-autofocus>
                <Link2 size={15} /> {state.kind === 'creating' ? 'Creating…' : 'Create link'}
              </button>
            </>
          )}
          {state.kind === 'blocked' && fileButton(true)}
          {state.kind === 'failed' && (
            <>
              {fileButton(!state.result.retryable)}
              {state.result.retryable && (
                <button type="button" className="btn btn-primary" onClick={() => void send(state.pending)} data-autofocus>
                  Try again
                </button>
              )}
            </>
          )}
          {state.kind === 'created' && (
            <>
              <button type="button" className="btn btn-sm" onClick={handleSaveKey}>
                <Download size={15} /> Save recovery key
              </button>
              <a className="btn btn-sm" href={`/share/${state.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} /> Open shared design
              </a>
              <a className="btn btn-sm" href={`/manage/share/${state.id}`} target="_blank" rel="noopener noreferrer">
                Manage this link
              </a>
              <button type="button" className="btn btn-sm" onClick={onClose}>Done</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
};
