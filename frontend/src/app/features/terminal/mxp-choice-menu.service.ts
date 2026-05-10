import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * One open choice-menu request.
 *
 *  - `commands`  the candidate command strings (already split on `|`,
 *                trimmed, non-empty).
 *  - `x` / `y`   viewport-pixel position where the menu should anchor
 *                (typically the click-event coordinates).
 *  - `onPick`    invoked with the picked command. Closing without a
 *                pick (Esc / backdrop) does NOT call this callback.
 */
export type ChoiceMenuRequest = {
  commands: string[];
  x: number;
  y: number;
  onPick: (command: string) => void;
};

/**
 * Mediator between an MXP click that has multiple candidate commands and
 * the floating menu component that lets the user pick one.
 *
 * Stage 4 of the MXP roadmap (see u3_migrate/MXP.md). Stage 3 short-circuited
 * `choice`-actions to `commands[0]` because there was no UI yet — once
 * `MxpChoiceMenuComponent` is mounted in the app, we hand the choice over
 * to the user instead.
 */
@Injectable({ providedIn: 'root' })
export class MxpChoiceMenuService {
  private readonly currentSubject = new BehaviorSubject<ChoiceMenuRequest | null>(
    null,
  );

  public readonly currentMenu$: Observable<ChoiceMenuRequest | null> =
    this.currentSubject.asObservable();

  public get current(): ChoiceMenuRequest | null {
    return this.currentSubject.value;
  }

  /** Opens a new menu, replacing whatever was open before. */
  public open(request: ChoiceMenuRequest): void {
    this.currentSubject.next(request);
  }

  /** Closes the current menu without picking anything. No-op when none open. */
  public close(): void {
    if (this.currentSubject.value !== null) {
      this.currentSubject.next(null);
    }
  }

  /**
   * Picks the given command, fires the request's `onPick` and closes the
   * menu. If `command` is not part of the current request's command list
   * the call is ignored — protects against stale clicks after the menu
   * was already replaced.
   */
  public pick(command: string): void {
    const req = this.currentSubject.value;
    if (req === null) return;
    if (!req.commands.includes(command)) return;
    req.onPick(command);
    this.close();
  }
}
