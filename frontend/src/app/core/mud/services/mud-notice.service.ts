import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Cross-component channel for short, locally generated notices that should
 * appear in the main MUD terminal alongside server output (e.g. "[Datei xyz.c
 * gespeichert]" after a successful editor save).
 *
 * The publisher (e.g. EditorComponent) does not need a reference to the
 * terminal; it just calls `notify(text)`. The MudClientComponent subscribes
 * to `notices$` and renders each notice into xterm with a distinguishing
 * style so the user can tell client-side messages from real MUD output.
 */
@Injectable({ providedIn: 'root' })
export class MudNoticeService {
  private readonly noticesSubject = new Subject<string>();

  /** Stream of local notices waiting to be displayed in the terminal. */
  public readonly notices$: Observable<string> =
    this.noticesSubject.asObservable();

  /**
   * Publishes a single-line notice. Empty strings are dropped so accidental
   * `notify('')` calls do not produce blank lines in the terminal.
   */
  public notify(text: string): void {
    if (!text) {
      return;
    }
    this.noticesSubject.next(text);
  }
}
