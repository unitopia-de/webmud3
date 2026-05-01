import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  NumpadKey,
  NumpadService,
  NumpadBindings,
} from './numpad.service';

type Cell = {
  /** Logical key id (or null for empty grid cell) */
  key: NumpadKey | null;
  /** Label shown on the key (e.g. "8", "+") */
  label: string;
  /** Optional column-span hint (for the wide "0" key) */
  span?: number;
};

/**
 * 4-column grid mirroring a hardware numpad. `null` cells render empty
 * to preserve visual alignment.
 */
const LAYOUT: Cell[] = [
  // Row 1: /  *  _  _
  { key: 'NumpadDivide', label: '/' },
  { key: 'NumpadMultiply', label: '×' },
  { key: null, label: '' },
  { key: null, label: '' },
  // Row 2: 7  8  9  +
  { key: 'Numpad7', label: '7' },
  { key: 'Numpad8', label: '8' },
  { key: 'Numpad9', label: '9' },
  { key: 'NumpadAdd', label: '+' },
  // Row 3: 4  5  6  −
  { key: 'Numpad4', label: '4' },
  { key: 'Numpad5', label: '5' },
  { key: 'Numpad6', label: '6' },
  { key: 'NumpadSubtract', label: '−' },
  // Row 4: 1  2  3  _
  { key: 'Numpad1', label: '1' },
  { key: 'Numpad2', label: '2' },
  { key: 'Numpad3', label: '3' },
  { key: null, label: '' },
  // Row 5: 0(span 2)  ,  Enter
  { key: 'Numpad0', label: '0', span: 2 },
  { key: 'NumpadDecimal', label: ',' },
  { key: 'NumpadEnter', label: '⏎' },
];

@Component({
  selector: 'app-numpad-config',
  templateUrl: './numpad-config.component.html',
  styleUrls: ['./numpad-config.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumpadConfigComponent {
  private readonly numpad = inject(NumpadService);

  public readonly bindings$ = this.numpad.bindings$;
  public readonly layout = LAYOUT;
  public readonly editingKey = signal<NumpadKey | null>(null);
  public readonly editingValue = signal<string>('');

  public commandFor(bindings: NumpadBindings, key: NumpadKey | null): string {
    if (!key) return '';
    return bindings[key] ?? '';
  }

  public onKeyClick(key: NumpadKey | null): void {
    if (!key || this.editingKey() !== null) return;
    this.numpad.trigger(key);
  }

  public startEdit(key: NumpadKey | null, current: string, event: Event): void {
    event.stopPropagation();
    if (!key) return;
    this.editingKey.set(key);
    this.editingValue.set(current);
  }

  public saveEdit(): void {
    const key = this.editingKey();
    if (key === null) return;
    this.numpad.setBinding(key, this.editingValue());
    this.editingKey.set(null);
    this.editingValue.set('');
  }

  public cancelEdit(): void {
    this.editingKey.set(null);
    this.editingValue.set('');
  }

  public onResetClick(): void {
    this.numpad.resetToDefaults();
  }
}
