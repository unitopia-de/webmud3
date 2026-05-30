import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EzOutputComponent } from '@webmud3/frontend/features/terminal-ez/ez-output.component';

/**
 * Splitscreen-Variante des MUD-Clients unter `/ez`.
 *
 * Phase 2: Output-Bereich (read-only xterm) ist eingebaut. Die Eingabezeile
 * kommt in Phase 3; Footer + Window-Container in Phase 5.
 *
 * Diese Datei darf nichts vom bestehenden xterm-Eingabe-Pfad
 * (`MudInputController`, Helper-Textarea, `MobileInputComponent`)
 * importieren oder anstoßen — die ganze Idee der Variante ist, das
 * problematische Konstrukt zu umgehen.
 */
@Component({
  selector: 'app-ez-shell',
  templateUrl: './ez-shell.component.html',
  styleUrls: ['./ez-shell.component.scss'],
  imports: [RouterLink, EzOutputComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzShellComponent {}
