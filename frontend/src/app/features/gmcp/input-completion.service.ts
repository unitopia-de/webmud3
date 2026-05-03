import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { GmcpService } from './gmcp.service';
import { InputGmcpModule } from './modules/input-gmcp.module';
import { MudSignalService } from './signals/mud-signal.service';

/**
 * Wraps the UNItopia "Input.Complete" round-trip.
 *
 * Lifecycle:
 *  1. Caller invokes `requestCompletion(buffer)` — typically the input
 *     controller's Tab handler. We send `Input.Complete <buffer>` to the MUD.
 *  2. UNItopia answers with one of three GMCP messages, which the
 *     MudSignalService has already turned into typed signals. We re-expose
 *     them as three dedicated streams so consumers don't need to deal with
 *     the discriminated union.
 *
 * The service eagerly instantiates `InputGmcpModule` so the package is part
 * of the `Core.Supports.Set` handshake — without that announcement UNItopia
 * silently ignores the outgoing `Input.Complete` request.
 */
@Injectable({ providedIn: 'root' })
export class InputCompletionService {
  private readonly gmcp = inject(GmcpService);
  private readonly signals = inject(MudSignalService);
  // Side-effect: registers "Input 1" with the GmcpService.
  private readonly _module = inject(InputGmcpModule);

  private readonly textSubject = new Subject<string>();
  private readonly choiceSubject = new Subject<string[]>();
  private readonly noneSubject = new Subject<void>();

  /** The MUD found exactly one completion — replace the buffer with `text`. */
  public readonly text$: Observable<string> = this.textSubject.asObservable();
  /** The MUD found multiple options (wizard-only). */
  public readonly choices$: Observable<string[]> =
    this.choiceSubject.asObservable();
  /** The MUD found no match — UI should signal "nothing to complete". */
  public readonly none$: Observable<void> = this.noneSubject.asObservable();

  constructor() {
    this.signals.on('Input.CompleteText').subscribe((s) => {
      this.textSubject.next(s.text);
    });

    this.signals.on('Input.CompleteChoice').subscribe((s) => {
      this.choiceSubject.next(s.choices);
    });

    this.signals.on('Input.CompleteNone').subscribe(() => {
      this.noneSubject.next();
    });
  }

  /**
   * Asks the MUD to complete `buffer`. UNItopia accepts the current command
   * line as a bare JSON string in the payload. No-op when GMCP is not active
   * yet (the controller will simply not see a reply).
   */
  public requestCompletion(buffer: string): void {
    if (buffer.length === 0) {
      return;
    }
    this.gmcp.send('Input.Complete', buffer);
  }
}
