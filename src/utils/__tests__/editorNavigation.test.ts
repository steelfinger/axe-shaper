import { describe, expect, it, vi } from 'vitest';
import { PROJECT_SCHEMA_VERSION } from '../../constants/schema';
import {
  EDITING_HISTORY_STATE,
  LEAVE_FOR_NEW_DESIGN_MESSAGE,
  LEAVE_VIA_BACK_MESSAGE,
  loadPlan,
  mayStartNewDesign,
  noteEditorOpened,
  noteReturnedToChooser,
  resolvePopState,
  type NavigationEnv,
} from '../editorNavigation';
import { createProject } from '../projectFactory';
import { exportProjectToSVG } from '../svgExporter';

/** A history stack that behaves like the browser's for the calls the shell makes. */
function fakeEnv(answer = true, initialState: unknown = null) {
  const entries: unknown[] = [initialState];
  let index = 0;
  const confirm = vi.fn(() => answer);
  const env: NavigationEnv = {
    history: {
      get state() {
        return entries[index];
      },
      pushState: (state: unknown) => {
        entries.splice(index + 1);
        entries.push(state);
        index += 1;
      },
      replaceState: (state: unknown) => {
        entries[index] = state;
      },
    },
    confirm,
  };
  return { env, confirm, entries, back: () => (index -= 1), forward: () => (index += 1) };
}

describe('opening the editor', () => {
  it('pushes one history entry when coming from the chooser', () => {
    const { env, entries } = fakeEnv();
    noteEditorOpened('choosing', env);
    expect(entries).toEqual([null, EDITING_HISTORY_STATE]);
  });

  it('does not push for a ?plan= open (still loading)', () => {
    const { env, entries } = fakeEnv();
    noteEditorOpened('loading', env);
    expect(entries).toEqual([null]);
  });

  it('does not push a second entry when already on the editor entry', () => {
    const { env, entries } = fakeEnv(true, EDITING_HISTORY_STATE);
    noteEditorOpened('choosing', env);
    expect(entries).toHaveLength(1);
  });

  it('does not push when replacing one open editor with another', () => {
    const { env, entries } = fakeEnv();
    noteEditorOpened('editing', env);
    expect(entries).toEqual([null]);
  });
});

describe('returning to the chooser via the in-editor control', () => {
  it('demotes the editor entry instead of pushing another', () => {
    const { env, entries } = fakeEnv();
    noteEditorOpened('choosing', env);
    noteReturnedToChooser(env);
    expect(entries).toEqual([null, null]);
  });

  it('leaves a plain entry alone', () => {
    const { env, entries } = fakeEnv();
    noteReturnedToChooser(env);
    expect(entries).toEqual([null]);
  });
});

describe('mayStartNewDesign', () => {
  it('never prompts on an untouched document', () => {
    const confirm = vi.fn(() => false);
    expect(mayStartNewDesign(false, confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prompts when dirty and obeys the answer', () => {
    const yes = vi.fn(() => true);
    const no = vi.fn(() => false);
    expect(mayStartNewDesign(true, yes)).toBe(true);
    expect(mayStartNewDesign(true, no)).toBe(false);
    expect(no).toHaveBeenCalledWith(LEAVE_FOR_NEW_DESIGN_MESSAGE);
  });
});

describe('browser Back across the editor entry', () => {
  /** Chooser, then editor open: the stack Back is about to pop. */
  function inEditor(answer = true) {
    const fake = fakeEnv(answer);
    noteEditorOpened('choosing', fake.env);
    return fake;
  }

  it('leaves for the chooser without a prompt when nothing is unsaved', () => {
    const { env, confirm, back } = inEditor();
    back();
    expect(resolvePopState('editing', false, env)).toBe('leave');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('prompts when dirty, and leaves on confirm', () => {
    const { env, confirm, back } = inEditor(true);
    back();
    expect(resolvePopState('editing', true, env)).toBe('leave');
    expect(confirm).toHaveBeenCalledWith(LEAVE_VIA_BACK_MESSAGE);
  });

  it('stays and restores the editor entry when the prompt is cancelled', () => {
    const { env, entries, back } = inEditor(false);
    back();
    expect(resolvePopState('editing', true, env)).toBe('stay');
    expect(entries.at(-1)).toEqual(EDITING_HISTORY_STATE);
    expect(env.history.state).toEqual(EDITING_HISTORY_STATE);
  });

  it('after a cancelled Back, a second Back still prompts', () => {
    const { env, confirm, back } = inEditor(false);
    back();
    resolvePopState('editing', true, env);
    back();
    resolvePopState('editing', true, env);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('ignores a pop between chooser entries', () => {
    const { env } = fakeEnv();
    expect(resolvePopState('choosing', true, env)).toBe('stay');
  });

  it('normalises a Forward onto a torn-down editor entry and stays put', () => {
    const { env, entries, back, forward } = inEditor();
    back();
    expect(resolvePopState('editing', false, env)).toBe('leave');
    forward();
    expect(resolvePopState('choosing', false, env)).toBe('stay');
    expect(entries.at(-1)).toBeNull();
  });
});

describe('loadPlan', () => {
  const svgFor = (project: unknown) => exportProjectToSVG(project as never);
  const respond = (body: string, init: { ok?: boolean; status?: number } = {}) =>
    vi.fn(async () => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: '',
      text: async () => body,
    }));

  it('loads a good plan', async () => {
    const fetchImpl = respond(svgFor(createProject()));
    const result = await loadPlan('/marketing/x.axe.svg', fetchImpl);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/marketing/x.axe.svg');
  });

  it('reports a 404 as unreadable rather than throwing', async () => {
    const result = await loadPlan('/x', respond('nope', { ok: false, status: 404 }));
    expect(result.ok).toBe(false);
  });

  it('reports a network failure as unreadable', async () => {
    const result = await loadPlan('/x', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result.ok).toBe(false);
  });

  it('treats the SPA shell served with status 200 as unreadable', async () => {
    // firebase.json rewrites ** to index.html, so a missing plan is a 200 HTML page.
    const result = await loadPlan('/x', respond('<!doctype html><html><title>Axe Shaper</title></html>'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unreadable');
  });

  it('refuses a plan from a newer schema version', async () => {
    const future = { ...createProject(), schemaVersion: PROJECT_SCHEMA_VERSION + 1 };
    const result = await loadPlan('/x', respond(svgFor(future)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported-version');
  });
});
