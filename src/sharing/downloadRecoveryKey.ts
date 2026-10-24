import { recoveryKeyText } from './shareLinkClient';

export function downloadRecoveryKey(url: string, id: string, secret: string, title: string): void {
  const href = URL.createObjectURL(new Blob([recoveryKeyText(url, id, secret, title)], { type: 'text/plain' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `axe-shaper-link-${id}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Safari may consume the blob asynchronously after click dispatch.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
