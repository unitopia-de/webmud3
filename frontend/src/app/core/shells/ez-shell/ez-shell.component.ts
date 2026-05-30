import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Splitscreen-Variante des MUD-Clients unter `/ez`.
 *
 * Aktuell nur ein Platzhalter — wird in den folgenden Phasen mit
 * EzOutputComponent, EzInputComponent, Footer- und Windows-Wiederverwendung
 * gefüllt (siehe SPLITSCREEN_TODO.md, Phasen 2–8).
 *
 * Diese Datei darf in Phase 1 nichts vom bestehenden xterm-Eingabe-Pfad
 * importieren oder anstoßen — die ganze Idee der Variante ist, das
 * problematische `MudInputController`/Helper-Textarea-Konstrukt zu umgehen.
 */
@Component({
  selector: 'app-ez-shell',
  templateUrl: './ez-shell.component.html',
  styleUrls: ['./ez-shell.component.scss'],
  imports: [RouterLink],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EzShellComponent {}
