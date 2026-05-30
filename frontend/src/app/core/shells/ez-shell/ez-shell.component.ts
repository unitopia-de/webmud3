import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EzInputComponent, EzInputSubmission } from '@webmud3/frontend/features/terminal-ez/ez-input.component';
import { EzOutputComponent } from '@webmud3/frontend/features/terminal-ez/ez-output.component';

/**
 * Splitscreen-Variante des MUD-Clients unter `/ez`.
 *
 * Phase 3: Output-Bereich + native Eingabezeile (Default/Passwort/Editor).
 * Das Wiring an `MudService.sendMessage` kommt in Phase 4 — bis dahin
 * wird der commit nur ins Debug-Log geschrieben, damit man sehen kann,
 * dass die Eingabe-Pipeline feuert. **Passwort-Werte werden bewusst NICHT
 * geloggt**, nur die Tatsache, dass ein Passwort gesendet wurde.
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
export class EzShellComponent {
  protected onCommit(submission: EzInputSubmission): void {
    if (submission.isPassword) {
      // Never log the password itself — only that one was submitted.
      // Phase 4 will hand this off to `mudService.sendMessage` as a
      // SecureString.
      // eslint-disable-next-line no-console
      console.debug('[EZ] password submission (value redacted)');
      return;
    }
    // eslint-disable-next-line no-console
    console.debug('[EZ] command submission:', submission.value);
  }
}
