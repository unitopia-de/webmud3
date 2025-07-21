import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-mud-input',
  templateUrl: './mud-input.component.html',
  styleUrls: ['./mud-input.component.scss'],
  standalone: true,
  imports: [FormsModule],
})
export class MudInputComponent {
  /** 'text' = Klartext-Echo, 'password' = verdeckt */
  @Input() mode: 'text' | 'password' = 'text';

  /** Feuert bei <Enter> den aktuellen Inhalt */
  @Output() submitCommand = new EventEmitter<string>();

  value = '';

  protected submit(ev: Event) {
    ev.preventDefault();
    const trimmed = this.value.trim();
    if (trimmed) {
      this.submitCommand.emit(trimmed);
      this.value = ''; // Eingabe leeren
    }
  }
}
