import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';
import { EzInputComponent, EzInputSubmission } from '@webmud3/frontend/features/terminal-ez/ez-input.component';
import { EzOutputComponent } from '@webmud3/frontend/features/terminal-ez/ez-output.component';

/**
 * Splitscreen-Variante des MUD-Clients unter `/ez`.
 *
 * Phase 4: Output-Bereich + native Eingabezeile + echtes Wiring an
 * `MudService.sendMessage`. Lokales Echo nur im Default-Modus.
 *
 * Connection-Lifecycle:
 *  - Beim Mount: nur connecten, wenn `mudService` noch keine
 *    aktive Telnet-Session hält (Singleton überlebt Routenwechsel).
 *  - Beim Destroy: **kein** `disconnect()` — der Wechsel zurück nach `/`
 *    soll die Session behalten. Expliziter Disconnect bleibt dem User
 *    über das Footer-Menü vorbehalten (Phase 5/8).
 *
 * Diese Datei darf nichts vom bestehenden xterm-Eingabe-Pfad
 * (`MudInputController`, Helper-Textarea, `MobileInputComponent`)
 * importieren oder anstoßen.
 */
@Component({
  selector: 'app-ez-shell',
  templateUrl: './ez-shell.component.html',
  styleUrls: ['./ez-shell.component.scss'],
  imports: [RouterLink, EzOutputComponent, EzInputComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzShellComponent implements AfterViewInit {
  private readonly mudService = inject(MudService);

  @ViewChild(EzOutputComponent, { static: true })
  private readonly ezOutput!: EzOutputComponent;

  ngAfterViewInit(): void {
    // Idempotent connect — if the user opened `/ez` directly (no Classic
    // shell ever mounted) we have to open the telnet session ourselves.
    // If a session is already running (e.g. user navigated from `/`), the
    // singleton stays as-is and we simply piggy-back on it.
    if (!this.mudService.isConnected) {
      const { columns, rows } = this.ezOutput.getDimensions();
      this.mudService.connect({ columns, rows });
    }
  }

  protected onCommit(submission: EzInputSubmission): void {
    switch (submission.mode) {
      case 'password':
        // SecureString path: `sendMessage` does not log the value, and we
        // never echo passwords locally.
        this.mudService.sendMessage({ value: submission.value });
        return;

      case 'default':
        this.mudService.sendMessage(submission.value);
        // Local echo so the user sees what they sent — server in this mode
        // does not echo back (showEcho=true means "client echoes locally").
        this.ezOutput.writeLocalEcho(submission.value);
        return;

      case 'editor':
        // Server echoes every line itself when LINEMODE-edit is off, so
        // we deliberately skip the local echo to avoid duplication.
        this.mudService.sendMessage(submission.value);
        return;
    }
  }
}
