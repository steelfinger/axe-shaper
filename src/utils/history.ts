/**
 * Undo/redo over whole-document snapshots.
 *
 * The important part is coalescing. A node drag fires an update on every
 * mousemove and typing fires one per keystroke; recorded naively that is one
 * undo step per pixel, and fifty of them evict every real edit from the stack.
 * Continuous edits therefore pass a `coalesceKey`: the first update of a
 * gesture records a snapshot, the rest of that gesture record nothing, and
 * `endGesture` closes it so the next drag of the same thing starts a new step.
 */
export class HistoryManager<T> {
  private past: T[] = [];
  private future: T[] = [];
  /** Key of the gesture currently in progress, if any. */
  private openKey: string | null = null;

  private readonly clone: (state: T) => T;
  private readonly limit: number;

  constructor(clone: (state: T) => T, limit: number = 50) {
    this.clone = clone;
    this.limit = limit;
  }

  /**
   * Record the state an undo should return to, i.e. call this with the current
   * document *before* applying the edit.
   */
  public push(state: T, coalesceKey?: string): void {
    if (coalesceKey && coalesceKey === this.openKey) return;

    this.past.push(this.clone(state));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.openKey = coalesceKey ?? null;
  }

  /** Close the current gesture so the next edit starts a fresh undo step. */
  public endGesture(): void {
    this.openKey = null;
  }

  /**
   * Discard all undo/redo history. For a document swap that isn't an edit
   * on top of what was open before - opening a different file into an
   * already-mounted editor - where the prior document must not be reachable
   * via Undo once it has been replaced.
   */
  public reset(): void {
    this.past = [];
    this.future = [];
    this.openKey = null;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(currentState: T): T | null {
    if (!this.canUndo()) return null;
    this.openKey = null;
    this.future.push(this.clone(currentState));
    return this.past.pop()!;
  }

  public redo(currentState: T): T | null {
    if (!this.canRedo()) return null;
    this.openKey = null;
    this.past.push(this.clone(currentState));
    return this.future.pop()!;
  }

  /** How many undo steps are available - handy for tests and debugging. */
  public depth(): number {
    return this.past.length;
  }
}
