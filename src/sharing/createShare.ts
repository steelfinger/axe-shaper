import type { GuitarProject } from '../types/guitar';
import { getAppCheckToken } from './appCheck';
import { finishFailedShare, forgetPendingShare, sharingStorage } from './pendingShares';
import { fetchSharingStatus, preflightShare, rememberShareKey, sendShare } from './shareLinkClient';
import type { PendingShare, ShareBlockReason, SharePreflight, ShareSendResult } from './shareLinkClient';

/**
 * Create link, minus the dialog. The editor's Share dialog and the 3D viewer's
 * Share (through `viewerBridge`) both create links with these, so a link made
 * from the viewer gets the same checks, consent text and key handling.
 */

export const BLOCKED_MESSAGES: Record<ShareBlockReason, string> = {
  unavailable: 'Link sharing is not available right now. You can still share the project file.',
  paused: 'Creating new links is paused for the moment. You can still share the project file.',
  'newer-fields': 'This design contains fields from a newer app. Share the project file instead.',
  'unsupported-schema': 'This design uses features that link sharing does not support yet. Share the project file instead.',
  invalid: 'This design could not be prepared for a link. Share the project file instead.',
  'too-large': 'This design is too large to share as a link. Share the project file instead.',
};

/** What the person agrees to by creating a link. Shown verbatim wherever a link is created. */
export const SHARE_TERMS: readonly string[] = Object.freeze([
  'Anyone with the link can view this design in 3D, download it, edit their own copy, and pass the link on.',
  'Their edits never change your design. Later edits you make are not shared - create a new link for those.',
  'The design is stored on Axe Shaper’s servers. A guide image you traced from stays on this device.',
]);

export async function checkShareable(project: GuitarProject): Promise<SharePreflight> {
  const status = await fetchSharingStatus((input, init) => fetch(input, init));
  return preflightShare(project, status);
}

/**
 * Send a confirmed request and record the outcome in this browser: the
 * management key on success (so Manage works without the recovery file, and
 * the interrupted-upload record can go), or a terminal failure so recovery
 * stops offering it.
 */
export async function sendAndRecordShare(pending: PendingShare, title: string): Promise<ShareSendResult> {
  const result = await sendShare(pending, (input, init) => fetch(input, init), getAppCheckToken);
  const storage = sharingStorage();
  if (result.ok) {
    if (rememberShareKey(storage, result.id, { managementSecret: pending.managementSecret, title,
      createdAt: result.createdAt })) forgetPendingShare(storage, pending);
  } else if (!result.retryable) {
    finishFailedShare(storage, pending, result.code);
  }
  return result;
}
