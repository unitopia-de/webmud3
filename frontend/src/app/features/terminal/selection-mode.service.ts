import { Injectable, computed, signal } from '@angular/core';

/**
 * Where the next tap is expected to land. Both xterm (output window) and
 * Monaco (editor) listen for the same service so the footer button can
 * trigger range selection in whichever window the user taps in.
 */
export type SelectionTarget = 'xterm' | 'editor';

export type SelectionState =
  | 'inactive'
  | 'awaiting-anchor'   // mode armed, no marker placed yet
  | 'awaiting-extend'   // anchor placed, waiting for second tap
  | 'adjusting';        // both markers placed, drag-to-refine

/**
 * Opaque marker position. Hosting components store their own coordinate
 * representation in `data` (xterm: `{col, row}` in buffer coords;
 * Monaco: `{lineNumber, column}` in editor coords).
 */
export interface SelectionMarker {
  target: SelectionTarget;
  data: unknown;
}

/**
 * Drives the touch-friendly "two-tap + drag" range selection UX.
 *
 * Flow:
 *   1. Footer button → state: `awaiting-anchor`
 *   2. First tap in a window → state: `awaiting-extend`, `anchor` set
 *   3. Second tap in same window → state: `adjusting`, `end` set, selection
 *      is rendered live with two draggable handles
 *   4. User drags either handle → `anchor` / `end` updated live, the host
 *      re-applies `terminal.select(...)` / `editor.setSelection(...)`
 *   5. Footer button again → `commit()`, state: `inactive`, the visible
 *      selection persists so the user can copy it
 *
 * Why two-tap-then-drag instead of plain drag from the start: long-press
 * is already taken by the browser's native context menu (which we keep for
 * paste), and xterm / Monaco are canvas-rendered so no native text-drag
 * selection works on touch. The two-tap places a rough range quickly, the
 * drag handles let the user refine pixel-accurately on small tablet cells.
 */
@Injectable({ providedIn: 'root' })
export class SelectionModeService {
  public readonly state = signal<SelectionState>('inactive');
  public readonly anchor = signal<SelectionMarker | null>(null);
  public readonly end = signal<SelectionMarker | null>(null);

  public readonly isActive = computed(() => this.state() !== 'inactive');

  /**
   * Footer button. Behaviour depends on current state:
   *   - inactive → arm the mode
   *   - awaiting-anchor / awaiting-extend → cancel
   *   - adjusting → commit (selection stays, mode exits)
   */
  public toggle(): void {
    const current = this.state();
    if (current === 'inactive') {
      this.state.set('awaiting-anchor');
      return;
    }
    if (current === 'adjusting') {
      this.commit();
      return;
    }
    this.cancel();
  }

  /**
   * First tap landed. If we already have an anchor in a different target,
   * the previous anchor is discarded silently (the user effectively
   * re-anchored). After this we wait for the second tap.
   */
  public setAnchor(target: SelectionTarget, data: unknown): void {
    this.anchor.set({ target, data });
    this.end.set(null);
    this.state.set('awaiting-extend');
  }

  /**
   * Second tap landed. Only honoured if the anchor is in the same target —
   * otherwise the user is trying to re-anchor in a different window, which
   * we treat as `setAnchor` instead.
   */
  public setEnd(target: SelectionTarget, data: unknown): void {
    const anchor = this.anchor();
    if (anchor === null || anchor.target !== target) {
      this.setAnchor(target, data);
      return;
    }
    this.end.set({ target, data });
    this.state.set('adjusting');
  }

  /** A handle is being dragged — caller has computed the new buffer coord. */
  public updateAnchor(data: unknown): void {
    const anchor = this.anchor();
    if (anchor === null) return;
    this.anchor.set({ target: anchor.target, data });
  }

  public updateEnd(data: unknown): void {
    const end = this.end();
    if (end === null) return;
    this.end.set({ target: end.target, data });
  }

  /**
   * Commits the selection — clears markers but leaves the in-window text
   * selection (rendered by the host's `terminal.select` / `editor.setSelection`)
   * in place so the user can copy it.
   */
  public commit(): void {
    this.state.set('inactive');
    this.anchor.set(null);
    this.end.set(null);
  }

  /** Same effect as commit, just semantically different (no selection placed). */
  public cancel(): void {
    this.state.set('inactive');
    this.anchor.set(null);
    this.end.set(null);
  }
}
