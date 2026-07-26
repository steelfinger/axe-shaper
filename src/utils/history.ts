import type { GuitarProject } from '../types/guitar';

export class HistoryManager {
  private past: GuitarProject[] = [];
  private future: GuitarProject[] = [];
  private maxHistory: number = 50;

  public push(state: GuitarProject): void {
    // Clone state deep to prevent unintended mutations
    const snapshot = JSON.parse(JSON.stringify(state));
    this.past.push(snapshot);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.future = []; // Clear redo stack on new user mutation
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public undo(currentState: GuitarProject): GuitarProject | null {
    if (!this.canUndo()) return null;
    const previous = this.past.pop()!;
    this.future.push(JSON.parse(JSON.stringify(currentState)));
    return previous;
  }

  public redo(currentState: GuitarProject): GuitarProject | null {
    if (!this.canRedo()) return null;
    const next = this.future.pop()!;
    this.past.push(JSON.parse(JSON.stringify(currentState)));
    return next;
  }
}
