import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { forgetShareKey, manageShare, managementKeyFromInput, storedShareKey } from '../sharing/shareLinkClient';
import type { ManagedShare } from '../sharing/shareLinkClient';

type ManageState =
  | { kind: 'need-key'; error?: string }
  | { kind: 'checking' }
  | { kind: 'active'; key: string; confirming: boolean; busy: boolean; error?: string }
  | { kind: 'revoked'; revokedAt: string | null };

const storage = (): Storage | null => {
  try { return window.localStorage; } catch { return null; }
};
const fetchImpl = (input: string, init?: RequestInit) => fetch(input, init);

function stateFor(result: ManagedShare, key: string): ManageState {
  if (!result.ok) return { kind: 'need-key', error: result.message };
  return result.state === 'active'
    ? { kind: 'active', key, confirming: false, busy: false }
    : { kind: 'revoked', revokedAt: result.revokedAt };
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * `/manage/share/:id`: the creator's status and Remove link, using the key this
 * device saved when the link was made, or one pasted from the recovery file.
 * The key is never put in the URL (plan, "Public and creator routes").
 */
export const ManageSharePage: React.FC<{ id: string }> = ({ id }) => {
  // Read once on arrival; Forget below navigates away rather than re-rendering without it.
  const [saved] = useState(() => storedShareKey(storage(), id));
  const [state, setState] = useState<ManageState>(saved ? { kind: 'checking' } : { kind: 'need-key' });
  const [input, setInput] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { document.title = 'Manage shared link — Axe Shaper'; }, []);

  const check = async (key: string) => {
    setState({ kind: 'checking' });
    setState(stateFor(await manageShare(id, key, 'status', fetchImpl), key));
  };

  useEffect(() => {
    if (!saved) return undefined;
    let cancelled = false;
    void (async () => {
      const result = await manageShare(id, saved.managementSecret, 'status', fetchImpl);
      if (!cancelled) setState(stateFor(result, saved.managementSecret));
    })();
    return () => { cancelled = true; };
  }, [id, saved]);

  // Each step's heading takes focus, so a screen reader hears where it is.
  useEffect(() => { headingRef.current?.focus(); }, [state.kind]);
  // The button that opened the confirmation is gone; land on the safe choice.
  const confirming = state.kind === 'active' && state.confirming;
  useEffect(() => { if (confirming) keepButtonRef.current?.focus(); }, [confirming]);

  const submitKey = (event: React.FormEvent) => {
    event.preventDefault();
    const key = managementKeyFromInput(input);
    if (!key) {
      setState({ kind: 'need-key', error: 'Paste the 43-character management key, or the whole recovery file.' });
      return;
    }
    void check(key);
  };

  const remove = async () => {
    if (state.kind !== 'active') return;
    setState({ ...state, busy: true, error: undefined });
    const result = await manageShare(id, state.key, 'revoke', fetchImpl);
    if (!result.ok) { setState({ ...state, busy: false, confirming: false, error: result.message }); return; }
    setState({ kind: 'revoked', revokedAt: result.revokedAt });
  };

  const title = saved?.title;

  return (
    <div className="new-design-screen">
      <div className="design-loading share-open-error share-manage">
        <p className="share-manage-brand"><a href="/">Axe Shaper</a> &middot; Manage shared link</p>

        {state.kind === 'checking' && (
          <h1 ref={headingRef} tabIndex={-1} role="status">Checking this link&hellip;</h1>
        )}

        {state.kind === 'need-key' && (
          <>
            <h1 ref={headingRef} tabIndex={-1}>Enter the management key</h1>
            <p>
              This device has no key for this link. Paste the management key from the recovery file you saved when
              you created it - or paste the whole file.
            </p>
            <form onSubmit={submitKey} className="share-manage-form">
              <label htmlFor="share-manage-key">Management key or recovery file</label>
              <textarea id="share-manage-key" rows={4} value={input} autoComplete="off" spellCheck={false}
                onChange={(event) => setInput(event.target.value)}
                aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'share-manage-error' : undefined} />
              {state.error && <p id="share-manage-error" role="alert" className="share-manage-error">{state.error}</p>}
              <div className="share-download-actions">
                <button type="submit" className="btn btn-primary"><KeyRound size={15} /> Continue</button>
              </div>
            </form>
          </>
        )}

        {state.kind === 'active' && (
          <>
            <h1 ref={headingRef} tabIndex={-1}>{title ? `“${title}” is shared` : 'This link is active'}</h1>
            <p>Anyone with the link can view, download and edit their own copy of this design.</p>
            {state.error && <p role="alert" className="share-manage-error">{state.error}</p>}
            {state.confirming ? (
              <div className="share-manage-confirm" role="group" aria-labelledby="share-manage-confirm-text">
                <p id="share-manage-confirm-text">
                  Remove this link? People who open it will see that it is no longer shared. Copies already downloaded
                  or opened stay with them, and the page can stay visible in caches for up to five minutes. This cannot
                  be undone.
                </p>
                <div className="share-download-actions">
                  <button ref={keepButtonRef} type="button" className="btn btn-sm" disabled={state.busy}
                    onClick={() => setState({ ...state, confirming: false })}>Keep the link</button>
                  <button type="button" className="btn share-manage-danger" disabled={state.busy} onClick={() => void remove()}>
                    <Trash2 size={15} /> {state.busy ? 'Removing…' : 'Remove link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="share-download-actions">
                <a className="btn btn-sm" href={`/share/${id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} /> View shared page
                </a>
                <button type="button" className="btn share-manage-danger"
                  onClick={() => setState({ ...state, confirming: true, error: undefined })}>
                  <Trash2 size={15} /> Remove link&hellip;
                </button>
              </div>
            )}
          </>
        )}

        {state.kind === 'revoked' && (
          <>
            <h1 ref={headingRef} tabIndex={-1}>This link has been removed</h1>
            <p>
              {formatDate(state.revokedAt) ? `Removed ${formatDate(state.revokedAt)}. ` : ''}
              The design is no longer stored for sharing. The page can stay visible in caches for up to five minutes.
            </p>
            <div className="share-download-actions">
              {saved && (
                <button type="button" className="btn btn-sm" onClick={() => { forgetShareKey(storage(), id); window.location.assign('/app'); }}>
                  Forget this link on this device
                </button>
              )}
              <a className="btn btn-primary" href="/app">Back to the editor</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
