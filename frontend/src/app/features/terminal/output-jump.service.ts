import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Broadcasts a "jump to current output" request to whoever owns the
 * terminal / screen reader plumbing.
 *
 * Why this lives in its own service rather than being a direct call on
 * MudClientComponent: the trigger fires from at least two places — the
 * footer button in `CharFooterComponent` and the Ctrl+End / Cmd+End
 * keyboard shortcut handled inside the terminal — and both should
 * converge on the same handler without coupling either to the other.
 *
 * Subscribers should:
 *   - scroll the terminal to the bottom (xterm `scrollToBottom`)
 *   - drain the screen-reader live region (`screenReader.stopAnnouncements`)
 * but **not** clear the history region: the user wants to skip ahead in
 * the current speech queue without losing the ability to navigate back
 * through old output via the H key.
 */
@Injectable({ providedIn: 'root' })
export class OutputJumpService {
  private readonly jumpSubject = new Subject<void>();

  public readonly jump$: Observable<void> = this.jumpSubject.asObservable();

  /**
   * Requests an immediate jump to the latest output. Safe to call from
   * anywhere — keyboard shortcut, footer button, gesture, ...
   */
  public requestJump(): void {
    this.jumpSubject.next();
  }
}
