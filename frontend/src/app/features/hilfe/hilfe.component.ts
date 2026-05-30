import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Statische Hilfe-/Übersichtsseite unter `/hilfe`.
 *
 * Zweck:
 *  - Die zwei Eingabe-Modi erklären und per großen Buttons dorthin
 *    weiterleiten (`/` klassisch, `/ez` feste Eingabezeile).
 *  - Die wichtigsten Funktionen des Clients an einem Ort auflisten.
 *
 * Bewusst ohne MUD-Verbindung, Footer oder Fenster — eine reine
 * Informationsseite. Sie ist barrierearm aufgebaut (durchgehende
 * Überschriften-Hierarchie, semantische Listen, sichtbarer Fokus), damit
 * sie auch mit Screenreader gut benutzbar ist.
 */
@Component({
  selector: 'app-hilfe',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hilfe.component.html',
  styleUrls: ['./hilfe.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HilfeComponent {}
