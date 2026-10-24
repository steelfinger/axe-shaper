import { useState } from 'react';
import { getAppCheckToken } from '../sharing/appCheck';
import { finishFailedShare, forgetPendingShare, pendingShares, savedShareAttempts, sharingStorage } from '../sharing/pendingShares';
import { shareFailureMessage } from '../sharing/shareErrors';
import type { SavedPendingShare } from '../sharing/pendingShares';
import { rememberShareKey, sendShare } from '../sharing/shareLinkClient';

export function PendingShareNotice() {
  const [count] = useState(() => pendingShares(sharingStorage()).length);
  if (!count || window.location.pathname === '/recover-sharing') return null;
  return <aside className="sharing-notice" aria-label="Interrupted sharing">
    <a href="/recover-sharing">Recover an interrupted shared link</a>
  </aside>;
}

function RecoverShare({ pending, onDismiss }: { pending: SavedPendingShare; onDismiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [id, setId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(pending.terminalError);
  const expired = Date.now() >= pending.deadline;
  const recover = async () => {
    if (busy || terminal || expired) return;
    setBusy(true);
    const result = await sendShare(pending, fetch, getAppCheckToken);
    if (result.ok) {
      const storage = sharingStorage();
      if (rememberShareKey(storage, result.id, { managementSecret: pending.managementSecret,
        title: pending.title, createdAt: result.createdAt })) {
        forgetPendingShare(storage, pending);
        setId(result.id);
      } else setMessage('The link was found, but its key could not be saved. Allow browser storage, then try again.');
    } else {
      setMessage(shareFailureMessage(result.code));
      if (!result.retryable) {
        finishFailedShare(sharingStorage(), pending, result.code);
        setTerminal(result.code);
      }
    }
    setBusy(false);
  };
  return <section className="sharing-recovery-item">
    <h2>{pending.title || 'Untitled design'}</h2>
    {id ? <>
      <p>Your link is ready. Save its recovery key from the management page before clearing browser storage.</p>
      <a className="btn btn-primary" href={`/manage/share/${id}`}>Manage recovered link</a>
      <a className="btn btn-sm" href={`/share/${id}`}>Open shared design</a>
    </> : <>
      <p>{terminal ? shareFailureMessage(terminal) : expired
        ? shareFailureMessage('operation-expired')
        : 'Recover the exact design you already confirmed. This checks the original request and will not create a duplicate.'}</p>
      {!terminal && !expired && <button className="btn btn-primary" disabled={busy} onClick={() => void recover()}>
        {busy ? 'Recovering…' : 'Recover link'}
      </button>}
      {expired && <a href="mailto:steelfinger@steelfinger.fi?subject=Axe%20Shaper%20link%20recovery">Contact support</a>}
      {(expired || terminal) && <>
        <p>Dismissing removes this request and its recovery details from this browser. It does not remove any link already created.</p>
        <button className="btn btn-sm" onClick={() => { forgetPendingShare(sharingStorage(), pending); onDismiss(); }}>Dismiss saved request</button>
      </>}
    </>}
    {message && !terminal && <p role="alert">{message}</p>}
  </section>;
}

export function RecoverSharesPage() {
  const [pending, setPending] = useState(() => savedShareAttempts(sharingStorage()));
  return <main className="sharing-recovery-page">
    <a href="/app">Back to the editor</a>
    <h1>Recover shared links</h1>
    <p>These uploads were confirmed in this browser, but their completion was interrupted.</p>
    {pending.length ? pending.map(item => <RecoverShare key={item.body} pending={item}
      onDismiss={() => setPending(items => items.filter(candidate => candidate !== item))} />)
      : <p>There are no interrupted uploads in this browser.</p>}
  </main>;
}
