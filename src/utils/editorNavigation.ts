import type { StoredProject } from '../types/guitar';
import { loadProject, type ProjectLoadResult } from './presets';
import { extractProjectFromSVG } from './svgExporter';

/**
 * The browser-history and confirm rules behind the editor shell, as functions
 * over an injected environment instead of `window`. `EditorRoute` supplies the
 * real one; tests supply a fake. The rules are the point - they are what stops
 * Back from leaving /app, and what stops a Back from silently discarding work.
 */

export const EDITING_HISTORY_STATE = { axe: 'editing' } as const;

export interface NavigationEnv {
  history: Pick<History, 'state' | 'pushState' | 'replaceState'>;
  confirm: (message: string) => boolean;
}

export const LEAVE_FOR_NEW_DESIGN_MESSAGE = 'Start a new design? Unsaved changes to this one will be lost.';
export const LEAVE_VIA_BACK_MESSAGE = 'Leave this design for the New Design screen? Unsaved changes will be lost.';

export function isEditingHistoryEntry(history: Pick<History, 'state'>): boolean {
  return (history.state as { axe?: string } | null)?.axe === 'editing';
}

/**
 * Called as a project opens. One history entry for the editor, pushed only
 * when coming from the chooser - not for a `?plan=` open (still `loading`
 * here), whose own effect normalises the URL, and not if somehow already on
 * the editor entry. Back from the editor then lands on the chooser.
 */
export function noteEditorOpened(from: 'loading' | 'choosing' | 'editing', env: NavigationEnv): void {
  if (from === 'choosing' && !isEditingHistoryEntry(env.history)) {
    env.history.pushState(EDITING_HISTORY_STATE, '');
  }
}

/**
 * Called when the in-editor control returns to the chooser. Demote the editor
 * entry to a plain one rather than pushing another, so Back from the chooser
 * does not drop onto a torn-down editor.
 */
export function noteReturnedToChooser(env: NavigationEnv): void {
  if (isEditingHistoryEntry(env.history)) env.history.replaceState(null, '');
}

/** Whether the in-editor "New..." control may proceed. A prompt on an untouched document teaches people to click through prompts. */
export function mayStartNewDesign(isDirty: boolean, confirm: NavigationEnv['confirm']): boolean {
  return !isDirty || confirm(LEAVE_FOR_NEW_DESIGN_MESSAGE);
}

/**
 * What a `popstate` should do. `leave` means tear down the editor for the
 * chooser; `stay` means do nothing further (the history entry has already
 * been repaired or restored here).
 */
export function resolvePopState(
  routeKind: 'loading' | 'choosing' | 'editing',
  isDirty: boolean,
  env: NavigationEnv
): 'stay' | 'leave' {
  if (isEditingHistoryEntry(env.history)) {
    // Forward, back into the editor entry - but its EditorApp is gone and
    // there is no project to restore. Normalise the entry and stay put.
    if (routeKind !== 'editing') env.history.replaceState(null, '');
    return 'stay';
  }
  if (routeKind !== 'editing') return 'stay';
  if (isDirty && !env.confirm(LEAVE_VIA_BACK_MESSAGE)) {
    // Cancelled: re-push the entry the browser just popped.
    env.history.pushState(EDITING_HISTORY_STATE, '');
    return 'stay';
  }
  return 'leave';
}

/**
 * Fetch and load the plan a `?plan=` link names. Never throws: a failed fetch,
 * a non-2xx, an unparseable file and a refused one all come back as a
 * not-ok result, so the caller's fallback to the chooser is one branch.
 */
export async function loadPlan(
  src: string,
  fetchImpl: (input: string) => Promise<Pick<Response, 'ok' | 'status' | 'statusText' | 'text'>>
): Promise<ProjectLoadResult> {
  let imported: StoredProject | null = null;
  try {
    const response = await fetchImpl(src);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    imported = extractProjectFromSVG(await response.text());
  } catch {
    imported = null;
  }
  return loadProject(imported);
}

